# Investigation Case: phare-registry-production-posture

**Status:** Concluded  
**Confidence:** Medium–High  
**Workflow:** `bmad-investigate`  
**Date:** 2026-06-11

---

## Hand-off Brief (15-second read)

Phare Registry **works in production** (transmit, cursor, copy payload confirmed by operator). The highest-risk defect is **not crypto** — it is the **`npm run build` pipeline destroying `index.html` markup** when run on the modular tree, plus **optional access controls documented but disabled live**. Fix build sourcing and enable fingerprint/invite to align promise with deployment.

---

## Case Info

| Field | Value |
|-------|--------|
| Slug | `phare-registry-production-posture` |
| Scope | Full directory audit + live deployment alignment |
| Stronghold | GitHub `main` commit `6d87f4a` — full `index.html` + `app.js` v `.5` |
| Contradicted premise | "Build/CI guarantees safe releases" — **Refuted** |

---

## Problem Statement

Brownfield audit requested after live fixes (ECDH, honeypot, cursor). Determine production readiness, rate /10, identify systemic risks beyond symptomatic bugs.

---

## Evidence Inventory

| ID | Source | Grade | Notes |
|----|--------|-------|-------|
| E1 | `git show HEAD:index.html` | **Confirmed** | Full `<main class="frame">` wizard on `main` |
| E2 | Local `index.html` (26 lines) | **Confirmed** | Body stripped — uncommitted workspace damage |
| E3 | `scripts/build-html.mjs:8-9` | **Confirmed** | `lines.slice(990, 1251)` on current `index.html` → empty body |
| E4 | `.github/workflows/ci.yml:31-32` | **Confirmed** | CI runs `npm run build` every push |
| E5 | `scripts/validate.mjs` | **Confirmed** | No assertion for `<main class="frame">` |
| E6 | Live `assets/app.js` on GitHub | **Confirmed** | `PHARE_VERSION = '2026.06-production.5'`, `deriveBits`, no `workerBlobUrl` |
| E7 | Local `assets/app.js` | **Confirmed** | Stale build: `workerBlobUrl` at line 1145, version `.production` |
| E8 | `assets/config.js` | **Confirmed** | `PUBKEY_FINGERPRINT: null`, `INVITE_TOKEN: null` |
| E9 | `assets/styles.css:944-946` (pre-fix) | **Confirmed** | Was hiding cursor below 1080px — fixed in `6d87f4a` |
| E10 | User confirmation | **Confirmed** | Transmit + cursor OK on live after cache-bust deploy |

---

## Hypotheses

| # | Hypothesis | Status | Resolution |
|---|------------|--------|------------|
| H1 | Live site still serves broken ECDH `deriveKey` import | **Refuted** | E6 — fixed on `main`, cache-bust deployed |
| H2 | `npm run build` can break public HTML | **Confirmed** | E2, E3, E4 chain |
| H3 | "Invitation-only" enforced in production | **Refuted** | E8 — invite token null |
| H4 | CI prevents shipping broken pages | **Refuted** | E4, E5 — build runs, DOM not validated, no commit-back |
| H5 | Local workspace matches production | **Refuted** | E1 vs E2, E6 vs E7 |

---

## Confirmed Findings

1. **Production GitHub `main` is healthy** for end users (E1, E6, E10).
2. **Build pipeline is a release landmine** for anyone running `npm run build` locally and committing (E3).
3. **Security optionalities off** — no pubkey pin, no invite gate (E8).
4. **`deploy/_headers` malformed** — CSP/HSTS template may not apply (unclosed comment block).

---

## Deduced Conclusions

- Prior **8.0/10** rating reflects **deployed behavior**, not **repo maintainability**.
- BMad party-mode consensus: **6.5–7.2/10** when weighting ops, gates, and promise alignment.
- Root cause class for past "Transmission failed" / cursor bugs: **stale CDN + wrong crypto usages + CSS breakpoint** — all addressed on `main`, not structural redesign.

---

## Timeline

| When | Event |
|------|-------|
| Early session | Live Pages served old `app.js` (`deriveKey`, `a7_website` honeypot) |
| `5473cef` | ECDH + honeypot + cache-bust |
| `c1e32a6` | Cursor resize JS fix |
| `6d87f4a` | CSS 1080px cursor kill fix |
| 2026-06-11 | User confirmed live OK |

---

## Fix Direction

| Priority | Action | Skill |
|----------|--------|-------|
| P0 | Fix `build-html.mjs` to read body from `archive/index.monolith.html` | `bmad-quick-dev` |
| P0 | Add validate rule: `index.html` must contain `<main class="frame">` | `bmad-quick-dev` |
| P1 | Enable `PUBKEY_FINGERPRINT` + `INVITE_TOKEN` in prod | Operator |
| P1 | Remove `workerBlobUrl` from `build-app.mjs` output permanently | `bmad-quick-dev` |
| P2 | Miniflare worker tests | `bmad-testarch-framework` |

---

## Reproduction Plan (build footgun)

```powershell
cd phare-registry
git checkout main -- index.html   # ensure full HTML
npm run build
# Observe index.html body gone (if build-html unchanged)
```

**Verification:** `Select-String -Path index.html -Pattern 'main class="frame"'` → should match.

---

## Recommended Next BMad Action

**`bmad-quick-dev`** — P0 build + validate hardening (single story, highest leverage).