#!/usr/bin/env bash
# Keeps one GitHub Actions runner waiting for production jobs and runs every job in a fresh, throwaway
# sandbox, so no job (approved or not) can leave anything behind for the next one:
#   - a just-in-time runner, registered for a single job and gone afterwards;
#   - a transient systemd unit with a dynamic user and its own copy of the root-owned runner;
#   - no access to /home, /root, /opt/kasra, /etc/kasra, backups or Docker, a read-only system, and no
#     connections to localhost, private or Docker networks (only the internet and the gate socket);
#   - the only way to root is /run/kasra-gate.sock, where kasra-gate demands the owner's approval code.
# Installed as /usr/local/sbin/kasra-runner-supervisor and run by kasra-runner.service (root).
#   kasra-runner-supervisor                    the service loop
#   kasra-runner-supervisor --update-runner    install or update the runner in /opt/actions-runner
#   kasra-runner-supervisor --sandbox CMD...   run a command in the job sandbox (deploy-test.sh)
set -euo pipefail
umask 077
REPO=Iman-gholami/kasra-sol
RUNNER_DIR=/opt/actions-runner
TOKEN_FILE=/etc/kasra/github-token
STATE=/run/kasra-runner
log() { printf '%s\n' "$*"; }

api() { # api METHOD PATH [JSON] — GitHub REST call with the token, which never appears in a process list
  local method=$1 path=$2 body=${3:-}
  install -d -m 0700 "$STATE"
  printf 'Authorization: Bearer %s\n' "$(cat "$TOKEN_FILE")" > "$STATE/auth"
  curl -fsS -X "$method" -H @"$STATE/auth" -H 'Accept: application/vnd.github+json' \
    -H 'X-GitHub-Api-Version: 2022-11-28' ${body:+--data "$body"} "https://api.github.com$path"
}

update_runner() {
  local release version arch name url sum tmp current auth=()
  [ -n "${GITHUB_API_TOKEN:-}" ] && auth=(-H "Authorization: Bearer $GITHUB_API_TOKEN")
  release=$(curl -fsS "${auth[@]}" https://api.github.com/repos/actions/runner/releases/latest)
  version=$(jq -r .tag_name <<<"$release" | sed 's/^v//')
  current=$(cat "$RUNNER_DIR/.kasra-version" 2>/dev/null || true)
  [ "$version" = "$current" ] && return 0
  arch=x64; [ "$(uname -m)" = aarch64 ] && arch=arm64
  name=actions-runner-linux-$arch-$version.tar.gz
  url=$(jq -r --arg n "$name" '.assets[] | select(.name == $n) | .browser_download_url' <<<"$release")
  # The checksum comes from the release itself: the asset digest, or the SHA-256 list in its notes.
  sum=$(jq -r --arg n "$name" '.assets[] | select(.name == $n) | .digest // empty' <<<"$release" | sed 's/^sha256://')
  [ -n "$sum" ] || sum=$(jq -r .body <<<"$release" | sed -nE "s/.*BEGIN SHA linux-$arch -->([0-9a-f]{64})<.*/\1/p" | head -n 1)
  [[ $url == https://* && $sum =~ ^[0-9a-f]{64}$ ]] || { log "cannot find runner $version and its checksum"; return 1; }
  tmp=$(mktemp -d)
  curl -fsSL --retry 3 -o "$tmp/runner.tar.gz" "$url"
  echo "$sum  $tmp/runner.tar.gz" | sha256sum -c --quiet || { log "runner download does not match its SHA-256"; rm -rf "$tmp"; return 1; }
  install -d -m 0755 "$tmp/runner"
  tar -xzf "$tmp/runner.tar.gz" -C "$tmp/runner"
  echo "$version" > "$tmp/runner/.kasra-version"
  # Root-owned and world-readable: each job copies it; no job can change it.
  chown -R root:root "$tmp/runner"
  chmod -R u=rwX,go=rX "$tmp/runner"
  rm -rf "$RUNNER_DIR.old"
  [ -d "$RUNNER_DIR" ] && mv "$RUNNER_DIR" "$RUNNER_DIR.old"
  mv "$tmp/runner" "$RUNNER_DIR"
  rm -rf "$tmp" "$RUNNER_DIR.old"
  log "GitHub Actions runner $version installed"
}

# Runs a command as a throwaway dynamic user in the job sandbox; returns its exit status.
sandbox() {
  local name=$1; shift
  systemd-run --wait --collect --quiet --unit="kasra-job-$name" --service-type=exec \
    -p DynamicUser=yes -p SupplementaryGroups=kasra-gate \
    -p StateDirectory="kasra-jobs/$name" -p WorkingDirectory="/var/lib/kasra-jobs/$name" \
    -p Environment="HOME=/var/lib/kasra-jobs/$name" \
    -p ProtectSystem=strict -p ProtectHome=yes -p PrivateTmp=yes -p PrivateDevices=yes \
    -p NoNewPrivileges=yes -p RestrictSUIDSGID=yes -p LockPersonality=yes \
    -p ProtectKernelTunables=yes -p ProtectKernelModules=yes -p ProtectControlGroups=yes -p ProtectClock=yes \
    -p InaccessiblePaths="-/opt/kasra -/etc/kasra -/var/backups/kasra -/var/lib/docker -/run/docker.sock -/var/run/docker.sock -/root -/home" \
    -p IPAddressDeny="localhost link-local multicast 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 100.64.0.0/10 fc00::/7" \
    -p IPAddressAllow="127.0.0.53 127.0.0.54" \
    -p MemoryMax=6G -p TasksMax=4096 -p RuntimeMaxSec=7200 \
    "${SANDBOX_ENV[@]}" "$@"
}
SANDBOX_ENV=()

case "${1:-}" in
  --update-runner) update_runner; exit ;;
  --sandbox)
    shift
    name=test-$$
    for var in ${KASRA_SANDBOX_PASS:-}; do SANDBOX_ENV+=(--setenv="$var=${!var}"); done
    status=0; sandbox "$name" "$@" || status=$?
    rm -rf "/var/lib/private/kasra-jobs/$name"
    exit "$status" ;;
  "") ;;
  *) log "unknown option $1"; exit 2 ;;
esac

last_update=0
while true; do
  if [ ! -s "$TOKEN_FILE" ]; then log "no GitHub token in $TOKEN_FILE (run install-runner.sh)"; sleep 300; continue; fi
  # One runner at a time: wait while a job sandbox (e.g. from before a restart) is still running.
  while systemctl list-units --plain --no-legend --state=active 'kasra-job-*' | grep -q .; do sleep 15; done
  if [ $((SECONDS - last_update)) -ge 86400 ] || [ $last_update = 0 ]; then
    update_runner || log "runner update failed; keeping the installed version"
    last_update=$SECONDS
  fi
  name=kasra-prod-$(date +%s)
  body=$(jq -nc --arg n "$name" '{name: $n, runner_group_id: 1, labels: ["kasra-prod"], work_folder: "_work"}')
  if ! jit=$(api POST "/repos/$REPO/actions/runners/generate-jitconfig" "$body" | jq -er .encoded_jit_config); then
    log "cannot register a runner: is the token in $TOKEN_FILE expired or missing the Administration permission?"
    sleep 120
    continue
  fi
  log "runner $name is waiting for a job"
  SANDBOX_ENV=(--setenv="KASRA_JIT=$jit")
  status=0
  sandbox "$name" /bin/sh -c 'cp -a /opt/actions-runner/. "$HOME"/ && cd "$HOME" && exec ./run.sh --jitconfig "$KASRA_JIT"' || status=$?
  log "runner $name finished (exit $status)"
  rm -rf "/var/lib/private/kasra-jobs/$name"
  sleep 2
done
