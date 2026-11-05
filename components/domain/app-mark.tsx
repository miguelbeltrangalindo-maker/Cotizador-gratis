import Image from "next/image";
import { APP_NAME } from "@/lib/app-config";

export function AppMark({ size = 32 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Image src="/icons/icon-192.png" width={size} height={size} alt="" className="rounded-[9px]" priority />
      <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
    </span>
  );
}
