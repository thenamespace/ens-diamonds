"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

async function fetchWatching(): Promise<string[]> {
  const res = await fetch("/api/watching");
  if (!res.ok) return [];
  const j = (await res.json()) as { labels: string[] };
  return j.labels ?? [];
}

export function useWatching() {
  const qc = useQueryClient();
  const { isSignedIn, signIn } = useAuth();

  const { data: labels = [] } = useQuery({
    queryKey: ["watching"],
    queryFn: fetchWatching,
    enabled: isSignedIn,
  });

  const isWatching = useCallback(
    (label: string) => labels.map((l) => l.toLowerCase()).includes(label.toLowerCase()),
    [labels],
  );

  const mutation = useMutation({
    mutationFn: async (label: string) => {
      if (!isSignedIn) await signIn();
      const currentlyWatching = labels.map((l) => l.toLowerCase()).includes(label.toLowerCase());
      const res = await fetch("/api/watching", {
        method: currentlyWatching ? "DELETE" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) throw new Error("Failed to update watchlist");
      return (await res.json()).labels as string[];
    },
    onSuccess: (next) => qc.setQueryData(["watching"], next),
  });

  const toggle = useCallback((label: string) => mutation.mutate(label), [mutation]);

  return { labels, isWatching, toggle, isPending: mutation.isPending };
}
