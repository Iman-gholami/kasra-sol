#!/usr/bin/env bash
# Switches Nginx from the temporary self-signed IP site to the real domain with a Let's Encrypt
# certificate (renewed automatically by the certbot timer). Run once DNS points at this server.
# Usage: DOMAIN=shop.example EMAIL=you@example.com WWW=true SKIP_DNS_CHECK=false enable-domain.sh
#   WWW=true also certifies www.DOMAIN and redirects it to DOMAIN.
#   SKIP_DNS_CHECK=true when a CDN (e.g. ParsPack CDN) answers for the domain instead of this server.
source "$(dirname "$0")/lib.sh"
SOURCE=$(cd "$(dirname "$0")/.." && pwd)
require_root
domain=$(printf '%s' "${DOMAIN:-}" | tr 'A-Z' 'a-z')
email=${EMAIL:-}
www=${WWW:-false}
[[ $domain =~ ^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$ ]] || die "DOMAIN must be a host name such as shop.example.com"
[ -z "$email" ] || [[ $email =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]] || die "EMAIL is not an e-mail address"
names=("$domain"); [ "$www" = true ] && names+=("www.$domain")

server_ip=$(openssl x509 -in /etc/nginx/kasra/selfsigned.crt -noout -subject | sed -nE 's/.*CN ?= ?([0-9.]+).*/\1/p')
if [ "${SKIP_DNS_CHECK:-false}" != true ]; then
  for name in "${names[@]}"; do
    addresses=$(getent ahostsv4 "$name" | awk '{print $1}' | sort -u | tr '\n' ' ')
    [[ " $addresses " == *" $server_ip "* ]] || die "$name resolves to '${addresses:-nothing}', not this server ($server_ip). Fix DNS or wait for it to propagate."
  done
fi

command -v certbot >/dev/null 2>&1 || { apt-get update -q; DEBIAN_FRONTEND=noninteractive apt-get install -y -q certbot; }
account=(--register-unsafely-without-email); [ -n "$email" ] && account=(--email "$email")
domains=(); for name in "${names[@]}"; do domains+=(-d "$name"); done
log "Requesting a certificate for ${names[*]}"
# Challenge files must be readable by Nginx's worker user, whatever lib.sh's umask says.
(umask 022 && certbot certonly --webroot -w /var/www/certbot --cert-name kasra "${domains[@]}" "${account[@]}" \
  --agree-tos --non-interactive --keep-until-expiring --deploy-hook 'systemctl reload nginx')

site=/etc/nginx/sites-available/kasra
cp "$site" "$site.before-domain"
www_block=""
[ "$www" = true ] && www_block=$(sed "s/__DOMAIN__/$domain/g; s/__CERT_NAME__/kasra/g" "$SOURCE/nginx/kasra-www.conf")
python3 - "$SOURCE/nginx/kasra-domain.conf" "$site" "$domain" "$www_block" <<'PY'
import sys
template, target, domain, www_block = sys.argv[1:]
text = open(template).read().replace("__WWW_BLOCK__", www_block)
open(target, "w").write(text.replace("__DOMAIN__", domain).replace("__CERT_NAME__", "kasra"))
PY
[ -f /proc/net/if_inet6 ] || sed -i '/listen \[::\]/d' "$site"
nginx_http2_compat "$site"
if ! nginx -t; then
  mv "$site.before-domain" "$site"
  die "the new Nginx configuration was rejected; the IP site was restored"
fi
systemctl reload nginx
env_set KASRA_DOMAIN "$domain"
env_set NEXT_PUBLIC_SITE_URL "https://$domain"
record "domain $domain enabled (www: $www)"
curl -fsS -o /dev/null --max-time 20 --resolve "$domain:443:127.0.0.1" "https://$domain/api/health" \
  && log "https://$domain answers with a valid certificate"
certbot renew --dry-run --cert-name kasra >/dev/null && log "Certificate renewal dry run passed"
log "Next: set the repository variable PRODUCTION_SITE_URL to https://$domain and run a release, so the"
log "storefront is rebuilt with its canonical address."
