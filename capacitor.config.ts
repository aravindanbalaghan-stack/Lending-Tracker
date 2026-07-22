import type { CapacitorConfig } from "@capacitor/cli";

// This app is a hosted Next.js app (with server-side auth + middleware), so
// the Android wrapper loads it from the live URL rather than bundling a
// static export. Benefits: the middleware approval-gate and Supabase SSR
// keep working, and the APK auto-updates whenever you deploy to Vercel —
// no need to rebuild and redistribute the APK for content changes.
//
// IMPORTANT: replace `server.url` below with your actual deployed URL before
// building the APK. It must be https.
const config: CapacitorConfig = {
  appId: "book.kanakku.app",
  appName: "Kanakku Book",
  webDir: "public",
  server: {
    url: "https://YOUR-APP.vercel.app",
    cleartext: false,
  },
  android: {
    backgroundColor: "#1b4332",
  },
};

export default config;
