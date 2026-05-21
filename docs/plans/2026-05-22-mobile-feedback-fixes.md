# Mobile Feedback Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 4 user-feedback features layered on top of the mobile parity work — OFW bills history section, OFW Orders action buttons (Lock + Confirm), family Home cleanup, and family Add Bill form.

**Architecture:** All four features layer over existing endpoints (`/api/escrow/lock`, `/api/escrow/release`, `/api/bills/add`) and existing data loaders. One new client component (`MobileAddBillForm`), three edits to existing files (`MobileDashboardClient`, `MobileBills`, `MobileWishlists`). No new server actions, API routes, or dependencies.

**Tech Stack:** Next.js 14 App Router (TypeScript), React 18.3, `lucide-react` icons, existing `apiPost` helper.

**Spec reference:** [docs/specs/2026-05-22-mobile-feedback-fixes-design.md](../specs/2026-05-22-mobile-feedback-fixes-design.md)

---

## Working Directory Convention

All commands run from the repo root `c:\Users\user\Downloads\InternStellar-Hackathon`.

---

## Pre-flight State Confirmation

- [ ] **Verify clean tree on main**

Run: `git status --short && git branch --show-current`

Expected:
```
 M .claude/settings.local.json
?? docs/plans/2026-05-22-mobile-feedback-fixes.md
?? docs/specs/2026-05-22-mobile-feedback-fixes-design.md
main
```

`.claude/settings.local.json` is permission-grant noise from this session — ignore.

- [ ] **Create feature branch**

Run: `git checkout -b feat/mobile-feedback-fixes`

Expected: `Switched to a new branch 'feat/mobile-feedback-fixes'`.

- [ ] **Commit baseline docs**

Run:
```
git add docs/specs/2026-05-22-mobile-feedback-fixes-design.md docs/plans/2026-05-22-mobile-feedback-fixes.md
git commit -m "$(cat <<'EOF'
docs(mobile): add user-feedback fixes spec and implementation plan

Spec: 4 feature requests layered over mobile parity work.
Plan: 5 tasks across 1 new file + 3 edits, ~250 net lines.

Spec: docs/specs/2026-05-22-mobile-feedback-fixes-design.md
Plan: docs/plans/2026-05-22-mobile-feedback-fixes.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 1: Hide "Go to Send Funds" CTA for family (Feature 7)

**Files:**
- Modify: `app/mobile/MobileDashboardClient.tsx`

Smallest change. Role-gate the Send Funds CTA card on the Home tab so
only OFW users see it. Family taps the existing tab bar's Shop tab
instead.

- [ ] **Step 1.1: Wrap the CTA in a role guard**

Find this block in `app/mobile/MobileDashboardClient.tsx` (around line
121-142):

```tsx
            {/* Send Funds CTA (Figma matching) */}
            <div className="p-6 bg-gradient-to-br from-[#5b7cff] to-[#7c9aff] shadow-xl shadow-[#5b7cff]/20 rounded-3xl text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
              <div className="flex items-start gap-3 mb-5 relative z-10">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-inner">
                  <TrendingUp className="w-6 h-6 text-white" strokeWidth={2.5} />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-1.5">Send funds</h3>
                  <p className="text-white/80 text-sm leading-relaxed">
                    Deposit into three on-chain buckets for specific needs.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setActiveTab("send")}
                className="w-full mt-2 bg-white text-[#5b7cff] font-bold py-3.5 rounded-2xl hover:bg-white/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg relative z-10"
              >
                Go to Send Funds
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
```

Wrap it in a `currentUserRole === "ofw"` guard:

```tsx
            {/* Send Funds CTA — OFW only (family has Shop, not Send) */}
            {currentUserRole === "ofw" && (
              <div className="p-6 bg-gradient-to-br from-[#5b7cff] to-[#7c9aff] shadow-xl shadow-[#5b7cff]/20 rounded-3xl text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
                <div className="flex items-start gap-3 mb-5 relative z-10">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-inner">
                    <TrendingUp className="w-6 h-6 text-white" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-1.5">Send funds</h3>
                    <p className="text-white/80 text-sm leading-relaxed">
                      Deposit into three on-chain buckets for specific needs.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab("send")}
                  className="w-full mt-2 bg-white text-[#5b7cff] font-bold py-3.5 rounded-2xl hover:bg-white/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg relative z-10"
                >
                  Go to Send Funds
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
```

- [ ] **Step 1.2: Smoke test**

Run (background): `npm run dev`. Wait ~7 seconds.

Run:
```
curl -s -A "Mozilla/5.0 (iPhone) Mobile" -o /dev/null -w "ofw=%{http_code}\n" http://localhost:3000/mobile/ofw
curl -s -A "Mozilla/5.0 (iPhone) Mobile" -o /dev/null -w "family=%{http_code}\n" http://localhost:3000/mobile/family
```

Expected: both 307. Read the dev log for compile errors.

Stop dev (PowerShell):
`Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`

- [ ] **Step 1.3: Commit**

Run:
```
git add app/mobile/MobileDashboardClient.tsx
git commit -m "$(cat <<'EOF'
fix(mobile): hide Send Funds CTA from family Home

Family's mobile tab bar swaps Send for Shop (Phase 3), so the
"Go to Send Funds" CTA on the Home tab leads to a dead end --
tapping it switched activeTab to "send" which then rendered
"Send Funds requires an OFW account."

Wrap the CTA in a currentUserRole === "ofw" guard so it only
renders for OFW users. Family Home now ends at the spending
breakdown + funding chart, without the broken CTA.

Spec: docs/specs/2026-05-22-mobile-feedback-fixes-design.md section 5

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add OFW Lock + Confirm Delivery buttons (Feature 6)

**Files:**
- Modify: `app/mobile/components/MobileWishlists.tsx`

Adds `lockFunds` handler and renders status-appropriate action
buttons when `viewerRole === "ofw"`.

- [ ] **Step 2.1: Add the lockFunds handler**

In `app/mobile/components/MobileWishlists.tsx`, find the existing
`confirmDelivery` function (around line 29-45):

```tsx
  async function confirmDelivery(wishlistId: string) {
    setError(null);
    setSubmittingId(wishlistId);
    try {
      const result = await apiPost<any>("/api/escrow/release", {
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

Directly **after** that function, add a new `lockFunds` handler:

```tsx
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

- [ ] **Step 2.2: Render the OFW action buttons**

Find the in-flight row block. Current state has only the family
confirm-delivery button:

```tsx
              {!isOfw && w.status === "delivered" && (
                <button
                  onClick={() => confirmDelivery(w.id)}
                  disabled={submittingId === w.id}
                  className="w-full bg-[#10b981] text-white py-3 rounded-2xl font-bold flex justify-center items-center gap-2 shadow-lg shadow-[#10b981]/25 active:scale-[0.98] transition-all"
                >
                  {submittingId === w.id ? "Confirming..." : "Confirm Delivery"}
                  {submittingId !== w.id && <CheckCircle className="w-4 h-4" />}
                </button>
              )}
```

Replace the entire `{!isOfw && w.status === "delivered" && (...)}`
block with role-aware action rendering:

```tsx
              {!isOfw && w.status === "delivered" && (
                <button
                  onClick={() => confirmDelivery(w.id)}
                  disabled={submittingId === w.id}
                  className="w-full bg-[#10b981] text-white py-3 rounded-2xl font-bold flex justify-center items-center gap-2 shadow-lg shadow-[#10b981]/25 active:scale-[0.98] transition-all"
                >
                  {submittingId === w.id ? "Confirming..." : "Confirm Delivery"}
                  {submittingId !== w.id && <CheckCircle className="w-4 h-4" />}
                </button>
              )}

              {isOfw && w.status === "pending_approval" && (
                <button
                  onClick={() => lockFunds(w.id)}
                  disabled={submittingId === w.id}
                  className="w-full bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] text-white py-3 rounded-2xl font-bold flex justify-center items-center gap-2 shadow-lg shadow-[#5b7cff]/25 active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  {submittingId === w.id ? "Locking..." : "Lock funds"}
                  {submittingId !== w.id && <Lock className="w-4 h-4" />}
                </button>
              )}

              {isOfw && (w.status === "locked" || w.status === "delivered") && (
                <button
                  onClick={() => confirmDelivery(w.id)}
                  disabled={submittingId === w.id}
                  className="w-full bg-[#10b981] text-white py-3 rounded-2xl font-bold flex justify-center items-center gap-2 shadow-lg shadow-[#10b981]/25 active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  {submittingId === w.id ? "Confirming..." : "Confirm Delivery"}
                  {submittingId !== w.id && <CheckCircle className="w-4 h-4" />}
                </button>
              )}
```

- [ ] **Step 2.3: Import the Lock icon**

The new `Lock` icon needs to be imported. Find the import line near
the top:

```tsx
import { Package, CheckCircle, Clock } from "lucide-react";
```

Replace with:

```tsx
import { Package, CheckCircle, Clock, Lock } from "lucide-react";
```

- [ ] **Step 2.4: Smoke test**

Run (background): `npm run dev`. Wait ~8 seconds.

Run:
```
curl -s -A "Mozilla/5.0 (iPhone) Mobile" -o /dev/null -w "ofw=%{http_code}\n" http://localhost:3000/mobile/ofw
curl -s -A "Mozilla/5.0 (iPhone) Mobile" -o /dev/null -w "family=%{http_code}\n" http://localhost:3000/mobile/family
```

Expected: both 307. No errors in dev log mentioning `lockFunds` or
`Lock`.

Stop dev (PowerShell):
`Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`

- [ ] **Step 2.5: Commit**

Run:
```
git add app/mobile/components/MobileWishlists.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): add OFW Lock + Confirm Delivery actions on Orders tab

Phase 2 deliberately scoped the OFW Orders tab as read-only. User
feedback: OFWs need to take actions from their dashboard. Add two
status-appropriate buttons when viewerRole === "ofw":

  pending_approval -> "Lock funds"  (POST /api/escrow/lock)
  locked|delivered -> "Confirm delivery"  (POST /api/escrow/release)
  released         -> no action (read-only)

Both use the existing escrow endpoints -- same routes family Shop
and Orders already call. No new server actions or API routes.

Item-level editing (add/remove items from draft wishlists) stays
out of scope -- family's Shop is the canonical item editor.

Spec: docs/specs/2026-05-22-mobile-feedback-fixes-design.md section 8

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: New `MobileAddBillForm` component (Feature 8 part 1)

**Files:**
- Create: `app/mobile/components/MobileAddBillForm.tsx`

Mobile-styled twin of web `AddBillForm`. Posts to existing
`/api/bills/add` route.

- [ ] **Step 3.1: Create the component**

Create `app/mobile/components/MobileAddBillForm.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowRight, CheckCircle } from "lucide-react";

import { apiPost } from "@/lib/api/client";

/**
 * Mobile twin of app/(app)/family/AddBillForm.tsx. Family-only form
 * for adding a household bill (Meralco / Maynilad / …). Posts to the
 * existing /api/bills/add route — no new server logic.
 *
 * Amount entry is in XLM; converted to stroops at the wire boundary.
 * Bigint validation logic mirrors the web's xlmToStroops.
 */

const STROOPS_PER_XLM = 10_000_000n;

/** "12.5" → 125_000_000n. Returns null on invalid input. */
function xlmToStroops(xlm: string): bigint | null {
  const trimmed = xlm.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > 7) return null;
  const fracPadded = frac.padEnd(7, "0");
  try {
    return BigInt(whole) * STROOPS_PER_XLM + BigInt(fracPadded);
  } catch {
    return null;
  }
}

/** Default the date picker to a week out — most household bills are mid-month. */
function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export interface BillerChoice {
  id: string;
  name: string;
  category: string;
}

type Props = {
  familyId: string;
  billers: BillerChoice[];
  onAdded: () => void;
};

export function MobileAddBillForm({ familyId, billers, onAdded }: Props) {
  const router = useRouter();
  const [billerId, setBillerId] = useState<string>(billers[0]?.id ?? "");
  const [accountNumber, setAccountNumber] = useState("");
  const [amountXlm, setAmountXlm] = useState("");
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successName, setSuccessName] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const stroops = useMemo(() => xlmToStroops(amountXlm), [amountXlm]);
  const billerOk = billerId !== "";
  const accountOk = accountNumber.trim().length > 0;
  const amountOk = stroops !== null && stroops > 0n;
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(dueDate);
  const canSubmit = billerOk && accountOk && amountOk && dateOk && !submitting;

  async function submit() {
    if (!canSubmit || stroops === null) return;
    setError(null);
    setSuccessName(null);
    setSubmitting(true);
    try {
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
      if (!result.ok) {
        setError(result.message ?? "Could not add this bill.");
        return;
      }
      setSuccessName(result.data.biller_name);
      // Reset volatile fields; keep biller selection sticky.
      setAccountNumber("");
      setAmountXlm("");
      setDueDate(defaultDueDate());
      startTransition(() => router.refresh());
      // Brief delay so the user sees the success banner before the
      // parent collapses the form.
      window.setTimeout(onAdded, 1200);
    } finally {
      setSubmitting(false);
    }
  }

  if (billers.length === 0) {
    return (
      <div className="p-4 bg-[#f5f7fa] rounded-3xl">
        <p className="text-xs text-[#6b7280] text-center">
          No billers configured. Run{" "}
          <span className="font-mono text-[#1a1d2e]">npm run setup-billers</span>{" "}
          to seed them.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="p-4 bg-[#f5f7fa] rounded-3xl space-y-4"
    >
      <div>
        <label
          htmlFor="add-bill-biller"
          className="block text-[10px] uppercase tracking-widest text-[#6b7280] font-bold mb-1"
        >
          Biller
        </label>
        <select
          id="add-bill-biller"
          value={billerId}
          onChange={(e) => setBillerId(e.target.value)}
          className="w-full bg-white border-0 rounded-2xl h-11 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-[#5b7cff]/40"
        >
          {billers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} · {b.category}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="add-bill-account"
          className="block text-[10px] uppercase tracking-widest text-[#6b7280] font-bold mb-1"
        >
          Account number
        </label>
        <input
          id="add-bill-account"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          placeholder="e.g. 1234-5678"
          autoComplete="off"
          required
          className="w-full bg-white border-0 rounded-2xl h-11 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-[#5b7cff]/40"
        />
      </div>

      <div>
        <label
          htmlFor="add-bill-amount"
          className="block text-[10px] uppercase tracking-widest text-[#6b7280] font-bold mb-1"
        >
          Amount (XLM)
        </label>
        <input
          id="add-bill-amount"
          value={amountXlm}
          onChange={(e) => setAmountXlm(e.target.value)}
          placeholder="e.g. 30"
          inputMode="decimal"
          required
          className="w-full bg-white border-0 rounded-2xl h-11 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-[#5b7cff]/40"
        />
        <p className="text-[10px] text-[#9ca3af] mt-1.5 px-1">
          {amountXlm && !amountOk
            ? "Enter a positive amount with up to 7 decimal places."
            : amountOk
              ? `${stroops!.toString()} stroops`
              : "1 XLM = 10,000,000 stroops"}
        </p>
      </div>

      <div>
        <label
          htmlFor="add-bill-due"
          className="block text-[10px] uppercase tracking-widest text-[#6b7280] font-bold mb-1"
        >
          Due date
        </label>
        <input
          id="add-bill-due"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          required
          className="w-full bg-white border-0 rounded-2xl h-11 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-[#5b7cff]/40"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-600 text-xs rounded-2xl border border-red-100">
          {error}
        </div>
      )}

      {successName && (
        <div className="p-3 bg-emerald-50 text-emerald-700 text-xs rounded-2xl border border-emerald-100 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          Added a {successName} bill.
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] text-white rounded-full py-3 text-sm font-semibold shadow-lg shadow-[#5b7cff]/25 active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {submitting ? "Adding…" : "Add bill"}
        {!submitting && <ArrowRight className="w-4 h-4" />}
      </button>
    </form>
  );
}
```

- [ ] **Step 3.2: Verify it parses**

Run (background): `npm run dev`. Wait ~7 seconds.

Read the dev log — confirm no errors mentioning `MobileAddBillForm`,
`BillerChoice`, or `xlmToStroops`. (No route renders it yet — only
typecheck-imported.)

Stop dev (PowerShell):
`Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`

- [ ] **Step 3.3: Commit**

Run:
```
git add app/mobile/components/MobileAddBillForm.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): add MobileAddBillForm -- inline family Add Bill

Mobile twin of web AddBillForm. Family-only form posting to
existing /api/bills/add. Biller dropdown (from familyData.billers
which the loader already populates), account number, amount XLM
(with bigint conversion + 7-decimal cap), due date (defaults to
+7 days).

On success: brief banner, reset volatile fields (keeps biller
selection sticky), router.refresh(), then onAdded() callback so
parent can collapse the form.

Wired into MobileBills in the next commit.

Spec: docs/specs/2026-05-22-mobile-feedback-fixes-design.md section 7

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `MobileBills` — role prop + Recent payments + AddBill mount (Features 5 + 8 wire)

**Files:**
- Modify: `app/mobile/components/MobileBills.tsx`
- Modify: `app/mobile/MobileDashboardClient.tsx`

Adds the `role` + `billers` props to `MobileBills`, splits the bill
list into "Due / Overdue" + "Recent payments" sections, and mounts
the collapsible Add Bill form (family only). Then updates
`MobileDashboardClient` to pass the new props.

- [ ] **Step 4.1: Add new props to MobileBills**

In `app/mobile/components/MobileBills.tsx`, find the props type
(around line 9):

```tsx
type MobileBillsProps = {
  ofwId: string;
  familyId?: string;
  bills: any[];
};
```

Replace with:

```tsx
type MobileBillsProps = {
  ofwId: string;
  familyId?: string;
  bills: any[];
  role: "ofw" | "family";
  billers: { id: string; name: string; category: string }[];
};
```

Then update the function signature (around line 15):

```tsx
export function MobileBills({ ofwId, bills }: MobileBillsProps) {
```

Replace with:

```tsx
export function MobileBills({
  ofwId,
  familyId,
  bills,
  role,
  billers,
}: MobileBillsProps) {
  const [addOpen, setAddOpen] = useState(false);
```

- [ ] **Step 4.2: Update imports**

Find:

```tsx
import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, CreditCard, AlertCircle } from "lucide-react";
import { apiPost } from "@/lib/api/client";
import { formatXlmWithUnit, formatXlm } from "@/lib/format-xlm";
```

Replace with:

```tsx
import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, ChevronDown, CreditCard, AlertCircle, Plus } from "lucide-react";
import { apiPost } from "@/lib/api/client";
import { formatXlmWithUnit, formatXlm } from "@/lib/format-xlm";
import { timeAgo } from "@/lib/time-ago";

import { MobileAddBillForm } from "./MobileAddBillForm";
```

- [ ] **Step 4.3: Split paid bills into a separate list**

Find the current single-list rendering. Currently `effective` is
all bills mixed; the body renders every bill in one `<div>`. Find
this block (around line 71-107):

```tsx
      <div className="space-y-3">
        {effective.map(b => (
          <div key={b.id} className="p-5 bg-white border border-black/5 shadow-sm rounded-3xl flex items-center gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              b.effective_status === "paid" ? "bg-[#10b981]/10 text-[#10b981]" : 
              b.effective_status === "overdue" ? "bg-[#ef4444]/10 text-[#ef4444]" : 
              "bg-[#5b7cff]/10 text-[#5b7cff]"
            }`}>
              {b.effective_status === "paid" ? <CheckCircle className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm truncate">{b.biller_name || b.biller?.name}</h4>
              <p className="text-[11px] text-[#6b7280] font-mono mt-0.5">{b.account_number}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-bold text-[13px]">{formatXlmWithUnit(BigInt(b.amount_stroops))}</span>
                <span className="text-[10px] text-[#9ca3af]">•</span>
                <span className={`text-[11px] font-medium ${
                  b.effective_status === "overdue" ? "text-[#ef4444]" : "text-[#9ca3af]"
                }`}>
                  {b.effective_status === "paid" ? "Paid" : b.effective_status === "overdue" ? "Overdue" : "Due"}
                </span>
              </div>
            </div>

            {b.effective_status !== "paid" && (
              <button
                onClick={() => handlePayOne(b.id)}
                disabled={busyId === b.id}
                className="shrink-0 bg-[#5b7cff]/10 text-[#5b7cff] hover:bg-[#5b7cff]/20 px-4 py-2 rounded-xl text-xs font-bold transition-colors"
              >
                {busyId === b.id ? "..." : "Pay"}
              </button>
            )}
          </div>
        ))}

        {bills.length === 0 && (
          <div className="p-8 text-center bg-white border border-black/5 rounded-3xl">
            <p className="text-sm text-[#6b7280]">No bills configured.</p>
          </div>
        )}
      </div>
```

Replace it with the split-into-two-sections version:

```tsx
      {unpaid.length > 0 && (
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#6b7280] ml-2 mb-2">
            Due / Overdue ({unpaid.length})
          </h3>
          <div className="space-y-3">
            {effective
              .filter((b) => b.effective_status !== "paid")
              .map((b) => (
                <div
                  key={b.id}
                  className="p-5 bg-white border border-black/5 shadow-sm rounded-3xl flex items-center gap-4"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      b.effective_status === "overdue"
                        ? "bg-[#ef4444]/10 text-[#ef4444]"
                        : "bg-[#5b7cff]/10 text-[#5b7cff]"
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm truncate">
                      {b.biller_name || b.biller?.name}
                    </h4>
                    <p className="text-[11px] text-[#6b7280] font-mono mt-0.5">
                      {b.account_number}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-bold text-[13px]">
                        {formatXlmWithUnit(BigInt(b.amount_stroops))}
                      </span>
                      <span className="text-[10px] text-[#9ca3af]">•</span>
                      <span
                        className={`text-[11px] font-medium ${
                          b.effective_status === "overdue"
                            ? "text-[#ef4444]"
                            : "text-[#9ca3af]"
                        }`}
                      >
                        {b.effective_status === "overdue" ? "Overdue" : "Due"}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handlePayOne(b.id)}
                    disabled={busyId === b.id}
                    className="shrink-0 bg-[#5b7cff]/10 text-[#5b7cff] hover:bg-[#5b7cff]/20 px-4 py-2 rounded-xl text-xs font-bold transition-colors"
                  >
                    {busyId === b.id ? "..." : "Pay"}
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {effective.filter((b) => b.effective_status === "paid").length > 0 && (
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#6b7280] ml-2 mb-2">
            Recent payments
          </h3>
          <div className="space-y-3">
            {effective
              .filter((b) => b.effective_status === "paid")
              .slice(0, 10)
              .map((b) => {
                const paidTs = b.paid_at || b.updated_at;
                return (
                  <div
                    key={b.id}
                    className="p-4 bg-white border border-black/5 shadow-sm rounded-3xl flex items-center gap-3 opacity-90"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#10b981]/10 text-[#10b981] flex items-center justify-center shrink-0">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-xs truncate">
                        {b.biller_name || b.biller?.name}
                      </h4>
                      <p className="text-[10px] text-[#9ca3af] font-mono">
                        {b.account_number}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-bold text-[11px]">
                          {formatXlmWithUnit(BigInt(b.amount_stroops))}
                        </span>
                        {paidTs && (
                          <>
                            <span className="text-[9px] text-[#9ca3af]">•</span>
                            <span className="text-[10px] text-[#9ca3af]">
                              {timeAgo(paidTs)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            {effective.filter((b) => b.effective_status === "paid").length >
              10 && (
              <p className="text-[10px] text-center text-[#9ca3af] mt-2">
                +{" "}
                {effective.filter((b) => b.effective_status === "paid").length -
                  10}{" "}
                older payments
              </p>
            )}
          </div>
        </div>
      )}

      {bills.length === 0 && (
        <div className="p-8 text-center bg-white border border-black/5 rounded-3xl">
          <p className="text-sm text-[#6b7280]">No bills configured.</p>
        </div>
      )}
```

- [ ] **Step 4.4: Mount the collapsible Add Bill section**

Find the start of the rendered JSX. Currently the component returns:

```tsx
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold mb-2">Bills</h2>
        <p className="text-sm text-[#6b7280] leading-relaxed">
          Pay family utilities straight from your wallet on the Stellar testnet.
        </p>
      </div>

      {unpaid.length > 0 && (
        <div className="p-6 bg-[#1a1d2e] rounded-3xl text-white shadow-xl">
```

Insert the Add Bill collapsible card **between** the header and the
Total Due card. Find the line `</div>` right before
`{unpaid.length > 0 && (`, and insert this block immediately after
it:

```tsx
      {role === "family" && familyId && (
        <div className="bg-white border border-black/5 shadow-sm rounded-3xl overflow-hidden">
          <button
            type="button"
            onClick={() => setAddOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-3 p-4 text-left"
            aria-expanded={addOpen}
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-[#1a1d2e]">
              <Plus className="w-4 h-4 text-[#5b7cff]" />
              Add Bill
            </span>
            <ChevronDown
              className={
                addOpen
                  ? "w-4 h-4 text-[#9ca3af] rotate-180 transition-transform"
                  : "w-4 h-4 text-[#9ca3af] transition-transform"
              }
            />
          </button>
          {addOpen && (
            <div className="px-4 pb-4">
              <MobileAddBillForm
                familyId={familyId}
                billers={billers}
                onAdded={() => setAddOpen(false)}
              />
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 4.5: Update `MobileDashboardClient` to pass the new props**

In `app/mobile/MobileDashboardClient.tsx`, find the `bills` tab body:

```tsx
        {activeTab === "bills" && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <MobileBills 
              ofwId={ofwData?.ofw.id || currentUserId}
              familyId={familyData?.family.id}
              bills={ofwData?.bills || familyData?.bills || []} 
            />
          </div>
        )}
```

Replace with:

```tsx
        {activeTab === "bills" && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <MobileBills
              ofwId={ofwData?.ofw.id || currentUserId}
              familyId={familyData?.family.id}
              bills={ofwData?.bills || familyData?.bills || []}
              role={currentUserRole}
              billers={familyData?.billers ?? []}
            />
          </div>
        )}
```

- [ ] **Step 4.6: Smoke test**

Run (background): `npm run dev`. Wait ~8 seconds.

Run:
```
curl -s -A "Mozilla/5.0 (iPhone) Mobile" -o /dev/null -w "ofw=%{http_code}\n" http://localhost:3000/mobile/ofw
curl -s -A "Mozilla/5.0 (iPhone) Mobile" -o /dev/null -w "family=%{http_code}\n" http://localhost:3000/mobile/family
curl -s -A "Mozilla/5.0 (Windows NT 10.0) Chrome/120" -o /dev/null -w "web-ofw=%{http_code}\n" http://localhost:3000/ofw
```

Expected: all 307. Read the dev log for compile errors — expect no
errors mentioning `MobileBills`, `MobileAddBillForm`, or the new
props.

Stop dev (PowerShell):
`Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`

- [ ] **Step 4.7: Commit**

Run:
```
git add app/mobile/components/MobileBills.tsx app/mobile/MobileDashboardClient.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): MobileBills -- role-aware Add Bill + Recent payments section

Two changes to the shared Bills tab:

1. Splits the previous mixed list into two sections:
   - "Due / Overdue (N)" -- unpaid bills with the Pay button
   - "Recent payments"   -- paid bills (capped at 10 visible, with
     a muted "+ N older payments" line for overflow), with timeAgo
     timestamps fallback (paid_at -> updated_at)

2. Adds a collapsible "+ Add Bill" card at the top of the tab for
   family role only. Tapping expands an inline MobileAddBillForm.
   OFW users don't see this section.

MobileDashboardClient passes the new `role` and `billers` props
through from familyData.

Spec: docs/specs/2026-05-22-mobile-feedback-fixes-design.md sections 5, 6

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: End-to-end smoke test

No code changes. Walks the spec §11 checklist.

- [ ] **Step 5.1: Start dev**

Run (background): `npm run dev`. Wait ~7 seconds.

- [ ] **Step 5.2: All mobile dashboards + web routes compile**

Run:
```
curl -s -A "Mozilla/5.0 (iPhone) Mobile" -o /dev/null -w "mobile-ofw=%{http_code}\n" http://localhost:3000/mobile/ofw
curl -s -A "Mozilla/5.0 (iPhone) Mobile" -o /dev/null -w "mobile-family=%{http_code}\n" http://localhost:3000/mobile/family
curl -s -A "Mozilla/5.0 (iPhone) Mobile" -o /dev/null -w "mobile-store=%{http_code}\n" http://localhost:3000/mobile/store
curl -s -A "Mozilla/5.0 (Windows NT 10.0) Chrome/120" -o /dev/null -w "web-ofw=%{http_code}\n" http://localhost:3000/ofw
curl -s -A "Mozilla/5.0 (Windows NT 10.0) Chrome/120" -o /dev/null -w "web-family=%{http_code}\n" http://localhost:3000/family
```

Expected: all 307.

- [ ] **Step 5.3: Dev log clean**

Read the dev log. Confirm no errors mentioning any of the touched
files.

- [ ] **Step 5.4: Existing tests still pass**

Run: `npm run test:device`

Expected: `9 passed, 0 failed`.

- [ ] **Step 5.5: Stop dev**

Run (PowerShell):
`Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`

- [ ] **Step 5.6: Manual browser walk-through (required)**

Open Chrome → DevTools → Toggle device toolbar → iPhone 14 Pro →
hard refresh `http://localhost:3000/`. Walk the spec §11 checklist:

1. **Sign in as Auntie Maria (OFW).** Land on `/mobile/ofw`.
2. Tap **Orders** tab. Find a `pending_approval` wishlist — confirm
   the **Lock funds** button is visible. Tap it. Confirm status
   flips to `locked`.
3. Find a `locked` or `delivered` wishlist — confirm **Confirm
   delivery** button is visible. Tap it. Confirm status flips to
   `released`.
4. Tap **Home** tab as OFW. Confirm the "Go to Send Funds" CTA card
   IS visible (OFW gating still shows it).
5. Tap **Bills** tab as OFW. Confirm:
   - **No** "+ Add Bill" section (family-only).
   - Total Due card with Pay All Due button.
   - "Due / Overdue (N)" section.
   - "Recent payments" section if any paid bills exist, with
     timeAgo timestamps.
6. Sign out → sign in as **Lola Cora (family)**. Land on
   `/mobile/family`.
7. Tap **Home** tab. Confirm "Go to Send Funds" CTA card is
   **hidden**.
8. Tap **Bills** tab. Confirm:
   - "+ Add Bill" collapsible card at the top. Tap → expands.
   - Fill in: pick a biller, account number, amount (e.g. `50`),
     accept default due date. Tap **Add bill** → success banner →
     form collapses after a beat. New bill appears in "Due"
     section.
9. Tap **Orders** tab as family. Confirm the Confirm Delivery
   button still works for delivered wishlists (no Phase 2
   regression).
10. Resize to iPhone SE (375 × 667). Confirm all sections still
    look clean.

If any step fails visually, capture as a follow-up before merging.

---

## Done

All 5 tasks complete. The repo now has:

- "Send Funds" CTA hidden for family on Home (Feature 7).
- OFW Lock + Confirm Delivery action buttons on Orders (Feature 6).
- New MobileAddBillForm component (Feature 8 part 1).
- MobileBills with role-aware Add Bill mount + split Due / Recent
  payments sections (Features 5 + 8 part 2).

Next: invoke `superpowers:finishing-a-development-branch` to verify
tests, choose merge/PR, and clean up.
