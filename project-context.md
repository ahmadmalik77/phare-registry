# Phare Registry — Project Context

**Version:** `2026.06-production.12` · **Live:** https://ahmadmalik77.github.io/phare-registry/

## What this is

Private UHNWI executive intake: 7-step wizard, client-side ECDH P-256 + AES-256-GCM, Cloudflare Worker blind storage (4h TTL).

## Access model (Option B — public intake)

- **Page:** Public on GitHub Pages (`noindex` for discretion).
- **Transmit:** Open — no `INVITE_TOKEN` on Worker. Optional invite via `wrangler secret put INVITE_TOKEN`.
- **Copy:** “Encrypted · confidential channel”

## Canonical files (do not break)

| File | Role |
|------|------|
| `index.html` | Full wizard — `<main class="frame">`, meta CSP (no `frame-ancestors`) |
| `assets/app.js` | `deriveBits`, no `PhareRegistry`, network error UX |
| `assets/styles.css` | `.restore-actions .cta` — no inline dialog styles |
| `assets/config.js` | Worker URLs + `PUBKEY_FINGERPRINT` |
| `cloudflare/worker.js` | Intake API |
| `lib/worker-http.mjs` | CORS/security helpers (tested) |
| `operator/decrypt.html` | **Never** on public Pages |

## CSP rules (v12)

- **Meta CSP (GitHub Pages):** `style-src` includes `'unsafe-inline'`; **no** `frame-ancestors`.
- **HTTP headers:** `deploy/_headers` includes `frame-ancestors 'none'` + aligned CSP.
- **DNS:** `ERR_NAME_NOT_RESOLVED` on `*.workers.dev` is a network issue — try another connection or custom domain.

## Quality gates

```powershell
npm run audit    # CI + version/CSP sync (BMad + Grok Builder)
npm run ci       # tests + validate
```

## Deploy

```powershell
npm run audit
git add -f assets/config.js
git push origin main
cd cloudflare; wrangler deploy
```