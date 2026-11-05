import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { QuoteDocumentSnapshot, QuoteLineSnapshot } from "@/features/documents/snapshot";
import { formatDecimal, formatMoney, formatPercent, formatUnitPrice } from "@/lib/money";
import { formatCalendarDate } from "@/lib/utils/dates";
import { QUOTE_STATUS_LABEL } from "@/features/quotes/status";
import { BrandBlock, Footer, Label, Logo, PAGE_PADDING, Paragraph, Signature, type LogoData } from "./common";
import { buildTheme, type PdfTheme } from "./theme";

/** Descripciones muy largas pueden partirse entre páginas; las demás se mantienen completas. */
const LONG_DESCRIPTION = 900;

export function QuotePdf({ doc, logo }: { doc: QuoteDocumentSnapshot; logo: LogoData | null }) {
  const theme = buildTheme(doc.brand, doc.template, doc.paperSize);
  const showUnit = doc.showUnitPrices && !doc.showOnlyGrandTotal && doc.sections.some((s) => s.items.some((i) => !i.hideUnitPrice));
  const showAmounts = !doc.showOnlyGrandTotal;
  const isDraft = doc.status === "DRAFT";
  return (
    <Document
      title={`Cotización ${doc.folio ?? "borrador"} v${doc.versionNumber}`}
      author={doc.brand.name}
      subject={doc.title ?? "Cotización"}
      creator={doc.brand.name}
      producer={doc.brand.name}
      language="es-MX"
    >
      <Page
        size={theme.page}
        style={{
          paddingTop: PAGE_PADDING.top,
          paddingBottom: PAGE_PADDING.bottom,
          paddingHorizontal: PAGE_PADDING.horizontal,
          fontFamily: theme.font,
          fontSize: 9.5,
          color: theme.text,
          lineHeight: 1.35,
        }}
      >
        {theme.template === "CREATIVE" ? (
          <View fixed style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 10, backgroundColor: theme.primary }} />
        ) : null}
        {isDraft ? (
          <View style={{ backgroundColor: "#FFF4DC", borderRadius: 4, padding: 6, marginBottom: 10 }}>
            <Text style={{ fontSize: 8.5, color: "#8A5300", textAlign: "center" }}>BORRADOR — Vista previa sin folio. No es un documento emitido.</Text>
          </View>
        ) : null}
        <Header doc={doc} theme={theme} logo={logo} />
        <Parties doc={doc} theme={theme} />
        <ItemsTable doc={doc} theme={theme} showUnit={showUnit} showAmounts={showAmounts} />
        <Totals doc={doc} theme={theme} />
        <Paragraph title="Condiciones de pago" text={doc.paymentTerms} theme={theme} />
        <Paragraph title="Vigencia" text={doc.validityTerms} theme={theme} />
        <Paragraph title="Notas" text={doc.publicNotes} theme={theme} />
        <Paragraph title="Mensaje" text={doc.brand.commercialMessage} theme={theme} />
        {doc.brand.bank ? (
          <View style={{ marginTop: 12 }} wrap={false}>
            <Label theme={theme}>Datos para pago</Label>
            {[
              doc.brand.bank.name ? `Banco: ${doc.brand.bank.name}` : null,
              doc.brand.bank.beneficiary ? `Beneficiario: ${doc.brand.bank.beneficiary}` : null,
              doc.brand.bank.account ? `Cuenta / CLABE: ${doc.brand.bank.account}` : null,
              doc.brand.bank.instructions,
            ]
              .filter(Boolean)
              .map((l, i) => (
                <Text key={i} style={{ fontSize: 9 }}>
                  {l}
                </Text>
              ))}
          </View>
        ) : null}
        <Signature name={doc.brand.signatureName} title={doc.brand.signatureTitle} theme={theme} />
        <Footer theme={theme} brand={doc.brand} legend={doc.folio ? `${doc.folio} · V${doc.versionNumber}` : undefined} />
      </Page>
    </Document>
  );
}

function Header({ doc, theme, logo }: { doc: QuoteDocumentSnapshot; theme: PdfTheme; logo: LogoData | null }) {
  const meta = (
    <View style={{ alignItems: "flex-end" }}>
      <Text
        style={{
          fontFamily: theme.fontBold,
          fontWeight: theme.boldWeight,
          fontSize: theme.template === "MINIMAL" ? 18 : 20,
          letterSpacing: 2,
          color: theme.template === "CORPORATE" ? theme.onPrimary : theme.template === "CREATIVE" ? theme.primaryText : theme.text,
        }}
      >
        COTIZACIÓN
      </Text>
      <Text style={{ fontSize: 10, marginTop: 3, color: theme.template === "CORPORATE" ? theme.onPrimary : theme.text }}>
        {doc.folio ?? "Sin folio"} · Versión {doc.versionNumber}
      </Text>
      {doc.status !== "DRAFT" && doc.status !== "SENT" ? (
        <Text style={{ fontSize: 8.5, marginTop: 2, color: theme.template === "CORPORATE" ? theme.onPrimary : theme.muted }}>Estado: {QUOTE_STATUS_LABEL[doc.status]}</Text>
      ) : null}
    </View>
  );
  if (theme.template === "CORPORATE") {
    return (
      <View style={{ marginBottom: 18 }}>
        <View style={{ backgroundColor: theme.primary, borderRadius: 6, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
            <View style={{ backgroundColor: "#FFFFFF", borderRadius: 6, padding: 6 }}>
              <Logo logo={logo} brand={doc.brand} theme={theme} maxW={120} maxH={44} />
            </View>
            <BrandBlock brand={doc.brand} theme={theme} onDark />
          </View>
          {meta}
        </View>
        {doc.brand.headerText ? <Text style={{ fontSize: 8.5, color: theme.muted, marginTop: 6 }}>{doc.brand.headerText}</Text> : null}
      </View>
    );
  }
  return (
    <View style={{ marginBottom: 18 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <View style={{ gap: 8, flex: 1 }}>
          <Logo logo={logo} brand={doc.brand} theme={theme} />
          <BrandBlock brand={doc.brand} theme={theme} />
        </View>
        {meta}
      </View>
      {doc.brand.headerText ? <Text style={{ fontSize: 8.5, color: theme.muted, marginTop: 8 }}>{doc.brand.headerText}</Text> : null}
      <View style={{ marginTop: 12, borderBottomWidth: theme.template === "CREATIVE" ? 2 : 0.6, borderBottomColor: theme.template === "CREATIVE" ? theme.primary : theme.border }} />
    </View>
  );
}

function Parties({ doc, theme }: { doc: QuoteDocumentSnapshot; theme: PdfTheme }) {
  const c = doc.client;
  const info: Array<[string, string]> = [];
  if (doc.issueDate) info.push(["Fecha de emisión", formatCalendarDate(doc.issueDate)]);
  if (doc.validUntil) info.push(["Vigente hasta", formatCalendarDate(doc.validUntil)]);
  info.push(["Moneda", doc.currency]);
  if (doc.location) info.push(["Ubicación", doc.location]);
  if (doc.duration) info.push(["Duración", doc.duration]);
  if (doc.responsible) info.push(["Responsable", doc.responsible]);
  for (const f of doc.customFields) {
    info.push([f.label, f.type === "checkbox" ? (f.value ? "Sí" : "No") : f.type === "date" ? formatCalendarDate(String(f.value)) : String(f.value)]);
  }
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: "row", gap: 18 }}>
        <View style={{ flex: 1.1, backgroundColor: theme.template === "MINIMAL" ? "#FFFFFF" : theme.soft, borderRadius: 6, padding: theme.template === "MINIMAL" ? 0 : 10 }}>
          <Label theme={theme}>Cliente</Label>
          {c ? (
            <>
              <Text style={{ fontFamily: theme.fontBold, fontWeight: theme.boldWeight, fontSize: 11 }}>{c.name}</Text>
              {[c.businessName, c.taxId ? `RFC: ${c.taxId}` : null, c.contactName ? `Atención: ${c.contactName}` : null, c.address, [c.phone, c.email].filter(Boolean).join(" · ") || null]
                .filter(Boolean)
                .map((l, i) => (
                  <Text key={i} style={{ fontSize: 8.5, color: theme.muted, marginTop: 1.5 }}>
                    {l}
                  </Text>
                ))}
            </>
          ) : (
            <Text style={{ color: theme.muted }}>Sin cliente asignado</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          {info.map(([k, v]) => (
            <View key={k} style={{ flexDirection: "row", marginBottom: 2.5, gap: 6 }}>
              <Text style={{ width: 86, fontSize: 8.5, color: theme.muted }}>{k}</Text>
              <Text style={{ flex: 1, fontSize: 9 }}>{v}</Text>
            </View>
          ))}
        </View>
      </View>
      {doc.title ? (
        <Text style={{ marginTop: 14, fontSize: 13, fontFamily: theme.fontBold, fontWeight: theme.boldWeight, color: theme.template === "CREATIVE" ? theme.primaryText : theme.text }}>{doc.title}</Text>
      ) : null}
      {doc.serviceDescription ? <Text style={{ marginTop: 4, fontSize: 9.5, lineHeight: 1.45 }}>{doc.serviceDescription}</Text> : null}
    </View>
  );
}

const COL = { qty: 52, unit: 52, price: 82, amount: 92 };

function ItemsTable({ doc, theme, showUnit, showAmounts }: { doc: QuoteDocumentSnapshot; theme: PdfTheme; showUnit: boolean; showAmounts: boolean }) {
  const headerBg = theme.template === "CORPORATE" ? theme.primary : theme.template === "CREATIVE" ? theme.soft : "#FFFFFF";
  const headerColor = theme.template === "CORPORATE" ? theme.onPrimary : theme.muted;
  const offsets = doc.sections.map((_, i) => doc.sections.slice(0, i).reduce((acc, s) => acc + s.items.length, 0));
  return (
    <View>
      <View
        minPresenceAhead={40}
        wrap={false}
        style={{
          flexDirection: "row",
          backgroundColor: headerBg,
          paddingVertical: 6,
          paddingHorizontal: 6,
          borderBottomWidth: theme.template === "MINIMAL" ? 0.8 : 0,
          borderBottomColor: theme.text,
          borderRadius: theme.template === "MINIMAL" ? 0 : 4,
        }}
      >
        <Text style={{ flex: 1, fontSize: 7.5, color: headerColor, letterSpacing: 0.6 }}>DESCRIPCIÓN</Text>
        <Text style={{ width: COL.qty, fontSize: 7.5, color: headerColor, textAlign: "right" }}>CANT.</Text>
        <Text style={{ width: COL.unit, fontSize: 7.5, color: headerColor, textAlign: "center" }}>UNIDAD</Text>
        {showUnit ? <Text style={{ width: COL.price, fontSize: 7.5, color: headerColor, textAlign: "right" }}>P. UNITARIO</Text> : null}
        {showAmounts ? <Text style={{ width: COL.amount, fontSize: 7.5, color: headerColor, textAlign: "right" }}>IMPORTE</Text> : null}
      </View>
      {doc.sections.map((s, si) => (
        <View key={si}>
          {s.title ? (
            <View minPresenceAhead={30} wrap={false} style={{ paddingTop: 10, paddingBottom: 4, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
              <Text style={{ fontFamily: theme.fontBold, fontWeight: theme.boldWeight, fontSize: 10, color: theme.template === "MINIMAL" ? theme.text : theme.primaryText }}>{s.title}</Text>
            </View>
          ) : null}
          {s.items.map((it, ii) => (
            <ItemRow key={ii} n={offsets[si] + ii + 1} it={it} doc={doc} theme={theme} showUnit={showUnit} showAmounts={showAmounts} />
          ))}
          {s.title && s.showSubtotal && showAmounts ? (
            <View wrap={false} style={{ flexDirection: "row", justifyContent: "flex-end", paddingVertical: 5, paddingHorizontal: 6 }}>
              <Text style={{ fontSize: 8.5, color: theme.muted, marginRight: 10 }}>Subtotal {s.title}</Text>
              <Text style={{ width: COL.amount, fontSize: 9, textAlign: "right", fontFamily: theme.fontBold, fontWeight: theme.boldWeight }}>{formatMoney(s.subtotalMinor, doc.currency)}</Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function ItemRow({ n, it, doc, theme, showUnit, showAmounts }: { n: number; it: QuoteLineSnapshot; doc: QuoteDocumentSnapshot; theme: PdfTheme; showUnit: boolean; showAmounts: boolean }) {
  const extra: string[] = [];
  if (it.discountMinor > 0) {
    extra.push(it.discountType === "PERCENT" ? `Descuento ${formatPercent(it.discountValue)} (-${formatMoney(it.discountMinor, doc.currency)})` : `Descuento -${formatMoney(it.discountMinor, doc.currency)}`);
  }
  if (it.taxMode === "INCLUSIVE") extra.push(`IVA ${formatPercent(it.taxRate)} incluido`);
  else if (it.taxMode === "EXCLUSIVE") extra.push(`+ IVA ${formatPercent(it.taxRate)}`);
  return (
    <View
      wrap={it.description.length > LONG_DESCRIPTION}
      style={{ flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: theme.border }}
    >
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={{ fontSize: 9.5, lineHeight: 1.4 }}>
          <Text style={{ color: theme.muted }}>{n}. </Text>
          {it.description || "—"}
        </Text>
        {extra.length && showAmounts ? <Text style={{ fontSize: 7.5, color: theme.muted, marginTop: 2 }}>{extra.join(" · ")}</Text> : null}
      </View>
      <Text style={{ width: COL.qty, textAlign: "right" }}>{formatDecimal(it.quantity)}</Text>
      <Text style={{ width: COL.unit, textAlign: "center", fontSize: 8.5, color: theme.muted }}>{it.unit ?? ""}</Text>
      {showUnit ? <Text style={{ width: COL.price, textAlign: "right" }}>{it.hideUnitPrice ? "" : formatUnitPrice(it.unitPrice, doc.currency)}</Text> : null}
      {showAmounts ? <Text style={{ width: COL.amount, textAlign: "right" }}>{formatMoney(it.amountMinor, doc.currency)}</Text> : null}
    </View>
  );
}

function Totals({ doc, theme }: { doc: QuoteDocumentSnapshot; theme: PdfTheme }) {
  const t = doc.totals;
  const rows: Array<[string, string]> = [];
  if (!doc.showOnlyGrandTotal) {
    if (t.discountMinor > 0) {
      rows.push(["Importe bruto", formatMoney(t.grossMinor, doc.currency)]);
      rows.push(["Descuentos", `-${formatMoney(t.discountMinor, doc.currency)}`]);
    }
    rows.push(["Subtotal", formatMoney(t.subtotalMinor, doc.currency)]);
    for (const b of t.taxBreakdown) rows.push([`IVA ${formatPercent(b.rate)}${b.mode === "INCLUSIVE" ? " (incluido)" : ""}`, formatMoney(b.taxMinor, doc.currency)]);
  }
  const creative = theme.template === "CREATIVE";
  return (
    <View wrap={false} style={{ marginTop: 12, alignItems: "flex-end" }}>
      <View style={{ width: 250 }}>
        {rows.map(([k, v]) => (
          <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 }}>
            <Text style={{ color: theme.muted }}>{k}</Text>
            <Text>{v}</Text>
          </View>
        ))}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 6,
            paddingVertical: 8,
            paddingHorizontal: creative || theme.template === "CORPORATE" ? 10 : 0,
            borderTopWidth: creative || theme.template === "CORPORATE" ? 0 : 1,
            borderTopColor: theme.text,
            backgroundColor: theme.template === "CORPORATE" ? theme.primary : creative ? theme.soft : "#FFFFFF",
            borderRadius: 6,
          }}
        >
          <Text style={{ fontFamily: theme.fontBold, fontWeight: theme.boldWeight, fontSize: 11, color: theme.template === "CORPORATE" ? theme.onPrimary : theme.text }}>TOTAL</Text>
          <Text style={{ fontFamily: theme.fontBold, fontWeight: theme.boldWeight, fontSize: 13, color: theme.template === "CORPORATE" ? theme.onPrimary : creative ? theme.primaryText : theme.text }}>
            {formatMoney(t.totalMinor, doc.currency)}
          </Text>
        </View>
        {doc.showOnlyGrandTotal && t.taxMinor > 0 ? <Text style={{ fontSize: 8, color: theme.muted, textAlign: "right", marginTop: 3 }}>Incluye IVA por {formatMoney(t.taxMinor, doc.currency)}</Text> : null}
        {t.hasInclusiveTax && !doc.showOnlyGrandTotal ? <Text style={{ fontSize: 7.5, color: theme.muted, textAlign: "right", marginTop: 3 }}>Algunos precios incluyen IVA.</Text> : null}
      </View>
    </View>
  );
}
