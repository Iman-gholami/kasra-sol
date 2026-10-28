
## Plugins
The `superpowers` and `frontend-design` plugins are enabled for this project (see `.claude/settings.json`). Use them only when the prompt explicitly asks for them.

## Production releases
Production runs on a ParsPack VPS with Docker Compose, deployed by GitHub Actions. Read `docs/RELEASING.md`
before changing anything that ships, and `docs/DEPLOYMENT.md` for the server.
- Work on a branch, run the checks in `docs/RELEASING.md`, open a pull request; a merge to `main` starts the
  Release workflow, which stops at the protected `production` environment until the owner approves it in GitHub.
- Never deploy, roll back, restore or change the server without the owner's explicit approval in the chat, and
  never approve a GitHub deployment review yourself. Before asking, post the approval summary from `docs/RELEASING.md`.
- The server (Iran) accepts no connections from abroad: production jobs run on its own runner (`kasra-prod`) and act
  only through `sudo kasra-gate` with the `DEPLOY_TOKEN` secret. Never weaken that (see `docs/RELEASING.md`).
- Actions logs are public: never print secrets, `/opt/kasra/.env`, raw app logs or customer data.
- Migrations must keep the previous release working (rollbacks do not undo them).
