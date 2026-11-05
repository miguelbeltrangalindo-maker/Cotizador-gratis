"use client";

import { useState } from "react";
import { normalizeHex } from "@/lib/utils/color";

/** Selector visual de color + entrada HEX accesible. */
export function ColorInput({ id, label, value, onChange, name }: { id: string; label: string; value: string; onChange: (v: string) => void; name?: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  const text = editing ?? value;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${id}-hex`} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label}: selector visual`}
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-11 w-14 shrink-0 cursor-pointer rounded-[var(--radius-sm)] border border-border-strong bg-surface p-1"
        />
        <input
          id={`${id}-hex`}
          className="control font-mono uppercase"
          value={text}
          maxLength={7}
          inputMode="text"
          autoCapitalize="characters"
          onChange={(e) => {
            setEditing(e.target.value);
            const n = normalizeHex(e.target.value, "");
            if (n) onChange(n);
          }}
          onBlur={() => setEditing(null)}
        />
        {name ? <input type="hidden" name={name} value={value} /> : null}
      </div>
    </div>
  );
}
