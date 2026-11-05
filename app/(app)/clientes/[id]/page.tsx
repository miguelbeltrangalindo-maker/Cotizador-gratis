import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/session";
import { AppError } from "@/lib/errors";
import { getClient } from "@/features/clients/service";
import { Alert, PageHeader } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { ClientForm } from "../client-form";
import { ArchiveClientButton } from "./archive-button";

export const metadata: Metadata = { title: "Cliente" };

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ guardado?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { ctx } = await requireTenant();
  const client = await getClient(ctx, id).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        back={{ href: "/clientes", label: "Clientes" }}
        title={client.name}
        actions={
          <>
            <ButtonLink href={`/cotizaciones/nueva?cliente=${client.id}`}>Cotizar</ButtonLink>
            <ButtonLink href={`/cotizaciones?q=${encodeURIComponent(client.name)}`} variant="secondary">
              Ver cotizaciones
            </ButtonLink>
          </>
        }
      />
      {sp.guardado ? (
        <div className="mb-4">
          <Alert tone="success">Cliente guardado.</Alert>
        </div>
      ) : null}
      {client.archivedAt ? (
        <div className="mb-4">
          <Alert tone="warning">Cliente archivado. Sus documentos históricos se conservan.</Alert>
        </div>
      ) : null}
      <ClientForm client={client} />
      <div className="mt-4">
        <ArchiveClientButton clientId={client.id} archived={Boolean(client.archivedAt)} />
      </div>
    </div>
  );
}
