import { Skeleton } from "@thenamespace/uikit/skeleton";
import { SkeletonPageHead, SkeletonCardGrid } from "@/components/skeletons";

// Generic route-loading fallback. Because it lives at the app root it also
// covers any nested route without its own loading.tsx (name page, buy, etc.),
// so it stays neutral rather than Discover-specific.
export default function Loading() {
  return (
    <div className="wrap">
      <SkeletonPageHead />
      <div className="mb-[22px] flex flex-wrap items-center gap-3" aria-hidden>
        <Skeleton className="h-[42px] w-[320px] rounded-full" />
        <Skeleton className="ml-auto h-[42px] w-[340px] rounded-full" />
      </div>
      <SkeletonCardGrid count={9} />
    </div>
  );
}
