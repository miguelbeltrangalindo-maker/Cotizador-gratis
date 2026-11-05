/**
 * Esquema de base de datos (Drizzle ORM / PostgreSQL).
 *
 * Convenciones:
 * - IDs UUID generados en servidor.
 * - Instantes en timestamptz (UTC). Fechas sin hora (emisión, vigencia) en `date`.
 * - Importes cobrables en unidades menores (centavos) como bigint (`*_minor`).
 * - Cantidades y precios unitarios en NUMERIC exacto (hasta 4 decimales).
 * - Toda tabla con `organization_id` está protegida por RLS (ver migración 0001).
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow();
const minor = (name: string) => bigint(name, { mode: "number" });

// ---------------------------------------------------------------------------
// Autenticación
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    emailVerifiedAt: ts("email_verified_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_unique").on(sql`lower(${t.email})`)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** HMAC-SHA256 del token; el token en claro solo vive en la cookie. */
    tokenHash: text("token_hash").notNull(),
    activeOrganizationId: uuid("active_organization_id"),
    expiresAt: ts("expires_at").notNull(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("sessions_token_hash_unique").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: ts("reset_at").notNull(),
});

// ---------------------------------------------------------------------------
// Organizaciones y membresías
// ---------------------------------------------------------------------------

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    country: text("country").notNull().default("MX"),
    timezone: text("timezone").notNull().default("America/Mexico_City"),
    defaultCurrency: text("default_currency").notNull().default("MXN"),
    /** Preparado para monetización futura; no restringe funciones hoy. */
    plan: text("plan").notNull().default("FREE"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("organizations_slug_unique").on(t.slug)],
);

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    joinedAt: ts("joined_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("memberships_org_user_unique").on(t.organizationId, t.userId),
    index("memberships_user_idx").on(t.userId),
    check("memberships_role_check", sql`${t.role} in ('OWNER','ADMIN','MEMBER')`),
  ],
);

// ---------------------------------------------------------------------------
// Archivos (logos)
// ---------------------------------------------------------------------------

export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    ownerType: text("owner_type").notNull(),
    ownerId: uuid("owner_id"),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    checksum: text("checksum").notNull(),
    visibility: text("visibility").notNull().default("PRIVATE"),
    createdAt: createdAt(),
  },
  (t) => [index("files_org_idx").on(t.organizationId)],
);

/** Contenido binario para el StorageProvider "database". */
export const fileBlobs = pgTable("file_blobs", {
  fileId: uuid("file_id")
    .primaryKey()
    .references(() => files.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  data: bytea("data").notNull(),
});

// ---------------------------------------------------------------------------
// Marcas
// ---------------------------------------------------------------------------

export const brands = pgTable(
  "brands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    legalName: text("legal_name"),
    taxId: text("tax_id"),
    email: text("email"),
    phone: text("phone"),
    website: text("website"),
    address: text("address"),
    contactName: text("contact_name"),
    logoFileId: uuid("logo_file_id").references(() => files.id, { onDelete: "set null" }),
    colorPrimary: text("color_primary").notNull().default("#1C1C1B"),
    colorSecondary: text("color_secondary").notNull().default("#777772"),
    colorAccent: text("color_accent").notNull().default("#2F5DCC"),
    colorText: text("color_text").notNull().default("#1C1C1B"),
    fontFamily: text("font_family").notNull().default("INTER"),
    headerText: text("header_text"),
    footerText: text("footer_text"),
    commercialMessage: text("commercial_message"),
    signatureName: text("signature_name"),
    signatureTitle: text("signature_title"),
    bankName: text("bank_name"),
    bankBeneficiary: text("bank_beneficiary"),
    bankAccount: text("bank_account"),
    bankInstructions: text("bank_instructions"),
    showBankDetails: boolean("show_bank_details").notNull().default(false),
    defaultCurrency: text("default_currency").notNull().default("MXN"),
    defaultTaxMode: text("default_tax_mode").notNull().default("EXCLUSIVE"),
    defaultTaxRate: numeric("default_tax_rate", { precision: 7, scale: 4 }).notNull().default("16"),
    defaultRetentionIvaRate: numeric("default_retention_iva_rate", { precision: 7, scale: 4 }).notNull().default("0"),
    defaultRetentionIsrRate: numeric("default_retention_isr_rate", { precision: 7, scale: 4 }).notNull().default("0"),
    defaultPaymentTerms: text("default_payment_terms"),
    defaultValidityDays: integer("default_validity_days").notNull().default(15),
    quotePrefix: text("quote_prefix").notNull().default("COT"),
    receiptPrefix: text("receipt_prefix").notNull().default("REC"),
    folioPadding: integer("folio_padding").notNull().default(4),
    pdfTemplate: text("pdf_template").notNull().default("MINIMAL"),
    paperSize: text("paper_size").notNull().default("LETTER"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("brands_org_idx").on(t.organizationId),
    uniqueIndex("brands_org_id_unique").on(t.organizationId, t.id),
    check("brands_padding_check", sql`${t.folioPadding} between 1 and 8`),
  ],
);

// ---------------------------------------------------------------------------
// Clientes y catálogo
// ---------------------------------------------------------------------------

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    kind: text("kind"),
    name: text("name").notNull(),
    businessName: text("business_name"),
    taxId: text("tax_id"),
    email: text("email"),
    phone: text("phone"),
    contactName: text("contact_name"),
    address: text("address"),
    notes: text("notes"),
    preferredCurrency: text("preferred_currency"),
    archivedAt: ts("archived_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("clients_org_name_idx").on(t.organizationId, t.name),
    uniqueIndex("clients_org_id_unique").on(t.organizationId, t.id),
  ],
);

export const catalogItems = pgTable(
  "catalog_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id"),
    title: text("title").notNull(),
    description: text("description"),
    unit: text("unit"),
    suggestedPrice: numeric("suggested_price", { precision: 18, scale: 4 }).notNull().default("0"),
    currency: text("currency").notNull().default("MXN"),
    taxMode: text("tax_mode").notNull().default("EXCLUSIVE"),
    taxRate: numeric("tax_rate", { precision: 7, scale: 4 }).notNull().default("16"),
    archivedAt: ts("archived_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("catalog_org_title_idx").on(t.organizationId, t.title)],
);

// ---------------------------------------------------------------------------
// Secuencias de folio
// ---------------------------------------------------------------------------

export const numberSequences = pgTable(
  "number_sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Prefijo normalizado. Marcas que comparten prefijo comparten secuencia: nunca se duplican folios. */
    prefix: text("prefix").notNull(),
    documentType: text("document_type").notNull(),
    year: integer("year").notNull(),
    lastNumber: integer("last_number").notNull().default(0),
  },
  (t) => [uniqueIndex("number_sequences_unique").on(t.organizationId, t.prefix, t.documentType, t.year)],
);

// ---------------------------------------------------------------------------
// Cotizaciones
// ---------------------------------------------------------------------------

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id").notNull(),
    clientId: uuid("client_id"),
    folio: text("folio"),
    sequenceNo: integer("sequence_no"),
    folioYear: integer("folio_year"),
    currentVersionId: uuid("current_version_id"),
    archivedAt: ts("archived_at"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("quotes_org_folio_unique").on(t.organizationId, t.folio),
    uniqueIndex("quotes_org_id_unique").on(t.organizationId, t.id),
    index("quotes_org_updated_idx").on(t.organizationId, t.updatedAt),
  ],
);

export const quoteVersions = pgTable(
  "quote_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    status: text("status").notNull().default("DRAFT"),
    /** Revisión para control optimista de concurrencia (autoguardado). */
    revision: integer("revision").notNull().default(1),
    title: text("title"),
    serviceDescription: text("service_description"),
    location: text("location"),
    duration: text("duration"),
    responsible: text("responsible"),
    issueDate: date("issue_date", { mode: "string" }),
    validUntil: date("valid_until", { mode: "string" }),
    currency: text("currency").notNull().default("MXN"),
    paymentTerms: text("payment_terms"),
    validityTerms: text("validity_terms"),
    publicNotes: text("public_notes"),
    internalNotes: text("internal_notes"),
    showUnitPrices: boolean("show_unit_prices").notNull().default(true),
    showOnlyGrandTotal: boolean("show_only_grand_total").notNull().default(false),
    pdfTemplate: text("pdf_template"),
    paperSize: text("paper_size"),
    snapshotJson: jsonb("snapshot_json"),
    grossMinor: minor("gross_minor").notNull().default(0),
    discountMinor: minor("discount_minor").notNull().default(0),
    subtotalMinor: minor("subtotal_minor").notNull().default(0),
    taxMinor: minor("tax_minor").notNull().default(0),
    retentionIvaRate: numeric("retention_iva_rate", { precision: 7, scale: 4 }).notNull().default("0"),
    retentionIsrRate: numeric("retention_isr_rate", { precision: 7, scale: 4 }).notNull().default("0"),
    retentionMinor: minor("retention_minor").notNull().default(0),
    totalMinor: minor("total_minor").notNull().default(0),
    isLocked: boolean("is_locked").notNull().default(false),
    lockReason: text("lock_reason"),
    sentAt: ts("sent_at"),
    approvedAt: ts("approved_at"),
    rejectedAt: ts("rejected_at"),
    expiredAt: ts("expired_at"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("quote_versions_number_unique").on(t.quoteId, t.versionNumber),
    index("quote_versions_org_status_idx").on(t.organizationId, t.status),
    check(
      "quote_versions_status_check",
      sql`${t.status} in ('DRAFT','SENT','APPROVED','REJECTED','EXPIRED')`,
    ),
    check("quote_versions_currency_check", sql`${t.currency} in ('MXN','USD')`),
    check("quote_versions_totals_check", sql`${t.totalMinor} >= 0 and ${t.taxMinor} >= 0`),
    check(
      "quote_versions_retention_check",
      sql`${t.retentionMinor} >= 0 and ${t.retentionIvaRate} between 0 and 100 and ${t.retentionIsrRate} between 0 and 100`,
    ),
  ],
);

export const quoteGroups = pgTable(
  "quote_groups",
  {
    id: uuid("id").primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    quoteVersionId: uuid("quote_version_id")
      .notNull()
      .references(() => quoteVersions.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    position: integer("position").notNull(),
    showSubtotal: boolean("show_subtotal").notNull().default(true),
  },
  (t) => [index("quote_groups_version_idx").on(t.quoteVersionId)],
);

export const quoteItems = pgTable(
  "quote_items",
  {
    id: uuid("id").primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    quoteVersionId: uuid("quote_version_id")
      .notNull()
      .references(() => quoteVersions.id, { onDelete: "cascade" }),
    groupId: uuid("group_id"),
    position: integer("position").notNull(),
    description: text("description").notNull().default(""),
    unit: text("unit"),
    quantity: numeric("quantity", { precision: 18, scale: 4 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 18, scale: 4 }).notNull(),
    discountType: text("discount_type").notNull().default("NONE"),
    discountValue: numeric("discount_value", { precision: 18, scale: 4 }).notNull().default("0"),
    taxMode: text("tax_mode").notNull().default("NONE"),
    taxRate: numeric("tax_rate", { precision: 7, scale: 4 }).notNull().default("0"),
    grossMinor: minor("gross_minor").notNull(),
    discountMinor: minor("discount_minor").notNull(),
    netMinor: minor("net_minor").notNull(),
    taxMinor: minor("tax_minor").notNull(),
    totalMinor: minor("total_minor").notNull(),
    hideUnitPriceInPdf: boolean("hide_unit_price_in_pdf").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("quote_items_version_idx").on(t.quoteVersionId, t.position),
    check("quote_items_quantity_check", sql`${t.quantity} > 0`),
    check("quote_items_price_check", sql`${t.unitPrice} >= 0`),
    check("quote_items_discount_type_check", sql`${t.discountType} in ('NONE','PERCENT','FIXED')`),
    check("quote_items_tax_mode_check", sql`${t.taxMode} in ('NONE','EXCLUSIVE','INCLUSIVE')`),
    check("quote_items_amounts_check", sql`${t.netMinor} >= 0 and ${t.totalMinor} >= 0 and ${t.taxMinor} >= 0`),
  ],
);

// ---------------------------------------------------------------------------
// Campos personalizados
// ---------------------------------------------------------------------------

export const customFieldDefinitions = pgTable(
  "custom_field_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id"),
    fieldKey: text("field_key").notNull(),
    label: text("label").notNull(),
    type: text("type").notNull(),
    optionsJson: jsonb("options_json").$type<string[]>(),
    required: boolean("required").notNull().default(false),
    visibleInPdf: boolean("visible_in_pdf").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    archivedAt: ts("archived_at"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("custom_fields_org_key_unique").on(t.organizationId, t.fieldKey),
    check(
      "custom_fields_type_check",
      sql`${t.type} in ('short_text','long_text','number','date','select','checkbox')`,
    ),
  ],
);

export const quoteCustomValues = pgTable(
  "quote_custom_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    quoteVersionId: uuid("quote_version_id")
      .notNull()
      .references(() => quoteVersions.id, { onDelete: "cascade" }),
    fieldKey: text("field_key").notNull(),
    definitionSnapshotJson: jsonb("definition_snapshot_json").notNull(),
    valueJson: jsonb("value_json"),
  },
  (t) => [uniqueIndex("quote_custom_values_unique").on(t.quoteVersionId, t.fieldKey)],
);

// ---------------------------------------------------------------------------
// Recibos
// ---------------------------------------------------------------------------

export const receipts = pgTable(
  "receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id").notNull(),
    clientId: uuid("client_id"),
    quoteId: uuid("quote_id"),
    quoteVersionId: uuid("quote_version_id"),
    receiptNo: integer("receipt_no").notNull(),
    year: integer("year").notNull(),
    folio: text("folio").notNull(),
    payerName: text("payer_name").notNull(),
    concept: text("concept").notNull(),
    paymentMethod: text("payment_method").notNull(),
    paymentReference: text("payment_reference"),
    receivedAt: ts("received_at").notNull(),
    currency: text("currency").notNull(),
    /** Importe total recibido (lo que cuenta para el saldo). */
    amountMinor: minor("amount_minor").notNull(),
    taxTreatment: text("tax_treatment").notNull().default("NONE"),
    taxRate: numeric("tax_rate", { precision: 7, scale: 4 }).notNull().default("0"),
    netMinor: minor("net_minor").notNull(),
    taxMinor: minor("tax_minor").notNull(),
    notesPublic: text("notes_public"),
    notesInternal: text("notes_internal"),
    signatureName: text("signature_name"),
    status: text("status").notNull().default("ISSUED"),
    voidReason: text("void_reason"),
    voidedAt: ts("voided_at"),
    voidedBy: uuid("voided_by").references(() => users.id, { onDelete: "set null" }),
    idempotencyKey: text("idempotency_key").notNull(),
    snapshotJson: jsonb("snapshot_json").notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("receipts_org_folio_unique").on(t.organizationId, t.folio),
    uniqueIndex("receipts_org_idempotency_unique").on(t.organizationId, t.idempotencyKey),
    index("receipts_org_created_idx").on(t.organizationId, t.createdAt),
    index("receipts_quote_idx").on(t.quoteId),
    check("receipts_amount_check", sql`${t.amountMinor} > 0`),
    check("receipts_status_check", sql`${t.status} in ('ISSUED','VOID')`),
    check("receipts_currency_check", sql`${t.currency} in ('MXN','USD')`),
    check("receipts_method_check", sql`${t.paymentMethod} in ('TRANSFER','CASH','CARD','CHECK','OTHER')`),
    check("receipts_tax_check", sql`${t.taxTreatment} in ('NONE','INCLUDED','ADDED')`),
  ],
);

// ---------------------------------------------------------------------------
// Auditoría
// ---------------------------------------------------------------------------

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id"),
    safeMetadataJson: jsonb("safe_metadata_json"),
    occurredAt: ts("occurred_at").notNull().defaultNow(),
  },
  (t) => [index("audit_org_occurred_idx").on(t.organizationId, t.occurredAt)],
);
