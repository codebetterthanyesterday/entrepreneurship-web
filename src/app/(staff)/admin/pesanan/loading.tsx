import { LoadingScreen, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingScreen label="Lagi ngambil daftar pesanan...">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-2.5">
        <Skeleton className="h-[118px]" />
        <Skeleton className="h-[118px]" />
        <Skeleton className="h-[118px]" />
        <Skeleton className="h-[118px]" />
        <Skeleton className="h-[118px]" />
        <Skeleton className="h-[118px]" />
      </div>
    </LoadingScreen>
  );
}
