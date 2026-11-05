"use client";

import { useActionState } from "react";
import { changePasswordAction, updateProfileAction } from "@/features/auth/actions";
import { Field, Input } from "@/components/ui/field";
import { Alert, Card } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/client";

export function ProfileForms({ name, email }: { name: string; email: string }) {
  const [p, profileAction] = useActionState(updateProfileAction, null);
  const [pw, passwordAction] = useActionState(changePasswordAction, null);
  const pwe = pw && !pw.ok ? pw.fieldErrors ?? {} : {};
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <form action={profileAction} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Datos</h2>
          {p ? <Alert tone={p.ok ? "success" : "danger"}>{p.ok ? "Perfil actualizado." : p.message}</Alert> : null}
          <Field label="Nombre" htmlFor="p-name">
            <Input id="p-name" name="name" defaultValue={name} required maxLength={120} />
          </Field>
          <Field label="Correo" htmlFor="p-email" hint="El correo identifica tu cuenta y no se puede cambiar en esta versión.">
            <Input id="p-email" value={email} disabled readOnly />
          </Field>
          <SubmitButton>Guardar</SubmitButton>
        </form>
      </Card>
      <Card>
        <form action={passwordAction} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Cambiar contraseña</h2>
          {pw ? <Alert tone={pw.ok ? "success" : "danger"}>{pw.ok ? "Contraseña actualizada." : pw.message}</Alert> : null}
          <Field label="Contraseña actual" htmlFor="p-cur" error={pwe.currentPassword}>
            <Input id="p-cur" name="currentPassword" type="password" autoComplete="current-password" required />
          </Field>
          <Field label="Nueva contraseña" htmlFor="p-new" hint="Mínimo 10 caracteres, con letras y números." error={pwe.newPassword}>
            <Input id="p-new" name="newPassword" type="password" autoComplete="new-password" required />
          </Field>
          <Field label="Confirmar nueva contraseña" htmlFor="p-conf" error={pwe.confirmPassword}>
            <Input id="p-conf" name="confirmPassword" type="password" autoComplete="new-password" required />
          </Field>
          <SubmitButton>Cambiar contraseña</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
