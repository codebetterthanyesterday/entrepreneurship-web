"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Note } from "@/components/ui/note";
import { Sheet } from "@/components/ui/sheet";
import { updateOrderDetailsAction } from "@/actions/kasir.actions";
import { HandoverSteps, type HandoverChoice } from "@/components/public/handover-picker";
import { isHandoverLocation } from "@/lib/schedule";
import type { BookableSchedule } from "@/lib/queries/schedule.query";

/** The parts of an order this sheet reads. */
export interface EditableOrder {
  id: string;
  orderNumber: string;
  channel: "PREORDER" | "ONSITE";
  status: string;
  customerName: string;
  customerPhone: string | null;
  serviceDate: string | null;
  serviceWindowId: string | null;
  handoverLocation: string | null;
  handoverDetail: string | null;
}

/** Whether an order's details can still be corrected: not handed over, not cancelled. */
export function canEditOrder(order: { status: string }): boolean {
  return order.status !== "DONE" && order.status !== "CANCELLED";
}

/**
 * Correct an order at the customer's request, from the cashier's preorder
 * sheet or the admin's order list: the name, the WhatsApp number, and — for a
 * preorder the customer has not come for yet — where, which day and which
 * hour. The schedule is the checkout's own picker, with every open date from
 * today on; the order's own time range stays choosable even when full, since
 * it holds one of those places itself.
 */
export function OrderEditSheet({
  order,
  schedule,
  onClose,
  onSaved,
}: {
  order: EditableOrder;
  schedule: BookableSchedule;
  onClose: () => void;
  onSaved: (orderNumber: string) => void;
}) {
  const preorder = order.channel === "PREORDER";
  const canMove = preorder && order.status === "CONFIRMED";

  const [name, setName] = React.useState(order.customerName);
  const [phone, setPhone] = React.useState(order.customerPhone ?? "");
  const original: HandoverChoice = {
    location: isHandoverLocation(order.handoverLocation) ? order.handoverLocation : null,
    detail: order.handoverDetail ?? "",
    date: order.serviceDate,
    windowId: order.serviceWindowId,
  };
  const [handover, setHandover] = React.useState<HandoverChoice>(original);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<{ message: string; field?: string } | null>(null);
  const fieldError = (field: string) => (error?.field === field ? error.message : undefined);

  // The order's own range is not full for this order: it is holding a place there.
  const staffSchedule = React.useMemo<BookableSchedule>(
    () => ({
      ...schedule,
      days: schedule.days.map((day) => ({
        ...day,
        windows: day.windows.map((window) =>
          window.id === order.serviceWindowId ? { ...window, isFull: false } : window,
        ),
      })),
    }),
    [schedule, order.serviceWindowId],
  );

  const handoverChanged =
    handover.location !== original.location ||
    handover.windowId !== original.windowId ||
    handover.detail.trim() !== original.detail.trim();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (canMove && handoverChanged && (!handover.location || !handover.windowId)) {
      setError({ message: "Pilih lokasi, tanggal, dan jamnya dulu ya", field: "serviceWindowId" });
      return;
    }
    setSaving(true);
    setError(null);
    const result = await updateOrderDetailsAction({
      orderId: order.id,
      customerName: name,
      customerPhone: phone,
      schedule:
        canMove && handoverChanged
          ? { handoverLocation: handover.location, handoverDetail: handover.detail, serviceWindowId: handover.windowId }
          : null,
    });
    setSaving(false);
    if (!result.ok) return setError({ message: result.error, field: result.field });
    onSaved(result.data.orderNumber);
  };

  const fieldsWithMessages = ["customerName", "customerPhone", "handoverDetail", "serviceWindowId"];

  return (
    <Sheet open onClose={onClose} title={`Ubah pesanan ${order.orderNumber}`}>
      <form onSubmit={submit} className="flex flex-col gap-4 pb-2" noValidate>
        {error && !fieldsWithMessages.includes(error.field ?? "") && (
          <div className="s-alert text-sm font-semibold">{error.message}</div>
        )}
        <Input
          label="Nama pelanggan"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={fieldError("customerName")}
          maxLength={60}
          disabled={saving}
        />
        <Input
          label="Nomor WhatsApp"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          error={fieldError("customerPhone")}
          hint={
            preorder
              ? "4 digit terakhirnya dipakai pelanggan buat lacak pesanan dan buka foto photobooth"
              : "Boleh dikosongkan untuk pesanan di booth"
          }
          disabled={saving}
        />

        {canMove ? (
          <HandoverSteps
            schedule={staffSchedule}
            value={handover}
            onChange={setHandover}
            disabled={saving}
            fieldError={fieldError}
            Step={EditStep}
            audience="staff"
            currentWindowId={order.serviceWindowId}
          />
        ) : (
          preorder && (
            <Note variant="info">
              Pelanggannya udah datang, jadi jadwal dan lokasinya nggak bisa diubah lagi.
            </Note>
          )
        )}
        {fieldError("serviceWindowId") && !canMove && <p className="text-sm text-hot">{fieldError("serviceWindowId")}</p>}

        <div className="flex flex-col gap-2 pt-1">
          <Button type="submit" variant="primary" fullWidth isLoading={saving}>
            Simpan perubahan
          </Button>
          <Button type="button" variant="flat" fullWidth onClick={onClose} disabled={saving}>
            Batal
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

function EditStep({ title, children }: { number: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}
