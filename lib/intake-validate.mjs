export const PROTOCOL_VERSION = 'phare-aes-gcm-ecdh-v2';

export function isValidBase64(s) {
    return typeof s === 'string' && s.length > 0 && s.length % 4 === 0 && /^[A-Za-z0-9+/]+=*$/.test(s);
}

export function isValidEphemeralPublicJwk(jwk) {
    return Boolean(
        jwk &&
        jwk.kty === 'EC' &&
        jwk.crv === 'P-256' &&
        typeof jwk.x === 'string' && jwk.x.length > 0 &&
        typeof jwk.y === 'string' && jwk.y.length > 0
    );
}

export function validateIntakePayload(body) {
    if (!body || typeof body !== 'object') return 'Invalid payload';
    if (body.v !== PROTOCOL_VERSION) return 'Unsupported payload version';
    if (!isValidEphemeralPublicJwk(body.ephemeralPublicKey)) return 'Invalid ephemeral public key';
    if (!body.iv || typeof body.iv !== 'string') return 'Missing IV';
    if (!body.ciphertext || typeof body.ciphertext !== 'string') return 'Missing ciphertext';
    if (body.ciphertext.length > 65536) return 'Payload too large';
    if (!isValidBase64(body.iv) || !isValidBase64(body.ciphertext)) return 'Invalid encoding';
    return null;
}