import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Email-link verification handler.
 *
 * Supabase emails a confirmation link of the form
 *   {SITE_URL}/auth/confirm?token_hash=…&type=email
 * (configure that template in Supabase Studio → Authentication → Email
 * Templates → Confirm signup; the default template's `{{ .ConfirmationURL }}`
 * already resolves to this shape once the site URL is set correctly).
 *
 * This GET handler:
 *   1. Reads `token_hash` + `type` off the URL.
 *   2. Calls `supabase.auth.verifyOtp(...)` — that's what *actually*
 *      flips the auth.users row from "unconfirmed" to "confirmed" and
 *      sets the session cookies via our cookie writer.
 *   3. Redirects to /auth/confirmed (success) or /auth/confirmed?error=…
 *      (failure — the success page surfaces the message inline).
 *
 * Why a route handler and not a server action: the entry point is a GET
 * from the user's email client, not a form POST. Route handlers are the
 * App Router way to handle inbound GETs that should run server logic.
 *
 * Why `redirect()` and not `NextResponse.redirect()`: `redirect()` from
 * next/navigation correctly preserves the cookies our Supabase client
 * just wrote during `verifyOtp`. NextResponse.redirect builds a fresh
 * response object that drops them.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (!token_hash || !type) {
    redirect("/auth/confirmed?error=missing_token");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    // Most common cause: link reused or expired. The confirmed page
    // surfaces the actual message so it's debuggable from the UI.
    redirect(`/auth/confirmed?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/auth/confirmed");
}
