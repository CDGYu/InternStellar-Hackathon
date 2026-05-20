import { cookies } from "next/headers";

/**
 * Theme persistence via cookie.
 *
 * Why a cookie, not localStorage:
 *   - The server needs to read the chosen theme to set `.dark` on <html>
 *     during SSR. Otherwise the page hydrates light-first and snaps to
 *     dark on first paint (a classic flash-of-wrong-theme).
 *   - Cookies are sent on every request, so the server-rendered HTML
 *     ships with the right `.dark` class already applied.
 *   - We don't combine this with localStorage either — single source of
 *     truth keeps the toggle predictable.
 *
 * The cookie holds only the literal "light" or "dark". Anything else is
 * treated as "light" (the default).
 */
export type Theme = "light" | "dark";

export const THEME_COOKIE = "internstellar_theme";

/** Read the current theme. Server-only — uses next/headers cookies(). */
export function getTheme(): Theme {
  const value = cookies().get(THEME_COOKIE)?.value;
  return value === "dark" ? "dark" : "light";
}

/**
 * Format an httpOnly: false, year-long cookie. The reason it's not
 * httpOnly is so a future client-side theme toggle (e.g. system-preference
 * sync) could read it without a round trip — for now only the server
 * writes it, but keeping the option open costs nothing.
 */
export function buildThemeCookie(theme: Theme) {
  return {
    name: THEME_COOKIE,
    value: theme,
    httpOnly: false,
    sameSite: "lax" as const,
    path: "/",
    // 1 year — themes are sticky preferences, not transient state.
    maxAge: 60 * 60 * 24 * 365,
  };
}
