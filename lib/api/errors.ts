import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

// Standard envelopes so every route returns the same shape.
//   success → { request_id, ...payload }
//   error   → { error: <code>, reason?: <human>, request_id, ...context? }
//
// `request_id` is generated fresh per response (UUID v4) and also written to
// the `X-Request-Id` response header so operators can grep server logs by it.
// Callers can propagate an incoming `X-Request-Id` by passing `requestId` in
// the options object.

export interface OkOpts {
  requestId?: string;
  init?: ResponseInit;
}

export interface ErrOpts {
  /** Sets the `Retry-After` header (in seconds). Use on 503 contract_not_configured. */
  retryAfterSeconds?: number;
  requestId?: string;
}

export function ok<T extends object>(payload: T, opts?: OkOpts): NextResponse {
  const requestId = opts?.requestId ?? randomUUID();
  const headers = new Headers(opts?.init?.headers);
  headers.set("X-Request-Id", requestId);
  return NextResponse.json(
    { request_id: requestId, ...payload },
    { ...opts?.init, headers },
  );
}

export function err(
  status: number,
  code: string,
  reason?: string,
  context?: Record<string, unknown>,
  opts?: ErrOpts,
): NextResponse {
  const requestId = opts?.requestId ?? randomUUID();
  const body: Record<string, unknown> = { error: code, request_id: requestId };
  if (reason) body.reason = reason;
  if (context) Object.assign(body, context);

  const headers = new Headers();
  headers.set("X-Request-Id", requestId);
  if (opts?.retryAfterSeconds !== undefined) {
    headers.set("Retry-After", String(opts.retryAfterSeconds));
  }

  return NextResponse.json(body, { status, headers });
}

// Tiny request-body parser. Returns the parsed JSON object, OR a NextResponse
// when the body is missing/malformed — callers do `if (parsed instanceof
// NextResponse) return parsed;` to forward the 400 cleanly.
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
