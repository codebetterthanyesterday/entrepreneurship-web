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

  it("gives <html> back when it unmounts, so the staff screens keep their palette", () => {
    const { unmount } = render(<KingdomRoot>isi</KingdomRoot>);
    unmount();

    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});
