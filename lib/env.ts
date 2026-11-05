import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL es obligatoria (rol de aplicación sin privilegios)"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET debe tener al menos 32 caracteres aleatorios"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  STORAGE_DRIVER: z.enum(["database", "local"]).default("database"),
  STORAGE_LOCAL_DIR: z.string().default("./storage"),
  ENABLE_DEMO_SEED: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Valida las variables de entorno obligatorias con mensajes claros. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Configuración inválida. Revisa tu archivo .env:\n${msg}`);
  }
  if (parsed.data.NODE_ENV === "production" && !parsed.data.APP_URL.startsWith("https://")) {
    throw new Error("En producción APP_URL debe usar https://");
  }
  cached = parsed.data;
  return cached;
}

export const isProduction = () => process.env.NODE_ENV === "production";
