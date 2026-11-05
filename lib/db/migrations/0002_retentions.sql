ALTER TABLE "brands" ADD COLUMN "default_retention_iva_rate" numeric(7, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "default_retention_isr_rate" numeric(7, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "retention_iva_rate" numeric(7, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "retention_isr_rate" numeric(7, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "retention_minor" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_retention_check" CHECK ("quote_versions"."retention_minor" >= 0 and "quote_versions"."retention_iva_rate" between 0 and 100 and "quote_versions"."retention_isr_rate" between 0 and 100);