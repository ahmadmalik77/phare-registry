# Phare Registry — Brownfield Project Documentation

**Generated:** 2026-06-11 (v11 refresh) · **Workflow:** `bmad-document-project`  
**Project:** `phare-registry` · **Version:** `2026.06-production.11`  
**Type:** Static confidential intake + Cloudflare Worker API

---

## 1. Project classification

| Attribute | Value |
|-----------|--------|
| Domain | Private UHNWI executive intake registry |
| Pattern | JAMstack + edge API + client-side E2E encryption |
| Host (public) | GitHub Pages — `ahmadmalik77.github.io/phare-registry` |
| Host (API) | Cloudflare Worker — `phare-intake.ahmadmalik77.workers.dev` |
| Storage | Cloudflare KV — opaque ciphertext, 4h TTL |
| Access model | **Option B** — public intake (optional invite via Worker secret) |
| Operator tooling | `operator/decrypt.html` (local only) |

---

## 2. Directory map (canonical)

```
phare-registry/
├── index.html                 # Public wizard (286 lines; cache ?v=20260611h)
├── assets/
│   ├── app.js                 # Wizard, ECDH, a11y — NO window.PhareRegistry
│   ├── styles.css             # Luxury UI (aesthetics frozen)
│   ├── config.js              # Worker URLs + PUBKEY_FINGERPRINT
│   └── draft-crypto-worker.js # Local draft encryption
├── cloudflare/worker.js       # Intake API (imports lib/*)
├── lib/
│   ├── phare-crypto.mjs       # Node/test crypto
│   ├── intake-validate.mjs    # Payload + honeypot validation
│   └── worker-http.mjs        # CORS, security headers, JSON helper
├── tests/                     # 12 automated tests
├── deploy/_headers            # Netlify/Cloudflare Pages security headers
├── operator/decrypt.html      # Never on public Pages
├── docs/bmad/                 # BMad workflow artifacts
└── scripts/                   # build, validate, deploy, smoke
```

---

## 3. Runtime data flow

1. User completes 7-step wizard.
2. Client fetches registry public ECDH JWK (`GET /api/intake/pubkey`).
3. Optional fingerprint pin in `config.js` detects MITM.
4. Client encrypts intake JSON (ECDH P-256 → AES-256-GCM v2).
5. Client POSTs opaque envelope to Worker (no invite required — Option B).
6. Worker stores ciphertext in KV (4h TTL); operator decrypts locally.

---

## 4. Configuration surface

| File / Secret | Purpose |
|---------------|---------|
| `assets/config.js` | `API_URL`, `PUBKEY_URL`, `PUBKEY_FINGERPRINT` |
| `REGISTRY_PRIVATE_JWK` | Worker secret — decrypt authority |
| `ALLOWED_ORIGINS` | CORS allowlist (fail-closed) |
| `IP_HASH_SALT` | Rate-limit IP hashing (required) |
| `INVITE_TOKEN` | Optional — re-enable Option A |

---

## 5. Build & quality gates

| Command | Purpose |
|---------|---------|
| `npm run ci` | 12 tests + structure validate |
| `npm run build` | Safe rebuild (guarded finalize) |
| `scripts/test-post.mjs` | Operator live smoke (env vars only) |

---

## 6. BMad artifact index

| File | Workflow |
|------|----------|
| `01-project-documentation.md` | document-project |
| `02-investigation-case.md` | investigate |
| `03-implementation-readiness.md` | check-implementation-readiness |
| `04-adversarial-review.md` | review-adversarial-general |
| `05-production-certification.md` | quick-dev certification |
| `06-code-review-triage.md` | code-review |
| `implementation/spec-production-v11-option-b.md` | quick-dev spec |