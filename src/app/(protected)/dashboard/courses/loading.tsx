import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function CoursesLoading() {
  return (
    <div className="flex flex-1 flex-col pb-12 w-full animate-in fade-in duration-300 max-w-6xl mx-auto px-4 mt-8">
      {/* Header skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-4 w-72 mt-3" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Filter bar + table skeleton */}
      <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
        <div className="p-4 border-b border-[var(--color-border)] flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex items-center gap-3 w-full md:max-w-xl">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-[160px] hidden sm:block" />
            <Skeleton className="h-10 w-16" />
          </div>
          <Skeleton className="h-5 w-24" />
        </div>

        {/* Course row skeletons */}
        <div className="divide-y divide-[var(--color-border)]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 flex items-center gap-4">
              <Skeleton className="w-16 h-12 rounded-md shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
              <div className="hidden sm:block space-y-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="hidden md:block h-3 w-24" />
            </div>
          ))}
        </div>

        {/* Footer skeleton */}
        <div className="p-4 border-t border-[var(--color-border)] flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      </Card>
    </div>
  );
}
