// @vitest-environment jsdom
import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/product.actions", () => ({
  moveProductImageAction: vi.fn(),
  removeProductImageAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { ProductFormSheet } = await import("@/components/admin/product-form-sheet");
const { ToastProvider } = await import("@/components/ui/use-toast");

afterEach(cleanup);

const PRODUCT = {
  id: "p1",
  name: "Es Kopi Aren",
  price: 18_000,
  stock: 10,
  prepType: "NEEDS_PREP" as const,
  isActive: true,
  imageUrl: null,
  images: [],
  categoryId: null,
  categoryName: null,
  sold: 0,
};

function sheet(product: typeof PRODUCT | null, onDelete: () => void, error: { message: string } | null = null) {
  return (
    <ToastProvider>
      <ProductFormSheet
        open
        product={product}
        categories={[]}
        isSaving={false}
        error={error}
        onClose={() => {}}
        onSubmit={() => {}}
        onDelete={onDelete}
      />
    </ToastProvider>
  );
}

function renderSheet(product: typeof PRODUCT | null) {
  const onDelete = vi.fn();
  render(sheet(product, onDelete));
  return onDelete;
}

describe("ProductFormSheet: deleting a menu item", () => {
  it("takes two taps: the first only asks to be sure", () => {
    const onDelete = renderSheet(PRODUCT);

    fireEvent.click(screen.getByRole("button", { name: "Hapus menu" }));
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Yakin? Ketuk sekali lagi buat hapus" }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("shows a refusal right under the button, not at the top of the sheet", () => {
    const onDelete = vi.fn();
    const { rerender } = render(sheet(PRODUCT, onDelete));

    fireEvent.click(screen.getByRole("button", { name: "Hapus menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Yakin? Ketuk sekali lagi buat hapus" }));
    rerender(sheet(PRODUCT, onDelete, { message: "Menu ini udah pernah kejual jadi nggak bisa dihapus." }));

    const refusal = screen.getByRole("alert");
    expect(refusal.textContent).toContain("udah pernah kejual");
    // It sits after the delete button, which is back to its first state.
    const button = screen.getByRole("button", { name: "Hapus menu" });
    expect(button.compareDocumentPosition(refusal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByText(/udah pernah kejual/)).toHaveLength(1);
  });

  it("is not offered for a menu item that has not been saved yet", () => {
    renderSheet(null);
    expect(screen.queryByRole("button", { name: "Hapus menu" })).toBeNull();
  });
});
