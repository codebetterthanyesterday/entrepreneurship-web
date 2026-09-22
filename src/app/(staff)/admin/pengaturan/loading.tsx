import { LoadingScreen, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingScreen label="Lagi ngambil pengaturan toko...">
      {/* The page's own 720px measure, so the form does not jump when it lands. */}
      <div className="flex flex-col gap-4 w-full max-w-[720px] mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[120px]" />
        <Skeleton className="h-[120px]" />
        <Skeleton className="h-[120px]" />
      </div>
    </LoadingScreen>
  );
}
