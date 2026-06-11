# Adversarial Review — Phare Registry (Post-Audit)

**Workflow:** `bmad-review-adversarial-general`  
**Subject:** Full directory + live deployment posture  
**Date:** 2026-06-11

---

## Findings (minimum 10)

1. `npm run build` can silently delete the entire wizard from `index.html` because `build-html.mjs` slices line 990–1251 from an already-modular 26-line file.

2. CI runs that broken build on every push and still reports green — false confidence that would fool any reviewer skimming Actions.

3. `validate.mjs` never checks for `<main class="frame">`, so the most important user-facing artifact can be empty while validation passes.

4. Local workspace currently diverges from production: stripped `index.html`, regressed `app.js` with `workerBlobUrl` ReferenceError on page unload.

5. README documents ECDH key generation with `deriveKey` while the production browser path requires `deriveBits` — an operator following README could build incompatible tooling.

6. Product copy says "By invitation only" but `INVITE_TOKEN` is null in live `config.js` and likely unset on Worker — that's obscurity, not access control.

7. `PUBKEY_FINGERPRINT` is null, so a compromised or misconfigured pubkey endpoint has no client-side detection despite the code supporting it.

8. Crypto logic is triplicated across `lib/phare-crypto.mjs`, `assets/app.js`, and `operator/decrypt.html` — drift is inevitable; one fix will not fix all three.

9. `deploy/_headers` contains an unclosed block comment, so security headers and CSP guidance may never apply as intended.

10. Worker `validatePayload` only checks `ephemeralPublicKey?.kty`, not P-256 curve or coordinate presence — malformed JWKs could reach KV.

11. `IP_HASH_SALT` falls back to a hardcoded default string if the secret is missing — rate-limit hashes become predictable across misconfigured deployments.

12. `window.PhareRegistry` exposes `crypto.encryptForRegistry` on the public page — unnecessary attack surface and debugging leakage for a luxury confidential product.

13. GitHub Pages provides no HSTS/CSP enforcement; security depends entirely on optional Cloudflare transforms that are documented but not evidenced as deployed.

14. `cloudflare/node_modules` exists in the workspace tree — risk of accidental commit, repo bloat, and supply-chain noise if `.gitignore` is incomplete.

15. No automated test proves the Worker rejects honeypot-filled POSTs, rate-limits, or denies wrong origins — every control is faith-based until manually probed.