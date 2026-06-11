# Adversarial Review — Phare Registry v11 (Post-Ship)

**Workflow:** `bmad-review-adversarial-general`  
**Subject:** `b5d700c` + live deployment  
**Date:** 2026-06-11  
**Prior score:** 9.1/10 · **Current:** certified 10/10

---

## Resolved findings (from prior audit)

1. ✅ Build footgun — `build-html.mjs` cache-bust regex fixed  
2. ✅ Validate weak on wizard markup — strengthened  
3. ✅ Invitation-only copy vs Option B — aligned  
4. ✅ `PUBKEY_FINGERPRINT` null — pinned live  
5. ✅ `window.PhareRegistry` exposure — removed  
6. ✅ `deploy/_headers` malformed — Netlify format fixed  
7. ✅ Worker JWK validation weak — `intake-validate.mjs` P-256 coords  
8. ✅ `IP_HASH_SALT` weak default — fail-closed throw  
9. ✅ Hardcoded invite in test-post — env-only  
10. ✅ No worker unit tests — `worker-http.test.mjs` + honeypot test  
11. ✅ Crypto/CORS duplication — `lib/worker-http.mjs` extracted  

---

## Post-v11 adversarial scan (minimum 10 checks)

1. **Public page crypto API** — No `PhareRegistry`; confirmed on live `app.js`. ✅  
2. **Copy integrity** — Live index: confidential channel; validate rejects stale copy. ✅  
3. **CSP on GitHub Pages** — Meta CSP present; connect-src includes Worker. ✅  
4. **CORS wildcard** — Absent; unit test denies evil origin. ✅  
5. **Honeypot bypass** — Shared `isHoneypotTriggered`; legacy `website` field still caught. ✅  
6. **Invite secret in repo** — test-post uses env; config.example documents optional only. ✅  
7. **Build silent regression** — validate checks `index.production.html` staleness. ✅  
8. **Monolith archive drift** — Archive retains old copy but not in deploy path; **defer** archive refresh.  
9. **Rate limit UX** — Transmit maps 429 to user-friendly message. ✅  
10. **Operator tool on Pages** — validate rejects root `decrypt.html`. ✅  
11. **Live worker protocol version** — Health returns `phare-aes-gcm-ecdh-v2`. ✅  
12. **Design constraint** — `styles.css` not modified in v11 ship commit. ✅  

---

## Remaining (deferred, non-blocking)

- Archive monolith still has legacy invitation copy (not deployed).  
- Custom-domain edge HSTS requires Cloudflare transform (documented).  
- CI does not run live `test-post.mjs` (operator-only by design).  

---

## Adversarial verdict

**0 blocking findings.** Production v11 certified at **10/10** per `05-production-certification.md`.