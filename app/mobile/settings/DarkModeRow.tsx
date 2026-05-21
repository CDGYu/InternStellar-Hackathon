"use client";

import { Moon } from "lucide-react";

import { setThemeAction } from "@/app/theme/actions";
import type { Theme } from "@/lib/theme";

/**
 * Inline dark-mode toggle row for the mobile settings hub. Server-
 * action form (no React state) — the cookie is the source of truth.
 * The toggle visual reflects the current theme; tapping it submits a
 * hidden input with the opposite value.
 *
 * NOTE: per spec §1 + §5.2, this toggles the theme cookie but the
 * mobile UI itself is light-mode-only (hardcoded colors). The hint
 * text under the label discloses this.
 */
export function DarkModeRow({ theme }: { theme: Theme }) {
  const next: Theme = theme === "dark" ? "light" : "dark";
  const isDark = theme === "dark";

  return (
    <form action={setThemeAction} className="block">
      <input type="hidden" name="theme" value={next} />
      <button
        type="submit"
        className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white border border-black/5 shadow-sm hover:bg-slate-50 transition-colors text-left"
        aria-label={`Switch to ${next} mode`}
      >
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
          <Moon className="w-5 h-5 text-[#1a1d2e]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#1a1d2e]">Dark Mode</p>
          <p className="text-[11px] text-[#6b7280] mt-0.5 leading-snug">
            Currently <span className="font-medium">{isDark ? "on" : "off"}</span>{" "}
            — affects desktop pages; mobile UI is light-mode only for now.
          </p>
        </div>
        <span
          aria-hidden
          className={
            isDark
              ? "w-11 h-6 rounded-full bg-[#5b7cff] flex items-center px-0.5 justify-end transition-colors shrink-0"
              : "w-11 h-6 rounded-full bg-slate-300 flex items-center px-0.5 justify-start transition-colors shrink-0"
          }
        >
          <span className="w-5 h-5 bg-white rounded-full shadow-sm transition-transform" />
        </span>
      </button>
    </form>
  );
}
