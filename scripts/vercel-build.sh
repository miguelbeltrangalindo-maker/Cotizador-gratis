#!/usr/bin/env bash
# Compilación en Vercel. En producción aplica rol y migraciones ANTES de compilar,
# así el tráfico no cambia a la nueva versión si la migración falla.
# - ADMIN_DATABASE_URL_UNPOOLED: dueño del esquema (integración Neon con prefijo ADMIN).
#   Se usa la conexión directa (sin pooler) para migrar.
# - DATABASE_URL: rol cotizador_app (sin privilegios) que usa la app.
set -euo pipefail

if [ "${VERCEL_ENV:-}" = "production" ]; then
  export DATABASE_ADMIN_URL="${ADMIN_DATABASE_URL_UNPOOLED:?Falta ADMIN_DATABASE_URL_UNPOOLED (integración Neon)}"
  : "${DATABASE_URL:?Falta DATABASE_URL (rol cotizador_app)}"
  echo "▶ Producción: preparando rol y aplicando migraciones"
  npx tsx scripts/db-setup-roles.ts
  npx tsx scripts/db-migrate.ts
else
  echo "▶ Entorno ${VERCEL_ENV:-local}: se omiten las migraciones"
fi

npm run build
