import { VaultsOverview } from "@/components/vaults";
import { getPublicVaults } from "@/db/actions";

const toVaultCardSummaries = (records: Awaited<ReturnType<typeof getPublicVaults>>) =>
  records.map(({ members, metadata, vault }) => ({
    identity: {
      type: "metadata" as const,
      title: metadata.name,
      description: metadata.description,
    },
    memberCount: members.length,
    vaultId: vault.vaultId,
  }));

export default async function VaultsPage() {
  const records = await getPublicVaults();
  const vaults = toVaultCardSummaries(records);

  return (
    <VaultsOverview isAuthenticated={false} mode="public" vaults={vaults} viewerAddress={null} />
  );
}
