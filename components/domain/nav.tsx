"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FilePlus2, History, Home, ReceiptText, Settings, Users, Package } from "lucide-react";

const MOBILE = [
  { href: "/cotizaciones/nueva", label: "Nueva", icon: FilePlus2, match: (p: string) => p === "/cotizaciones/nueva" },
  { href: "/cotizaciones", label: "Historial", icon: History, match: (p: string) => p.startsWith("/cotizaciones") && p !== "/cotizaciones/nueva" },
  { href: "/recibos", label: "Recibos", icon: ReceiptText, match: (p: string) => p.startsWith("/recibos") },
  { href: "/ajustes", label: "Ajustes", icon: Settings, match: (p: string) => p.startsWith("/ajustes") || p.startsWith("/clientes") || p.startsWith("/catalogo") },
];

const DESKTOP = [
  { href: "/inicio", label: "Inicio", icon: Home, match: (p: string) => p === "/inicio" },
  ...MOBILE.slice(0, 3),
  { href: "/clientes", label: "Clientes", icon: Users, match: (p: string) => p.startsWith("/clientes") },
  { href: "/catalogo", label: "Servicios y productos", icon: Package, match: (p: string) => p.startsWith("/catalogo") },
  { href: "/ajustes", label: "Ajustes", icon: Settings, match: (p: string) => p.startsWith("/ajustes") },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegación principal" className="bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur lg:hidden">
      <ul className="mx-auto grid h-[var(--nav-height)] max-w-lg grid-cols-4">
        {MOBILE.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-0.5 text-[12px] ${active ? "font-semibold text-text" : "text-muted"}`}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 1.8} aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegación principal">
      <ul className="flex flex-col gap-1">
        {DESKTOP.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-[var(--radius-sm)] px-3 ${active ? "bg-surface font-semibold shadow-sm ring-1 ring-border" : "text-muted hover:bg-black/5 hover:text-text"}`}
              >
                <Icon size={20} aria-hidden /> {item.label === "Nueva" ? "Nueva cotización" : item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
