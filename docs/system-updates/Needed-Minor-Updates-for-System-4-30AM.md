# Needed Minor Updates for System — 2026-05-22 04:30 AM

Captured during the end-to-end test pass against the live deployment at
`https://internstellar-eight.vercel.app`. The system is **shippable as-is**;
each item below is non-blocking but worth doing before production hardening.

Source commit at audit time: `63f24c1` on `main`.

---

## 1. No ESLint configuration

`next lint` is not wired up in `package.json` and no `.eslintrc.*` file exists at
the repo root.

**Impact:** lint regressions slip in silently; no enforcement of the
`next/core-web-vitals` rules (which catch e.g. missing `key` props, unsafe
`<a>` tags, accessibility regressions).

**Fix:** add `next/core-web-vitals` config + `"lint": "next lint"` script.

```jsonc
// package.json
"scripts": {
  "lint": "next lint",
  ...
}
```

```json
// .eslintrc.json
{ "extends": ["next/core-web-vitals"] }
```

Then wire `npm run lint` into the test loop.

---

## 2. `engines.node` is stricter than Vercel default

`package.json` declares:

```json
"engines": { "node": "20.x" }
```

Vercel's default Node runtime for new projects is now Node 22. This currently
produces an `EBADENGINE` warning on every `npm install` (visible in build logs)
but does not fail the build.

**Fix:** loosen the range so the lock matches reality.

```json
"engines": { "node": ">=20.6.0" }
```

---

## 3. `public.finalize_wishlist` RPC is callable by any signed-in user

Supabase security advisor flagged:

> Function `public.finalize_wishlist(p_wishlist_id uuid)` can be executed by
> the `authenticated` role as a `SECURITY DEFINER` function via
> `/rest/v1/rpc/finalize_wishlist`.

`SECURITY DEFINER` means the function runs with the owner's privileges,
bypassing RLS. If the function does its own caller authorization, this is
fine. If it doesn't, any signed-in user can finalize any wishlist via a
direct REST call.

**Fix — pick one:**

- **A (preferred if all writes go through API routes):**
  ```sql
  revoke execute on function public.finalize_wishlist(uuid) from authenticated;
  grant  execute on function public.finalize_wishlist(uuid) to   service_role;
  ```
- **B (if the function is meant to be user-callable):** confirm the function
  body checks `auth.uid()` against the wishlist owner before mutating, and
  switch to `SECURITY INVOKER` so RLS still applies.

Reference: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

---

## 4. Leaked-password protection disabled in Supabase Auth

Supabase Auth can check passwords against HaveIBeenPwned.org at sign-up /
password-change time. Currently disabled on this project.

**Fix:** Supabase Dashboard → Authentication → Providers → Email → toggle on
"Leaked password protection." No code change required.

Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

---

## 5. `react-qr-code` not actually present

The original test brief asked us to verify a `react-qr-code` integration, but
the dependency is not in `package.json` and no source file imports it. Either:

- the requirement was misremembered → ignore;
- a QR feature was planned but not yet implemented → add a tracking issue.

No action taken in this audit.

---

## 6. `request_lock` table has RLS on, no policies

Supabase advisor (INFO-level, not WARN):

> Table `public.request_lock` has RLS enabled, but no policies exist.

This is **safe** — the table is only touched by `try_idempotency_lock` and
`release_idempotency_lock` RPCs which run as `service_role` and bypass RLS.
The lint is informational. Suppress by adding a no-op policy if it bothers
the dashboard:

```sql
create policy "service-only" on public.request_lock
  for all using (false);
```

(Or leave as-is; it's correct.)

---

## 7. `Rene` branch on origin is diverged

`origin/Rene` is at `e9620ce` (the Next 14 pin path) which was **superseded**
by the teammate's Next 15 migration on `main`. Keeping it around as a record
is fine, but if anyone branches from it expecting it to be current, they'll
get the regression.

**Fix — pick one:**

- Delete it: `git push origin --delete Rene`
- Or merge `main` into it and force-push so it stops being misleading.

---

## Priorities (suggested)

| # | Item | Priority |
|---|---|---|
| 3 | `finalize_wishlist` RPC privilege review | **High** (auth-bypass surface) |
| 4 | Enable leaked-password protection | Medium |
| 2 | Loosen `engines.node` | Low (warning only) |
| 1 | Add ESLint config | Low |
| 7 | Clean up `Rene` branch | Low |
| 6 | `request_lock` no-policy notice | Trivial (informational) |
| 5 | `react-qr-code` presence | n/a (clarification only) |

None block the demo. Item 3 is the only one with a real security implication
and is worth resolving before public exposure.
