"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formString, runAction } from "@/lib/action";
import type { ActionResult } from "@/lib/errors";
import { requireTenant } from "@/lib/session";
import { archiveClient, createClient, findSimilarClients, listClients, updateClient, type ClientInput } from "./service";

function fromForm(fd: FormData): ClientInput {
  return {
    kind: (formString(fd, "kind") || null) as ClientInput["kind"],
    name: formString(fd, "name"),
    businessName: formString(fd, "businessName"),
    taxId: formString(fd, "taxId"),
    email: formString(fd, "email"),
    phone: formString(fd, "phone"),
    contactName: formString(fd, "contactName"),
    address: formString(fd, "address"),
    notes: formString(fd, "notes"),
    preferredCurrency: (formString(fd, "preferredCurrency") || null) as ClientInput["preferredCurrency"],
  };
}

export async function saveClientAction(clientId: string | null, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const res = await runAction(async () => {
    const { ctx } = await requireTenant();
    const input = fromForm(fd);
    return clientId ? updateClient(ctx, clientId, input) : createClient(ctx, input);
  });
  if (res.ok) {
    revalidatePath("/clientes");
    redirect(`/clientes/${res.data.id}?guardado=1`);
  }
  return res;
}

export async function archiveClientAction(clientId: string, archived: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx } = await requireTenant();
    await archiveClient(ctx, clientId, archived);
    revalidatePath("/clientes");
    revalidatePath(`/clientes/${clientId}`);
  });
}

export async function searchClientsAction(q: string) {
  const { ctx } = await requireTenant();
  const { rows } = await listClients(ctx, { q, pageSize: 10 });
  return rows.map((c) => ({ id: c.id, name: c.name, businessName: c.businessName, taxId: c.taxId, email: c.email, preferredCurrency: c.preferredCurrency }));
}

/** Alta rápida desde el editor de cotización o recibo. */
export async function quickCreateClientAction(input: ClientInput) {
  return runAction(async () => {
    const { ctx } = await requireTenant();
    const c = await createClient(ctx, input);
    return { id: c.id, name: c.name, businessName: c.businessName, taxId: c.taxId, email: c.email, preferredCurrency: c.preferredCurrency };
  });
}

export async function findSimilarClientsAction(input: { name: string; taxId?: string | null; email?: string | null }) {
  const { ctx } = await requireTenant();
  if (!input.name.trim()) return [];
  return findSimilarClients(ctx, input);
}
