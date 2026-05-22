# Account Binding + Resend Confirmation — Design

Date: 2026-05-22
Owner: P4 (Charles) / full-stack
Status: Approved (brainstorming) — pending implementation plan

## Problem

Two gaps for real (non-seed) accounts:

1. **Dead confirmation links.** If a confirmation email was sent while the
   Supabase Site URL pointed at localhost, the user can't confirm from another
   device. There is no way to request a fresh email.
2. **Empty dashboards for new accounts.** A freshly-registered OFW only sees
   data through a family it sponsors (`profiles.sponsor_ofw_id`); a new family
   only shops once tied to a store. With no link, the dashboard is empty and the
   live multi-role flow can't run with new accounts.

This adds (A) a resend-confirmation control and (B) account binding by email so
new accounts connect to existing ones: **OFW ↔ Family** and **Family ↔ Store**.

Non-goals: auto-seeding fake demo data; an approval/invitation handshake;
multi-OFW-per-family or multi-store-per-family; changing the escrow flow.

## Feature A — Resend confirmation email

- **Server action** `resendConfirmationAction(email)` in `app/auth/actions.ts`:
  calls `supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: ${requestOrigin}/auth/confirm } })`
  using the existing `requestOrigin()` helper. Returns `{ ok }` / `{ error }`.
- **UI**: on `app/(auth)/login/page.tsx` and `app/mobile/login/page.tsx`, a small
  "Didn't get the confirmation email? Resend" control that reuses the email
  already typed into the login form. Inline success ("Sent — check your inbox")
  / error.
- **Constraint**: subject to Supabase's email rate limits (the same limiter that
  previously produced "email rate limit exceeded"); surface that message
  verbatim if it returns.
- Supabase quietly succeeds for unknown/already-confirmed emails (enumeration
  protection) — the success copy stays generic ("If that account needs
  confirming, an email is on its way").

## Feature B — Account binding

### B1. Schema (one additive, nullable column)

```sql
-- db/migrations/2026-05-22-account-store-link.sql
alter table profiles
  add column if not exists store_id uuid references profiles(id);
comment on column profiles.store_id is
  'For role=family: the store this family shops at. Null = global/single-store.';
```

- Additive + nullable → backward-compatible with the otherwise-locked schema
  (authorized by product lead). `sponsor_ofw_id` already exists for OFW↔family.
- Applied via Supabase MCP `apply_migration` against project `xeaqcbskmzjkjrrlndan`,
  and committed as the migration file so `db/` stays the source of truth.
- RLS: `store_id` is covered by existing per-row `profiles` read policies (a user
  reads their own row). No new policy needed for the column itself; the binding
  writes go through service-role server actions.

### B2. Binding logic — `lib/account/binding.ts`

Server-only module (uses `getSupabaseAdmin()` / service-role). Three functions,
each takes the acting user's id + a target email, looks up the target by email
via `auth.users` → `profiles`, validates role, and writes the link:

| Function | Acting role | Target | Effect | Guards |
|----------|-------------|--------|--------|--------|
| `bindFamilyToOfw(ofwId, familyEmail)` | ofw | family | `family.sponsor_ofw_id = ofwId` | target exists; role=family; family not already sponsored by a *different* OFW |
| `bindSponsorOfw(familyId, ofwEmail)` | family | ofw | `family.sponsor_ofw_id = ofwId` | target exists; role=ofw |
| `bindStore(familyId, storeEmail)` | family | store | `family.store_id = storeId` | target exists; role=store |

Each returns a discriminated result `{ ok: true, linked: {...} } | { ok: false, reason }`
with stable `reason` codes: `not_found`, `wrong_role`, `already_bound`,
`self_link` (can't bind to yourself), `db_error`. Email lookup is
case-insensitive and trimmed.

### B3. Server actions

In a new `app/(app)/account/binding-actions.ts` (server actions, `"use server"`):
- `bindFamilyAction(prev, formData)` — OFW binds a family email.
- `bindSponsorAction(prev, formData)` — family binds an OFW email.
- `bindStoreAction(prev, formData)` — family binds a store email.

Each: resolves the caller from the cookie session, confirms the caller's role
matches, calls the matching `lib/account/binding.ts` function, then
`revalidatePath()` the dashboard. Returns inline `{ error }` on failure.

### B4. UI

- **`AccountBindingForm`** (client component, one shared core; web + mobile
  styling wrappers): an email input + submit, parameterized by which action +
  label ("Connect the family you support" / "Connect your OFW" / "Connect your
  store"). Inline error/success.
- **Dashboard banner** (`BindingBanner`): shown only while the relevant link is
  missing.
  - OFW dashboard (web `app/(app)/ofw` + mobile): banner when no sponsored
    family → `bindFamilyAction`.
  - Family dashboard (web `app/(app)/family` + mobile): banner(s) when
    `sponsor_ofw_id` is null (→ `bindSponsorAction`) and/or `store_id` is null
    (→ `bindStoreAction`).
  - Store dashboard: no outbound binding — a passive note showing the store's
    own email for families to use. (No form.)
  Banner disappears once the link exists.
- **Settings entry** (web `app/settings` + mobile `app/mobile/settings`): a
  "Connections" page to view current bindings (sponsor OFW / store / sponsored
  family display names) and change them via the same `AccountBindingForm`.

### B5. Store scoping (the family↔store effect)

When `family.store_id` is set, scope inventory to that store; when null, keep the
current global behavior.
- `lib/dashboard/family.ts` (`loadFamilyDashboard`) and `lib/dashboard/ofw.ts`
  (`loadOfwDashboard`): add `.eq("store_id", family.store_id)` to the inventory
  query iff `store_id` is set. Both already load the family row — extend the
  select with `store_id`.
- The Shop UIs (`MobileShop`, `WishlistBuilder`) receive inventory from those
  loaders, so no component change beyond what the loaders pass.
- Escrow lock route unchanged — it derives the store from `wishlist_item →
  inventory.store_id`, which now naturally matches the bound store.

## Data flow

1. New OFW logs in → OFW page resolves `sponsor_ofw_id` link → none → banner.
2. OFW enters family email → `bindFamilyAction` → `bindFamilyToOfw` sets
   `family.sponsor_ofw_id` → revalidate → dashboard now loads that family's
   wishlists/bills/activity.
3. Family enters store email → `bindStore` sets `family.store_id` → Shop now
   shows that store's inventory.

## Error handling

- All target lookups are service-role; failures map to the stable `reason` codes
  rendered inline. No stack traces leak (consistent with existing API envelope
  posture).
- Already-bound family (different OFW) → `already_bound`, with copy telling the
  user to ask that family to unlink first (no silent takeover).
- Resend: pass through Supabase's message; never reveal whether the email exists.

## Testing

- `lib/account/binding.ts`: a `scripts/_test-binding.ts` wiring test asserting
  each function returns the right `reason` for not_found / wrong_role /
  already_bound / self_link, mirroring `_test-escrow-wiring.ts` (no live writes —
  use a stub admin client or guard with env like the other probes).
- Manual: register a fresh OFW + family + store, bind by email, confirm the OFW
  dashboard populates and the Shop scopes to the bound store.
- `npm run build` + `tsc --noEmit` clean.

## Files

New:
- `db/migrations/2026-05-22-account-store-link.sql`
- `lib/account/binding.ts`
- `app/(app)/account/binding-actions.ts`
- `components/.../AccountBindingForm.tsx` (+ mobile variant if styling diverges)
- `BindingBanner` component(s)
- settings "Connections" pages (web + mobile)
- `scripts/_test-binding.ts`

Changed:
- `app/auth/actions.ts` (+ `resendConfirmationAction`)
- `app/(auth)/login/page.tsx`, `app/mobile/login/page.tsx` (resend control)
- `lib/dashboard/family.ts`, `lib/dashboard/ofw.ts` (store scoping + select `store_id`)
- OFW/family dashboards (web + mobile) — render `BindingBanner`
- settings hubs (web + mobile) — link the Connections page
