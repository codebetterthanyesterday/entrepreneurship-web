"use client";

import * as React from "react";
import { Temporal } from "@js-temporal/polyfill";
import { cn } from "@/lib/utils";
import {
  HANDOVER_DETAIL_MAX,
  HANDOVER_HINT,
  HANDOVER_LABEL,
  HANDOVER_LOCATIONS,
  clockLabel,
  formatServiceDate,
  type HandoverLocation,
} from "@/lib/schedule";
import type { BookableSchedule } from "@/lib/queries/schedule.query";

export interface HandoverChoice {
  location: HandoverLocation | null;
  detail: string;
  date: string | null;
  windowId: string | null;
}

/**
 * Where, which day and which hour, in that order: the place first, because a
 * place is only served on some dates (Market Day on its own day, the campuses on
 * theirs), so the calendar can show only the dates that place is open.
 *
 * Each part is a step card of its own, rendered by the checkout's `Step`.
 */
export function HandoverSteps({
  schedule,
  value,
  onChange,
  disabled,
  fieldError,
  Step,
  audience = "customer",
  currentWindowId = null,
}: {
  schedule: BookableSchedule;
  value: HandoverChoice;
  onChange: (next: HandoverChoice) => void;
  disabled: boolean;
  fieldError: (field: string) => string | undefined;
  Step: React.ComponentType<{ number: string; title: string; hint?: string; children: React.ReactNode }>;
  /**
   * Staff moving an order (`OrderEditSheet`) are not held to the cut-off, and
   * a "Lainnya" place they write is taken as checked: the copy says so.
   */
  audience?: "customer" | "staff";
  /** The range the order being edited holds now: labelled as such, not by its places left. */
  currentWindowId?: string | null;
}) {
  const staff = audience === "staff";
  const days = React.useMemo(
    () =>
      value.location
        ? schedule.days.filter((day) => day.locations.includes(value.location!))
        : [],
    [schedule.days, value.location],
  );
  const day = days.find((candidate) => candidate.date === value.date) ?? null;

  const chooseLocation = (location: HandoverLocation) => {
    // A date that does not serve the new place, and its hour, go.
    const keeps = schedule.days.some(
      (candidate) => candidate.date === value.date && candidate.locations.includes(location),
    );
    onChange({ ...value, location, date: keeps ? value.date : null, windowId: keeps ? value.windowId : null });
  };

  const cutoff = `${clockLabel(schedule.cutoffMinute)} WIB`;

  return (
    <>
      <Step number="02" title="Diserahkan di mana?">
        <fieldset disabled={disabled} className="min-w-0">
          <legend className="sr-only">Lokasi serah terima</legend>
          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
            {HANDOVER_LOCATIONS.map((location) => {
              const active = value.location === location;
              const open = schedule.days.some((candidate) => candidate.locations.includes(location));
              return (
                <button
                  key={location}
                  type="button"
                  aria-pressed={active}
                  onClick={() => chooseLocation(location)}
                  className={cn(
                    "flex min-h-[64px] items-start gap-3 rounded-[8px] border-2 px-3.5 py-3 text-left transition-colors",
                    active ? "k-choice-on text-white" : "border-line bg-white text-ink hover:border-pink",
                  )}
                >
                  <PinIcon />
                  <span className="min-w-0">
                    <span className="block text-[14.5px] font-semibold">{HANDOVER_LABEL[location]}</span>
                    <span className={cn("mt-0.5 block text-[12px] leading-snug", active ? "text-white/80" : "text-ink-soft")}>
                      {open ? HANDOVER_HINT[location] : "Belum ada tanggal yang dibuka"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {value.location && (
            <label className="mt-4 block">
              <span className="block text-[13px] font-semibold text-ink">
                {value.location === "OTHER"
                  ? "Lokasi lengkapnya di mana?"
                  : value.location === "MARKET_DAY"
                    ? "Catatan buat kami (opsional)"
                    : "Titik temu / ruangan (opsional)"}
              </span>
              <input
                value={value.detail}
                maxLength={HANDOVER_DETAIL_MAX}
                onChange={(event) => onChange({ ...value, detail: event.target.value })}
                placeholder={
                  value.location === "OTHER"
                    ? "Contoh: Kos Melati, Jl. Merpati 12, dekat gerbang belakang"
                    : "Contoh: Depan gazebo / Kantin Lt 2 / Kelas 302"
                }
                aria-invalid={fieldError("handoverDetail") ? true : undefined}
                className="mt-1.5 h-12 w-full rounded-[8px] border-2 border-line bg-white px-3 text-[15px] text-ink focus:border-pink"
              />
              {value.location === "OTHER" && !fieldError("handoverDetail") && (
                <span className="mt-1.5 block text-[12px] text-ink-soft">
                  {staff
                    ? "Lokasi yang kamu tulis di sini dianggap sudah dicek jangkauannya."
                    : "Pesanan ke lokasi lain kami cek dulu jangkauannya, lalu kami kabari lewat WhatsApp."}
                </span>
              )}
              {fieldError("handoverDetail") && (
                <span className="mt-1.5 block text-sm text-hot">{fieldError("handoverDetail")}</span>
              )}
            </label>
          )}
        </fieldset>
      </Step>

      <Step number="03" title="Tanggal berapa?">
        <p className="-mt-1 mb-3 text-[12.5px] text-ink-soft">
          {staff
            ? `Tanggal yang sudah lewat batas pesan (${cutoff} sehari sebelumnya) tetap bisa dipilih; pastikan dapur sanggup.`
            : `Pesan paling lambat sehari sebelumnya, jam ${cutoff}.`}
        </p>
        {!value.location ? (
          <p className="text-sm text-ink-soft">Pilih lokasinya dulu, nanti tanggal yang buka muncul di sini.</p>
        ) : days.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Belum ada tanggal yang dibuka untuk {HANDOVER_LABEL[value.location]}. Coba lokasi lain atau
            cek lagi nanti ya.
          </p>
        ) : (
          <ServiceCalendar
            dates={days.map((candidate) => candidate.date)}
            value={value.date}
            disabled={disabled}
            onChange={(date) => onChange({ ...value, date, windowId: null })}
          />
        )}
      </Step>

      <Step number="04" title="Jam berapa?" hint="Rentang waktu tiba">
        {!day ? (
          <p className="text-sm text-ink-soft">Pilih tanggalnya dulu ya.</p>
        ) : (
          <fieldset disabled={disabled} className="min-w-0">
            <legend className="sr-only">Rentang jam serah terima, {formatServiceDate(day.date)}</legend>
            <div className="grid grid-cols-2 gap-2">
              {day.windows.map((window) => {
                const active = value.windowId === window.id;
                return (
                  <button
                    key={window.id}
                    type="button"
                    aria-pressed={active}
                    disabled={window.isFull}
                    onClick={() => onChange({ ...value, windowId: window.id })}
                    className={cn(
                      "min-h-[58px] rounded-[8px] border-2 px-3.5 text-left transition-colors",
                      active ? "k-choice-on text-white" : "border-line bg-white text-ink hover:border-pink",
                      window.isFull && "cursor-not-allowed opacity-45 hover:border-line",
                    )}
                  >
                    <span className="block text-[14.5px] font-semibold tabular-nums">{window.label}</span>
                    <span className={cn("eyebrow mt-0.5 block", active ? "text-white" : "text-ink-soft")}>
                      {window.id === currentWindowId
                        ? "Jadwal sekarang"
                        : window.isFull
                          ? "Penuh"
                          : `Sisa ${window.remaining} tempat`}
                    </span>
                  </button>
                );
              })}
            </div>
            {!staff && (
              <p className="mt-3 text-[12.5px] leading-relaxed text-ink-soft">
                Kami datang di dalam rentang jam itu. Kalau ada kendala di jalan, kami kabari lewat WhatsApp.
              </p>
            )}
          </fieldset>
        )}
        {fieldError("serviceWindowId") && (
          <p className="mt-2 text-sm text-hot">{fieldError("serviceWindowId")}</p>
        )}
      </Step>
    </>
  );
}

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/**
 * A month at a time, Monday first. Only the open dates can be pressed; the
 * arrows step between the months that hold one.
 */
function ServiceCalendar({
  dates,
  value,
  disabled,
  onChange,
}: {
  dates: string[];
  value: string | null;
  disabled: boolean;
  onChange: (date: string) => void;
}) {
  const open = React.useMemo(() => new Set(dates), [dates]);
  const months = React.useMemo(
    () => [...new Set(dates.map((date) => date.slice(0, 7)))].sort(),
    [dates],
  );
  const [month, setMonth] = React.useState(() => (value ?? dates[0]!).slice(0, 7));
  const shown = months.includes(month) ? month : months[0]!;
  const index = months.indexOf(shown);

  const first = Temporal.PlainYearMonth.from(shown).toPlainDate({ day: 1 });
  const lead = first.dayOfWeek - 1;
  const cells: (Temporal.PlainDate | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: first.daysInMonth }, (_, day) => first.with({ day: day + 1 })),
  ];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold text-ink" aria-live="polite">
          {MONTHS[first.month - 1]} {first.year}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Bulan sebelumnya"
            disabled={index <= 0}
            onClick={() => setMonth(months[index - 1]!)}
            className="flex h-11 w-11 items-center justify-center rounded-[8px] border-2 border-line bg-white text-ink disabled:opacity-35"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Bulan berikutnya"
            disabled={index >= months.length - 1}
            onClick={() => setMonth(months[index + 1]!)}
            className="flex h-11 w-11 items-center justify-center rounded-[8px] border-2 border-line bg-white text-ink disabled:opacity-35"
          >
            ›
          </button>
        </div>
      </div>

      <div role="group" aria-label={`Tanggal ${MONTHS[first.month - 1]} ${first.year}`} className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} aria-hidden="true" className="pb-1 text-center text-[11.5px] font-semibold text-ink-soft">
            {weekday}
          </span>
        ))}
        {cells.map((cell, position) => {
          if (!cell) return <span key={`blank-${position}`} aria-hidden="true" />;
          const date = cell.toString();
          const isOpen = open.has(date);
          const active = value === date;
          return (
            <button
              key={date}
              type="button"
              disabled={!isOpen || disabled}
              aria-pressed={active}
              aria-label={`${formatServiceDate(date)}${isOpen ? "" : ", tutup"}`}
              onClick={() => onChange(date)}
              className={cn(
                "relative flex aspect-square min-h-[40px] flex-col items-center justify-center rounded-[8px] border-2 text-[14px] font-semibold tabular-nums transition-colors",
                active
                  ? "k-choice-on text-white"
                  : isOpen
                    ? "border-[var(--k-yellow,#fcd96a)] bg-white text-ink hover:border-pink"
                    : "border-transparent bg-cream text-ink-soft/50",
              )}
            >
              {cell.day}
              {isOpen && (
                <span
                  aria-hidden="true"
                  className={cn("mt-0.5 h-1.5 w-1.5 rounded-full", active ? "bg-white" : "bg-ok")}
                />
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-3 flex items-center gap-4 text-[12px] text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-ok" /> Buka PO
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-line" /> Tutup
        </span>
        {value && <span className="ml-auto font-semibold text-ink">{formatServiceDate(value)}</span>}
      </p>
    </div>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true">
      <path
        d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="10" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
