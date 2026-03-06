export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-border-light ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white">
      <div className="flex">
        <div className="w-1 shrink-0 bg-border-light" />
        <div className="flex-1 p-5 space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-full" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={`skeleton-${i}`} />
      ))}
    </div>
  );
}
