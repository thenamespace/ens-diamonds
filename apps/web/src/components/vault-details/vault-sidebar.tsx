import { Card, Typography } from "@thenamespace/uikit";

import { CardHeading, EthValue } from "@/components/common";

import { VaultPositionCard, type VaultPositionCardProps } from "./vault-position-card";

type VaultSidebarProps = VaultPositionCardProps & {
  isSafeDeployed: boolean;
  memberCount: number;
  registrationYears: number;
  threshold: number;
};

export const VaultSidebar = (props: VaultSidebarProps) => (
  <>
    <VaultPositionCard {...props} />

    <Card className="mt-5" variant="default">
      <Card.Header>
        <CardHeading>Vault details</CardHeading>
      </Card.Header>
      <Card.Content>
        <div className="divide-y divide-default">
          <DetailRow label="Safe approval" value={`${props.threshold} of ${props.memberCount}`} />
          <DetailRow
            label="Registration"
            value={`${props.registrationYears} ${props.registrationYears === 1 ? "year" : "years"}`}
          />
          <DetailAmount label="Current ENS price" value={props.currentPrice} />
          <DetailAmount label="Maximum spend" value={props.maxSpend} />
          <DetailRow
            label="Shared Safe"
            value={props.isSafeDeployed ? "Deployed" : "Deploys on purchase"}
          />
        </div>
      </Card.Content>
    </Card>
  </>
);

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
    <Typography.Paragraph color="muted" size="sm">
      {label}
    </Typography.Paragraph>
    <span className="text-right text-sm font-semibold">{value}</span>
  </div>
);

const DetailAmount = ({ label, value }: { label: string; value: bigint | undefined }) => (
  <div className="flex items-center justify-between gap-4 py-3">
    <Typography.Paragraph color="muted" size="sm">
      {label}
    </Typography.Paragraph>
    {value === undefined ? (
      <span className="text-sm text-muted">Loading…</span>
    ) : (
      <EthValue className="text-sm font-semibold" value={value} />
    )}
  </div>
);
