/**
 * Phare — Cloudflare Worker (registry intake API)
 * Pair with: ../index.html (GitHub Pages frontend)
 *
 * REQUIRED SECRETS (wrangler secret put):
 *   REGISTRY_PRIVATE_JWK  — P-256 ECDH private JWK (one line JSON)
 *   ALLOWED_ORIGINS       — comma-separated HTTPS origins (required, fail-closed)
 *   IP_HASH_SALT          — random string for hashing client IPs (rate limit only)
 *   INVITE_TOKEN          — optional; if set, POST requires X-Phare-Invite header
 *
 * Deploy: cd cloudflare && wrangler deploy
 */

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SEC = 3600;
const INTAKE_TTL_SEC = 14400;
const MAX_BODY_BYTES = 98304; // 96 KiB
import { validateIntakePayload, isHoneypotTriggered, PROTOCOL_VERSION } from '../lib/intake-validate.mjs';
import { buildCors, securityHeaders, timingSafeEqual, jsonResponse } from '../lib/worker-http.mjs';

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const cors = buildCors(request, env);

        if (request.method === 'OPTIONS') {
            if (!cors['Access-Control-Allow-Origin']) {
                return jsonResponse({ error: 'Origin not allowed' }, 403);
            }
            return new Response(null, { status: 204, headers: securityHeaders(cors) });
        }

        try {
            if (url.pathname === '/api/intake/pubkey' && request.method === 'GET') {
                return await handlePubkey(env, cors);
            }

            if (url.pathname === '/api/intake' && request.method === 'POST') {
                return await handleIntake(request, env, cors);
            }

            if (url.pathname === '/api/intake/health' && request.method === 'GET') {
                return jsonResponse({ ok: true, v: PROTOCOL_VERSION, ts: new Date().toISOString() }, 200, securityHeaders(cors));
            }

            return jsonResponse({ error: 'Not found' }, 404, securityHeaders(cors));
        } catch (err) {
            return jsonResponse({ error: 'Registry unavailable' }, 503, securityHeaders(cors));
        }
    }
};

async function handlePubkey(env, cors) {
    const publicKey = await getRegistryPublicJwk(env);
    return jsonResponse({ v: PROTOCOL_VERSION, publicKey }, 200, {
        ...securityHeaders(cors),
        'Cache-Control': 'public, max-age=300'
    });
}

async function handleIntake(request, env, cors) {
    if (!cors['Access-Control-Allow-Origin']) {
        return jsonResponse({ error: 'Origin not allowed' }, 403, securityHeaders(cors));
    }

    if (env.INVITE_TOKEN) {
        const provided = request.headers.get('X-Phare-Invite') || '';
        if (!provided || !timingSafeEqual(provided, env.INVITE_TOKEN)) {
            return jsonResponse({ error: 'Invitation required' }, 403, securityHeaders(cors));
        }
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const ipHash = await hashIp(ip, env);

    if (await isRateLimited(ipHash, env)) {
        return jsonResponse({ error: 'Rate limit exceeded' }, 429, securityHeaders(cors));
    }

    const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10);
    if (contentLength > MAX_BODY_BYTES) {
        return jsonResponse({ error: 'Payload too large' }, 413, securityHeaders(cors));
    }

    let body;
    try {
        const raw = await request.text();
        if (raw.length > MAX_BODY_BYTES) {
            return jsonResponse({ error: 'Payload too large' }, 413, securityHeaders(cors));
        }
        body = JSON.parse(raw);
    } catch (_) {
        return jsonResponse({ error: 'Invalid JSON' }, 400, securityHeaders(cors));
    }

    if (isHoneypotTriggered(body)) {
        return jsonResponse({ error: 'Invalid submission' }, 400, securityHeaders(cors));
    }

    const err = validateIntakePayload(body);
    if (err) return jsonResponse({ error: err }, 400, securityHeaders(cors));

    const id = crypto.randomUUID();
    const record = {
        id,
        receivedAt: new Date().toISOString(),
        v: body.v,
        ephemeralPublicKey: body.ephemeralPublicKey,
        iv: body.iv,
        ciphertext: body.ciphertext
    };

    if (!env.PHARE_KV) {
        return jsonResponse({ error: 'Registry storage not configured' }, 503, securityHeaders(cors));
    }

    await env.PHARE_KV.put(`intake:${id}`, JSON.stringify(record), {
        expirationTtl: INTAKE_TTL_SEC
    });

    return jsonResponse({ ok: true, id, receivedAt: record.receivedAt }, 202, securityHeaders(cors));
}

async function isRateLimited(ipHash, env) {
    if (!env.PHARE_KV) return false;
    const key = `rate:${ipHash}`;
    const now = Date.now();
    const raw = await env.PHARE_KV.get(key);
    let data = raw ? JSON.parse(raw) : { count: 0, windowStart: now };

    if (now - data.windowStart > RATE_LIMIT_WINDOW_SEC * 1000) {
        data = { count: 0, windowStart: now };
    }
    if (data.count >= RATE_LIMIT_MAX) return true;

    data.count += 1;
    await env.PHARE_KV.put(key, JSON.stringify(data), { expirationTtl: RATE_LIMIT_WINDOW_SEC });
    return false;
}

async function hashIp(ip, env) {
    const salt = env.IP_HASH_SALT;
    if (!salt || salt === 'phare-default-salt-change-me') {
        throw new Error('IP_HASH_SALT secret not configured');
    }
    const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(`${salt}:${ip}`)
    );
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getRegistryPublicJwk(env) {
    const privateJwk = parsePrivateJwk(env.REGISTRY_PRIVATE_JWK);
    const { kty, crv, x, y } = privateJwk;
    if (kty !== 'EC' || crv !== 'P-256' || !x || !y) {
        throw new Error('Invalid REGISTRY_PRIVATE_JWK');
    }
    return { kty, crv, x, y };
}

function parsePrivateJwk(raw) {
    if (!raw) throw new Error('REGISTRY_PRIVATE_JWK secret not configured');
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
}