"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";

const BUG_INBOX = "Internstellar.hackathon@gmail.com";
const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;

/**
 * Mobile twin of app/settings/report-bug/BugReportForm.tsx. Identical
 * client-side mailto: logic — no server action. The only differences
 * are visual: flat cards on #f5f7fa instead of neumorphic surfaces.
 *
 * The browser opens the user's default email client with a prefilled
 * subject + body. Screenshots aren't auto-attached (mailto: doesn't
 * support attachments cross-platform); we just include the filename
 * and ask the user to attach it manually before sending.
 */
export function MobileBugReportForm() {
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function handleScreenshotChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setScreenshot(null);
      setScreenshotError(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setScreenshot(null);
      setScreenshotError("Screenshot must be an image file.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      setScreenshot(null);
      setScreenshotError("Screenshot must be 8 MB or smaller.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setScreenshot(file);
    setScreenshotError(null);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const lines = [`From: ${email}`, "", "Details:", details];
    if (screenshot) {
      lines.push(
        "",
        `Screenshot: ${screenshot.name} (${formatBytes(screenshot.size)})`,
        "→ Please attach this file in your email client before sending.",
      );
    }

    const subject = encodeURIComponent(`[Bug] ${title}`);
    const body = encodeURIComponent(lines.join("\n"));
    window.location.href = `mailto:${BUG_INBOX}?subject=${subject}&body=${body}`;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="bug-email"
          className="block text-[11px] uppercase tracking-widest text-[#6b7280] font-bold mb-1.5"
        >
          Your email
        </label>
        <input
          id="bug-email"
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
          className="w-full bg-[#f5f7fa] border-0 rounded-2xl h-12 text-sm px-4 focus:outline-none focus:ring-2 focus:ring-[#5b7cff]/40"
        />
        <p className="text-[10px] text-[#9ca3af] mt-1.5 px-1">
          So we can follow up with questions or the fix.
        </p>
      </div>

      <div>
        <label
          htmlFor="bug-title"
          className="block text-[11px] uppercase tracking-widest text-[#6b7280] font-bold mb-1.5"
        >
          Short title
        </label>
        <input
          id="bug-title"
          type="text"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Deposit fails with contract_error"
          maxLength={120}
          required
          className="w-full bg-[#f5f7fa] border-0 rounded-2xl h-12 text-sm px-4 focus:outline-none focus:ring-2 focus:ring-[#5b7cff]/40"
        />
      </div>

      <div>
        <label
          htmlFor="bug-details"
          className="block text-[11px] uppercase tracking-widest text-[#6b7280] font-bold mb-1.5"
        >
          Details
        </label>
        <textarea
          id="bug-details"
          name="details"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="What you did, what you expected, what happened. Paste any red console errors."
          rows={5}
          required
          className="w-full bg-[#f5f7fa] border-0 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#5b7cff]/40 resize-y min-h-[110px]"
        />
      </div>

      <div>
        <label
          htmlFor="bug-screenshot"
          className="block text-[11px] uppercase tracking-widest text-[#6b7280] font-bold mb-1.5"
        >
          Screenshot{" "}
          <span className="normal-case tracking-normal text-[#9ca3af]">
            (optional)
          </span>
        </label>
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#f5f7fa]">
          <label
            htmlFor="bug-screenshot"
            className="cursor-pointer rounded-xl px-3 py-2 text-xs font-semibold bg-white shadow-sm"
          >
            Choose file
          </label>
          <span className="text-xs text-[#6b7280] truncate flex-1 min-w-0">
            {screenshot
              ? `${screenshot.name} (${formatBytes(screenshot.size)})`
              : "No file selected"}
          </span>
          <input
            ref={fileRef}
            id="bug-screenshot"
            name="screenshot"
            type="file"
            accept="image/*"
            onChange={handleScreenshotChange}
            className="sr-only"
          />
        </div>
        {screenshotError ? (
          <p className="mt-2 text-xs text-red-600">{screenshotError}</p>
        ) : (
          <p className="mt-2 text-[10px] text-[#9ca3af]">
            Your email client will open — attach the file there before sending.
          </p>
        )}
      </div>

      <button
        type="submit"
        className="w-full bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] text-white rounded-full py-4 text-sm font-semibold shadow-lg shadow-[#5b7cff]/25 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
      >
        Send bug report
        <ArrowRight className="w-4 h-4" />
      </button>
    </form>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
