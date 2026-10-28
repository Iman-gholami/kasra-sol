#!/usr/bin/env bash
# Deploys one release: loads its images, backs up the database, switches the containers, verifies them,
# and returns to the previous release automatically if the new one does not come up healthy.
# Run by .github/workflows/release.yml after the production approval, from the release's own copy of
# deploy/ (so script changes ship with the release), with the images in
# /opt/kasra/incoming/kasra-images-<commit>.tar.gz.   Usage: deploy.sh <40-character commit>
source "$(dirname "$0")/lib.sh"
SOURCE=$(cd "$(dirname "$0")/.." && pwd)
require_root
release=${1:-}
valid_release "$release" || die "usage: deploy.sh <commit sha>"
[ -f "$ENV_FILE" ] || die "the server is not provisioned yet (ops workflow, task provision)"
take_lock

bundle=$KASRA_DIR/incoming/kasra-images-$release.tar.gz
if [ -f "$bundle" ]; then
  log "Loading images"
  gunzip -c "$bundle" | docker load -q
  rm -f "$bundle"
fi
install -d -m 0700 "$KASRA_DIR/releases/$release"
install -m 0600 "$SOURCE/compose.production.yaml" "$KASRA_DIR/releases/$release/compose.yaml"
for image in $(KASRA_RELEASE=$release docker compose --project-directory "$KASRA_DIR" \
    -f "$KASRA_DIR/releases/$release/compose.yaml" config --images); do
  docker image inspect "$image" >/dev/null 2>&1 || die "image $image is missing on the server"
done
# Later operations (backup timer, rollback, status) use the newest scripts.
install -m 0700 "$SOURCE"/server/*.sh "$SOURCE"/server/*.py "$KASRA_DIR/bin/"

previous=$(env_get KASRA_RELEASE)
fallback=$previous
[ "$previous" = "$release" ] && fallback=$(env_get KASRA_PREVIOUS_RELEASE)
if [ -n "$previous" ] && [ "$(service_state postgres)" = healthy ]; then
  log "Backing up the database before the switch"
  "$KASRA_DIR/bin/backup.sh" "pre-deploy-${previous:0:12}"
fi

started=$(date -u +%Y-%m-%dT%H:%M:%SZ)
log "Switching to $release (previous: ${previous:-none})"
if switch_release "$release" && verify_release "$release"; then
  [ -n "$previous" ] && [ "$previous" != "$release" ] && env_set KASRA_PREVIOUS_RELEASE "$previous"
  record "deployed $release (previous ${previous:-none})"
  # Keep the five newest releases (compose files and images) for rollbacks.
  ls -1t "$KASRA_DIR/releases" | tail -n +6 | while read -r old; do rm -rf "${KASRA_DIR:?}/releases/$old"; done
  for repo in kasra-frontend kasra-backend; do
    docker image ls "$repo" --format '{{.Tag}}' | while read -r tag; do
      [ -d "$KASRA_DIR/releases/$tag" ] || docker image rm "$repo:$tag" >/dev/null 2>&1 || true
    done
  done
  docker image prune -f >/dev/null || true
  log "Release $release is live"
  exit 0
fi

log "Release $release failed its checks; recent warnings and errors:"
python3 "$KASRA_DIR/bin/logfilter.py" --since "$started" --all --limit 25 || true
if [ -n "$fallback" ] && [ "$fallback" != "$release" ]; then
  log "Rolling back to $fallback"
  if switch_release "$fallback" && verify_release "$fallback"; then
    record "FAILED $release; rolled back to $fallback"
    die "deployment failed and was rolled back to $fallback (database migrations of $release, if any, stay applied)"
  fi
  record "FAILED $release; rollback to $fallback also failed"
  die "deployment failed AND the rollback to $fallback is unhealthy: manual attention needed"
fi
record "FAILED $release (no earlier release to return to)"
die "the first deployment failed; there is no earlier release to return to"
