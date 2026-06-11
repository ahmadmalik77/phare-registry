# Investigation — CSP Console Errors + Transmit Failed to Fetch

**Workflow:** `bmad-investigate`  
**Date:** 2026-06-11  
**Fix version:** `2026.06-production.12`  
**Status:** Closed

---

## Symptoms

1. `frame-ancestors` ignored when delivered via `<meta>`
2. Inline `style="margin-top:0"` blocked by `style-src`
3. `ERR_NAME_NOT_RESOLVED` on `phare-intake.ahmadmalik77.workers.dev`
4. `[Phare transmit] TypeError: Failed to fetch`

---

## Root causes (confirmed)

| ID | Grade | Finding |
|----|-------|---------|
| R1 | **Confirmed** | Browsers ignore `frame-ancestors` in `<meta http-equiv="Content-Security-Policy">` — HTTP header only (MDN) |
| R2 | **Confirmed** | Meta CSP had strict `style-src` without `'unsafe-inline'` — blocks HTML `style=""` and JS `element.style` (cursor, confetti) |
| R3 | **Confirmed** | `index.html:269,280` used inline `style="margin-top:0"` on dialog CTAs |
| R4 | **Confirmed** | `ERR_NAME_NOT_RESOLVED` = DNS/network cannot resolve `*.workers.dev` (user network); not a CSP block |
| R5 | **Deduced** | CSP violations did not cause fetch failure; separate network/DNS issue |

---

## Fixes shipped (v12)

1. Removed `frame-ancestors` from meta CSP; kept in `deploy/_headers` for Cloudflare/Netlify.
2. Added `'unsafe-inline'` to meta `style-src` (required for luxury JS UI without redesign).
3. Moved dialog button spacing to `.restore-actions .cta { margin-top: 0; }` in `styles.css`.
4. Added `isNetworkFetchFailure()` + user-facing DNS/network message in transmit path.
5. `validate.mjs` guards against regressions.

---

## Operator note (DNS)

If `ERR_NAME_NOT_RESOLVED` persists on a network, proxy GitHub Pages + Worker through a custom Cloudflare domain (`deploy/cloudflare-csp.md`) and update `assets/config.js` URLs.