import { NextResponse } from "next/server";

import { err, ok } from "../../../lib/api/errors";
import { newRequestId } from "../../../lib/api/request-id";
import { buildHealthReport } from "../../../lib/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Deployment-status / readiness probe.
 *
 * Body shape (success and degraded both — only `error` and the HTTP status
 * differ):
 *
 *   {
 *     ok:          true | false,
 *     chain:       "ok" | "unconfigured",          // back-compat
 *     db:          "ok" | "err",                   // back-compat
 *     contract_id: "C…" (omitted if env missing),  // back-compat
 *     checks: {
 *       env:                 { <var>: "ok" | "missing", … },
 *       supabase_admin:      { status, reason? },
 *       stellar_rpc:         { status, passphrase?, passphrase_matches?, protocol_version?, reason? },
 *       stellar_signer:      { status, public_key?, reason? },
 *       stellar_contract_id: { status, contract_id?, reason? },
 *     },
 *     request_id: "<uuid>",
 *   }
 *
 * 200 → everything green.
 * 503 + Retry-After: 15 → at least one probe degraded.
 *
 * Top-level `chain` / `db` keys are kept for back-compat with the existing
 * dashboard pre-flight; new callers should key off `ok` and `checks.*` for
 * actionable detail. The humanized version lives at /status.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const requestId = newRequestId(req);
  const report = await buildHealthReport();

  if (!report.ok) {
    return err(503, "degraded", undefined, report as unknown as Record<string, unknown>, {
      requestId,
      retryAfterSeconds: 15,
    });
  }
  return ok(report as unknown as Record<string, unknown>, { requestId });
}
