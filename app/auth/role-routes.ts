/**
 * Single source of truth for "which dashboard does this role belong to."
 *
 * Used by:
 *   - signInAction        (post-login redirect)
 *   - login page          (already-signed-in self-redirect)
 *   - landing CTA         (future role-aware deep-link, if needed)
 *
 * Keeping these one line apart used to drift — when /family and /store
 * were added, signInAction routed to /family but the login page still
 * routed to /. This file exists to prevent that class of bug.
 */
export type Role = "ofw" | "family" | "store";

export function dashboardForRole(role: string | null | undefined): string {
  switch (role) {
    case "ofw":
      return "/ofw";
    case "family":
      return "/family";
    case "store":
      return "/store";
    default:
      return "/";
  }
}
