import "dotenv/config";
import { afterAll } from "vitest";
import { testUrls } from "./urls";

const { app } = testUrls();
process.env.DATABASE_URL = app;
process.env.AUTH_SECRET ??= "test-secret-solo-para-pruebas-integracion-0123456789";
process.env.STORAGE_DRIVER = "database";

afterAll(async () => {
  const { closeDb } = await import("@/lib/db");
  await closeDb();
});
