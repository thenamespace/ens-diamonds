import { Card, Skeleton } from "@thenamespace/uikit";

export const PremiumNameGridSkeleton = ({ count = 8 }: { count?: number }) => (
  <output
    aria-label="Loading premium names"
    className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
  >
    {Array.from({ length: count }, (_, index) => (
      <Card className="h-72 gap-0 overflow-hidden p-0 shadow-xs" key={index}>
        <div className="flex flex-1 flex-col p-4">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="mt-5 h-8 w-3/4 rounded-lg" />
        </div>
        <div className="border-t border-default px-4 py-4">
          <Skeleton className="h-3 w-20 rounded-md" />
          <Skeleton className="mt-2 h-6 w-36 rounded-md" />
          <Skeleton className="mt-5 h-2 w-full rounded-full" />
          <Skeleton className="mt-3 h-7 w-24 rounded-full" />
        </div>
      </Card>
    ))}
  </output>
);

export const PremiumNameListSkeleton = ({ count = 8 }: { count?: number }) => (
  <output aria-label="Loading premium names" className="block space-y-3">
    {Array.from({ length: count }, (_, index) => (
      <Card
        className="grid min-h-20 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-4 py-3 shadow-xs sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:gap-5"
        key={index}
      >
        <Skeleton className="size-11 rounded-xl" />
        <div>
          <Skeleton className="h-6 w-36 rounded-md" />
          <Skeleton className="mt-2 h-3 w-28 rounded-md sm:hidden" />
        </div>
        <Skeleton className="col-start-2 row-start-2 h-7 w-24 rounded-full sm:col-auto sm:row-auto" />
        <div className="hidden min-w-44 sm:block">
          <Skeleton className="ml-auto h-3 w-20 rounded-md" />
          <Skeleton className="mt-2 ml-auto h-4 w-36 rounded-md" />
        </div>
      </Card>
    ))}
  </output>
);
