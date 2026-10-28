
## Plugins
The `superpowers` and `frontend-design` plugins are enabled for this project (see `.claude/settings.json`). Use them only when the prompt explicitly asks for them.

## Production releases
Production runs on a ParsPack VPS with Docker Compose, deployed by GitHub Actions. Read `docs/RELEASING.md`
before changing anything that ships, and `docs/DEPLOYMENT.md` for the server.
- Work on a branch, run the checks in `docs/RELEASING.md`, open a pull request; a merge to `main` starts the
  Release workflow, which builds and tests, then waits for the owner's approval before deploying.
- Never deploy, roll back, restore or change the server without the owner's explicit approval in the chat. Before
  asking, post the approval summary from `docs/RELEASING.md`. The owner then approves the waiting job in GitHub
  (**Review deployments**, `production` environment, owner is the only reviewer). Never approve it yourself.
- The server (Iran) accepts no connections from abroad: production jobs run on sandboxed one-job runners on the
  server (`kasra-prod`) and reach root only through `kasra-gate`, which demands `DEPLOY_TOKEN` (a secret of the
  `production` environment). Never weaken that.
- Actions logs are public: never print secrets, `/opt/kasra/.env`, raw app logs or customer data.
- Migrations must keep the previous release working (rollbacks do not undo them).
