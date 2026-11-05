#!/usr/bin/env bash
# Arranque local en un paso: .env, PostgreSQL (Docker), dependencias, migraciones, rol y seed demo opcional.
# No sobrescribe un .env existente ni borra datos.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.example .env
  SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")
  APPPWD=$(node -e "console.log(require('crypto').randomBytes(18).toString('base64url'))")
  sed -i.bak "s|^AUTH_SECRET=.*|AUTH_SECRET=${SECRET}|; s|cambia_esta_clave_app|${APPPWD}|; s|^ENABLE_DEMO_SEED=.*|ENABLE_DEMO_SEED=true|" .env && rm -f .env.bak
  echo "✔ .env creado con secretos locales aleatorios"
else
  echo "ℹ .env ya existe; no se modifica"
fi

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  docker compose up -d postgres
  echo "… esperando a PostgreSQL"
  for _ in $(seq 1 30); do docker compose exec -T postgres pg_isready -U postgres -d cotizador >/dev/null 2>&1 && break; sleep 1; done
else
  echo "ℹ Docker no disponible: asegúrate de tener PostgreSQL 16 accesible según DATABASE_ADMIN_URL"
fi

npm ci
npm run db:setup-roles
npm run db:migrate
if [ "${SKIP_SEED:-}" != "1" ]; then npm run db:seed:demo || true; fi
echo "✔ Listo. Ejecuta: npm run dev  y abre http://localhost:3000"
