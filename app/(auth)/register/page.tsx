import { redirect } from "next/navigation";

import { dashboardForRole } from "@/app/auth/role-routes";
import { BackToHomeButton } from "@/components/ui/BackToHomeButton";
import { Card } from "@/components/ui/Card";
import { SparkleIcon } from "@/components/ui/icons";
import { loadUserProfile } from "@/lib/auth-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { RegisterForm } from "./RegisterForm";

export const dynamic = "force-dynamic";

/**
 * Sign-up page. Server component — only the form is client.
 *
 * Already-signed-in users get bounced to their dashboard so we don't
 * sit them on a form they shouldn't fill out (and so the "back to home"
 * affordance there points somewhere useful instead).
 */
export default async function RegisterPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { profile } = await loadUserProfile(user.id);
    redirect(dashboardForRole(profile?.role));
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center px-4 py-16">
      <BackToHomeButton />

      <Card className="w-full max-w-md p-8 md:p-12">
        <div className="flex items-center gap-3 mb-10">
          <div className="h-11 w-11 rounded-2xl bg-surface shadow-neu flex items-center justify-center text-accent">
            <SparkleIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-base font-extrabold tracking-tight text-ink">
              InternStellar
            </p>
            <p className="text-xs text-ink-muted -mt-0.5">Chain Bridge</p>
          </div>
        </div>

        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-ink">
          Create your account.
        </h1>
        <p className="mt-2 text-ink-muted">
          A few details so we know which dashboard to set you up with.
        </p>

        <div className="mt-8">
          <RegisterForm />
        </div>
      </Card>
    </main>
  );
}
