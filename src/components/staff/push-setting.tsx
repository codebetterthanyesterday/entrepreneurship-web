"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

/**
 * "Notifikasi di HP ini" (inbox phase 3): push notifications that reach this
 * phone with the app closed, for the moments something needs a person.
 *
 * Every state a phone can be in is said plainly, because each needs a
 * different thing from the person: an iPhone must add the app to its home
 * screen first (iOS allows push to nothing else), a refused permission can
 * only be undone in the phone's settings, and so on.
 */
type Status =
  | { kind: "checking" }
  | { kind: "needs-install" }
  | { kind: "unsupported" }
  | { kind: "server-off" }
  | { kind: "denied" }
  | { kind: "off"; publicKey: string }
  | { kind: "on"; subscription: PushSubscription }
  | { kind: "working" };

const SW_URL = "/inbox/sw.js";

function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

function isInstalled(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

/** The VAPID key as the browser wants it. */
function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function readStatus(): Promise<Status> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return isIos() && !isInstalled() ? { kind: "needs-install" } : { kind: "unsupported" };
  }
  const answer = (await fetch("/api/staff/push", { cache: "no-store" })
    .then((response) => response.json())
    .catch(() => null)) as { ok: boolean; data?: { publicKey: string | null } } | null;
  const publicKey = answer?.ok ? answer.data?.publicKey : null;
  if (!publicKey) return { kind: "server-off" };
  if (Notification.permission === "denied") return { kind: "denied" };
  const registration = await navigator.serviceWorker.register(SW_URL, { scope: "/" });
  const subscription = await registration.pushManager.getSubscription();
  return subscription ? { kind: "on", subscription } : { kind: "off", publicKey };
}

export function PushSetting() {
  const [status, setStatus] = React.useState<Status>({ kind: "checking" });
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true;
    readStatus()
      .then((next) => live && setStatus(next))
      .catch(() => live && setStatus({ kind: "unsupported" }));
    return () => {
      live = false;
    };
  }, []);

  const turnOn = async (publicKey: string) => {
    setError(null);
    setStatus({ kind: "working" });
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? { kind: "denied" } : { kind: "off", publicKey });
        return;
      }
      const registration = await navigator.serviceWorker.register(SW_URL, { scope: "/" });
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(publicKey),
      });
      const saved = await fetch("/api/staff/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!saved.ok) throw new Error(String(saved.status));
      setStatus({ kind: "on", subscription });
    } catch {
      setError("Notifikasinya belum bisa dinyalakan. Cek sinyal, lalu coba lagi.");
      setStatus({ kind: "off", publicKey });
    }
  };

  const turnOff = async (subscription: PushSubscription) => {
    setError(null);
    setStatus({ kind: "working" });
    await fetch("/api/staff/push", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => null);
    await subscription.unsubscribe().catch(() => false);
    setStatus(await readStatus().catch((): Status => ({ kind: "unsupported" })));
  };

  return (
    <section aria-labelledby="push-setting-title" className="s-slab flex flex-col gap-2 p-3.5">
      <h2 id="push-setting-title" className="text-sm font-bold text-ink">
        Notifikasi di HP ini
      </h2>
      <p className="text-[12.5px] leading-snug text-ink-soft" role="status">
        {status.kind === "checking" && "Lagi ngecek HP ini…"}
        {status.kind === "working" && "Sebentar…"}
        {status.kind === "on" &&
          "Aktif. HP ini dapat notifikasi waktu bukti QRIS masuk, ada pesanan “Lainnya”, atau pesanan siap diserahkan, walau aplikasinya ditutup."}
        {status.kind === "off" &&
          "Dapat kabar walau aplikasinya ditutup: bukti QRIS masuk, pesanan “Lainnya”, pesanan siap diserahkan."}
        {status.kind === "needs-install" &&
          "Di iPhone, pasang dulu aplikasinya: buka di Safari, ketuk Bagikan → Tambahkan ke Layar Utama, lalu buka Inbox dari ikon itu."}
        {status.kind === "unsupported" && "Browser ini belum bisa menerima notifikasi. Coba di Chrome (Android) atau Safari (iPhone)."}
        {status.kind === "server-off" && "Notifikasi belum disiapkan di server. Bunyi & getar di atas tetap jalan."}
        {status.kind === "denied" &&
          "Notifikasi diblokir di HP ini. Izinkan lagi lewat pengaturan situs di browser, lalu muat ulang halaman ini."}
      </p>
      {error && (
        <p role="alert" className="text-sm font-semibold text-hot">
          {error}
        </p>
      )}
      {status.kind === "off" && (
        <Button size="sm" variant="primary" onClick={() => void turnOn(status.publicKey)}>
          Nyalakan notifikasi
        </Button>
      )}
      {status.kind === "on" && (
        <Button size="sm" variant="flat" onClick={() => void turnOff(status.subscription)}>
          Matikan notifikasi di HP ini
        </Button>
      )}
    </section>
  );
}
