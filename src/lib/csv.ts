import { BRAND_SLUG } from "@/lib/brand";
/**
 * A cell's value before it is escaped. Numbers are written as plain digits —
 * never formatted — so a spreadsheet reads them as numbers and can sum them.
 */
export type CsvValue = string | number | null | undefined;

export interface CsvColumn<Row> {
  /** The heading, in the language the report is written in. */
  header: string;
  value: (row: Row) => CsvValue;
}

/**
 * Excel opens a UTF-8 file as the local single-byte codepage unless the file
 * starts with a byte order mark, which turns "Es Kopi Susu Gula Aren" into
 * mojibake the moment a name carries an accent or a curly quote. The BOM is
 * three bytes and fixes it everywhere it matters.
 */
const UTF8_BOM = "﻿";

/**
 * CSV wants CRLF between records. Excel copes with bare LF, but Numbers and a
 * few older importers do not, and the file has to open cleanly on whatever the
 * lecturer happens to use.
 */
const RECORD_SEPARATOR = "\r\n";

/**
 * Escapes one cell per RFC 4180.
 *
 * A value is quoted when it contains the separator, a quote, or a line break —
 * otherwise a menu name like "Cimol, Isi 10" would silently become two columns
 * and shift every column after it on that row. Inside a quoted value a literal
 * quote is doubled.
 *
 * `null` and `undefined` become an empty cell rather than the strings "null" or
 * "undefined", which is what a reader means by "this order had no phone
 * number".
 */
export function escapeCsvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";

  const text = String(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

/**
 * Renders rows as a comma-separated file, ready to be served as-is.
 *
 * Comma rather than semicolon: the brief asks for comma, and the BOM is what
 * makes Excel's Indonesian locale read it correctly — without the BOM that
 * locale expects a semicolon, with it the comma is honoured.
 */
export function toCsv<Row>(columns: readonly CsvColumn<Row>[], rows: readonly Row[]): string {
  const lines = [
    columns.map((column) => escapeCsvCell(column.header)).join(","),
    ...rows.map((row) => columns.map((column) => escapeCsvCell(column.value(row))).join(",")),
  ];

  // A trailing separator, so the last record is terminated like the others and
  // an importer that reads line-by-line does not have to special-case it.
  return UTF8_BOM + lines.join(RECORD_SEPARATOR) + RECORD_SEPARATOR;
}

/**
 * The `Content-Disposition` value for a download, with the date in the name so
 * that two exports taken on different days do not overwrite each other in the
 * reader's downloads folder.
 *
 * The filename is built here rather than by the caller so that every export
 * this app serves is named the same way.
 */
export function csvAttachmentHeader(prefix: string, isoDate: string): string {
  return `attachment; filename="${BRAND_SLUG}-${prefix}-${isoDate}.csv"`;
}
