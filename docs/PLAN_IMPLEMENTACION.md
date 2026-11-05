# Plan de implementación (con estado)

| Hito | Contenido | Estado |
|---|---|---|
| 1. Base | Next 16, TS estricto, Tailwind 4, ESLint, Drizzle, docker-compose, .env.example | ✅ |
| 2. Tenancy | Esquema, rol sin privilegios, RLS, FKs compuestas, withTenant, roles | ✅ (pruebas de integración) |
| 3. Auth | Registro, inicio de sesión, sesiones, rate limit, perfil y contraseña | ✅ |
| 4. Marcas, clientes y catálogo | CRUD, logos seguros, vista previa en vivo | ✅ |
| 5. Motor de dinero | decimal, HALF-UP por línea, IVA, descuentos, saldos, importe con letra | ✅ (66 pruebas unitarias) |
| 6. Cotizaciones | Editor, autoguardado, secciones, dnd, versiones, estados, folios | ✅ |
| 7. Recibos | Independientes y vinculados, saldo, idempotencia, anulación | ✅ |
| 8. PDF | 3 plantillas, carta/A4, multipágina, snapshots | ✅ |
| 9. PWA y pulido | Manifest, service worker, estados vacíos, carga y error, responsive | ✅ |
| 10. Verificación | lint, typecheck, unit, integración, build, E2E, CI | ✅ |
| Fase 2 | SMTP (invitaciones, restablecimiento), S3, enlaces compartibles, planes | Preparado o documentado |
