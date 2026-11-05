import type { NextRequest } from "next/server";
import { fileResponse, privateRoute } from "@/lib/http";
import { renderQuotePdf } from "@/features/documents/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  const v = Number(sp.get("v"));
  return privateRoute({ key: "pdf", limit: 60, windowSeconds: 60 }, async (ctx) => {
    const { buffer, filename } = await renderQuotePdf(ctx, id, Number.isInteger(v) && v > 0 ? v : undefined);
    return fileResponse(buffer, { contentType: "application/pdf", filename, download: sp.get("descargar") === "1" });
  });
}
