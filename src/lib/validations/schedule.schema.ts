import { z } from "zod";
import { HANDOVER_LOCATIONS, isValidWindow, parseServiceDate } from "@/lib/schedule";

const serviceDate = z
  .string()
  .refine((value) => parseServiceDate(value) !== null, "Tanggalnya nggak valid");

const minute = z.number().int().min(0).max(24 * 60);

const quota = z
  .number()
  .int("Kuotanya harus angka bulat")
  .min(1, "Kuota minimal 1 pesanan")
  .max(500, "Kuotanya kegedean");

export const windowSchema = z
  .object({ startMinute: minute, endMinute: minute, quota })
  .refine((window) => isValidWindow(window.startMinute, window.endMinute), {
    message: "Jam selesai harus setelah jam mulai, minimal 15 menit",
    path: ["endMinute"],
  });

const locations = z
  .array(z.enum(HANDOVER_LOCATIONS))
  .min(1, "Pilih minimal satu lokasi yang dilayani")
  .refine((list) => new Set(list).size === list.length, "Ada lokasi yang dobel");

/** Opening (or reopening) a date, optionally with its first time ranges. */
export const openServiceDaySchema = z.object({
  date: serviceDate,
  locations,
  windows: z.array(windowSchema).max(24).default([]),
});

export const dayLocationsSchema = z.object({
  dayId: z.string().min(1),
  locations,
});

export const addWindowSchema = z.object({ dayId: z.string().min(1) }).and(windowSchema);

export const windowQuotaSchema = z.object({ windowId: z.string().min(1), quota });

export const cutoffSchema = z.object({
  orderCutoffMinute: z
    .number()
    .int()
    .min(0, "Jamnya nggak valid")
    .max(24 * 60 - 1, "Jamnya nggak valid"),
});
