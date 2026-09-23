import path from "node:path";
import type { NextConfig } from "next";

// Only the third parties the store actually uses may load code or be contacted:
// PayPal (checkout), Google Tag Manager/Analytics (if enabled), jsDelivr + Google Storage (try-on face model).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://www.paypal.com https://*.paypal.com https://www.paypalobjects.com https://www.googletagmanager.com https://cdn.jsdelivr.net",
  "connect-src 'self' blob: data: https://*.paypal.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://cdn.jsdelivr.net https://storage.googleapis.com",
  "img-src 'self' data: blob: https://*.paypal.com https://*.paypalobjects.com https://www.googletagmanager.com https://*.google-analytics.com https://static.xtransfer.com https://www.dhl.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "frame-src https://*.paypal.com https://www.paypal.com",
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "nodemailer", "pdfkit"],
  // pdfkit reads its built-in fonts from disk at runtime; make sure Vercel bundles them
  outputFileTracingIncludes: { "/**": ["./node_modules/pdfkit/js/data/**"] },
  // the 3D-model shrinker (@gltf-transform) mentions Node's fs/path for its Node-only reader;
  // browsers never use that code, so leave those modules out of the browser bundle
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      const empty = path.resolve(process.cwd(), "src/lib/empty-module.js");
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^node:(fs|path)$/, (res: { request: string }) => {
        res.request = empty;
      }));
    }
    return config;
  },
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: "25mb" } },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          // camera is only used by the try-on studio, on this origin
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(self \"https://www.paypal.com\")" },
        ],
      },
    ];
  },
};

export default nextConfig;
