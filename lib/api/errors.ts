import { NextResponse } from "next/server";

import { RequestIdHeader } from "./request-id";

// Standard envelopes so every route returns the same shape.
//   success → { ...payload, request_id? }
//   error   → { error: <code>, reason?: <human>, request_id?, ...context? }

export interface EnvelopeOptions {
  requestId?: string;
  /** Sets Retry-After header (seconds). Use on 503 contract_not_configured. */
  retryAfterSeconds?: number;
  headers?: HeadersInit;
}

export function ok<T extends object>(
  payload: T,
  options: EnvelopeOptions = {},
  init?: ResponseInit,
): NextResponse {
  const body = options.requestId
    ? { ...payload, request_id: options.requestId }
    : payload;
  const res = NextResponse.json(body, init);
  if (options.requestId) res.headers.set(RequestIdHeader, options.requestId);
  if (options.headers) {
    new Headers(options.headers).forEach((v, k) => res.headers.set(k, v));
  }
  return res;
}

export function err(
  status: number,
  code: string,
  reason?: string,
  context?: Record<string, unknown>,
  options: EnvelopeOptions = {},
): NextResponse {
  const body: Record<string, unknown> = { error: code };
  if (reason) body.reason = reason;
  if (context) Object.assign(body, context);
  if (options.requestId) body.request_id = options.requestId;
  const res = NextResponse.json(body, { status });
  if (options.requestId) res.headers.set(RequestIdHeader, options.requestId);
  if (options.retryAfterSeconds !== undefined) {
    res.headers.set("Retry-After", String(options.retryAfterSeconds));
  }
  if (options.headers) {
    new Headers(options.headers).forEach((v, k) => res.headers.set(k, v));
  }
  return res;
}

// Tiny request-body parser. Returns the parsed JSON object, OR a NextResponse
// when the body is missing/malformed — callers do `if (parsed instanceof
// NextResponse) return parsed;` to forward the 400 cleanly.
//
// Note: this fires BEFORE the route assigns a requestId, so its internal
// err() calls don't include one. Acceptable for the demo: malformed-body
// 400s are caller errors, not server-side incidents that need correlation.
export async function parseJsonBody(req: Request): Promise<Record<string, unknown> | NextResponse> {
  try {
    const json = await req.json();
    if (json === null || typeof json !== "object" || Array.isArray(json)) {
      return err(400, "invalid_body", "Request body must be a JSON object.");
    }
    return json as Record<string, unknown>;
  } catch {
    return err(400, "invalid_body", "Request body is not valid JSON.");
  }
}
