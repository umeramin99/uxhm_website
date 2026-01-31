# Cloudflare deploy safety (prod vs preview)

## Problem
If Cloudflare is configured to build/deploy non-production branches, a preview deployment can accidentally overwrite production if the deploy command always targets the same worker name.

## Goal
- Production (main branch) deploys to worker: **uxhmwebsite** (custom domain **uxhm.co.uk**)
- Non-production branches deploy to worker: **uxhmwebsite-preview** (no custom domain)

## How
This repo includes `scripts/cf-deploy.mjs` and a `package.json` script:

```bash
npm run deploy
```

The deploy script checks the branch from common CI env vars (e.g. `CF_PAGES_BRANCH`, `GITHUB_REF_NAME`, `BRANCH`).

- If branch is `main` (or `FORCE_DEPLOY=1`), it deploys **uxhmwebsite**.
- Otherwise, it deploys **uxhmwebsite-preview**.

## Cloudflare dashboard settings
In the Cloudflare build config:
- Build command: `npm run build`
- Deploy command: `npm run deploy`

In Workers, ensure the **custom domain** is attached only to the production worker (**uxhmwebsite**).

## Notes
If the Cloudflare build environment doesn’t expose a branch name, you can set it explicitly in the dashboard, or set `FORCE_DEPLOY=1` for production-only environments.
