#!/usr/bin/env bash
# Production overview for the ops workflow: release, containers, disk, backups, certificates, and the
# sanitized warnings/errors of the last hours. Read-only. Usage: status.sh [log window, e.g. 30m or 6h]
source "$(dirname "$0")/lib.sh"
require_root
since=${1:-2h}

echo "Release: $(env_get KASRA_RELEASE) (previous: $(env_get KASRA_PREVIOUS_RELEASE))"
echo "Site URL: $(env_get NEXT_PUBLIC_SITE_URL)  domain: $(env_get KASRA_DOMAIN)  demo data: $(env_get SEED_DEMO_DATA)"
if [ -n "$(env_get KASRA_RELEASE)" ]; then
  compose ps -a --format 'table {{.Service}}\t{{.Image}}\t{{.Status}}'
  mapfile -t ids < <(compose ps -q)
  [ ${#ids[@]} -eq 0 ] || docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}' "${ids[@]}" || true
  smoke_test || true
fi
echo
echo "Recent deployments:"; tail -n 5 "$KASRA_DIR/deploy-history.log" 2>/dev/null || echo "  none"
echo "Releases kept for rollback: $(ls -1t "$KASRA_DIR/releases" 2>/dev/null | tr '\n' ' ')"
echo
df -h / | tail -n 1 | awk '{print "Disk /: "$3" used of "$2" ("$5")"}'
echo "Backups ($(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1) in $BACKUP_DIR), newest:"
ls -1t "$BACKUP_DIR" 2>/dev/null | head -n 4 | sed 's/^/  /'
systemctl list-timers kasra-backup.timer --no-pager 2>/dev/null | sed -n '2p' | awk '{print "Next backup: "$1" "$2" "$3}'  || true
for cert in /etc/letsencrypt/live/kasra/fullchain.pem /etc/nginx/kasra/selfsigned.crt; do
  [ -f "$cert" ] && echo "Certificate $cert expires $(openssl x509 -in "$cert" -noout -enddate | cut -d= -f2)"
done
echo "nginx: $(systemctl is-active nginx)  firewall: $(ufw status 2>/dev/null | head -n 1 || echo 'ufw not installed')"
[ -f /var/run/reboot-required ] && echo "The OS reports a pending reboot (not done automatically)."
echo
[ -n "$(env_get KASRA_RELEASE)" ] && python3 "$KASRA_DIR/bin/logfilter.py" --since "$since"
exit 0
