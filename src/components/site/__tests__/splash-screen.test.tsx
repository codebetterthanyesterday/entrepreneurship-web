// @vitest-environment jsdom
import * as React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SplashLoading, SplashScreen } from "@/components/site/splash-screen";
import { SiteIdentityProvider } from "@/components/site/site-identity";

const splash = () => document.querySelector(".k-splash") as HTMLElement | null;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("SplashScreen", () => {
  it("stays long enough to read even when the page is already loaded, then leaves", () => {
    Object.defineProperty(document, "readyState", { value: "complete", configurable: true });
    render(<SplashScreen brandName="Bunnyè" tagline="Kopi hangat" />);

    act(() => vi.advanceTimersByTime(800));
    expect(splash()?.dataset.leaving).toBe("false");

    act(() => vi.advanceTimersByTime(200));
    expect(splash()?.dataset.leaving).toBe("true");
  });

  it("waits for the page to finish loading before it leaves", () => {
    Object.defineProperty(document, "readyState", { value: "loading", configurable: true });
    render(<SplashScreen brandName="Bunnyè" tagline="Kopi hangat" />);

    act(() => vi.advanceTimersByTime(1500));
    expect(splash()?.dataset.leaving).toBe("false");

    act(() => {
      window.dispatchEvent(new Event("load"));
    });
    act(() => vi.advanceTimersByTime(0));
    expect(splash()?.dataset.leaving).toBe("true");
  });

  it("goes at a tap", () => {
    Object.defineProperty(document, "readyState", { value: "loading", configurable: true });
    render(<SplashScreen brandName="Bunnyè" tagline="Kopi hangat" />);

    fireEvent.click(splash()!);

    expect(splash()?.dataset.leaving).toBe("true");
  });
});

describe("SplashLoading", () => {
  it("is the same scene, named for a screen reader, with the store's own name", () => {
    render(
      <SiteIdentityProvider value={{ brandName: "Kedai Kelinci", tagline: "Kopi hangat tiap Market Day" }}>
        <SplashLoading label="Lagi nyiapin form checkout..." />
      </SiteIdentityProvider>,
    );

    expect(screen.getByRole("status", { name: "Lagi nyiapin form checkout..." })).toBeTruthy();
    expect(splash()?.classList.contains("k-splash-loading")).toBe(true);
    expect(splash()?.textContent).toContain("Kedai Kelinci");
    expect(splash()?.textContent).toContain("Kopi hangat tiap Market Day");
  });
});
