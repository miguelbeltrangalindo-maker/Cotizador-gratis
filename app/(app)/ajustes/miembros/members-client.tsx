"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { addMemberAction, changeMemberRoleAction, removeMemberAction } from "@/features/organizations/actions";
import type { Role } from "@/lib/security/tenant";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Alert, Card } from "@/components/ui/misc";
import { ConfirmDialog, SubmitButton } from "@/components/ui/client";

export function MemberRow({ id, name, email, role }: { id: string; name: string; email: string; role: Role }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="break-anywhere font-medium">{name}</p>
          <p className="break-anywhere text-sm text-muted">{email}</p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={`role-${id}`} className="sr-only">
            Rol de {name}
          </label>
          <select
            id={`role-${id}`}
            className="control w-auto"
            defaultValue={role}
            onChange={async (e) => {
              setError(null);
              const res = await changeMemberRoleAction(id, e.target.value as Role);
              if (!res.ok) setError(res.message);
              router.refresh();
            }}
          >
            <option value="OWNER">Propietario</option>
            <option value="ADMIN">Administrador</option>
            <option value="MEMBER">Colaborador</option>
          </select>
          <ConfirmDialog
            title={`¿Quitar a ${name}?`}
            description="Perderá acceso a esta organización. Sus documentos se conservan."
            confirmLabel="Quitar"
            onConfirm={async () => {
              const res = await removeMemberAction(id);
              if (!res.ok) {
                setError(res.message);
                throw new Error(res.message);
              }
              router.refresh();
            }}
            trigger={(open) => (
              <Button variant="ghost" size="sm" className="text-danger" onClick={open}>
                Quitar
              </Button>
            )}
          />
        </div>
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}

export function AddMemberForm() {
  const [state, action] = useActionState(addMemberAction, null);
  return (
    <Card className="mt-5">
      <form action={action} className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Agregar integrante</h2>
        <p className="text-sm text-muted">
          La persona debe tener una cuenta registrada. Las invitaciones por correo requieren configurar un servidor de correo (fase posterior).
        </p>
        {state ? <Alert tone={state.ok ? "success" : "danger"}>{state.ok ? "Integrante agregado." : state.message}</Alert> : null}
        <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
          <Field label="Correo de la cuenta" htmlFor="m-email">
            <Input id="m-email" name="email" type="email" required />
          </Field>
          <Field label="Rol" htmlFor="m-role">
            <Select id="m-role" name="role" defaultValue="MEMBER">
              <option value="MEMBER">Colaborador</option>
              <option value="ADMIN">Administrador</option>
            </Select>
          </Field>
        </div>
        <SubmitButton>Agregar</SubmitButton>
      </form>
    </Card>
  );
}
