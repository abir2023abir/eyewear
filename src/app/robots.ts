import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/account", "/checkout", "/order", "/cart"] }],
    sitemap: `${site.url}/sitemap.xml`,
  };
}
