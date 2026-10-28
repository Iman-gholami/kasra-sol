#!/usr/bin/env bash
# Backs up the database (pg_dump custom format) and, for daily runs, the uploaded media volume into
# /var/backups/kasra, then prunes old files. Usage: backup.sh [daily|manual|pre-deploy-<release>]
source "$(dirname "$0")/lib.sh"
require_root
label=${1:-manual}
[[ $label =~ ^[a-z0-9-]+$ ]] || die "invalid backup label"
install -d -m 0700 "$BACKUP_DIR"
stamp=$(date -u +%Y%m%dT%H%M%SZ)

[ "$(service_state postgres)" = healthy ] || die "PostgreSQL is not running; nothing to back up"
user=$(env_get POSTGRES_USER); db=$(env_get POSTGRES_DB)
dump="$BACKUP_DIR/db-$stamp-$label.dump"
compose exec -T postgres pg_dump -U "${user:-kasra}" -d "${db:-kasra}" --format=custom --compress=6 > "$dump.partial"
mv "$dump.partial" "$dump"
log "Database backup: $dump ($(du -h "$dump" | cut -f1))"

if [ "$label" = daily ] || [ "$label" = manual ]; then
  media=$(docker volume inspect -f '{{.Mountpoint}}' kasra_media_data 2>/dev/null || true)
  if [ -n "$media" ] && [ -d "$media" ]; then
    tar -C "$media" -czf "$BACKUP_DIR/media-$stamp-$label.tar.gz.partial" .
    mv "$BACKUP_DIR/media-$stamp-$label.tar.gz.partial" "$BACKUP_DIR/media-$stamp-$label.tar.gz"
    log "Media backup: $BACKUP_DIR/media-$stamp-$label.tar.gz ($(du -h "$BACKUP_DIR/media-$stamp-$label.tar.gz" | cut -f1))"
  fi
fi

# Keep 14 daily, 10 pre-deploy and 10 manual backups of each kind.
prune() { ls -1t $1 2>/dev/null | tail -n +$(($2 + 1)) | xargs -r rm -f -- || true; }
prune "$BACKUP_DIR/db-*-daily.dump" 14
prune "$BACKUP_DIR/media-*-daily.tar.gz" 14
prune "$BACKUP_DIR/db-*-pre-deploy-*.dump" 10
prune "$BACKUP_DIR/db-*-manual.dump" 10
prune "$BACKUP_DIR/media-*-manual.tar.gz" 10
rm -f "$BACKUP_DIR"/*.partial
