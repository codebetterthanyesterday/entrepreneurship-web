// @vitest-environment jsdom
import * as React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AccentRoot } from "@/components/site/accent-root";
import { AccentSwitch } from "@/components/site/accent-switch";

function clearAccentCookie() {
  document.cookie = "accent=; path=/; max-age=0";
}

beforeEach(clearAccentCookie);
afterEach(() => {
  cleanup();
  clearAccentCookie();
});

function renderRoot(props: Partial<React.ComponentProps<typeof AccentRoot>> = {}) {
  return render(
    <AccentRoot initialAccent={null} ask brandName="Nama Usaha" {...props}>
      <AccentSwitch />
      <p>Isi halaman</p>
    </AccentRoot>,
  );
}

function wrapper() {
  return screen.getByText("Isi halaman").parentElement!;
}

/**
 * jsdom has no view transitions, so these exercise the fallback path — the one
 * every browser without the API takes, and the one reduced-motion takes.
 */
describe("AccentRoot", () => {
  it("asks on the first visit and keeps the page out of reach meanwhile", () => {
    renderRoot();

    expect(screen.getByRole("dialog", { name: /cewek atau cowok/i })).toBeTruthy();
    expect(wrapper().hasAttribute("inert")).toBe(true);
    expect(document.documentElement.dataset.accent).toBe("pink");
  });

  it("turns the whole page blue for Laki-laki and remembers it", () => {
    renderRoot();

    fireEvent.click(screen.getByRole("button", { name: /laki-laki/i }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(wrapper().dataset.accent).toBe("blue");
    expect(wrapper().hasAttribute("inert")).toBe(false);
    // <html> too, for the body and for sheets portalled out of the wrapper.
    expect(document.documentElement.dataset.accent).toBe("blue");
    expect(document.cookie).toContain("accent=blue");
  });

  it("records a skip as the default pink, so the question is not asked again", () => {
    renderRoot();

    fireEvent.click(screen.getByRole("button", { name: "Lewati" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(wrapper().dataset.accent).toBe("pink");
    expect(document.cookie).toContain("accent=pink");
  });

  it("skips on Escape", () => {
    renderRoot();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.cookie).toContain("accent=pink");
  });

  it("does not ask a returning visitor, and paints their mood straight away", () => {
    renderRoot({ initialAccent: "blue", ask: false });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(wrapper().dataset.accent).toBe("blue");
  });

  it("lets the header switch change the answer later", () => {
    renderRoot({ initialAccent: "blue", ask: false });
    const toggle = screen.getByRole("switch", { name: "Nuansa biru" });
    expect(toggle.getAttribute("aria-checked")).toBe("true");

    fireEvent.click(toggle);

    expect(wrapper().dataset.accent).toBe("pink");
    expect(document.cookie).toContain("accent=pink");
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  });

  it("points the switch out once the welcome is answered", () => {
    renderRoot();

    fireEvent.click(screen.getByRole("button", { name: /perempuan/i }));

    expect(screen.getByRole("status").textContent).toContain("Bisa diganti di sini");
  });

  it("does not point it out again for a later change, or to a returning visitor", () => {
    renderRoot({ initialAccent: "pink", ask: false });

    fireEvent.click(screen.getByRole("switch", { name: "Nuansa biru" }));

    expect(screen.queryByText(/Bisa diganti di sini/)).toBeNull();
  });

  it("hands <html> back when the customer side unmounts, so staff screens stay pink", () => {
    const { unmount } = renderRoot({ initialAccent: "blue", ask: false });
    expect(document.documentElement.dataset.accent).toBe("blue");

    act(() => unmount());

    expect(document.documentElement.dataset.accent).toBeUndefined();
  });

  it("keeps the switch's own classes through cn(), hint or not", () => {
    // tailwind-merge once read `accent-*` custom classes as Tailwind's
    // accent-color utility and dropped all but the last, so the orb lost its
    // gloss while the hint was showing.
    renderRoot();
    const knob = () => screen.getByRole("switch").querySelector("span > span:last-child")!;

    expect(knob().className).toContain("mood-orb");
    expect(knob().className).toContain("mood-knob");

    fireEvent.click(screen.getByRole("button", { name: "Lewati" }));

    expect(knob().className).toContain("mood-orb");
    expect(knob().className).toContain("mood-knob-hint");
  });
});
