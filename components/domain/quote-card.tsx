import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { formatInstant, todayInTimeZone } from "@/lib/utils/dates";
import { displayStatus, type QuoteStatus } from "@/features/quotes/status";
import { QuoteStatusChip } from "./status";

export interface QuoteCardData {
  id: string;
  folio: string | null;
  status: string;
  versionNumber: number;
  title: string | null;
  serviceDescription: string | null;
  currency: string;
  totalMinor: number;
  updatedAt: Date;
  validUntil: string | null;
  clientName: string | null;
  brandName: string;
}

export function QuoteCard({ q, timezone }: { q: QuoteCardData; timezone: string }) {
  const status = displayStatus(q.status as QuoteStatus, q.validUntil, todayInTimeZone(timezone));
  return (
    <Link href={`/cotizaciones/${q.id}`} className="card block p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-link">
            {q.folio ?? "Borrador sin folio"} <span className="font-normal text-muted">· V{q.versionNumber}</span>
          </p>
          <p className="break-anywhere mt-0.5 font-medium">{q.clientName ?? "Sin cliente"}</p>
        </div>
        <QuoteStatusChip status={status} />
      </div>
      {q.title || q.serviceDescription ? (
        <p className="mt-2 line-clamp-2 break-anywhere text-sm text-muted">{q.title || q.serviceDescription}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <span className="text-sm text-muted">
          {q.brandName} · {formatInstant(q.updatedAt, timezone, false)}
        </span>
        <span className="text-lg font-semibold whitespace-nowrap">{formatMoney(q.totalMinor, q.currency)}</span>
      </div>
    </Link>
  );
}
