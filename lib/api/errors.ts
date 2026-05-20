import { NextResponse } from "next/server";

// Standard envelopes so every route returns the same shape.
//   success → { ...payload }
//   error   → { error: <code>, reason?: <human>, ...context? }

export function ok<T extends object>(payload: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(payload, init);
}

export function err(
  status: number,
  code: string,
  reason?: string,
  context?: Record<string, unknown>,
): NextResponse {
  const body: Record<string, unknown> = { error: code };
  if (reason) body.reason = reason;
  if (context) Object.assign(body, context);
  return NextResponse.json(body, { status });
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
