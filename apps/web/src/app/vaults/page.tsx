import { getAddress } from "viem";

import { auth } from "@/auth";
import { VaultsOverview } from "@/components/vaults";
import { getVaultsForUser } from "@/db/actions";

const toVaultCardSummaries = (records: Awaited<ReturnType<typeof getVaultsForUser>>) =>
  records.map(({ members, vault }) => ({
    label: vault.secrets.label,
    memberCount: members.length,
    vaultId: vault.vaultId,
  }));

export default async function VaultsPage() {
  const session = await auth();
  const records = await getVaultsForUser();
  const viewerAddress = session?.address ? getAddress(session.address) : null;
  const vaults = toVaultCardSummaries(records);

  return (
    <VaultsOverview
      isAuthenticated={session?.address !== undefined}
      vaults={vaults}
      viewerAddress={viewerAddress}
    />
  );
}
