"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useSignMessage } from "wagmi";
import { SiweMessage } from "@signinwithethereum/siwe";

async function fetchMe(): Promise<string | null> {
  const res = await fetch("/api/auth/me");
  if (!res.ok) return null;
  const j = (await res.json()) as { address: string | null };
  return j.address;
}

export function useAuth() {
  const qc = useQueryClient();
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { data: sessionAddress, isLoading } = useQuery({ queryKey: ["auth-me"], queryFn: fetchMe });

  const signIn = useCallback(async () => {
    if (!isConnected || !address) throw new Error("Connect a wallet first");
    const nonce = await fetch("/api/auth/nonce").then((r) => r.text());
    const message = new SiweMessage({
      domain: window.location.host,
      address,
      statement: "Sign in to Coffer to manage your watchlist.",
      uri: window.location.origin,
      version: "1",
      chainId: chainId ?? 1,
      nonce,
      issuedAt: new Date().toISOString(),
    });
    const prepared = message.prepareMessage();
    const signature = await signMessageAsync({ message: prepared });
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: prepared, signature }),
    });
    if (!res.ok) throw new Error("Sign-in failed");
    await qc.invalidateQueries({ queryKey: ["auth-me"] });
    await qc.invalidateQueries({ queryKey: ["watching"] });
  }, [address, chainId, isConnected, signMessageAsync, qc]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    await qc.invalidateQueries({ queryKey: ["auth-me"] });
    await qc.invalidateQueries({ queryKey: ["watching"] });
  }, [qc]);

  // Signed in only if the session address matches the currently-connected one.
  const isSignedIn = !!sessionAddress && !!address && sessionAddress === address.toLowerCase();

  return { sessionAddress: sessionAddress ?? null, isSignedIn, isLoadingAuth: isLoading, signIn, signOut };
}
