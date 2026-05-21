/**
 * Shared list of demo accounts surfaced as quick-fill chips on both the
 * web login form (`app/(auth)/login/LoginForm.tsx`) and the mobile login
 * form (`app/mobile/login/MobileLoginForm.tsx`). Single source of truth
 * so the two forms can't drift.
 *
 * These accounts are seeded by `db/seed.sql` with fixed UUIDs — see
 * CLAUDE.md "Demo seed data" for the IDs and how to recreate them.
 */
export const DEMO_ACCOUNTS = [
  {
    label: "Auntie Maria",
    role: "OFW",
    email: "maria.ofw@internstellar.demo",
    password: "demo123456",
  },
  {
    label: "Lola Cora",
    role: "Family",
    email: "cora.family@internstellar.demo",
    password: "demo123456",
  },
  {
    label: "Aling Nena",
    role: "Store",
    email: "nena.store@internstellar.demo",
    password: "demo123456",
  },
] as const;

export type DemoAccount = (typeof DEMO_ACCOUNTS)[number];
