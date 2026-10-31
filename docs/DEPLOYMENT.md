# Production deployment — ParsPack VPS

How Kasra runs in production, how a change gets there, and how to operate it. The day-to-day release
procedure (for people and for Claude sessions) is in [RELEASING.md](RELEASING.md).

## Architecture

```text
Visitor ──HTTPS──▶ Nginx on the VPS (TLS, maintenance page)
                     └─▶ 127.0.0.1:3000  Next.js storefront container (read-only, non-root)
                            └─▶ backend:4000  Fastify API container (non-root; runs migrations on start)
                                   ├─▶ postgres:5432  PostgreSQL 17   volume kasra_postgres_data
                                   ├─▶ redis:6379     Redis 7 cache   (no persistence)
                                   └─▶ storage:3900   Garage S3 object storage, bucket kasra-media   volume kasra_storage_data
                                   uploads (copy) ─▶ volume kasra_media_data
```

Only Nginx listens publicly (80/443). The API listens on `127.0.0.1:4000` for health checks; PostgreSQL, Redis and
the object storage are reachable only on the private Docker network and all require credentials.

GitHub's runners cannot reach the server, which is in an Iranian data center: they time out on SSH (port 22)
although no firewall existed on the server or in the ParsPack panel. Its outgoing connections to GitHub work,
and its web ports are reachable from abroad (check-host.net, 28 October 2026: port 80 answered from every
country tested but one). Deployment therefore runs the other way round: the server fetches
production jobs from GitHub and runs each in a throwaway sandbox. The owner approves every production job
with GitHub's **Review deployments** button; only an approved job receives the token the server demands.

```text
GitHub (abroad)                          ParsPack server (Iran)
  Release deploy / Production ops   ◀─ polls ─ kasra-runner (root supervisor): one just-in-time runner per job,
  ⏸ owner approves → DEPLOY_TOKEN              each in a sandbox (user kasra-job, no Docker, no local network)
                                                └─ /run/kasra-gate.sock ─▶ kasra-gate (root): checks DEPLOY_TOKEN,
                                                     then deploy.sh / provision.sh / backup.sh …
```

```text
pull request ──▶ Storefront CI · Fastify Backend CI · Admin panel E2E · Production images (deploy test)
merge to main ──▶ Release: the same checks ─▶ images built and proven ─▶ ⏸ owner approval ─▶ deploy ─▶ verify
                                                                                    └─ failure ─▶ automatic rollback
```

### Decisions

| Decision | Why |
| --- | --- |
| **Docker Compose on the single VPS** | The repository already ships hardened Dockerfiles and Compose; one VPS (about 6 GB RAM, 96 GB disk at first deployment) fits the expected load. No paid services, no orchestrator. |
| **Images are built in GitHub Actions, never on the server** | The server needs no access to Docker Hub or npm (refused or filtered from Iran). The exact images that passed the tests are what gets deployed, and server CPU is not spent on builds. The images (~90 MB per release) and, when the server lacks them, the pinned PostgreSQL/Redis images travel as workflow artifacts. |
| **Approval = GitHub environment, owner only** | Every job that can change the server uses the protected `production` environment: it waits until the owner clicks **Approve and deploy**, only then receives the `DEPLOY_TOKEN` secret, and the `production-gate` action stops it if the environment ever lists another reviewer, accepts other branches than `main`, or lost its protection. Required reviewers are free for public repositories (not for private ones below GitHub Enterprise). |
| **One-job runners in a sandbox** | GitHub cannot connect in, so `kasra-runner` (root, [`runner-supervisor.sh`](../deploy/server/runner-supervisor.sh)) registers a just-in-time runner for one job at a time and runs it as a throwaway `systemd-run` unit: unprivileged user `kasra-job`, its own copy of the root-owned runner in a job folder deleted afterwards, read-only system, private `/tmp`, no access to `/root`, `/home`, `/opt/kasra`, `/etc/kasra`, backups or Docker, and no connections to localhost, private or Docker networks. Nothing survives a job, so a job that was not approved can neither change the server nor prepare a trap that steals the token from a later approved job. This needs a fine-grained GitHub token on the server (step 3). |
| **`kasra-gate` is the only way to root** | A root service on a Unix socket ([`kasra-gate`](../deploy/server/kasra-gate)). Every task except the read-only `status` needs `DEPLOY_TOKEN` (the server keeps only its SHA-256). Tasks that run repository code copy it into a root-only directory first. |
| **Application secrets are generated on the server** | `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `ORDER_TOKEN_SECRET` and `ADMIN_API_KEY` are created by `provision.sh` in `/opt/kasra/.env` (root-only, mode 600) and never leave it. The owner account's password is typed on the server only. |
| **Logs are sanitized** | Actions logs of a public repository are public. Scripts print no secrets (GitHub also masks secret values), and `logfilter.py` removes IP addresses, phone numbers, long digit runs and query strings from application logs. The server's address itself is not secret: it is in `PRODUCTION_SITE_URL` and, later, in DNS. |

A limit worth knowing: GitHub cannot tell the owner apart from a tool acting with the owner's GitHub access.
Claude has no tool to approve deployments and its rules forbid it, but whoever controls the owner's GitHub
account can approve. Protect the account with two-factor authentication.

## What is on the server

| Path | Content |
| --- | --- |
| `/opt/kasra/.env` | Secrets and settings, plus `KASRA_RELEASE` (running commit) and `KASRA_PREVIOUS_RELEASE`. Keep a copy of this file in a password manager. |
| `/opt/kasra/compose.yaml` | The running release's [`deploy/compose.production.yaml`](../deploy/compose.production.yaml). |
| `/opt/kasra/garage.toml` | The running release's [`deploy/garage.toml`](../deploy/garage.toml) (object storage settings, no secrets). |
| `/opt/kasra/releases/<commit>/` | Compose file of the last five releases (their images are kept too) for rollback. |
| `/opt/kasra/bin/` | [`deploy/server/*.sh`](../deploy/server) from the latest release: `status.sh`, `backup.sh`, `rollback.sh`, `restore.sh`… |
| `/opt/kasra/deploy-history.log` | One line per deployment, rollback, restore and owner creation. |
| `/var/backups/kasra/` | Database dumps and media archives (see [Backups](#backups-and-restore)). |
| `/etc/nginx/sites-available/kasra` | Nginx site (IP or domain variant), shared settings in `/etc/nginx/snippets/kasra-proxy.conf`. |
| `/opt/actions-runner/` | Root-owned copy of the GitHub Actions runner; every job runs its own copy of it. |
| `/usr/local/sbin/kasra-runner-supervisor`, `kasra-runner.service` | The supervisor (one sandboxed job at a time); `journalctl -u kasra-runner` shows its runners. |
| `/usr/local/sbin/kasra-gate`, `kasra-gate.socket` | The gate on `/run/kasra-gate.sock`; `journalctl -u 'kasra-gate@*'` shows its errors. |
| `/etc/kasra/` | `deploy-token.sha256` (hash of `DEPLOY_TOKEN`) and `github-token` (runner registration). Root only. |

Useful commands as root on the server: `cd /opt/kasra && docker compose ps`, `docker compose logs -f --tail 100 backend`,
`/opt/kasra/bin/status.sh`, `cat /opt/kasra/deploy-history.log`.

## One-time setup

Only the repository owner can do these steps (they involve GitHub settings and the server's root password).
None of them requires pasting a password or token into a chat.

### 1. Protect the `production` environment (GitHub)

Repository **Settings → Environments → New environment** → name `production` → **Configure environment**:

- **Required reviewers**: tick it and add only yourself (`Iman-gholami`). Leave **Prevent self-review** unticked:
  merges and releases run under your account, and you must be able to approve them. Untick **Allow
  administrators to bypass configured protection rules** if it is shown.
- **Deployment branches and tags**: choose **Selected branches and tags** → **Add deployment branch or tag rule** → `main`.
- **Save protection rules**.

### 2. Repository variable

**Settings → Secrets and variables → Actions → Variables → New repository variable**:
`PRODUCTION_SITE_URL` = `https://SERVER_IP` now, `https://your-domain` later. It is baked into the storefront
build (canonical URLs, admin login origin).

### 3. A GitHub token for the server

GitHub → your profile picture → **Settings → Developer settings → Personal access tokens → Fine-grained tokens →
Generate new token**:

- **Token name** `kasra-server`, **Expiration** 1 year (put a reminder in your calendar), **Repository access**
  → **Only select repositories** → `kasra-sol`.
- **Repository permissions** → **Administration → Read and write** (to register one runner per job). Nothing else.
- **Generate token** and keep the page open: the token is shown once and is needed in step 4.

### 4. Install the deployment side on the server

Log in to the server as root (`ssh root@SERVER_IP`) and run:

```bash
apt-get install -y git && git clone --depth 1 https://github.com/Iman-gholami/kasra-sol.git /root/kasra-sol
```

```bash
bash /root/kasra-sol/deploy/server/install-runner.sh
```

It checks that the server reaches GitHub, installs the runner (download verified against its published SHA-256),
the gate and the supervisor, asks for the token from step 3 (hidden input) and stores it root-only, prints
**DEPLOY_TOKEN** once and starts the supervisor. Add DEPLOY_TOKEN in **Settings → Environments → production →
Environment secrets → Add environment secret** (name `DEPLOY_TOKEN`), then run `clear`. **Settings → Actions →
Runners** lists a runner `kasra-prod-…` as *Idle*. Re-running is safe; `--token` replaces an expired GitHub token,
`--rotate-token` issues a new DEPLOY_TOKEN.

### 5. Do not let forks run workflows without your approval

The repository is public. **Settings → Actions → General → Approval for running fork pull request workflows
from contributors** → **Require approval for all external contributors** → **Save**. Fork workflows would only
run in the sandbox without the token, but they should not use the server at all.

### 6. Provision the server (Actions → Production operations)

**Actions → Production operations → Run workflow** (branch `main`), task **provision**, then approve the run
(**Review deployments → production → Approve and deploy**). Options:

- `demo_data`: `true` loads the 36 demo products into an empty database (see [Removing the demo
  catalog](#removing-the-demo-catalog-before-launch)), `false` starts with an empty catalog.
- `harden`: enables the UFW firewall (only the SSH port, 80 and 443 stay open) and fail2ban for SSH.

`provision.sh` first prints the read-only `inspect.sh` report and stops without changing anything if the OS is
not Ubuntu 22.04/24.04/26.04 or Debian 12, if ports 80/443 belong to another web server, or if less than 10 GB is free.
Then it installs Docker (from Ubuntu's own repository when possible, so it works where `download.docker.com` is
refused), Nginx, unattended security upgrades, log rotation and the nightly backup timer, creates
`/opt/kasra/.env` with new random secrets, a self-signed certificate for the IP address, and the Nginx site.
It is idempotent and never overwrites `.env`, data or an enabled domain site.

### 7. First release, then the owner account

Merging to `main` (or **Actions → Release → Run workflow** on `main`) builds, tests and waits for approval; see
[RELEASING.md](RELEASING.md). After the first deployment, create the back-office owner on the server as root;
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
  disallows everything and pages carry `noindex`; a build for an IP address can never be opened, see
  [SEO.md](SEO.md)). Do not share the address with customers; real customers need the domain with a trusted certificate.
- The admin is protected by its accounts, lockout after failed logins and rate limits. Use a long unique password.

## Connecting the domain and enabling HTTPS

1. At your DNS provider create an `A` record for the domain (and `www` if wanted) pointing to the server's IP.
   Wait until `getent hosts your-domain` on the server shows that address.
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

**This server: `kasraboutique.ir`.** The domain is registered at ParsPack. ParsPack's domain service has no DNS
hosting, so DNS is served by the free **ParsPack CDN** plan:
- the domain's nameservers are `lightning.parspack.net` and `steppe.parspack.net`;
- `A` records `@` and `www` point to the server with the CDN **proxy off** ("DNS only"), so visitors reach the
  server directly and Let's Encrypt's HTTP check works (the server reaches `acme-v02.api.letsencrypt.org`, and
  port 80 is reachable from abroad);
- no wildcard record.

Turning the CDN proxy on later needs the `set_real_ip_from` change above and `skip_dns_check` on enable-domain.

## Releases, approval and rollback

Every merge to `main` starts **Actions → Release**. The deployment job waits in the `production` environment until
you approve it: open the run (a yellow "Waiting" badge, also e-mailed by GitHub) → **Review deployments** → tick
`production` → **Approve and deploy** (or **Reject**). A newer release waiting for approval replaces an older waiting
one. The approval waits up to 30 days. The approved job runs on the server, downloads the release's images and asks
the gate to run `deploy.sh`, which:

1. loads the images and records the release's compose file;
2. backs up the database (`db-…-pre-deploy-<previous>.dump`);
3. switches the containers — the API runs pending migrations in one transaction before it starts — and waits until
   PostgreSQL, Redis, the API and the storefront are healthy, run the new images and answer through Nginx;
4. on any failure returns to the previous release automatically and fails the job with sanitized logs.

**Expected interruption:** 10–20 seconds per release while the API and storefront containers restart. Nginx shows
a "در حال به‌روزرسانی" page with automatic refresh during that time.

**Manual rollback:** **Production operations** → task **rollback**, then approve (empty `target` = previous
release, or a commit from `status`). It switches code only; the database stays as it is.

### Database migrations

Migrations live in `backend/sql/` and are listed in `backend/src/db/migrate.ts`; they run automatically when the
API starts, inside one transaction (a failed migration changes nothing and the deployment rolls back). Because a
rollback does not undo migrations, every migration must keep the previous release working: add tables, columns
with defaults and indexes; rename or drop only in a later release, after the code no longer uses them. When a
release must undo data changes, restore the pre-deploy backup (below) — that discards orders placed since.

## Object storage (product photos)

Uploaded product photos are kept in an S3-compatible bucket, `kasra-media`, served by the `storage` service: one
[Garage](https://garagehq.deuxfleurs.fr) node (`dxflrs/garage`, pinned) on this server for now. Garage is a small
self-hosted object store built for exactly this; MinIO's free edition is no longer published as Docker images.

- **Writing.** The API compresses every upload (WebP, at most 1200×1600 px and 350 KB) and stores it in the bucket and,
  as a copy, in the `kasra_media_data` volume. If the bucket refuses, the upload fails with a clear message in the admin.
- **Reading.** Visitors load `/api/media/<file>`; the storefront asks the API, which reads the bucket, or the copy when
  the bucket does not answer. Responses are immutable for a year, so browsers (and later a CDN) cache them.
- **`storage-init`** runs at every deployment and exits: it gives the node its role, creates the bucket and the API's
  key from `.env`, then copies photos that are only in the volume into the bucket, compressed in their own format (on
  the first deployment: every photo uploaded before the object storage; after a restore: the restored ones). `status`
  shows it as `Exited (0)`.
- **Secrets** `GARAGE_RPC_SECRET`, `GARAGE_ADMIN_TOKEN`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` are generated on
  the server (by `provision.sh`, or by `deploy.sh` on servers provisioned before the object storage).
- **Rollback** to a release from before the object storage stops the two services (their volume stays) and serves
  photos from the volume, which has all of them.

**Moving the bucket off this server (recommended later).** A single VPS holds the site, its database and its photos;
losing the disk loses all three. Before relying on the store, move the photos to an object storage service with its
own redundancy and backups (for example ArvanCloud or ParsPack object storage, both S3-compatible, inside Iran) and,
ideally, put its public address behind a CDN. Nothing in the code changes:

1. Create a private bucket and an access key limited to it at the provider.
2. In `/opt/kasra/.env` set `S3_ENDPOINT` (the provider's S3 address), `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`,
   `S3_SECRET_ACCESS_KEY`, and `GARAGE_ADMIN_URL=` (empty: there is no Garage to prepare). This is a server change:
   the owner's approval is needed.
3. Deploy (or run the Release workflow again). `storage-init` copies every photo of the volume into the new bucket.
4. After checking the site, the `storage` service and the `kasra_storage_data` volume can be removed in a later
   release, and the local copy can be turned off once the provider's backups are confirmed.

## Backups and restore

- **Nightly** at 03:30 Tehran time: database dump + media archive (the local copy of every photo), 14 days kept.
- **Before every deployment**: database dump, 10 kept. **Manual**: **Production operations** → task **backup** (approve the run).
- Files: `/var/backups/kasra/db-<UTC time>-<label>.dump` (pg_dump custom format) and `media-…tar.gz`.
- **Off-server copies are not automated.** A server failure would lose these backups too. Periodically download
  the newest files (`scp root@SERVER_IP:/var/backups/kasra/db-*.dump .`) or enable ParsPack's snapshot/backup
  service (may be paid — decide before relying on it). Keep `/opt/kasra/.env` in a password manager.

**Restore (destructive):** **Production operations** → task **restore**, `target` = a `db-….dump` file name (listed
by `status`), optional `extra` = a `media-….tar.gz`, `confirm` = `RESTORE <db file name>`; approve the run. It takes a safety backup
first, stops the API and storefront, restores in a single transaction (on error nothing changes), and starts them
again. Media files are added back; none are deleted; `storage-init` then copies them into the bucket.

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

**Actions → Production operations → Run workflow** on `main`. Every task except `status` waits for your approval.

| Task | What it does | Inputs |
| --- | --- | --- |
| `status` | Release, containers, resources, backups, certificates, sanitized warnings/errors (no approval needed) | `log_window` (e.g. `6h`) |
| `inspect` | Server report (OS, resources, ports, software, reachable services) | — |
| `provision` | Prepare or update the server (see step 6) | `demo_data`, `harden` |
| `backup` | Database + media backup now | — |
| `rollback` | Return to an earlier release kept on the server | `target` (optional commit) |
| `restore` | Restore a database (and media) backup | `target`, `extra`, `confirm` |
| `enable-domain` | Let's Encrypt certificate and Nginx for the domain | `target`, `extra`, `www`, `skip_dns_check` |

## Troubleshooting

- **A production job stays "Waiting for a runner"**: `journalctl -u kasra-runner --since -1h` on the server. "cannot
  register a runner" means the GitHub token expired or lost its permission: create a new one (step 3) and run
  `install-runner.sh --token`. The server needs outgoing HTTPS to GitHub; an Iranian internet shutdown pauses
  deployments (the site keeps running).
- **"refused: missing or wrong DEPLOY_TOKEN"**: the environment secret does not match the server; run
  `install-runner.sh --rotate-token` on the server and update the `DEPLOY_TOKEN` secret.
- **The job fails in "production-gate"**: the `production` environment lost its protection, lists another
  reviewer, or accepts other branches; fix it as in step 1.
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
separate staging copy (k6/Locust/Artillery); the server's size is a budget, not a measured capacity.
