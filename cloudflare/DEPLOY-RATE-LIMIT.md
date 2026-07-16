# Deploy Worker (fixes rate-limit lockout)

Your browser IP is blocked until the **live** Worker is updated (or ~1 hour passes, or you change network).

## One-time deploy (PowerShell)

```powershell
cd "C:\Users\GuestAccount\.grok\My Projects\Phare Webpage Dev\phare-registry\cloudflare"
npx wrangler login
npx wrangler deploy
```

After deploy:

- Limit becomes **100 successful submits / IP / hour**
- **Failed** attempts no longer count toward the limit
- Your old rate-limit counter expires within ~1 hour either way

## Optional: clear rate keys early

In Cloudflare Dashboard → Workers → KV → your `PHARE_KV` namespace → delete keys starting with `rate:`  
(or wait for TTL).
