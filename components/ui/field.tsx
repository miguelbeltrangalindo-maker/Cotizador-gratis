import type { ComponentProps, ReactNode } from "react";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className = "",
}: {
  label: ReactNode;
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-text">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${htmlFor}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ invalid, className = "", ...props }: ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <input
      className={`control ${className}`}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid && props.id ? `${props.id}-error` : undefined}
      {...props}
    />
  );
}

export function Textarea({ invalid, className = "", ...props }: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return (
    <textarea
      className={`control min-h-24 resize-y break-anywhere ${className}`}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid && props.id ? `${props.id}-error` : undefined}
      {...props}
    />
  );
}

export function Select({ invalid, className = "", children, ...props }: ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <select className={`control pr-8 ${className}`} aria-invalid={invalid || undefined} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ label, id, ...props }: ComponentProps<"input"> & { label: ReactNode; id: string }) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
      <input id={id} type="checkbox" className="h-5 w-5 shrink-0 accent-[var(--primary)]" {...props} />
      <span>{label}</span>
    </label>
  );
}
