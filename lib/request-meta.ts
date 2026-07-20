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

export function getClientDeviceInfo(req?: NextRequest | Request | { headers?: HeaderSource } | null): ClientDeviceInfo {
  try {
    const headers = (req as { headers?: HeaderSource } | null | undefined)?.headers;
    const forwarded = readHeader(headers, "x-forwarded-for");
    const realIp = readHeader(headers, "x-real-ip");
    const cfIp = readHeader(headers, "cf-connecting-ip");
    const ip = (forwarded.split(",")[0] || realIp || cfIp || "").trim() || "unknown";
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
