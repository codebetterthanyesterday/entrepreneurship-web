// @vitest-environment jsdom
import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ExportPanel } from "@/components/admin/export-panel";

afterEach(cleanup);

describe("ExportPanel", () => {
  it("offers the old photobooth charges only while there are some (K-14)", () => {
    render(<ExportPanel photobooth={false} />);
    expect(screen.queryByText(/Tagihan photobooth/)).toBeNull();
    expect(screen.getByText("Daftar pesanan")).toBeDefined();

    cleanup();
    render(<ExportPanel photobooth />);
    const link = screen.getByText(/Tagihan photobooth/).closest("a");
    expect(link?.getAttribute("href")).toBe("/api/admin/export?type=photobooth");
    expect(screen.queryByText(/Cetak foto dan HD yang dibayar di booth photobooth/)).toBeNull();
  });
});
