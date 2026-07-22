import type { NextRequest } from "next/server";

export type ClientDeviceInfo = {
  ip: string;
  browser: string;
  device: string;
  userAgent: string;
};

type HeaderSource =
  | Headers
  | Record<string, string | string[] | undefined>
  | { get?: (name: string) => string | null | undefined }
  | null
  | undefined;

export type { HeaderSource };

function readHeader(headers: HeaderSource, name: string): string {
  if (!headers) return "";
  if (typeof (headers as Headers).get === "function") {
    const value = (headers as Headers).get(name);
    return value ?? "";
  }
  const record = headers as Record<string, string | string[] | undefined>;
  const direct = record[name] ?? record[name.toLowerCase()] ?? record[name.toUpperCase()];
  if (Array.isArray(direct)) return direct[0] ?? "";
  return typeof direct === "string" ? direct : "";
}

export function parseUserAgent(ua: string): { browser: string; device: string } {
  const value = ua || "";
  let browser = "Unknown";
  if (/Edg\//i.test(value)) browser = "Edge";
  else if (/Chrome\//i.test(value) && !/Edg\//i.test(value)) browser = "Chrome";
  else if (/Firefox\//i.test(value)) browser = "Firefox";
  else if (/Safari\//i.test(value) && !/Chrome\//i.test(value)) browser = "Safari";
  else if (/Opera|OPR\//i.test(value)) browser = "Opera";
  else if (/MSIE|Trident\//i.test(value)) browser = "IE";

  let device = "Desktop";
  if (/iPad|Tablet/i.test(value)) device = "Tablet";
  else if (/Mobi|Android|iPhone|iPod/i.test(value)) device = "Mobile";

  return { browser, device };
}

function normalizeClientIp(ip: string): string {
  const value = ip.trim();
  if (!value) return "";
  if (value === "::1" || value === "0:0:0:0:0:0:0:1") return "127.0.0.1";
  return value;
}

export function formatClientIpForDisplay(ip?: string | null): string {
  const value = normalizeClientIp(ip ?? "");
  if (!value || value === "unknown") return "—";
  if (value === "127.0.0.1") return "127.0.0.1 (local)";
  return value;
}

function resolveClientIp(headers: HeaderSource): string {
  const forwarded = readHeader(headers, "x-forwarded-for");
  const realIp = readHeader(headers, "x-real-ip");
  const cfIp = readHeader(headers, "cf-connecting-ip");
  const vercelIp = readHeader(headers, "x-vercel-forwarded-for");
  const trueClientIp = readHeader(headers, "true-client-ip");
  const ip = normalizeClientIp(forwarded.split(",")[0] || realIp || cfIp || vercelIp || trueClientIp || "");
  if (ip) return ip;

  const host = readHeader(headers, "host");
  if (/localhost|127\.0\.0\.1/i.test(host)) return "127.0.0.1";

  return "unknown";
}

export function getClientDeviceInfo(req?: NextRequest | Request | { headers?: HeaderSource } | null): ClientDeviceInfo {
  try {
    const headers = (req as { headers?: HeaderSource } | null | undefined)?.headers;
    const ip = resolveClientIp(headers);
    const userAgent = readHeader(headers, "user-agent");
    const { browser, device } = parseUserAgent(userAgent);
    return { ip, browser, device, userAgent };
  } catch {
    return { ip: "unknown", browser: "Unknown", device: "Desktop", userAgent: "" };
  }
}

export function getBrowserDeviceFromUserAgent(userAgent?: string | null) {
  return parseUserAgent(userAgent ?? "");
}
