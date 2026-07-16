"use client";

import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { ToggleButton } from "@thenamespace/uikit";
import { useWatching } from "@/hooks/use-watching";

export default function WatchButton({ label, className }: { label: string; className?: string }) {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { isWatching, toggle, isPending } = useWatching();
  const active = isWatching(label);

  return (
    // The button often sits inside a card <Link>. React Aria stops the click
    // from bubbling, so a bubble-phase handler never runs and the anchor's
    // NATIVE navigation still fires. Cancel the default in the capture phase
    // instead — RAC toggling is pointer-based and unaffected.
    <span onClickCapture={(e) => e.preventDefault()}>
      <ToggleButton
        aria-label={active ? `Remove ${label}.eth from favourites` : `Add ${label}.eth to favourites`}
        className={`data-[selected=true]:bg-transparent data-[selected=true]:text-danger data-[selected=true]:hover:bg-danger-soft${className ? ` ${className}` : ""}`}
        isDisabled={isPending}
        isSelected={active}
        isIconOnly
        size="sm"
        variant="ghost"
        onChange={() => {
          if (!isConnected) {
            openConnectModal?.();
            return;
          }
          toggle(label);
        }}
      >
        {/* Heart = favourite; filled when favourited. */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill={active ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden
        >
          <path
            d="M12 20.3 4.7 13a4.9 4.9 0 0 1 0-7 4.9 4.9 0 0 1 7 0l.3.3.3-.3a4.9 4.9 0 0 1 7 0 4.9 4.9 0 0 1 0 7z"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </ToggleButton>
    </span>
  );
}
