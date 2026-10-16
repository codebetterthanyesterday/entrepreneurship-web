// @vitest-environment jsdom
import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PhotoboothQr } from "@/components/public/photobooth-qr";

const LINK = "https://bunnye-photobooth.vercel.app/foto?kode=PO-0042";

afterEach(cleanup);

describe("PhotoboothQr", () => {
  it("draws a QR code with the order number printed under it", () => {
    const { container } = render(<PhotoboothQr link={LINK} orderNumber="PO-0042" direct={false} />);

    expect(container.querySelector("svg")).not.toBeNull();
    expect(screen.getByText("PO-0042")).toBeDefined();
  });

  it("offers the same link to tap on this phone", () => {
    render(<PhotoboothQr link={LINK} orderNumber="PO-0042" direct={false} />);

    const links = screen.getAllByRole("link");
    expect(links.every((link) => link.getAttribute("href") === LINK)).toBe(true);
    expect(screen.getByRole("link", { name: "Buka foto saya" })).toBeDefined();
  });

  it("says whether the digits will still be asked for", () => {
    const { rerender } = render(<PhotoboothQr link={LINK} orderNumber="PO-0042" direct={false} />);
    expect(screen.getByText(/isi 4 digit terakhir WhatsApp/)).toBeDefined();

    rerender(<PhotoboothQr link={`${LINK}&t=abc`} orderNumber="PO-0042" direct />);
    expect(screen.getByText(/langsung tanpa isi kode lagi/)).toBeDefined();
  });
});
