import { BackToHomeButton } from "@/components/ui/BackToHomeButton";
import { Card } from "@/components/ui/Card";
import { SparkleIcon } from "@/components/ui/icons";

import { RegisterForm } from "./RegisterForm";

export const dynamic = "force-dynamic";

/**
 * Sign-up page. Server component — only the form is client.
 *
 * We deliberately do NOT auto-redirect signed-in users away. Clicking
 * "Register an account" from the marketing page should always land on the
 * form — useful for creating additional demo accounts (OFW + family + store)
 * from a single browser session without having to sign out first.
 */
export default async function RegisterPage() {
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
