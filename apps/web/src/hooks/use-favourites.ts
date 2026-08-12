"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getFavouriteLabels, toggleFavourite } from "@/db/actions";

const FAVOURITES_QUERY_KEY = ["favourite-names"] as const;

export const useFavourites = () => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: FAVOURITES_QUERY_KEY,
    queryFn: getFavouriteLabels,
    staleTime: 60_000,
  });
  const labels = new Set(query.data?.map(({ label }) => label) ?? []);
  const mutation = useMutation({
    mutationFn: toggleFavourite,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FAVOURITES_QUERY_KEY }),
  });

  return {
    isFavourite: (label: string) => labels.has(label.toLowerCase()),
    isPending: query.isPending || mutation.isPending,
    toggle: mutation.mutate,
  };
};
