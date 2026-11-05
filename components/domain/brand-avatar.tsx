import { initials } from "@/lib/utils/text";
import { readableTextOn } from "@/lib/utils/color";

/** Logo privado (servido con autorización) o iniciales sobre el color de la marca. */
export function BrandAvatar({ name, color, logoFileId, size = 48 }: { name: string; color: string; logoFileId: string | null; size?: number }) {
  if (logoFileId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`/api/files/${logoFileId}`} alt={`Logo de ${name}`} width={size} height={size} className="shrink-0 rounded-lg border border-border bg-white object-contain" style={{ width: size, height: size }} />
    );
  }
  return (
    <span className="flex shrink-0 items-center justify-center rounded-lg font-semibold" style={{ width: size, height: size, background: color, color: readableTextOn(color) }} aria-hidden>
      {initials(name)}
    </span>
  );
}
