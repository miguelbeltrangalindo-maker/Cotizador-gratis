import type { Metadata } from "next";
import { requireTenant } from "@/lib/session";
import { PageHeader } from "@/components/ui/misc";
import { ProfileForms } from "./profile-forms";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function ProfilePage() {
  const { session } = await requireTenant();
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader back={{ href: "/ajustes", label: "Ajustes" }} title="Mi perfil" />
      <ProfileForms name={session.name} email={session.email} />
    </div>
  );
}
