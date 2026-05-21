"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { buildThemeCookie, type Theme } from "@/lib/theme";

/**
 * Persist the chosen theme to the cookie.
 *
 * After writing, we revalidate `/` so the layout re-reads the cookie
 * with the new value and the `.dark` class on <html> flips. The form
 * that calls this lives on /settings, which is also covered by the
 * root layout, so the same revalidation refreshes that page too.
 *
 * No redirect: the caller usually wants to stay on /settings and see
 * the toggle change state.
 */
export async function setThemeAction(formData: FormData) {
  const requested = formData.get("theme") as string | null;
  const next: Theme = requested === "dark" ? "dark" : "light";

  (await cookies()).set(buildThemeCookie(next));

  // Revalidate the layout — that re-runs getTheme() and the <html>
  // className changes on the next render of any page.
  revalidatePath("/", "layout");
}
