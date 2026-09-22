import { LoadingScreen, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingScreen label="Lagi nyiapin halaman...">
      <Skeleton className="h-[220px] rounded-[24px]" />
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-24" />
      <div className="grid grid-cols-2 desktop:grid-cols-4 gap-3">
        <Skeleton className="h-[116px]" />
        <Skeleton className="h-[116px]" />
        <Skeleton className="h-[116px]" />
        <Skeleton className="h-[116px]" />
      </div>
    </LoadingScreen>
  );
}
