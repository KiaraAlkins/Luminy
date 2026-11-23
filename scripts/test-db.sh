#!/usr/bin/env bash
# Sobe um Postgres temporário, aplica as migrações e roda os testes de acesso.
set -euo pipefail
cd "$(dirname "$0")/.."
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DATA="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
RUN_AS=""
if [ "$(id -u)" = "0" ]; then RUN_AS="runuser -u postgres --"; chown postgres "$DATA"; fi
cleanup() { $RUN_AS "$PGBIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT
$RUN_AS "$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
$RUN_AS "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp -c listen_addresses=''" -w start >/dev/null
PSQL=("$PGBIN/psql" -h /tmp -p "$PORT" -U postgres -d postgres -q -v ON_ERROR_STOP=1)
"${PSQL[@]}" -f supabase/tests/auth_stub.sql
for f in supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -f supabase/tests/rls_test.sql 2>&1 >/dev/null | sed 's/^psql:[^ ]* NOTICE:  /  /'
