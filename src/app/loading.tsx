import { Skeleton } from "@/components/ui/skeleton";

export default function Loading(): JSX.Element {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-6 py-10">
      <Skeleton className="h-10 w-72" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-80" />
    </main>
  );
}
