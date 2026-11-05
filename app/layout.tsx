import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { APP_NAME } from "@/lib/app-config";
import { OfflineBanner, ServiceWorkerRegister } from "@/components/ui/client";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Cotizaciones profesionales y recibos de pago en minutos, sin Excel ni Word.",
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F5F2EB",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-MX">
      <body className="min-h-dvh">
        <OfflineBanner />
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
