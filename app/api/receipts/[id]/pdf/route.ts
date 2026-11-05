import type { NextRequest } from "next/server";
import { fileResponse, privateRoute } from "@/lib/http";
import { renderReceiptPdf } from "@/features/documents/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return privateRoute({ key: "pdf", limit: 60, windowSeconds: 60 }, async (ctx) => {
    const { buffer, filename } = await renderReceiptPdf(ctx, id);
    return fileResponse(buffer, { contentType: "application/pdf", filename, download: req.nextUrl.searchParams.get("descargar") === "1" });
  });
}
