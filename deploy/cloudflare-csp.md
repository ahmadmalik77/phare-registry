# Cloudflare Transform Rule — CSP for GitHub Pages

When proxying GitHub Pages through Cloudflare, add a **Response Header Transform Rule**:

**If:** Hostname equals your intake domain (e.g. `intake.phare.lighthouse`)

**Then set:**
```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://YOUR-WORKER.workers.dev; frame-ancestors 'none'; base-uri 'self'; form-action 'none'
```

Replace `YOUR-WORKER` with your deployed Worker subdomain.

**Notes:**
- `frame-ancestors` only works in HTTP headers (not `<meta>` CSP on GitHub Pages).
- `'unsafe-inline'` in `style-src` is required for the luxury JS UI (custom cursor, animations) without a full redesign.

Also enable **Always Use HTTPS** and **HSTS** in SSL/TLS settings.