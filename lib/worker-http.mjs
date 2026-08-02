/**
 * Pure Worker HTTP helpers (shared with cloudflare/worker.js + tests).
 */

export function getAllowedOrigins(env) {
    return (env.ALLOWED_ORIGINS || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
}

export function buildCors(request, env) {
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

    if (origin && (allowed.includes(origin) || origin.endsWith('.phare-registry.pages.dev') || origin === 'https://phare-registry.pages.dev' || origin === 'https://ahmadmalik77.github.io')) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Vary'] = 'Origin';
    }

    return headers;
}

export function securityHeaders(extra = {}) {
    return {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
        'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()',
        'Cache-Control': 'no-store',
        ...extra
    };
}

export function timingSafeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const len = Math.max(a.length, b.length);
    let mismatch = a.length === b.length ? 0 : 1;
    for (let i = 0; i < len; i++) {
        mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    }
    return mismatch === 0;
}

export function jsonResponse(data, status, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...headers }
    });
}