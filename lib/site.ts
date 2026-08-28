const DEV_FALLBACK_URL = "http://localhost:3000";

/**
 * Public origin of the deployment. Canonical URLs, robots.txt, and sitemap.xml
 * are worthless (or actively harmful) if this silently falls back to localhost,
 * so a production build without it fails loudly instead.
 */
function resolveSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    process.env.NEXTAUTH_URL ??
    // Netlify injects these itself. Deploy previews and branch deploys get a
    // per-deploy hostname that netlify.toml cannot spell out ahead of time, so
    // without this fallback every non-production deploy would fail the guard
    // below. DEPLOY_PRIME_URL is the branch URL; URL is the site's primary one.
    process.env.DEPLOY_PRIME_URL ??
    process.env.URL;

  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Missing NEXT_PUBLIC_APP_URL (or APP_URL / NEXTAUTH_URL). Without it, canonical tags, robots.txt, and sitemap.xml would publish localhost URLs.",
      );
    }
    return DEV_FALLBACK_URL;
  }

  return raw.replace(/\/+$/, "");
}

export const siteUrl = resolveSiteUrl();

export const siteConfig = {
  name: "Shopkeeper",
  title: "Shopkeeper — POS, inventory, and ledger for Pakistani retailers",
  description:
    "Run one shop or many from a single account: point of sale, inventory, customer khata, expenses, and reports. Pay with EasyPaisa, JazzCash, or bank transfer and go live in minutes.",
  locale: "en_PK",
} as const;

/** App routes behind auth (see the proxy matcher) — never crawl or index these. */
export const privateRoutes = [
  "/dashboard",
  "/pos",
  "/inventory",
  "/categories",
  "/brands",
  "/customers",
  "/customer-groups",
  "/vendors",
  "/suppliers",
  "/ledger",
  "/sales",
  "/purchases",
  "/spot-purchases",
  "/employees",
  "/attendance",
  "/salaries",
  "/expenses",
  "/coupons",
  "/activity",
  "/login-history",
  "/reports",
  "/settings",
  "/accounting",
  "/bank",
  "/warehouses",
  "/super-admin",
] as const;

/**
 * Next.js replaces (does not merge) `openGraph` when a child segment defines it,
 * so per-page overrides must spread this base or they silently drop og:type,
 * og:site_name, og:locale and the generated og:image.
 */
export const openGraphBase = {
  type: "website",
  siteName: siteConfig.name,
  locale: siteConfig.locale,
} as const;
