# Phare — The Lighthouse (Production)

Private, confidential executive intake for UHNWIs.  
Client-side ECDH P-256 + AES-256-GCM encryption. Zero-retention Cloudflare Worker backend.

```
phare-registry/
├── index.html                 ← Public intake (GitHub Pages)
├── assets/
│   ├── styles.css             ← Luxury UI (unchanged palette/layout)
│   ├── app.js                 ← Wizard + crypto + a11y
│   ├── draft-crypto-worker.js ← Local draft encryption worker
│   ├── config.example.js      ← Copy to config.js before deploy
│   └── config.js              ← Gitignored — your live Worker URLs
├── operator/
│   └── decrypt.html           ← Operator-only (never deploy to public Pages)
├── cloudflare/
│   ├── worker.js              ← Hardened intake API
│   └── wrangler.toml
├── lib/phare-crypto.mjs       ← Shared crypto (tests + fingerprint tool)
├── tests/crypto.test.mjs      ← Automated roundtrip tests
├── deploy/                    ← CSP + headers templates
└── scripts/                   ← Build, deploy, setup helpers
```

---

## Quick deploy (live)

### 1. Cloudflare Worker

```powershell
cd cloudflare
npm i -g wrangler
wrangler login
wrangler kv namespace create PHARE_KV
```

Paste the KV `id` into `cloudflare/wrangler.toml`.

Generate registry keypair (browser DevTools on any HTTPS page):

```js
const kp = await crypto.subtle.generateKey(
  { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
);
console.log('PRIVATE:', await crypto.subtle.exportKey('jwk', kp.privateKey));
console.log('PUBLIC:', await crypto.subtle.exportKey('jwk', kp.publicKey));
```

> Browser intake uses `deriveBits` for ECDH — do **not** use `deriveKey` on imported public keys.

Set secrets (required):

```bash
wrangler secret put REGISTRY_PRIVATE_JWK
wrangler secret put ALLOWED_ORIGINS      # e.g. https://youruser.github.io,https://intake.phare.com
wrangler secret put IP_HASH_SALT         # random 32+ char string
```

Optional invitation-only gate:

```bash
wrangler secret put INVITE_TOKEN         # share ?invite=TOKEN links (never put token in config.js)
```

Deploy:

```powershell
..\scripts\deploy-worker.ps1
```

### 2. Frontend config

```powershell
npm run setup
```

Or copy `assets/config.example.js` → `assets/config.js` and fill Worker URLs.

Optional pubkey pinning:

```powershell
npm run fingerprint
# Paste PUBLIC JWK → add hash to PUBKEY_FINGERPRINT in config.js
```

Default (Option B): public intake — no invite required.  
Optional (Option A): `https://your-site/?invite=YOUR_TOKEN` (stored in session; sent as `X-Phare-Invite`).

### 3. Build & publish

```powershell
npm run build
npm run ci                    # tests + structure validation
.\scripts\deploy-pages.ps1    # creates dist-pages/ (no operator tools)
```

Push `dist-pages/` contents to GitHub Pages (root), or push full repo with Pages source **main / root**.

Re-deploy Worker with `ALLOWED_ORIGINS` including your exact Pages origin.

### 4. Hardening (recommended)

- Put Cloudflare in front of custom domain → see `deploy/cloudflare-csp.md`
- Copy `deploy/_headers` if using Netlify/Cloudflare Pages
- Keep `operator/decrypt.html` **local only** — never on public host

---

## Operator decrypt

1. Copy `operator/decrypt.html` to a private machine.
2. Open in incognito (`file://` is fine).
3. Paste `REGISTRY_PRIVATE_JWK` + KV `intake:*` record JSON.
4. Wipe and close tab when done.

Built-in sample roundtrip: **Generate Sample Keypair + Test Roundtrip**.

---

## Verification checklist

- [ ] `npm run ci` passes locally
- [ ] Worker `/api/intake/health` returns 200
- [ ] `ALLOWED_ORIGINS` set (CORS fail-closed without it)
- [ ] `assets/config.js` has real Worker URLs (no `YOUR_SUBDOMAIN`)
- [ ] Full wizard → Transmit → KV `intake:*` with 4h TTL, no plaintext
- [ ] Honeypot filled → 400
- [ ] 6th submission/IP/hour → 429
- [ ] `operator/decrypt.html` decrypts real record
- [ ] Invite token enforced (only if Option A configured)
- [ ] Pubkey fingerprint matches (if configured)

---

## Development

| Command | Purpose |
|---------|---------|
| `npm run build` | Rebuild `index.html` + `assets/app.js` from source |
| `npm test` | Crypto roundtrip tests |
| `npm run validate` | Production structure checks |
| `npm run setup` | Interactive `config.js` creation |

Monolith backup: `archive/index.monolith.html`

---

**Phare — The Lighthouse** · NovaWorks Studio Registry · 2026