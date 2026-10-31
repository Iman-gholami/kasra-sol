#!/usr/bin/env bash
# Restores the database from a backup in /var/backups/kasra. DESTRUCTIVE: replaces the current data,
# so it takes a safety backup first and only runs through the ops workflow with a typed confirmation.
# Media is restored additively (files are added or replaced, none are deleted) into the media volume, and storage-init
# then copies the restored photos the object storage lacks into it.
# Usage: restore.sh <db-TIMESTAMP-LABEL.dump> [media-TIMESTAMP-LABEL.tar.gz]
source "$(dirname "$0")/lib.sh"
require_root
dump=${1:-}; media=${2:-}
[[ $dump =~ ^db-[0-9]{8}T[0-9]{6}Z-[a-z0-9-]+\.dump$ ]] && [ -f "$BACKUP_DIR/$dump" ] \
  || die "backup '$dump' not found; available: $(cd "$BACKUP_DIR" && ls -1t db-*.dump 2>/dev/null | head -n 10 | tr '\n' ' ')"
if [ -n "$media" ]; then
  [[ $media =~ ^media-[0-9]{8}T[0-9]{6}Z-[a-z0-9-]+\.tar\.gz$ ]] && [ -f "$BACKUP_DIR/$media" ] || die "media backup '$media' not found"
fi
[ "$(service_state postgres)" = healthy ] || die "PostgreSQL is not running"
take_lock

log "Safety backup of the current database"
"$KASRA_DIR/bin/backup.sh" pre-restore
user=$(env_get POSTGRES_USER); db=$(env_get POSTGRES_DB)
log "Stopping the storefront and API"
compose stop frontend backend
log "Restoring $dump"
if ! compose exec -T postgres pg_restore -U "${user:-kasra}" -d "${db:-kasra}" --clean --if-exists --no-owner \
    --single-transaction < "$BACKUP_DIR/$dump"; then
  log "Restore failed; the database was left unchanged (single transaction). Starting the services again."
  compose up -d
  die "restore of $dump failed"
fi
if [ -n "$media" ]; then
  volume=$(docker volume inspect -f '{{.Mountpoint}}' kasra_media_data)
  tar -C "$volume" -xzf "$BACKUP_DIR/$media"
  log "Media files from $media restored"
fi
compose up -d
if [ -n "$media" ] && compose config --services | grep -qx storage-init; then
  log "Copying restored photos into the object storage"
  compose up -d --force-recreate storage-init
  [ "$(docker wait "$(compose ps -aq storage-init)")" = 0 ] || log "WARNING: storage-init failed; photos are served from the media volume meanwhile"
fi
release=$(env_get KASRA_RELEASE)
verify_release "$release" || die "services are unhealthy after the restore"
record "restored database from $dump${media:+ and media from $media}"
log "Restore complete"
