// @vitest-environment jsdom
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  create: vi.fn(),
  reset: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/actions/staff.actions", () => ({
  createStaffAction: (input: unknown) => actions.create(input),
  resetStaffPasswordAction: (input: unknown) => actions.reset(input),
  updateStaffAction: (input: unknown) => actions.update(input),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { StaffManager } = await import("@/components/admin/staff-manager");
const { ToastProvider } = await import("@/components/ui/use-toast");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const ACCOUNTS = [
  { id: "a1", name: "Sekar", email: "sekar@x.test", role: "ADMIN" as const, isActive: true, mustChangePassword: false },
  { id: "k1", name: "Rani", email: "rani@x.test", role: "KASIR" as const, isActive: true, mustChangePassword: true },
];

function renderManager() {
  render(
    <ToastProvider>
      <StaffManager accounts={ACCOUNTS} selfId="a1" loginUrl="https://bunnye.vercel.app/masuk-rahasia-uji" />
    </ToastProvider>,
  );
}

describe("StaffManager", () => {
  it("marks who still has to change their password, and offers no reset of your own", () => {
    renderManager();

    expect(screen.getByText("Belum ganti password")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Reset password Sekar" })).toBeNull();
    expect(screen.getByRole("button", { name: "Reset password Rani" })).toBeDefined();
  });

  it("asks before resetting, then shows the new password once, with where to sign in", async () => {
    actions.reset.mockResolvedValue({
      ok: true,
      data: { account: { ...ACCOUNTS[1], mustChangePassword: true }, password: "k7f3-q9x2-m4wd" },
    });
    renderManager();

    fireEvent.click(screen.getByRole("button", { name: "Reset password Rani" }));
    expect(actions.reset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ya, reset" }));

    await waitFor(() => expect(screen.getByText("k7f3-q9x2-m4wd")).toBeDefined());
    expect(screen.getByText(/Cuma tampil sekali/)).toBeDefined();
    expect(screen.getByText("https://bunnye.vercel.app/masuk-rahasia-uji")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Udah dicatat, tutup" }));
    expect(screen.queryByText("k7f3-q9x2-m4wd")).toBeNull();
  });

  it("will not let you change your own role", () => {
    renderManager();

    fireEvent.click(screen.getByRole("button", { name: "Ubah akun Sekar" }));

    expect(screen.getByText(/Peran dan status akunmu sendiri/)).toBeDefined();
    expect(screen.queryByRole("group", { name: "Status" })).toBeNull();
  });
});
