import "server-only";
import { headers } from "next/headers";

/** IP del cliente (detrás de proxy confiable). Solo para rate limiting, nunca para autorización. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (fwd || h.get("x-real-ip") || "local").slice(0, 64);
}
