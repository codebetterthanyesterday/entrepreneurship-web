"use client";

import * as React from "react";
import { BRAND_NAME } from "@/lib/brand";

/**
 * The last line of defence: an error thrown by the root layout itself, before
 * any of the app's own styling or providers exist.
 *
 * `error.tsx` sits inside the root layout, so it cannot catch a failure in
 * that layout — without this file such a failure renders Next's blank screen.
 * This component replaces `<html>` wholesale, which is why the styling is
 * inline: no stylesheet is guaranteed to have loaded at this point. The colours
 * are therefore written out rather than read from tokens — they are the same
 * ink-deep field the boundary pages use, kept in step by hand because there is
 * no other way here.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          background: "#2A1620",
          color: "#FFFFFF",
          fontFamily: "system-ui, -apple-system, sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "380px" }}>
          <p
            style={{
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              margin: "0 0 14px",
              color: "#F875AA",
            }}
          >
            {BRAND_NAME}
          </p>
          <h1 style={{ fontSize: "22px", lineHeight: 1.25, margin: "0 0 10px" }}>
            Aplikasinya ngadat.
          </h1>
          <p style={{ margin: "0 0 20px", color: "rgba(255,255,255,0.72)", lineHeight: 1.6 }}>
            Ini error di luar dugaan. Coba muat ulang dulu ya — kalau masih sama, catat
            pesanannya manual dulu biar antrean di booth nggak berhenti.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              minHeight: "44px",
              padding: "0 24px",
              borderRadius: "12px",
              border: "none",
              background: "#FFFFFF",
              color: "#2A1620",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Coba lagi
          </button>
        </div>
      </body>
    </html>
  );
}
