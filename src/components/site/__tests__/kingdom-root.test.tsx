// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { KingdomRoot } from "@/components/site/kingdom-root";

afterEach(cleanup);

describe("KingdomRoot", () => {
  it("themes its own wrapper, so the first paint is already right", () => {
    const { container } = render(
      <KingdomRoot className="page">
        <p>isi</p>
      </KingdomRoot>,
    );

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.dataset.theme).toBe("kingdom");
    expect(wrapper.className).toBe("page");
  });

  it("marks <html> too, so a sheet portalled into <body> is themed", () => {
    render(<KingdomRoot>isi</KingdomRoot>);

    expect(document.documentElement.dataset.theme).toBe("kingdom");
  });

  it("gives <html> back when it unmounts, so the other side does not inherit it", () => {
    const { unmount } = render(<KingdomRoot>isi</KingdomRoot>);
    unmount();

    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});

describe("KingdomRoot on the staff side", () => {
  it("carries the staff role on the wrapper and on <html>, for the role colour", () => {
    const { container } = render(<KingdomRoot staffRole="KASIR">isi</KingdomRoot>);

    expect((container.firstElementChild as HTMLElement).dataset.staffRole).toBe("KASIR");
    expect(document.documentElement.dataset.staffRole).toBe("KASIR");
  });

  it("takes the role off <html> again when it unmounts", () => {
    const { unmount } = render(<KingdomRoot staffRole="DAPUR">isi</KingdomRoot>);
    unmount();

    expect(document.documentElement.dataset.staffRole).toBeUndefined();
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("leaves the customer side without one", () => {
    const { container } = render(<KingdomRoot>isi</KingdomRoot>);

    expect((container.firstElementChild as HTMLElement).dataset.staffRole).toBeUndefined();
  });
});
