# Production deployment — ParsPack VPS

How Kasra runs in production, how a change gets there, and how to operate it. The day-to-day release
procedure (for people and for Claude sessions) is in [RELEASING.md](RELEASING.md).

## Architecture

```text
Visitor ──HTTPS──▶ Nginx on the VPS (TLS, maintenance page)
                     └─▶ 127.0.0.1:3000  Next.js storefront container (read-only, non-root)
                            └─▶ backend:4000  Fastify API container (non-root; runs migrations on start)
                                   ├─▶ postgres:5432  PostgreSQL 17   volume kasra_postgres_data
                                   └─▶ redis:6379     Redis 7 cache   (no persistence)
                                   uploads ─▶ volume kasra_media_data
```

Only Nginx listens publicly (80/443). The API listens on `127.0.0.1:4000` for health checks; PostgreSQL and
Redis are reachable only on the private Docker network and both require passwords.

The server is in an Iranian data center that **accepts no connections from abroad** (verified: GitHub's
runners time out on port 22 although no firewall exists on the server or in the ParsPack panel), while its
outgoing connections to GitHub work. Deployment therefore runs the other way round: the server fetches
production jobs from GitHub and runs each in a throwaway sandbox. The repository is **private**, and GitHub's
"required reviewers" for environments are not available for private repositories below GitHub Enterprise, so
the approval is enforced on the server: the owner's **one-time code from an authenticator app**.

```text
GitHub (abroad)                          ParsPack server (Iran)
  Deploy / Production operations  ◀─ polls ─ kasra-runner (root supervisor): one just-in-time runner per job,
  run (release + approval code)               each in a sandbox (dynamic user, no Docker, no local network)
                                                └─ /run/kasra-gate.sock ─▶ kasra-gate (root): checks the owner's
                                                     6-digit code, then deploy.sh / provision.sh / backup.sh …
```

```text
pull request ──▶ Storefront CI · Fastify Backend CI · Admin panel E2E · Production images (deploy test)
merge to main ──▶ Release: the same checks ─▶ images built and proven ─▶ "ready to deploy"
owner sends code ─▶ Deploy (release, code) ─▶ gate checks code ─▶ backup, switch, verify ─▶ (failure: rollback)
```

### Decisions

| Decision | Why |
| --- | --- |
| **Docker Compose on the single VPS** | The repository already ships hardened Dockerfiles and Compose; one 8 vCPU / 16 GB server fits the expected load. No paid services, no orchestrator. |
| **Images are built in GitHub Actions, never on the server** | The server needs no access to Docker Hub or npm (refused or filtered from Iran). The exact images that passed the tests are what gets deployed, and server CPU is not spent on builds. The images (~90 MB per release) and, when the server lacks them, the pinned PostgreSQL/Redis images travel as workflow artifacts. |
| **One-job runners in a sandbox** | GitHub cannot connect in, so `kasra-runner` (root, [`runner-supervisor.sh`](../deploy/server/runner-supervisor.sh)) registers a just-in-time runner for one job at a time and runs it as a throwaway `systemd-run` unit: dynamic user, its own copy of the root-owned runner, read-only system, no access to `/root`, `/home`, `/opt/kasra`, `/etc/kasra`, backups or Docker, and no connections to localhost, private or Docker networks. Nothing survives a job, so a job that was not approved cannot prepare a trap for the next one. This needs a fine-grained GitHub token on the server (step 2). |
| **Approval = the owner's one-time code** | [`kasra-gate`](../deploy/server/kasra-gate) is the only way from a job to root. Every task except the read-only `status` needs the current 6-digit code of the owner's authenticator app (TOTP); a code works once, for at most ten minutes, and five wrong codes block the gate for 15 minutes. Nobody with access to the GitHub repository (including Claude, which acts with the owner's GitHub access) can change the server without the owner's phone. |
| **Application secrets are generated on the server** | `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `ORDER_TOKEN_SECRET` and `ADMIN_API_KEY` are created by `provision.sh` in `/opt/kasra/.env` (root-only, mode 600). The authenticator secret and the GitHub token are in `/etc/kasra` (root-only). None of them is in GitHub or in the repository. |
| **Logs are sanitized** | Actions logs are visible to everyone with access to the repository. Scripts print no secrets, approval codes are masked, and `logfilter.py` removes IP addresses, phone numbers, long digit runs and query strings from application logs. |

## What is on the server

| Path | Content |
| --- | --- |
| `/opt/kasra/.env` | Secrets and settings, plus `KASRA_RELEASE` (running commit) and `KASRA_PREVIOUS_RELEASE`. Keep a copy of this file in a password manager. |
| `/opt/kasra/compose.yaml` | The running release's [`deploy/compose.production.yaml`](../deploy/compose.production.yaml). |
| `/opt/kasra/releases/<commit>/` | Compose file of the last five releases (their images are kept too) for rollback. |
| `/opt/kasra/bin/` | [`deploy/server/*.sh`](../deploy/server) from the latest release: `status.sh`, `backup.sh`, `rollback.sh`, `restore.sh`… |
| `/opt/kasra/deploy-history.log` | One line per deployment, rollback, restore and owner creation. |
| `/var/backups/kasra/` | Database dumps and media archives (see [Backups](#backups-and-restore)). |
| `/etc/nginx/sites-available/kasra` | Nginx site (IP or domain variant), shared settings in `/etc/nginx/snippets/kasra-proxy.conf`. |
| `/opt/actions-runner/` | Root-owned copy of the GitHub Actions runner; every job runs its own copy of it. |
| `/usr/local/sbin/kasra-runner-supervisor`, `kasra-runner.service` | The supervisor (one sandboxed job at a time); `journalctl -u kasra-runner` shows its runners. |
| `/usr/local/sbin/kasra-gate`, `kasra-gate.socket` | The gate on `/run/kasra-gate.sock`; `journalctl -u 'kasra-gate@*'` shows its errors. |
| `/etc/kasra/` | `totp.secret` (authenticator secret), `github-token` (runner registration), approval bookkeeping. Root only. |

Useful commands as root on the server: `cd /opt/kasra && docker compose ps`, `docker compose logs -f --tail 100 backend`,
`/opt/kasra/bin/status.sh`, `cat /opt/kasra/deploy-history.log`.

## One-time setup

Only the repository owner can do these steps (they involve GitHub settings, the server's root password and
the authenticator app). None of them requires pasting a password or token into a chat.

### 1. Repository variable

**Settings → Secrets and variables → Actions → Variables → New repository variable**:
`PRODUCTION_SITE_URL` = `https://SERVER_IP` now, `https://your-domain` later. It is baked into the storefront
build (canonical URLs, admin login origin).

### 2. A GitHub token for the server

GitHub → your profile picture → **Settings → Developer settings → Personal access tokens → Fine-grained tokens →
Generate new token**:

- **Token name** `kasra-server`, **Expiration** 1 year (put a reminder in your calendar), **Repository access**
  → **Only select repositories** → `kasra-sol`.
- **Repository permissions**: **Administration → Read and write** (to register one runner per job) and
  **Contents → Read-only** (to download the installer). Nothing else.
- **Generate token** and keep the page open: the token is shown once and is needed in step 3.

### 3. Install the deployment side on the server

Log in to the server as root (`ssh root@SERVER_IP`) and run these three commands. The first asks for the token
from step 2 (hidden input); the third installs everything, shows a QR code and asks for one code from the app.

```bash
read -rsp 'GitHub token: ' KASRA_GITHUB_TOKEN; echo; export KASRA_GITHUB_TOKEN
```

```bash
mkdir -p /root/kasra-sol && curl -fsSL -H "Authorization: Bearer $KASRA_GITHUB_TOKEN" https://api.github.com/repos/Iman-gholami/kasra-sol/tarball/main | tar -xz --strip-components=1 -C /root/kasra-sol
```

```bash
bash /root/kasra-sol/deploy/server/install-runner.sh
```

It checks that the server reaches GitHub, installs the runner (download verified against its published SHA-256),
the gate and the supervisor, shows a **QR code: scan it with an authenticator app** (Google Authenticator,
Microsoft Authenticator…) and type the code the app shows, stores the token root-only, and starts the
supervisor. **Settings → Actions → Runners** then lists a runner `kasra-prod-…` as *Idle*. Re-running is safe;
`--token` replaces an expired token, `--rotate-totp` sets up a new phone.

### 4. Provision the server (Actions → Production operations)

**Actions → Production operations → Run workflow** (branch `main`), task **provision**, `approval_code` = the
app's current code (or send the code to Claude, who starts the run). Options:

- `demo_data`: `true` loads the 36 demo products into an empty database (see [Removing the demo
  catalog](#removing-the-demo-catalog-before-launch)), `false` starts with an empty catalog.
- `harden`: enables the UFW firewall (only the SSH port, 80 and 443 stay open) and fail2ban for SSH.

`provision.sh` first prints the read-only `inspect.sh` report and stops without changing anything if the OS is
not Ubuntu 22.04/24.04/26.04 or Debian 12, if ports 80/443 belong to another web server, or if less than 10 GB is free.
Then it installs Docker (from Ubuntu's own repository when possible, so it works where `download.docker.com` is
refused), Nginx, unattended security upgrades, log rotation and the nightly backup timer, creates
`/opt/kasra/.env` with new random secrets, a self-signed certificate for the IP address, and the Nginx site.
It is idempotent and never overwrites `.env`, data or an enabled domain site.

### 5. First release, then the owner account

Merging to `main` builds and tests a release; **Deploy** installs it with an approval code (see
[RELEASING.md](RELEASING.md)). After the first deployment, create the back-office owner on the server as root;
the password is typed only there and never stored in GitHub:

```bash
read -rsp 'New owner password (12+ characters): ' p; echo; printf '%s' "$p" | /opt/kasra/bin/create-owner.sh kasra; unset p
```

Then sign in at `https://SERVER_IP/admin/login`.

## Temporary access by IP address

Until the domain is ready the site is served at **`https://SERVER_IP`**; `http://` redirects there.

- The certificate is **self-signed**, so browsers show a warning that you must accept once. The connection is still
  encrypted. To be sure you are talking to your server, compare the certificate's SHA-256 fingerprint in the
  browser with the one printed at the end of the provision log.
- HTTPS is required anyway: the admin login refuses to set its session cookie over plain HTTP.
- Anyone who finds the address can open the storefront. Search engines are told not to index it (`robots.txt`
  disallows everything and pages carry `noindex`). Do not share the address with customers; real customers need the
  domain with a trusted certificate.
- The admin is protected by its accounts, lockout after failed logins and rate limits. Use a long unique password.

## Connecting the domain and enabling HTTPS

1. At your DNS provider create an `A` record for the domain (and `www` if wanted) pointing to the server's IP.
   Wait until `nslookup your-domain` shows that address.
2. **Production operations** → task **enable-domain**, `target` = the domain, optional `extra` = an e-mail for
   Let's Encrypt expiry notices, tick `www` if you created that record, plus an approval code. It checks DNS, obtains a
   Let's Encrypt certificate (renewed automatically by certbot's timer), switches Nginx to the domain, redirects
   the IP address and `http://` to `https://your-domain`, and adds HSTS (six months, no subdomains, no preload).
   If Nginx rejects the new configuration, the IP site is restored.
3. Change the repository variable `PRODUCTION_SITE_URL` to `https://your-domain`.
4. **Actions → Release → Run workflow** on `main`, then **Deploy** that release with an approval code: the
   storefront is rebuilt with its real address. The admin login keeps working on the domain in between.

If the domain goes through **ParsPack CDN** (or another proxy), tick `skip_dns_check` (DNS then points at the CDN)
and make sure the CDN forwards `/.well-known/acme-challenge/` on port 80 to the server, or use the CDN's own
certificate with SSL mode "Full". With a CDN in front, configure Nginx `set_real_ip_from` with the CDN's published
address ranges so rate limits and analytics see visitors, not the CDN.

**Important for this server:** Let's Encrypt checks the domain by connecting to it *from abroad*, which this
data center does not allow today (see [Architecture](#architecture)). Unless international access has been
restored by then, use one of these instead of a direct Let's Encrypt check:
- **ParsPack CDN** (or another Iranian CDN) in front of the domain, with the CDN's certificate and SSL mode
  "Full" towards the server; run enable-domain with `skip_dns_check` after putting a certificate the CDN accepts
  in place, or keep the self-signed one if the CDN allows it;
- a certificate obtained through a **DNS check** (DNS-01) at your DNS provider, or bought from a provider, placed in
  `/etc/letsencrypt/live/kasra/{fullchain,privkey}.pem` before running enable-domain.

Decide this when the domain is ready; it may involve a paid CDN plan.

## Releases, approval and rollback

Every merge to `main` starts **Actions → Release**, which tests the change and stores the release's images. Nothing
is installed yet. To deploy, **Actions → Deploy → Run workflow** with `release` = the commit and `approval_code` =
the authenticator app's current code. Usually Claude posts the approval summary in the chat, the owner answers with
the code, and Claude starts the run. The code is accepted once, for ten minutes. The job checks that the commit is on
`main` and that its Release run passed, downloads its images, and asks the gate to run `deploy.sh`, which on the server:

1. loads the images and records the release's compose file;
2. backs up the database (`db-…-pre-deploy-<previous>.dump`);
3. switches the containers — the API runs pending migrations in one transaction before it starts — and waits until
   PostgreSQL, Redis, the API and the storefront are healthy, run the new images and answer through Nginx;
4. on any failure returns to the previous release automatically and fails the job with sanitized logs.

**Expected interruption:** 10–20 seconds per release while the API and storefront containers restart. Nginx shows
a "در حال به‌روزرسانی" page with automatic refresh during that time.

**Manual rollback:** **Production operations** → task **rollback** with an approval code (empty `target` = previous
release, or a commit from `status`). It switches code only; the database stays as it is.

### Database migrations

Migrations live in `backend/sql/` and are listed in `backend/src/db/migrate.ts`; they run automatically when the
API starts, inside one transaction (a failed migration changes nothing and the deployment rolls back). Because a
rollback does not undo migrations, every migration must keep the previous release working: add tables, columns
with defaults and indexes; rename or drop only in a later release, after the code no longer uses them. When a
release must undo data changes, restore the pre-deploy backup (below) — that discards orders placed since.

## Backups and restore

- **Nightly** at 03:30 Tehran time: database dump + media archive, 14 days kept.
- **Before every deployment**: database dump, 10 kept. **Manual**: **Production operations** → task **backup** (approval code).
- Files: `/var/backups/kasra/db-<UTC time>-<label>.dump` (pg_dump custom format) and `media-…tar.gz`.
- **Off-server copies are not automated.** A server failure would lose these backups too. Periodically download
  the newest files (`scp root@SERVER_IP:/var/backups/kasra/db-*.dump .`) or enable ParsPack's snapshot/backup
  service (may be paid — decide before relying on it). Keep `/opt/kasra/.env` in a password manager.

**Restore (destructive):** **Production operations** → task **restore**, `target` = a `db-….dump` file name (listed
by `status`), optional `extra` = a `media-….tar.gz`, `confirm` = `RESTORE <db file name>`, and an approval code. It takes a safety backup
first, stops the API and storefront, restores in a single transaction (on error nothing changes), and starts them
again. Media files are added back; none are deleted.

## Removing the demo catalog before launch

Production starts with the 36 demo products (owner's decision, 28 October 2026). They are to be removed when the
real products are uploaded. This deletes data, so it needs the owner's explicit approval at that time; it is not
an ops task yet. The order of steps matters:

1. **Backup** (ops task `backup`).
2. **Turn the seed off**: set `SEED_DEMO_DATA=false` in `/opt/kasra/.env` (provision with `demo_data` = `false`).
   The seed runs whenever the products table is empty, so without this step the demo catalog returns at the next
   API restart.
3. **Delete the demo products** by their ids, `shomiz-01`…`shomiz-12`, `manto-01`…`manto-12` and `tshirt-01`…`tshirt-12`
   (generated in `src/data/products.ts`; ids are unique, so a product created in the admin cannot hold one of
   these while the demo products exist).
   Their variants and home-slider entries are removed with them (`ON DELETE CASCADE`). Order lines keep their own
   copy of the product name and price and have no foreign key to products, so existing orders stay readable. Demo
   photos are served from the storefront image, not the media volume, so there are no files to delete.
4. Optionally delete test orders placed during the preview, and reset the traffic statistics (`page_views`).

Alternative before any real order or staff setup exists: a **fresh database** (stop the stack, remove the
`kasra_postgres_data` volume, deploy with `SEED_DEMO_DATA=false`, create the owner again). It is simpler, but it also
removes accounts, settings and the audit log.

## Operations workflow

**Actions → Production operations → Run workflow** on `main`. Every task except `status` needs `approval_code`.

| Task | What it does | Inputs |
| --- | --- | --- |
| `status` | Release, containers, resources, backups, certificates, sanitized warnings/errors (no code needed) | `log_window` (e.g. `6h`) |
| `inspect` | Server report (OS, resources, ports, software, reachable services) | — |
| `provision` | Prepare or update the server (see step 4) | `demo_data`, `harden` |
| `backup` | Database + media backup now | — |
| `rollback` | Return to an earlier release kept on the server | `target` (optional commit) |
| `restore` | Restore a database (and media) backup | `target`, `extra`, `confirm` |
| `enable-domain` | Let's Encrypt certificate and Nginx for the domain | `target`, `extra`, `www`, `skip_dns_check` |

## Troubleshooting

- **A production job stays "Waiting for a runner"**: `journalctl -u kasra-runner --since -1h` on the server. "cannot
  register a runner" means the GitHub token expired or lost its permission: create a new one (step 2) and run
  `install-runner.sh --token`. The server needs outgoing HTTPS to GitHub; an Iranian internet shutdown pauses
  deployments (the site keeps running).
- **"refused: approval code is wrong, expired or already used"**: use a fresh code (they last 30 seconds in the app
  and ten minutes at the gate, once). Check that the phone's clock is automatic. A lost phone: run
  `install-runner.sh --rotate-totp` on the server and scan the new QR code.
- **"too many wrong codes"**: the gate waits 15 minutes after five wrong codes.
- **Deployment rolled back**: the job log shows the sanitized lines of each container. On the server,
  `cd /opt/kasra && docker compose logs --tail 200 backend` shows everything.
- **Disk**: `status` shows usage; old images are pruned to the last five releases, backups are rotated.
- **Server reboot**: all containers restart automatically (`restart: unless-stopped`), Nginx and the backup timer
  are enabled services. Security updates install automatically; reboots for kernel updates are never automatic
  (`status` reports when one is pending).

## Local and staging use

`compose.yaml` in the repository root remains the local/staging stack (`docker compose up --build`); see the
[README](../README.md). It builds images locally, while production uses `deploy/compose.production.yaml` with
pre-built images. Keep the two in step when adding services or environment variables. Before campaigns, load-test a
separate staging copy (k6/Locust/Artillery); 8 vCPU / 16 GB is a budget, not a measured capacity.
