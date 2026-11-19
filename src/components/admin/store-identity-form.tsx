"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { updateSettingsAction } from "@/actions/setting.actions";

export interface StoreIdentityFormProps {
  /** What the customer pages show now. */
  brandName: string;
  tagline: string;
  instagram: string;
  /** What an emptied field goes back to. */
  defaults: { brandName: string; tagline: string };
}

/**
 * Admin → Pengaturan → Identitas toko: the name, the one line under it and
 * the Instagram account the customer pages show in the header, the footer and
 * the splash screen. A field left empty goes back to the default; an
 * Instagram left empty takes the link out of the footer.
 */
export function StoreIdentityForm({ brandName, tagline, instagram, defaults }: StoreIdentityFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = React.useState(brandName);
  const [line, setLine] = React.useState(tagline);
  const [handle, setHandle] = React.useState(instagram ? `@${instagram}` : "");
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<{ message: string; field?: string } | null>(null);
  const fieldError = (field: string) => (error?.field === field ? error.message : undefined);

  const shownName = name.trim() || defaults.brandName;
  const shownLine = line.trim() || defaults.tagline;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    const result = await updateSettingsAction({ brandName: name, tagline: line, instagram: handle });
    setIsSaving(false);
    if (!result.ok) {
      setError({ message: result.error, field: result.field });
      return;
    }
    toast("Identitas tokonya udah disimpan!");
    router.refresh();
  };

  return (
    <section className="flex flex-col gap-2.5" aria-labelledby="store-identity-title">
      <h2 id="store-identity-title" className="s-h2">
        Identitas toko
      </h2>

      <form onSubmit={submit} className="s-slab flex flex-col gap-4 p-3.5" noValidate>
        {error && !error.field && <div className="s-alert text-sm font-semibold">{error.message}</div>}

        {/* How the header will read, as it is typed. */}
        <div aria-hidden="true" className="rounded-[12px] border-[1.5px] border-line bg-white px-3.5 py-3">
          <p className="s-eyebrow mb-1">Pratinjau header</p>
          <p className="truncate text-[17px] font-extrabold text-ink">{shownName}</p>
          <p className="truncate text-[13px] text-ink-soft">{shownLine}</p>
        </div>

        <Input
          label="Nama brand"
          value={name}
          maxLength={40}
          placeholder={defaults.brandName}
          hint={`Kosongkan untuk pakai bawaan: ${defaults.brandName}`}
          onChange={(event) => setName(event.target.value)}
          error={fieldError("brandName")}
          disabled={isSaving}
        />
        <Input
          label="Tagline"
          value={line}
          maxLength={90}
          placeholder={defaults.tagline}
          hint="Satu baris di bawah nama, di header dan layar pembuka"
          onChange={(event) => setLine(event.target.value)}
          error={fieldError("tagline")}
          disabled={isSaving}
        />
        <Input
          label="Akun Instagram"
          value={handle}
          autoCapitalize="none"
          placeholder="@bunnye.id"
          hint="Tampil di footer. Kosongkan kalau belum ada."
          onChange={(event) => setHandle(event.target.value)}
          error={fieldError("instagram")}
          disabled={isSaving}
        />

        <Button type="submit" variant="primary" isLoading={isSaving} className="self-start px-6">
          Simpan identitas
        </Button>
      </form>
    </section>
  );
}
