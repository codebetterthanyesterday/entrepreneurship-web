"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { updateSettingsAction } from "@/actions/setting.actions";

export interface MiscSettingsFormProps {
  lowStockThreshold: number;
  adminWhatsapp: string | null;
  qrisImageUrl: string | null;
}

export function MiscSettingsForm({
  lowStockThreshold,
  adminWhatsapp,
  qrisImageUrl,
}: MiscSettingsFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [threshold, setThreshold] = React.useState(String(lowStockThreshold));
  const [whatsapp, setWhatsapp] = React.useState(adminWhatsapp ?? "");
  const [qrisUrl, setQrisUrl] = React.useState(qrisImageUrl ?? "");
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<{ message: string; field?: string } | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setIsSaving(true);
    setError(null);

    const result = await updateSettingsAction({
      lowStockThreshold: Number(threshold.replace(/\D/g, "") || "0"),
      adminWhatsapp: whatsapp.trim(),
      qrisImageUrl: qrisUrl.trim(),
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
      <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
        Lain-lain
      </h2>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 bg-white border-[1.5px] border-line rounded-[16px] p-3.5"
      >
        {error && !error.field && (
          <div className="bg-hot-soft text-hot text-sm font-medium p-3 rounded-[12px] border border-hot/20">
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
          label="Nomor WhatsApp admin"
          inputMode="tel"
          placeholder="081234567890"
          hint="Dipakai pelanggan buat nanya soal pesanannya"
          value={whatsapp}
          onChange={(event) => setWhatsapp(event.target.value)}
          error={fieldError("adminWhatsapp")}
          disabled={isSaving}
        />

        <Input
          label="Link gambar QRIS"
          placeholder="https://..."
          hint="Sementara isi link gambarnya dulu ya, upload file nyusul"
          value={qrisUrl}
          onChange={(event) => setQrisUrl(event.target.value)}
          error={fieldError("qrisImageUrl")}
          disabled={isSaving}
        />

        {qrisUrl.trim() !== "" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrisUrl}
            alt="Pratinjau gambar QRIS"
            className="w-[120px] h-[120px] object-contain rounded-[12px] border-[1.5px] border-line bg-cream"
          />
        )}

        <Button type="submit" variant="primary" size="sm" isLoading={isSaving} className="self-start px-6">
          Simpan
        </Button>
      </form>
    </section>
  );
}
