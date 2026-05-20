/**
 * scripts/test-realtime.ts  —  Day 2 throwaway realtime check.
 *
 * Verifies that a change to `wishlist` is broadcast to a client using the
 * ANON key (exactly how P3's Store dashboard will subscribe on Day 3).
 *
 * What it does:
 *   1. Subscribes to `wishlist` changes with the ANON key.
 *   2. Inserts a throwaway wishlist row with the SERVICE_ROLE key.
 *   3. Expects the subscription callback to fire within 10s.
 *   4. Deletes the throwaway row and exits 0 (pass) or 1 (fail).
 *
 * Run it (no package.json yet — run from inside P2's Next.js repo once it
 * exists, or install deps ad hoc):
 *   npm i -D tsx && npm i @supabase/supabase-js dotenv
 *   npx tsx scripts/test-realtime.ts
 *
 * Needs .env.local with NEXT_PUBLIC_SUPABASE_URL,
 * NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anonKey || !serviceKey) {
  console.error('✖ Missing env vars. Need NEXT_PUBLIC_SUPABASE_URL, ' +
    'NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

// Lola Cora — the seeded family user (see db/seed.sql).
const FAMILY_ID = '22222222-2222-2222-2222-222222222222'

const anon = createClient(url, anonKey)        // P3's subscription path
const admin = createClient(url, serviceKey)    // privileged trigger path

async function main() {
  let received = false

  const channel = anon
    .channel('realtime-test')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'wishlist' },
      (payload) => {
        received = true
        console.log(`✔ realtime event received: ${payload.eventType}`)
      },
    )

  await new Promise<void>((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve()
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        reject(new Error(`subscription failed: ${status}`))
      }
    })
  })
  console.log('… subscribed to wishlist, inserting a test row')

  const { data, error } = await admin
    .from('wishlist')
    .insert({ family_id: FAMILY_ID, status: 'draft', notes: 'realtime test' })
    .select('id')
    .single()
  if (error) throw error
  const rowId = data.id

  // Give the broadcast up to 10s to arrive.
  for (let i = 0; i < 20 && !received; i++) {
    await new Promise((r) => setTimeout(r, 500))
  }

  // Clean up the throwaway row regardless of outcome.
  await admin.from('wishlist').delete().eq('id', rowId)
  await anon.removeChannel(channel)

  if (received) {
    console.log('\n✅ Realtime works — safe to hand to P3.')
    process.exit(0)
  } else {
    console.error('\n❌ No realtime event in 10s. Check, in order:')
    console.error('   1. db/realtime.sql ran (wishlist in supabase_realtime publication)')
    console.error('   2. RLS lets the anon client SELECT the row (db/policies.sql)')
    console.error('   3. The Supabase project has Realtime enabled')
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('✖ test errored:', e.message)
  process.exit(1)
})
