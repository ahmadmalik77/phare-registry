import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCors, timingSafeEqual } from '../lib/worker-http.mjs';

function mockRequest(origin) {
    return {
        headers: {
            get(name) {
                return name === 'Origin' ? origin : null;
            }
        }
    };
}

test('buildCors allows listed origin only', () => {
    const env = { ALLOWED_ORIGINS: 'https://ahmadmalik77.github.io,https://intake.example.com' };
    const allowed = buildCors(mockRequest('https://ahmadmalik77.github.io'), env);
    assert.equal(allowed['Access-Control-Allow-Origin'], 'https://ahmadmalik77.github.io');

    const denied = buildCors(mockRequest('https://evil.example'), env);
    assert.equal(denied['Access-Control-Allow-Origin'], undefined);
});

test('buildCors fail-closed when allowlist empty', () => {
    const cors = buildCors(mockRequest('https://ahmadmalik77.github.io'), { ALLOWED_ORIGINS: '' });
    assert.equal(cors['Access-Control-Allow-Origin'], undefined);
});

test('timingSafeEqual compares invite tokens safely', () => {
    assert.equal(timingSafeEqual('secret-token', 'secret-token'), true);
    assert.equal(timingSafeEqual('secret-token', 'secret-tokex'), false);
    assert.equal(timingSafeEqual('a', 'aa'), false);
    assert.equal(timingSafeEqual(null, 'x'), false);
});