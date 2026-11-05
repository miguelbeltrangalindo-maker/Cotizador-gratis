#!/usr/bin/env bash
# Arranque en Render: deriva la conexión del rol sin privilegios, aplica migraciones y levanta Next.
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  : "${DATABASE_ADMIN_URL:?Falta DATABASE_ADMIN_URL}"
  : "${APP_DB_PASSWORD:?Falta APP_DB_PASSWORD}"
  export DATABASE_URL=$(node -e '
    const u = new URL(process.env.DATABASE_ADMIN_URL);
    u.username = "cotizador_app";
    u.password = encodeURIComponent(process.env.APP_DB_PASSWORD);
    console.log(u.toString());
  ')
fi
export APP_URL="${APP_URL:-${RENDER_EXTERNAL_URL:-}}"

npx tsx scripts/db-setup-roles.ts
npx tsx scripts/db-migrate.ts
exec npx next start -p "${PORT:-3000}"
