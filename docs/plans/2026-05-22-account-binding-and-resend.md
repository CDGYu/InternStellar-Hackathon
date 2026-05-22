# Account Binding + Resend Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let new accounts resend their confirmation email and bind by email to existing accounts (OFW↔family, family↔store), so real new accounts connect and populate their dashboards.

**Architecture:** Server actions (service-role) for resend + binding, mirroring `app/auth/actions.ts`. One additive nullable column `profiles.store_id`. Binding logic isolated in `lib/account/binding.ts`. Dashboard banners (web + mobile) shown while unbound; a Settings "Connections" page to change links. Inventory scopes to `family.store_id` when set.

**Tech Stack:** Next.js 15 App Router, React 18.3 (`useFormState`), Supabase (`@supabase/ssr` cookie client + service-role admin), TypeScript.

**Spec:** `docs/specs/2026-05-22-account-binding-and-resend-design.md`

**Conventions to follow:**
- Server actions return `{ error: string }` (or `{ ok, error }`) for inline display; `useFormState` in client forms (see `app/(auth)/login/LoginForm.tsx`).
- Service-role writes via `getSupabaseAdmin()` (`lib/supabase-admin.ts`); cookie session reads via `createSupabaseServerClient()` (`lib/supabase/server.ts`).
- Money/ids unchanged. No stack-trace leakage in returned strings.
- Commit after each task.

---

## Task 1: Add `profiles.store_id` column

**Files:**
- Create: `db/migrations/2026-05-22-account-store-link.sql`
- Apply: via Supabase MCP `apply_migration` (project `xeaqcbskmzjkjrrlndan`)

- [ ] **Step 1: Write the migration file**

```sql
-- db/migrations/2026-05-22-account-store-link.sql
-- Additive, nullable. For role=family: the store this family shops at.
-- Backward-compatible with the otherwise-locked schema (authorized by P4).
alter table profiles
  add column if not exists store_id uuid references profiles(id);

comment on column profiles.store_id is
  'For role=family: the store profile this family shops at. NULL = global/single-store.';
```

- [ ] **Step 2: Apply via Supabase MCP**

Use `mcp__claude_ai_Supabase__apply_migration` with name `account_store_link` and the SQL above. Expected: success, no rows.

- [ ] **Step 3: Verify the column exists**

Run `mcp__claude_ai_Supabase__execute_sql`:
```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'profiles' and column_name = 'store_id';
```
Expected: one row, `uuid`, `YES`.

- [ ] **Step 4: Commit**

```bash
git add db/migrations/2026-05-22-account-store-link.sql
git commit -m "feat(db): add nullable profiles.store_id for family<->store binding"
```

---

## Task 2: Binding core logic — `lib/account/binding.ts`

**Files:**
- Create: `lib/account/binding.ts`
- Test: `scripts/_test-binding.ts`
- Modify: `package.json` (add `test:binding` script)

- [ ] **Step 1: Write the failing test**

```ts
// scripts/_test-binding.ts
import { strict as assert } from "node:assert";

import { classifyBindResult, normalizeEmail } from "../lib/account/binding";

let passed = 0;
let failed = 0;
function check(label: string, fn: () => void) {
  try { fn(); console.log(`  ok   ${label}`); passed++; }
  catch (e) { console.log(`  FAIL ${label}\n       ${e instanceof Error ? e.message : e}`); failed++; }
}

console.log("lib/account/binding — pure helpers");

check("normalizeEmail trims + lowercases", () => {
  assert.equal(normalizeEmail("  Foo@Bar.COM "), "foo@bar.com");
});

check("classify: target not found", () => {
  assert.equal(classifyBindResult({ target: null, expectedRole: "family", actingId: "a" }).reason, "not_found");
});
check("classify: wrong role", () => {
  assert.equal(
    classifyBindResult({ target: { id: "t", role: "store", sponsor_ofw_id: null }, expectedRole: "family", actingId: "a" }).reason,
    "wrong_role",
  );
});
check("classify: self link rejected", () => {
  assert.equal(
    classifyBindResult({ target: { id: "a", role: "family", sponsor_ofw_id: null }, expectedRole: "family", actingId: "a" }).reason,
    "self_link",
  );
});
check("classify: family already sponsored by another OFW", () => {
  assert.equal(
    classifyBindResult({ target: { id: "t", role: "family", sponsor_ofw_id: "other" }, expectedRole: "family", actingId: "a", conflictField: "sponsor_ofw_id" }).reason,
    "already_bound",
  );
});
check("classify: ok when valid", () => {
  const r = classifyBindResult({ target: { id: "t", role: "family", sponsor_ofw_id: null }, expectedRole: "family", actingId: "a" });
  assert.equal(r.ok, true);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 2: Run it; verify it fails**

Run: `npm run test:binding`
Expected: FAIL — `Cannot find module '../lib/account/binding'`.

- [ ] **Step 3: Implement `lib/account/binding.ts`**

```ts
// lib/account/binding.ts
import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type BindReason =
  | "not_found"
  | "wrong_role"
  | "already_bound"
  | "self_link"
  | "db_error";

export type Role = "ofw" | "family" | "store";

export interface TargetProfile {
  id: string;
  role: Role;
  sponsor_ofw_id: string | null;
}

export type BindResult =
  | { ok: true; targetId: string }
  | { ok: false; reason: BindReason };

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Pure decision function — no IO. Given the looked-up target row and the
 * expected role, decide whether the bind is allowed. `conflictField` names
 * the column on the target that must be empty for the bind to proceed
 * (e.g. "sponsor_ofw_id" when an OFW claims a family).
 */
export function classifyBindResult(args: {
  target: TargetProfile | null;
  expectedRole: Role;
  actingId: string;
  conflictField?: keyof TargetProfile;
}): BindResult {
  const { target, expectedRole, actingId, conflictField } = args;
  if (!target) return { ok: false, reason: "not_found" };
  if (target.role !== expectedRole) return { ok: false, reason: "wrong_role" };
  if (target.id === actingId) return { ok: false, reason: "self_link" };
  if (conflictField) {
    const current = target[conflictField];
    if (current && current !== actingId) return { ok: false, reason: "already_bound" };
  }
  return { ok: true, targetId: target.id };
}

/** Human copy for each reason — safe to show inline. */
export const BIND_REASON_MESSAGE: Record<BindReason, string> = {
  not_found: "No account found with that email.",
  wrong_role: "That account exists but isn't the right type for this link.",
  already_bound: "That account is already linked to a different account. Ask them to unlink first.",
  self_link: "You can't link an account to itself.",
  db_error: "Something went wrong saving the link. Try again.",
};

/** Look up a profile id by the user's email via auth.users → profiles. */
async function findProfileByEmail(email: string): Promise<TargetProfile | null> {
  const admin = getSupabaseAdmin();
  // auth.admin.listUsers has no email filter pre-bulk; use the SQL path via
  // a view-free join: query profiles joined to auth.users through the id.
  const { data, error } = await admin
    .rpc("profile_by_email", { p_email: normalizeEmail(email) });
  if (error || !data || data.length === 0) return null;
  const row = data[0] as { id: string; role: Role; sponsor_ofw_id: string | null };
  return { id: row.id, role: row.role, sponsor_ofw_id: row.sponsor_ofw_id };
}

/** OFW claims a family: set family.sponsor_ofw_id = ofwId. */
export async function bindFamilyToOfw(ofwId: string, familyEmail: string): Promise<BindResult> {
  const target = await findProfileByEmail(familyEmail);
  const decision = classifyBindResult({ target, expectedRole: "family", actingId: ofwId, conflictField: "sponsor_ofw_id" });
  if (!decision.ok) return decision;
  const { error } = await getSupabaseAdmin()
    .from("profiles").update({ sponsor_ofw_id: ofwId }).eq("id", decision.targetId);
  return error ? { ok: false, reason: "db_error" } : { ok: true, targetId: decision.targetId };
}

/** Family picks its sponsoring OFW: set own sponsor_ofw_id = ofwId. */
export async function bindSponsorOfw(familyId: string, ofwEmail: string): Promise<BindResult> {
  const target = await findProfileByEmail(ofwEmail);
  const decision = classifyBindResult({ target, expectedRole: "ofw", actingId: familyId });
  if (!decision.ok) return decision;
  const { error } = await getSupabaseAdmin()
    .from("profiles").update({ sponsor_ofw_id: decision.targetId }).eq("id", familyId);
  return error ? { ok: false, reason: "db_error" } : { ok: true, targetId: decision.targetId };
}

/** Family picks its store: set own store_id = storeId. */
export async function bindStore(familyId: string, storeEmail: string): Promise<BindResult> {
  const target = await findProfileByEmail(storeEmail);
  const decision = classifyBindResult({ target, expectedRole: "store", actingId: familyId });
  if (!decision.ok) return decision;
  const { error } = await getSupabaseAdmin()
    .from("profiles").update({ store_id: decision.targetId }).eq("id", familyId);
  return error ? { ok: false, reason: "db_error" } : { ok: true, targetId: decision.targetId };
}
```

- [ ] **Step 4: Add the `profile_by_email` RPC** (email lives in `auth.users`, not `profiles`)

Create `db/migrations/2026-05-22-profile-by-email-rpc.sql` and apply via MCP:
```sql
create or replace function profile_by_email(p_email text)
returns table (id uuid, role text, sponsor_ofw_id uuid)
language sql
security definer
set search_path = public
as $$
  select p.id, p.role, p.sponsor_ofw_id
  from profiles p
  join auth.users u on u.id = p.id
  where lower(u.email) = lower(p_email)
  limit 1;
$$;
revoke all on function profile_by_email(text) from public, anon, authenticated;
grant execute on function profile_by_email(text) to service_role;
```
Apply with `apply_migration` name `profile_by_email_rpc`. Verify with:
```sql
select * from profile_by_email('maria.ofw@internstellar.demo');
```
Expected: the OFW row.

- [ ] **Step 5: Add npm script**

Modify `package.json` scripts: add `"test:binding": "npx tsx scripts/_test-binding.ts",`.

- [ ] **Step 6: Run the test; verify it passes**

Run: `npm run test:binding`
Expected: `6 passed, 0 failed`. (The pure helpers run without DB; `findProfileByEmail`/bind* aren't exercised here — they need live data, covered by manual testing in Task 9.)

- [ ] **Step 7: Commit**

```bash
git add lib/account/binding.ts scripts/_test-binding.ts package.json db/migrations/2026-05-22-profile-by-email-rpc.sql
git commit -m "feat(account): binding core logic + profile_by_email rpc + wiring test"
```

---

## Task 3: Resend confirmation server action

**Files:**
- Modify: `app/auth/actions.ts` (append action)

- [ ] **Step 1: Add the action** to `app/auth/actions.ts` (reuses `requestOrigin()` + `safeServerClient()` already in the file):

```ts
export interface ResendResult {
  ok: boolean;
  error?: string;
}

/**
 * Resend the signup confirmation email. Used from the login page when a
 * user's earlier link was dead (e.g. Site URL was localhost). Supabase
 * silently succeeds for unknown/already-confirmed emails (enumeration
 * protection), so the caller shows generic success copy.
 */
export async function resendConfirmationAction(
  _prev: ResendResult | null,
  formData: FormData,
): Promise<ResendResult> {
  const email = (formData.get("email") as string | null)?.trim();
  if (!email) return { ok: false, error: "Enter your email first." };

  const { client: supabase, error: cfgErr } = safeServerClient();
  if (cfgErr || !supabase) {
    return { ok: false, error: "Deployment not configured — visit /status." };
  }

  const origin = await requestOrigin();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    ...(origin ? { options: { emailRedirectTo: `${origin}/auth/confirm` } } : {}),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add app/auth/actions.ts
git commit -m "feat(auth): resendConfirmationAction"
```

---

## Task 4: Resend control on the login forms (web + mobile)

**Files:**
- Modify: `app/(auth)/login/LoginForm.tsx`
- Modify: `app/mobile/login/page.tsx` (or its form component — inspect first)

- [ ] **Step 1: Web — add a resend affordance below the sign-in button in `LoginForm.tsx`.** Add a second `useFormState` bound to `resendConfirmationAction`, sharing the email input via `emailRef`. Insert after `<SubmitButton />`:

```tsx
// near top imports
import { resendConfirmationAction, type ResendResult } from "@/app/auth/actions";
// inside LoginForm(), after the existing useFormState:
const [resendState, resendAction] = useFormState<ResendResult | null, FormData>(
  resendConfirmationAction,
  null,
);
function resend() {
  const email = emailRef.current?.value?.trim();
  if (!email) return;
  const fd = new FormData();
  fd.set("email", email);
  resendAction(fd);
}
```

Render (after `<SubmitButton />`, before the demo divider):
```tsx
<button
  type="button"
  onClick={resend}
  className="text-xs text-ink-muted hover:text-accent transition-colors text-center"
>
  Didn&apos;t get the confirmation email? Resend
</button>
{resendState?.ok ? (
  <p role="status" className="text-xs text-accent-teal text-center">
    If that account needs confirming, an email is on its way.
  </p>
) : resendState?.error ? (
  <p role="alert" className="text-xs text-red-500 text-center">{resendState.error}</p>
) : null}
```

- [ ] **Step 2: Mobile — mirror it.** Read `app/mobile/login/page.tsx`; if it has a client form, add the same resend button + state with mobile styling (`text-[#5b7cff]`, etc.). If the page is a server component wrapping a client form, edit that form.

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.json` then `npm run build`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add "app/(auth)/login/LoginForm.tsx" app/mobile/login
git commit -m "feat(auth): resend-confirmation control on web + mobile login"
```

---

## Task 5: Binding server actions

**Files:**
- Create: `app/(app)/account/binding-actions.ts`

- [ ] **Step 1: Implement the three actions**

```ts
// app/(app)/account/binding-actions.ts
"use server";

import { revalidatePath } from "next/cache";

import {
  bindFamilyToOfw,
  bindSponsorOfw,
  bindStore,
  BIND_REASON_MESSAGE,
} from "@/lib/account/binding";
import { loadUserProfile } from "@/lib/auth-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface BindActionResult {
  ok: boolean;
  error?: string;
}

async function callerWithRole(expected: "ofw" | "family") {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." as const };
  const { profile } = await loadUserProfile(user.id);
  if (!profile || profile.role !== expected) {
    return { error: `Only a ${expected} account can do this.` as const };
  }
  return { userId: user.id };
}

export async function bindFamilyAction(_p: BindActionResult | null, fd: FormData): Promise<BindActionResult> {
  const email = (fd.get("email") as string | null)?.trim();
  if (!email) return { ok: false, error: "Enter the family's email." };
  const caller = await callerWithRole("ofw");
  if ("error" in caller) return { ok: false, error: caller.error };
  const r = await bindFamilyToOfw(caller.userId, email);
  if (!r.ok) return { ok: false, error: BIND_REASON_MESSAGE[r.reason] };
  revalidatePath("/ofw"); revalidatePath("/mobile/ofw");
  return { ok: true };
}

export async function bindSponsorAction(_p: BindActionResult | null, fd: FormData): Promise<BindActionResult> {
  const email = (fd.get("email") as string | null)?.trim();
  if (!email) return { ok: false, error: "Enter your OFW's email." };
  const caller = await callerWithRole("family");
  if ("error" in caller) return { ok: false, error: caller.error };
  const r = await bindSponsorOfw(caller.userId, email);
  if (!r.ok) return { ok: false, error: BIND_REASON_MESSAGE[r.reason] };
  revalidatePath("/family"); revalidatePath("/mobile/family");
  return { ok: true };
}

export async function bindStoreAction(_p: BindActionResult | null, fd: FormData): Promise<BindActionResult> {
  const email = (fd.get("email") as string | null)?.trim();
  if (!email) return { ok: false, error: "Enter the store's email." };
  const caller = await callerWithRole("family");
  if ("error" in caller) return { ok: false, error: caller.error };
  const r = await bindStore(caller.userId, email);
  if (!r.ok) return { ok: false, error: BIND_REASON_MESSAGE[r.reason] };
  revalidatePath("/family"); revalidatePath("/mobile/family");
  return { ok: true };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`. Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/account/binding-actions.ts"
git commit -m "feat(account): bind family/sponsor/store server actions"
```

---

## Task 6: Store scoping in dashboard loaders

**Files:**
- Modify: `lib/dashboard/family.ts` (loadFamilyDashboard)
- Modify: `lib/dashboard/ofw.ts` (loadOfwDashboard)

- [ ] **Step 1: family.ts — select the link fields + scope inventory.**
  - In the `profiles` select (line ~144), change to `.select("id, display_name, country, sponsor_ofw_id, store_id")`.
  - The inventory query (line ~154) must scope to the family's `store_id` when present. Since the family row and inventory are fetched in the same `Promise.all`, fetch the family row's `store_id` first OR run inventory after. Simplest: split — `await` the profile row, then build the inventory query:

```ts
const { data: familyRow, error: profErr } = await supabase
  .from("profiles")
  .select("id, display_name, country, sponsor_ofw_id, store_id")
  .eq("id", opts.familyId)
  .maybeSingle();
if (profErr) throw new Error(`family profile load failed: ${profErr.message}`);

let inventoryQuery = supabase
  .from("inventory")
  .select("id, store_id, name, category, price_stroops, stock, unit")
  .order("category", { ascending: true })
  .order("name", { ascending: true });
if (familyRow?.store_id) inventoryQuery = inventoryQuery.eq("store_id", familyRow.store_id);

const [wishlistResult, inventoryResult, billersResult, billsResult] = await Promise.all([
  /* wishlist query */, inventoryQuery, /* billers query */, /* bills query */,
]);
```
  Keep the rest of the function (and the returned `FamilyDashboardData`) unchanged. Add `sponsor_ofw_id` + `store_id` to the returned data (extend the interface) so the banner can read them.

- [ ] **Step 2: ofw.ts — scope inventory to the sponsored family's store.**
  - The OFW loads `familyId`. Fetch the family's `store_id` and scope inventory the same way. Extend the `profiles` select to include `store_id` for the family row; build `inventoryQuery` with `.eq("store_id", familyStoreId)` when set. (When `familyId` is null, inventory stays global — the editor just won't be used.)

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.json` then `npm run build`. Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add lib/dashboard/family.ts lib/dashboard/ofw.ts
git commit -m "feat(dashboard): scope inventory to family.store_id when bound"
```

---

## Task 7: Web binding UI — `AccountBindingForm` + `BindingBanner`

**Files:**
- Create: `app/(app)/account/AccountBindingForm.tsx`
- Create: `app/(app)/account/BindingBanner.tsx`
- Modify: `app/(app)/ofw/page.tsx`, `app/(app)/family/page.tsx`

- [ ] **Step 1: `AccountBindingForm` (client)** — generic email form bound to one of the three actions. Use the same `useFormState` + `Card/Input/Button` pattern as `LoginForm`.

```tsx
"use client";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { BindActionResult } from "./binding-actions";

type Action = (p: BindActionResult | null, fd: FormData) => Promise<BindActionResult>;

export function AccountBindingForm({ action, label, placeholder }: {
  action: Action; label: string; placeholder: string;
}) {
  const [state, formAction] = useFormState<BindActionResult | null, FormData>(action, null);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Input label={label} name="email" type="email" placeholder={placeholder} required />
      {state?.error ? <p role="alert" className="text-sm text-red-500">{state.error}</p> : null}
      {state?.ok ? <p role="status" className="text-sm text-accent-teal">Linked! Refreshing…</p> : null}
      <Submit />
    </form>
  );
}
function Submit() {
  const { pending } = useFormStatus();
  return <Button type="submit" variant="primary" disabled={pending}>{pending ? "Linking…" : "Connect"}</Button>;
}
```

- [ ] **Step 2: `BindingBanner` (server-friendly wrapper)** — a `Card` with copy + the form, rendered only when a link is missing. Takes `action`, `title`, `body`, `label`, `placeholder` props and renders `AccountBindingForm`.

```tsx
import { Card } from "@/components/ui/Card";
import { AccountBindingForm } from "./AccountBindingForm";
import type { BindActionResult } from "./binding-actions";

export function BindingBanner(props: {
  action: (p: BindActionResult | null, fd: FormData) => Promise<BindActionResult>;
  title: string; body: string; label: string; placeholder: string;
}) {
  return (
    <Card className="p-6 md:p-8 mb-8">
      <h3 className="font-display text-lg font-extrabold text-ink">{props.title}</h3>
      <p className="text-ink-muted text-sm mt-1 mb-4">{props.body}</p>
      <AccountBindingForm action={props.action} label={props.label} placeholder={props.placeholder} />
    </Card>
  );
}
```

- [ ] **Step 3: OFW page** — when `familyId` is null, render the banner above the dashboard:
```tsx
{familyId == null && (
  <BindingBanner
    action={bindFamilyAction}
    title="Connect the family you support"
    body="Enter your family's account email to link them. You'll then see their wishlists and bills here."
    label="Family email" placeholder="cora.family@example.com"
  />
)}
```
(Import `bindFamilyAction` from `@/app/(app)/account/binding-actions`.)

- [ ] **Step 4: Family page** — render a banner when `sponsor_ofw_id` is null (`bindSponsorAction`) and another when `store_id` is null (`bindStoreAction`). Read those fields from the extended `loadFamilyDashboard` data.

- [ ] **Step 5: Typecheck + build**, then commit:
```bash
git add "app/(app)/account/AccountBindingForm.tsx" "app/(app)/account/BindingBanner.tsx" "app/(app)/ofw/page.tsx" "app/(app)/family/page.tsx"
git commit -m "feat(account): web binding banners on OFW + family dashboards"
```

---

## Task 8: Mobile binding UI

**Files:**
- Create: `app/mobile/components/MobileBindingBanner.tsx` (mobile-styled, uses the same actions + `AccountBindingForm` logic or a mobile-styled inline form)
- Modify: `app/mobile/MobileDashboardClient.tsx` (render banner when OFW unsponsored / family missing sponsor or store)

- [ ] **Step 1:** Build `MobileBindingBanner` with the white-rounded-card mobile styling (see `MobileSendFunds`), an email input, and a submit calling the matching action via `useFormState`. Same three configurations (family / sponsor / store).
- [ ] **Step 2:** In `MobileDashboardClient`, render the relevant banner(s) at the top of the OFW/family home tab when the link(s) are missing. The client already receives dashboard data; ensure `sponsor_ofw_id`/`store_id`/`familyId` presence is passed through (extend the props from the mobile page server component if needed).
- [ ] **Step 3:** Typecheck + build, then commit:
```bash
git add app/mobile/components/MobileBindingBanner.tsx app/mobile/MobileDashboardClient.tsx app/mobile/ofw app/mobile/family
git commit -m "feat(account): mobile binding banners"
```

---

## Task 9: Settings "Connections" page (web + mobile) + manual verification

**Files:**
- Create: `app/settings/connections/page.tsx`
- Create: `app/mobile/settings/connections/page.tsx`
- Modify: settings hubs (`app/settings/page.tsx`, `app/mobile/settings/page.tsx`) to link it

- [ ] **Step 1:** Web Connections page (server component): load the caller's profile + role; show current links (sponsor OFW / store display names via `profile_by_email`-style lookups or joins) and the relevant `AccountBindingForm`(s) to change them. OFW sees its sponsored family; family sees its OFW + store; store sees its own email to share.
- [ ] **Step 2:** Mobile equivalent using `MobileSettingsShell`.
- [ ] **Step 3:** Add a "Connections" row to both settings hubs.
- [ ] **Step 4: Manual end-to-end verification.**
  - Register a fresh OFW, family, store (distinct emails).
  - As OFW: bind the family's email → OFW dashboard shows the family's data.
  - As family: bind the OFW email and the store email → Shop scopes to that store's inventory.
  - Try a bad email (`not_found`), a wrong-role email (`wrong_role`), and re-binding an already-sponsored family from a second OFW (`already_bound`) — confirm inline messages.
  - Resend: on login, click "Resend" with an unconfirmed email → generic success.
- [ ] **Step 5: Final typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.json` then `npm run build`. Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add app/settings/connections app/mobile/settings/connections app/settings/page.tsx app/mobile/settings/page.tsx
git commit -m "feat(account): Connections settings page (web + mobile)"
```

---

## Self-review notes (addressed)

- **Spec coverage:** resend (T3–T4), schema (T1), binding logic (T2), actions (T5), store scoping (T6), banners (T7–T8), settings (T9). All covered.
- **Email lookup:** spec said "auth.users → profiles" — implemented via the `profile_by_email` SECURITY DEFINER RPC (T2 Step 4), since `profiles` has no email column. Granted to service_role only.
- **Type consistency:** `BindResult`/`BindReason`/`BindActionResult` names are stable across T2/T5/T7/T8.
- **Inventory scoping** reuses each loader's existing inventory query; only adds a conditional `.eq("store_id", …)`.
