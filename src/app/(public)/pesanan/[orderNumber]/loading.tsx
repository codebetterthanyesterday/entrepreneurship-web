import { LoadingScreen, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingScreen label="Lagi nyari pesanan kamu...">
      <Skeleton className="h-[320px] max-w-[480px] mx-auto w-full" />
    </LoadingScreen>
  );
}
