import type { Metadata } from "next";
import { requireTenant } from "@/lib/session";
import { can, ROLE_LABEL } from "@/lib/security/tenant";
import { listMembers } from "@/features/organizations/service";
import { Card, PageHeader } from "@/components/ui/misc";
import { formatInstant } from "@/lib/utils/dates";
import { AddMemberForm, MemberRow } from "./members-client";

export const metadata: Metadata = { title: "Usuarios y permisos" };

export default async function MembersPage() {
  const { ctx } = await requireTenant();
  const members = await listMembers(ctx);
  const manage = can(ctx.role, "members.manage");
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back={{ href: "/ajustes", label: "Ajustes" }} title="Usuarios y permisos" subtitle={`${members.length} integrante${members.length === 1 ? "" : "s"}`} />
      <ul className="card divide-y divide-border">
        {members.map((m) => (
          <li key={m.id} className="p-4">
            {manage && m.userId !== ctx.userId ? (
              <MemberRow id={m.id} name={m.name} email={m.email} role={m.role} />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-anywhere font-medium">
                    {m.name} {m.userId === ctx.userId ? <span className="text-muted">(tú)</span> : null}
                  </p>
                  <p className="break-anywhere text-sm text-muted">{m.email}</p>
                </div>
                <span className="text-sm">
                  {ROLE_LABEL[m.role]} · desde {formatInstant(m.joinedAt, ctx.timezone, false)}
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
      <Card className="mt-5">
        <h2 className="text-lg font-semibold">Roles</h2>
        <ul className="mt-2 list-disc pl-5 text-sm text-muted">
          <li>
            <strong className="text-text">Propietario:</strong> control total, incluida la organización y sus integrantes.
          </li>
          <li>
            <strong className="text-text">Administrador:</strong> marcas, clientes, catálogo, cotizaciones, recibos (incluye anular) y exportaciones.
          </li>
          <li>
            <strong className="text-text">Colaborador:</strong> crea y edita cotizaciones, recibos y clientes; no modifica configuración crítica.
          </li>
        </ul>
      </Card>
      {manage ? <AddMemberForm /> : null}
    </div>
  );
}
