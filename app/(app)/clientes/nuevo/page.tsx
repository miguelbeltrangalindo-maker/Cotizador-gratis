import type { Metadata } from "next";
import { requireTenant } from "@/lib/session";
import { PageHeader } from "@/components/ui/misc";
import { ClientForm } from "../client-form";

export const metadata: Metadata = { title: "Nuevo cliente" };

export default async function NewClientPage() {
  await requireTenant();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back={{ href: "/clientes", label: "Clientes" }} title="Nuevo cliente" />
      <ClientForm client={null} />
    </div>
  );
}
