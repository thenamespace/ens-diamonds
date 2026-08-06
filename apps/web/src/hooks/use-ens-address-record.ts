"use client";

import { useQuery } from "@tanstack/react-query";

import type { ClientWithEns } from "@ensdomains/ensjs/contracts";
import { getAddressRecord } from "@ensdomains/ensjs/public";
import { getAddress, isAddress, type Address } from "viem";
import { usePublicClient } from "wagmi";

export const useEnsAddressRecord = (name: string | null) => {
  const client = usePublicClient();

  return useQuery({
    enabled: client !== undefined && name !== null,
    queryFn: async (): Promise<Address | null> => {
      if (client === undefined || name === null) return null;

      const record = await getAddressRecord(client as typeof client & ClientWithEns, {
        coin: 60,
        name,
      });
      return record?.value && isAddress(record.value) ? getAddress(record.value) : null;
    },
    queryKey: ["ens-address-record", client?.chain.id, name],
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });
};
