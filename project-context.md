# Phare Registry — Project Context

**Version:** `2026.06-production.11` · **Live:** https://ahmadmalik77.github.io/phare-registry/

## What this is

Private UHNWI executive intake: 7-step wizard, client-side ECDH P-256 + AES-256-GCM, Cloudflare Worker blind storage (4h TTL).

## Access model (Option B — public intake)

- **Page:** Public on GitHub Pages (`noindex` for discretion).
- **Transmit:** Open — no `INVITE_TOKEN` on Worker. Optional invite can be re-enabled via `wrangler secret put INVITE_TOKEN`.
- **Copy:** “Encrypted · confidential channel” (not invitation-only).

## Canonical files (do not break)

| File | Role |
|------|------|
| `index.html` | Full wizard markup — must contain `<main class="frame">` |
| `assets/app.js` | Production JS — `deriveBits`, `importRegistryPublicKey`, no `workerBlobUrl`, no `window.PhareRegistry` |
| `assets/config.js` | Worker URLs + `PUBKEY_FINGERPRINT` (gitignored, force-add for Pages) |
| `cloudflare/worker.js` | Intake API |
| `lib/worker-http.mjs` | Shared CORS/security helpers (tested) |
| `operator/decrypt.html` | **Never** deploy to public Pages |

## Build rules

- `npm run build` is safe when `index.html` has full markup OR `archive/index.monolith.html` exists.
- `finalize-build` refuses to overwrite `index.html` without `<main class="frame">`.
- Do **not** put `INVITE_TOKEN` in `config.js` — it is public.

## Crypto

- Protocol: `phare-aes-gcm-ecdh-v2`
- Public key import: `[]` usages + `deriveBits`
- Honeypot: `#a7_hp_trap` / `b_hp_x7k9`

## Security headers

- GitHub Pages: CSP + referrer meta in `index.html`
- Cloudflare/Netlify: `deploy/_headers` (copied by `deploy-pages.ps1`)
- Custom domain: `deploy/cloudflare-csp.md`

## Deploy

```powershell
npm run ci
git add -f assets/config.js
git push origin main
cd cloudflare; wrangler deploy
```