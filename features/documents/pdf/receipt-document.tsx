import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { ReceiptDocumentSnapshot } from "@/features/documents/snapshot";
import { formatMoney, formatPercent } from "@/lib/money";
import { importeConLetra } from "@/lib/money/words";
import { formatInstant } from "@/lib/utils/dates";
import { BrandBlock, Footer, Label, Logo, PAGE_PADDING, Paragraph, Signature, type LogoData } from "./common";
import { buildTheme } from "./theme";

export const RECEIPT_LEGEND = "Comprobante comercial de recepción de pago. No sustituye un CFDI.";

const METHOD: Record<string, string> = { TRANSFER: "Transferencia", CASH: "Efectivo", CARD: "Tarjeta", CHECK: "Cheque", OTHER: "Otro" };

export function ReceiptPdf({ doc, logo }: { doc: ReceiptDocumentSnapshot; logo: LogoData | null }) {
  const theme = buildTheme(doc.brand, doc.template, doc.paperSize);
  const isVoid = doc.status === "VOID";
  const corporate = theme.template === "CORPORATE";
  const rows: Array<[string, string]> = [
    ["Fecha de recepción", formatInstant(doc.receivedAt, doc.timezone)],
    ["Método de pago", METHOD[doc.paymentMethod] ?? doc.paymentMethod],
  ];
  if (doc.paymentReference) rows.push(["Referencia", doc.paymentReference]);
  rows.push(["Moneda", doc.currency]);
  if (doc.quote) rows.push(["Cotización relacionada", `${doc.quote.folio ?? ""} · V${doc.quote.versionNumber}${doc.quote.title ? ` — ${doc.quote.title}` : ""}`]);
  return (
    <Document title={`Recibo ${doc.folio}`} author={doc.brand.name} creator={doc.brand.name} producer={doc.brand.name} language="es-MX">
      <Page size={theme.page} style={{ paddingTop: PAGE_PADDING.top, paddingBottom: PAGE_PADDING.bottom, paddingHorizontal: PAGE_PADDING.horizontal, fontFamily: theme.font, fontSize: 9.5, color: theme.text }}>
        {theme.template === "CREATIVE" ? <View fixed style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 10, backgroundColor: theme.primary }} /> : null}
        {isVoid ? (
          <View style={{ borderWidth: 2, borderColor: "#B42318", borderRadius: 6, padding: 8, marginBottom: 12 }}>
            <Text style={{ color: "#B42318", fontFamily: theme.fontBold, fontWeight: theme.boldWeight, fontSize: 14, lineHeight: 1.25, textAlign: "center" }}>RECIBO ANULADO</Text>
            {doc.voidReason ? <Text style={{ color: "#B42318", textAlign: "center", fontSize: 9, marginTop: 2 }}>Motivo: {doc.voidReason}</Text> : null}
          </View>
        ) : null}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: corporate ? "center" : "flex-start",
            gap: 16,
            backgroundColor: corporate ? theme.primary : "#FFFFFF",
            borderRadius: corporate ? 6 : 0,
            padding: corporate ? 14 : 0,
          }}
        >
          <View style={{ gap: 8, flex: 1, flexDirection: corporate ? "row" : "column", alignItems: corporate ? "center" : "flex-start" }}>
            <View style={corporate ? { backgroundColor: "#FFFFFF", borderRadius: 6, padding: 6 } : {}}>
              <Logo logo={logo} brand={doc.brand} theme={theme} maxW={corporate ? 120 : 150} maxH={corporate ? 44 : 54} />
            </View>
            <BrandBlock brand={doc.brand} theme={theme} onDark={corporate} />
          </View>
          <View style={{ width: 230, flexShrink: 0 }}>
            <Text style={{ textAlign: "right", fontFamily: theme.fontBold, fontWeight: theme.boldWeight, fontSize: 18, lineHeight: 1.25, letterSpacing: 1.5, color: corporate ? theme.onPrimary : theme.template === "CREATIVE" ? theme.primaryText : theme.text }}>RECIBO DE PAGO</Text>
            <Text style={{ fontSize: 11, lineHeight: 1.25, marginTop: 3, textAlign: "right", color: corporate ? theme.onPrimary : theme.text }}>{doc.folio}</Text>
          </View>
        </View>
        {!corporate ? <View style={{ marginTop: 12, borderBottomWidth: theme.template === "CREATIVE" ? 2 : 0.6, borderBottomColor: theme.template === "CREATIVE" ? theme.primary : theme.border }} /> : null}

        <View style={{ marginTop: 16, flexDirection: "row", gap: 18 }}>
          <View style={{ flex: 1 }}>
            <Label theme={theme}>Recibimos de</Label>
            <Text style={{ fontFamily: theme.fontBold, fontWeight: theme.boldWeight, fontSize: 12, lineHeight: 1.25 }}>{doc.payer.name}</Text>
            {[doc.payer.businessName, doc.payer.taxId ? `RFC: ${doc.payer.taxId}` : null, doc.payer.email].filter(Boolean).map((l, i) => (
              <Text key={i} style={{ fontSize: 8.5, color: theme.muted, marginTop: 1.5 }}>
                {l}
              </Text>
            ))}
          </View>
          <View style={{ flex: 1, backgroundColor: theme.soft, borderRadius: 8, padding: 12 }} wrap={false}>
            <Label theme={theme}>Importe recibido</Label>
            <Text style={{ fontFamily: theme.fontBold, fontWeight: theme.boldWeight, fontSize: 18, lineHeight: 1.25, color: isVoid ? theme.muted : theme.text, textDecoration: isVoid ? "line-through" : "none" }}>
              {formatMoney(doc.amountMinor, doc.currency)}
            </Text>
            <Text style={{ fontSize: 8, color: theme.muted, marginTop: 3 }}>({importeConLetra(doc.amountMinor, doc.currency)})</Text>
          </View>
        </View>

        <View style={{ marginTop: 16 }}>
          <Label theme={theme}>Concepto</Label>
          <Text style={{ fontSize: 10, lineHeight: 1.45 }}>{doc.concept}</Text>
        </View>

        <View style={{ marginTop: 14 }} wrap={false}>
          {rows.map(([k, v]) => (
            <View key={k} style={{ flexDirection: "row", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: theme.border, gap: 8 }}>
              <Text style={{ width: 140, color: theme.muted }}>{k}</Text>
              <Text style={{ flex: 1 }}>{v}</Text>
            </View>
          ))}
        </View>

        {doc.taxTreatment !== "NONE" ? (
          <View style={{ marginTop: 12, alignItems: "flex-end" }} wrap={false}>
            <View style={{ width: 250 }}>
              <Label theme={theme} style={{ textAlign: "right" }}>
                Desglose informativo ({doc.taxTreatment === "INCLUDED" ? "incluye IVA" : "más IVA"})
              </Label>
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 }}>
                <Text style={{ color: theme.muted }}>Base</Text>
                <Text>{formatMoney(doc.netMinor, doc.currency)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 }}>
                <Text style={{ color: theme.muted }}>IVA {formatPercent(doc.taxRate)}</Text>
                <Text>{formatMoney(doc.taxMinor, doc.currency)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderTopWidth: 0.8, borderTopColor: theme.text, marginTop: 2 }}>
                <Text style={{ fontFamily: theme.fontBold, fontWeight: theme.boldWeight }}>Total recibido</Text>
                <Text style={{ fontFamily: theme.fontBold, fontWeight: theme.boldWeight }}>{formatMoney(doc.amountMinor, doc.currency)}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {doc.quote && doc.balanceAfter && !isVoid ? (
          <View style={{ marginTop: 12, backgroundColor: "#FAF8F4", borderRadius: 6, padding: 10 }} wrap={false}>
            <Label theme={theme}>Estado de cuenta de la cotización (al emitir este recibo)</Label>
            <Text>
              Total cotizado: {formatMoney(doc.quote.totalMinor, doc.currency)} · Pagado: {formatMoney(doc.balanceAfter.paidMinor, doc.currency)} · Saldo:{" "}
              {formatMoney(doc.balanceAfter.balanceMinor, doc.currency)}
            </Text>
          </View>
        ) : null}

        <Paragraph title="Notas" text={doc.notesPublic} theme={theme} />
        <Signature name={doc.signatureName} title={doc.brand.signatureTitle} theme={theme} />
        <Text style={{ marginTop: 18, fontSize: 8, color: theme.muted }}>{RECEIPT_LEGEND}</Text>
        <Footer theme={theme} brand={doc.brand} legend={doc.folio} />
      </Page>
    </Document>
  );
}
