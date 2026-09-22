import { describe, expect, it } from "vitest";
import { csvAttachmentHeader, escapeCsvCell, toCsv, type CsvColumn } from "@/lib/csv";
import { BRAND_SLUG } from "@/lib/brand";

interface Row {
  name: string;
  qty: number;
  note: string | null;
}

const columns: readonly CsvColumn<Row>[] = [
  { header: "Nama", value: (row) => row.name },
  { header: "Jumlah", value: (row) => row.qty },
  { header: "Catatan", value: (row) => row.note },
];

describe("escapeCsvCell", () => {
  it("leaves an ordinary value alone", () => {
    expect(escapeCsvCell("Cimol")).toBe("Cimol");
    expect(escapeCsvCell(12_500)).toBe("12500");
  });

  it("quotes a value containing the separator", () => {
    // Unquoted, this would become two columns and shift the whole row.
    expect(escapeCsvCell("Cimol, isi 10")).toBe('"Cimol, isi 10"');
  });

  it("quotes and doubles an embedded quote", () => {
    expect(escapeCsvCell('Es Teh "Jumbo"')).toBe('"Es Teh ""Jumbo"""');
  });

  it("quotes a value containing a line break", () => {
    expect(escapeCsvCell("Catatan:\nPedas")).toBe('"Catatan:\nPedas"');
  });

  it("writes an empty cell for a missing value, not the word null", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });

  it("writes zero as a digit rather than an empty cell", () => {
    expect(escapeCsvCell(0)).toBe("0");
  });
});

describe("toCsv", () => {
  it("starts with a UTF-8 BOM so Excel reads the accents", () => {
    const csv = toCsv(columns, []);

    expect(csv.startsWith("﻿")).toBe(true);
  });

  it("writes the headers then one record per row, separated by CRLF", () => {
    const csv = toCsv(columns, [
      { name: "Cimol", qty: 3, note: null },
      { name: "Risoles", qty: 1, note: "tanpa saus" },
    ]);

    expect(csv).toBe(
      "﻿Nama,Jumlah,Catatan\r\n" + "Cimol,3,\r\n" + "Risoles,1,tanpa saus\r\n",
    );
  });

  it("keeps a comma inside a name from shifting the columns", () => {
    const csv = toCsv(columns, [{ name: "Cimol, isi 10", qty: 2, note: null }]);
    const record = csv.split("\r\n")[1]!;

    expect(record).toBe('"Cimol, isi 10",2,');
    // Three columns still, despite the comma in the first one.
    expect(record.split('",')[1]!.split(",")).toHaveLength(2);
  });

  it("writes money as plain digits a spreadsheet can sum", () => {
    const money: readonly CsvColumn<{ total: number }>[] = [
      { header: "Total", value: (row) => row.total },
    ];

    const csv = toCsv(money, [{ total: 426_000 }]);

    // No thousands separator, no "Rp" — either would make the column text.
    expect(csv).toContain("426000");
    expect(csv).not.toContain("426.000");
    expect(csv).not.toContain("Rp");
  });

  it("writes a header-only file when there is nothing to report", () => {
    expect(toCsv(columns, [])).toBe("﻿Nama,Jumlah,Catatan\r\n");
  });
});

describe("csvAttachmentHeader", () => {
  it("dates the filename so two exports do not overwrite each other", () => {
    // The slug comes from `brand.ts`, so choosing a real brand name later does
    // not leave this test asserting the placeholder.
    expect(csvAttachmentHeader("pesanan", "2026-09-20")).toBe(
      `attachment; filename="${BRAND_SLUG}-pesanan-2026-09-20.csv"`,
    );
  });
});
