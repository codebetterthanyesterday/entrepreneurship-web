// @vitest-environment jsdom
import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ExportPanel } from "@/components/admin/export-panel";

afterEach(cleanup);

describe("ExportPanel", () => {
  it("offers the three reports, each as a download link", () => {
    render(<ExportPanel />);
    for (const [label, type] of [
      ["Daftar pesanan", "orders"],
      ["Rincian item", "items"],
      ["Rekap per menu", "products"],
    ]) {
      expect(screen.getByText(label!).closest("a")?.getAttribute("href")).toBe(`/api/admin/export?type=${type}`);
    }
    expect(screen.queryByText(/photobooth/i)).toBeNull();
  });
});
