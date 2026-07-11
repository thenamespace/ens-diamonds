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
      <svg width="16" height="16" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" aria-hidden>
        <path d="M12 17.3l-5.4 3 1-6-4.3-4.2 6-.9L12 3l2.7 5.2 6 .9-4.3 4.2 1 6z" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </button>
  );
}
