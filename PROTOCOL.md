# Phare — The Lighthouse: Encryption Protocol (v2)

This document explains exactly how the public intake page and the operator decrypt tool work. All cryptography happens in the browser using the Web Crypto API.

## High-Level Flow (Zero-Retention, End-to-End Encrypted)

1. **Operator (registry holder)** generates a long-lived ECDH P-256 keypair once:
   - Private key (`d` component) is stored as a Cloudflare Worker secret (`REGISTRY_PRIVATE_JWK`).
   - Public key (x/y) is served by the Worker at `GET /api/intake/pubkey`.

2. **Public webpage (index.html)** — when the user clicks Transmit:
   - Loads deploy config from `assets/config.js` (Worker URLs, optional fingerprint + invite token).
   - Fetches the registry's current public key (optional SHA-256 fingerprint verification).
   - Sends optional `X-Phare-Invite` header when invite token is configured or `?invite=` was used.
   - Generates a fresh ephemeral ECDH P-256 keypair (never stored).
   - Derives a shared AES-256-GCM key using ECDH (ephemeral private + registry public).
   - Encrypts the structured intake object (the 7 choices + designation + contact + timestamp) with a random 12-byte IV.
   - Sends only `{ v: "phare-aes-gcm-ecdh-v2", ephemeralPublicKey (JWK), iv (base64), ciphertext (base64) }` + the honeypot field over HTTPS to the Worker.

3. **Cloudflare Worker**:
   - Rejects requests from origins not listed in `ALLOWED_ORIGINS` (fail-closed).
   - Rejects if optional `INVITE_TOKEN` is set but `X-Phare-Invite` does not match.
   - Rejects if the honeypot (`website`) field has content.
   - Validates payload shape, version, and base64 encoding; enforces body size limits.
   - Enforces per-IP rate limiting (5 per hour via salted IP hash in KV).
   - Stores opaque encrypted record under `intake:uuid` with 4-hour TTL (no IP in record).
   - Never sees plaintext, never derives keys, never logs sensitive fields.

4. **Operator decryption** (using `operator/decrypt.html` or equivalent offline script):
   - Paste the private JWK + the stored record (or just the crypto fields).
   - Import private key.
   - Import the client's `ephemeralPublicKey` from the record.
   - Derive the identical AES-256-GCM key.
   - Decrypt with the provided IV.
   - The original intake object is recovered locally.

## Why This Design?

- The server (Worker + KV) provides only transport + short-term blind storage + anti-abuse (honeypot + rate limit).
- Only the holder of the private key can ever read an intake.
- Ephemeral keys mean each submission is independent; compromise of one does not affect others.
- 4-hour TTL + "zero-retention" policy means data disappears automatically even if the private key is later lost.
- Everything critical is standard Web Crypto primitives (ECDH P-256 → AES-GCM). No custom crypto.

## Threat Model (High Level)

- **Protected against**: Passive network observers, the Cloudflare Worker/KV operator (by design), casual local inspection of the browser (for the transmitted payload).
- **Not protected against** (by design or out of scope): A compromised browser during the session, the operator's private key being stolen after the fact (standard key hygiene applies), sophisticated targeted malware on the submitter's machine, legal compulsion of the operator after data has been decrypted by them.
- The public page never sends the data in plaintext.

## Version

Current payload/protocol version: `phare-aes-gcm-ecdh-v2`

See also the comments and source in `index.html` (the `encryptForRegistry` / `deriveSharedAESKey` functions) and `decrypt.html` (the inverse `decryptOne` / `deriveAESKey`).

This pattern can be re-implemented in other languages for server-side or CLI operator tools as long as the exact derive + AES-GCM parameters are matched.

For questions or responsible disclosure, contact the registry operator through the channels listed in the main page.
