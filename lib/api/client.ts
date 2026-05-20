"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Client-side helper for the API routes that require an Authorization
 * Bearer token (everything under /api/escrow/*, /api/deposit, and
 * /api/balances/*). The routes call `requireUser(req)` which expects
 * a JWT in the Authorization header — they don't read the session
 * cookie themselves.
 *
 * Wire shape (see lib/api/errors.ts):
 *   2xx → `{ ...payload }`                       (the success body IS the data)
 *   4xx/5xx → `{ error: <code>, reason: <human>, ...context }`
 *
 * Usage:
 *   const result = await apiPost("/api/escrow/lock", { family_id, wishlist_id });
 *   if (!result.ok) { setError(result.message); return; }
 *   const tx = result.data.tx_hash;
 *
 * Returns a discriminated union so callers can render the error
 * directly without parsing HTTP status codes.
 */
export interface ApiOk<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  status: number;
  /** Stable machine-readable code from lib/api/errors.ts (e.g. "contract_error"). */
  code: string;
  /** Human-readable explanation, safe to show inline. */
  message: string;
  /** Optional context (e.g. { current_role: "family" } on a 403). */
  detail?: Record<string, unknown>;
}

export type ApiResult<T> = ApiOk<T> | ApiError;

async function getBearer(): Promise<string | null> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

function parseError(status: number, json: Record<string, unknown> | null): ApiError {
  // Pull out the well-known fields; everything else becomes `detail`.
  const code = typeof json?.error === "string" ? (json.error as string) : "unknown_error";
  const reason = typeof json?.reason === "string" ? (json.reason as string) : `HTTP ${status}`;
  const detail: Record<string, unknown> = {};
  if (json) {
    for (const [k, v] of Object.entries(json)) {
      if (k !== "error" && k !== "reason") detail[k] = v;
    }
  }
  return {
    ok: false,
    status,
    code,
    message: reason,
    detail: Object.keys(detail).length > 0 ? detail : undefined,
  };
}

async function doFetch<T>(
  path: string,
  init: RequestInit,
): Promise<ApiResult<T>> {
  const token = await getBearer();
  if (!token) {
    return {
      ok: false,
      status: 401,
      code: "no_session",
      message: "Not signed in. Refresh the page and try again.",
    };
  }

  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      code: "network_error",
      message: err instanceof Error ? err.message : "Network request failed.",
    };
  }

  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;

  if (res.ok) {
    return { ok: true, data: (json ?? {}) as T };
  }
  return parseError(res.status, json);
}

/** POST JSON to an API route. Returns parsed JSON on 2xx, structured error otherwise. */
export async function apiPost<T = unknown>(
  path: string,
  body: unknown,
): Promise<ApiResult<T>> {
  return doFetch<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** GET an API route. Same shape as apiPost. */
export async function apiGet<T = unknown>(path: string): Promise<ApiResult<T>> {
  return doFetch<T>(path, { method: "GET" });
}
