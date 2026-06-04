import type { MetadataRoute } from "next";
import { SERVICE_LANDING_PAGES } from "@/lib/serviceLandingPages";

const baseUrl = "https://pinoyboosting.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = [
    "",
    "/quick-start",
    "/vip",
    "/order-page",
    "/track",
    "/affiliate",
    "/login",
    "/services",
    ...SERVICE_LANDING_PAGES.map((page) => `/services/${page.slug}`),
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : route === "/vip" || route === "/order-page" ? 0.8 : 0.6,
  }));
}
