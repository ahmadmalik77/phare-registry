# Phare Registry — Brownfield Project Documentation

**Generated:** 2026-06-11 · **Workflow:** `bmad-document-project` (initial scan, adapted)  
**Project:** `phare-registry` · **Type:** Static confidential intake + Cloudflare Worker API

---

## 1. Project classification

| Attribute | Value |
|-----------|--------|
| Domain | Private UHNWI executive intake registry |
| Pattern | JAMstack + edge API + client-side E2E encryption |
| Host (public) | GitHub Pages — `ahmadmalik77.github.io/phare-registry` |
| Host (API) | Cloudflare Worker — `phare-intake.ahmadmalik77.workers.dev` |
| Storage | Cloudflare KV — opaque ciphertext, 4h TTL |
| Operator tooling | `operator/decrypt.html` (local only, never on Pages) |

---

## 2. Directory map (canonical)

```
phare-registry/
├── index.html                 # Public wizard shell (286 lines on main; DO NOT npm build blindly)
├── assets/
│   ├── app.js                 # Wizard, ECDH transmit, a11y, custom cursor
│   ├── styles.css             # Luxury UI
│   ├── config.js              # Gitignored — Worker URLs + optional pin/invite
│   ├── config.example.js
│   └── draft-crypto-worker.js # Local draft PBKDF2/AES worker
├── cloudflare/
│   ├── worker.js              # Intake API (pubkey, POST, health)
│   └── wrangler.toml
├── operator/decrypt.html      # Operator decrypt + batch export
├── lib/phare-crypto.mjs       # Shared crypto for tests/CLI
├── tests/crypto.test.mjs
├── PROTOCOL.md                # Crypto + data-flow contract
├── SECURITY.md                # Threat model + operator duties
├── README.md                  # Deploy runbook
├── archive/index.monolith.html # Historical single-file source
└── scripts/                   # build, deploy, validate, setup
```

---

## 3. Runtime data flow

1. User completes 7-step wizard in browser.
2. Client fetches registry **public ECDH JWK** from Worker (`GET /api/intake/pubkey`).
3. Client generates **ephemeral** ECDH keypair, derives AES-256-GCM key via `deriveBits`.
4. Intake JSON encrypted client-side → `phare-aes-gcm-ecdh-v2` envelope.
5. `POST /api/intake` with ciphertext + empty honeypot `b_hp_x7k9`.
6. Worker stores opaque record in KV `intake:{uuid}` (4h TTL). No plaintext, no IP in record.
7. Operator decrypts via `operator/decrypt.html` + `REGISTRY_PRIVATE_JWK`.

---

## 4. Key configuration surfaces

| Surface | Purpose |
|---------|---------|
| `assets/config.js` | `API_URL`, `PUBKEY_URL`, optional `PUBKEY_FINGERPRINT`, `INVITE_TOKEN` |
| Wrangler secrets | `REGISTRY_PRIVATE_JWK`, `ALLOWED_ORIGINS`, `IP_HASH_SALT`, optional `INVITE_TOKEN` |
| `cloudflare/wrangler.toml` | KV binding, worker name |

**Live config (2026-06-11):** fingerprint and invite **disabled** (`null`).

---

## 5. Build & deploy commands

| Command | Purpose |
|---------|---------|
| `npm run setup` | Interactive `config.js` |
| `npm run test` | Crypto unit tests |
| `npm run validate` | Structure checks (weak on DOM) |
| `npm run build` | **⚠️ FOOTGUN** — can strip `index.html` body if run on modular tree |
| `scripts/deploy-worker.ps1` | Wrangler deploy |
| `scripts/deploy-pages.ps1` | Build `dist-pages/` (excludes operator/) |

---

## 6. AI agent rules (project-context summary)

- **Never** deploy `operator/` to public Pages.
- **Never** commit `REGISTRY_PRIVATE_JWK` or Cloudflare tokens.
- **Canonical live frontend** is committed `index.html` + `assets/*` on `main` — not `index.production.html` alone.
- **Do not run `npm run build` and commit** without fixing `build-html.mjs` to source from `archive/index.monolith.html`.
- ECDH public key import must use `[]` usages + `deriveBits` (not `deriveKey` on public JWK).
- Honeypot field: `#a7_hp_trap` / `b_hp_x7k9` — not `website`.
- Custom cursor: keep `.cur-dot`/`.cur-ring` visible below 1080px on `(pointer: fine)`.

---

## 7. Related artifacts

- `docs/bmad/02-investigation-case.md`
- `docs/bmad/03-implementation-readiness.md`
- `docs/bmad/04-adversarial-review.md`