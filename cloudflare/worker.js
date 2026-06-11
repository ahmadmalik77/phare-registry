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
const PROTOCOL_VERSION = 'phare-aes-gcm-ecdh-v2';

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const cors = buildCors(request, env);

        if (request.method === 'OPTIONS') {
            if (!cors['Access-Control-Allow-Origin']) {
                return json({ error: 'Origin not allowed' }, 403);
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
                return json({ ok: true, v: 'phare-ecdh-p256-v2', ts: new Date().toISOString() }, 200, securityHeaders(cors));
            }

            return json({ error: 'Not found' }, 404, securityHeaders(cors));
        } catch (err) {
            return json({ error: 'Registry unavailable' }, 503, securityHeaders(cors));
        }
    }
};

async function handlePubkey(env, cors) {
    const publicKey = await getRegistryPublicJwk(env);
    return json({ v: 'phare-ecdh-p256-v2', publicKey }, 200, {
        ...securityHeaders(cors),
        'Cache-Control': 'public, max-age=300'
    });
}

async function handleIntake(request, env, cors) {
    if (!cors['Access-Control-Allow-Origin']) {
        return json({ error: 'Origin not allowed' }, 403, securityHeaders(cors));
    }

    if (env.INVITE_TOKEN) {
        const provided = request.headers.get('X-Phare-Invite') || '';
        if (!provided || !timingSafeEqual(provided, env.INVITE_TOKEN)) {
            return json({ error: 'Invitation required' }, 403, securityHeaders(cors));
        }
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const ipHash = await hashIp(ip, env);

    if (await isRateLimited(ipHash, env)) {
        return json({ error: 'Rate limit exceeded' }, 429, securityHeaders(cors));
    }

    const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10);
    if (contentLength > MAX_BODY_BYTES) {
        return json({ error: 'Payload too large' }, 413, securityHeaders(cors));
    }

    let body;
    try {
        const raw = await request.text();
        if (raw.length > MAX_BODY_BYTES) {
            return json({ error: 'Payload too large' }, 413, securityHeaders(cors));
        }
        body = JSON.parse(raw);
    } catch (_) {
        return json({ error: 'Invalid JSON' }, 400, securityHeaders(cors));
    }

    const hp = body?.b_hp_x7k9 ?? body?.website;
    if (hp && String(hp).trim()) {
        return json({ error: 'Invalid submission' }, 400, securityHeaders(cors));
    }

    const err = validatePayload(body);
    if (err) return json({ error: err }, 400, securityHeaders(cors));

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
        return json({ error: 'Registry storage not configured' }, 503, securityHeaders(cors));
    }

    await env.PHARE_KV.put(`intake:${id}`, JSON.stringify(record), {
        expirationTtl: INTAKE_TTL_SEC
    });

    return json({ ok: true, id, receivedAt: record.receivedAt }, 202, securityHeaders(cors));
}

function validatePayload(body) {
    if (!body || typeof body !== 'object') return 'Invalid payload';
    if (body.v !== PROTOCOL_VERSION) return 'Unsupported payload version';
    if (!body.ephemeralPublicKey?.kty) return 'Missing ephemeral public key';
    if (!body.iv || typeof body.iv !== 'string') return 'Missing IV';
    if (!body.ciphertext || typeof body.ciphertext !== 'string') return 'Missing ciphertext';
    if (body.ciphertext.length > 65536) return 'Payload too large';
    if (!isValidBase64(body.iv) || !isValidBase64(body.ciphertext)) return 'Invalid encoding';
    return null;
}

function isValidBase64(s) {
    return typeof s === 'string' && s.length > 0 && s.length % 4 === 0 && /^[A-Za-z0-9+/]+=*$/.test(s);
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
    const salt = env.IP_HASH_SALT || 'phare-default-salt-change-me';
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

function getAllowedOrigins(env) {
    return (env.ALLOWED_ORIGINS || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
}

function buildCors(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = getAllowedOrigins(env);

    const headers = {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept, X-Phare-Invite',
        'Access-Control-Max-Age': '86400'
    };

    if (allowed.length === 0) {
        return headers;
    }

    if (origin && allowed.includes(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Vary'] = 'Origin';
    }

    return headers;
}

function securityHeaders(extra = {}) {
    return {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
        'Permissions-Policy': 'interest-cohort=()',
        'Cache-Control': 'no-store',
        ...extra
    };
}

function timingSafeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const len = Math.max(a.length, b.length);
    let mismatch = a.length === b.length ? 0 : 1;
    for (let i = 0; i < len; i++) {
        mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    }
    return mismatch === 0;
}

function json(data, status, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...headers }
    });
}