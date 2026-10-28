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
   Nothing has touched the server yet.
5. **Approval.** Claude posts a summary in the chat (below) and asks. The owner approves by sending the current
   6-digit code of the authenticator app. Without that code the server refuses every change: GitHub's own approval
   button is not available for private repositories on this plan, and the code also stops anyone who only has
   GitHub access (including Claude).
6. **Deployment and verification.** Claude starts **Actions → Deploy** with the release and the code right away
   (a code works once, for ten minutes). The job backs up the database, switches the containers, checks health and
   rolls back automatically on failure. Claude reads the job log, runs **Production operations → status** (no code
   needed) for more detail, and reports the result. The owner can also start Deploy in GitHub with the code.

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
  that specific action. The owner's approval is the 6-digit code they send; use each code only for the action it
  was given for, right away, and never ask for codes in advance or store them.
- Running **Production operations → status** needs no code and is fine at any time; tell the owner when you start
  anything else.
- Never weaken the gate or the sandbox: every server-changing task in `kasra-gate` must require the approval code;
  jobs on `kasra-prod` must keep running in the runner supervisor's sandbox (no Docker, no local network, nothing
  persistent); never add another way to reach root from a job.
- Actions logs are public. Never print secrets, `.env` contents, raw application logs or customer data; use
  `status.sh`/`logfilter.py` output only.
- Migrations must stay backward compatible with the previous release (see DEPLOYMENT.md).
- Destructive operations (restore, deleting volumes or backups, reinstalling, firewall/SSH changes) need a separate,
  explicit approval naming the operation.
