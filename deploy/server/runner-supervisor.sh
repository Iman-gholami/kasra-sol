#!/usr/bin/env bash
# Keeps one GitHub Actions runner waiting for production jobs and runs every job in a fresh, throwaway
# sandbox, so no job (approved or not) can leave anything behind for the next one:
#   - a just-in-time runner, registered for a single job and gone afterwards;
#   - a transient systemd unit as the unprivileged user kasra-job, with its own copy of the root-owned
#     runner in a job folder that is deleted afterwards;
#   - no access to /home, /root, /opt/kasra, /etc/kasra, backups or Docker, a read-only system, and no
#     connections to localhost, private or Docker networks (only the internet and the gate socket);
#   - the only way to root is /run/kasra-gate.sock, where kasra-gate demands DEPLOY_TOKEN, which only jobs
#     approved in the protected "production" GitHub environment receive.
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
JOBS=/var/lib/kasra-jobs
log() { printf '%s\n' "$*"; }

# The job user. Not DynamicUser=: that forces RestrictSUIDSGID=, whose seccomp filter fails openat2 with
# ENOSYS, and Ubuntu 26.04's tar (which the runner uses to unpack actions) does not fall back.
ensure_job_user() {
  getent group kasra-gate >/dev/null || groupadd --system kasra-gate
  id -u kasra-job >/dev/null 2>&1 || useradd --system --user-group --no-create-home \
    --home-dir /nonexistent --shell /usr/sbin/nologin kasra-job
  # Readable: the runner refuses to start unless every directory above its folder can be listed. The job
  # folders themselves are 0700.
  install -d -m 0755 -o root -g root "$JOBS"
}

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

# Runs a command in the job sandbox as kasra-job, in a fresh job folder; returns its exit status.
# Nothing outlives it: the system is read-only, /tmp and /dev are private, the user's IPC objects are
# removed and its processes killed when the unit ends, and the caller deletes the job folder.
sandbox() {
  local name=$1; shift
  rm -rf "${JOBS:?}/$name"
  systemd-run --wait --collect --quiet --unit="kasra-job-$name" --service-type=exec \
    -p User=kasra-job -p Group=kasra-job -p SupplementaryGroups=kasra-gate \
    -p StateDirectory="kasra-jobs/$name" -p StateDirectoryMode=0700 \
    -p WorkingDirectory="$JOBS/$name" -p ExecPaths="$JOBS/$name" \
    -p Environment="HOME=$JOBS/$name" \
    -p ProtectSystem=strict -p ProtectHome=yes -p PrivateTmp=yes -p PrivateDevices=yes -p RemoveIPC=yes \
    -p NoNewPrivileges=yes -p LockPersonality=yes -p RestrictRealtime=yes \
    -p ProtectKernelTunables=yes -p ProtectKernelModules=yes -p ProtectControlGroups=yes -p ProtectClock=yes \
    -p InaccessiblePaths="-/opt/kasra -/etc/kasra -/var/backups/kasra -/var/lib/docker -/run/docker.sock -/var/run/docker.sock -/root -/home" \
    -p IPAddressDeny="127.0.0.0/8 ::1/128 169.254.0.0/16 fe80::/10 224.0.0.0/4 ff00::/8 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 100.64.0.0/10 fc00::/7" \
    -p IPAddressAllow="127.0.0.53 127.0.0.54" \
    -p MemoryMax=6G -p TasksMax=4096 -p RuntimeMaxSec=7200 \
    "${SANDBOX_ARGS[@]}" "$@"
}
SANDBOX_ARGS=()

case "${1:-}" in
  --update-runner) update_runner; exit ;;
  --sandbox)
    shift
    ensure_job_user
    name=test-$$
    # --pipe: the command's output and exit status come back to the caller (the runner's go to the journal).
    SANDBOX_ARGS=(--pipe)
    for var in ${KASRA_SANDBOX_PASS:-}; do SANDBOX_ARGS+=(--setenv="$var=${!var:-}"); done
    status=0; sandbox "$name" "$@" || status=$?
    rm -rf "${JOBS:?}/$name"
    exit "$status" ;;
  "") ;;
  *) log "unknown option $1"; exit 2 ;;
esac

ensure_job_user
last_update=0
failures=0
while true; do
  if [ ! -s "$TOKEN_FILE" ]; then log "no GitHub token in $TOKEN_FILE (run install-runner.sh)"; sleep 300; continue; fi
  # One runner at a time: wait while a job sandbox (e.g. from before a restart) is still running.
  while systemctl list-units --plain --no-legend --state=active 'kasra-job-*' | grep -q .; do sleep 15; done
  # No job runs now: remove every job folder, including one a restarted supervisor never cleaned up, so
  # the next job (the same user) cannot read what an earlier one left.
  find "$JOBS" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true
  if [ $((SECONDS - last_update)) -ge 86400 ] || [ $last_update = 0 ]; then
    update_runner || log "runner update failed; keeping the installed version"
    last_update=$SECONDS
  fi
  name=kasra-prod-$(date +%s)
  # A just-in-time runner gets exactly these labels (no automatic self-hosted/Linux/X64), and the
  # production jobs ask for [self-hosted, kasra-prod].
  arch=X64; [ "$(uname -m)" = aarch64 ] && arch=ARM64
  body=$(jq -nc --arg n "$name" --arg a "$arch" \
    '{name: $n, runner_group_id: 1, labels: ["self-hosted", "Linux", $a, "kasra-prod"], work_folder: "_work"}')
  if ! registration=$(api POST "/repos/$REPO/actions/runners/generate-jitconfig" "$body") \
      || ! jit=$(jq -er .encoded_jit_config <<<"$registration"); then
    log "cannot register a runner: is the token in $TOKEN_FILE expired or missing the Administration permission?"
    sleep 120
    continue
  fi
  runner_id=$(jq -r '.runner.id // empty' <<<"$registration")
  log "runner $name starts (journalctl -u kasra-job-$name shows it)"
  SANDBOX_ARGS=(--setenv="KASRA_JIT=$jit")
  status=0
  started=$SECONDS
  sandbox "$name" /bin/sh -c 'cp -a /opt/actions-runner/. "$HOME"/ && cd "$HOME" && exec ./run.sh --jitconfig "$KASRA_JIT"' || status=$?
  log "runner $name finished (exit $status)"
  rm -rf "${JOBS:?}/$name"
  # A runner that took a job is removed by GitHub; one that never connected would stay listed as offline.
  [ -n "$runner_id" ] && api DELETE "/repos/$REPO/actions/runners/$runner_id" >/dev/null 2>&1 || true
  # The runner exits 0 on some start-up errors too, so judge by whether it took a job.
  if [ $((SECONDS - started)) -lt 60 ] && ! journalctl -u "kasra-job-$name" -q --no-pager | grep -q 'Running job:'; then
    # Failing right away is not going to fix itself in seconds: back off up to 15 minutes.
    failures=$((failures + 1))
    delay=$((30 * (1 << (failures < 5 ? failures : 5))))
    [ "$delay" -gt 900 ] && delay=900
    log "runner $name failed at start ($failures in a row); next attempt in $((delay / 60)) min $((delay % 60)) s"
    sleep "$delay"
  else
    failures=0
    sleep 2
  fi
done
