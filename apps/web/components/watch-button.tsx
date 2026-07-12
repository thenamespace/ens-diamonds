"use client";

import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useWatching } from "@/hooks/use-watching";

export default function WatchButton({ label, className }: { label: string; className?: string }) {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { isWatching, toggle, isPending } = useWatching();
  const active = isWatching(label);

  return (
    <button
      type="button"
      className={`watch-btn${active ? " on" : ""}${className ? ` ${className}` : ""}`}
      aria-pressed={active}
      aria-label={active ? `Unwatch ${label}.eth` : `Watch ${label}.eth`}
      disabled={isPending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isConnected) {
          openConnectModal?.();
          return;
        }
        toggle(label);
      }}
    >
      {/* Eye = "watch"; filled pupil when actively watching. */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx="12" cy="12" r="3" fill={active ? "currentColor" : "none"} />
      </svg>
    </button>
  );
}
