-- =============================================================================
-- 0001 — Aislamiento multi-tenant: llaves foráneas compuestas, rol de ejecución
-- sin privilegios y Row Level Security (RLS).
--
-- La aplicación se conecta como `cotizador_app` (NOLOGIN aquí; el script
-- `npm run db:setup-roles` le asigna LOGIN y contraseña). Ese rol:
--   * NO es dueño de las tablas (las políticas RLS sí le aplican),
--   * NO tiene BYPASSRLS,
--   * NO puede borrar recibos ni modificar la bitácora de auditoría.
-- Cada transacción de negocio fija `app.org_id` y `app.user_id` con set_config(..., true).
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cotizador_app') THEN
    CREATE ROLE cotizador_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_current_org() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.org_id', true), '')::uuid $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_current_user() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Llaves compuestas: impiden referencias cruzadas entre organizaciones aunque
-- el servidor tuviera un error de validación.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS quote_versions_org_id_unique ON quote_versions (organization_id, id);
--> statement-breakpoint
ALTER TABLE quotes ADD CONSTRAINT quotes_brand_tenant_fk
  FOREIGN KEY (organization_id, brand_id) REFERENCES brands (organization_id, id);
--> statement-breakpoint
ALTER TABLE quotes ADD CONSTRAINT quotes_client_tenant_fk
  FOREIGN KEY (organization_id, client_id) REFERENCES clients (organization_id, id);
--> statement-breakpoint
ALTER TABLE quotes ADD CONSTRAINT quotes_current_version_tenant_fk
  FOREIGN KEY (organization_id, current_version_id) REFERENCES quote_versions (organization_id, id);
--> statement-breakpoint
ALTER TABLE quote_versions ADD CONSTRAINT quote_versions_quote_tenant_fk
  FOREIGN KEY (organization_id, quote_id) REFERENCES quotes (organization_id, id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE quote_items ADD CONSTRAINT quote_items_version_tenant_fk
  FOREIGN KEY (organization_id, quote_version_id) REFERENCES quote_versions (organization_id, id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE quote_groups ADD CONSTRAINT quote_groups_version_tenant_fk
  FOREIGN KEY (organization_id, quote_version_id) REFERENCES quote_versions (organization_id, id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE quote_custom_values ADD CONSTRAINT quote_custom_values_version_tenant_fk
  FOREIGN KEY (organization_id, quote_version_id) REFERENCES quote_versions (organization_id, id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE catalog_items ADD CONSTRAINT catalog_items_brand_tenant_fk
  FOREIGN KEY (organization_id, brand_id) REFERENCES brands (organization_id, id);
--> statement-breakpoint
ALTER TABLE custom_field_definitions ADD CONSTRAINT custom_fields_brand_tenant_fk
  FOREIGN KEY (organization_id, brand_id) REFERENCES brands (organization_id, id);
--> statement-breakpoint
ALTER TABLE receipts ADD CONSTRAINT receipts_brand_tenant_fk
  FOREIGN KEY (organization_id, brand_id) REFERENCES brands (organization_id, id);
--> statement-breakpoint
ALTER TABLE receipts ADD CONSTRAINT receipts_client_tenant_fk
  FOREIGN KEY (organization_id, client_id) REFERENCES clients (organization_id, id);
--> statement-breakpoint
ALTER TABLE receipts ADD CONSTRAINT receipts_quote_tenant_fk
  FOREIGN KEY (organization_id, quote_id) REFERENCES quotes (organization_id, id);
--> statement-breakpoint
ALTER TABLE receipts ADD CONSTRAINT receipts_quote_version_tenant_fk
  FOREIGN KEY (organization_id, quote_version_id) REFERENCES quote_versions (organization_id, id);
--> statement-breakpoint
ALTER TABLE receipts ADD CONSTRAINT receipts_void_reason_check
  CHECK (status <> 'VOID' OR (void_reason IS NOT NULL AND length(trim(void_reason)) > 0));
--> statement-breakpoint

-- Búsqueda: índices de texto (trigramas) para listados grandes.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS clients_name_trgm_idx ON clients USING gin (name gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS quote_versions_title_trgm_idx ON quote_versions USING gin (title gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS receipts_payer_trgm_idx ON receipts USING gin (payer_name gin_trgm_ops);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Privilegios del rol de ejecución
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO cotizador_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON
  users, sessions, rate_limits, organizations, memberships, files, file_blobs, brands, clients,
  catalog_items, number_sequences, quotes, quote_versions, quote_groups, quote_items,
  custom_field_definitions, quote_custom_values
  TO cotizador_app;
--> statement-breakpoint
-- Recibos: nunca se borran (solo se anulan). Bitácora: solo inserción y lectura.
GRANT SELECT, INSERT, UPDATE ON receipts TO cotizador_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON audit_logs TO cotizador_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_current_org(), app_current_user() TO cotizador_app;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- RLS en tablas con organization_id
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'files','file_blobs','brands','clients','catalog_items','number_sequences','quotes',
    'quote_versions','quote_groups','quote_items','custom_field_definitions',
    'quote_custom_values','receipts','audit_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I FOR ALL TO cotizador_app
         USING (organization_id = app_current_org())
         WITH CHECK (organization_id = app_current_org())', t);
  END LOOP;
END
$$;
--> statement-breakpoint

-- Membresías: el usuario ve las propias; dentro de una organización activa se ven las de esa organización.
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY memberships_select ON memberships FOR SELECT TO cotizador_app
  USING (user_id = app_current_user() OR organization_id = app_current_org());
--> statement-breakpoint
CREATE POLICY memberships_write ON memberships FOR INSERT TO cotizador_app
  WITH CHECK (organization_id = app_current_org());
--> statement-breakpoint
CREATE POLICY memberships_update ON memberships FOR UPDATE TO cotizador_app
  USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());
--> statement-breakpoint
CREATE POLICY memberships_delete ON memberships FOR DELETE TO cotizador_app
  USING (organization_id = app_current_org());
--> statement-breakpoint

-- Organizaciones: visibles si son la activa o si el usuario es miembro.
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organizations_select ON organizations FOR SELECT TO cotizador_app
  USING (
    id = app_current_org()
    OR EXISTS (SELECT 1 FROM memberships m WHERE m.organization_id = organizations.id AND m.user_id = app_current_user())
  );
--> statement-breakpoint
CREATE POLICY organizations_insert ON organizations FOR INSERT TO cotizador_app
  WITH CHECK (id = app_current_org());
--> statement-breakpoint
CREATE POLICY organizations_update ON organizations FOR UPDATE TO cotizador_app
  USING (id = app_current_org()) WITH CHECK (id = app_current_org());
