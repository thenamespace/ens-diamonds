"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAuth } from "@/hooks/use-auth";

export default function SignInPrompt() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { signIn } = useAuth();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }
    setBusy(true);
    try {
      await signIn();
      router.refresh();
    } catch {
      // swallowed; user can retry
    } finally {
      setBusy(false);
    }
  };

  return (
    <button className="btn btn-primary" onClick={onClick} disabled={busy}>
      {isConnected ? (busy ? "Check your wallet…" : "Sign in to view") : "Connect wallet"}
    </button>
  );
}
