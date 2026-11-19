"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cameraErrorMessage, createQrReader } from "@/lib/qr-reader";

export interface QrScannerProps {
  open: boolean;
  onClose: () => void;
  /**
   * Called with each QR the camera reads. Returns `null` once it has dealt with
   * it (the caller then closes the scanner), or a message to show while the
   * scanner keeps looking.
   */
  onScan: (text: string) => string | null;
}

/** How often a frame is read. Quick enough to feel instant, light on a phone's battery. */
const FRAME_INTERVAL_MS = 150;
/** The same QR held in view is answered once, not on every frame. */
const SAME_CODE_PAUSE_MS = 2500;

/**
 * The cashier's ticket scanner: the back camera in a sheet, reading QR codes
 * until one is an order the counter can open.
 *
 * The camera runs only while the sheet is open. Closing it, or the cashier
 * switching away, stops every track so the phone's camera light goes out.
 */
export function QrScanner({ open, onClose, onScan }: QrScannerProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Scan QR tiket">
      {/* Mounted afresh each time, so every opening starts the camera clean. */}
      {open && <ScannerBody onClose={onClose} onScan={onScan} />}
    </Sheet>
  );
}

type CameraState = { kind: "starting" } | { kind: "scanning" } | { kind: "failed"; message: string };

function ScannerBody({ onClose, onScan }: Omit<QrScannerProps, "open">) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = React.useState<CameraState>({ kind: "starting" });
  const [notice, setNotice] = React.useState<string | null>(null);

  // The latest handler, without restarting the camera every time it changes.
  const onScanRef = React.useRef(onScan);
  React.useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  React.useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastText = "";
    let lastAt = 0;

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new DOMException("No camera API", "NotFoundError");
      }
      const [media, read] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        }),
        createQrReader(),
      ]);
      if (stopped) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = media;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = media;
      await video.play().catch(() => {});
      setCamera({ kind: "scanning" });

      const tick = async () => {
        if (stopped) return;
        const text = await read(video).catch(() => null);
        if (stopped) return;
        const now = Date.now();
        if (text && (text !== lastText || now - lastAt > SAME_CODE_PAUSE_MS)) {
          lastText = text;
          lastAt = now;
          const message = onScanRef.current(text);
          if (message === null) return;
          setNotice(message);
        }
        timer = setTimeout(tick, FRAME_INTERVAL_MS);
      };
      void tick();
    };

    start().catch((error: unknown) => {
      if (!stopped) setCamera({ kind: "failed", message: cameraErrorMessage(error) });
    });

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-[16px] bg-ink-deep">
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label="Kamera untuk scan QR tiket"
          className="h-full w-full object-cover"
        />
        {camera.kind === "scanning" && (
          // Where to hold the ticket. Decoration: the whole frame is read.
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-[18%] rounded-[14px] border-[3px] border-white/85 shadow-[0_0_0_999px_rgba(0,0,0,0.28)]"
          />
        )}
        {camera.kind === "starting" && (
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-[14px] text-white/85">
            Lagi buka kamera…
          </p>
        )}
      </div>

      <p role="status" className="min-h-[2.6em] text-[14px] leading-snug">
        {camera.kind === "failed" ? (
          <span className="font-semibold text-hot">{camera.message}</span>
        ) : notice ? (
          <span className="font-semibold text-warn">{notice}</span>
        ) : (
          <span className="text-ink-soft">
            Arahkan ke QR di tiket pesanan pelanggan. Pesanannya kebuka sendiri begitu kebaca.
          </span>
        )}
      </p>

      <Button variant="flat" onClick={onClose} fullWidth>
        Tutup
      </Button>
    </div>
  );
}
