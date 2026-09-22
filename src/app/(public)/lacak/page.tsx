import { TrackView } from "@/components/public/track-view";
import { pageTitle } from "@/lib/brand";

export const metadata = {
  title: pageTitle("Lacak pesanan"),
};

// The page itself holds no order data — the client fetches it — but it reads
// search params, so it must not be prerendered.
export const dynamic = "force-dynamic";

interface PageProps {
  // Next 15+ hands search params as a Promise; it has to be awaited.
  searchParams: Promise<{ no?: string }>;
}

export default async function TrackPage({ searchParams }: PageProps) {
  const { no } = await searchParams;

  // No `PageShell`: the tracker brings its own full-bleed bands.
  return <TrackView initialOrderNumber={no ?? ""} />;
}
