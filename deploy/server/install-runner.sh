#!/usr/bin/env bash
# One-time setup of how GitHub deploys to this server. The server (an Iranian data center) accepts no
# connections from abroad, so a supervisor on the server fetches production jobs from GitHub instead and
# runs each one in a throwaway sandbox (runner-supervisor.sh); the only way from a job to root is
# kasra-gate, which demands the owner's one-time approval code from an authenticator app.
#
# Run as root on the server, from a copy of the repository (docs/DEPLOYMENT.md, step 3):
#   bash /root/kasra-sol/deploy/server/install-runner.sh
# It asks for (or reads KASRA_GITHUB_TOKEN) a fine-grained GitHub token for this repository with
# "Administration: Read and write" (to register a runner for each job) and "Contents: Read", and shows a
# QR code for the authenticator app. Re-running is safe. Options:
#   --token          replace the stored GitHub token (e.g. when it expires)
#   --rotate-totp    new authenticator secret (scan the new QR code)
#   --test [--offline]  for deploy/test/deploy-test.sh on a disposable machine: no token, no service start,
#                       secret from KASRA_TEST_TOTP_SECRET; --offline also skips packages and downloads
set -euo pipefail
umask 077
REPO=Iman-gholami/kasra-sol
HERE=$(cd "$(dirname "$0")" && pwd)
log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }

test_mode=false; offline=false; new_token=false; rotate_totp=false
for arg in "$@"; do
  case "$arg" in
    --test) test_mode=true ;;
    --offline) offline=true ;;
    --token) new_token=true ;;
    --rotate-totp) rotate_totp=true ;;
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
  apt-get install -y -q --no-install-recommends ca-certificates curl jq git tar python3 qrencode libkrb5-3 zlib1g
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

# Approval codes: a TOTP secret shared only with the owner's authenticator app.
if [ ! -s /etc/kasra/totp.secret ] || [ "$rotate_totp" = true ]; then
  if [ "$test_mode" = true ]; then
    secret=${KASRA_TEST_TOTP_SECRET:?KASRA_TEST_TOTP_SECRET is required with --test}
  else
    secret=$(python3 -c 'import base64,os; print(base64.b32encode(os.urandom(20)).decode())')
  fi
  printf '%s\n' "$secret" > /etc/kasra/totp.secret
  rm -f /etc/kasra/totp.last /etc/kasra/totp.failures
  if [ "$test_mode" = false ]; then
    uri="otpauth://totp/Kasra:production?secret=$secret&issuer=Kasra&digits=6&period=30"
    echo
    echo "Scan this QR code with an authenticator app (Google Authenticator, Microsoft Authenticator, ...):"
    command -v qrencode >/dev/null 2>&1 && qrencode -t ansiutf8 "$uri"
    echo "Or add it by hand: account 'Kasra production', key $secret (time-based)."
    echo
    for attempt in 1 2 3; do
      read -rp "Type the 6-digit code the app shows now: " typed </dev/tty
      if python3 - "$secret" "$typed" <<'PY'
import base64, hashlib, hmac, struct, sys, time
secret, typed = base64.b32decode(sys.argv[1]), sys.argv[2].strip()
def code(counter):
    digest = hmac.new(secret, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 15
    return "%06d" % ((struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF) % 1000000)
now = int(time.time() // 30)
sys.exit(0 if any(code(c) == typed for c in range(now - 2, now + 3)) else 1)
PY
      then log "Authenticator app set up correctly"; break; fi
      [ "$attempt" = 3 ] && die "the codes did not match; check the phone's clock and run again with --rotate-totp"
      echo "That code does not match; wait for the next one and try again."
    done
    clear 2>/dev/null || true
    log "Approval codes are ready (the QR code was cleared from the screen)"
  fi
fi
chmod 600 /etc/kasra/totp.secret

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
  systemctl enable kasra-runner.service >/dev/null
  systemctl restart kasra-runner.service
  for _ in $(seq 1 12); do
    journalctl -u kasra-runner.service --since -3min --no-pager | grep -q 'is waiting for a job' && break
    sleep 5
  done
  if journalctl -u kasra-runner.service --since -3min --no-pager | grep -q 'is waiting for a job'; then
    log "Done: GitHub lists a runner named kasra-prod-… (Idle) under Settings > Actions > Runners."
  else
    journalctl -u kasra-runner.service --since -3min --no-pager | tail -n 20
    die "the runner did not start; see the log above"
  fi
fi
