import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import { site } from "@/lib/site";
import { getSettings, toPublic } from "@/lib/settings";
import Analytics from "@/components/Analytics";
import Providers from "@/components/Providers";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display", weight: ["400", "500", "600", "700"] });
const body = Manrope({ subsets: ["latin"], variable: "--font-body" });

export async function generateMetadata(): Promise<Metadata> {
  const { store } = await getSettings();
  return {
    metadataBase: new URL(site.url),
    title: { default: `${store.name} — Eyeglasses & Sunglasses with 3D Virtual Try-On`, template: `%s | ${store.name}` },
    description: store.description,
    openGraph: { type: "website", siteName: store.name, title: store.name, description: store.description },
    twitter: { card: "summary_large_image" },
    alternates: { canonical: "/" },
  };
}

export const viewport: Viewport = { themeColor: "#0a2463", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <Providers settings={toPublic(settings)}>{children}</Providers>
        <Analytics gaId={settings.marketing.gaId} adsId={settings.marketing.adsId} adsLabel={settings.marketing.adsPurchaseLabel} />
      </body>
    </html>
  );
}
