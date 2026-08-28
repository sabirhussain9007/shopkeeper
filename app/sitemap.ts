import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Only publicly reachable, indexable pages belong here. Auth-gated routes,
// redirect-only routes (/signup -> /create-shop) and transactional steps are
// excluded — listing them makes Search Console report crawl errors.
const routes = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/create-shop", changeFrequency: "monthly", priority: 0.8 },
] as const satisfies ReadonlyArray<{
  path: string;
  changeFrequency: NonNullable<
    MetadataRoute.Sitemap[number]["changeFrequency"]
  >;
  priority: number;
}>;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return routes.map((route) => ({
    url: new URL(route.path, siteUrl).toString(),
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
