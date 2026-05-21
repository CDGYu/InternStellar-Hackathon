# Mobile Feedback Fixes — Design Spec

- **Date:** 2026-05-22
- **Owner:** (frontend, new branch off `main` at execution time)
- **Repo:** `CDGYu/InternStellar-Hackathon`
- **Scope:** Four user-feedback features layered on top of the now-
  complete mobile parity work. None of them require new server
  actions or API routes — all reuse existing endpoints.

## 1. Goal

After this work ships:

1. **OFW Bills history (Feature 5).** The mobile Bills tab visually
   separates **Due / Overdue** (top) from **Recent payments** (bottom)
   so paid bills don't clutter the action list. Same component, same
   data — just a UI split.
2. **OFW Orders actions (Feature 6).** When an OFW views the Orders
   tab, each wishlist row gets a status-appropriate action button:
   - `pending_approval` → **Lock funds** (POSTs `/api/escrow/lock`)
   - `locked` or `delivered` → **Confirm delivery** (POSTs
     `/api/escrow/release`)
   - other statuses → no action (read-only).
   This closes the Phase 2 deferral that scoped OFW Orders as
   read-only. **Item editing (add/remove items from draft) stays
   out of scope** — that overlaps family's Shop.
3. **Family Home cleanup (Feature 7).** The "Go to Send Funds" CTA
   card on the Home tab no longer renders for family users. Family
   doesn't have a Send tab (Phase 3 swapped it for Shop) so the
   CTA currently leads to a confusing "Send Funds requires an OFW
   account" empty state.
4. **Family Add Bill (Feature 8).** A collapsible "+ Add Bill"
   section appears at the top of the family's Bills tab. Expanding
   it reveals a mobile-styled form (biller picker, account number,
   amount XLM, due date). Submit posts to the existing
   `/api/bills/add` route. OFW users don't see this section.

Web routes are unaffected.

## 2. Non-Goals

- ❌ Full item editing for OFW Orders (the web `OfwWishlistRow` has
  an inline editor for draft wishlists; we explicitly skip that —
  family's Shop is the canonical item-editor).
- ❌ Creating a new biller from mobile. Web doesn't allow this
  either; billers come from the admin `npm run setup-billers`
  script.
- ❌ Filtering / searching / sorting the bill list.
- ❌ Sub-tabs within Bills. The history is an inline section, not
  a tab.
- ❌ Multi-bill bulk actions beyond Pay All Due (already shipped in
  the previous bug-fix round).
- ❌ Bill detail page per item.
- ❌ Changing the mobile dashboard's tab structure.

## 3. Constraints

- **No changes to web `app/(app)/family/*` or `app/(app)/ofw/*`.**
- **No new server actions or API routes.** Reuses:
  - `/api/escrow/lock` (OFW Lock funds)
  - `/api/escrow/release` (OFW Confirm delivery — same route family
    uses today via `MobileWishlists`)
  - `/api/bills/add` (family Add Bill)
- **No new dependencies.**
- **Reuse data already on the client.** Both `loadOfwDashboard` and
  `loadFamilyDashboard` already return:
  - `bills: BillRow[]` (with `status`, `paid_at`, `biller`, etc.)
  - `billers: BillerOption[]` (family-only, populated)
  - `wishlists`/`activeWishlists` with all needed status + tx-hash
    fields.
  Nothing to extend in the loaders.
- **Reuse existing client helpers:** `apiPost`,
  `createSupabaseBrowserClient` (already used by `MobileShop` for
  the lock flow), `formatXlm` / `formatXlmWithUnit` /
  `truncateHash`, `timeAgo`.
- **Match existing mobile visuals.** Cards in white with
  `rounded-3xl` + `shadow-sm` over `#f5f7fa`. Gradient
  `#5b7cff → #7c9aff` for primary CTAs. Same pattern Phase 3's
  `MobileShop` and Phase 4's `MobileStoreOrders` already use.

## 4. Architecture

### 4.1 File deltas

```
app/mobile/MobileDashboardClient.tsx              [edit]  hide "Go to Send Funds" CTA for family
app/mobile/components/MobileBills.tsx             [edit]  add role prop, split Due / Recent payments, mount AddBill (family only)
app/mobile/components/MobileAddBillForm.tsx       [NEW]   mobile twin of web AddBillForm
app/mobile/components/MobileWishlists.tsx         [edit]  add Lock + Confirm Delivery action buttons when viewerRole="ofw"
```

4 files. **1 new + 3 edits**, ~250 net lines.

### 4.2 Data flow (no new fetches)

```
loadOfwDashboard() already returns:
  - bills:     BillRow[]  (used by MobileBills)
  - activeWishlists / wishlists with status + tx hashes (used by MobileWishlists)

loadFamilyDashboard() already returns:
  - bills:     BillRow[]  (used by MobileBills)
  - billers:   BillerOption[]  (NEW use — passed to MobileAddBillForm)
  - wishlists with status (used by MobileWishlists)

Server passes these straight through MobileDashboardClient to the
relevant tab body. MobileBills now receives:
  - role:    "ofw" | "family"
  - billers: BillerOption[] | undefined  (only meaningful for family)
```

## 5. `MobileDashboardClient` update — Feature 7

Two changes:

**5a.** The "Send Funds" CTA card (currently
[MobileDashboardClient.tsx:121-142](app/mobile/MobileDashboardClient.tsx#L121-L142))
becomes role-gated:

```tsx
{currentUserRole === "ofw" && (
  <div className="p-6 bg-gradient-to-br from-[#5b7cff] to-[#7c9aff] ...">
    {/* … existing "Go to Send Funds" CTA … */}
  </div>
)}
```

**5b.** Update the `MobileBills` mount in the bills-tab branch to
pass the role + billers prop:

```tsx
<MobileBills
  ofwId={ofwData?.ofw.id || currentUserId}
  familyId={familyData?.family.id}
  bills={ofwData?.bills || familyData?.bills || []}
  role={currentUserRole}
  billers={familyData?.billers ?? []}
/>
```

No other dashboard changes.

## 6. `MobileBills` updates — Features 5 + 8

### 6.1 New props

```ts
type MobileBillsProps = {
  ofwId: string;
  familyId?: string;
  bills: any[];
  role: "ofw" | "family";                    // NEW
  billers: { id: string; name: string; category: string }[];  // NEW
};
```

### 6.2 Layout changes

Top-to-bottom inside the tab body:

1. **Header** — unchanged ("Bills" + subtitle).
2. **+ Add Bill (collapsible)** — only when `role === "family"`. Same
   collapsible card pattern as Phase 4's
   [MobileStoreOrders Create Order header](app/mobile/store/components/MobileStoreOrders.tsx).
   Expanded body renders `<MobileAddBillForm familyId={familyId!}
   billers={billers} onAdded={() => setAddOpen(false)} />`.
3. **Total Due card** (existing, with Pay All Due button — shipped
   in Round 1).
4. **Error banner** (existing).
5. **Due / Overdue** — section header: "Due / Overdue (N)". List of
   bills where `effective_status !== "paid"`. Cards as today.
6. **Recent payments** — NEW section. Section header: "Recent
   payments (N)". List of bills where `status === "paid"`, sorted by
   `paid_at DESC` (or `updated_at DESC` if `paid_at` isn't on the
   row), capped at 10 visible. Each card:
   - Green checkmark icon
   - Biller name (e.g. "Meralco")
   - Account number (mono, muted)
   - Paid amount in XLM
   - `timeAgo(paid_at)` as the secondary line
   - No action button (read-only)
   If `>10` paid bills exist, show a "+ N older payments" muted
   line at the bottom (no expansion in scope; mobile demo accepts
   the cap).
7. **Empty state** — when `bills.length === 0`, current "No bills
   configured." card.

### 6.3 What stays the same

- The existing `handlePayOne` and `handlePayAll` handlers.
- The Total Due math (sum of unpaid `amount_stroops`).
- The status-based styling on each bill card.

## 7. `MobileAddBillForm` (new) — Feature 8

Mobile-styled twin of [`app/(app)/family/AddBillForm.tsx`](app/(app)/family/AddBillForm.tsx).
Reuses its `xlmToStroops` validation logic verbatim.

### 7.1 Props

```ts
type Props = {
  familyId: string;
  billers: { id: string; name: string; category: string }[];
  onAdded: () => void;   // called after a successful submit so the
                         // parent can collapse the form
};
```

### 7.2 Fields

- **Biller** — `<select>` populated from `billers`. Default to the
  first option. Disabled-options if `billers.length === 0` with a
  one-line note: "No billers configured — run setup-billers script."
- **Account number** — `<input>`, required.
- **Amount (XLM)** — `<input inputMode="decimal">`, required.
  Hint shows the stroop conversion live ("125,000,000 stroops" when
  valid) or the conversion rule when invalid/empty.
- **Due date** — `<input type="date">`, defaults to 7 days from
  today (same default as web `defaultDueDate()`).
- **Submit button** — gradient pill: "Add bill" (disabled while
  inputs are invalid or submitting).

### 7.3 Submit flow

```ts
const result = await apiPost<{ biller_name: string }>(
  "/api/bills/add",
  {
    family_id: familyId,
    biller_id: billerId,
    account_number: accountNumber.trim(),
    amount_stroops: stroops.toString(),
    due_date: dueDate,
  },
);
```

On `result.ok`:
- Inline success banner ("Added a Meralco bill." or similar).
- Reset volatile fields (account, amount, date — keep biller
  selection sticky).
- `router.refresh()` to re-render parent with the new bill.
- `setTimeout(onAdded, 1200)` so the user sees the success message
  before the form collapses (same pattern Phase 4's create-order
  uses).

On failure: inline red error.

## 8. `MobileWishlists` updates — Feature 6

### 8.1 Already-present family confirm-delivery

Today, `MobileWishlists` already has a confirm-delivery flow for
family role (Phase 2's `viewerRole` prop hid the button for OFW).
Phase 6 inverts that: OFW gets the same Confirm Delivery button
(same API endpoint), PLUS a Lock Funds button for `pending_approval`
status.

### 8.2 New OFW action buttons

When `viewerRole === "ofw"`:

- **`status === "pending_approval"`** → render **Lock funds** button.
  Calls `apiPost("/api/escrow/lock", { family_id: familyId,
  wishlist_id: w.id })`. On success, status flips to `locked` on
  next router.refresh.
- **`status === "locked"` or `"delivered"`** → render **Confirm
  delivery** button. Calls `apiPost("/api/escrow/release", {
  family_id: familyId, wishlist_id: w.id })`. On success, status
  flips to `released` after refresh.

Both buttons:
- Disabled during in-flight + show "Locking…" / "Confirming…" text.
- Inline error banner above the row on failure.
- After success, `router.refresh()` re-loads the dashboard with
  fresh data.

### 8.3 Refactored handler

The existing `confirmDelivery` handler stays. We add a new
`lockFunds` handler:

```ts
async function lockFunds(wishlistId: string) {
  setError(null);
  setSubmittingId(wishlistId);
  try {
    const result = await apiPost<any>("/api/escrow/lock", {
      family_id: familyId,
      wishlist_id: wishlistId,
    });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    startTransition(() => router.refresh());
  } finally {
    setSubmittingId(null);
  }
}
```

Note: `familyId` is already a prop. For OFW viewer, this is the
sponsored family's id (the dashboard already passes
`familyData.family.id` even when `currentUserRole === "ofw"`).

### 8.4 Released-status hash link

For both viewer roles, when status is `released`, the row already
shows the wishlist's `release_tx_hash` (if present) as a small
muted line. No change.

## 9. Edge cases & error handling

| Case | Behavior |
|---|---|
| Family has no billers configured | Add Bill section shows "No billers configured — run setup-billers script." Disabled select. |
| Family submits Add Bill with stale due date (past today) | Web doesn't gate this. Mobile matches — the API accepts past dates and the bill renders as "overdue" immediately. |
| OFW taps Lock funds on a wishlist that's already locked (race) | `/api/escrow/lock` returns idempotent error or wrong-status error. We surface `result.message`. |
| OFW taps Confirm delivery on a wishlist that's been cancelled | API returns wrong-status; inline error displayed. |
| Bills list has zero paid bills | "Recent payments" section is not rendered (no empty-state in the section — the header itself is the empty signal). |
| Bills list has more than 10 paid bills | Show 10 most recent + a muted "+ N older payments" line. No expansion in scope. |
| Family Add Bill submits valid form but API returns `biller_not_found` | Inline red banner. |
| OFW dashboard `familyData` is null (no sponsored family) | OFW's "Orders" empty-state still shows ("Your sponsored family hasn't been linked yet."). Lock/Confirm buttons are unreachable. |
| `paid_at` column is missing on a paid bill row | Fall back to `updated_at` for the timestamp. |

## 10. Open questions (resolved)

### 10.1 Why no sub-tabs inside Bills?

Considered, decided against. Sub-tabs add nav complexity; an inline
"Recent payments" section keeps the user's mental model linear
("here's what's due, here's what's already paid"). The web doesn't
do sub-tabs either — it has separate page sections.

### 10.2 Why no item editing for OFW Orders?

Family's Shop already provides the canonical item editor. OFW
acting on a family's behalf is a power-user feature; the web has
it but mobile YAGNI says: ship action buttons (high-impact for the
demo), defer the editor (medium-impact, large-effort). If users
want it later, file a follow-up.

### 10.3 Should Pay All Due also live in OFW only?

`MobileBills` is shared between OFW and family today. Family also
needs the Pay All Due button — they're the household actor for
bills in the off-chain mental model. We keep `handlePayAll`
available for both roles (no change to Round 1's fix). What's
role-gated is the **Add Bill** section, not the pay button.

## 11. Manual smoke-test checklist

Chrome DevTools "Toggle device toolbar" + iPhone 14 Pro:

1. Sign in as **Auntie Maria** (OFW). Tap **Orders** tab. Locate a
   wishlist with status `pending_approval` — confirm the
   "Lock funds" button is visible. Tap it → status flips to
   `locked`.
2. Locate a `locked` or `delivered` wishlist as OFW → "Confirm
   delivery" button → status flips to `released`.
3. Tap **Home** tab as OFW. Confirm the "Go to Send Funds" CTA
   card IS visible (this is the role-gated case where it should
   still appear).
4. Tap **Bills** tab as OFW. Confirm:
   - Total Due card on top + Pay All Due works (Round 1 fix).
   - **No** "+ Add Bill" section (OFW-only restriction).
   - "Due / Overdue" section with unpaid bills.
   - "Recent payments" section below with paid bills + timeAgo
     timestamps.
5. Sign out, sign in as **Lola Cora** (family). Tap **Home** tab.
   Confirm the "Go to Send Funds" CTA card is **hidden** (Feature
   7 working).
6. Tap **Bills** tab. Confirm:
   - "+ Add Bill" collapsible card at the top.
   - Tap to expand → form renders (biller select, account, amount,
     date).
   - Fill in valid values → Add bill → success banner → form
     collapses → bill appears in Due section.
7. Tap **Orders** tab as family. Confirm the Confirm Delivery
   button still works for locked/delivered wishlists (no
   regression from Phase 2).
8. Run `npm run test:device`. Expect `9 passed, 0 failed`.

## 12. Cross-references

- Master plan: [docs/specs/2026-05-21-mobile-phase-0-1-design.md](2026-05-21-mobile-phase-0-1-design.md)
- Phase 2 (OFW sub-flows + viewerRole on MobileWishlists): [docs/specs/2026-05-22-mobile-phase-2-design.md](2026-05-22-mobile-phase-2-design.md)
- Phase 3 (family Shop): [docs/specs/2026-05-22-mobile-phase-3-design.md](2026-05-22-mobile-phase-3-design.md)
- Round 1 bug fixes: [commits 9e9731c, 49f8318, 3a52e2f on main]
- Web Add Bill form (logic source): [app/(app)/family/AddBillForm.tsx](../../app/%28app%29/family/AddBillForm.tsx)
- Web OFW row (action buttons reference): [app/(app)/ofw/OfwWishlistRow.tsx](../../app/%28app%29/ofw/OfwWishlistRow.tsx)
- Existing mobile pieces being touched:
  - [app/mobile/MobileDashboardClient.tsx](../../app/mobile/MobileDashboardClient.tsx)
  - [app/mobile/components/MobileBills.tsx](../../app/mobile/components/MobileBills.tsx)
  - [app/mobile/components/MobileWishlists.tsx](../../app/mobile/components/MobileWishlists.tsx)
