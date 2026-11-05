/**
 * StorageProvider: abstracción de almacenamiento privado de archivos.
 * - "database": guarda el binario en PostgreSQL (tabla file_blobs, con RLS). Apto para
 *   hosting sin disco persistente; adecuado para logos (≤ 5 MB, normalizados a PNG/JPEG).
 * - "local": carpeta privada fuera de /public (solo desarrollo o servidores con disco persistente).
 * Un proveedor S3 compatible puede implementarse con la misma interfaz (ver docs/DESPLIEGUE.md).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import type { Tx } from "@/lib/db";
import { fileBlobs } from "@/lib/db/schema";
import { env } from "@/lib/env";

export interface StorageProvider {
  readonly name: string;
  put(tx: Tx, args: { organizationId: string; fileId: string; key: string; data: Buffer }): Promise<void>;
  get(tx: Tx, args: { organizationId: string; fileId: string; key: string }): Promise<Buffer | null>;
}

class DatabaseStorage implements StorageProvider {
  readonly name = "database";
  async put(tx: Tx, { organizationId, fileId, data }: { organizationId: string; fileId: string; data: Buffer }) {
    await tx.insert(fileBlobs).values({ fileId, organizationId, data });
  }
  async get(tx: Tx, { organizationId, fileId }: { organizationId: string; fileId: string }) {
    const [row] = await tx
      .select({ data: fileBlobs.data })
      .from(fileBlobs)
      .where(and(eq(fileBlobs.fileId, fileId), eq(fileBlobs.organizationId, organizationId)));
    return row ? Buffer.from(row.data) : null;
  }
}

class LocalStorage implements StorageProvider {
  readonly name = "local";
  constructor(private readonly root: string) {}
  private resolve(key: string) {
    // La clave la genera el servidor (org/uuid.ext); se valida para evitar path traversal.
    if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg)$/.test(key)) throw new Error("Clave de almacenamiento inválida");
    return path.join(path.resolve(this.root), key);
  }
  async put(_tx: Tx, { key, data }: { key: string; data: Buffer }) {
    const p = this.resolve(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, data, { mode: 0o600 });
  }
  async get(_tx: Tx, { key }: { key: string }) {
    try {
      return await readFile(this.resolve(key));
    } catch {
      return null;
    }
  }
}

let provider: StorageProvider | null = null;
export function storage(): StorageProvider {
  if (!provider) {
    const e = env();
    provider = e.STORAGE_DRIVER === "local" ? new LocalStorage(e.STORAGE_LOCAL_DIR) : new DatabaseStorage();
  }
  return provider;
}
