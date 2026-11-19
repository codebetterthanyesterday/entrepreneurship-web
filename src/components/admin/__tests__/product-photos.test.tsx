// @vitest-environment jsdom
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  move: vi.fn<(input: unknown) => Promise<{ ok: true; data: { moved: true } }>>(async () => ({ ok: true, data: { moved: true } })),
  remove: vi.fn<(input: unknown) => Promise<{ ok: true; data: { removed: true } }>>(async () => ({ ok: true, data: { removed: true } })),
}));
vi.mock("@/actions/product.actions", () => ({
  moveProductImageAction: (input: unknown) => actions.move(input),
  removeProductImageAction: (input: unknown) => actions.remove(input),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { ProductPhotos } = await import("@/components/admin/product-photos");
const { ToastProvider } = await import("@/components/ui/use-toast");

afterEach(() => {
  cleanup();
  actions.move.mockClear();
  actions.remove.mockClear();
});

const IMAGES = [
  { id: "11111111-1111-4111-8111-111111111111", url: "/gambar/1" },
  { id: "22222222-2222-4222-8222-222222222222", url: "/gambar/2" },
];

function renderPhotos(images = IMAGES) {
  render(
    <ToastProvider>
      <ProductPhotos productId="p1" productName="Es Kopi Aren" images={images} />
    </ToastProvider>,
  );
}

describe("ProductPhotos", () => {
  it("marks the first photo as the cover, and cannot move it further forward", () => {
    renderPhotos();

    expect(screen.getByText("Sampul")).toBeDefined();
    expect(screen.getByText("2 dari 6")).toBeDefined();
    expect((screen.getByRole("button", { name: "Geser foto 1 ke depan" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Geser foto 2 ke belakang" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("moves a photo forward, which makes it the cover on the server", async () => {
    renderPhotos();

    fireEvent.click(screen.getByRole("button", { name: "Geser foto 2 ke depan" }));

    await waitFor(() => expect(actions.move).toHaveBeenCalledWith({ productId: "p1", imageId: IMAGES[1]!.id, by: -1 }));
  });

  it("asks before deleting, and deletes only on the second tap", async () => {
    renderPhotos();

    fireEvent.click(screen.getByRole("button", { name: "Hapus foto 1" }));
    expect(actions.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Hapus" }));

    await waitFor(() => expect(actions.remove).toHaveBeenCalledWith({ productId: "p1", imageId: IMAGES[0]!.id }));
  });

  it("tells an admin with no photos that the drawing is used until they add one", () => {
    renderPhotos([]);

    expect(screen.getByText(/katalog memakai gambar bawaan/)).toBeDefined();
    expect(screen.getByText("Tambah foto")).toBeDefined();
  });
});
