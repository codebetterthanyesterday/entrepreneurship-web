// @vitest-environment jsdom
import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProductGallery } from "@/components/public/product-gallery";

afterEach(cleanup);

describe("ProductGallery", () => {
  it("names every photo and says which one is showing", () => {
    // jsdom does no layout or scrolling; give the track a stand-in for both.
    Element.prototype.scrollTo = function () {};
    render(<ProductGallery name="Es Kopi Aren" images={["/gambar/a", "/gambar/b", "/gambar/c"]} />);

    expect(screen.getByRole("img", { name: "Es Kopi Aren, foto 1 dari 3" })).toBeDefined();
    expect(screen.getByRole("img", { name: "Es Kopi Aren, foto 3 dari 3" })).toBeDefined();
    expect(screen.getByText("1/3")).toBeDefined();
    expect((screen.getByRole("button", { name: "Foto sebelumnya" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Foto berikutnya" }));
    expect(screen.getByText("2/3")).toBeDefined();
  });
});
