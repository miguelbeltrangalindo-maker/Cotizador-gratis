import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { listMyOrganizations } from "@/features/organizations/service";
import { AppMark } from "@/components/domain/app-mark";
import { OnboardingWizard } from "./wizard";

export const metadata: Metadata = { title: "Configura tu empresa" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ nueva?: string }> }) {
  const session = await requireUser();
  const sp = await searchParams;
  const orgs = await listMyOrganizations(session.userId);
  if (orgs.length > 0 && !sp.nueva) redirect("/inicio");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-8" style={{ paddingTop: "calc(var(--safe-top) + 24px)" }}>
      <div className="mb-6">
        <AppMark />
      </div>
      <OnboardingWizard userName={session.name} isAdditional={orgs.length > 0} />
    </main>
  );
}
