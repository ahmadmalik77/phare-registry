# Phare Registry — Project Context

**Version:** `2026.06-production.10` · **Live:** https://ahmadmalik77.github.io/phare-registry/

## What this is

Private UHNWI executive intake: 7-step wizard, client-side ECDH P-256 + AES-256-GCM, Cloudflare Worker blind storage (4h TTL).

## Canonical files (do not break)

| File | Role |
|------|------|
| `index.html` | Full wizard markup — must contain `<main class="frame">` |
| `assets/app.js` | Production JS — `deriveBits`, `importRegistryPublicKey`, no `workerBlobUrl` |
| `assets/config.js` | Worker URLs + `PUBKEY_FINGERPRINT` (gitignored, force-add for Pages) |
| `cloudflare/worker.js` | Intake API |
| `operator/decrypt.html` | **Never** deploy to public Pages |

## Build rules

- `npm run build` is safe when `index.html` has full markup OR `archive/index.monolith.html` exists.
- `finalize-build` refuses to overwrite `index.html` without `<main class="frame">`.
- Do **not** put `INVITE_TOKEN` in `config.js` — it is public. Use `?invite=` URLs only.

## Invitation-only access

Worker requires `INVITE_TOKEN` secret. Share intake as:

`https://ahmadmalik77.github.io/phare-registry/?invite=YOUR_TOKEN`

## Crypto

- Protocol: `phare-aes-gcm-ecdh-v2`
- Public key import: `[]` usages + `deriveBits`
- Honeypot: `#a7_hp_trap` / `b_hp_x7k9`

## Deploy

```powershell
npm test && npm run validate
git add -f assets/config.js
git push origin main
cd cloudflare; wrangler deploy
```