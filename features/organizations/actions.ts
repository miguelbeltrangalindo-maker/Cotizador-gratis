"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formString, runAction } from "@/lib/action";
import type { ActionResult } from "@/lib/errors";
import type { Role } from "@/lib/security/tenant";
import { requireTenant, requireUser } from "@/lib/session";
import { setSessionActiveOrganization } from "@/features/auth/service";
import { createBrand } from "@/features/brands/service";
import { suggestPrefix } from "@/lib/utils/folio";
import {
  addMember,
  assertOrganizationMember,
  changeMemberRole,
  createOrganization,
  removeMember,
  updateOrganization,
} from "./service";

export interface OnboardingInput {
  organization: { name: string; timezone: string; defaultCurrency: "MXN" | "USD" };
  brand: { name: string; colorPrimary: string; defaultCurrency: "MXN" | "USD"; quotePrefix: string; defaultTaxRate: number; defaultTaxMode: "NONE" | "EXCLUSIVE" | "INCLUSIVE" };
}

/** Onboarding: crea organización (OWNER) y primera marca; activa la organización en la sesión. */
export async function completeOnboardingAction(input: OnboardingInput): Promise<ActionResult<{ brandId: string }>> {
  return runAction(async () => {
    const session = await requireUser();
    const { id } = await createOrganization(session.userId, {
      name: input.organization.name,
      timezone: input.organization.timezone as never,
      defaultCurrency: input.organization.defaultCurrency,
      country: "MX",
    });
    await setSessionActiveOrganization(session.sessionId, id);
    const ctx = await assertOrganizationMember(session.userId, id);
    const brand = await createBrand(ctx, {
      name: input.brand.name || input.organization.name,
      colorPrimary: input.brand.colorPrimary,
      defaultCurrency: input.brand.defaultCurrency,
      quotePrefix: input.brand.quotePrefix || suggestPrefix(input.brand.name || input.organization.name),
      defaultTaxRate: input.brand.defaultTaxRate,
      defaultTaxMode: input.brand.defaultTaxMode,
    });
    return { brandId: brand.id };
  });
}

export async function switchOrganizationAction(fd: FormData) {
  const session = await requireUser();
  const orgId = formString(fd, "organizationId");
  const ctx = await assertOrganizationMember(session.userId, orgId);
  await setSessionActiveOrganization(session.sessionId, ctx.organizationId);
  redirect("/inicio");
}

export async function updateOrganizationAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx } = await requireTenant();
    await updateOrganization(ctx, {
      name: formString(fd, "name"),
      timezone: formString(fd, "timezone") as never,
      defaultCurrency: formString(fd, "defaultCurrency") as "MXN" | "USD",
      country: formString(fd, "country") || "MX",
    });
    revalidatePath("/", "layout");
  });
}

export async function addMemberAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx } = await requireTenant();
    await addMember(ctx, { email: formString(fd, "email"), role: formString(fd, "role") as "ADMIN" | "MEMBER" });
    revalidatePath("/ajustes/miembros");
  });
}

export async function changeMemberRoleAction(membershipId: string, role: Role): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx } = await requireTenant();
    await changeMemberRole(ctx, membershipId, role);
    revalidatePath("/ajustes/miembros");
  });
}

export async function removeMemberAction(membershipId: string): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx } = await requireTenant();
    await removeMember(ctx, membershipId);
    revalidatePath("/ajustes/miembros");
  });
}
