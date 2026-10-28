#!/usr/bin/env bash
# Creates the first back-office owner account. The password arrives on stdin (from a GitHub secret
# through SSH), is never written to disk or shown, and the API refuses to create a second owner.
# Usage: printf '%s' "$PASSWORD" | create-owner.sh <username>
source "$(dirname "$0")/lib.sh"
require_root
username=${1:-}
[[ $username =~ ^[a-z0-9][a-z0-9_.-]{2,63}$ ]] || die "username: 3-64 characters a-z 0-9 _ . - starting with a letter or digit"
password=$(cat)
[ ${#password} -ge 12 ] && [ ${#password} -le 256 ] || die "the password must be 12-256 characters"
[ "$(service_state backend)" = healthy ] || die "the API is not running; deploy a release first"
printf '%s' "$password" | compose exec -T backend node dist/admin/bootstrap.js "$username" /dev/stdin
record "owner account $username created"
