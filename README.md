# Cotizador

Plataforma SaaS multiempresa y multimarca para crear **cotizaciones profesionales** y **recibos de pago** con control de saldos. Es responsive, se puede instalar como PWA y funciona sin servicios de inteligencia artificial.

> “Cotizador” es un nombre neutro de desarrollo. Se cambia con `NEXT_PUBLIC_APP_NAME` (ver `lib/app-config.ts`).

## Qué incluye

- Cuentas con correo y contraseña (Argon2id), sesiones seguras y rate limiting.
- Organizaciones aisladas con roles (Propietario / Administrador / Colaborador). Aislamiento en servidor **y** con Row Level Security de PostgreSQL.
- Varias marcas por organización, cada una con su logo, colores, tipografía, folios, impuestos, pie de página y datos bancarios opcionales.
- Clientes, catálogo de servicios y productos, y campos personalizados.
- Editor móvil de cotizaciones:
  - autoguardado con control de concurrencia;
  - conceptos ilimitados que se reordenan arrastrando o con botones;
  - secciones con subtotal, descuentos, IVA añadido, incluido o sin IVA.
- Versiones (V1, V2…) que conservan el histórico, estados comerciales y folios transaccionales únicos.
- Recibos independientes o ligados a una cotización:
  - anticipos y pagos parciales;
  - bloqueo de sobrepagos y de mezcla de monedas;
  - idempotencia contra doble emisión;
  - anulación con motivo.
- PDFs con 3 estilos (Minimal, Corporativo, Creativo):
  - tamaño carta o A4, multipágina, fuentes incrustadas;
  - generados desde snapshots inmutables;
  - importe con letra en los recibos.
- Cuadro de mando con montos pendientes por moneda, exportación CSV, manifest PWA y un service worker que no guarda en caché datos privados.

## Arranque local

Requisitos: Node 22 LTS (o ≥ 20.9), npm y PostgreSQL 16 (con Docker, o instalado localmente).

```bash
# Opción rápida: crea .env con secretos aleatorios, levanta Postgres, migra y siembra datos demo
npm run bootstrap
npm run dev            # http://localhost:3000
```

Paso a paso:

1. `cp .env.example .env`. Genera `AUTH_SECRET` con `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` y cambia la contraseña de `cotizador_app` en `DATABASE_URL`.
2. `docker compose up -d postgres`. El contenedor crea `cotizador` y `cotizador_test`.
3. `npm ci`
4. `npm run db:setup-roles`: crea el rol de aplicación **sin privilegios** usando la contraseña de `DATABASE_URL`.
5. `npm run db:migrate`
6. `npm run db:seed:demo` (opcional; requiere `ENABLE_DEMO_SEED=true` y nunca corre en producción).
7. `npm run dev` y abre http://localhost:3000

Credenciales demo, **solo locales**:

| Cuenta | Organización |
|---|---|
| `demo-a@cotizador.local` / `DemoLocal-2026` | Estudio Creativo Demo (marca “Media Demo”) |
| `demo-b@cotizador.local` / `DemoLocal-2026` | Consultoría Horizonte Demo (independiente) |

## Scripts

| Script | Uso |
|---|---|
| `dev` / `build` / `start` | Desarrollo, build y producción |
| `lint` / `typecheck` | ESLint (0 warnings) y TypeScript estricto |
| `test` | Pruebas unitarias (dinero, folios, estados, fechas, letras) |
| `test:integration` | Integración contra PostgreSQL real (`cotizador_test`, se reinicia cada vez) |
| `test:e2e` | Playwright contra el build de producción (requiere `npm run build` y datos demo) |
| `db:generate` / `db:migrate` / `db:setup-roles` | Migraciones Drizzle y rol de ejecución |
| `db:seed:demo` | Datos de demostración (solo desarrollo) |
| `db:reset:dev` | Reinicia la base **local** (bloqueado en producción y en hosts remotos) |
| `user:reset-password -- correo [clave]` | Restablecimiento local mientras no haya SMTP |
| `pwa:icons` | Regenera los iconos PWA |

Si Chromium ya está instalado (por ejemplo, en contenedores), usa `PW_EXECUTABLE_PATH=/ruta/a/chrome npm run test:e2e`.

## Documentación

- [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md): capas, seguridad multi-tenant y flujo de datos.
- [docs/DECISIONES.md](docs/DECISIONES.md): decisiones técnicas y supuestos de producto.
- [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md): producción, variables, backups y rollback.
- [docs/LIMITACIONES.md](docs/LIMITACIONES.md): qué está listo, qué está preparado y qué falta.
- [docs/PLAN_IMPLEMENTACION.md](docs/PLAN_IMPLEMENTACION.md): hitos y su estado.

> Los recibos son comprobantes comerciales de recepción de pago y **no sustituyen un CFDI**.
