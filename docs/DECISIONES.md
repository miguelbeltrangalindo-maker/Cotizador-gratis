# Decisiones técnicas y supuestos

| # | Decisión | Motivo |
|---|---|---|
| 1 | **Next.js 16 (App Router) + TypeScript estricto**, sin `cacheComponents` | Toda la app es privada y por sesión. El modelo dinámico clásico es más simple y seguro. Ninguna respuesta autenticada se cachea. |
| 2 | **PostgreSQL + Drizzle ORM** con migraciones SQL versionadas (`lib/db/migrations`) | Consultas tipadas y parametrizadas. La migración `0001` (RLS, roles y FKs compuestas) está escrita a mano y es auditable. |
| 3 | **Autenticación propia** (Argon2id con `@node-rs/argon2`, token de sesión aleatorio de 256 bits en cookie HttpOnly/SameSite=Lax/Secure; en BD solo se guarda `HMAC-SHA256(token, AUTH_SECRET)`) en lugar de Better Auth/Auth.js | Integración directa con la resolución de tenant y RLS, pocas piezas móviles y ninguna dependencia de proveedores externos. Las APIs de las librerías en sus versiones actuales cambiaron mucho. Superficie pequeña y probada. |
| 4 | **Defensa en profundidad multi-tenant**: (a) el servidor resuelve organización y rol desde la sesión y la membresía, nunca desde el navegador; (b) cada consulta filtra por `organization_id`; (c) **RLS** con el rol `cotizador_app` (sin BYPASSRLS, no es dueño de tablas) y `set_config('app.org_id')` por transacción; (d) **FKs compuestas** `(organization_id, id)` que impiden referencias cruzadas | Requisito no negociable. Hay pruebas de integración para cada capa. |
| 5 | Recursos ajenos o ids inválidos ⇒ **NOT_FOUND** (no FORBIDDEN) | No revela la existencia de documentos de otras empresas. |
| 6 | **Dinero**: decimal.js, unidades menores (centavos) en `bigint`, redondeo **HALF-UP por línea**; los totales son la suma de líneas redondeadas | Mismo resultado en editor, servidor y PDF porque todos usan `lib/money`. El servidor recalcula siempre. |
| 7 | Columna “Importe” = bruto − descuento. Con IVA incluido se muestra la leyenda “Algunos precios incluyen IVA” | Lo que se lee coincide con el precio pactado. El desglose de IVA se presenta por tasa. |
| 8 | **Folio al enviar** (no al crear el borrador). Los borradores muestran “BORRADOR” en el PDF | Evita consumir folios con borradores abandonados. Los folios nunca se reutilizan. |
| 9 | **Secuencias por prefijo** `(org, prefijo, tipo, año)` en lugar de `(org, marca, tipo, año)` | Si dos marcas comparten prefijo (p. ej. “REC”) no se pueden duplicar folios. Además existe `UNIQUE(org, folio)`. |
| 10 | Año del folio según la **zona horaria de la organización** | Un recibo emitido el 31 de diciembre a las 21:00 en CDMX pertenece a ese año. |
| 11 | **Versionado**: solo la versión actual en BORRADOR es editable; enviar congela un snapshot completo (emisor, cliente, líneas, totales y plantilla). Nueva versión = copia transaccional | Los PDFs históricos son fieles aunque cambien marca, logo o tasas. |
| 12 | **Saldo** contra la *versión de referencia*: la última APROBADA; si no hay, la última ENVIADA. Pagado = recibos ISSUED de la cotización. Saldo = max(0, base − pagado) | No se reasigna dinero al crear revisiones. Si hay recibos, la moneda queda bloqueada. |
| 13 | **Sobrepago bloqueado**. La cotización se bloquea con `SELECT … FOR UPDATE` al emitir un recibo vinculado | Pagos simultáneos no pueden exceder el total (probado con 5 pagos concurrentes). |
| 14 | **Idempotencia de recibos** con una clave UUID generada al abrir el formulario y `UNIQUE(org, idempotency_key)`; en carrera se devuelve el recibo ganador | Evita la doble emisión por doble clic, reintentos o red inestable. |
| 15 | Recibo con IVA “Más IVA”: el monto capturado es la base y el total recibido es base + IVA | `amount_minor` siempre es el dinero recibido, que es lo que cuenta para el saldo. |
| 16 | **PDF con @react-pdf/renderer** (sin navegador headless) y fuentes OFL incrustadas (Inter, Lora) más Helvetica | Funciona en cualquier hosting Node. Los PDFs se generan bajo demanda desde snapshots y no se almacenan duplicados. |
| 17 | **Logos**: tipo real detectado con `sharp`, SVG **rasterizado** (sus scripts nunca se sirven ni se ejecutan), metadatos eliminados, máx. 5 MB y 1200 px. Cada carga crea un archivo nuevo e inmutable | Seguridad y fidelidad histórica. |
| 18 | **StorageProvider “database”** por defecto (binarios en `file_blobs`, con RLS) y “local” opcional | Funciona en hosting sin disco persistente y sin cuentas externas. S3 queda como extensión documentada. |
| 19 | **Rate limiting en PostgreSQL** (ventana fija, UPSERT atómico) | Funciona con varias instancias sin Redis. |
| 20 | **CSP** con `'unsafe-inline'` para scripts (sin nonce) | Next inyecta scripts inline de hidratación. Se permite `'self'` y nada de terceros. |
| 21 | **Clientes y cotizaciones se archivan; los recibos se anulan**. El rol de aplicación no tiene permiso `DELETE` sobre `receipts` ni `UPDATE/DELETE` sobre `audit_logs` | Integridad histórica garantizada por la base de datos. |
| 22 | Integrantes: el propietario agrega **cuentas ya registradas** por correo | Las invitaciones por correo requieren SMTP (fase 2). |
| 23 | Sin SMTP no se “simulan” correos: el restablecimiento se hace con `npm run user:reset-password` | Honestidad operativa. |
| 24 | Campos personalizados: definiciones por organización; cada versión guarda un **snapshot de la definición** junto al valor | Cambios posteriores en la definición no alteran documentos. |
| 25 | Importe con letra implementado y probado (pesos “M.N.” y dólares) | Requisito opcional cubierto. |
| 26 | El streaming (`loading.tsx`) hace que una cotización ajena responda con la vista “No encontrado” y HTTP 200 en páginas. Las APIs (PDF, archivos y exportaciones) sí responden 404/401 | Nunca se filtra contenido (probado en E2E). |

## Supuestos de producto

- Un borrador puede guardarse incompleto. Para enviarlo se exigen cliente, marca activa, al menos un concepto con descripción, moneda y los campos personalizados obligatorios.
- La cantidad debe ser mayor que 0. Se permite precio 0 (cortesías). Un descuento mayor que el importe de la línea es un error.
- Al cambiar de moneda no se convierten importes: se muestra una advertencia para ajustarlos manualmente.
- Los recibos vinculados exigen una cotización ENVIADA o APROBADA en la misma moneda.
- **Retenciones (RESICO y otras)** a nivel documento: ISR = round2(subtotal × tasa); IVA retenido = round2(base gravada con IVA × tasa). Preajuste RESICO: IVA 10.6667 % e ISR 1.25 %. El `total_minor` guardado es el **total a pagar** (subtotal + IVA − retenciones), por lo que saldos y recibos usan el neto que el cliente realmente paga. Las tasas se guardan por versión (`retention_iva_rate`, `retention_isr_rate`) y la marca define las sugeridas. Los snapshots anteriores sin retenciones se muestran igual que antes.
