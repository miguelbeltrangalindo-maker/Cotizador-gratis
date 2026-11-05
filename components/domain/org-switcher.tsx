import Link from "next/link";
import { switchOrganizationAction } from "@/features/organizations/actions";
import type { MyOrganization } from "@/features/organizations/service";

export function OrgSwitcher({ organizations, activeId }: { organizations: MyOrganization[]; activeId: string }) {
  const active = organizations.find((o) => o.id === activeId);
  if (organizations.length <= 1) {
    return (
      <div className="rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2">
        <p className="text-xs text-muted">Organización</p>
        <p className="break-anywhere font-medium">{active?.name}</p>
      </div>
    );
  }
  return (
    <div className="rounded-[var(--radius-sm)] border border-border bg-surface p-3">
      <p className="mb-1 text-xs text-muted">Organización activa</p>
      <ul className="flex flex-col gap-1">
        {organizations.map((o) => (
          <li key={o.id}>
            {o.id === activeId ? (
              <p className="break-anywhere font-medium" aria-current="true">
                ● {o.name}
              </p>
            ) : (
              <form action={switchOrganizationAction}>
                <input type="hidden" name="organizationId" value={o.id} />
                <button type="submit" className="min-h-9 break-anywhere text-left text-sm text-link hover:underline">
                  {o.name}
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
      <Link href="/bienvenida?nueva=1" className="mt-2 block text-xs text-muted hover:underline">
        + Nueva organización
      </Link>
    </div>
  );
}
