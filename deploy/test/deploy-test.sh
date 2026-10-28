#!/usr/bin/env bash
# End-to-end test of the server scripts on a DISPOSABLE machine (the GitHub runner in images.yml):
# provision, the runner side (gate socket, DEPLOY_TOKEN check, the job sandbox's isolation), a first deployment
# from a sandboxed job through the gate as the Release workflow does it, owner creation, a second release, rollback,
# a broken release that must roll itself back, backup and restore, and the sanitized status report.
# Never run it on the server.
# Usage: sudo KASRA_TEST_MACHINE=yes deploy/test/deploy-test.sh <commit>
#   (images kasra-frontend:<commit> and kasra-backend:<commit> must already be loaded)
#   SKIP_PROVISION=yes skips provision.sh where there is no systemd/apt (prepares /opt/kasra directly),
#   installs the runner side offline and stands in for the gate socket (no sandbox without systemd).
set -euo pipefail
release=${1:?usage: deploy-test.sh <commit>}
[ "${KASRA_TEST_MACHINE:-}" = yes ] || { echo "Refusing: this test replaces /opt/kasra. Set KASRA_TEST_MACHINE=yes on a disposable machine."; exit 1; }
DEPLOY=$(cd "$(dirname "$0")/.." && pwd)
REPO=$(dirname "$DEPLOY")
BIN=/opt/kasra/bin
source "$DEPLOY/server/lib.sh"

group() { if [ -n "${GITHUB_ACTIONS:-}" ]; then echo "::endgroup::"; echo "::group::$*"; else echo; echo "=== $*"; fi; }
fail() { echo "TEST FAILED: $*" >&2; exit 1; }
expect_env() { [ "$(env_get "$1")" = "$2" ] || fail "$1 is '$(env_get "$1")', expected '$2'"; }
fake_release() { printf '%s' "$1" | sha1sum | cut -c1-40; }
product_total() { curl -fsS 'http://127.0.0.1:4000/v1/products?limit=1' | node -e 'process.stdin.on("data",d=>console.log(JSON.parse(d).total))'; }
sql() { compose exec -T postgres psql -U kasra -d kasra -tAc "$1"; }

group "Provision"
if [ "${SKIP_PROVISION:-no}" = yes ]; then
  install -d -m 0700 "$KASRA_DIR" "$BIN" "$KASRA_DIR/releases" "$KASRA_DIR/incoming" "$BACKUP_DIR"
  install -m 0700 "$DEPLOY"/server/*.sh "$DEPLOY"/server/*.py "$BIN/"
  printf '%s\n' POSTGRES_USER=kasra POSTGRES_DB=kasra "POSTGRES_PASSWORD=$(openssl rand -hex 32)" \
    "ORDER_TOKEN_SECRET=$(openssl rand -hex 32)" "ADMIN_API_KEY=$(openssl rand -hex 32)" "REDIS_PASSWORD=$(openssl rand -hex 32)" \
    NEXT_PUBLIC_SITE_URL=https://127.0.0.1 SEED_DEMO_DATA=true KASRA_RELEASE= KASRA_PREVIOUS_RELEASE= > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
else
  SERVER_IP=127.0.0.1 SITE_URL=https://127.0.0.1 SEED_DEMO_DATA=true HARDEN=false bash "$DEPLOY/server/provision.sh"
  # Running it again must change nothing that matters (idempotent) and keep the generated secrets.
  secret=$(env_get ORDER_TOKEN_SECRET)
  SERVER_IP=127.0.0.1 SITE_URL=https://127.0.0.1 SEED_DEMO_DATA=true HARDEN=false bash "$DEPLOY/server/provision.sh" >/dev/null
  expect_env ORDER_TOKEN_SECRET "$secret"
  systemctl is-enabled --quiet kasra-backup.timer || fail "backup timer not enabled"
fi
for image in $(KASRA_RELEASE=x POSTGRES_PASSWORD=x ORDER_TOKEN_SECRET=x REDIS_PASSWORD=x NEXT_PUBLIC_SITE_URL=x \
    docker compose -f "$DEPLOY/compose.production.yaml" config --images | grep -v '^kasra-'); do
  docker image inspect "$image" >/dev/null 2>&1 || docker pull -q "$image"
done

group "Runner side: gate, DEPLOY_TOKEN and job sandbox"
token=$(openssl rand -hex 32)
offline=(); [ "${SKIP_PROVISION:-no}" = yes ] && offline=(--offline)
KASRA_TEST_TOKEN=$token bash "$DEPLOY/server/install-runner.sh" --test --rotate-token "${offline[@]}"
if [ -d /run/systemd/system ]; then
  systemctl is-active --quiet kasra-gate.socket || fail "kasra-gate.socket is not listening"
  # Exactly how a production job runs: user kasra-job in a throwaway runner sandbox.
  in_job() { KASRA_SANDBOX_PASS="DEPLOY_TOKEN REDIS_IP" /usr/local/sbin/kasra-runner-supervisor --sandbox "$@"; }
else
  python3 "$DEPLOY/test/fake-gate-socket.py" /run/kasra-gate.sock /usr/local/sbin/kasra-gate &
  fake_socket=$!
  trap 'kill $fake_socket 2>/dev/null' EXIT
  sleep 1
  in_job() { "$@"; }
fi
# The job's checkout and downloaded bundle, readable by the sandbox (its /tmp is private).
workspace=/srv/kasra-test-workspace
rm -rf "$workspace"
install -d -m 0755 "$workspace" "$workspace/bundle"
cp -r "$DEPLOY" "$workspace/deploy"
docker save "kasra-frontend:$release" "kasra-backend:$release" | gzip -1 > "$workspace/bundle/kasra-images-$release.tar.gz"
chmod -R a+rX "$workspace"
client=(python3 "$workspace/deploy/server/gate-client.py")
expect_refused() {
  local status=0
  DEPLOY_TOKEN=$1 in_job "${client[@]}" "${@:2}" >/dev/null 2>&1 || status=$?
  [ "$status" = 77 ] || fail "the gate did not refuse '${*:2}' with token '$1' (exit $status)"
}
expect_refused "" deploy "$release" "$workspace"
expect_refused "$(openssl rand -hex 32)" deploy "$release" "$workspace"
[ -z "$(DEPLOY_TOKEN='' in_job "${client[@]}" infra-missing "$workspace")" ] || fail "infra-missing reports images that are present"
echo "The gate refuses a job without DEPLOY_TOKEN (i.e. one that was not approved)"

group "First deployment (job -> gate, with DEPLOY_TOKEN)"
DEPLOY_TOKEN=$token in_job "${client[@]}" deploy "$release" "$workspace"
expect_env KASRA_RELEASE "$release"
if [ -d /run/systemd/system ]; then
  cat > "$workspace/probe.sh" <<'PROBE'
#!/usr/bin/env bash
bad() { echo "SANDBOX ESCAPE: $*"; exit 1; }
[ -r /opt/kasra/.env ] && bad "reads /opt/kasra/.env"
ls /root >/dev/null 2>&1 && bad "lists /root"
[ -r /etc/kasra/deploy-token.sha256 ] && bad "reads the gate's token hash"
docker ps >/dev/null 2>&1 && bad "uses Docker"
curl -s -m 5 -o /dev/null http://127.0.0.1:4000/health/ready && bad "reaches the API on localhost"
timeout 5 bash -c "exec 3<>/dev/tcp/$REDIS_IP/6379" 2>/dev/null && bad "reaches Redis on the Docker network"
touch /usr/local/bin/kasra-probe 2>/dev/null && bad "writes to the system"
# The runner runs from its copy in the job folder, which newer systemd mounts noexec unless ExecPaths= says otherwise.
cp /usr/bin/true "$HOME/kasra-exec-probe" && "$HOME/kasra-exec-probe" || bad "cannot run programs from its job folder (the runner must)"
ls "$(dirname "$HOME")" >/dev/null || bad "cannot list the folder above its job folder (the runner refuses to start)"
# The runner unpacks actions with the system tar (on Ubuntu 26.04 it needs openat2, which DynamicUser= breaks).
mkdir -p "$HOME/t/a/b" && echo x > "$HOME/t/a/b/f" && tar -czf "$HOME/t.tgz" -C "$HOME/t" a && mkdir "$HOME/u" \
  && tar -xzf "$HOME/t.tgz" -C "$HOME/u" && [ -f "$HOME/u/a/b/f" ] || bad "cannot unpack an archive in its job folder (the runner must)"
curl -fsS -m 15 -o /dev/null https://github.com || bad "cannot reach GitHub (the runner needs it)"
DEPLOY_TOKEN='' python3 "$(dirname "$0")/deploy/server/gate-client.py" status 5m >/dev/null || bad "status through the gate failed"
echo "sandbox isolation holds"
PROBE
  chmod 755 "$workspace/probe.sh"
  REDIS_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$(container_id redis)")
  export REDIS_IP
  in_job bash "$workspace/probe.sh" || fail "the job sandbox is not isolated"
fi
[ "$(product_total)" = 36 ] || fail "demo catalog not seeded"
(cd "$REPO/backend" && node tests/smoke.mjs) || fail "API smoke test"
for path in / /shop /product/manto-01 /category/manto /cart /admin/login; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3000$path")
  [ "$code" = 200 ] || fail "storefront $path answered $code"
done
docker exec "$(container_id frontend)" sh -c 'touch /app/probe' 2>/dev/null && fail "storefront filesystem is writable"
echo "Storefront pages answer and its filesystem is read-only"

group "Owner account"
printf '%s' 'test-owner-password-123' | "$BIN/create-owner.sh" testowner
if printf '%s' 'another-password-1234' | "$BIN/create-owner.sh" second 2>/dev/null; then fail "a second owner was created"; fi

group "Second release keeps the data"
second=$(fake_release "second-$release")
docker tag "kasra-frontend:$release" "kasra-frontend:$second"
docker tag "kasra-backend:$release" "kasra-backend:$second"
orders=$(sql 'SELECT count(*) FROM orders')
bash "$DEPLOY/server/deploy.sh" "$second"
expect_env KASRA_RELEASE "$second"
expect_env KASRA_PREVIOUS_RELEASE "$release"
ls "$BACKUP_DIR"/db-*-pre-deploy-*.dump >/dev/null || fail "no pre-deploy backup"
[ "$(product_total)" = 36 ] || fail "catalog changed across releases"
[ "$(sql 'SELECT count(*) FROM orders')" = "$orders" ] || fail "orders lost across releases"

group "Rollback"
"$BIN/rollback.sh"
expect_env KASRA_RELEASE "$release"
expect_env KASRA_PREVIOUS_RELEASE "$second"

group "Retention keeps the release we came from"
# The running release is now the oldest folder; with room for only two, pruning must still keep it.
third=$(fake_release "third-$release")
docker tag "kasra-frontend:$release" "kasra-frontend:$third"
docker tag "kasra-backend:$release" "kasra-backend:$third"
KEEP_RELEASES=2 bash "$DEPLOY/server/deploy.sh" "$third"
expect_env KASRA_PREVIOUS_RELEASE "$release"
[ -d "$KASRA_DIR/releases/$release" ] && docker image inspect "kasra-backend:$release" >/dev/null \
  || fail "the previous release was pruned"
"$BIN/rollback.sh"
expect_env KASRA_RELEASE "$release"

group "Broken release rolls itself back"
broken=$(fake_release "broken-$release")
printf 'FROM kasra-backend:%s\nCMD ["sh", "-c", "echo broken release >&2; exit 1"]\n' "$release" | docker build -q -t "kasra-backend:$broken" - >/dev/null
docker tag "kasra-frontend:$release" "kasra-frontend:$broken"
if HEALTH_TIMEOUT=90 bash "$DEPLOY/server/deploy.sh" "$broken"; then fail "the broken release was accepted"; fi
expect_env KASRA_RELEASE "$release"
smoke_test || fail "site unhealthy after the automatic rollback"
grep -q "FAILED $broken; rolled back to $release" "$KASRA_DIR/deploy-history.log" || fail "rollback not recorded"

group "Backup and restore"
"$BIN/backup.sh" manual
dump=$(basename "$(ls -1t "$BACKUP_DIR"/db-*-manual.dump | head -n 1)")
before=$(sql 'SELECT count(*) FROM orders')
sql "UPDATE product_variants SET stock = stock + 5" >/dev/null
changed=$(sql 'SELECT sum(stock) FROM product_variants')
"$BIN/restore.sh" "$dump"
[ "$(sql 'SELECT count(*) FROM orders')" = "$before" ] || fail "orders differ after restore"
[ "$(sql 'SELECT sum(stock) FROM product_variants')" != "$changed" ] || fail "restore did not undo the stock change"
ls "$BACKUP_DIR"/db-*-pre-restore.dump >/dev/null || fail "no safety backup before the restore"

group "Status report"
"$BIN/status.sh" 30m
if [ -n "${GITHUB_ACTIONS:-}" ]; then echo "::endgroup::"; fi
echo "All deployment tests passed."
