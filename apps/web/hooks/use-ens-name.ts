"use client";

import { useQuery } from "@tanstack/react-query";
import { isAddress } from "viem";
import { fetchPrimaryName, fetchAvatar } from "@/lib/ens";
import { ZERO } from "@/lib/chain";

/**
 * Resolve one address to its primary ENS name (or null). Cached by react-query
 * so repeated addresses across a page share a single request.
 */
export function useEnsName(address?: string) {
  const enabled = !!address && isAddress(address) && address.toLowerCase() !== ZERO;
  return useQuery({
    queryKey: ["ens-primary", address?.toLowerCase()],
    queryFn: () => fetchPrimaryName(address!),
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
  });
}

/** Resolve a name's avatar text record to an image URL (or null). */
export function useEnsAvatar(name?: string | null) {
  return useQuery({
    queryKey: ["ens-avatar", name],
    queryFn: () => fetchAvatar(name!),
    enabled: !!name,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
  });
}

/**
 * Resolve an address to its primary name + avatar image URL in one call.
 * Both underlying queries are react-query-cached, so this shares the same
 * name lookup as any `useEnsName(address)` elsewhere on the page.
 */
export function useEnsProfile(address?: string) {
  const { data: name, isLoading: nameLoading } = useEnsName(address);
  const { data: avatar, isLoading: avatarLoading } = useEnsAvatar(name);
  return {
    name: name ?? null,
    avatar: avatar ?? null,
    isLoading: nameLoading || (!!name && avatarLoading),
  };
}
