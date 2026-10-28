#!/usr/bin/env bash
# Read-only server report: operating system, resources, what is already installed or listening, and which
# outside services this network can reach. Changes nothing. Output lands in a public Actions log, so it
# prints no secrets (the server address is masked there because it is a GitHub secret).
set -uo pipefail

section() { printf '\n== %s\n' "$1"; }

section "System"
. /etc/os-release 2>/dev/null && echo "OS: ${PRETTY_NAME:-unknown} (id=${ID:-?} version=${VERSION_ID:-?})"
echo "Kernel: $(uname -r)  Arch: $(uname -m)  Virtualization: $(systemd-detect-virt 2>/dev/null || echo unknown)"
echo "Uptime: $(uptime -p 2>/dev/null)  Timezone: $(timedatectl show -p Timezone --value 2>/dev/null)  NTP synced: $(timedatectl show -p NTPSynchronized --value 2>/dev/null)"
echo "CPUs: $(nproc)  Memory: $(free -h | awk '/^Mem:/{print $2" total, "$7" available"}')  Swap: $(free -h | awk '/^Swap:/{print $2}')"
[ -f /var/run/reboot-required ] && echo "A reboot is pending (package updates)."

section "Disks"
df -hT -x tmpfs -x devtmpfs -x overlay 2>/dev/null

section "Listening TCP ports (process)"
ss -tlnpH 2>/dev/null | awk '{print $4"\t"$6}' | sed -E 's/users:\(\("([^"]+)".*/\1/' | sort -u

section "Software"
for tool in docker nginx apache2 caddy psql mysql redis-server certbot ufw fail2ban-client node python3 zstd; do
  if command -v "$tool" >/dev/null 2>&1; then printf '%-15s %s\n' "$tool" "$("$tool" --version 2>&1 | head -n 1)"; fi
done
if command -v docker >/dev/null 2>&1; then
  echo "docker compose: $(docker compose version 2>&1 | head -n 1)"
  echo "containers: $(docker ps -aq 2>/dev/null | wc -l) (running $(docker ps -q 2>/dev/null | wc -l)), volumes: $(docker volume ls -q 2>/dev/null | wc -l)"
  docker ps -a --format '  {{.Names}}  {{.Image}}  {{.Status}}' 2>/dev/null | head -n 20
fi
for unit in nginx apache2 docker postgresql mysql unattended-upgrades fail2ban ufw; do
  state=$(systemctl is-active "$unit" 2>/dev/null); [ "$state" = inactive ] || [ -z "$state" ] || echo "service $unit: $state"
done

section "Existing Kasra installation"
if [ -d /opt/kasra ]; then
  ls -la /opt/kasra
  [ -f /opt/kasra/.env ] && echo "KASRA_RELEASE=$(sed -n 's/^KASRA_RELEASE=//p' /opt/kasra/.env)"
else
  echo "none (/opt/kasra does not exist)"
fi
ls /etc/nginx/sites-enabled 2>/dev/null | sed 's/^/nginx site enabled: /'

section "SSH and firewall"
sshd -T 2>/dev/null | grep -Ei '^(port|permitrootlogin|passwordauthentication|pubkeyauthentication|kbdinteractiveauthentication) ' | sort
echo "This session arrived on port: $(echo "${SSH_CONNECTION:-? ? ? ?}" | awk '{print $4}')"
command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | head -n 15
echo "iptables INPUT policy: $(iptables -S INPUT 2>/dev/null | head -n 1)"

section "Network"
echo "IPv6 enabled: $([ -f /proc/net/if_inet6 ] && echo yes || echo no)"
grep -rhoE '^(deb|URIs:)[^#]*https?://[^/ ]+' /etc/apt/sources.list /etc/apt/sources.list.d/ 2>/dev/null \
  | grep -oE 'https?://[^/ ]+' | sort -u | sed 's/^/apt mirror: /'
probe() { printf '%-34s %s\n' "$1" "$(curl -sS -o /dev/null -m 10 -w '%{http_code}' "$2" 2>&1 | head -c 80)"; }
probe "github.com" https://github.com/
probe "GitHub container registry" https://ghcr.io/v2/
probe "Docker Hub registry" https://registry-1.docker.io/v2/
probe "Docker apt repository" https://download.docker.com/linux/ubuntu/gpg
probe "npm registry" https://registry.npmjs.org/
probe "Let's Encrypt ACME" https://acme-v02.api.letsencrypt.org/directory
probe "Ubuntu archive" http://archive.ubuntu.com/ubuntu/
echo "(200/401/405 = reachable; 403 = refused, e.g. sanctions; 000 = no connection)"
