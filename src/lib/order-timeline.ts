import type { OrderStatus } from "@/types/order";

export type TimelineStageId = "masuk" | "confirmed" | "prep" | "ready" | "done";

export interface TimelineStage {
  id: TimelineStageId;
  title: string;
  detail: string;
}

/**
 * The customer-facing stages, in order. These are the "Pelanggan (lacak)"
 * column of the status map in chapter 3 of the implementation guide — the
 * technical status is never shown as-is.
 */
export const TIMELINE_STAGES: readonly TimelineStage[] = [
  {
    id: "masuk",
    title: "Pesanan masuk",
    detail: "Kami udah terima pesanan kamu",
  },
  {
    id: "confirmed",
    title: "Udah dikonfirmasi",
    detail: "Pesanan kamu dikunci, tinggal tunggu jam ambil",
  },
  {
    id: "prep",
    title: "Lagi diracik",
    detail: "Tim dapur lagi sibuk bikin punya kamu",
  },
  {
    id: "ready",
    title: "Siap diambil!",
    detail: "Mampir ke booth ya, bawa nomor pesanan",
  },
  {
    id: "done",
    title: "Selesai, makasih ya!",
    detail: "Sampai jumpa di Market Day berikutnya",
  },
];

/**
 * Which stage an order is sitting on. CANCELLED has no stage — a cancelled
 * order is shown on its own rather than as a point on the timeline.
 */
const STAGE_OF_STATUS: Readonly<Record<OrderStatus, TimelineStageId | null>> = {
  CONFIRMED: "confirmed",
  IN_QUEUE: "prep",
  IN_PROGRESS: "prep",
  READY: "ready",
  DONE: "done",
  CANCELLED: null,
};

export type StageState = "done" | "current" | "pending";

export interface TimelineStep extends TimelineStage {
  state: StageState;
  /** Position shown in the bullet, 1-based. */
  position: number;
}

/**
 * The timeline to draw for one order.
 *
 * An order with nothing to make skips the "Lagi diracik" stage entirely — it
 * would otherwise promise a step that is never going to happen.
 */
export function buildTimeline(status: OrderStatus, needsPrep: boolean): TimelineStep[] {
  const stages = TIMELINE_STAGES.filter((stage) => stage.id !== "prep" || needsPrep);
  const currentId = STAGE_OF_STATUS[status];
  const currentIndex = stages.findIndex((stage) => stage.id === currentId);

  return stages.map((stage, index) => ({
    ...stage,
    position: index + 1,
    state: index < currentIndex ? "done" : index === currentIndex ? "current" : "pending",
  }));
}

/** Polling is pointless once an order can no longer move. */
export function isFinalStatus(status: OrderStatus): boolean {
  return status === "DONE" || status === "CANCELLED";
}
