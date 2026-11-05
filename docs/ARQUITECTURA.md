# Arquitectura

```
app/                    Rutas (App Router)
  (auth)/               registro, inicio de sesión, recuperación
  (app)/                zona privada: inicio, cotizaciones, recibos, clientes, catálogo, ajustes
  api/                  PDFs, archivos privados, exportación CSV, vista previa de marca, health
  bienvenida/           onboarding · sin-conexion/ página offline (PWA)
components/ui           primitivas accesibles (botones, campos, diálogos)
components/domain       componentes por módulo (editor, selector de cliente, navegación…)
features/<módulo>/      service.ts (lógica + autorización + transacciones) · actions.ts (Server Actions) · constants
  auth, organizations, brands, clients, catalog, custom-fields, quotes, receipts, documents (snapshot, PDF, CSV), audit
lib/db                  esquema Drizzle, conexión y migraciones
lib/security            tenant (withTenant, roles, permisos) y rate limiting
lib/money               motor monetario y montos con letra
lib/storage             StorageProvider y normalización de imágenes
lib/utils, lib/validation  fechas, folios, color, texto y esquemas Zod
tests/unit|integration|e2e
```

## Capas

1. **Modelo persistido**: `lib/db/schema.ts` y migraciones.
2. **Lógica pura**: `lib/money`, `features/quotes/status.ts`, `features/quotes/editor-state.ts`, `features/documents/snapshot.ts` (`buildSections`).
3. **Autorización y transacciones**: `features/*/service.ts`. Cada función recibe un `TenantContext` resuelto en servidor, valida con Zod, comprueba permisos (`assertCan`) y ejecuta dentro de `withTenant`.
4. **Interfaz**: Server Components para lectura y Client Components para la edición.
5. **Snapshot documental**: se congela al enviar o emitir.
6. **Representación PDF**: `features/documents/pdf/*` lee únicamente el snapshot.

Server Actions y route handlers llaman a los **mismos servicios**. `lib/action.ts` y `lib/http.ts` traducen errores a códigos estables (`VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMIT`, `INTERNAL_ERROR`). Los errores inesperados devuelven un código de rastreo y nunca exponen el stack trace.

## Flujo de una petición privada

```
cookie de sesión → validateSessionToken (HMAC) → resolveTenantContext (membresía)
  → servicio(ctx, input) → Zod → assertCan(rol) → withTenant: BEGIN; set_config(app.org_id, app.user_id)
  → consultas con WHERE organization_id = ctx (+ RLS) → COMMIT
```

## Seguridad aplicada

- Cookies HttpOnly, SameSite=Lax y Secure en producción (prefijo `__Host-`). Las Server Actions de Next validan el origen (CSRF).
- Headers: CSP, HSTS (producción), X-Frame-Options SAMEORIGIN, nosniff, Referrer-Policy y Permissions-Policy.
- PDFs, logos y exportaciones con `Cache-Control: private, no-store`. El service worker no almacena respuestas privadas.
- CSV con neutralización de fórmulas (`=`, `+`, `-`, `@`).
- Búsquedas `ILIKE` con comodines escapados. Límites de longitud en todos los textos y de 500 conceptos por versión.
- Auditoría (`audit_logs`) de creación, cambios de estado, versiones, emisión y anulación de recibos, cambios de marca e integrantes, sin datos sensibles.

## Concurrencia

- Autoguardado: debounce de 900 ms, nunca dos solicitudes simultáneas y revisión optimista (`revision`). Si hay conflicto, el editor lo indica y pide recargar.
- Folios: `INSERT … ON CONFLICT DO UPDATE … RETURNING` dentro de la transacción de emisión.
- Recibos: bloqueo de la fila de la cotización, más idempotencia.
