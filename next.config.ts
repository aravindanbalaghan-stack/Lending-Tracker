import type { NextConfig } from "next";

// Defense-in-depth HTTP security headers. Vercel/Next already handle a lot
// of this well, but setting these explicitly avoids relying on defaults.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // The Digital Asset Links file must be served as JSON so Android can
        // verify the installed app owns this domain (removes the browser
        // address bar in the PWA/TWA). Lives at /.well-known/assetlinks.json.
        source: "/.well-known/assetlinks.json",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
    ];
  },
};

export default nextConfig;
