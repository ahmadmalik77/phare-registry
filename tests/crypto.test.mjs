import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    encryptForRegistry,
    decryptFromRegistry,
    generateECDHKeyPair,
    fingerprintPublicJwk,
    validateEncryptedShape,
    PROTOCOL_VERSION
} from '../lib/phare-crypto.mjs';

test('ECDH encrypt/decrypt roundtrip', async () => {
    const kp = await generateECDHKeyPair();
    const privateJwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
    const publicJwk = await crypto.subtle.exportKey('jwk', kp.publicKey);

    const intake = {
        operational_visibility: 'corp',
        weight_concentration: 'fatigue',
        access_point: 'digital',
        pressure_source: 'leadership',
        relief_preference: 'clarity',
        start_preference: 'call',
        designation: 'Test Executive',
        contact: 'test@example.com',
        timestamp: new Date().toISOString(),
        registry: 'Phare — The Lighthouse • 2026'
    };

    const encrypted = await encryptForRegistry(intake, publicJwk);
    assert.equal(encrypted.v, PROTOCOL_VERSION);
    assert.equal(validateEncryptedShape(encrypted), null);

    const decrypted = await decryptFromRegistry(privateJwk, encrypted);
    assert.deepEqual(decrypted, intake);
});

test('fingerprint is stable for same public key', async () => {
    const kp = await generateECDHKeyPair();
    const publicJwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
    const a = await fingerprintPublicJwk(publicJwk);
    const b = await fingerprintPublicJwk(publicJwk);
    assert.equal(a, b);
    assert.match(a, /^[a-f0-9]{64}$/);
});

test('wrong private key fails decrypt', async () => {
    const kp1 = await generateECDHKeyPair();
    const kp2 = await generateECDHKeyPair();
    const pub1 = await crypto.subtle.exportKey('jwk', kp1.publicKey);
    const priv2 = await crypto.subtle.exportKey('jwk', kp2.privateKey);

    const encrypted = await encryptForRegistry({ designation: 'x' }, pub1);
    await assert.rejects(() => decryptFromRegistry(priv2, encrypted));
});

test('validateEncryptedShape rejects bad payloads', () => {
    assert.equal(validateEncryptedShape(null), 'Invalid payload');
    assert.equal(validateEncryptedShape({ v: 'wrong' }), 'Unsupported payload version');
    assert.equal(validateEncryptedShape({ v: PROTOCOL_VERSION }), 'Missing ephemeral public key');
    assert.equal(validateEncryptedShape({ v: PROTOCOL_VERSION, ephemeralPublicKey: {kty:'EC'}, iv: 'a', ciphertext: 'b'.repeat(100000) }), 'Payload too large');
});

test('large but valid payload shape passes', () => {
    const ok = { v: PROTOCOL_VERSION, ephemeralPublicKey: {kty:'EC'}, iv: 'iv', ciphertext: 'c'.repeat(1000) };
    assert.equal(validateEncryptedShape(ok), null);
});