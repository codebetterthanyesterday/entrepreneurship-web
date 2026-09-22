import { LoadingScreen, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingScreen label="Lagi ngitung ringkasan penjualan...">
      <div className="grid grid-cols-2 desktop:grid-cols-4 gap-2.5">
        <Skeleton className="h-[92px]" />
        <Skeleton className="h-[92px]" />
        <Skeleton className="h-[92px]" />
        <Skeleton className="h-[92px]" />
      </div>
      <div className="grid grid-cols-1 desktop:grid-cols-2 gap-2.5">
        <Skeleton className="h-[200px]" />
        <Skeleton className="h-[200px]" />
        <Skeleton className="h-[200px]" />
        <Skeleton className="h-[200px]" />
      </div>
    </LoadingScreen>
  );
}
