// @vitest-environment jsdom
import * as React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Confetti } from "@/components/public/confetti";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const pieces = (container: HTMLElement) => container.querySelectorAll(".confetti-piece").length;

describe("Confetti", () => {
  it("stays empty until fired, bursts, then clears itself away", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<Confetti fire={0} />);
    expect(pieces(container)).toBe(0);

    rerender(<Confetti fire={1} />);
    expect(pieces(container)).toBeGreaterThan(20);

    act(() => vi.advanceTimersByTime(4000));
    expect(pieces(container)).toBe(0);
  });

  it("does not burst for a reader who asked for less motion", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce") }));
    const { container, rerender } = render(<Confetti fire={0} />);

    rerender(<Confetti fire={1} />);

    expect(pieces(container)).toBe(0);
  });
});
