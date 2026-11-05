"use client";

import { useRouter } from "next/navigation";
import { archiveClientAction } from "@/features/clients/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/client";

export function ArchiveClientButton({ clientId, archived }: { clientId: string; archived: boolean }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      title={archived ? "¿Restaurar cliente?" : "¿Archivar cliente?"}
      description={archived ? "Volverá a aparecer en búsquedas." : "No se borra: sus cotizaciones y recibos se conservan. Dejará de aparecer en búsquedas."}
      confirmLabel={archived ? "Restaurar" : "Archivar"}
      tone="primary"
      onConfirm={async () => {
        await archiveClientAction(clientId, !archived);
        router.refresh();
      }}
      trigger={(open) => (
        <Button variant="ghost" onClick={open}>
          {archived ? "Restaurar cliente" : "Archivar cliente"}
        </Button>
      )}
    />
  );
}
