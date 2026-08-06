"use client";

import {
  Chip,
  TimelineContent,
  TimelineItem,
  TimelineMarker,
  TimelineRoot,
  Typography,
} from "@thenamespace/uikit";

const lifecycle = [
  {
    state: "Funding",
    title: "Agree before money locks",
    body: "One member creates a vault with 2–10 fixed Safe owners, a spending cap, registration duration, and one hidden ENS target. Members deposit independently and can withdraw while funding remains open.",
    action: "Members fund or withdraw",
  },
  {
    state: "Committed",
    title: "Open one acquisition window",
    body: "The creator starts acquisition. The contract adopts or submits the exact ENS commitment, then locks funding until that commitment can be used or expires.",
    action: "Creator begins acquisition",
  },
  {
    state: "Purchase",
    title: "Register directly to the Safe",
    body: "After ENS’s minimum commitment age, anyone with the reveal values can execute. The contract deploys the predicted Safe, registers the name to it, and never takes ownership itself.",
    action: "Anyone with the reveal executes",
  },
  {
    state: "Settlement",
    title: "Claim what was not spent",
    body: "Success allocates the unused ETH proportionally. A cancelled or expired attempt returns each recorded contribution. Refunds are claimed individually.",
    action: "Each member claims",
  },
] as const;

export const AboutTimeline = () => (
  <TimelineRoot className="border-t border-default pt-8" density="comfortable" size="lg">
    {lifecycle.map((step, index) => (
      <TimelineItem className="pb-10 sm:pb-12" key={step.state}>
        <TimelineMarker className="font-mono text-xs">0{index + 1}</TimelineMarker>
        <TimelineContent className="border-b border-default pb-10 sm:pb-12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Typography.Heading className="text-2xl tracking-tight" level={3}>
              {step.title}
            </Typography.Heading>
            <Chip color="default" size="sm" variant="soft">
              {step.state}
            </Chip>
          </div>
          <Typography.Paragraph className="mt-4 max-w-2xl leading-7" color="muted">
            {step.body}
          </Typography.Paragraph>
          <Typography.Paragraph
            className="mt-5 font-mono text-xs uppercase tracking-wider"
            color="muted"
          >
            {step.action}
          </Typography.Paragraph>
        </TimelineContent>
      </TimelineItem>
    ))}
  </TimelineRoot>
);
