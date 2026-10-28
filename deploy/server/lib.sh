# shellcheck shell=bash
# Shared helpers for the Kasra server scripts (sourced, never run directly).
# Everything lives in /opt/kasra: compose.yaml, .env (secrets + KASRA_RELEASE), bin/ (these scripts),
# releases/<commit>/ (what each release shipped). Backups go to /var/backups/kasra.
set -euo pipefail
umask 077

KASRA_DIR=${KASRA_DIR:-/opt/kasra}
BACKUP_DIR=${BACKUP_DIR:-/var/backups/kasra}
ENV_FILE=$KASRA_DIR/.env

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }
require_root() { [ "$(id -u)" = 0 ] || die "run as root"; }

compose() { docker compose --project-directory "$KASRA_DIR" -f "$KASRA_DIR/compose.yaml" "$@"; }

env_get() { [ -f "$ENV_FILE" ] && sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1 || true; }

# Replaces (or appends) KEY=value atomically, so an interrupted write never leaves a half-written .env.
env_set() {
  local key=$1 value=$2 tmp
  tmp=$(mktemp "$KASRA_DIR/.env.XXXXXX")
  { grep -v "^$key=" "$ENV_FILE" || true; printf '%s=%s\n' "$key" "$value"; } > "$tmp"
  chmod 600 "$tmp"
  mv "$tmp" "$ENV_FILE"
}

valid_release() { [[ $1 =~ ^[0-9a-f]{40}$ ]]; }

container_id() { compose ps -q "$1" 2>/dev/null | head -n 1 || true; }

# Health of a service's current container: healthy, starting, unhealthy, restarting, exited, missing...
service_state() {
  local id
  id=$(container_id "$1")
  [ -n "$id" ] || { echo missing; return; }
  docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id"
}

# Waits until every named service is healthy; fails early when a container keeps restarting.
wait_healthy() {
  local deadline=$((SECONDS + ${HEALTH_TIMEOUT:-240})) service state id restarts
  for service in "$@"; do
    while :; do
      state=$(service_state "$service")
      # "running" is what a container without a healthcheck (Redis) reports once started.
      [ "$state" = healthy ] || [ "$state" = running ] && break
      id=$(container_id "$service")
      restarts=$( [ -n "$id" ] && docker inspect -f '{{.RestartCount}}' "$id" || echo 0)
      if [ "$restarts" -ge 3 ] || [ $SECONDS -ge $deadline ]; then
        log "$service did not become healthy (state: $state, restarts: $restarts)"
        return 1
      fi
      sleep 3
    done
    log "$service is healthy"
  done
}

# The image each app container actually runs, to prove a switch really happened.
running_release() { docker inspect -f '{{.Config.Image}}' "$(container_id "$1")" 2>/dev/null | sed 's/.*://' || true; }

take_lock() {
  exec 9>"$KASRA_DIR/.deploy.lock"
  flock -n 9 || die "another deployment, rollback or restore is running"
}

# Points the stack at a release (its own compose file and images) and starts it. Returns non-zero
# instead of exiting so callers can roll back.
switch_release() {
  local target=$1
  [ -f "$KASRA_DIR/releases/$target/compose.yaml" ] || { log "release $target is not on this server"; return 1; }
  install -m 0600 "$KASRA_DIR/releases/$target/compose.yaml" "$KASRA_DIR/compose.yaml" &&
    env_set KASRA_RELEASE "$target" &&
    compose up -d --remove-orphans
}

# A switched release counts as live only when every container is healthy, runs the expected images
# and answers through Nginx.
verify_release() {
  wait_healthy postgres redis backend frontend &&
    [ "$(running_release backend)" = "$1" ] && [ "$(running_release frontend)" = "$1" ] &&
    smoke_test
}

# The Nginx templates use the `http2 on;` directive (Nginx 1.25.1+, e.g. Ubuntu 26.04). Older Nginx (Ubuntu
# 22.04/24.04, Debian 12) only knows `listen ... ssl http2`, so the rendered site is converted for it.
nginx_http2_compat() {
  local version
  version=$(nginx -v 2>&1 | sed -nE 's#.*nginx/([0-9.]+).*#\1#p')
  if [ -n "$version" ] && dpkg --compare-versions "$version" lt 1.25.1; then
    sed -i -e '/^[[:space:]]*http2 on;$/d' -e 's/\(listen .*443 ssl\)/\1 http2/' "$1"
  fi
}

# Ships fixes to the gate, the runner supervisor and their units with every provision and deployment,
# once install-runner.sh has set them up. Nothing is restarted: a job in progress keeps its gate.
refresh_runner_side() {
  local src=$1/server changed=false file
  [ -f /etc/systemd/system/kasra-gate.socket ] || return 0
  for file in kasra-gate:kasra-gate runner-supervisor.sh:kasra-runner-supervisor; do
    if ! cmp -s "$src/${file%%:*}" "/usr/local/sbin/${file#*:}"; then
      install -m 0755 "$src/${file%%:*}" "/usr/local/sbin/${file#*:}.new"
      mv "/usr/local/sbin/${file#*:}.new" "/usr/local/sbin/${file#*:}"
    fi
  done
  for file in kasra-gate.socket kasra-gate@.service kasra-runner.service; do
    if ! cmp -s "$src/systemd/$file" "/etc/systemd/system/$file"; then
      install -m 0644 "$src/systemd/$file" /etc/systemd/system/
      changed=true
    fi
  done
  [ "$changed" = false ] || systemctl daemon-reload
}

record() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $*" >> "$KASRA_DIR/deploy-history.log"; }

# HTTP checks through every layer a visitor uses: API, Next.js, and Nginx with TLS.
smoke_test() {
  local url failed=0
  for url in http://127.0.0.1:4000/health/ready http://127.0.0.1:4000/v1/categories \
      http://127.0.0.1:3000/api/health http://127.0.0.1:3000/ http://127.0.0.1:3000/shop; do
    if curl -fsS -o /dev/null --max-time 20 "$url"; then log "OK   $url"; else log "FAIL $url"; failed=1; fi
  done
  if systemctl is-active --quiet nginx; then
    local domain host=127.0.0.1
    domain=$(env_get KASRA_DOMAIN)
    [ -n "$domain" ] && host=$domain
    if curl -fsSk -o /dev/null --max-time 20 --resolve "$host:443:127.0.0.1" "https://$host/api/health"; then
      log "OK   nginx https"
    else
      log "FAIL nginx https"; failed=1
    fi
  fi
  return $failed
}
