import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    validateIntakePayload,
    isValidEphemeralPublicJwk,
    PROTOCOL_VERSION
} from '../lib/intake-validate.mjs';

test('valid ephemeral JWK requires P-256 coordinates', () => {
    assert.equal(isValidEphemeralPublicJwk({ kty: 'EC', crv: 'P-256', x: 'abc', y: 'def' }), true);
    assert.equal(isValidEphemeralPublicJwk({ kty: 'EC', crv: 'P-1', x: 'a', y: 'b' }), false);
    assert.equal(isValidEphemeralPublicJwk({ kty: 'RSA' }), false);
});

test('validateIntakePayload rejects bad version and keys', () => {
    assert.equal(validateIntakePayload(null), 'Invalid payload');
    assert.equal(validateIntakePayload({ v: 'wrong' }), 'Unsupported payload version');
    assert.equal(
        validateIntakePayload({ v: PROTOCOL_VERSION, ephemeralPublicKey: { kty: 'EC' }, iv: 'aa==', ciphertext: 'bb==' }),
        'Invalid ephemeral public key'
    );
});

test('validateIntakePayload accepts well-formed envelope', () => {
    const ok = {
        v: PROTOCOL_VERSION,
        ephemeralPublicKey: { kty: 'EC', crv: 'P-256', x: 'abc', y: 'def' },
        iv: 'c3RhYmxlaXY=',
        ciphertext: 'c2VjcmV0'.padEnd(8, '=')
    };
    assert.equal(validateIntakePayload(ok), null);
});