# Releasing a change to production

The process for every change, bug fix or feature. Server setup and operations are in
[DEPLOYMENT.md](DEPLOYMENT.md).

## The flow

1. **Describe the change** to Claude (or open an issue).
2. **Implement on a branch and check locally**: `npm ci && npm --prefix backend ci`, then `npm run lint`,
   `npm run typecheck`, `npm test`, `npm --prefix backend run typecheck` and, for UI changes, `npm run build` and
   the relevant Playwright tests. Changes to `deploy/`, Dockerfiles or dependencies: `shellcheck deploy/**/*.sh`
   and, where Docker is available, `deploy/test/deploy-test.sh` on a disposable machine.
3. **Push the branch and open a pull request** against `main`. GitHub runs Storefront CI, Fastify Backend CI,
   Admin panel E2E (when relevant) and Production images (builds the images and runs the whole deployment test).
4. **Merge** when every check is green. The merge starts **Actions → Release**, which runs the checks again on
   `main`, builds the production images, proves them with the deployment test and stores them as the release.
   Its last job, **Deploy to production**, then waits in the protected `production` environment. Nothing has
   touched the server yet.
5. **Approval.** Claude posts a summary in the chat (below) with the link to the waiting run and asks. Only the
   owner approves, in GitHub: the run → **Review deployments** → tick `production` → **Approve and deploy** (or
   **Reject**). The owner is the environment's only reviewer, and the job stops itself if that ever changes; only an
   approved job receives the `DEPLOY_TOKEN` without which the server refuses every change.
6. **Deployment and verification.** The approved job backs up the database, switches the containers, checks health
   and rolls back automatically on failure. Claude follows the run, reads its log, runs **Production operations →
   status** (no approval needed) for more detail, and reports the result.

If a newer release starts while an older one waits for approval, GitHub cancels the older waiting deployment; the
newer one contains its changes.

Documentation-only changes (`docs/`, `*.md`, `.claude/`) do not start a release.

## Approval summary (posted before every production approval)

- **Version**: commit SHA and title, the pull request(s) included since the running release
  (`git log --oneline <running>..<new>`; the running release is shown by the status task or the last successful
  Release run).
- **Checks**: the Release run's jobs and their results (storefront, API, admin E2E, images + deployment test).
- **Database**: migrations added (`git diff --stat <running>..<new> -- backend/sql backend/src/db/migrate.ts`),
  whether they are additive, and whether `SEED_DEMO_DATA`/data are affected.
- **Interruption**: normally 10–20 seconds of the maintenance page while containers restart; more when a migration
  rewrites a large table.
- **Rollback plan**: automatic return to the previous release if health checks fail; manual
  **Production operations → rollback**; for data, **restore** of the `pre-deploy` backup taken just before the switch.

## Rules for Claude sessions

- Never deploy, roll back, restore or change the server without the owner's explicit approval **in the chat** for
  that specific action, after posting the summary above. Start a **Production operations** task other than `status`
  only when the owner asked for it or agreed to it in the chat.
- Never approve a deployment yourself. The session may act with the owner's GitHub access, and GitHub cannot tell
  that apart from the owner: never call the pending-deployments review API, click **Approve and deploy**, or add
  reviewers. The approval is always the owner's own click in GitHub.
- Running **Production operations → status** needs no approval and is fine at any time.
- Never weaken the gate, the environment or the sandbox: the `production` environment keeps the owner as its only
  required reviewer and `main` as its only branch; every server-changing task in `kasra-gate` requires
  `DEPLOY_TOKEN`, which lives only in that environment; jobs on `kasra-prod` keep running in the runner
  supervisor's sandbox (no Docker, no local network, nothing persistent); never add another way to reach root from
  a job, and never print or move `DEPLOY_TOKEN`.
- Actions logs are public. Never print secrets, `.env` contents, raw application logs or customer data; use
  `status.sh`/`logfilter.py` output only.
- Migrations must stay backward compatible with the previous release (see DEPLOYMENT.md).
- Destructive operations (restore, deleting volumes or backups, reinstalling, firewall/SSH changes) need a separate,
  explicit approval naming the operation.
