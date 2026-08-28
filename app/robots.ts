import type { MetadataRoute } from "next";
import { privateRoutes, siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Auth-gated app routes plus transactional pages that must never rank.
        // No trailing slashes: robots.txt matches by prefix, so "/pos/" would
        // leave the actual "/pos" page crawlable. /login, /forgot-password and
        // /reset-password are deliberately left crawlable so their `noindex`
        // tag can be read and honoured.
        disallow: [
          "/api/",
          ...privateRoutes,
          "/create-shop/pay",
          "/create-shop/success",
          "/shop-status",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
