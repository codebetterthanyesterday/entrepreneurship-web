import { LoadingScreen, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingScreen label="Lagi ngambil daftar preorder...">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-[92px]" />
      <Skeleton className="h-[92px]" />
      <Skeleton className="h-[92px]" />
      <Skeleton className="h-[92px]" />
    </LoadingScreen>
  );
}
