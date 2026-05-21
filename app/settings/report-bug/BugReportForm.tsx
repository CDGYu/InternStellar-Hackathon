"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ArrowUpRightIcon } from "@/components/ui/icons";

const BUG_INBOX = "Internstellar.hackathon@gmail.com";
const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;

export function BugReportForm() {
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

    const lines = [
      `From: ${email}`,
      "",
      "Details:",
      details,
    ];
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Input
        label="Your email"
        type="email"
        name="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        autoComplete="email"
        required
        hint="So we can follow up with questions or the fix."
      />

      <Input
        label="Short title"
        type="text"
        name="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Deposit fails with contract_error"
        maxLength={120}
        required
      />

      <div className="w-full">
        <label
          htmlFor="bug-details"
          className="block text-xs uppercase tracking-[0.16em] text-ink-muted font-medium mb-2.5"
        >
          Details
        </label>
        <textarea
          id="bug-details"
          name="details"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="What you did, what you expected, what happened. Paste any red console errors."
          rows={6}
          required
          className="w-full bg-surface text-ink rounded-2xl px-5 py-3.5 shadow-neu-inset placeholder:text-ink-placeholder transition-shadow duration-300 ease-soft focus:outline-none focus:shadow-neu-inset-deep resize-y min-h-[140px] focus-visible:[box-shadow:inset_10px_10px_20px_rgba(var(--neu-shadow-dark-rgb),var(--neu-shadow-dark-alpha-2)),inset_-10px_-10px_20px_rgba(var(--neu-shadow-light-rgb),var(--neu-shadow-light-alpha-2))]"
        />
      </div>

      <div className="w-full">
        <label
          htmlFor="bug-screenshot"
          className="block text-xs uppercase tracking-[0.16em] text-ink-muted font-medium mb-2.5"
        >
          Screenshot <span className="normal-case tracking-normal text-ink-muted/70">(optional)</span>
        </label>
        <div className="flex items-center gap-3 p-3 rounded-2xl shadow-neu-inset-sm bg-surface">
          <label
            htmlFor="bug-screenshot"
            className="cursor-pointer rounded-xl px-4 py-2 text-sm font-medium bg-surface shadow-neu hover:shadow-neu-sm active:shadow-neu-inset-sm transition-shadow"
          >
            Choose file
          </label>
          <span className="text-sm text-ink-muted truncate flex-1 min-w-0">
            {screenshot ? `${screenshot.name} (${formatBytes(screenshot.size)})` : "No file selected"}
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
          <p className="mt-2 text-sm text-red-500">{screenshotError}</p>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">
            Your email client will open — attach the file there before sending.
          </p>
        )}
      </div>

      <Button type="submit" variant="primary" size="lg" className="w-full">
        Send bug report
        <ArrowUpRightIcon className="h-4 w-4" />
      </Button>
    </form>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
