"use client";

import { useActionState } from "react";
import { registerAction } from "@/features/auth/actions";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/client";

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, null);
  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
      {state && !state.ok ? <Alert tone="danger">{state.message}</Alert> : null}
      <Field label="Nombre" htmlFor="name" error={fe.name} required>
        <Input id="name" name="name" autoComplete="name" required invalid={!!fe.name} maxLength={120} />
      </Field>
      <Field label="Correo electrónico" htmlFor="email" error={fe.email} required>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required invalid={!!fe.email} />
      </Field>
      <Field label="Contraseña" htmlFor="password" error={fe.password} hint="Mínimo 10 caracteres, con letras y números." required>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} invalid={!!fe.password} />
      </Field>
      <SubmitButton pendingText="Creando cuenta…" className="mt-2 w-full">
        Crear cuenta
      </SubmitButton>
    </form>
  );
}
