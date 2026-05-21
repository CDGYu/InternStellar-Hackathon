import { randomUUID } from "node:crypto";

// Header the UI and curl users can echo back for log correlation.
export const RequestIdHeader = "X-Request-Id";

/**
 * Returns the inbound X-Request-Id if the caller supplied one (UUID v4
 * format) so request chains are traceable across the UI → API → contract
 * boundary. Falls back to a fresh UUID v4 otherwise.
 */
export function newRequestId(req: Request): string {
  const incoming = req.headers.get(RequestIdHeader);
  if (incoming && /^[0-9a-f-]{36}$/i.test(incoming)) return incoming;
  return randomUUID();
}
