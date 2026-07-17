"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useAccountEffect } from "wagmi";
import { useAuth } from "@/hooks/use-auth";

// The SIWE session cookie outlives the wallet connection: without this guard,
// disconnecting wallet A and connecting wallet B leaves A's session live, so
// server-rendered session pages (favourites) show A's data to B. Client hooks
// already gate on session === connected wallet; this ends the stale session
// itself so the server side agrees.
export default function SessionGuard() {
  const router = useRouter();
  const { address } = useAccount();
  const { sessionAddress, signOut } = useAuth();

  // A different wallet than the session's is connected: end the old session.
  useEffect(() => {
    if (sessionAddress && address && sessionAddress !== address.toLowerCase()) {
      void signOut().then(() => router.refresh());
    }
  }, [address, sessionAddress, signOut, router]);

  // Explicit disconnect: end the session. (Does not fire on page load, so a
  // reload that reconnects the same wallet keeps its session.)
  useAccountEffect({
    onDisconnect() {
      if (sessionAddress) void signOut().then(() => router.refresh());
    },
  });

  return null;
}
