import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LanguageProvider } from "@/components/LanguageProvider";
import { OfflineProvider } from "@/components/OfflineProvider";
import OfflineBanner from "@/components/OfflineBanner";
import WeeklyBackup from "@/components/WeeklyBackup";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "கணக்கு Book — Lending Ledger",
  description: "Track who you've lent to, what's owed, and what's come in.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "கணக்கு Book",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#1b4332",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        {/* Explicit tags in addition to Next's metadata, so PWA crawlers
            (e.g. PWABuilder) reliably find the manifest even when landing
            on a redirected page. */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1b4332" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="min-h-full flex flex-col">
        <LanguageProvider>
          <OfflineProvider>
            <ServiceWorkerRegister />
            <OfflineBanner />
            <WeeklyBackup />
            {children}
          </OfflineProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
