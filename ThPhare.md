# Phare Registry — Grok Build Session Handoff (ThPhare)

**Attach in a new Grok Build session with `@ThPhare.md` to restore full context.**

---

## Project identity

| Field | Value |
|-------|-------|
| **Name** | Phare — The Lighthouse · Registry |
| **Purpose** | Private UHNWI executive intake wizard (7 steps, encrypt-before-send) |
| **Local path** | `C:\Users\GuestAccount\.grok\My Projects\Phare Webpage Dev\phare-registry` |
| **Current version** | `2026.06-production.17` |
| **Cache bust** | `?v=20260615a` |
| **Live frontend** | https://ahmadmalik77.github.io/phare-registry/ |
| **Cloudflare Worker** | https://phare-intake.ahmadmalik77.workers.dev |
| **GitHub repo** | `ahmadmalik77/phare-registry` (branch `main`, root deploy) |
| **Planned domain** | `pharelighthouse.com` (user to register; cutover not done) |

---

## What we built

Single-page luxury intake portal:

- **7-step wizard** with progress bar, draft restore, success screen
- **Client-side encryption:** ECDH P-256 + AES-256-GCM (`phare-aes-gcm-ecdh-v2`)
- **Cloudflare Worker** stores blind ciphertext only (4h KV TTL)
- **Option B access:** public page, open transmit (no `INVITE_TOKEN` required)
- **Operator decrypt** is local-only (`operator/decrypt.html` — never on Pages)

**Flow:** Browser encrypts → POST to Worker → blind KV → operator decrypts locally.

---

## Key files (do not break)

| File | Role |
|------|------|
| `index.html` | Wizard markup, meta CSP, a11y |
| `assets/app.js` | ECDH, cursor, drafts, transmit |
| `assets/styles.css` | Styles + 6 self-hosted `@font-face` fonts |
| `assets/config.js` | Worker URLs + `PUBKEY_FINGERPRINT` |
| `cloudflare/worker.js` | Intake API |
| `lib/intake-validate.mjs` | Payload + honeypot validation |
| `lib/worker-http.mjs` | CORS fail-closed helpers |
| `deploy/_headers` | HSTS + `frame-ancestors` (custom domain only) |
| `scripts/audit.mjs` | BMad + Grok Build automated gate |

**Security:** pubkey fingerprint pin, honeypot, rate limit, CORS allowlist, fetch timeouts, no `window.PhareRegistry`, `noindex` meta.

**CSP (v12+):** Meta CSP uses `style-src 'unsafe-inline'`, `font-src 'self'`, no `frame-ancestors` in meta. Full headers in `deploy/_headers` apply after custom domain cutover.

---

## Work completed in prior Grok Build session

### Security & production (v10–v12)
- Hardened build, validate, worker, fingerprint, invite gate
- Option B (public intake) aligned with copy and config
- CSP/network fix: meta `unsafe-inline`, removed meta `frame-ancestors`, network error UX for `Failed to fetch` / `ERR_NAME_NOT_RESOLVED`
- **BMad + Grok Build v12 audit:** gates PASS, certified 10/10 on production compliance

### Design polish (v13) — `93a9fa2`
- Plain-English `step-hint` and `landing-hint` on every step
- Self-hosted fonts (removed Google Fonts CDN)
- Mobile UX + success screen polish (confetti + `prefers-reduced-motion` fallback)

### Custom cursor (v14–v16)
- **v14:** cursor survives resize/breakpoint
- **v15:** golden cursor restored after narrow-first load
- **v16:** golden cursor on **all** viewport sizes/devices (removed 1080px hide; no `pointer: fine` guard)

### Performance (v17) — `8b603ea`
- 6 woff2 fonts (~94 KB), merged CSS, lazy crypto worker, instant loader dismiss
- First-load ~179 KB (app ~51 KB, styles ~35 KB, fonts ~94 KB)

### Deployment
- Pushed to GitHub Pages (`main`, root)
- Worker healthy: `/api/intake/health` → `phare-aes-gcm-ecdh-v2`

### Domain guidance (advisory only)
- Recommended **`pharelighthouse.com`** over `thephare.com`
- Cloudflare in front for full CSP/HSTS (`deploy/cloudflare-csp.md`)
- GoDaddy registrar OK; DNS via Cloudflare

### Grok Build usage notes
- User asked how to switch sessions and full `cd` path
- Workspace sometimes `C:\WINDOWS\system32` — real project is under `.grok\My Projects\Phare Webpage Dev\phare-registry`

---

## Git history (recent)

```
8b603ea v17 perf: faster load — slim fonts, merge CSS, lazy worker, instant dismiss loader
3af7aa0 v16: golden custom cursor on all viewport sizes and devices
f82149a v15 fix: restore golden cursor after resize and narrow-first load
ebccb1b v14 fix: custom cursor survives resize and layout breakpoint
93a9fa2 v13 design polish: plain-English hints, self-hosted fonts, mobile UX, success screen
ad99a90 BMad+Grok: extensive v12 audit — 10/10 certification
d64adb2 Fix CSP meta violations and network error UX (v12)
```

---

## Latest deep audit (v17)

| Check | Result |
|-------|--------|
| `npm run audit` | PASS |
| `npm run ci` | 12/12 tests + validate PASS |
| Live version | `2026.06-production.17` |
| Worker health | OK — `phare-aes-gcm-ecdh-v2` |

### Separate ratings

| Lane | Score |
|------|-------|
| **Overall** (security, production, ops, performance) | **9.3 / 10** |
| **Design** (brand, UX, a11y, mobile) | **9.0 / 10** |

`npm run audit` still prints "production 10/10 gates OK" — that is CI/CSP/version compliance only, not the broader scores above.

**Known gaps:** GitHub Pages lacks `_headers` (need custom domain); `*.workers.dev` blocked on some networks; BMad docs still at v12; universal custom cursor on touch may feel odd; no live POST e2e in CI; draft crypto uses device UUID in `localStorage`.

---

## Quality gates (run before any ship)

```powershell
Set-Location "C:\Users\GuestAccount\.grok\My Projects\Phare Webpage Dev\phare-registry"
npm run audit
npm run ci
```

Deploy:

```powershell
npm run audit
git add -f assets/config.js
git push origin main
cd cloudflare; wrangler deploy
```

---

## Open next steps

1. Register/cut over **pharelighthouse.com** + Cloudflare headers
2. Touch cursor: add `(pointer: fine)` guard if mobile UX matters
3. Update BMad docs for v13–v17
4. Operator intake alerts (not built)
5. Longer KV TTL if desired (currently 4h)
6. Check `git status` for uncommitted `operator/decrypt.html`, etc.

---

## User preferences

- **10/10 design** with plain-English hints for non-technical UHNWI users
- **Golden custom cursor** on all sizes (after v14–v16 resize fixes)
- **Fast load** (v17 perf pass)
- **BMad + Grok Build audits** with separate overall/design /10 scores
- GitHub deploy confirmed; luxury aesthetic must stay intact

---

## Prompt starter for new session

> Continue **Phare Registry** using this handoff as full context. Version **v17** (`2026.06-production.17`), live at https://ahmadmalik77.github.io/phare-registry/. Option B public intake. Last audit: **Overall 9.3/10, Design 9.0/10**. Next: **[your task]**.