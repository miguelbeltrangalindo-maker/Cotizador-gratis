# Estado y limitaciones

## Listo y verificado
- Registro, inicio y cierre de sesión, sesiones con expiración y renovación, rate limiting y mensajes que no permiten enumerar cuentas.
- Organizaciones múltiples con cambio de organización activa, roles OWNER/ADMIN/MEMBER y alta de integrantes con cuenta existente.
- Marcas: logo (PNG/JPG/WebP/SVG rasterizado), 4 colores con ajuste automático de contraste, 3 tipografías, 3 plantillas, carta/A4, prefijos y relleno de folio, IVA y vigencia por defecto, encabezado, pie, firma y datos bancarios opcionales; vista previa en vivo y PDFs de ejemplo.
- Clientes con búsqueda, paginación, aviso de posibles duplicados, alta rápida desde el editor y archivado.
- Catálogo de conceptos, insertable en el editor; también se puede guardar en el catálogo un concepto desde el editor.
- Cotizaciones:
  - editor móvil con autoguardado y control de concurrencia;
  - secciones con subtotal; reordenamiento arrastrando y con botones;
  - descuentos e IVA añadido, incluido o sin IVA;
  - campos personalizados y notas internas;
  - estados, versiones, duplicado, archivado, historial con búsqueda y filtros.
- Recibos: independientes y vinculados, saldo, bloqueo de sobrepagos y de mezcla de monedas, idempotencia, anulación con motivo, importe con letra y leyenda de que no sustituye un CFDI.
- PDF multipágina con pie “Página X de Y”, fuentes con acentos y ñ, nombres de archivo saneados, descarga, vista previa y compartir (Web Share API).
- Cuadro de mando con conteos y pendiente de cobro por moneda; exportación CSV.
- PWA: manifest, iconos 192/512/maskable, service worker prudente y página sin conexión.

## Estructura preparada (no activa)
- Planes y monetización: la columna `organizations.plan` vale `FREE` por defecto y no aplica límites.
- `StorageProvider` S3: la interfaz existe, la implementación no.
- Invitaciones por correo, restablecimiento de contraseña por correo y verificación de email: requieren SMTP. Hoy existe la alternativa local `npm run user:reset-password`.
- Enlaces públicos con token para compartir PDFs, dominios por empresa e icono PWA por empresa.
- `receipt_allocations` (un recibo aplicado a varias cotizaciones): hoy un recibo aplica a una sola cotización.

## Pendientes conocidos
- Edición offline con sincronización: no implementada (decisión deliberada). Sin red, el editor conserva los cambios en la pestaña y no los guarda.
- La comprobación de contraste es automática para los PDFs y la miniatura; el panel solo advierte.
- Las páginas de documentos ajenos devuelven la vista “No encontrado” con HTTP 200 por el streaming (las APIs devuelven 404).
- La prueba E2E cubre el flujo principal en vista móvil. No hay pruebas de regresión visual automatizadas (las capturas se revisaron manualmente).
- En iOS Safari, la vista previa integrada en `iframe` puede mostrar solo la primera página; existe el botón “Abrir en pestaña”.
- Sin despliegue real: no se tiene acceso a hosting ni a una base gestionada.
