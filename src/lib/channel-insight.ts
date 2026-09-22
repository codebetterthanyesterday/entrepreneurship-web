import type { ChannelBreakdown } from "@/lib/queries/report.query";

/**
 * The sentence under the preorder / on-the-spot bar, in words rather than
 * percentages alone.
 *
 * It lives here, apart from the component that draws it, because of where it
 * ends up: this is the line the team quotes in the business report, so it is
 * worth being able to test what it says about a given split rather than reading
 * it off a rendered page.
 *
 * The percentage it names is always the winning channel's, and it is derived
 * from the same rounded `preorderPercentage` the bar is drawn from — so the
 * sentence and the bar can never disagree by a rounding point. A tie at 50/50
 * reads as preorder's, which matches the bar: at 50% the pink half is drawn
 * first and the eye lands on it.
 */
export function channelInsight(channels: ChannelBreakdown): string {
  const { preorder, onsite, preorderPercentage } = channels;

  if (preorder.revenue + onsite.revenue === 0) {
    return "Belum ada pemasukan yang tercatat, jadi belum kelihatan kanal mana yang lebih kuat.";
  }

  if (preorderPercentage >= 50) {
    return (
      `${preorderPercentage}% pemasukan datang dari preorder. ` +
      "Promosi sebelum hari-H kelihatan membuahkan hasil."
    );
  }

  return (
    `${100 - preorderPercentage}% pemasukan datang dari pembeli yang lewat booth. ` +
    "Posisi booth dan display produk berperan besar."
  );
}
