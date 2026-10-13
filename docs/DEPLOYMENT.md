# ParsPack VPS deployment — Ubuntu LTS

**Target:** 8 vCPU, 16 GB RAM, 150 GB NVMe. The configuration runs **only** the Next.js frontend today. No PostgreSQL, Redis, backend API, payment system or production customer data exists.

## Architecture

Users → ParsPack CDN/WAF (after domain/DNS verification) → HTTPS Nginx on VPS → `127.0.0.1:3000` → non-root Next.js standalone container.

This is an intended deployment, **not** a claimed working ParsPack installation.

## 1. Prepare the VPS

- Install supported Ubuntu LTS security updates; install Docker Engine + Compose plugin from Docker's official Ubuntu repository. Configure unattended security updates as appropriate.
- Use SSH keys, a non-root sudo administrator, and restrict SSH to trusted IPs where practical.
- Configure UFW/host firewall: allow SSH (verify before enabling), TCP 80 and 443; **do not expose TCP 3000**, PostgreSQL 5432 or Redis 6379 externally.
- Install Nginx and Certbot's Nginx integration on the host. Keep both packages patched.
- Point your actual DNS A/AAAA records to the VPS and validate resolution. Set up ParsPack WAF/CDN only after verifying origin headers, SSL mode and cache controls.

Example commands, adjust for operating-system setup:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install nginx certbot python3-certbot-nginx ufw -y
# Install current Docker Engine and docker compose plugin via official Docker docs.
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 2. Build frontend

```bash
git clone https://github.com/Iman-gholami/kasra-sol.git
cd kasra-sol
cp .env.production.example .env
# Edit .env: NEXT_PUBLIC_SITE_URL=https://YOUR-REAL-DOMAIN
docker compose config
docker compose build --pull
docker compose up -d
docker compose ps
curl -f http://127.0.0.1:3000/api/health
docker compose logs -f --tail=100 frontend
```

Build-time `NEXT_PUBLIC_SITE_URL` must match the public origin for canonical metadata. Docker does not need production secrets for the current prototype. Never commit a populated `.env`.

## 3. Reverse proxy and TLS

```bash
sudo cp deploy/nginx/kasra.conf /etc/nginx/sites-available/kasra
sudo ln -s /etc/nginx/sites-available/kasra /etc/nginx/sites-enabled/kasra
# Replace your-domain.example in the copied file.
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.example -d www.your-domain.example
sudo certbot renew --dry-run
```

Use production-real hostnames, confirm HTTP→HTTPS redirect, certificate renewal and origin/WAF routing. Only expose the Nginx listener to the internet. The supplied configuration does not assume certificates exist yet.

## 4. Resources, cache and operations

Initial frontend limits: **2 vCPU, 2 GiB RAM (512 MiB reservation)** in Compose, leaving substantial host capacity for Ubuntu, Nginx, filesystem cache and future services. These are budgets, not benchmarked requirements; adjust from p95 latency, resident memory, event-loop delay, CPU and 5xx monitoring. Compose enables restart-on-failure/reboot, a `/api/health` check, log rotation (10 MiB × 5), a non-root UID and read-only root with bounded writable `.next/cache` and `/tmp` tmpfs. Verify image permissions in a real Compose smoke test.

Cache versioned JS/CSS/fonts and product photos at CDN with long immutable TTLs. Never apply shared caching to `/cart`, `/wishlist`, `/checkout`, `/account`, order endpoints, cookies or private APIs. Real prices/inventory at checkout must always be revalidated against the backend; invalidate catalog CDN entries when data changes. Image media should move to object storage rather than the container.

Monitor Nginx access/error logs, Docker health, restart counts, 4xx/5xx, availability, CPU, RAM, network, NVMe space, and TLS expiry. Configure alerts before a campaign. Back up **source, deployment configuration, secrets in a secure manager, and future durable services**; the current app has no database. Test database restore procedures when PostgreSQL is introduced. Keep images/dependencies, OS and Nginx updated.

## 5. Safe rollout and rollback

Tag each verified image with an immutable Git SHA in the release process and retain the previous image. For each release: lint → typecheck → build → Playwright → staging smoke test → `docker compose up -d` → health check → sampled user journey. Record image SHA and deploy time. If checks fail, restore the previously tested image tag and redeploy, then confirm health and monitor errors; revert source/config when necessary. Do not delete persistent volumes during rollback. Current Compose defaults to the local tag for development; adjust tags for your release automation.

## 6. Load test before campaigns

On a separate staging environment, test a realistic browse-to-product-to-cart mixture with k6/Locust/Artillery. Start at normal 1k–10k visits/day shape, ramp to campaign burst arrival rates, add mobile/network profiles, and include cache-hit and cache-miss routes. Observe RPS, p50/p95/p99 response time, error rate, CPU, heap, I/O, CDN origin hits and memory growth; find saturation and define autoscaling or additional nodes. **8 vCPU / 16 GiB does not guarantee 100k visits/day**.

## 7. Later full-stack architecture

Separate Docker services for backend API, PostgreSQL and optionally Redis, behind a private network. Use typed frontend API adapters. PostgreSQL: indexing, migrations, pooled connections, transaction-safe stock/order/payment status, snapshots/backups plus tested restores, no public port. Redis only for ephemeral caching/rate limits/jobs, never order-of-record storage. Store product images in object storage/CDN. In a multi-instance design, use shared invalidation for Next caches and backend data, centralized logs and a load balancer; avoid durable data in containers. Do not deploy these services before the business needs them.
