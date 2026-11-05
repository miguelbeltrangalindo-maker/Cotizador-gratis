# Despliegue

Producción en Vercel (ver la sección «Despliegue en Vercel»). Este documento describe también otras opciones.

## Arquitectura de producción recomendada

- **Next.js en Node 22** (`npm run build && npm run start`), en un contenedor o en una plataforma con runtime Node: Render, Railway, Fly.io, una VM o Vercel (las rutas PDF usan `runtime = "nodejs"`; revisa el límite de tiempo y memoria de sus funciones para documentos grandes).
- **PostgreSQL 16 gestionado** con backups automáticos: Neon, Supabase (solo como Postgres), RDS, Cloud SQL, etc.
- Logos: el driver `database` funciona sin almacenamiento externo. Para volúmenes grandes, implementa un `StorageProvider` compatible con S3 (bucket **privado**; la interfaz está en `lib/storage/index.ts`).

## Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Conexión con el rol **cotizador_app** (sin privilegios). |
| `DATABASE_ADMIN_URL` | Solo para migrar | Dueño del esquema; se usa en `db:migrate` y `db:setup-roles`. No debe estar disponible para el proceso web si se puede evitar. |
| `AUTH_SECRET` | Sí | ≥ 32 caracteres aleatorios. Si se rota, se cierran todas las sesiones. |
| `APP_URL` | Sí | `https://tu-dominio`. En producción se exige HTTPS. |
| `STORAGE_DRIVER` | No | `database` (por defecto) o `local` (requiere disco persistente). |
| `STORAGE_LOCAL_DIR` | No | Carpeta privada si `STORAGE_DRIVER=local`. |
| `NEXT_PUBLIC_APP_NAME` | No | Nombre de la plataforma (marca blanca de la app). |
| `SMTP_*` | No | Reservadas. El envío de correos aún no está implementado. |
| `ENABLE_DEMO_SEED` | No | Nunca la actives en producción (el seed además se niega si `NODE_ENV=production`). |

## Primer despliegue

1. Crea la base de datos y un usuario administrador (dueño).
2. Con `DATABASE_ADMIN_URL` y `DATABASE_URL` definidas: `npm run db:setup-roles && npm run db:migrate`. Si tu proveedor no permite `CREATE ROLE` desde SQL, crea el rol `cotizador_app` desde su panel con `NOBYPASSRLS` y vuelve a ejecutar `db:migrate`.
3. Despliega la app solo con `DATABASE_URL`, `AUTH_SECRET` y `APP_URL`.
4. Verifica `GET /api/health` → `{"status":"ok"}`.

## Cookies, dominio y CSRF

- Sirve únicamente por HTTPS. La cookie `__Host-cotizador_session` es Secure, HttpOnly y SameSite=Lax, sin atributo Domain.
- Las Server Actions validan que el `Origin` coincida con el host. Si hay un proxy, este debe reenviar `Host` y `X-Forwarded-*` correctamente.
- No se configura CORS: la API no está pensada para otros orígenes.

## Migraciones, backups y rollback

- Cada versión aplica `npm run db:migrate` **antes** de cambiar el tráfico. Las migraciones son aditivas.
- Backups: snapshots diarios del proveedor y, además, `pg_dump -Fc "$DATABASE_ADMIN_URL" > respaldo.dump` antes de cada migración.
- Restauración: `pg_restore --clean --no-owner -d "$DATABASE_ADMIN_URL" respaldo.dump` y después `npm run db:setup-roles`.
- Rollback de la app: vuelve a desplegar la imagen anterior. Si la migración nueva no es compatible hacia atrás, restaura el backup previo.

## Logs y monitoreo

- Los errores inesperados se escriben como `[error <id>]` en stdout; el usuario ve el mismo `<id>`.
- Health check: `/api/health`.

## Lo que solo puede aportar el propietario

1. Una base PostgreSQL gestionada (URL de administrador).
2. Hosting Node con HTTPS y dominio.
3. (Opcional) Un proveedor SMTP para restablecer contraseñas e invitar por correo, cuando se implemente.
4. (Opcional) Un bucket S3 privado, si no se usa el almacenamiento en base de datos.

## Despliegue en Render (Blueprint incluido)

1. Haz merge de la PR a `main`.
2. En render.com: **New → Blueprint**, elige este repositorio y la rama `main`, y confirma con **Apply**.
3. Render crea `cotizador-db` (PostgreSQL) y el servicio web. `scripts/render-start.sh` deriva la conexión del rol `cotizador_app`, aplica migraciones y arranca la app. La URL pública aparece en el servicio `cotizador`.

En el plan gratuito, la app se suspende tras unos minutos sin uso y tarda en volver a responder, y la base de datos gratis caduca a los 30 días. Para uso real, cambia ambos a un plan de pago.
Si `CREATE ROLE` fallara en tu plan, crea el rol `cotizador_app` (NOBYPASSRLS) desde una consola SQL con la contraseña de `APP_DB_PASSWORD`.

## Despliegue en Vercel (producción actual)

Producción: **https://cotizador.mediabandera.com** (proyecto `cotizador` en Vercel; rama de producción `main`).

- **Base de datos:** Neon PostgreSQL conectada como integración de Vercel con el prefijo `ADMIN`. Así la conexión de dueño del esquema queda en `ADMIN_DATABASE_URL` / `ADMIN_DATABASE_URL_UNPOOLED` y no ocupa `DATABASE_URL`.
- **`DATABASE_URL`** (solo Production, sensible): rol `cotizador_app` contra el host *pooler* de Neon.
- **`AUTH_SECRET`**, **`APP_URL=https://cotizador.mediabandera.com`** y **`STORAGE_DRIVER=database`**: solo Production.
- **Compilación:** `vercel.json` fija `framework: nextjs` y usa `scripts/vercel-build.sh`. En producción (`VERCEL_ENV=production`) ejecuta `db:setup-roles` y `db:migrate` con la conexión directa de administrador **antes** de `next build`; si la migración falla, el despliegue falla y el tráfico sigue en la versión anterior. En Preview se omiten.
- **Fuentes del PDF:** `next.config.ts` incluye `assets/fonts` en el paquete de funciones (`outputFileTracingIncludes`).
- **Dominio:** en el DNS de Hostinger, `cotizador` es un CNAME al destino que indica `vercel domains verify cotizador.mediabandera.com`. Los nameservers siguen en Hostinger.
- Los despliegues de Preview no tienen `DATABASE_URL` y no deben apuntar a la base de producción.
