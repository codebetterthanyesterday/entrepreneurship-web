import { LoadingScreen, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingScreen label="Lagi nyiapin form checkout...">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-[74px]" />
      <Skeleton className="h-[74px]" />
      <Skeleton className="h-[74px]" />
      <Skeleton className="h-[74px]" />
    </LoadingScreen>
  );
}
