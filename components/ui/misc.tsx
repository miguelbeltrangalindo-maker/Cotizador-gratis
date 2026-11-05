import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function Card({ children, className = "", as: As = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" }) {
  return <As className={`card p-4 sm:p-5 ${className}`}>{children}</As>;
}

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-col gap-3">
      {back ? (
        <Link href={back.href} className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1 rounded-lg px-2 text-sm text-muted hover:text-text">
          <ChevronLeft size={18} aria-hidden /> {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-anywhere text-[28px] font-semibold leading-tight tracking-tight sm:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-1 text-muted">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {description ? <p className="max-w-md text-muted">{description}</p> : null}
      {action}
    </div>
  );
}

type Tone = "neutral" | "info" | "success" | "warning" | "danger";
const tones: Record<Tone, string> = {
  neutral: "bg-black/5 text-text",
  info: "bg-info-bg text-[#1f3f8f]",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
};

export function Chip({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Alert({ tone = "info", title, children }: { tone?: Tone; title?: string; children?: ReactNode }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`rounded-[var(--radius-sm)] px-4 py-3 text-sm ${tones[tone]}`}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? "mt-1" : ""}>{children}</div> : null}
    </div>
  );
}

export function DefinitionList({ items }: { items: Array<{ label: string; value: ReactNode } | null | false> }) {
  const rows = items.filter(Boolean) as Array<{ label: string; value: ReactNode }>;
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map((r) => (
        <div key={r.label} className="min-w-0">
          <dt className="text-sm text-muted">{r.label}</dt>
          <dd className="break-anywhere whitespace-pre-line">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Pagination({ page, pageSize, total, hrefFor }: { page: number; pageSize: number; total: number; hrefFor: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Paginación" className="mt-4 flex items-center justify-between gap-2">
      {page > 1 ? (
        <Link className="inline-flex min-h-11 items-center rounded-lg px-3 text-link hover:underline" href={hrefFor(page - 1)}>
          ← Anterior
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-muted">
        Página {page} de {pages}
      </span>
      {page < pages ? (
        <Link className="inline-flex min-h-11 items-center rounded-lg px-3 text-link hover:underline" href={hrefFor(page + 1)}>
          Siguiente →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
