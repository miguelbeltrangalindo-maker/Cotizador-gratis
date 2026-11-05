import { jsonError, privateRoute } from "@/lib/http";
import { exportCsv, type ExportKind } from "@/features/documents/export";
import { todayInTimeZone } from "@/lib/utils/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS: ExportKind[] = ["clientes", "cotizaciones", "recibos"];

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!KINDS.includes(kind as ExportKind)) return jsonError("NOT_FOUND", "Exportación no disponible.");
  return privateRoute({ key: "export", limit: 20, windowSeconds: 60 * 10 }, async (ctx) => {
    const csv = await exportCsv(ctx, kind as ExportKind);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${kind}_${todayInTimeZone(ctx.timezone)}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  });
}
