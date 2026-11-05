import type { NextRequest } from "next/server";
import { fileResponse, privateRoute } from "@/lib/http";
import { renderBrandSamplePdf } from "@/features/documents/render";
import { PAPER_SIZES, PDF_TEMPLATES, type PaperSize, type PdfTemplate } from "@/features/brands/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  const kind = sp.get("tipo") === "recibo" ? "receipt" : "quote";
  const tpl = PDF_TEMPLATES.includes(sp.get("estilo") as PdfTemplate) ? (sp.get("estilo") as PdfTemplate) : undefined;
  const paper = PAPER_SIZES.includes(sp.get("papel") as PaperSize) ? (sp.get("papel") as PaperSize) : undefined;
  return privateRoute({ key: "pdf", limit: 60, windowSeconds: 60 }, async (ctx) => {
    const { buffer, filename } = await renderBrandSamplePdf(ctx, id, kind, tpl, paper);
    return fileResponse(buffer, { contentType: "application/pdf", filename });
  });
}
