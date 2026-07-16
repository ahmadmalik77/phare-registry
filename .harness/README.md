# Harness CI/CD for Phare

This directory contains **Harness pipeline definitions as code** for the Phare registry.

- `.harness/pipelines/phare-ci-pipeline.yaml` — Main quality + gated deploy pipeline.
- Use with Harness platform (SaaS or Open Source) for visual editing, powerful orchestration, approvals, caching, notifications, and advanced CD.

## Why Harness for this project?

- Existing GitHub Actions (`.github/workflows/ci.yml`) covers basic quality.
- Harness adds:
  - Visual + YAML dual editing
  - Native approval gates
  - Better secret management + expression language
  - Harness Cloud runners (no self-hosted runner maintenance)
  - Easy extension to full Continuous Delivery, policy-as-code, notifications
  - Test Intelligence / caching (future)
  - Unified view if you adopt more Harness modules (CD, Feature Flags, STO, etc.)

The pipeline closely mirrors the current CI steps:
`prepare config` → `npm ci` → `build` → `test` → `validate` → `audit`

## Quick Start (5–10 minutes)

### 1. Prerequisites
- A free Harness account: https://app.harness.io (or Harness Open Source self-hosted)
- GitHub repo access (your `phare-registry`)
- Cloudflare API token with appropriate scopes (for Worker deploys; Pages is currently GitHub Pages)

### 2. Connect your repository
1. In Harness, go to **Project Settings** → **Connectors** → **Code Repositories**.
2. Create a **GitHub** connector (use Personal Access Token or GitHub App).
   - Name it something like `github_phare` (the identifier you will reference).
3. Verify connection.

### 3. Add secrets (highly recommended)
Project (or Org) scope secrets:

| Secret Name                  | Purpose                              | Notes |
|-----------------------------|--------------------------------------|-------|
| `CLOUDFLARE_API_TOKEN`      | wrangler auth for Worker deploy     | Required for CD stage |
| `CLOUDFLARE_ACCOUNT_ID`     | (optional) explicit account         | Only if wrangler.toml doesn't suffice |
| Others as needed            | INVITE_TOKEN, etc. (inject at build time) | Never log secrets |

Create via UI: **Project Settings → Secrets → + New Secret**.

### 4. Import / create the pipeline
**Option A — Git Experience (recommended, pipeline-as-code)**
1. In Harness: **Pipelines** → **+ Create a Pipeline**.
2. Give it a name.
3. Select **Remote** (stores definition in Git).
4. Select your GitHub connector + repo + branch.
5. Set **File path**: `.harness/pipelines/phare-ci-pipeline.yaml`
6. Save. Harness will load the YAML you committed.

**Option B — Inline / paste**
1. Create pipeline → **Inline**.
2. Switch to **YAML** tab.
3. Paste the contents of `phare-ci-pipeline.yaml`.
4. Save (Harness injects `orgIdentifier` / `projectIdentifier`).

### 5. Configure codebase on the pipeline/stage
- After import, edit the stage → **Codebase** tab (or in YAML: `properties.ci.codebase`).
- Point at the GitHub connector you created.
- Set default branch `main`.

### 6. Run it
- Click **Run**.
- Choose branch or PR.
- For the Deploy stage you will usually set the runtime input `deployWorker=false` on first runs (it is guarded).
- Watch live logs on Harness Cloud runner.

### 7. (Optional) Add automatic triggers
In the pipeline:
- **Triggers** tab → **+ New Trigger** → GitHub.
- On: Push to main + Pull requests.
- Or commit a trigger definition YAML under `.harness/triggers/`.

## Deploying

### Worker (Cloudflare)
The "Deploy" stage contains a guarded step that runs:
```bash
cd cloudflare && wrangler deploy
```
It reads `CLOUDFLARE_API_TOKEN` from Harness secrets.

- Set the runtime input `deployWorker=true` when you intentionally want to deploy.
- Or promote the deploy stage behind the approval gate only for release branches.

**Pre-requisite**: Your `cloudflare/wrangler.toml` must already have the correct KV namespace ID and be committed.

### GitHub Pages
Current flow builds `dist-pages/` (via `scripts/deploy-pages.ps1` or the linux fallback in the pipeline).

To fully automate Pages from Harness you have two good paths:
1. Keep using GitHub Pages "deploy from branch" + add a Harness step that force-pushes `dist-pages` to a `gh-pages` branch (requires a Git write token + git config in a Run step).
2. Migrate the frontend hosting to Cloudflare Pages and use `wrangler pages deploy dist-pages --project-name=phare-registry`.

Both are easy extensions.

## Coexistence with GitHub Actions

You can keep both:
- GitHub Actions runs fast basic checks on every PR (free, immediate GitHub status).
- Harness is the authoritative richer pipeline for releases, manual approvals, and future CD.

Update the GitHub workflow or add a status check from Harness if desired.

## Customization ideas

- Add Node caching:
  ```yaml
  # In stage spec
  caching:
    enabled: true
  ```
  or explicit Cache steps.

- Matrix builds (Node 18 + 20).

- Notifications (Slack, email, PagerDuty) on failure.

- Add a "Security" stage using Harness STO.

- Turn the Deploy stage into a real Harness CD stage with Service + Environment definitions.

- Policy sets (OPA/Governance) to require approvals on main.

## Troubleshooting

- **config.js error**: The pipeline always writes a test config first. In real deploys override it in the "prepare_deploy_config" step.
- **wrangler auth fails**: Confirm secret exists, has `Edit:Cloudflare Workers` scope (or equivalent), and is referenced exactly as `CLOUDFLARE_API_TOKEN`.
- **Audit step "fails"**: It is set to `Ignore` so version drift doesn't block. Fix root cause in source or `package.json` version.
- **Windows scripts**: Harness Cloud = Linux. The pipeline uses bash + node fallbacks. Keep ps1 for local dev.

## Resources

- Pipeline YAML reference: https://developer.harness.io/docs/platform/pipelines/harness-yaml-quickstart
- Harness Cloud infrastructure: https://developer.harness.io/docs/continuous-integration/use-ci/set-up-build-infrastructure/use-harness-cloud-build-infrastructure
- Wrangler + CI: https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/
- Project README for manual deploy steps.

---

**Phare Harness integration added June 2026**. Extend as your delivery process matures.