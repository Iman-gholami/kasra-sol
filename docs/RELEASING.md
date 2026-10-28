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
   `main`, builds the production images, proves them with the deployment test and publishes them as the release
   bundle. Its last job, **Deploy to production**, then **waits for approval** — nothing has touched the server yet.
5. **Approval.** Claude posts a summary in the chat (below) and asks; the owner approves in GitHub:
   Actions → the Release run → **Review deployments** → tick `production` → **Approve and deploy**
   (or **Reject**). GitHub also sends an e-mail/notification with a link.
6. **Deployment and verification.** The job backs up the database, switches the containers, checks health and
   rolls back automatically on failure. Claude reads the job log, runs **Production operations → status** if more
   detail is needed (another approval), and reports the result.

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
  that specific action, and never approve a GitHub deployment review on the owner's behalf. The GitHub approval is
  the owner's click; the chat approval comes first.
- Do not trigger the Release workflow or any Production operations task without telling the owner what it will
  do; every such run waits for the owner's approval in GitHub anyway.
- Never weaken the gate: keep `environment: production` and the `production-gate` action on every job that uses the
  production secrets, and keep those secrets environment-scoped (not repository secrets).
- Actions logs are public. Never print secrets, `.env` contents, raw application logs or customer data; use
  `status.sh`/`logfilter.py` output only.
- Migrations must stay backward compatible with the previous release (see DEPLOYMENT.md).
- Destructive operations (restore, deleting volumes or backups, reinstalling, firewall/SSH changes) need a separate,
  explicit approval naming the operation.
