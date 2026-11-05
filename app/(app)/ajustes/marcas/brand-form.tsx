"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ImageUp, RotateCcw, Trash2 } from "lucide-react";
import { removeLogoAction, saveBrandAction, uploadLogoAction } from "@/features/brands/actions";
import {
  DEFAULT_BRAND_STYLE,
  FONT_FAMILIES,
  FONT_LABEL,
  PDF_TEMPLATES,
  PDF_TEMPLATE_LABEL,
  type FontFamily,
  type PaperSize,
  type PdfTemplate,
} from "@/features/brands/constants";
import { contrastRatio, ensureContrast, readableTextOn, tint } from "@/lib/utils/color";
import { formatFolio, suggestPrefix } from "@/lib/utils/folio";
import { initials } from "@/lib/utils/text";
import { Button, buttonClass } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert, Card } from "@/components/ui/misc";
import { ColorInput } from "@/components/domain/color-input";

interface BrandRow {
  id: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  contactName: string | null;
  logoFileId: string | null;
  colorPrimary: string;
  colorSecondary: string;
  colorAccent: string;
  colorText: string;
  fontFamily: string;
  headerText: string | null;
  footerText: string | null;
  commercialMessage: string | null;
  signatureName: string | null;
  signatureTitle: string | null;
  bankName: string | null;
  bankBeneficiary: string | null;
  bankAccount: string | null;
  bankInstructions: string | null;
  showBankDetails: boolean;
  defaultCurrency: string;
  defaultTaxMode: string;
  defaultTaxRate: string;
  defaultPaymentTerms: string | null;
  defaultValidityDays: number;
  quotePrefix: string;
  receiptPrefix: string;
  folioPadding: number;
  pdfTemplate: string;
  paperSize: string;
  isActive: boolean;
}

const s = (v: string | null | undefined) => v ?? "";

export function BrandForm({ brand, defaultCurrency }: { brand: BrandRow | null; defaultCurrency: "MXN" | "USD" }) {
  const router = useRouter();
  const [f, setF] = useState({
    name: s(brand?.name),
    legalName: s(brand?.legalName),
    taxId: s(brand?.taxId),
    email: s(brand?.email),
    phone: s(brand?.phone),
    website: s(brand?.website),
    address: s(brand?.address),
    contactName: s(brand?.contactName),
    colorPrimary: brand?.colorPrimary ?? DEFAULT_BRAND_STYLE.colorPrimary,
    colorSecondary: brand?.colorSecondary ?? DEFAULT_BRAND_STYLE.colorSecondary,
    colorAccent: brand?.colorAccent ?? DEFAULT_BRAND_STYLE.colorAccent,
    colorText: brand?.colorText ?? DEFAULT_BRAND_STYLE.colorText,
    fontFamily: (brand?.fontFamily ?? "INTER") as FontFamily,
    headerText: s(brand?.headerText),
    footerText: s(brand?.footerText),
    commercialMessage: s(brand?.commercialMessage),
    signatureName: s(brand?.signatureName),
    signatureTitle: s(brand?.signatureTitle),
    bankName: s(brand?.bankName),
    bankBeneficiary: s(brand?.bankBeneficiary),
    bankAccount: s(brand?.bankAccount),
    bankInstructions: s(brand?.bankInstructions),
    showBankDetails: brand?.showBankDetails ?? false,
    defaultCurrency: (brand?.defaultCurrency ?? defaultCurrency) as "MXN" | "USD",
    defaultTaxMode: (brand?.defaultTaxMode ?? "EXCLUSIVE") as "NONE" | "EXCLUSIVE" | "INCLUSIVE",
    defaultTaxRate: brand ? Number(brand.defaultTaxRate) : 16,
    defaultPaymentTerms: s(brand?.defaultPaymentTerms),
    defaultValidityDays: brand?.defaultValidityDays ?? 15,
    quotePrefix: brand?.quotePrefix ?? "",
    receiptPrefix: brand?.receiptPrefix ?? "REC",
    folioPadding: brand?.folioPadding ?? 4,
    pdfTemplate: (brand?.pdfTemplate ?? "MINIMAL") as PdfTemplate,
    paperSize: (brand?.paperSize ?? "LETTER") as PaperSize,
    isActive: brand?.isActive ?? true,
  });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [logoId, setLogoId] = useState<string | null>(brand?.logoFileId ?? null);
  const [logoMsg, setLogoMsg] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setSaved(false);
    setF((prev) => ({ ...prev, [k]: v }));
  };
  const prefix = f.quotePrefix || suggestPrefix(f.name || "COT");
  const lowContrast = contrastRatio(f.colorText, "#FFFFFF") < 7 || contrastRatio(f.colorPrimary, "#FFFFFF") < 3;

  async function save() {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    const res = await saveBrandAction(brand?.id ?? null, { ...f, quotePrefix: prefix });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      setFieldErrors(res.fieldErrors ?? {});
      return;
    }
    setSaved(true);
    if (!brand) router.push(`/ajustes/marcas/${res.data.id}?nueva=1`);
    else router.refresh();
  }

  async function upload(file: File) {
    if (!brand) return;
    setLogoMsg("Subiendo…");
    const fd = new FormData();
    fd.set("logo", file);
    const res = await uploadLogoAction(brand.id, fd);
    if (!res.ok) return setLogoMsg(res.message);
    setLogoId(res.data.fileId);
    setLogoMsg("Logo actualizado. Los documentos ya emitidos conservan su logo original.");
    router.refresh();
  }

  return (
    <form
      className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="flex min-w-0 flex-col gap-5">
        {error ? <Alert tone="danger">{error}</Alert> : null}

        <Card className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Identidad</h2>
          <Field label="Nombre comercial" htmlFor="b-name" required error={fieldErrors.name}>
            <Input id="b-name" value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={160} />
          </Field>
          {brand ? (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Logo</span>
              <div
                className={`flex flex-col items-center gap-3 rounded-[var(--radius)] border-2 border-dashed p-4 text-center sm:flex-row sm:text-left ${dragOver ? "border-focus bg-info-bg" : "border-border-strong"}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) void upload(file);
                }}
              >
                {logoId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/files/${logoId}`} alt="Logo actual" className="h-16 max-w-40 rounded border border-border bg-white object-contain p-1" />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-lg text-xl font-semibold" style={{ background: f.colorPrimary, color: readableTextOn(f.colorPrimary) }} aria-hidden>
                    {initials(f.name || "?")}
                  </span>
                )}
                <div className="flex flex-1 flex-col gap-2">
                  <p className="text-sm text-muted">Arrastra una imagen o selecciónala. PNG, JPG, WebP o SVG (se convierte a imagen segura). Máx. 5 MB.</p>
                  <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                    <button type="button" className={buttonClass("secondary", "sm")} onClick={() => fileInput.current?.click()}>
                      <ImageUp size={16} aria-hidden /> {logoId ? "Cambiar logo" : "Subir logo"}
                    </button>
                    {logoId ? (
                      <button
                        type="button"
                        className={buttonClass("ghost", "sm")}
                        onClick={async () => {
                          const r = await removeLogoAction(brand.id);
                          if (r.ok) {
                            setLogoId(null);
                            setLogoMsg("Logo quitado. Se usarán las iniciales.");
                          }
                        }}
                      >
                        <Trash2 size={16} aria-hidden /> Quitar
                      </button>
                    ) : null}
                  </div>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="sr-only"
                    aria-label="Seleccionar archivo de logo"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void upload(file);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
              {logoMsg ? (
                <p className="text-sm text-muted" role="status">
                  {logoMsg}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted">Podrás subir el logo después de guardar la marca.</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <ColorInput id="c-primary" label="Color principal" value={f.colorPrimary} onChange={(v) => set("colorPrimary", v)} />
            <ColorInput id="c-accent" label="Color de acento" value={f.colorAccent} onChange={(v) => set("colorAccent", v)} />
            <ColorInput id="c-secondary" label="Color secundario" value={f.colorSecondary} onChange={(v) => set("colorSecondary", v)} />
            <ColorInput id="c-text" label="Color de texto" value={f.colorText} onChange={(v) => set("colorText", v)} />
          </div>
          {lowContrast ? (
            <Alert tone="warning">Algunos colores tienen poco contraste. En los documentos ajustaremos el texto automáticamente para que siga siendo legible.</Alert>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipografía de documentos" htmlFor="b-font">
              <Select id="b-font" value={f.fontFamily} onChange={(e) => set("fontFamily", e.target.value as FontFamily)}>
                {FONT_FAMILIES.map((x) => (
                  <option key={x} value={x}>
                    {FONT_LABEL[x]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Estilo de PDF" htmlFor="b-tpl">
              <Select id="b-tpl" value={f.pdfTemplate} onChange={(e) => set("pdfTemplate", e.target.value as PdfTemplate)}>
                {PDF_TEMPLATES.map((t) => (
                  <option key={t} value={t}>
                    {PDF_TEMPLATE_LABEL[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tamaño de papel" htmlFor="b-paper">
              <Select id="b-paper" value={f.paperSize} onChange={(e) => set("paperSize", e.target.value as PaperSize)}>
                <option value="LETTER">Carta (México)</option>
                <option value="A4">A4</option>
              </Select>
            </Field>
          </div>
          <button
            type="button"
            className={`${buttonClass("ghost", "sm")} w-fit`}
            onClick={() => {
              setSaved(false);
              setF((p) => ({ ...p, ...DEFAULT_BRAND_STYLE }));
            }}
          >
            <RotateCcw size={16} aria-hidden /> Restaurar estilo predeterminado
          </button>
        </Card>

        <Card className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Datos del emisor</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Razón social" htmlFor="b-legal">
              <Input id="b-legal" value={f.legalName} onChange={(e) => set("legalName", e.target.value)} />
            </Field>
            <Field label="RFC" htmlFor="b-rfc" error={fieldErrors.taxId}>
              <Input id="b-rfc" value={f.taxId} onChange={(e) => set("taxId", e.target.value.toUpperCase())} maxLength={13} />
            </Field>
            <Field label="Correo" htmlFor="b-email" error={fieldErrors.email}>
              <Input id="b-email" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Teléfono" htmlFor="b-phone">
              <Input id="b-phone" type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field label="Sitio web" htmlFor="b-web">
              <Input id="b-web" value={f.website} onChange={(e) => set("website", e.target.value)} />
            </Field>
            <Field label="Contacto" htmlFor="b-contact">
              <Input id="b-contact" value={f.contactName} onChange={(e) => set("contactName", e.target.value)} />
            </Field>
          </div>
          <Field label="Domicilio" htmlFor="b-address">
            <Textarea id="b-address" value={f.address} onChange={(e) => set("address", e.target.value)} rows={2} />
          </Field>
        </Card>

        <Card className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Folios, moneda e impuestos</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Prefijo de cotizaciones" htmlFor="b-qp" error={fieldErrors.quotePrefix}>
              <Input id="b-qp" value={f.quotePrefix} placeholder={prefix} onChange={(e) => set("quotePrefix", e.target.value.toUpperCase())} maxLength={12} />
            </Field>
            <Field label="Prefijo de recibos" htmlFor="b-rp" error={fieldErrors.receiptPrefix}>
              <Input id="b-rp" value={f.receiptPrefix} onChange={(e) => set("receiptPrefix", e.target.value.toUpperCase())} maxLength={12} />
            </Field>
            <Field label="Dígitos del consecutivo" htmlFor="b-pad">
              <Select id="b-pad" value={f.folioPadding} onChange={(e) => set("folioPadding", Number(e.target.value))}>
                {[3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <p className="text-sm text-muted">
            Ejemplos: {safeFolio(prefix, f.folioPadding)} · {safeFolio(f.receiptPrefix || "REC", f.folioPadding)}. Los folios no se reutilizan; cambiar el prefijo solo afecta documentos nuevos.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Moneda predeterminada" htmlFor="b-cur">
              <Select id="b-cur" value={f.defaultCurrency} onChange={(e) => set("defaultCurrency", e.target.value as "MXN" | "USD")}>
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </Select>
            </Field>
            <Field label="IVA sugerido" htmlFor="b-taxmode" hint="No es asesoría fiscal.">
              <Select id="b-taxmode" value={f.defaultTaxMode} onChange={(e) => set("defaultTaxMode", e.target.value as typeof f.defaultTaxMode)}>
                <option value="EXCLUSIVE">Más IVA</option>
                <option value="INCLUSIVE">IVA incluido</option>
                <option value="NONE">Sin IVA</option>
              </Select>
            </Field>
            <Field label="Tasa (%)" htmlFor="b-rate" error={fieldErrors.defaultTaxRate}>
              <Input id="b-rate" inputMode="decimal" value={String(f.defaultTaxRate)} disabled={f.defaultTaxMode === "NONE"} onChange={(e) => set("defaultTaxRate", Number(e.target.value) || 0)} />
            </Field>
            <Field label="Vigencia por defecto (días)" htmlFor="b-valid">
              <Input id="b-valid" inputMode="numeric" value={String(f.defaultValidityDays)} onChange={(e) => set("defaultValidityDays", Math.max(0, Math.min(365, Number(e.target.value) || 0)))} />
            </Field>
          </div>
          <Field label="Condiciones de pago predeterminadas" htmlFor="b-terms">
            <Textarea id="b-terms" value={f.defaultPaymentTerms} onChange={(e) => set("defaultPaymentTerms", e.target.value)} rows={2} placeholder="Ej.: 50 % de anticipo y 50 % contra entrega." />
          </Field>
        </Card>

        <Card className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Encabezado, pie y firma</h2>
          <Field label="Texto de encabezado" htmlFor="b-header">
            <Input id="b-header" value={f.headerText} onChange={(e) => set("headerText", e.target.value)} maxLength={300} />
          </Field>
          <Field label="Pie de página" htmlFor="b-footer">
            <Input id="b-footer" value={f.footerText} onChange={(e) => set("footerText", e.target.value)} maxLength={600} />
          </Field>
          <Field label="Mensaje comercial" htmlFor="b-msg">
            <Textarea id="b-msg" value={f.commercialMessage} onChange={(e) => set("commercialMessage", e.target.value)} rows={2} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre para firma" htmlFor="b-sign">
              <Input id="b-sign" value={f.signatureName} onChange={(e) => set("signatureName", e.target.value)} />
            </Field>
            <Field label="Cargo" htmlFor="b-signt">
              <Input id="b-signt" value={f.signatureTitle} onChange={(e) => set("signatureTitle", e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Datos bancarios (opcional)</h2>
          <Checkbox id="b-showbank" label="Mostrar datos bancarios en las cotizaciones" checked={f.showBankDetails} onChange={(e) => set("showBankDetails", e.target.checked)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Banco" htmlFor="b-bank">
              <Input id="b-bank" value={f.bankName} onChange={(e) => set("bankName", e.target.value)} />
            </Field>
            <Field label="Beneficiario" htmlFor="b-benef">
              <Input id="b-benef" value={f.bankBeneficiary} onChange={(e) => set("bankBeneficiary", e.target.value)} />
            </Field>
            <Field label="Cuenta / CLABE" htmlFor="b-acct">
              <Input id="b-acct" value={f.bankAccount} onChange={(e) => set("bankAccount", e.target.value)} inputMode="numeric" />
            </Field>
          </div>
          <Field label="Instrucciones" htmlFor="b-instr">
            <Textarea id="b-instr" value={f.bankInstructions} onChange={(e) => set("bankInstructions", e.target.value)} rows={2} />
          </Field>
        </Card>

        {brand ? (
          <Card>
            <Checkbox id="b-active" label="Marca activa (las inactivas no aparecen al crear documentos nuevos)" checked={f.isActive} onChange={(e) => set("isActive", e.target.checked)} />
          </Card>
        ) : null}
      </div>

      <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <Card className="flex flex-col gap-3">
          <h2 className="font-semibold">Vista previa en vivo</h2>
          <MiniQuote f={f} logoId={logoId} prefix={prefix} />
          {brand ? (
            <div className="flex flex-col gap-2">
              <a className={buttonClass("secondary", "sm")} href={`/api/brands/${brand.id}/preview?estilo=${f.pdfTemplate}&papel=${f.paperSize}`} target="_blank" rel="noopener">
                Ver PDF de cotización (guardado)
              </a>
              <a className={buttonClass("secondary", "sm")} href={`/api/brands/${brand.id}/preview?tipo=recibo&estilo=${f.pdfTemplate}&papel=${f.paperSize}`} target="_blank" rel="noopener">
                Ver PDF de recibo (guardado)
              </a>
              <p className="text-xs text-muted">Los PDF de ejemplo usan la configuración guardada; guarda antes de abrirlos.</p>
            </div>
          ) : null}
        </Card>
      </aside>

      <div className="sticky-actions lg:col-span-2">
        <div className="card flex items-center justify-between gap-3 px-4 py-2.5">
          <p className="text-sm text-muted" role="status">
            {saved ? "Cambios guardados." : "Los cambios se aplican a documentos nuevos."}
          </p>
          <Button type="submit" disabled={busy}>
            {busy ? "Guardando…" : brand ? "Guardar cambios" : "Crear marca"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function safeFolio(prefix: string, padding: number) {
  try {
    return formatFolio(prefix.toUpperCase().replace(/[^A-Z0-9-]/g, "") || "COT", new Date().getFullYear(), 1, padding);
  } catch {
    return "";
  }
}

/** Miniatura HTML de una cotización que cambia en vivo con los colores elegidos. */
function MiniQuote({
  f,
  logoId,
  prefix,
}: {
  f: { name: string; colorPrimary: string; colorAccent: string; colorText: string; pdfTemplate: PdfTemplate; fontFamily: FontFamily; defaultCurrency: string };
  logoId: string | null;
  prefix: string;
}) {
  const text = ensureContrast(f.colorText, "#FFFFFF", 7);
  const primaryText = ensureContrast(f.colorPrimary, "#FFFFFF", 4.5);
  const onPrimary = readableTextOn(f.colorPrimary);
  const corporate = f.pdfTemplate === "CORPORATE";
  const creative = f.pdfTemplate === "CREATIVE";
  const fontFamily = f.fontFamily === "LORA" ? "Georgia, serif" : f.fontFamily === "HELVETICA" ? "Helvetica, Arial, sans-serif" : "inherit";
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-white p-4 text-[10px] leading-snug shadow-sm" style={{ color: text, fontFamily, aspectRatio: "8.5 / 11" }} aria-label="Miniatura de cotización">
      {creative ? <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: f.colorPrimary }} /> : null}
      <div className="flex items-start justify-between gap-2 rounded" style={corporate ? { background: f.colorPrimary, color: onPrimary, padding: 8 } : {}}>
        <div className="flex items-center gap-2">
          {logoId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/files/${logoId}`} alt="" className="h-6 max-w-16 rounded bg-white object-contain" />
          ) : (
            <span className="flex h-6 w-6 items-center justify-center rounded text-[9px] font-bold" style={{ background: f.colorPrimary, color: onPrimary, outline: corporate ? "1px solid #fff" : undefined }}>
              {initials(f.name || "?")}
            </span>
          )}
          <span className="font-semibold">{f.name || "Tu marca"}</span>
        </div>
        <div className="text-right">
          <p className="font-bold tracking-wider" style={{ color: corporate ? onPrimary : creative ? primaryText : text }}>
            COTIZACIÓN
          </p>
          <p>{prefix}-2026-0001</p>
        </div>
      </div>
      <div className="my-2 h-px" style={{ background: creative ? f.colorPrimary : "#E2DED5", height: creative ? 2 : 1 }} />
      <div className="rounded p-1.5" style={{ background: f.pdfTemplate === "MINIMAL" ? "transparent" : tint(f.colorPrimary, 0.92) }}>
        <p className="text-[8px] uppercase opacity-70">Cliente</p>
        <p className="font-semibold">Cliente de ejemplo</p>
      </div>
      <div className="mt-2 flex justify-between rounded px-1 py-0.5 text-[8px]" style={corporate ? { background: f.colorPrimary, color: onPrimary } : { borderBottom: `1px solid ${text}` }}>
        <span>DESCRIPCIÓN</span>
        <span>IMPORTE</span>
      </div>
      {["Sesión fotográfica", "Video promocional"].map((x, i) => (
        <div key={x} className="flex justify-between border-b border-[#E2DED5] px-1 py-1">
          <span>{x}</span>
          <span>${i === 0 ? "900.00" : "700.00"} {f.defaultCurrency}</span>
        </div>
      ))}
      <div className="mt-2 ml-auto flex w-2/3 justify-between rounded px-1.5 py-1 font-bold" style={corporate ? { background: f.colorPrimary, color: onPrimary } : creative ? { background: tint(f.colorPrimary, 0.92), color: primaryText } : { borderTop: `1px solid ${text}` }}>
        <span>TOTAL</span>
        <span>$1,856.00 {f.defaultCurrency}</span>
      </div>
      <p className="mt-2 text-[8px]" style={{ color: ensureContrast(f.colorAccent, "#FFFFFF", 4.5) }}>
        Condiciones de pago…
      </p>
    </div>
  );
}
