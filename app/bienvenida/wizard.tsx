"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { completeOnboardingAction } from "@/features/organizations/actions";
import { TIMEZONE_OPTIONS } from "@/lib/timezones";
import { suggestPrefix } from "@/lib/utils/folio";
import { RETENTION_PRESETS } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { ColorInput } from "@/components/domain/color-input";

export function OnboardingWizard({ userName, isAdditional }: { userName: string; isAdditional: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [org, setOrg] = useState({ name: "", timezone: "America/Mexico_City", defaultCurrency: "MXN" as "MXN" | "USD" });
  const [brand, setBrand] = useState({
    name: "",
    colorPrimary: "#1C1C1B",
    defaultCurrency: "MXN" as "MXN" | "USD",
    quotePrefix: "",
    defaultTaxMode: "EXCLUSIVE" as "NONE" | "EXCLUSIVE" | "INCLUSIVE",
    defaultTaxRate: 16,
    defaultRetentionIvaRate: 0,
    defaultRetentionIsrRate: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const brandName = brand.name || org.name;
  const prefix = brand.quotePrefix || (brandName ? suggestPrefix(brandName) : "COT");

  async function finish() {
    setBusy(true);
    setError(null);
    const res = await completeOnboardingAction({ organization: org, brand: { ...brand, name: brandName, quotePrefix: prefix } });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    router.push("/inicio?bienvenida=1");
    router.refresh();
  }

  return (
    <div className="card p-5 sm:p-6">
      <p className="text-sm font-medium text-muted" aria-live="polite">
        Paso {step} de 2
      </p>
      {step === 1 ? (
        <form
          className="mt-2 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (org.name.trim().length < 2) {
              setError("Escribe el nombre de tu empresa u organización.");
              return;
            }
            setError(null);
            setStep(2);
          }}
        >
          <h1 className="text-2xl font-semibold">
            {isAdditional ? "Nueva organización" : `Hola, ${userName.split(" ")[0]}. Configura tu empresa`}
          </h1>
          <p className="text-muted">Tus datos quedan separados de cualquier otra empresa.</p>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Field label="Nombre de la empresa u organización" htmlFor="org-name" required>
            <Input id="org-name" value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} autoFocus maxLength={160} />
          </Field>
          <Field label="Zona horaria" htmlFor="org-tz" hint="País por defecto: México.">
            <Select id="org-tz" value={org.timezone} onChange={(e) => setOrg({ ...org, timezone: e.target.value })}>
              {TIMEZONE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Moneda predeterminada" htmlFor="org-cur">
            <Select
              id="org-cur"
              value={org.defaultCurrency}
              onChange={(e) => {
                const c = e.target.value as "MXN" | "USD";
                setOrg({ ...org, defaultCurrency: c });
                setBrand({ ...brand, defaultCurrency: c });
              }}
            >
              <option value="MXN">MXN — Peso mexicano</option>
              <option value="USD">USD — Dólar estadounidense</option>
            </Select>
          </Field>
          <Button type="submit" size="lg" className="mt-2">
            Continuar
          </Button>
        </form>
      ) : (
        <form
          className="mt-2 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void finish();
          }}
        >
          <h1 className="text-2xl font-semibold">Tu primera marca</h1>
          <p className="text-muted">Así aparecerán tus cotizaciones y recibos. Podrás subir tu logo y cambiar todo después.</p>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Field label="Nombre comercial" htmlFor="brand-name" hint="Si lo dejas vacío usaremos el nombre de la empresa.">
            <Input id="brand-name" value={brand.name} placeholder={org.name} onChange={(e) => setBrand({ ...brand, name: e.target.value })} maxLength={160} />
          </Field>
          <ColorInput id="brand-color" label="Color principal" value={brand.colorPrimary} onChange={(v) => setBrand({ ...brand, colorPrimary: v })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Moneda" htmlFor="brand-cur">
              <Select id="brand-cur" value={brand.defaultCurrency} onChange={(e) => setBrand({ ...brand, defaultCurrency: e.target.value as "MXN" | "USD" })}>
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </Select>
            </Field>
            <Field label="Prefijo de folios" htmlFor="brand-prefix" hint={`Ejemplo: ${prefix}-${new Date().getFullYear()}-0001`}>
              <Input id="brand-prefix" value={brand.quotePrefix} placeholder={prefix} maxLength={12} onChange={(e) => setBrand({ ...brand, quotePrefix: e.target.value.toUpperCase() })} />
            </Field>
          </div>
          <Field label="IVA sugerido" htmlFor="brand-tax" hint="Podrás cambiarlo en cada concepto. No es asesoría fiscal.">
            <Select
              id="brand-tax"
              value={
                brand.defaultTaxMode === "NONE"
                  ? "NONE"
                  : `${brand.defaultTaxMode}:${brand.defaultTaxRate}${brand.defaultRetentionIsrRate > 0 ? ":RESICO" : ""}`
              }
              onChange={(e) => {
                const noRetention = { defaultRetentionIvaRate: 0, defaultRetentionIsrRate: 0 };
                if (e.target.value === "NONE") setBrand({ ...brand, ...noRetention, defaultTaxMode: "NONE", defaultTaxRate: 0 });
                else {
                  const [mode, rate, regime] = e.target.value.split(":");
                  const retention =
                    regime === "RESICO"
                      ? {
                          defaultRetentionIvaRate: Number(RETENTION_PRESETS.RESICO.ivaRate),
                          defaultRetentionIsrRate: Number(RETENTION_PRESETS.RESICO.isrRate),
                        }
                      : noRetention;
                  setBrand({ ...brand, ...retention, defaultTaxMode: mode as "EXCLUSIVE" | "INCLUSIVE", defaultTaxRate: Number(rate) });
                }
              }}
            >
              <option value="EXCLUSIVE:16">Más IVA 16 %</option>
              <option value="EXCLUSIVE:16:RESICO">Más IVA 16 % con retenciones RESICO (IVA 10.6667 %, ISR 1.25 %)</option>
              <option value="INCLUSIVE:16">Precios con IVA 16 % incluido</option>
              <option value="EXCLUSIVE:8">Más IVA 8 % (región fronteriza)</option>
              <option value="NONE">Sin IVA</option>
            </Select>
          </Field>
          <div className="mt-2 flex gap-2">
            <Button variant="secondary" onClick={() => setStep(1)} disabled={busy}>
              Atrás
            </Button>
            <Button type="submit" size="lg" className="flex-1" disabled={busy}>
              {busy ? "Creando…" : "Terminar"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
