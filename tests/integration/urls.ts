/** URLs de la base de pruebas: TEST_DATABASE_* o las de desarrollo con la base "cotizador_test". */
export function testUrls() {
  const swap = (u: string | undefined) => {
    if (!u) throw new Error("Define DATABASE_ADMIN_URL/DATABASE_URL o TEST_DATABASE_ADMIN_URL/TEST_DATABASE_URL");
    const url = new URL(u);
    url.pathname = "/cotizador_test";
    return url.toString();
  };
  return {
    admin: process.env.TEST_DATABASE_ADMIN_URL ?? swap(process.env.DATABASE_ADMIN_URL),
    app: process.env.TEST_DATABASE_URL ?? swap(process.env.DATABASE_URL),
  };
}
