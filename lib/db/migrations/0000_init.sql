CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid,
	"safe_metadata_json" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"tax_id" text,
	"email" text,
	"phone" text,
	"website" text,
	"address" text,
	"contact_name" text,
	"logo_file_id" uuid,
	"color_primary" text DEFAULT '#1C1C1B' NOT NULL,
	"color_secondary" text DEFAULT '#777772' NOT NULL,
	"color_accent" text DEFAULT '#2F5DCC' NOT NULL,
	"color_text" text DEFAULT '#1C1C1B' NOT NULL,
	"font_family" text DEFAULT 'INTER' NOT NULL,
	"header_text" text,
	"footer_text" text,
	"commercial_message" text,
	"signature_name" text,
	"signature_title" text,
	"bank_name" text,
	"bank_beneficiary" text,
	"bank_account" text,
	"bank_instructions" text,
	"show_bank_details" boolean DEFAULT false NOT NULL,
	"default_currency" text DEFAULT 'MXN' NOT NULL,
	"default_tax_mode" text DEFAULT 'EXCLUSIVE' NOT NULL,
	"default_tax_rate" numeric(7, 4) DEFAULT '16' NOT NULL,
	"default_payment_terms" text,
	"default_validity_days" integer DEFAULT 15 NOT NULL,
	"quote_prefix" text DEFAULT 'COT' NOT NULL,
	"receipt_prefix" text DEFAULT 'REC' NOT NULL,
	"folio_padding" integer DEFAULT 4 NOT NULL,
	"pdf_template" text DEFAULT 'MINIMAL' NOT NULL,
	"paper_size" text DEFAULT 'LETTER' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brands_padding_check" CHECK ("brands"."folio_padding" between 1 and 8)
);
--> statement-breakpoint
CREATE TABLE "catalog_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"brand_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"unit" text,
	"suggested_price" numeric(18, 4) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'MXN' NOT NULL,
	"tax_mode" text DEFAULT 'EXCLUSIVE' NOT NULL,
	"tax_rate" numeric(7, 4) DEFAULT '16' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" text,
	"name" text NOT NULL,
	"business_name" text,
	"tax_id" text,
	"email" text,
	"phone" text,
	"contact_name" text,
	"address" text,
	"notes" text,
	"preferred_currency" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_field_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"brand_id" uuid,
	"field_key" text NOT NULL,
	"label" text NOT NULL,
	"type" text NOT NULL,
	"options_json" jsonb,
	"required" boolean DEFAULT false NOT NULL,
	"visible_in_pdf" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custom_fields_type_check" CHECK ("custom_field_definitions"."type" in ('short_text','long_text','number','date','select','checkbox'))
);
--> statement-breakpoint
CREATE TABLE "file_blobs" (
	"file_id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"data" "bytea" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" uuid,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"checksum" text NOT NULL,
	"visibility" text DEFAULT 'PRIVATE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_role_check" CHECK ("memberships"."role" in ('OWNER','ADMIN','MEMBER'))
);
--> statement-breakpoint
CREATE TABLE "number_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"prefix" text NOT NULL,
	"document_type" text NOT NULL,
	"year" integer NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"country" text DEFAULT 'MX' NOT NULL,
	"timezone" text DEFAULT 'America/Mexico_City' NOT NULL,
	"default_currency" text DEFAULT 'MXN' NOT NULL,
	"plan" text DEFAULT 'FREE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_custom_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"quote_version_id" uuid NOT NULL,
	"field_key" text NOT NULL,
	"definition_snapshot_json" jsonb NOT NULL,
	"value_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "quote_groups" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"quote_version_id" uuid NOT NULL,
	"title" text NOT NULL,
	"position" integer NOT NULL,
	"show_subtotal" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"quote_version_id" uuid NOT NULL,
	"group_id" uuid,
	"position" integer NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"unit" text,
	"quantity" numeric(18, 4) NOT NULL,
	"unit_price" numeric(18, 4) NOT NULL,
	"discount_type" text DEFAULT 'NONE' NOT NULL,
	"discount_value" numeric(18, 4) DEFAULT '0' NOT NULL,
	"tax_mode" text DEFAULT 'NONE' NOT NULL,
	"tax_rate" numeric(7, 4) DEFAULT '0' NOT NULL,
	"gross_minor" bigint NOT NULL,
	"discount_minor" bigint NOT NULL,
	"net_minor" bigint NOT NULL,
	"tax_minor" bigint NOT NULL,
	"total_minor" bigint NOT NULL,
	"hide_unit_price_in_pdf" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_items_quantity_check" CHECK ("quote_items"."quantity" > 0),
	CONSTRAINT "quote_items_price_check" CHECK ("quote_items"."unit_price" >= 0),
	CONSTRAINT "quote_items_discount_type_check" CHECK ("quote_items"."discount_type" in ('NONE','PERCENT','FIXED')),
	CONSTRAINT "quote_items_tax_mode_check" CHECK ("quote_items"."tax_mode" in ('NONE','EXCLUSIVE','INCLUSIVE')),
	CONSTRAINT "quote_items_amounts_check" CHECK ("quote_items"."net_minor" >= 0 and "quote_items"."total_minor" >= 0 and "quote_items"."tax_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "quote_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"title" text,
	"service_description" text,
	"location" text,
	"duration" text,
	"responsible" text,
	"issue_date" date,
	"valid_until" date,
	"currency" text DEFAULT 'MXN' NOT NULL,
	"payment_terms" text,
	"validity_terms" text,
	"public_notes" text,
	"internal_notes" text,
	"show_unit_prices" boolean DEFAULT true NOT NULL,
	"show_only_grand_total" boolean DEFAULT false NOT NULL,
	"pdf_template" text,
	"paper_size" text,
	"snapshot_json" jsonb,
	"gross_minor" bigint DEFAULT 0 NOT NULL,
	"discount_minor" bigint DEFAULT 0 NOT NULL,
	"subtotal_minor" bigint DEFAULT 0 NOT NULL,
	"tax_minor" bigint DEFAULT 0 NOT NULL,
	"total_minor" bigint DEFAULT 0 NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"lock_reason" text,
	"sent_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_versions_status_check" CHECK ("quote_versions"."status" in ('DRAFT','SENT','APPROVED','REJECTED','EXPIRED')),
	CONSTRAINT "quote_versions_currency_check" CHECK ("quote_versions"."currency" in ('MXN','USD')),
	CONSTRAINT "quote_versions_totals_check" CHECK ("quote_versions"."total_minor" >= 0 and "quote_versions"."tax_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"client_id" uuid,
	"folio" text,
	"sequence_no" integer,
	"folio_year" integer,
	"current_version_id" uuid,
	"archived_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"client_id" uuid,
	"quote_id" uuid,
	"quote_version_id" uuid,
	"receipt_no" integer NOT NULL,
	"year" integer NOT NULL,
	"folio" text NOT NULL,
	"payer_name" text NOT NULL,
	"concept" text NOT NULL,
	"payment_method" text NOT NULL,
	"payment_reference" text,
	"received_at" timestamp with time zone NOT NULL,
	"currency" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"tax_treatment" text DEFAULT 'NONE' NOT NULL,
	"tax_rate" numeric(7, 4) DEFAULT '0' NOT NULL,
	"net_minor" bigint NOT NULL,
	"tax_minor" bigint NOT NULL,
	"notes_public" text,
	"notes_internal" text,
	"signature_name" text,
	"status" text DEFAULT 'ISSUED' NOT NULL,
	"void_reason" text,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"idempotency_key" text NOT NULL,
	"snapshot_json" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receipts_amount_check" CHECK ("receipts"."amount_minor" > 0),
	CONSTRAINT "receipts_status_check" CHECK ("receipts"."status" in ('ISSUED','VOID')),
	CONSTRAINT "receipts_currency_check" CHECK ("receipts"."currency" in ('MXN','USD')),
	CONSTRAINT "receipts_method_check" CHECK ("receipts"."payment_method" in ('TRANSFER','CASH','CARD','CHECK','OTHER')),
	CONSTRAINT "receipts_tax_check" CHECK ("receipts"."tax_treatment" in ('NONE','INCLUDED','ADDED'))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"active_organization_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brands" ADD CONSTRAINT "brands_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brands" ADD CONSTRAINT "brands_logo_file_id_files_id_fk" FOREIGN KEY ("logo_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_blobs" ADD CONSTRAINT "file_blobs_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_blobs" ADD CONSTRAINT "file_blobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "number_sequences" ADD CONSTRAINT "number_sequences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_custom_values" ADD CONSTRAINT "quote_custom_values_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_custom_values" ADD CONSTRAINT "quote_custom_values_quote_version_id_quote_versions_id_fk" FOREIGN KEY ("quote_version_id") REFERENCES "public"."quote_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_groups" ADD CONSTRAINT "quote_groups_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_groups" ADD CONSTRAINT "quote_groups_quote_version_id_quote_versions_id_fk" FOREIGN KEY ("quote_version_id") REFERENCES "public"."quote_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_version_id_quote_versions_id_fk" FOREIGN KEY ("quote_version_id") REFERENCES "public"."quote_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_org_occurred_idx" ON "audit_logs" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE INDEX "brands_org_idx" ON "brands" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "brands_org_id_unique" ON "brands" USING btree ("organization_id","id");--> statement-breakpoint
CREATE INDEX "catalog_org_title_idx" ON "catalog_items" USING btree ("organization_id","title");--> statement-breakpoint
CREATE INDEX "clients_org_name_idx" ON "clients" USING btree ("organization_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_org_id_unique" ON "clients" USING btree ("organization_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_fields_org_key_unique" ON "custom_field_definitions" USING btree ("organization_id","field_key");--> statement-breakpoint
CREATE INDEX "files_org_idx" ON "files" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_org_user_unique" ON "memberships" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "number_sequences_unique" ON "number_sequences" USING btree ("organization_id","prefix","document_type","year");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_unique" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_custom_values_unique" ON "quote_custom_values" USING btree ("quote_version_id","field_key");--> statement-breakpoint
CREATE INDEX "quote_groups_version_idx" ON "quote_groups" USING btree ("quote_version_id");--> statement-breakpoint
CREATE INDEX "quote_items_version_idx" ON "quote_items" USING btree ("quote_version_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_versions_number_unique" ON "quote_versions" USING btree ("quote_id","version_number");--> statement-breakpoint
CREATE INDEX "quote_versions_org_status_idx" ON "quote_versions" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_org_folio_unique" ON "quotes" USING btree ("organization_id","folio");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_org_id_unique" ON "quotes" USING btree ("organization_id","id");--> statement-breakpoint
CREATE INDEX "quotes_org_updated_idx" ON "quotes" USING btree ("organization_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_org_folio_unique" ON "receipts" USING btree ("organization_id","folio");--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_org_idempotency_unique" ON "receipts" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "receipts_org_created_idx" ON "receipts" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "receipts_quote_idx" ON "receipts" USING btree ("quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));