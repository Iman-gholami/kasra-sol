#!/usr/bin/env bash
# One-time setup of how GitHub deploys to this server. The server (an Iranian data center) accepts no
# connections from abroad, so a supervisor on the server fetches production jobs from GitHub instead and
# runs each one in a throwaway sandbox (runner-supervisor.sh); the only way from a job to root is
# kasra-gate, which demands DEPLOY_TOKEN, a secret only jobs approved in the "production" environment get.
#
# Run as root on the server (docs/DEPLOYMENT.md, step 3):
#   bash /root/kasra-sol/deploy/server/install-runner.sh
# It asks for (or reads KASRA_GITHUB_TOKEN) a fine-grained GitHub token for this repository with
# "Administration: Read and write" (to register a runner for each job) and prints DEPLOY_TOKEN once, for
# the production environment's secrets. Re-running is safe. Options:
#   --token          replace the stored GitHub token (e.g. when it expires)
#   --rotate-token   issue a new DEPLOY_TOKEN (then update the GitHub secret)
#   --test [--offline]  for deploy/test/deploy-test.sh on a disposable machine: no GitHub token, no service
#                       start, DEPLOY_TOKEN from KASRA_TEST_TOKEN; --offline also skips packages and downloads
set -euo pipefail
umask 077
REPO=Iman-gholami/kasra-sol
HERE=$(cd "$(dirname "$0")" && pwd)
log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }

test_mode=false; offline=false; new_token=false; rotate=false
for arg in "$@"; do
  case "$arg" in
    --test) test_mode=true ;;
    --offline) offline=true ;;
    --token) new_token=true ;;
    --rotate-token) rotate=true ;;
    *) die "unknown option $arg" ;;
  esac
done
[ "$offline" = false ] || [ "$test_mode" = true ] || die "--offline is only for --test runs"
[ "$(id -u)" = 0 ] || die "run as root"
. /etc/os-release
case "$ID" in ubuntu|debian) ;; *) die "unsupported OS $PRETTY_NAME" ;; esac
[ -f "$HERE/kasra-gate" ] || die "run this from a copy of the repository (deploy/server/kasra-gate is missing)"
has_systemd=false; [ -d /run/systemd/system ] && has_systemd=true

if [ "$offline" = false ]; then
  log "Checking that this server reaches the GitHub services the runner uses"
  unreachable=""
  for url in https://github.com https://api.github.com https://codeload.github.com \
      https://pipelines.actions.githubusercontent.com https://results-receiver.actions.githubusercontent.com \
      https://release-assets.githubusercontent.com https://objects.githubusercontent.com; do
    code=$(curl -sS -o /dev/null -m 15 -w '%{http_code}' "$url" 2>/dev/null || true)
    printf '  %-58s %s\n' "$url" "${code:-000}"
    [ "${code:-000}" = 000 ] && unreachable="$unreachable $url"
  done
  [ -z "$unreachable" ] || die "not reachable from this server:$unreachable"

  log "Installing packages"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -q
  apt-get install -y -q --no-install-recommends ca-certificates curl jq git tar python3 libkrb5-3 zlib1g
  icu=$(apt-cache search --names-only '^libicu[0-9]+$' | cut -d' ' -f1 | sort -V | tail -n 1)
  [ -n "$icu" ] && apt-get install -y -q --no-install-recommends "$icu"
  apt-get install -y -q liblttng-ust1t64 2>/dev/null || apt-get install -y -q liblttng-ust1 2>/dev/null || true
  apt-get install -y -q libssl3t64 2>/dev/null || apt-get install -y -q libssl3 2>/dev/null || true
fi

log "Installing the gate and the runner supervisor"
getent group kasra-gate >/dev/null || groupadd --system kasra-gate
install -d -m 0700 /etc/kasra
for file in kasra-gate:kasra-gate runner-supervisor.sh:kasra-runner-supervisor; do
  install -m 0755 "$HERE/${file%%:*}" "/usr/local/sbin/${file#*:}.new"
  mv "/usr/local/sbin/${file#*:}.new" "/usr/local/sbin/${file#*:}"
done
install -m 0644 "$HERE"/systemd/kasra-gate.socket "$HERE"/systemd/kasra-gate@.service \
  "$HERE"/systemd/kasra-runner.service /etc/systemd/system/
if [ "$has_systemd" = true ]; then
  systemctl daemon-reload
  systemctl enable --now kasra-gate.socket >/dev/null
fi
[ "$offline" = true ] || /usr/local/sbin/kasra-runner-supervisor --update-runner

# DEPLOY_TOKEN: shown once here, kept on the server only as its SHA-256.
deploy_token=""
if [ ! -s /etc/kasra/deploy-token.sha256 ] || [ "$rotate" = true ]; then
  if [ "$test_mode" = true ]; then
    deploy_token=${KASRA_TEST_TOKEN:?KASRA_TEST_TOKEN is required with --test}
  else
    deploy_token=$(openssl rand -hex 32)
  fi
  printf '%s' "$deploy_token" | sha256sum | cut -d' ' -f1 > /etc/kasra/deploy-token.sha256
  chmod 600 /etc/kasra/deploy-token.sha256
fi

if [ "$test_mode" = false ]; then
  if [ ! -s /etc/kasra/github-token ] || [ "$new_token" = true ]; then
    token=${KASRA_GITHUB_TOKEN:-}
    [ -n "$token" ] || { read -rsp "GitHub token (fine-grained, this repository only): " token </dev/tty; echo; }
    code=$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $token" \
      "https://api.github.com/repos/$REPO/actions/runners" || true)
    [ "$code" = 200 ] || die "GitHub refused the token for runner management (HTTP $code): it needs Administration: Read and write on $REPO"
    printf '%s\n' "$token" > /etc/kasra/github-token
    chmod 600 /etc/kasra/github-token
    log "GitHub token stored in /etc/kasra/github-token (root only)"
  fi
  # The SSH key from the first setup attempt is not used: GitHub never connects in.
  if [ -f /root/.ssh/authorized_keys ] && grep -q 'kasra-github-deploy' /root/.ssh/authorized_keys; then
    sed -i '/kasra-github-deploy/d' /root/.ssh/authorized_keys
    log "Removed the unused kasra-github-deploy SSH key from /root/.ssh/authorized_keys"
  fi
  if [ -n "$deploy_token" ]; then
    printf '%s\n' "" "================================================================================" \
      " DEPLOY_TOKEN (shown only now). In GitHub: Settings > Environments > production >" \
      " Environment secrets > Add environment secret, name DEPLOY_TOKEN, value:" "" "   $deploy_token" "" \
      " Then run: clear     (Lost it? Run this script again with --rotate-token.)" \
      "================================================================================"
  fi
  # A runner from before (e.g. an older supervisor) that is only waiting for a job is replaced right away;
  # one that has taken a job ("Running job:" in its log) is left to finish, and the new runner follows it.
  busy=false
  for unit in $(systemctl list-units --plain --no-legend --state=active 'kasra-job-*' | awk '{print $1}'); do
    if journalctl -u "$unit" --no-pager -q | grep -q 'Running job:'; then
      busy=true
    else
      systemctl stop "$unit" || true
    fi
  done
  # Job folders of the earlier DynamicUser= sandbox (state lived in /var/lib/private) are no longer used.
  if [ "$busy" = false ]; then
    rm -rf /var/lib/private/kasra-jobs
    find /var/lib/kasra-jobs -mindepth 1 -maxdepth 1 -type l -delete 2>/dev/null || true
  fi
  started=$(date '+%Y-%m-%d %H:%M:%S')
  systemctl enable kasra-runner.service >/dev/null
  systemctl restart kasra-runner.service
  if [ "$busy" = true ]; then
    log "A production job is running; the new runner starts when it ends (check Settings > Actions > Runners)."
    exit 0
  fi
  # Success only once the runner in its sandbox has connected to GitHub, not merely been registered.
  for _ in $(seq 1 24); do
    journalctl -u 'kasra-job-*' --since "$started" --no-pager -q | grep -q 'Listening for Jobs' && break
    sleep 5
  done
  if journalctl -u 'kasra-job-*' --since "$started" --no-pager -q | grep -q 'Listening for Jobs'; then
    log "The runner is connected: Settings > Actions > Runners > Self-hosted runners lists kasra-prod-… (Idle)."
  else
    journalctl -u kasra-runner.service --since "$started" --no-pager | tail -n 15
    journalctl -u 'kasra-job-*' --since "$started" --no-pager | tail -n 30
    die "the runner did not connect to GitHub; see the logs above"
  fi
fi
