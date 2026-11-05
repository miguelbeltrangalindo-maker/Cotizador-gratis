import { auditLogs } from "@/lib/db/schema";
import type { Tx } from "@/lib/db";
import type { TenantContext } from "@/lib/security/tenant";

export type AuditAction =
  | "organization.create"
  | "organization.update"
  | "member.add"
  | "member.role_change"
  | "member.remove"
  | "brand.create"
  | "brand.update"
  | "brand.logo_upload"
  | "client.create"
  | "client.update"
  | "client.archive"
  | "catalog.create"
  | "catalog.update"
  | "quote.create"
  | "quote.status_change"
  | "quote.version_create"
  | "quote.duplicate"
  | "quote.archive"
  | "receipt.issue"
  | "receipt.void";

/** Registra un evento de auditoría. No guardar contraseñas, tokens ni datos bancarios. */
export async function audit(
  tx: Tx,
  ctx: Pick<TenantContext, "organizationId" | "userId">,
  action: AuditAction,
  targetType: string,
  targetId: string | null,
  metadata?: Record<string, string | number | boolean | null>,
) {
  await tx.insert(auditLogs).values({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action,
    targetType,
    targetId,
    safeMetadataJson: metadata ?? null,
  });
}
