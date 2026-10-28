#!/usr/bin/env bash
# One-time setup of the GitHub Actions runner that deploys Kasra. The server (an Iranian data center)
# accepts no connections from abroad, so instead of GitHub connecting in, this runner on the server
# connects out to GitHub and picks up approved production jobs.
#
# Run as root on the server, from a checkout of the repository:
#   apt-get install -y git && git clone --depth 1 https://github.com/Iman-gholami/kasra-sol.git /root/kasra-sol
#   bash /root/kasra-sol/deploy/server/install-runner.sh
# It asks for a registration token (GitHub: Settings > Actions > Runners > New self-hosted runner; it is
# the value after --token, valid for one hour) and prints DEPLOY_TOKEN once, for the production
# environment's secrets.
#
# Security model: the runner runs as the unprivileged user github-runner (no Docker access, no sudo)
# except for /usr/local/sbin/kasra-gate, which refuses any call without DEPLOY_TOKEN. Re-running is safe:
# the token is kept unless --rotate-token is given. --test installs everything but does not register
# the runner or start its service (used by deploy/test/deploy-test.sh on a disposable machine); with
# --offline it also skips the network checks, packages and the runner download.
set -euo pipefail
umask 022
REPO=Iman-gholami/kasra-sol
RUNNER_USER=github-runner
RUNNER_DIR=/opt/actions-runner
HERE=$(cd "$(dirname "$0")" && pwd)
log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }

test_mode=false; rotate=false; offline=false
for arg in "$@"; do
  case "$arg" in
    --test) test_mode=true ;;
    --offline) offline=true ;;
    --rotate-token) rotate=true ;;
    *) die "unknown option $arg" ;;
  esac
done
[ "$offline" = false ] || [ "$test_mode" = true ] || die "--offline is only for --test runs"
[ "$(id -u)" = 0 ] || die "run as root"
. /etc/os-release
case "$ID" in ubuntu|debian) ;; *) die "unsupported OS $PRETTY_NAME" ;; esac
[ -f "$HERE/kasra-gate" ] || die "run this from a checkout of the repository (deploy/server/kasra-gate is missing)"

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

  log "Installing packages the runner needs"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -q
  apt-get install -y -q --no-install-recommends ca-certificates curl jq tar libkrb5-3 zlib1g
  # Ubuntu 26.04 ships sudo-rs as sudo; only install one where none exists.
  command -v sudo >/dev/null 2>&1 || apt-get install -y -q sudo
  icu=$(apt-cache search --names-only '^libicu[0-9]+$' | cut -d' ' -f1 | sort -V | tail -n 1)
  [ -n "$icu" ] && apt-get install -y -q --no-install-recommends "$icu"
  apt-get install -y -q liblttng-ust1t64 2>/dev/null || apt-get install -y -q liblttng-ust1 2>/dev/null || true
  apt-get install -y -q libssl3t64 2>/dev/null || apt-get install -y -q libssl3 2>/dev/null || true
fi

if ! id "$RUNNER_USER" >/dev/null 2>&1; then
  log "Creating the unprivileged user $RUNNER_USER"
  useradd --system --create-home --home-dir /home/$RUNNER_USER --shell /usr/sbin/nologin "$RUNNER_USER"
fi
id -nG "$RUNNER_USER" | grep -qw docker && die "$RUNNER_USER must not be in the docker group"

if [ "$offline" = false ] && [ ! -x "$RUNNER_DIR/config.sh" ]; then
  log "Downloading the GitHub Actions runner"
  auth=(); [ -n "${GITHUB_API_TOKEN:-}" ] && auth=(-H "Authorization: Bearer $GITHUB_API_TOKEN")
  release=$(curl -fsS "${auth[@]}" https://api.github.com/repos/actions/runner/releases/latest)
  version=$(jq -r .tag_name <<<"$release" | sed 's/^v//')
  arch=x64; [ "$(uname -m)" = aarch64 ] && arch=arm64
  name=actions-runner-linux-$arch-$version.tar.gz
  url=$(jq -r --arg n "$name" '.assets[] | select(.name == $n) | .browser_download_url' <<<"$release")
  # The checksum comes from the release itself: the asset digest, or the SHA-256 list in its notes.
  sum=$(jq -r --arg n "$name" '.assets[] | select(.name == $n) | .digest // empty' <<<"$release" | sed 's/^sha256://')
  [ -n "$sum" ] || sum=$(jq -r .body <<<"$release" | sed -nE "s/.*BEGIN SHA linux-$arch -->([0-9a-f]{64})<.*/\1/p" | head -n 1)
  [[ $url == https://* && $sum =~ ^[0-9a-f]{64}$ ]] || die "could not find runner $version for linux-$arch and its checksum"
  tmp=$(mktemp)
  curl -fsSL --retry 3 -o "$tmp" "$url"
  echo "$sum  $tmp" | sha256sum -c --quiet || die "runner download does not match its published SHA-256"
  install -d -o "$RUNNER_USER" -g "$RUNNER_USER" -m 0750 "$RUNNER_DIR"
  tar -xzf "$tmp" -C "$RUNNER_DIR"
  rm -f "$tmp"
  chown -R "$RUNNER_USER:$RUNNER_USER" "$RUNNER_DIR"
  log "Runner $version installed in $RUNNER_DIR"
fi

log "Installing kasra-gate and its sudo rule"
install -d -m 0700 /etc/kasra
install -m 0755 "$HERE/kasra-gate" /usr/local/sbin/kasra-gate.new
mv /usr/local/sbin/kasra-gate.new /usr/local/sbin/kasra-gate
rule=/etc/sudoers.d/kasra-gate
printf '%s\n' "# GitHub Actions runner: only the token-checking gate, nothing else." \
  "$RUNNER_USER ALL=(root) NOPASSWD: /usr/local/sbin/kasra-gate" > "$rule.new"
chmod 0440 "$rule.new"
if command -v visudo >/dev/null 2>&1; then visudo -cf "$rule.new" >/dev/null || die "sudo rule rejected by visudo"; fi
mv "$rule.new" "$rule"

new_token=""
if [ ! -f /etc/kasra/gate.sha256 ] || [ "$rotate" = true ]; then
  if [ "$test_mode" = true ] && [ -n "${KASRA_TEST_TOKEN:-}" ]; then new_token=$KASRA_TEST_TOKEN; else new_token=$(openssl rand -hex 32); fi
  printf '%s' "$new_token" | sha256sum | cut -d' ' -f1 > /etc/kasra/gate.sha256
  chmod 600 /etc/kasra/gate.sha256
fi

# The SSH key from the first setup attempt is not used any more: GitHub never connects in.
if [ -f /root/.ssh/authorized_keys ] && grep -q 'kasra-github-deploy' /root/.ssh/authorized_keys; then
  sed -i '/kasra-github-deploy/d' /root/.ssh/authorized_keys
  log "Removed the unused kasra-github-deploy SSH key from /root/.ssh/authorized_keys"
fi

if [ "$test_mode" = true ]; then
  log "Test mode: runner not registered"
else
  svc=$(ls /etc/systemd/system/actions.runner.*.service 2>/dev/null | head -n 1 || true)
  if [ -z "$svc" ]; then
    read -rsp "Runner registration token (Settings > Actions > Runners > New self-hosted runner): " reg </dev/tty
    echo
    [ -n "$reg" ] || die "no registration token given"
    (cd "$RUNNER_DIR" && runuser -u "$RUNNER_USER" -- ./config.sh --unattended --replace \
      --url "https://github.com/$REPO" --token "$reg" --name kasra-prod --labels kasra-prod --work _work)
    (cd "$RUNNER_DIR" && ./svc.sh install "$RUNNER_USER" && ./svc.sh start)
  else
    log "Runner service already installed: $(basename "$svc")"
    systemctl restart "$(basename "$svc")"
  fi
  sleep 5
  systemctl is-active --quiet "$(basename "$(ls /etc/systemd/system/actions.runner.*.service | head -n 1)")" \
    && log "Runner service is running; GitHub shows it as 'kasra-prod' (Idle) under Settings > Actions > Runners."
fi

if [ -n "$new_token" ] && [ "$test_mode" != true ]; then
  cat <<EOF

================================================================================================
 DEPLOY_TOKEN (shown only now). In GitHub open Settings > Environments > production >
 Environment secrets > Add environment secret, name DEPLOY_TOKEN, and paste this value:

   $new_token

 Then clear this terminal (clear). Lost it? Run this script again with --rotate-token.
================================================================================================
EOF
fi
