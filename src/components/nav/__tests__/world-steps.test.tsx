// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

import { WorldSteps, worldOf } from "@/components/nav/world-steps";

afterEach(cleanup);

describe("worldOf", () => {
  it("places each ordering page in its world", () => {
    expect(worldOf("/")).toBe(0);
    expect(worldOf("/keranjang")).toBe(1);
    expect(worldOf("/checkout")).toBe(2);
    expect(worldOf("/lacak")).toBe(3);
  });

  it("counts a single order's page as the tracker's", () => {
    expect(worldOf("/pesanan/PO-0007")).toBe(3);
  });

  it("does not mistake a longer path for the menu", () => {
    // "/" is a prefix of everything; only the exact path is world 1.
    expect(worldOf("/login")).toBe(-1);
    expect(worldOf("/keranjangku")).toBe(-1);
  });
});

describe("WorldSteps", () => {
  it("marks exactly the world the customer is in", () => {
    pathname = "/checkout";
    render(<WorldSteps />);

    const steps = screen.getAllByRole("listitem");
    expect(steps).toHaveLength(4);
    expect(steps.map((step) => step.getAttribute("data-state"))).toEqual([
      "done",
      "done",
      "current",
      "ahead",
    ]);
    expect(steps.filter((step) => step.getAttribute("aria-current") === "step")).toHaveLength(1);
  });

  it("says each step in words for a screen reader, not as 'W3'", () => {
    pathname = "/";
    render(<WorldSteps />);

    expect(screen.getByText("Langkah 3: Isi data")).toBeTruthy();
  });

  it("is orientation, not a second navigation", () => {
    pathname = "/lacak";
    render(<WorldSteps />);

    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
