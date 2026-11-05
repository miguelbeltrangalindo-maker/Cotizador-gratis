import { fileResponse, privateRoute } from "@/lib/http";
import { readFile } from "@/features/brands/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Archivos privados (logos): solo miembros de la organización dueña. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return privateRoute({ key: "file", limit: 300, windowSeconds: 60 }, async (ctx) => {
    const { file, data } = await readFile(ctx, id);
    return fileResponse(data, { contentType: file.mimeType });
  });
}
