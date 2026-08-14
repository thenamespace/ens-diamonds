"use client";

import { useMemo } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getFavouriteLabels, toggleFavourite } from "@/db/actions";

const FAVOURITES_QUERY_KEY = ["favourite-names"] as const;

export const useFavourites = (initialFavourites?: Array<{ label: string }>) => {
  const queryClient = useQueryClient();
  const query = useQuery({
    ...(initialFavourites ? { initialData: initialFavourites } : {}),
    queryKey: FAVOURITES_QUERY_KEY,
    queryFn: getFavouriteLabels,
    staleTime: 60_000,
  });
  const labels = useMemo(() => new Set(query.data?.map(({ label }) => label) ?? []), [query.data]);
  const mutation = useMutation({
    mutationFn: toggleFavourite,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: FAVOURITES_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ["premium-names"] }),
      ]);
    },
  });

  return {
    labels: [...labels],
    isFavourite: (label: string) => labels.has(label.toLowerCase()),
    isPending: query.isPending || mutation.isPending,
    toggle: mutation.mutate,
  };
};
