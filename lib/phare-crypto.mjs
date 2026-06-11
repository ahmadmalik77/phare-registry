/**
 * Shared Phare ECDH + AES-GCM primitives (browser + Node Web Crypto).
 */

export const PROTOCOL_VERSION = 'phare-aes-gcm-ecdh-v2';

export function uint8ToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

export function base64ToUint8Array(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

export async function generateECDHKeyPair() {
    return crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveKey', 'deriveBits']
    );
}

export async function deriveSharedAESKey(privateKey, peerPublicKey, usages = ['encrypt', 'decrypt']) {
    return crypto.subtle.deriveKey(
        { name: 'ECDH', public: peerPublicKey },
        privateKey,
        { name: 'AES-GCM', length: 256 },
        false,
        usages
    );
}

export async function importPublicJwk(jwk) {
    // Node Web Crypto rejects deriveKey on imported ECDH public keys; browsers accept it.
    const usages = typeof process !== 'undefined' && process.versions?.node ? [] : ['deriveKey'];
    return crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        usages
    );
}

export async function importPrivateJwk(jwk) {
    if (!jwk?.d) throw new Error('Private JWK must include d component');
    return crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveKey']
    );
}

export async function fingerprintPublicJwk(jwk) {
    const canonical = JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y });
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function encryptForRegistry(payload, registryPublicJwk) {
    const registryPub = await importPublicJwk(registryPublicJwk);
    const ephemeral = await generateECDHKeyPair();
    const sharedKey = await deriveSharedAESKey(ephemeral.privateKey, registryPub, ['encrypt']);
    const ephemeralPublicKey = await crypto.subtle.exportKey('jwk', ephemeral.publicKey);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        sharedKey,
        new TextEncoder().encode(JSON.stringify(payload))
    );
    return {
        v: PROTOCOL_VERSION,
        ephemeralPublicKey,
        iv: uint8ToBase64(iv),
        ciphertext: uint8ToBase64(new Uint8Array(ciphertext))
    };
}

export async function decryptFromRegistry(privateJwk, encrypted) {
    if (encrypted.v !== PROTOCOL_VERSION) throw new Error('Unsupported version');
    const priv = await importPrivateJwk(privateJwk);
    const pub = await crypto.subtle.importKey(
        'jwk',
        encrypted.ephemeralPublicKey,
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        []
    );
    const key = await deriveSharedAESKey(priv, pub, ['decrypt']);
    const iv = base64ToUint8Array(encrypted.iv);
    const ct = base64ToUint8Array(encrypted.ciphertext);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return JSON.parse(new TextDecoder().decode(decrypted));
}

export function validateEncryptedShape(body) {
    if (!body || typeof body !== 'object') return 'Invalid payload';
    if (body.v !== PROTOCOL_VERSION) return 'Unsupported payload version';
    if (!body.ephemeralPublicKey?.kty) return 'Missing ephemeral public key';
    if (!body.iv || typeof body.iv !== 'string') return 'Missing IV';
    if (!body.ciphertext || typeof body.ciphertext !== 'string') return 'Missing ciphertext';
    if (body.ciphertext.length > 65536) return 'Payload too large';
    return null;
}