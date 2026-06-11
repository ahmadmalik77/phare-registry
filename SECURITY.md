# Phare Security Notes

## Scope

Production private intake: browser encrypts structured data before transmission. Cloudflare Worker + KV stores opaque ciphertext only (4-hour TTL).

## Key Security Properties

- Sensitive data encrypted in-browser (ECDH P-256 → AES-256-GCM) before leaving the device.
- Worker never sees plaintext; stores only `v`, `ephemeralPublicKey`, `iv`, `ciphertext`.
- Client IPs are **hashed** (salted SHA-256) for rate limiting only — not stored in intake records.
- CORS is **fail-closed**: `ALLOWED_ORIGINS` must be set; empty config rejects cross-origin requests.
- Optional **invite token** (`INVITE_TOKEN` secret + `X-Phare-Invite` header / `?invite=` URL param).
- Optional **pubkey fingerprint** pinning in `assets/config.js` detects MITM on pubkey fetch.
- Decryption authority rests solely with `REGISTRY_PRIVATE_JWK` holder.

## Operator Requirements

- Generate ECDH keypair in a trusted session; store private JWK as Worker secret only.
- Set `IP_HASH_SALT` to a unique random string per deployment.
- Set `ALLOWED_ORIGINS` to exact HTTPS origins (no wildcards).
- Use `operator/decrypt.html` locally in a private window — **never** host on public Pages.
- Deploy strict CSP via Cloudflare transform rules (`deploy/cloudflare-csp.md`).

## What This Is Not

- Not resistant to compromised client at submission time.
- Not a substitute for private-key operational security.
- Rate limiting uses KV (best-effort); pair with Cloudflare WAF for high-abuse scenarios.

## Reporting

Contact the registry operator through the secure channel on the intake page. Do not open public issues for vulnerabilities.

## Version

`2026.06-production.11` — see `PROTOCOL.md`, `project-context.md`, and `PHARE_VERSION` in source files.