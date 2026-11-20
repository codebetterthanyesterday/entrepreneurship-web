// @vitest-environment jsdom
import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PendingPhotos } from "@/components/admin/pending-photos";

beforeAll(() => {
  URL.createObjectURL = vi.fn((file: Blob) => `blob:${(file as File).name}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

const photo = (name: string) => new File(["x"], name, { type: "image/jpeg" });

function Harness({ max }: { max: number }) {
  const [files, setFiles] = React.useState<File[]>([]);
  return (
    <PendingPhotos title="Foto menu" max={max} files={files} onChange={setFiles} emptyNote="Opsional." />
  );
}

function pick(names: string[]) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  fireEvent.change(input, { target: { files: names.map(photo) } });
}

describe("PendingPhotos", () => {
  it("shows what was picked before anything is uploaded, the first as the cover", () => {
    render(<Harness max={6} />);
    expect(screen.getByText("Opsional.")).toBeTruthy();

    pick(["a.jpg", "b.jpg"]);

    expect(screen.getByText("2 dari 6")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Foto menu 1 yang dipilih" }).getAttribute("src")).toBe("blob:a.jpg");
    expect(screen.getByText("Sampul")).toBeTruthy();
  });

  it("lets a pick be dropped again", () => {
    render(<Harness max={6} />);
    pick(["a.jpg", "b.jpg"]);

    fireEvent.click(screen.getByRole("button", { name: "Batal pakai foto menu 1" }));

    expect(screen.getByText("1 dari 6")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Foto menu 1 yang dipilih" }).getAttribute("src")).toBe("blob:b.jpg");
  });

  it("takes no more than it may hold, and stops offering more once full", () => {
    render(<Harness max={1} />);

    pick(["a.jpg", "b.jpg"]);

    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.queryByText("Tambah foto")).toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});
