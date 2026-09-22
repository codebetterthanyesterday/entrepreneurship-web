"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { changePasswordAction } from "@/actions/account.actions";

export function ChangePasswordForm({ mustChange }: { mustChange: boolean }) {
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<{ message: string; field?: string } | null>(null);
  const [done, setDone] = React.useState(false);

  const fieldError = (field: string) => (error?.field === field ? error.message : undefined);
  const generalError = error && !error.field ? error.message : null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setError(null);

    const result = await changePasswordAction({ currentPassword, newPassword, confirmPassword });
    setSaving(false);

    if (!result.ok) {
      setError({ message: result.error, field: result.field });
      return;
    }

    // Cleared rather than left filled: this form is often used on a shared phone
    // propped at the booth.
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setDone(true);
    toast("Password diganti");
  };

  if (done) {
    return (
      <div>
        <p className="eyebrow text-ok">Selesai</p>
        <p className="mt-3 text-[15px] leading-relaxed text-ink">
          Password kamu sudah diganti. Pakai yang baru waktu login berikutnya — sesi yang sekarang
          tetap jalan, jadi kamu nggak perlu login ulang sekarang.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {mustChange && (
        <p className="border-l-2 border-warn bg-warn-soft/70 py-3 pl-4 pr-3 text-[13.5px] leading-relaxed text-warn">
          Akun kamu masih pakai password awal yang dibagikan ke semua pengurus, jadi siapa pun di tim
          bisa menebaknya. Ganti sekarang ya.
        </p>
      )}

      {generalError && (
        <p
          role="alert"
          className="border-l-2 border-hot bg-hot-soft/70 py-3 pl-4 pr-3 text-[13.5px] font-medium leading-relaxed text-hot"
        >
          {generalError}
        </p>
      )}

      <Input
        label="Password sekarang"
        type="password"
        autoComplete="current-password"
        value={currentPassword}
        onChange={(event) => setCurrentPassword(event.target.value)}
        error={fieldError("currentPassword")}
        disabled={saving}
      />

      <Input
        label="Password baru"
        type="password"
        autoComplete="new-password"
        hint="Minimal 8 karakter, dan jangan yang dibagikan barengan"
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        error={fieldError("newPassword")}
        disabled={saving}
      />

      <Input
        label="Ulangi password baru"
        type="password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        error={fieldError("confirmPassword")}
        disabled={saving}
      />

      <Button type="submit" isLoading={saving} className="self-start">
        Ganti password
      </Button>
    </form>
  );
}
