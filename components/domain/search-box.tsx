"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search } from "lucide-react";

/** Búsqueda con debounce que actualiza la URL (los resultados se consultan en servidor). */
export function SearchBox({ placeholder, label, param = "q" }: { placeholder: string; label: string; param?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get(param) ?? "");
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function push(v: string) {
    const next = new URLSearchParams(params.toString());
    if (v.trim()) next.set(param, v.trim());
    else next.delete(param);
    next.delete("pagina");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  return (
    <div className="relative">
      <label htmlFor={`search-${param}`} className="sr-only">
        {label}
      </label>
      <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden />
      <input
        id={`search-${param}`}
        type="search"
        className="control pl-10"
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onChange={(e) => {
          setValue(e.target.value);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => push(e.target.value), 350);
        }}
      />
      {pending ? <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted">Buscando…</span> : null}
    </div>
  );
}

/** Select de filtro que actualiza un parámetro de la URL. */
export function FilterSelect({ param, label, options }: { param: string; label: string; options: Array<{ value: string; label: string }> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <label htmlFor={`filter-${param}`} className="text-xs font-medium text-muted">
        {label}
      </label>
      <select
        id={`filter-${param}`}
        className="control"
        value={params.get(param) ?? ""}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          if (e.target.value) next.set(param, e.target.value);
          else next.delete(param);
          next.delete("pagina");
          router.replace(`${pathname}?${next.toString()}`, { scroll: false });
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
