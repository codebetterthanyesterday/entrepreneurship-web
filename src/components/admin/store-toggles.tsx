"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { updateSettingsAction } from "@/actions/setting.actions";

type ChannelKey = "preorderOpen" | "boothOpen";

export interface StoreTogglesProps {
  preorderOpen: boolean;
  boothOpen: boolean;
}

const COPY: Record<
  ChannelKey,
  { title: string; on: string; off: string; toastOn: string; toastOff: string; ariaLabel: string }
> = {
  preorderOpen: {
    title: "Preorder dibuka",
    on: "Pelanggan masih bisa pesan dari rumah",
    off: "Form preorder ditutup, tinggal beli di tempat",
    toastOn: "Preorder dibuka lagi",
    toastOff: "Preorder ditutup",
    ariaLabel: "Buka atau tutup preorder",
  },
  boothOpen: {
    title: "Booth buka",
    on: "Kasir bisa terima pesanan di tempat",
    off: "Booth tutup, kasir nggak bisa input pesanan",
    toastOn: "Booth dibuka",
    toastOff: "Booth ditutup",
    ariaLabel: "Buka atau tutup booth",
  },
};

export function StoreToggles({ preorderOpen, boothOpen }: StoreTogglesProps) {
  const router = useRouter();
  const { toast } = useToast();

  // Flip immediately, then roll back if the server refuses — there is no save
  // button, so the switch itself has to read as the confirmation.
  const [values, setValues] = React.useState({ preorderOpen, boothOpen });
  const [pending, setPending] = React.useState<ChannelKey | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleToggle = async (key: ChannelKey, next: boolean) => {
    const previous = values[key];

    setValues((current) => ({ ...current, [key]: next }));
    setPending(key);
    setError(null);

    const result = await updateSettingsAction({ [key]: next });

    setPending(null);

    if (!result.ok) {
      setValues((current) => ({ ...current, [key]: previous }));
      setError(result.error);
      return;
    }

    toast(next ? COPY[key].toastOn : COPY[key].toastOff);
    router.refresh();
  };

  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
        Atur toko
      </h2>

      {error && (
        <div className="bg-hot-soft text-hot text-sm font-medium p-3 rounded-[12px] border border-hot/20">
          {error}
        </div>
      )}

      {(Object.keys(COPY) as ChannelKey[]).map((key) => (
        <div
          key={key}
          className="flex items-center justify-between gap-3 bg-white border-[1.5px] border-line rounded-[16px] p-3.5"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{COPY[key].title}</p>
            <p className="text-xs font-medium text-ink-soft">
              {values[key] ? COPY[key].on : COPY[key].off}
            </p>
          </div>

          <Switch
            checked={values[key]}
            disabled={pending === key}
            onCheckedChange={(next) => handleToggle(key, next)}
            aria-label={COPY[key].ariaLabel}
          />
        </div>
      ))}
    </section>
  );
}
