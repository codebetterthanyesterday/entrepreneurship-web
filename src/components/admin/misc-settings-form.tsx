"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { updateSettingsAction } from "@/actions/setting.actions";
import { clockLabel } from "@/lib/schedule";
import { toWhatsappNumber } from "@/lib/whatsapp";

const toMinute = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
};
const toClock = (minute: number) => clockLabel(minute).replace(".", ":");

export interface MiscSettingsFormProps {
  lowStockThreshold: number;
  adminWhatsapp: string | null;
  chatOpenMinute: number;
  chatCloseMinute: number;
}

export function MiscSettingsForm({
  lowStockThreshold,
  adminWhatsapp,
  chatOpenMinute,
  chatCloseMinute,
}: MiscSettingsFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [threshold, setThreshold] = React.useState(String(lowStockThreshold));
  const [whatsapp, setWhatsapp] = React.useState(adminWhatsapp ?? "");
  const [chatOpen, setChatOpen] = React.useState(toClock(chatOpenMinute));
  const [chatClose, setChatClose] = React.useState(toClock(chatCloseMinute));
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<{ message: string; field?: string } | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setIsSaving(true);
    setError(null);

    const result = await updateSettingsAction({
      lowStockThreshold: Number(threshold.replace(/\D/g, "") || "0"),
      adminWhatsapp: whatsapp.trim(),
      chatOpenMinute: toMinute(chatOpen),
      chatCloseMinute: toMinute(chatClose),
    });

    setIsSaving(false);

    if (!result.ok) {
      setError({ message: result.error, field: result.field });
      return;
    }

    toast("Pengaturannya udah disimpan!");
    router.refresh();
  };

  const fieldError = (field: string) => (error?.field === field ? error.message : undefined);

  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="s-h2">
        Lain-lain
      </h2>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 s-slab p-3.5"
      >
        {error && !error.field && (
          <div className="s-alert text-sm font-semibold">
            {error.message}
          </div>
        )}

        <Input
          label="Ambang stok menipis"
          inputMode="numeric"
          hint="Menu dengan stok segini atau kurang bakal ditandai menipis"
          value={threshold}
          onChange={(event) => setThreshold(event.target.value.replace(/\D/g, ""))}
          error={fieldError("lowStockThreshold")}
          disabled={isSaving}
        />

        <Input
          label="Nomor WhatsApp tim"
          inputMode="tel"
          placeholder="081234567890"
          hint="Tujuan semua tombol chat di web. Boleh WhatsApp biasa atau WhatsApp Business."
          value={whatsapp}
          onChange={(event) => setWhatsapp(event.target.value)}
          error={fieldError("adminWhatsapp")}
          disabled={isSaving}
        />

        {!toWhatsappNumber(adminWhatsapp) && (
          <p role="status" className="s-alert text-[13px]">
            Belum ada nomor yang bisa dipakai, jadi tombol chat WhatsApp di web pengunjung
            disembunyikan dulu.
          </p>
        )}

        <fieldset className="flex flex-col gap-2" disabled={isSaving}>
          <legend className="text-[13px] font-semibold text-ink">Jam balas chat (WIB)</legend>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Mulai"
              type="time"
              step={900}
              value={chatOpen}
              onChange={(event) => setChatOpen(event.target.value)}
              error={fieldError("chatOpenMinute")}
            />
            <Input
              label="Selesai"
              type="time"
              step={900}
              value={chatClose}
              onChange={(event) => setChatClose(event.target.value)}
              error={fieldError("chatCloseMinute")}
            />
          </div>
          <p className="text-[12.5px] text-ink-soft">
            Di luar jam ini tombol chat tetap ada, dan pengunjung dikasih tahu kapan dibalas.
          </p>
        </fieldset>

        <Button type="submit" variant="primary" size="sm" isLoading={isSaving} className="self-start px-6">
          Simpan
        </Button>
      </form>
    </section>
  );
}
