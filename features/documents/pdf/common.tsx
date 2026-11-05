import { Image, Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/stylesheet";
import type { ReactNode } from "react";
import type { BrandSnapshot } from "@/features/documents/snapshot";
import { initials } from "@/lib/utils/text";
import type { PdfTheme } from "./theme";

export const PAGE_PADDING = { top: 40, bottom: 64, horizontal: 44 };

export interface LogoData {
  data: Buffer;
  width: number;
  height: number;
  format: "png" | "jpg";
}

/** Logo sin deformar: se ajusta a una caja máxima conservando proporción. */
export function Logo({ logo, brand, theme, maxW = 150, maxH = 54 }: { logo: LogoData | null; brand: BrandSnapshot; theme: PdfTheme; maxW?: number; maxH?: number }) {
  if (logo) {
    const ratio = Math.min(maxW / logo.width, maxH / logo.height, 1);
    const w = Math.max(1, Math.round(logo.width * ratio));
    const h = Math.max(1, Math.round(logo.height * ratio));
    // eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf no admite alt
    return <Image src={{ data: logo.data, format: logo.format }} style={{ width: w, height: h }} />;
  }
  return (
    <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: theme.primary, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: theme.onPrimary, fontFamily: theme.fontBold, fontWeight: theme.boldWeight, fontSize: 16 }}>{initials(brand.name)}</Text>
    </View>
  );
}

export function BrandBlock({ brand, theme, align = "left", onDark = false }: { brand: BrandSnapshot; theme: PdfTheme; align?: "left" | "right"; onDark?: boolean }) {
  const color = onDark ? theme.onPrimary : theme.muted;
  const lines = [brand.legalName, brand.taxId ? `RFC: ${brand.taxId}` : null, brand.address, [brand.phone, brand.email].filter(Boolean).join(" · ") || null, brand.website].filter(Boolean) as string[];
  return (
    <View style={{ alignItems: align === "right" ? "flex-end" : "flex-start", maxWidth: 260 }}>
      <Text style={{ fontFamily: theme.fontBold, fontWeight: theme.boldWeight, fontSize: 12, color: onDark ? theme.onPrimary : theme.text, textAlign: align }}>{brand.name}</Text>
      {lines.map((l, i) => (
        <Text key={i} style={{ fontSize: 8.5, color, marginTop: 1.5, textAlign: align }}>
          {l}
        </Text>
      ))}
    </View>
  );
}

export function Label({ children, theme, style }: { children: ReactNode; theme: PdfTheme; style?: Style }) {
  return <Text style={{ fontSize: 7.5, letterSpacing: 0.8, color: theme.muted, textTransform: "uppercase", marginBottom: 2, ...style }}>{children}</Text>;
}

export function Footer({ theme, brand, legend }: { theme: PdfTheme; brand: BrandSnapshot; legend?: string }) {
  return (
    <View
      fixed
      style={{
        position: "absolute",
        bottom: 24,
        left: PAGE_PADDING.horizontal,
        right: PAGE_PADDING.horizontal,
        borderTopWidth: 0.5,
        borderTopColor: theme.border,
        paddingTop: 6,
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <Text style={{ fontSize: 7.5, color: theme.muted, flex: 1 }}>{[brand.footerText, legend].filter(Boolean).join("  ·  ")}</Text>
      <Text style={{ fontSize: 7.5, color: theme.muted }} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  );
}

export function Paragraph({ title, text, theme }: { title: string; text: string | null; theme: PdfTheme }) {
  if (!text) return null;
  return (
    <View style={{ marginTop: 12 }} wrap={text.length > 800}>
      <Label theme={theme}>{title}</Label>
      <Text style={{ fontSize: 9, lineHeight: 1.45, color: theme.text }}>{text}</Text>
    </View>
  );
}

export function Signature({ name, title, theme }: { name: string | null; title: string | null; theme: PdfTheme }) {
  if (!name) return null;
  return (
    <View style={{ marginTop: 36, width: 200 }} wrap={false}>
      <View style={{ borderBottomWidth: 0.8, borderBottomColor: theme.text, height: 28 }} />
      <Text style={{ fontSize: 9, marginTop: 4, fontFamily: theme.fontBold, fontWeight: theme.boldWeight }}>{name}</Text>
      {title ? <Text style={{ fontSize: 8, color: theme.muted }}>{title}</Text> : null}
    </View>
  );
}
