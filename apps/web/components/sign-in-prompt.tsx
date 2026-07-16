"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Button, Spinner } from "@thenamespace/uikit";
import { useAuth } from "@/hooks/use-auth";

export default function SignInPrompt() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { signIn } = useAuth();
  const [busy, setBusy] = useState(false);

  const onPress = async () => {
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
    <Button isPending={busy} onPress={onPress}>
      {busy ? <Spinner color="current" size="sm" /> : null}
      {isConnected ? (busy ? "Check your wallet…" : "Sign in to view") : "Connect wallet"}
    </Button>
  );
}
