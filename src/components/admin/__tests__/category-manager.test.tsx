// @vitest-environment jsdom
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  create: vi.fn(),
  rename: vi.fn(),
  move: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/actions/category.actions", () => ({
  createCategoryAction: (input: unknown) => actions.create(input),
  renameCategoryAction: (input: unknown) => actions.rename(input),
  moveCategoryAction: (input: unknown) => actions.move(input),
  deleteCategoryAction: (input: unknown) => actions.remove(input),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { CategoryManager } = await import("@/components/admin/category-manager");
const { ToastProvider } = await import("@/components/ui/use-toast");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const CATEGORIES = [
  { id: "c1", name: "Kopi", products: 3 },
  { id: "c2", name: "Snack", products: 0 },
];

function renderManager() {
  render(
    <ToastProvider>
      <CategoryManager categories={CATEGORIES} />
    </ToastProvider>,
  );
}

describe("CategoryManager", () => {
  it("cannot move the first up or the last down", () => {
    renderManager();

    expect((screen.getByRole("button", { name: "Naikkan Kopi" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Turunkan Snack" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Turunkan Kopi" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("says before deleting that the menu items stay on sale, and deletes only on the second tap", async () => {
    actions.remove.mockResolvedValue({ ok: true, data: { moved: 3 } });
    renderManager();

    fireEvent.click(screen.getByRole("button", { name: "Hapus Kopi" }));
    expect(screen.getByText(/3 menu di dalamnya nggak ikut terhapus/)).toBeTruthy();
    expect(actions.remove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Ya, hapus" }));
    await waitFor(() => expect(actions.remove).toHaveBeenCalledWith("c1"));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Ya, hapus" })).toBeNull());
  });

  it("shows a refused name under the field", async () => {
    actions.create.mockResolvedValue({ ok: false, error: 'Kategori "Kopi" udah ada', field: "name" });
    renderManager();

    fireEvent.click(screen.getByRole("button", { name: "Tambah kategori" }));
    fireEvent.change(screen.getByLabelText("Nama kategori"), { target: { value: "kopi" } });
    fireEvent.click(screen.getByRole("button", { name: "Tambah" }));

    expect(await screen.findByText('Kategori "Kopi" udah ada')).toBeTruthy();
    expect(actions.create).toHaveBeenCalledWith({ name: "kopi" });
  });
});
