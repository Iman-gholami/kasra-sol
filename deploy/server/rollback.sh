#!/usr/bin/env bash
# Returns production to an earlier release that is still on the server (default: the previous one).
# The database is NOT rolled back: releases must keep working with migrations added after them
# (migrations are additive). To undo data changes as well, use restore.sh with a pre-deploy backup.
# Usage: rollback.sh [40-character commit]
source "$(dirname "$0")/lib.sh"
require_root
target=${1:-$(env_get KASRA_PREVIOUS_RELEASE)}
current=$(env_get KASRA_RELEASE)
valid_release "$target" || die "no previous release recorded; pass the commit to return to"
[ "$target" != "$current" ] || die "$target is already the running release"
[ -d "$KASRA_DIR/releases/$target" ] || die "release $target is not on this server; available: $(ls -1t "$KASRA_DIR/releases" | tr '\n' ' ')"
take_lock

log "Rolling back from ${current:-none} to $target"
if switch_release "$target" && verify_release "$target"; then
  env_set KASRA_PREVIOUS_RELEASE "$current"
  record "rolled back from ${current:-none} to $target"
  log "Release $target is live"
  exit 0
fi
record "FAILED rollback from ${current:-none} to $target"
python3 "$KASRA_DIR/bin/logfilter.py" --since 10m --all --limit 25 || true
die "rollback to $target did not come up healthy"
