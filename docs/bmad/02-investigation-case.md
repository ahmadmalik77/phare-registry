# Investigation Case — Build Footgun + Option B Alignment

**Workflow:** `bmad-investigate`  
**Case ID:** production-v11-build-footgun  
**Date:** 2026-06-11  
**Status:** Closed — root cause confirmed, fix shipped `b5d700c`

---

## Premise (user hypothesis)

"Production polish applied but `index.production.html` still showed 'By invitation only' after build."

---

## Evidence ledger

| ID | Grade | Finding |
|----|-------|---------|
| E1 | **Confirmed** | `index.html:55` contains `Encrypted · confidential channel` |
| E2 | **Confirmed** | `index.production.html:56` contained `By invitation only` after first build |
| E3 | **Confirmed** | `build-html.mjs:8` regex required exact `assets/config.js` without query string |
| E4 | **Confirmed** | `index.html:285` uses `assets/config.js?v=20260611h` |
| E5 | **Deduced** | Regex failed → `extractBodyFromModular` returned `''` → fallback to `archive/index.monolith.html` lines 990–1251 |
| E6 | **Confirmed** | After regex fix, `index.production.html` matches modular floor copy |
| E7 | **Confirmed** | Live Pages serves v11: CSP meta, cache `20260611h`, no `PhareRegistry` |

---

## Root cause

**Confirmed:** `build-html.mjs` body extractor did not match cache-busted script URLs, silently falling back to stale monolith archive.

---

## Resolution

1. Updated regex: `assets\/config\.js[^"]*`
2. Added `validate.mjs` check for stale `index.production.html`
3. Shipped in `b5d700c`

---

## Hypothesis log

| Hypothesis | Status | Resolution |
|------------|--------|------------|
| H1: index.html not saved before build | Refuted | E1 — source file correct |
| H2: finalize-build overwrote with stale file | Refuted | finalize kept modular index |
| H3: monolith fallback due to regex | **Confirmed** | E3–E5 |

---

## Operator actions

None required. Hard-refresh browser once (`Ctrl+Shift+R`) if cached v10 assets persist locally.