"use client";

import { useActionState, useState } from "react";
import { createQuoteAction } from "@/features/quotes/actions";
import { Field, Select } from "@/components/ui/field";
import { Alert, Card } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/client";
import { ClientPicker, type ClientOption } from "@/components/domain/client-picker";

export function NewQuoteForm({ brands, initialClient }: { brands: Array<{ id: string; name: string }>; initialClient: ClientOption | null }) {
  const [state, action] = useActionState(createQuoteAction, null);
  const [client, setClient] = useState<ClientOption | null>(initialClient);
  return (
    <form action={action}>
      <Card className="flex flex-col gap-4">
        {state && !state.ok ? <Alert tone="danger">{state.message}</Alert> : null}
        <ClientPicker value={client} onChange={setClient} label="Cliente (opcional en borrador)" />
        <input type="hidden" name="clientId" value={client?.id ?? ""} />
        {brands.length > 1 ? (
          <Field label="Marca emisora" htmlFor="brandId">
            <Select id="brandId" name="brandId" defaultValue={brands[0].id}>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <>
            <input type="hidden" name="brandId" value={brands[0].id} />
            <p className="text-sm text-muted">
              Marca emisora: <span className="font-medium text-text">{brands[0].name}</span>
            </p>
          </>
        )}
        <SubmitButton pendingText="Creando…" className="w-full">
          Crear y agregar conceptos
        </SubmitButton>
      </Card>
    </form>
  );
}
