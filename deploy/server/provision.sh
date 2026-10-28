#!/usr/bin/env bash
# Prepares an Ubuntu (22.04/24.04) or Debian 12 server for Kasra. Idempotent: safe to run again, and it
# never deletes data, overwrites an existing .env, or replaces a domain (Let's Encrypt) Nginx site.
# Run as root by .github/workflows/ops.yml (task "provision") from an unpacked copy of deploy/.
#
#   SERVER_IP=1.2.3.4 SITE_URL=https://1.2.3.4 SEED_DEMO_DATA=true HARDEN=false bash provision.sh
#
# HARDEN=true also enables the UFW firewall (SSH, 80, 443 only) and fail2ban for SSH.
source "$(dirname "$0")/lib.sh"
SOURCE=$(cd "$(dirname "$0")/.." && pwd)
require_root

SERVER_IP=${SERVER_IP:-}
SITE_URL=${SITE_URL:-}
SEED_DEMO_DATA=${SEED_DEMO_DATA:-false}
HARDEN=${HARDEN:-false}
export DEBIAN_FRONTEND=noninteractive

# --- Preflight: stop before changing anything if the server is not what this script expects -------------
. /etc/os-release
case "${ID}:${VERSION_ID}" in
  ubuntu:22.04|ubuntu:24.04|debian:12) log "OS: $PRETTY_NAME" ;;
  *) die "unsupported OS $PRETTY_NAME (supported: Ubuntu 22.04/24.04, Debian 12); nothing was changed" ;;
esac
for port in 80 443; do
  owner=$(ss -tlnpH "sport = :$port" 2>/dev/null | sed -nE 's/.*users:\(\("([^"]+)".*/\1/p' | sort -u | tr '\n' ' ')
  case "$owner" in ""|"nginx ") ;; *) die "port $port is already used by: $owner; nothing was changed" ;; esac
done
avail_gb=$(df -BG --output=avail / | tail -n 1 | tr -dc 0-9)
[ "$avail_gb" -ge 10 ] || die "only ${avail_gb} GB free on /; at least 10 GB is needed"
[[ $SEED_DEMO_DATA =~ ^(true|false)$ ]] || die "SEED_DEMO_DATA must be true or false"
if [ -z "$SERVER_IP" ] || ! [[ $SERVER_IP =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
  SERVER_IP=$(ip -4 route get 1.1.1.1 2>/dev/null | sed -nE 's/.* src ([0-9.]+).*/\1/p')
fi
[ -n "$SERVER_IP" ] || die "could not determine the server's IPv4 address"
[ -n "$SITE_URL" ] || SITE_URL="https://$SERVER_IP"

# --- Packages ----------------------------------------------------------------------------------------------
log "Installing packages"
apt-get update -q
apt-get install -y -q --no-install-recommends ca-certificates curl openssl gnupg nginx python3 \
  unattended-upgrades cron logrotate

install_docker_repo() {
  # Docker's own repository; refused from some networks (e.g. sanctioned regions), hence the fallback order.
  curl -fsS --max-time 20 "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc || return 1
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/$ID $VERSION_CODENAME stable" \
    > /etc/apt/sources.list.d/docker.list
  chmod 644 /etc/apt/sources.list.d/docker.list
  apt-get update -q && apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-compose-plugin
}
install -d -m 0755 /etc/apt/keyrings
if ! command -v docker >/dev/null 2>&1; then
  if apt-cache show docker-compose-v2 >/dev/null 2>&1; then
    log "Installing Docker from the distribution (docker.io + docker-compose-v2)"
    apt-get install -y -q docker.io docker-compose-v2
  else
    log "Installing Docker from download.docker.com"
    install_docker_repo || die "cannot install Docker: no docker-compose-v2 package and download.docker.com unreachable"
  fi
fi
if ! docker compose version >/dev/null 2>&1; then
  apt-get install -y -q docker-compose-v2 2>/dev/null || apt-get install -y -q docker-compose-plugin 2>/dev/null \
    || die "Docker is installed but the compose plugin is missing and could not be installed"
fi
log "$(docker --version); $(docker compose version | head -n 1)"

# Log rotation for every container, and running containers survive a Docker package upgrade. Docker must
# restart to apply it, so this is skipped (with a note) when containers are already running here.
if [ ! -f /etc/docker/daemon.json ] && [ -n "$(docker ps -q)" ]; then
  log "Note: /etc/docker/daemon.json not written because containers are running (Kasra sets log rotation per service)"
elif [ ! -f /etc/docker/daemon.json ]; then
  install -d -m 0755 /etc/docker
  printf '%s\n' '{' '  "log-driver": "json-file",' '  "log-opts": { "max-size": "10m", "max-file": "5" },' \
    '  "live-restore": true' '}' > /etc/docker/daemon.json
  chmod 644 /etc/docker/daemon.json
  systemctl restart docker
fi
systemctl enable --now docker >/dev/null

# Security updates install themselves; the server never reboots on its own.
if [ ! -f /etc/apt/apt.conf.d/20auto-upgrades ]; then
  printf '%s\n' 'APT::Periodic::Update-Package-Lists "1";' 'APT::Periodic::Unattended-Upgrade "1";' \
    > /etc/apt/apt.conf.d/20auto-upgrades
  chmod 644 /etc/apt/apt.conf.d/20auto-upgrades
fi

# --- Kasra directory, scripts and secrets ------------------------------------------------------------------
install -d -m 0700 "$KASRA_DIR" "$KASRA_DIR/bin" "$KASRA_DIR/releases" "$KASRA_DIR/incoming" "$BACKUP_DIR"
install -m 0700 "$SOURCE"/server/*.sh "$SOURCE"/server/*.py "$KASRA_DIR/bin/"
[ -f "$KASRA_DIR/compose.yaml" ] || install -m 0600 "$SOURCE/compose.production.yaml" "$KASRA_DIR/compose.yaml"

if [ ! -f "$ENV_FILE" ]; then
  log "Generating $ENV_FILE with new random secrets (they never leave this server)"
  secret() { openssl rand -hex 32; }
  {
    echo "# Kasra production settings. Secrets were generated on this server; keep a copy in a password manager."
    echo "POSTGRES_USER=kasra"
    echo "POSTGRES_DB=kasra"
    echo "POSTGRES_PASSWORD=$(secret)"
    echo "ORDER_TOKEN_SECRET=$(secret)"
    echo "ADMIN_API_KEY=$(secret)"
    echo "NEXT_PUBLIC_SITE_URL=$SITE_URL"
    echo "SEED_DEMO_DATA=$SEED_DEMO_DATA"
    echo "KASRA_RELEASE="
    echo "KASRA_PREVIOUS_RELEASE="
  } > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
else
  log "Keeping the existing $ENV_FILE (secrets unchanged)"
  env_set SEED_DEMO_DATA "$SEED_DEMO_DATA"
  [ -n "$(env_get KASRA_DOMAIN)" ] || env_set NEXT_PUBLIC_SITE_URL "$SITE_URL"
fi

# --- Daily backups -----------------------------------------------------------------------------------------
install -m 0644 "$SOURCE"/server/systemd/kasra-backup.service "$SOURCE"/server/systemd/kasra-backup.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now kasra-backup.timer >/dev/null

# --- Nginx -------------------------------------------------------------------------------------------------
log "Configuring Nginx"
install -d -m 0755 /etc/nginx/kasra /var/www/kasra /var/www/certbot
install -m 0644 "$SOURCE/nginx/kasra-proxy.conf" /etc/nginx/snippets/kasra-proxy.conf
install -m 0644 "$SOURCE/nginx/maintenance.html" /var/www/kasra/__kasra_maintenance.html

cert=/etc/nginx/kasra/selfsigned.crt
if [ ! -f "$cert" ] || ! openssl x509 -in "$cert" -noout -ext subjectAltName 2>/dev/null | grep -q "IP Address:$SERVER_IP\$"; then
  log "Creating a self-signed certificate for $SERVER_IP (temporary, until the domain has a real one)"
  openssl req -x509 -newkey rsa:2048 -nodes -days 825 -subj "/CN=$SERVER_IP" \
    -addext "subjectAltName=IP:$SERVER_IP" -keyout /etc/nginx/kasra/selfsigned.key -out "$cert" 2>/dev/null
  chmod 600 /etc/nginx/kasra/selfsigned.key
fi

site=/etc/nginx/sites-available/kasra
if [ -n "$(env_get KASRA_DOMAIN)" ]; then
  log "Domain $(env_get KASRA_DOMAIN) is configured; leaving its Nginx site as it is"
else
  sed "s/__SERVER_IP__/$SERVER_IP/g" "$SOURCE/nginx/kasra-ip.conf" > "$site.new"
  [ -f /proc/net/if_inet6 ] || sed -i '/listen \[::\]/d' "$site.new"
  mv "$site.new" "$site"
fi
ln -sfn "$site" /etc/nginx/sites-enabled/kasra
# The distribution's welcome page also claims default_server; only that stock symlink is removed.
if [ "$(readlink /etc/nginx/sites-enabled/default 2>/dev/null)" = /etc/nginx/sites-available/default ]; then
  rm /etc/nginx/sites-enabled/default
fi
nginx -t
systemctl enable nginx >/dev/null
systemctl reload nginx 2>/dev/null || systemctl restart nginx

# --- Optional hardening (asked for explicitly) -------------------------------------------------------------
if [ "$HARDEN" = true ]; then
  log "Enabling the firewall (UFW) and fail2ban"
  apt-get install -y -q ufw fail2ban
  ssh_ports=$( { sshd -T 2>/dev/null | awk '$1=="port"{print $2}'; echo "${SSH_CONNECTION:-}" | awk '{print $4}'; } | grep -E '^[0-9]+$' | sort -u)
  [ -n "$ssh_ports" ] || die "could not determine the SSH port; firewall left unchanged"
  for port in $ssh_ports; do ufw allow "$port/tcp" comment 'SSH' >/dev/null; done
  ufw allow 80/tcp comment 'HTTP' >/dev/null
  ufw allow 443/tcp comment 'HTTPS' >/dev/null
  ufw default deny incoming >/dev/null
  ufw default allow outgoing >/dev/null
  ufw --force enable >/dev/null
  systemctl enable --now fail2ban >/dev/null || log "fail2ban did not start; the firewall is on, SSH brute-force bans are off"
  ufw status verbose | sed -n '1,20p'
else
  log "Firewall unchanged (HARDEN=false)"
fi

log "Provisioning complete"
echo "Self-signed certificate SHA-256 fingerprint (compare it with the browser's certificate viewer):"
openssl x509 -in "$cert" -noout -fingerprint -sha256 | sed 's/.*=//'
echo "Site URL in .env: $(env_get NEXT_PUBLIC_SITE_URL); demo data: $(env_get SEED_DEMO_DATA); release: $(env_get KASRA_RELEASE)"
[ -f /var/run/reboot-required ] && log "Note: the OS reports a pending reboot for earlier updates (not done automatically)."
exit 0
