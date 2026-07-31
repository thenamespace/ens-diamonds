import { Typography } from "@thenamespace/uikit";

export const PremiumNameHeader = () => (
  <header>
    <Typography.Heading level={1}>Names in temporary premium</Typography.Heading>
    <Typography.Paragraph className="mt-1 max-w-xl" color="muted" size="base">
      Recently expired ENS names, decaying through their 21-day premium auction. Pool up to grab the
      ones worth having before someone else does.
    </Typography.Paragraph>
  </header>
);
