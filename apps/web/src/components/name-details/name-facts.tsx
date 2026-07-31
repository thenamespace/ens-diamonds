import { Card, Chip, Skeleton, Typography } from "@thenamespace/uikit";

import type { EnsNameDetails } from "@/hooks";
import { formatUnixDate, getGraphemeCount } from "@/lib/helpers";

type NameFactsProps = {
  details: EnsNameDetails;
  label: string;
};

export const NameFacts = ({ details, label }: NameFactsProps) => (
  <Card variant="default">
    <Card.Header>
      <Card.Title>Name details</Card.Title>
      <Card.Description>Registrar state and premium timeline.</Card.Description>
    </Card.Header>
    <Card.Content>
      <Fact label="Length">{getGraphemeCount(label)} characters</Fact>
      <Fact label="Status">
        {details.isPending ? (
          <Skeleton className="h-6 w-24 rounded-full" />
        ) : (
          <Chip color={details.isAvailable ? "success" : "danger"} size="sm" variant="soft">
            <Chip.Label>{details.isAvailable ? "Available" : "Unavailable"}</Chip.Label>
          </Chip>
        )}
      </Fact>
      <DateFact
        isPending={details.isPending}
        label="Expired"
        timestamp={details.registrationExpiresAt}
      />
      <DateFact
        isPending={details.isPending}
        label="Premium started"
        timestamp={details.premiumStartsAt}
      />
      <DateFact
        isPending={details.isPending}
        label="Standard price from"
        timestamp={details.availableAt}
      />
    </Card.Content>
  </Card>
);

const DateFact = ({
  isPending,
  label,
  timestamp,
}: {
  isPending: boolean;
  label: string;
  timestamp: number | undefined;
}) => (
  <Fact label={label}>
    {isPending ? (
      <Skeleton className="h-5 w-24 rounded-md" />
    ) : timestamp === undefined ? (
      "—"
    ) : (
      formatUnixDate(timestamp)
    )}
  </Fact>
);

const Fact = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex min-h-12 items-center justify-between gap-5 border-b border-default py-3 last:border-0">
    <Typography.Paragraph color="muted" size="sm">
      {label}
    </Typography.Paragraph>
    <div className="text-right text-sm font-medium text-foreground">{children}</div>
  </div>
);
