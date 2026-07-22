import { AsyncLocalStorage } from "node:async_hooks";

type AuthRequestContext = {
  headers: Headers;
};

const authRequestStore = new AsyncLocalStorage<AuthRequestContext>();

function enrichHeaders(req: Request): Headers {
  const headers = new Headers(req.headers);
  if (headers.get("x-forwarded-for") || headers.get("x-real-ip") || headers.get("cf-connecting-ip")) {
    return headers;
  }

  const ip = (req as Request & { ip?: string }).ip?.trim() ?? "";
  if (ip) {
    headers.set("x-forwarded-for", ip);
  }

  return headers;
}

export function runWithAuthRequest<T>(req: Request, fn: () => T): T {
  return authRequestStore.run({ headers: enrichHeaders(req) }, fn);
}

export function getAuthRequestHeaders(): Headers | undefined {
  return authRequestStore.getStore()?.headers;
}
