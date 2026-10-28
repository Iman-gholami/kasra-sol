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
Redis are reachable only on the private Docker network.

```text
pull request ──▶ Storefront CI · Fastify Backend CI · Admin panel E2E · Production images (deploy test)
merge to main ──▶ Release: the same checks ─▶ images built and proven ─▶ ⏸ owner approval ─▶ deploy ─▶ verify
                                                                                    └─ failure ─▶ automatic rollback
```

### Decisions

| Decision | Why |
| --- | --- |
| **Docker Compose on the single VPS** | The repository already ships hardened Dockerfiles and Compose; one 8 vCPU / 16 GB server fits the expected load. No paid services, no orchestrator. |
| **Images are built in GitHub Actions, never on the server** | The server needs no access to Docker Hub, npm or GitHub (Iranian networks are often refused or filtered by them). The exact images that passed the tests are what gets deployed. Server CPU is not spent on builds. Images move with `docker save` over SSH (~90 MB per release). |
| **GitHub-hosted runners deploy over SSH** | The SSH key is a secret of the protected `production` environment, so only an approved job can read it. A self-hosted runner on the server was rejected: this repository is public, and forked pull requests could reach such a runner. |
| **Approval gate = GitHub environment "required reviewers"** | Free for public repositories. Every job that can touch the server (release deployment and every ops task) waits for the owner's click. The `production-gate` action also stops the job if the protection rule is ever removed or the job is not on `main`. |
| **Application secrets are generated on the server** | `POSTGRES_PASSWORD`, `ORDER_TOKEN_SECRET` and `ADMIN_API_KEY` are created once by `provision.sh` in `/opt/kasra/.env` (root-only, mode 600). They are never in GitHub or in the repository. |
| **Logs are sanitized** | Actions logs of a public repository are public. Scripts print no secrets (GitHub also masks every secret value), and `logfilter.py` removes IP addresses, phone numbers, long digit runs and query strings from application logs. The server's address itself is not secret: it is in `PRODUCTION_SITE_URL` and, later, in DNS. |

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

Useful commands as root on the server: `cd /opt/kasra && docker compose ps`, `docker compose logs -f --tail 100 backend`,
`/opt/kasra/bin/status.sh`, `cat /opt/kasra/deploy-history.log`.

## One-time setup

Only the repository owner can do steps 1–4 (they involve your GitHub settings and your server password). None of
them requires pasting a password or private key into a chat.

### 1. Protect the `production` environment (GitHub)

Repository **Settings → Environments → New environment** → name `production` → **Configure environment**:

- **Required reviewers**: tick it and add yourself (`Iman-gholami`). Leave **Prevent self-review** unticked:
  merges and releases run under your account, and you must be able to approve them.
- **Deployment branches and tags**: choose **Selected branches and tags** → **Add deployment branch or tag rule** → `main`.
- **Save protection rules**.

### 2. Create a deployment key and install it on the server (your computer)

In a terminal (macOS/Linux, or PowerShell on Windows 10/11), replacing `SERVER_IP`:

```bash
ssh-keygen -t ed25519 -N "" -C kasra-github-deploy -f kasra_deploy
```

This creates `kasra_deploy` (private key) and `kasra_deploy.pub` (public key). If it asks for a passphrase, press
Enter twice: GitHub must be able to use the key unattended. Add the public key to the server,
limited with `restrict` (no port forwarding, agent forwarding or terminal for this key). The command asks for
the root password from ParsPack; you type it only into your own terminal:

```bash
ssh root@SERVER_IP "mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo 'restrict $(cat kasra_deploy.pub)' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

On Windows PowerShell use instead:

```powershell
$key = Get-Content kasra_deploy.pub
ssh root@SERVER_IP "mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo 'restrict $key' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

Then record the server's host key (so GitHub can detect an impostor server):

```bash
ssh-keyscan -t ed25519 SERVER_IP
```

If SSH is not on port 22, add `-p PORT` to the `ssh`/`ssh-keyscan` commands.

### 3. Add the secrets and the variable (GitHub)

**Settings → Environments → production → Environment secrets → Add environment secret**:

| Secret | Value |
| --- | --- |
| `SSH_HOST` | The server's IPv4 address |
| `SSH_PRIVATE_KEY` | The whole content of the `kasra_deploy` file (including the `BEGIN`/`END` lines) |
| `SSH_KNOWN_HOSTS` | The output line of `ssh-keyscan` (starts with the address, then `ssh-ed25519 …`) |
| `SSH_PORT` | Only if SSH is not on port 22 |
| `ADMIN_OWNER_PASSWORD` | Later, for the back-office owner (12–256 characters); delete it after the owner exists |

**Settings → Secrets and variables → Actions → Variables → New repository variable**:
`PRODUCTION_SITE_URL` = `https://SERVER_IP` now, `https://your-domain` later. It is baked into the storefront
build (canonical URLs, admin login origin).

You may delete the local `kasra_deploy` private key afterwards. If it is ever exposed, remove its line from the
server's `/root/.ssh/authorized_keys` and repeat steps 2–3 with a new key.

### 4. Provision the server (Actions → Production operations)

**Actions → Production operations → Run workflow** (branch `main`), task **provision**, then approve the run
(**Review deployments → production → Approve and deploy**). Options:

- `demo_data`: `true` loads the 36 demo products into an empty database (they can be archived later in the
  admin; there is no hard delete), `false` starts with an empty catalog.
- `harden`: enables the UFW firewall (only the SSH port, 80 and 443 stay open) and fail2ban for SSH.

`provision.sh` first prints the read-only `inspect.sh` report and stops without changing anything if the OS is
not Ubuntu 22.04/24.04 or Debian 12, if ports 80/443 belong to another web server, or if less than 10 GB is free.
Then it installs Docker (from Ubuntu's own repository when possible, so it works where `download.docker.com` is
refused), Nginx, unattended security upgrades, log rotation and the nightly backup timer, creates
`/opt/kasra/.env` with new random secrets, a self-signed certificate for the IP address, and the Nginx site.
It is idempotent and never overwrites `.env`, data or an enabled domain site.

### 5. First release, then the owner account

Merging to `main` (or **Actions → Release → Run workflow** on `main`) builds, tests and waits for approval; see
[RELEASING.md](RELEASING.md). After the first deployment, add the `ADMIN_OWNER_PASSWORD` secret and run
**Production operations** with task **create-owner** and your login name as `target`. Sign in at
`https://SERVER_IP/admin/login`, then delete the secret.

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
   Let's Encrypt expiry notices, tick `www` if you created that record. Approve the run. It checks DNS, obtains a
   Let's Encrypt certificate (renewed automatically by certbot's timer), switches Nginx to the domain, redirects
   the IP address and `http://` to `https://your-domain`, and adds HSTS (six months, no subdomains, no preload).
   If Nginx rejects the new configuration, the IP site is restored.
3. Change the repository variable `PRODUCTION_SITE_URL` to `https://your-domain`.
4. **Actions → Release → Run workflow** on `main` and approve the deployment: the storefront is rebuilt with its
   real address. The admin login keeps working on the domain in between.

If the domain goes through **ParsPack CDN** (or another proxy), tick `skip_dns_check` (DNS then points at the CDN)
and make sure the CDN forwards `/.well-known/acme-challenge/` on port 80 to the server, or use the CDN's own
certificate with SSL mode "Full". With a CDN in front, configure Nginx `set_real_ip_from` with the CDN's published
address ranges so rate limits and analytics see visitors, not the CDN.

If Let's Encrypt is unreachable from the server's network, use a certificate from your DNS/CDN provider instead:
put it in `/etc/letsencrypt/live/kasra/{fullchain,privkey}.pem`, then run enable-domain.

## Releases, approval and rollback

Every merge to `main` starts **Actions → Release**. The deployment job waits in the `production` environment until
you approve it: open the run (a yellow "Waiting" badge, also e-mailed by GitHub) → **Review deployments** → tick
`production` → **Approve and deploy** (or **Reject**). A newer release waiting for approval replaces an older waiting
one. The approval waits up to 30 days.

`deploy.sh` then, on the server:

1. loads the images and records the release's compose file;
2. backs up the database (`db-…-pre-deploy-<previous>.dump`);
3. switches the containers — the API runs pending migrations in one transaction before it starts — and waits until
   PostgreSQL, Redis, the API and the storefront are healthy, run the new images and answer through Nginx;
4. on any failure returns to the previous release automatically and fails the job with sanitized logs.

**Expected interruption:** 10–20 seconds per release while the API and storefront containers restart. Nginx shows
a "در حال به‌روزرسانی" page with automatic refresh during that time.

**Manual rollback:** **Production operations** → task **rollback** (empty `target` = previous release, or a commit
from `status`). It switches code only; the database stays as it is.

### Database migrations

Migrations live in `backend/sql/` and are listed in `backend/src/db/migrate.ts`; they run automatically when the
API starts, inside one transaction (a failed migration changes nothing and the deployment rolls back). Because a
rollback does not undo migrations, every migration must keep the previous release working: add tables, columns
with defaults and indexes; rename or drop only in a later release, after the code no longer uses them. When a
release must undo data changes, restore the pre-deploy backup (below) — that discards orders placed since.

## Backups and restore

- **Nightly** at 03:30 Tehran time: database dump + media archive, 14 days kept.
- **Before every deployment**: database dump, 10 kept. **Manual**: **Production operations** → task **backup**.
- Files: `/var/backups/kasra/db-<UTC time>-<label>.dump` (pg_dump custom format) and `media-…tar.gz`.
- **Off-server copies are not automated.** A server failure would lose these backups too. Periodically download
  the newest files (`scp root@SERVER_IP:/var/backups/kasra/db-*.dump .`) or enable ParsPack's snapshot/backup
  service (may be paid — decide before relying on it). Keep `/opt/kasra/.env` in a password manager.

**Restore (destructive):** **Production operations** → task **restore**, `target` = a `db-….dump` file name (listed
by `status`), optional `extra` = a `media-….tar.gz`, `confirm` = `RESTORE <db file name>`. It takes a safety backup
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
`kasra_postgres_data` volume, deploy with `SEED_DEMO_DATA=false`, run create-owner again). It is simpler, but it also
removes accounts, settings and the audit log.

## Operations workflow

**Actions → Production operations → Run workflow** on `main`; every run needs your approval.

| Task | What it does | Inputs |
| --- | --- | --- |
| `status` | Release, containers, resources, backups, certificates, sanitized warnings/errors | `log_window` (e.g. `6h`) |
| `inspect` | Read-only server report (OS, resources, ports, software, reachable services) | — |
| `provision` | Prepare or update the server (see step 4) | `demo_data`, `harden` |
| `backup` | Database + media backup now | — |
| `rollback` | Return to an earlier release kept on the server | `target` (optional commit) |
| `restore` | Restore a database (and media) backup | `target`, `extra`, `confirm` |
| `create-owner` | First back-office owner, password from the `ADMIN_OWNER_PASSWORD` secret | `target` (login) |
| `enable-domain` | Let's Encrypt certificate and Nginx for the domain | `target`, `extra`, `www`, `skip_dns_check` |

## Troubleshooting

- **"SSH to the server failed"**: check the secrets; `SSH_KNOWN_HOSTS` must match `ssh-keyscan` output; the
  `restrict …` line must be in `/root/.ssh/authorized_keys`. Servers inside Iran can lose international
  connectivity (GitHub's runners are abroad); if that persists, the fallback is a self-hosted runner on the server
  with the deploy job limited to `main` (discuss before switching: the repository is public).
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
