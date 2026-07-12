"use client";

import { useState } from "react";

// Share the current pool page: native share sheet on mobile, copy-to-clipboard
// (with a "copied" confirmation) everywhere else. Use it to invite people to a pool.
export default function ShareButton({ className }: { className?: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (!url) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Join my Coffer pool", url });
        return;
      } catch {
        /* user dismissed or unsupported — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <button type="button" className={`btn btn-soft${className ? ` ${className}` : ""}`} onClick={share}>
      {copied ? "Link copied ✓" : "Share invite ↗"}
    </button>
  );
}
