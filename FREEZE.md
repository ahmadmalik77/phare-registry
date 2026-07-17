# Production freeze — Phare Registry

**Status:** LOCKED for now (no feature / design churn unless critical bug)  
**Date:** 2026-07-17  
**Git:** `fee0733` · tag `v24-production-freeze`  
**Version:** `2026.06-production.24`

## Live

| Piece | URL / value |
|--------|-------------|
| Site | https://ahmadmalik77.github.io/phare-registry/ |
| App | `assets/app-24.js` |
| Styles | `assets/styles-24.css` |
| Worker | https://phare-intake.ahmadmalik77.workers.dev |
| Protocol | `phare-aes-gcm-ecdh-v2` |

## Ratings at freeze

| Lane | Score |
|------|-------|
| Overall | **9.5 / 10** |
| Design | **9.4 / 10** |
| Security / crypto | **9.5 / 10** |
| Gates (`npm run audit`) | **PASS** |

## Do not change without cause

- Luxury visual system (colors, type, layout, desktop gold cursor)
- ECDH encrypt-before-send path
- Public Pages + Worker Option B intake model

## Allowed without “unfreezing”

- Critical security / transmit breakages
- Operator deploy of Worker secrets / domain cutover
- Docs-only notes

## Optional later (parked)

- Custom domain (`pharelighthouse.com`)
- BMad cert refresh for v18–v24
- Fine-pointer cursor already done; further mobile nits only if needed
- Operator decrypt offline fonts

## Smoke check after any emergency fix

```powershell
cd "C:\Users\GuestAccount\.grok\My Projects\Phare Webpage Dev\phare-registry"
npm run audit
# Browser: hard-refresh, confirm app-24.js (or newer), Transmit once
```
