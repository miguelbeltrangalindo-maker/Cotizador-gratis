"use client";

import { useActionState } from "react";
import { saveClientAction } from "@/features/clients/actions";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert, Card } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/client";

interface ClientRow {
  id: string;
  kind: string | null;
  name: string;
  businessName: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  contactName: string | null;
  address: string | null;
  notes: string | null;
  preferredCurrency: string | null;
}

export function ClientForm({ client }: { client: ClientRow | null }) {
  const [state, action] = useActionState(saveClientAction.bind(null, client?.id ?? null), null);
  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form action={action}>
      <Card className="flex flex-col gap-4">
        {state && !state.ok ? <Alert tone="danger">{state.message}</Alert> : null}
        <Field label="Nombre visible" htmlFor="c-name" required error={fe.name}>
          <Input id="c-name" name="name" defaultValue={client?.name} required maxLength={200} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo" htmlFor="c-kind">
            <Select id="c-kind" name="kind" defaultValue={client?.kind ?? ""}>
              <option value="">Sin especificar</option>
              <option value="PERSON">Persona</option>
              <option value="COMPANY">Empresa</option>
            </Select>
          </Field>
          <Field label="Razón social" htmlFor="c-business">
            <Input id="c-business" name="businessName" defaultValue={client?.businessName ?? ""} maxLength={250} />
          </Field>
          <Field label="RFC" htmlFor="c-rfc" error={fe.taxId}>
            <Input id="c-rfc" name="taxId" defaultValue={client?.taxId ?? ""} maxLength={13} className="uppercase" />
          </Field>
          <Field label="Correo" htmlFor="c-email" error={fe.email}>
            <Input id="c-email" name="email" type="email" defaultValue={client?.email ?? ""} />
          </Field>
          <Field label="Teléfono" htmlFor="c-phone">
            <Input id="c-phone" name="phone" type="tel" defaultValue={client?.phone ?? ""} />
          </Field>
          <Field label="Persona de contacto" htmlFor="c-contact">
            <Input id="c-contact" name="contactName" defaultValue={client?.contactName ?? ""} />
          </Field>
          <Field label="Moneda preferida" htmlFor="c-cur">
            <Select id="c-cur" name="preferredCurrency" defaultValue={client?.preferredCurrency ?? ""}>
              <option value="">Usar la de la marca</option>
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
            </Select>
          </Field>
        </div>
        <Field label="Dirección" htmlFor="c-address">
          <Textarea id="c-address" name="address" defaultValue={client?.address ?? ""} rows={2} />
        </Field>
        <Field label="Notas internas" htmlFor="c-notes" hint="No aparecen en documentos.">
          <Textarea id="c-notes" name="notes" defaultValue={client?.notes ?? ""} rows={3} />
        </Field>
        <SubmitButton>{client ? "Guardar cambios" : "Crear cliente"}</SubmitButton>
      </Card>
    </form>
  );
}
