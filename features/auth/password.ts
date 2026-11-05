import { hash, verify } from "@node-rs/argon2";

// Argon2id (algorithm 2) con parámetros recomendados por OWASP (m=19 MiB, t=2, p=1).
const OPTIONS = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(hashed: string, password: string): Promise<boolean> {
  try {
    return await verify(hashed, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;
/** Verificación ficticia para igualar tiempos cuando el correo no existe (evita enumeración). */
export async function verifyDummy(password: string) {
  dummyHash ??= hashPassword("dummy-password-for-timing");
  await verifyPassword(await dummyHash, password);
}

export function passwordProblems(password: string): string | null {
  if (password.length < 10) return "La contraseña debe tener al menos 10 caracteres.";
  if (password.length > 200) return "La contraseña es demasiado larga.";
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(password) || !/\d/.test(password)) {
    return "La contraseña debe combinar letras y números.";
  }
  return null;
}
