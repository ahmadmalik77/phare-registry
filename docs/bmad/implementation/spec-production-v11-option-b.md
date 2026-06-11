---
status: done
baseline_commit: ae195e2
shipped_commit: b5d700c
version: 2026.06-production.11
workflow: bmad-quick-dev
date: 2026-06-11
access_model: option-b-public-intake
design_constraint: no-aesthetic-changes
context:
  - project-context.md
  - PROTOCOL.md
  - SECURITY.md
  - README.md
---

# Spec: Production v11 — Option B World-Class Polish

## Intent

Harden phare-registry to **10/10 production** while **keeping design/aesthetics unchanged**. Stick with **Option B** (public intake, no invite required). Fix all audit gaps: copy alignment, security headers, public API leak, build footgun, test coverage, worker helper dedup.

## Acceptance Criteria (Given / When / Then)

| ID | Given | When | Then |
|----|-------|------|------|
| AC1 | User opens bare GitHub Pages URL | They complete wizard and transmit | POST succeeds without `X-Phare-Invite` (202 or 429 rate limit only) |
| AC2 | Live `index.html` | Page loads | Copy says "Encrypted · confidential channel"; no "invitation only" |
| AC3 | `assets/app.js` production build | DevTools inspects globals | No `window.PhareRegistry`; no public `crypto` export |
| AC4 | `npm run ci` | Tests run | 12/12 pass; `validate.mjs` passes |
| AC5 | `npm run build` | index has cache-busted `config.js?v=` | `index.production.html` matches modular body (no monolith fallback) |
| AC6 | Worker deployed | GET `/api/intake/health` | `ok: true`, `v: phare-aes-gcm-ecdh-v2` |
| AC7 | `deploy/_headers` | Netlify/Cloudflare Pages deploy | Valid path syntax + CSP (no erroneous `*/` closers) |
| AC8 | `index.html` head | GitHub Pages serves page | CSP meta + referrer policy present |
| AC9 | `scripts/test-post.mjs` | Operator runs smoke test | No hardcoded secrets; uses `PHARE_*` env |
| AC10 | CORS allowlist configured | Wrong Origin POSTs | 403 Origin not allowed (tested via `worker-http.test.mjs`) |

## Tasks (completed)

- [x] T1 — Update copy/meta for Option B (`index.html`)
- [x] T2 — Remove `window.PhareRegistry` + crypto export (`assets/app.js`)
- [x] T3 — Extract `lib/worker-http.mjs`; refactor `cloudflare/worker.js`
- [x] T4 — Add `isHoneypotTriggered` to `lib/intake-validate.mjs`
- [x] T5 — Add `tests/worker-http.test.mjs` + honeypot test
- [x] T6 — Fix `build-html.mjs` cache-bust regex
- [x] T7 — Fix `deploy/_headers` Netlify format
- [x] T8 — Strengthen `validate.mjs` guards
- [x] T9 — Sanitize `test-post.mjs` secrets
- [x] T10 — Improve transmit error messages (403/429/503)
- [x] T11 — Update README, project-context, SECURITY to v11
- [x] T12 — Bump version `2026.06-production.11`; cache bust `?v=20260611h`
- [x] T13 — `npm run ci` ×3; `wrangler deploy`; `git push main`

## Spec Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-06-11 | Option B as default access model | User chose public intake after testing Option A |
| 2026-06-11 | build-html regex accepts `config.js?v=` | Prevent silent monolith fallback with stale copy |

## Code Map

| Area | Files |
|------|-------|
| Public UI | `index.html`, `assets/app.js`, `assets/styles.css` (unchanged aesthetics) |
| Worker API | `cloudflare/worker.js`, `lib/worker-http.mjs`, `lib/intake-validate.mjs` |
| Tests | `tests/*.test.mjs` (12 tests) |
| Build | `scripts/build-html.mjs`, `scripts/validate.mjs`, `scripts/build-app.mjs` |
| Deploy | `deploy/_headers`, `deploy/cloudflare-csp.md` |

## Verification Evidence

```
npm run ci → 12/12 pass, validate OK (×3)
Live index.html → v20260611h, CSP meta, confidential copy
Live app.js → production.11, no PhareRegistry
Worker health → ok:true v:phare-aes-gcm-ecdh-v2
Git → b5d700c on main
```