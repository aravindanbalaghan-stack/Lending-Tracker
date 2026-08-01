import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LanguageProvider } from "@/components/LanguageProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { OfflineProvider } from "@/components/OfflineProvider";
import { LocalDataProvider } from "@/components/LocalDataProvider";
import OfflineBanner from "@/components/OfflineBanner";
import WeeklyBackup from "@/components/WeeklyBackup";
import NewLoanFab from "@/components/NewLoanFab";
import PinLock from "@/components/PinLock";
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
        {/* iOS: run fullscreen (no Safari URL bar) when added to home screen. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="Kanakku Book" />
        {/* Set the theme before first paint to avoid a light-mode flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('kanakku-theme');if(!t){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col pb-16 md:pb-0">
        <LanguageProvider>
          <ThemeProvider>
            <OfflineProvider>
              <LocalDataProvider>
                <ServiceWorkerRegister />
                <PinLock>
                  <OfflineBanner />
                  <WeeklyBackup />
                  {children}
                  <NewLoanFab />
                </PinLock>
              </LocalDataProvider>
            </OfflineProvider>
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
