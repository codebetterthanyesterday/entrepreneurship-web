import { LoadingScreen, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingScreen label="Lagi ngambil daftar menu...">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-[78px]" />
      <Skeleton className="h-[78px]" />
      <Skeleton className="h-[78px]" />
      <Skeleton className="h-[78px]" />
      <Skeleton className="h-[78px]" />
    </LoadingScreen>
  );
}
