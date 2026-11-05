import Link from "next/link";
import type { ReactNode } from "react";
import { AppMark } from "@/components/domain/app-mark";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-8" style={{ paddingTop: "calc(var(--safe-top) + 32px)" }}>
      <Link href="/" className="mb-8 w-fit" aria-label="Inicio">
        <AppMark />
      </Link>
      {children}
    </main>
  );
}
