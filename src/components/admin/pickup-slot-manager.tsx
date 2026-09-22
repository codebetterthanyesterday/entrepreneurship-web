"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { deletePickupSlotAction, upsertPickupSlotAction } from "@/actions/setting.actions";
import type { AdminPickupSlot } from "@/types/admin";

export interface PickupSlotManagerProps {
  slots: AdminPickupSlot[];
}

export function PickupSlotManager({ slots }: PickupSlotManagerProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [quotas, setQuotas] = React.useState<Record<string, string>>({});
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [newLabel, setNewLabel] = React.useState("");
  const [newQuota, setNewQuota] = React.useState("20");
  const [newError, setNewError] = React.useState<{ message: string; field?: string } | null>(null);
  const [isAdding, setIsAdding] = React.useState(false);

  const handleSaveQuota = async (slot: AdminPickupSlot) => {
    const quota = Number(quotas[slot.id] ?? slot.quota);

    setPendingId(slot.id);
    setError(null);

    const result = await upsertPickupSlotAction({ id: slot.id, label: slot.label, quota });

    setPendingId(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast(`Kuota ${slot.label} jadi ${quota}`);
    router.refresh();
  };

  const handleDelete = async (slot: AdminPickupSlot) => {
    setPendingId(slot.id);
    setError(null);

    const result = await deletePickupSlotAction(slot.id);

    setPendingId(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast(`Slot ${slot.label} dihapus`);
    router.refresh();
  };

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();

    setIsAdding(true);
    setNewError(null);

    const result = await upsertPickupSlotAction({
      label: newLabel.trim(),
      quota: Number(newQuota.replace(/\D/g, "")),
    });

    setIsAdding(false);

    if (!result.ok) {
      setNewError({ message: result.error, field: result.field });
      return;
    }

    setNewLabel("");
    setNewQuota("20");
    toast("Slot pengambilan ditambahin!");
    router.refresh();
  };

  return (
    <section className="flex flex-col gap-2.5">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
          Slot pengambilan
        </h2>
        <p className="text-sm text-ink-soft">
          Atur jam ambil dan berapa pesanan yang muat di tiap jamnya
        </p>
      </div>

      {error && (
        <div className="bg-hot-soft text-hot text-sm font-medium p-3 rounded-[12px] border border-hot/20">
          {error}
        </div>
      )}

      {slots.length === 0 && (
        <p className="text-sm text-ink-soft bg-white border-[1.5px] border-line rounded-[16px] p-4 text-center">
          Belum ada slot pengambilan. Tambah di bawah ya.
        </p>
      )}

      {slots.map((slot) => {
        const isPending = pendingId === slot.id;
        const isDirty = (quotas[slot.id] ?? String(slot.quota)) !== String(slot.quota);

        return (
          <div
            key={slot.id}
            className="flex items-center gap-2.5 bg-white border-[1.5px] border-line rounded-[16px] p-3"
          >
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-ink truncate">{slot.label}</span>
              <span className="block text-xs font-medium text-ink-soft">
                {slot.booked > 0 ? `${slot.booked} dari ${slot.quota} terisi` : "Masih kosong"}
              </span>
            </span>

            <input
              inputMode="numeric"
              aria-label={`Kuota slot ${slot.label}`}
              value={quotas[slot.id] ?? String(slot.quota)}
              disabled={isPending}
              onChange={(event) =>
                setQuotas((current) => ({
                  ...current,
                  [slot.id]: event.target.value.replace(/\D/g, ""),
                }))
              }
              className="w-[68px] min-h-[44px] text-center bg-cream border-[1.5px] border-line rounded-[12px] text-ink text-[16px] focus:border-pink"
            />

            <Button
              size="sm"
              variant={isDirty ? "primary" : "flat"}
              disabled={!isDirty || isPending}
              onClick={() => handleSaveQuota(slot)}
              className="px-3"
            >
              Simpan
            </Button>

            <button
              type="button"
              aria-label={`Hapus slot ${slot.label}`}
              disabled={isPending}
              onClick={() => handleDelete(slot)}
              className="w-[44px] h-[44px] flex-none flex items-center justify-center rounded-[12px] border-[1.5px] border-line text-ink-soft hover:border-hot hover:text-hot transition-colors disabled:opacity-50"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M3 4h10M6.5 4V2.8h3V4M4.2 4l.6 8.4c0 .5.4.8.9.8h4.6c.5 0 .9-.3.9-.8L11.8 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        );
      })}

      <form
        onSubmit={handleAdd}
        className="flex flex-col gap-3 bg-white border-[1.5px] border-dashed border-line rounded-[16px] p-3.5"
      >
        <div className="flex flex-col tablet:flex-row gap-3">
          <Input
            label="Slot baru"
            placeholder="Misal: 13.00 - 14.00"
            value={newLabel}
            onChange={(event) => setNewLabel(event.target.value)}
            error={newError?.field === "label" ? newError.message : undefined}
            disabled={isAdding}
          />
          <Input
            label="Kuota"
            inputMode="numeric"
            value={newQuota}
            onChange={(event) => setNewQuota(event.target.value.replace(/\D/g, ""))}
            error={newError?.field === "quota" ? newError.message : undefined}
            disabled={isAdding}
            className="tablet:w-[100px]"
          />
        </div>

        {newError && !newError.field && <p className="text-sm text-hot">{newError.message}</p>}

        <Button type="submit" size="sm" variant="ghost" isLoading={isAdding}>
          + Tambah slot
        </Button>
      </form>
    </section>
  );
}
