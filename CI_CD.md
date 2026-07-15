# CI/CD

## What's automated today

- `.github/workflows/ci.yml` runs on every push to `main` and on pull requests:
  `backend-tests` (pytest against a real Postgres service container),
  `frontend-build` (`npm run build`), and `ci-status` (reports whether both
  passed; exit-codes the whole run).
- `main` is branch-protected to require the `ci-status` check before a PR can
  merge. Direct pushes to `main` are still allowed (this repo's normal
  workflow) and are not blocked by branch protection.
- Render and Vercel are both configured to auto-deploy on every push to
  `main`, independent of whether CI passes. **This is the gap**: a CI run can
  fail and production still deploys.

## Making Render/Vercel actually wait on CI

`ci-status`'s last step already has the deploy-trigger logic — it's inert
until two repo secrets exist:

1. **Render**: dashboard → the Haylingua service → Settings → **Deploy Hook**
   → copy the URL. Then Settings → **Auto-Deploy** → turn it **off** (so pushes
   alone no longer trigger a deploy; only the hook does).
2. **Vercel**: project → Settings → Git → **Deploy Hooks** → create one for
   the `main` branch → copy the URL. Then Settings → Git → disable
   auto-deploy on push for `main` (or restrict it so only the hook triggers
   production deploys).
3. Add both URLs as GitHub Actions repo secrets:
   `gh secret set RENDER_DEPLOY_HOOK_URL` and
   `gh secret set VERCEL_DEPLOY_HOOK_URL` (paste the value when prompted), or
   via GitHub → Settings → Secrets and variables → Actions.

Once both secrets exist, the next push to `main` that passes `ci-status`
will fire both hooks automatically; a failing run won't. No further workflow
changes needed — the code path is already there and guarded to no-op if the
secrets are absent.

## Branch protection

Configured via `gh api repos/h3l10w0r1d/Haylinguav2/branches/main/protection`:
required status check `ci-status`, no required PR reviews, direct pushes and
force-pushes/deletions still governed by normal repo permissions (force-push
and delete are disabled). Deliberately does **not** require PRs — this repo's
workflow is direct pushes to `main`, and this protection only guards the PR
merge path for when one is opened.
