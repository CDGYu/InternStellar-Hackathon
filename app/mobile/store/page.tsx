import { redirect } from "next/navigation";

import { loadUserProfile } from "@/lib/auth-role";
import { loadStoreDashboard } from "@/lib/dashboard/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { MobileStoreDashboardClient } from "./MobileStoreDashboardClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Mobile Store dashboard. Mirrors the web /store route. signInAction
 * redirects a store caller to /store on success → middleware rewrites
 * to /mobile/store for mobile UAs, which lands here.
 */
export default async function MobileStorePage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile } = await loadUserProfile(user.id);
  if (profile?.role !== "store") {
    redirect("/");
  }

  const data = await loadStoreDashboard({ storeId: user.id });

  // Stringify bigints at the server→client boundary.
  const serialized = {
    store: data.store,
    totals: {
      pendingCount: data.totals.pendingCount,
      inEscrow: data.totals.inEscrow.toString(),
      revenue: data.totals.revenue.toString(),
      outOfStockCount: data.totals.outOfStockCount,
    },
    orders: data.orders.map((o) => ({
      id: o.id,
      family_id: o.family_id,
      family_name: o.family_name,
      status: o.status,
      total_stroops: o.total_stroops.toString(),
      notes: o.notes,
      escrow_tx_hash: o.escrow_tx_hash,
      release_tx_hash: o.release_tx_hash,
      item_count: o.item_count,
      created_at: o.created_at,
      updated_at: o.updated_at,
    })),
    receipts: data.receipts.map((r) => ({
      order: {
        id: r.order.id,
        family_id: r.order.family_id,
        family_name: r.order.family_name,
        status: r.order.status,
        total_stroops: r.order.total_stroops.toString(),
        notes: r.order.notes,
        escrow_tx_hash: r.order.escrow_tx_hash,
        release_tx_hash: r.order.release_tx_hash,
        item_count: r.order.item_count,
        created_at: r.order.created_at,
        updated_at: r.order.updated_at,
      },
    })),
    inventory: data.inventory.map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      price_stroops: i.price_stroops.toString(),
      stock: i.stock,
      unit: i.unit,
    })),
    activity: data.activity.map((a) => ({
      id: a.id,
      wishlist_id: a.wishlist_id,
      event_type: a.event_type,
      tx_hash: a.tx_hash,
      amount_stroops: a.amount_stroops.toString(),
      created_at: a.created_at,
      wishlist_notes: a.wishlist_notes,
      wishlist_status: a.wishlist_status,
    })),
    families: data.families,
  };

  return <MobileStoreDashboardClient storeData={serialized} />;
}
