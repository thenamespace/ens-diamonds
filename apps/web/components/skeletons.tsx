// Server-safe skeleton primitives for route loading states (loading.tsx),
// built on UIKit's <Skeleton> and <Card>.

import { Card } from "@thenamespace/uikit/card";
import { Skeleton } from "@thenamespace/uikit/skeleton";

export function SkeletonCard() {
  return (
    <Card aria-hidden className="border border-separator">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-16 rounded" />
        <Skeleton className="size-7 rounded-full" />
      </div>
      <Skeleton className="mt-1 h-6 w-3/5 rounded" />
      <div className="mt-4 space-y-2">
        <Skeleton className="h-2.5 w-[74px] rounded" />
        <Skeleton className="h-6 w-1/2 rounded" />
        <Skeleton className="h-3 w-24 rounded" />
      </div>
      <div className="mt-4">
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    </Card>
  );
}

export function SkeletonCardGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="card-grid" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonPanelList({ count = 4 }: { count?: number }) {
  return (
    <div className="stack" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <div className="flex items-center gap-3.5">
            <Skeleton className="h-4 w-16 rounded" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-[18px] w-[170px] rounded" />
              <Skeleton className="h-3 w-[230px] rounded" />
            </div>
            <Skeleton className="ml-auto h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-2 w-full rounded-full" />
        </Card>
      ))}
    </div>
  );
}

// Neutral page-head placeholder (eyebrow / title / subtitle lines).
export function SkeletonPageHead() {
  return (
    <div className="page-head" aria-hidden>
      <div className="space-y-3.5">
        <Skeleton className="h-[13px] w-[190px] rounded" />
        <Skeleton className="h-[34px] w-[300px] rounded" />
        <Skeleton className="h-3.5 w-[70%] max-w-[560px] rounded" />
      </div>
    </div>
  );
}
