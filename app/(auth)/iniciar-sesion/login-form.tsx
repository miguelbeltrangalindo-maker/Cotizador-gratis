"use client";

import { useActionState } from "react";
import { loginAction } from "@/features/auth/actions";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/client";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(loginAction, null);
  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      {state && !state.ok ? <Alert tone="danger">{state.message}</Alert> : null}
      <input type="hidden" name="next" value={next} />
      <Field label="Correo electrónico" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
      </Field>
      <Field label="Contraseña" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton pendingText="Ingresando…" className="mt-2 w-full">
        Iniciar sesión
      </SubmitButton>
    </form>
  );
}
