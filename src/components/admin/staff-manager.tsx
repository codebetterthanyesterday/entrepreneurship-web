"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/use-toast";
import { createStaffAction, resetStaffPasswordAction, updateStaffAction } from "@/actions/staff.actions";
import type { IssuedPassword, StaffAccount } from "@/lib/services/staff.service";
import { cn } from "@/lib/utils";

const ROLES = [
  { value: "KASIR", label: "Kasir" },
  { value: "DAPUR", label: "Dapur" },
  { value: "ADMIN", label: "Admin" },
] as const;
type Role = (typeof ROLES)[number]["value"];
const ROLE_LABEL: Record<Role, string> = { KASIR: "Kasir", DAPUR: "Dapur", ADMIN: "Admin" };

export interface StaffManagerProps {
  accounts: StaffAccount[];
  /** The signed-in admin, who cannot switch themselves off or change their own role. */
  selfId: string;
  /** The full sign-in address, to hand over with a new password. */
  loginUrl: string;
}

type Editing = { mode: "create" } | { mode: "edit"; account: StaffAccount };

/**
 * Admin → Staf: every staff account, and what an admin can do with one. Add a
 * kasir, dapur or admin; change a name, email or role; switch an account off
 * (it is signed out everywhere at once) or back on; reset a forgotten
 * password. A new or reset password is shown here once, to be handed over in
 * person, and the account must change it at the next sign-in.
 */
export function StaffManager({ accounts, selfId, loginUrl }: StaffManagerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState<Editing | null>(null);
  const [issued, setIssued] = React.useState<IssuedPassword | null>(null);
  const [confirmingReset, setConfirmingReset] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const reset = async (account: StaffAccount) => {
    setBusy(account.id);
    const result = await resetStaffPasswordAction(account.id);
    setBusy(null);
    setConfirmingReset(null);
    if (!result.ok) {
      toast(result.error);
      return;
    }
    setIssued(result.data);
    router.refresh();
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          {accounts.filter((account) => account.isActive).length} akun aktif dari {accounts.length}
        </p>
        <Button variant="primary" size="sm" onClick={() => setEditing({ mode: "create" })}>
          Tambah staf
        </Button>
      </div>

      <ul className="flex flex-col gap-2.5" aria-label="Akun staf">
        {accounts.map((account) => {
          const self = account.id === selfId;
          return (
            <li key={account.id} className={cn("s-slab flex flex-col gap-2.5 p-3.5", !account.isActive && "opacity-70")}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-extrabold text-[15px] text-ink">
                    {account.name}
                    {self && <span className="ml-2 text-[12px] font-semibold text-ink-soft">(kamu)</span>}
                  </p>
                  <p className="break-all text-[13px] text-ink-soft">{account.email}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="info">{ROLE_LABEL[account.role as Role] ?? account.role}</Badge>
                  {!account.isActive && <Badge variant="muted">Nonaktif</Badge>}
                  {account.isActive && account.mustChangePassword && <Badge variant="prep">Belum ganti password</Badge>}
                </div>
              </div>

              {confirmingReset === account.id ? (
                <div className="flex flex-col gap-2 rounded-[12px] bg-warn-soft p-3 text-[13px] text-warn">
                  <p>
                    Reset password {account.name}? Password lamanya langsung nggak berlaku, dan dia keluar dari semua
                    perangkat.
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="primary" isLoading={busy === account.id} onClick={() => void reset(account)}>
                      Ya, reset
                    </Button>
                    <Button size="sm" variant="flat" onClick={() => setConfirmingReset(null)}>
                      Batal
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="flat"
                    aria-label={`Ubah akun ${account.name}`}
                    onClick={() => setEditing({ mode: "edit", account })}
                  >
                    Ubah
                  </Button>
                  {!self && account.isActive && (
                    <Button
                      size="sm"
                      variant="flat"
                      aria-label={`Reset password ${account.name}`}
                      onClick={() => setConfirmingReset(account.id)}
                    >
                      Reset password
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {editing && (
        <StaffFormSheet
          editing={editing}
          selfId={selfId}
          onClose={() => setEditing(null)}
          onCreated={(result) => {
            setEditing(null);
            setIssued(result);
            router.refresh();
          }}
          onSaved={(message) => {
            setEditing(null);
            toast(message);
            router.refresh();
          }}
        />
      )}

      {issued && <IssuedPasswordSheet issued={issued} loginUrl={loginUrl} onClose={() => setIssued(null)} />}
    </section>
  );
}

function StaffFormSheet({
  editing,
  selfId,
  onClose,
  onCreated,
  onSaved,
}: {
  editing: Editing;
  selfId: string;
  onClose: () => void;
  onCreated: (issued: IssuedPassword) => void;
  onSaved: (message: string) => void;
}) {
  const account = editing.mode === "edit" ? editing.account : null;
  const self = account?.id === selfId;
  const [name, setName] = React.useState(account?.name ?? "");
  const [email, setEmail] = React.useState(account?.email ?? "");
  const [role, setRole] = React.useState<Role>((account?.role as Role) ?? "KASIR");
  const [isActive, setIsActive] = React.useState(account?.isActive ?? true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<{ message: string; field?: string } | null>(null);
  const fieldError = (field: string) => (error?.field === field ? error.message : undefined);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    if (!account) {
      const result = await createStaffAction({ name, email, role });
      setSaving(false);
      if (!result.ok) return setError({ message: result.error, field: result.field });
      onCreated(result.data);
      return;
    }
    const result = await updateStaffAction({ id: account.id, name, email, role, isActive });
    setSaving(false);
    if (!result.ok) return setError({ message: result.error, field: result.field });
    onSaved(
      account.isActive && !isActive
        ? `${result.data.name} dinonaktifkan dan keluar dari semua perangkat`
        : !account.isActive && isActive
          ? `${result.data.name} aktif lagi`
          : "Akunnya udah disimpan",
    );
  };

  return (
    <Sheet open onClose={onClose} title={account ? "Ubah akun" : "Tambah staf"}>
      <form onSubmit={submit} className="flex flex-col gap-4 pb-2">
        {error && !error.field && <div className="s-alert text-sm font-semibold">{error.message}</div>}
        <Input label="Nama" value={name} onChange={(event) => setName(event.target.value)} error={fieldError("name")} disabled={saving} />
        <Input
          label="Email"
          type="email"
          autoCapitalize="none"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldError("email")}
          hint="Dipakai buat masuk"
          disabled={saving}
        />

        <fieldset className="flex flex-col gap-1.5" disabled={saving || self}>
          <legend className="text-sm font-medium text-ink">Peran</legend>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={role === option.value}
                onClick={() => setRole(option.value)}
                className={cn(
                  "min-h-[46px] rounded-[14px] border-[1.5px] text-sm font-medium transition-colors disabled:opacity-60",
                  role === option.value ? "bg-pink-soft border-pink text-pink-deep" : "bg-white border-line text-ink-soft hover:bg-cream",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          {fieldError("role") && <p className="text-sm text-hot">{fieldError("role")}</p>}
          {self && <p className="text-[12.5px] text-ink-soft">Peran dan status akunmu sendiri nggak bisa kamu ubah.</p>}
        </fieldset>

        {account && !self && (
          <fieldset className="flex flex-col gap-1.5" disabled={saving}>
            <legend className="text-sm font-medium text-ink">Status</legend>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: true, label: "Aktif" },
                { value: false, label: "Nonaktif" },
              ].map((option) => (
                <button
                  key={String(option.value)}
                  type="button"
                  aria-pressed={isActive === option.value}
                  onClick={() => setIsActive(option.value)}
                  className={cn(
                    "min-h-[46px] rounded-[14px] border-[1.5px] text-sm font-medium transition-colors",
                    isActive === option.value ? "bg-pink-soft border-pink text-pink-deep" : "bg-white border-line text-ink-soft hover:bg-cream",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-[12.5px] text-ink-soft">
              Akun nonaktif nggak bisa masuk dan langsung keluar dari semua perangkat. Namanya tetap tercatat di riwayat
              pesanan.
            </p>
          </fieldset>
        )}

        {!account && (
          <p className="text-[12.5px] text-ink-soft">
            Password sementara dibuat otomatis dan tampil sekali setelah disimpan. Dia wajib menggantinya saat pertama masuk.
          </p>
        )}

        <div className="flex flex-col gap-2 pt-1">
          <Button type="submit" variant="primary" fullWidth isLoading={saving}>
            {account ? "Simpan" : "Buat akun"}
          </Button>
          <Button type="button" variant="flat" fullWidth onClick={onClose} disabled={saving}>
            Batal
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

function IssuedPasswordSheet({
  issued,
  loginUrl,
  onClose,
}: {
  issued: IssuedPassword;
  loginUrl: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const copy = async () => {
    const text = `Akun ${issued.account.name}\nMasuk di: ${loginUrl}\nEmail: ${issued.account.email}\nPassword sementara: ${issued.password}\n(Wajib diganti saat pertama masuk)`;
    try {
      await navigator.clipboard.writeText(text);
      toast("Disalin. Kirim lewat chat pribadi, bukan grup");
    } catch {
      toast("Nggak bisa menyalin otomatis; catat manual ya");
    }
  };

  return (
    <Sheet open onClose={onClose} title="Password sementara">
      <div className="flex flex-col gap-3 pb-2">
        <p className="text-sm text-ink-soft">
          Untuk <b className="text-ink">{issued.account.name}</b> ({issued.account.email}). Cuma tampil sekali ini; setelah
          ditutup nggak bisa dilihat lagi.
        </p>
        <p
          className="rounded-[14px] border-[1.5px] border-line bg-cream px-4 py-3 text-center font-mono text-[22px] font-bold tracking-wider text-ink"
          aria-label={`Password sementara: ${issued.password.split("").join(" ")}`}
        >
          {issued.password}
        </p>
        <p className="break-all text-[13px] text-ink-soft">
          Masuk di <b className="text-ink">{loginUrl}</b>. Dia wajib mengganti password-nya setelah masuk.
        </p>
        <Button variant="primary" fullWidth onClick={() => void copy()}>
          Salin buat dikirim
        </Button>
        <Button variant="flat" fullWidth onClick={onClose}>
          Udah dicatat, tutup
        </Button>
      </div>
    </Sheet>
  );
}
