import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading(): JSX.Element {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
