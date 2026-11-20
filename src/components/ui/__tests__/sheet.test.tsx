// @vitest-environment jsdom
import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sheet } from "@/components/ui/sheet";

afterEach(cleanup);

/** A form in a sheet whose owner re-renders on every keystroke, as the paket sheet does. */
function TypingSheet({ onClose }: { onClose: () => void }) {
  const [name, setName] = React.useState("");
  return (
    <Sheet open onClose={() => onClose()} title="Paket baru">
      <label>
        Nama paket
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <span data-testid="typed">{name}</span>
    </Sheet>
  );
}

describe("Sheet", () => {
  it("keeps focus in the field being typed in, though its owner passes a new onClose each render", () => {
    render(<TypingSheet onClose={() => {}} />);
    const field = screen.getByLabelText("Nama paket");

    field.focus();
    for (const value of ["L", "Li", "Lit", "Litt", "Little"]) {
      fireEvent.change(field, { target: { value } });
      expect(document.activeElement).toBe(field);
    }
    expect(screen.getByTestId("typed").textContent).toBe("Little");
  });

  it("still closes on Escape, calling the latest onClose", () => {
    const onClose = vi.fn();
    render(<TypingSheet onClose={onClose} />);

    fireEvent.change(screen.getByLabelText("Nama paket"), { target: { value: "Combo" } });
    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledOnce();
  });
});
