"use client";

import { useActionState } from "react";
import { updateOrganizationAction } from "@/features/organizations/actions";
import { TIMEZONE_OPTIONS } from "@/lib/timezones";
import { Field, Input, Select } from "@/components/ui/field";
import { Alert, Card } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/client";

export function OrganizationForm({ org, canEdit }: { org: { name: string; timezone: string; defaultCurrency: string; country: string }; canEdit: boolean }) {
  const [state, action] = useActionState(updateOrganizationAction, null);
  return (
    <Card>
      <form action={action} className="flex flex-col gap-4">
        {!canEdit ? <Alert tone="info">Solo el propietario puede modificar la organización.</Alert> : null}
        {state ? <Alert tone={state.ok ? "success" : "danger"}>{state.ok ? "Organización actualizada." : state.message}</Alert> : null}
        <fieldset disabled={!canEdit} className="flex flex-col gap-4">
          <Field label="Nombre" htmlFor="o-name">
            <Input id="o-name" name="name" defaultValue={org.name} required maxLength={160} />
          </Field>
          <Field label="País" htmlFor="o-country">
            <Select id="o-country" name="country" defaultValue={org.country}>
              <option value="MX">México</option>
              <option value="US">Estados Unidos</option>
              <option value="CO">Colombia</option>
              <option value="ES">España</option>
            </Select>
          </Field>
          <Field label="Zona horaria" htmlFor="o-tz" hint="Se usa para fechas y para el año de los folios.">
            <Select id="o-tz" name="timezone" defaultValue={org.timezone}>
              {TIMEZONE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Moneda predeterminada" htmlFor="o-cur">
            <Select id="o-cur" name="defaultCurrency" defaultValue={org.defaultCurrency}>
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
            </Select>
          </Field>
          {canEdit ? <SubmitButton>Guardar</SubmitButton> : null}
        </fieldset>
      </form>
    </Card>
  );
}
