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

  const { data: labels = [], isFetched } = useQuery({
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
    // Optimistically flip the star immediately; roll back if the write fails.
    onMutate: async (label: string) => {
      await qc.cancelQueries({ queryKey: ["watching"] });
      const prev = qc.getQueryData<string[]>(["watching"]) ?? [];
      const lower = label.toLowerCase();
      const has = prev.map((l) => l.toLowerCase()).includes(lower);
      const next = has ? prev.filter((l) => l.toLowerCase() !== lower) : [...prev, label];
      qc.setQueryData(["watching"], next);
      return { prev };
    },
    onError: (_e, _label, ctx) => {
      if (ctx?.prev) qc.setQueryData(["watching"], ctx.prev);
    },
    onSuccess: (next) => qc.setQueryData(["watching"], next),
  });

  const toggle = useCallback((label: string) => mutation.mutate(label), [mutation]);

  // isLoaded distinguishes "confirmed not watching" from "haven't fetched yet"
  // (query is disabled until signed in) — consumers must not hide UI prematurely.
  return { labels, isWatching, toggle, isPending: mutation.isPending, isLoaded: isFetched };
}
