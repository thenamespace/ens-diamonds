import { Card, NumberValue, ProgressBar, Typography } from "@thenamespace/uikit";

import { CardHeading, EthValue } from "@/components/common";
import type { useVault } from "@/hooks";

type OnchainVault = NonNullable<ReturnType<typeof useVault>["data"]>;

type VaultFundingProps = {
  vault: OnchainVault;
};

export const VaultFunding = ({ vault }: VaultFundingProps) => {
  const isFundingActive = vault.status === "funding" || vault.status === "committed";
  const contributorCount = vault.members.filter(({ balance }) => balance > 0n).length;

  return (
    <Card variant="default">
      <Card.Header className="gap-1">
        <CardHeading>{isFundingActive ? "Funding" : "Remaining balance"}</CardHeading>
        <Typography.Paragraph color="muted" size="sm">
          {getFundingDescription(vault.status)}
        </Typography.Paragraph>
      </Card.Header>
      <Card.Content>
        <div className="flex items-end justify-between gap-4">
          <div>
            <EthValue className="text-3xl font-semibold tracking-tight" value={vault.escrowed} />
            <Typography.Paragraph className="mt-1" color="muted" size="sm">
              {isFundingActive ? "funded" : "remaining to claim"}
            </Typography.Paragraph>
          </div>
          <div className="text-right">
            <EthValue className="text-lg font-semibold" value={vault.maxSpend} />
            <Typography.Paragraph className="mt-1" color="muted" size="sm">
              maximum spend
            </Typography.Paragraph>
          </div>
        </div>

        {isFundingActive ? (
          <>
            <ProgressBar
              aria-label="Vault funding progress"
              className="mt-6"
              maxValue={100}
              minValue={0}
              value={vault.fundingProgress}
              valueLabel={`${vault.fundingProgress}% funded`}
            >
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>

            <div className="mt-2 flex items-center justify-between gap-3">
              <NumberValue
                className="text-sm text-muted"
                maximumFractionDigits={1}
                value={vault.fundingProgress}
              >
                <NumberValue.Suffix>% funded</NumberValue.Suffix>
              </NumberValue>
              <Typography.Paragraph color="muted" size="sm">
                {contributorCount} of {vault.members.length} members contributed
              </Typography.Paragraph>
            </div>
          </>
        ) : null}
      </Card.Content>
    </Card>
  );
};

const getFundingDescription = (status: OnchainVault["status"]) => {
  if (status === "funding") return "Members may deposit or withdraw before acquisition begins.";
  if (status === "committed") return "Funding is locked while the ENS commitment is active.";
  if (status === "acquired") return "The unused ETH after purchase is available to claim.";
  return "Each contributor can claim their remaining balance.";
};
