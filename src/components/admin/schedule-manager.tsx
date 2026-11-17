"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Temporal } from "@js-temporal/polyfill";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  addServiceWindowAction,
  closeServiceDayAction,
  deleteServiceWindowAction,
  openServiceDayAction,
  setDayLocationsAction,
  setOrderCutoffAction,
  updateWindowQuotaAction,
} from "@/actions/schedule.actions";
import {
  HANDOVER_LABEL,
  HANDOVER_LOCATIONS,
  clockLabel,
  formatServiceDate,
  windowLabel,
  type HandoverLocation,
} from "@/lib/schedule";
import type { AdminServiceDay } from "@/lib/queries/schedule.query";
import type { ActionResult } from "@/lib/action-result";

export interface ScheduleManagerProps {
  days: AdminServiceDay[];
  today: string;
  cutoffMinute: number;
}

/** Used for a date when no earlier date has ranges to copy. */
const STARTER_WINDOWS = [
  { startMinute: 10 * 60, endMinute: 11 * 60, quota: 10 },
  { startMinute: 11 * 60, endMinute: 12 * 60, quota: 10 },
  { startMinute: 12 * 60, endMinute: 13 * 60, quota: 10 },
];

const toMinute = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
};
const toClock = (minute: number) => clockLabel(minute).replace(".", ":");

/**
 * The preorder schedule, for admins: which dates are open, where each date
 * hands over, its time ranges and their quotas, and when booking closes.
 *
 * A date nobody opened takes no preorders. Opening one copies the ranges of the
 * latest date that has some, since most days run the same hours.
 */
export function ScheduleManager({ days, today, cutoffMinute }: ScheduleManagerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [selected, setSelected] = React.useState<string>(
    () => days.find((day) => day.isOpen)?.date ?? today,
  );
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const byDate = React.useMemo(() => new Map(days.map((day) => [day.date, day])), [days]);
  const day = byDate.get(selected) ?? null;

  const act = async <T,>(work: () => Promise<ActionResult<T>>, done: string) => {
    setBusy(true);
    setError(null);
    const result = await work();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    toast(done);
    router.refresh();
    return true;
  };

  const template = React.useMemo(() => {
    const withWindows = [...days].reverse().find((candidate) => candidate.windows.length > 0);
    return withWindows
      ? withWindows.windows.map(({ startMinute, endMinute, quota }) => ({ startMinute, endMinute, quota }))
      : STARTER_WINDOWS;
  }, [days]);

  return (
    <section className="flex flex-col gap-2.5 desktop:col-span-2" aria-labelledby="jadwal-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="jadwal-title" className="s-h2">
            Jadwal preorder
          </h2>
          <p className="text-sm text-ink-soft">
            Nyalakan tanggal yang kalian layani. Tanggal yang nggak dibuka = nggak terima preorder.
          </p>
        </div>
        <CutoffSetting
          cutoffMinute={cutoffMinute}
          busy={busy}
          onSave={(minute) =>
            act(() => setOrderCutoffAction({ orderCutoffMinute: minute }), "Batas pesannya udah disimpan")
          }
        />
      </div>

      {error && (
        <div role="alert" className="s-alert text-sm font-semibold">
          {error}
        </div>
      )}

      <div className="grid gap-4 desktop:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <AdminCalendar today={today} byDate={byDate} selected={selected} onSelect={setSelected} />

        <div className="s-slab p-4">
          <p className="text-[13px] font-semibold text-ink-soft">{formatServiceDate(selected)}</p>

          {!day || !day.isOpen ? (
            <OpenDayForm
              key={selected}
              date={selected}
              reopen={day}
              template={template}
              busy={busy}
              onOpen={(locations, windows) =>
                act(
                  () => openServiceDayAction({ date: selected, locations, windows }),
                  `${formatServiceDate(selected)} dibuka`,
                )
              }
            />
          ) : (
            <DayEditor
              key={day.id}
              day={day}
              busy={busy}
              act={act}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function CutoffSetting({
  cutoffMinute,
  busy,
  onSave,
}: {
  cutoffMinute: number;
  busy: boolean;
  onSave: (minute: number) => void;
}) {
  const [value, setValue] = React.useState(toClock(cutoffMinute));
  const changed = toMinute(value) !== cutoffMinute;
  return (
    <label className="flex items-center gap-2 text-sm text-ink">
      <span className="font-semibold">Batas pesan H-1 jam</span>
      <input
        type="time"
        step={900}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="h-11 rounded-[10px] border-[1.5px] border-line bg-white px-2 tabular-nums"
      />
      {changed && (
        <Button type="button" size="sm" variant="primary" disabled={busy} onClick={() => onSave(toMinute(value))}>
          Simpan
        </Button>
      )}
    </label>
  );
}

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function AdminCalendar({
  today,
  byDate,
  selected,
  onSelect,
}: {
  today: string;
  byDate: Map<string, AdminServiceDay>;
  selected: string;
  onSelect: (date: string) => void;
}) {
  const [month, setMonth] = React.useState(() => Temporal.PlainYearMonth.from(selected.slice(0, 7)));
  const first = month.toPlainDate({ day: 1 });
  const lead = first.dayOfWeek - 1;
  const cells = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: first.daysInMonth }, (_, index) => first.with({ day: index + 1 })),
  ];
  const thisMonth = Temporal.PlainYearMonth.from(today.slice(0, 7));

  return (
    <div className="s-slab p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold text-ink" aria-live="polite">
          {MONTHS[first.month - 1]} {first.year}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Bulan sebelumnya"
            disabled={Temporal.PlainYearMonth.compare(month, thisMonth) <= 0}
            onClick={() => setMonth(month.subtract({ months: 1 }))}
            className="flex h-11 w-11 items-center justify-center rounded-[10px] border-[1.5px] border-line bg-white disabled:opacity-35"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Bulan berikutnya"
            onClick={() => setMonth(month.add({ months: 1 }))}
            className="flex h-11 w-11 items-center justify-center rounded-[10px] border-[1.5px] border-line bg-white"
          >
            ›
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className="pb-1 text-center text-[11.5px] font-semibold text-ink-soft">
            {weekday}
          </span>
        ))}
        {cells.map((cell, position) => {
          if (!cell) return <span key={`blank-${position}`} aria-hidden="true" />;
          const date = cell.toString();
          const day = byDate.get(date);
          const past = date < today;
          const booked = day?.windows.reduce((sum, window) => sum + window.booked, 0) ?? 0;
          const state = day?.isOpen ? "Buka" : day ? "Ditutup" : "Belum dibuka";
          return (
            <button
              key={date}
              type="button"
              disabled={past && !day}
              aria-pressed={selected === date}
              aria-label={`${formatServiceDate(date)}, ${state}${booked ? `, ${booked} pesanan` : ""}`}
              onClick={() => onSelect(date)}
              className={cn(
                "relative flex aspect-square min-h-[40px] flex-col items-center justify-center rounded-[10px] border-[1.5px] text-[13.5px] font-semibold tabular-nums",
                selected === date
                  ? "border-ink bg-ink text-white"
                  : day?.isOpen
                    ? "border-ok bg-ok-soft text-ink"
                    : "border-line bg-white text-ink-soft",
                past && "opacity-50",
              )}
            >
              {cell.day}
              {booked > 0 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute right-1 top-1 rounded-full px-1 text-[9px] leading-[14px]",
                    selected === date ? "bg-white text-ink" : "bg-ink text-white",
                  )}
                >
                  {booked}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[12px] text-ink-soft">Hijau = buka PO · angka kecil = jumlah pesanan</p>
    </div>
  );
}

function LocationChecks({
  value,
  onChange,
  disabled,
}: {
  value: HandoverLocation[];
  onChange: (next: HandoverLocation[]) => void;
  disabled: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="mt-3">
      <legend className="text-[13px] font-semibold text-ink">Lokasi yang dilayani</legend>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {HANDOVER_LOCATIONS.map((location) => {
          const on = value.includes(location);
          return (
            <button
              key={location}
              type="button"
              aria-pressed={on}
              onClick={() =>
                onChange(on ? value.filter((item) => item !== location) : [...value, location])
              }
              className={cn(
                "min-h-[44px] rounded-[10px] border-[1.5px] px-3 text-left text-[13px] font-semibold",
                on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink",
              )}
            >
              {on ? "✓ " : ""}
              {HANDOVER_LABEL[location]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function OpenDayForm({
  date,
  reopen,
  template,
  busy,
  onOpen,
}: {
  date: string;
  reopen: AdminServiceDay | null;
  template: { startMinute: number; endMinute: number; quota: number }[];
  busy: boolean;
  onOpen: (
    locations: HandoverLocation[],
    windows: { startMinute: number; endMinute: number; quota: number }[],
  ) => void;
}) {
  const [locations, setLocations] = React.useState<HandoverLocation[]>(
    reopen?.locations.length ? reopen.locations : ["CAMPUS_B", "CAMPUS_C", "MARKET_DAY", "OTHER"],
  );
  const windows = reopen?.windows.length ? [] : template;

  return (
    <div>
      <p className="mt-1 text-sm text-ink-soft">
        {reopen
          ? "Tanggal ini lagi ditutup. Pesanan yang udah masuk tetap aman."
          : "Tanggal ini belum dibuka untuk preorder."}
      </p>
      <LocationChecks value={locations} onChange={setLocations} disabled={busy} />
      {windows.length > 0 && (
        <p className="mt-3 text-[12.5px] text-ink-soft">
          Jam yang dipakai: {windows.map((window) => windowLabel(window.startMinute, window.endMinute)).join(", ")}{" "}
          (kuota {windows[0]!.quota}). Bisa diubah setelah dibuka.
        </p>
      )}
      <Button
        type="button"
        variant="primary"
        fullWidth
        className="mt-4"
        disabled={busy || locations.length === 0}
        onClick={() => onOpen(locations, windows)}
      >
        {reopen ? "Buka lagi tanggal ini" : `Buka ${formatServiceDate(date)}`}
      </Button>
    </div>
  );
}

function DayEditor({
  day,
  busy,
  act,
}: {
  day: AdminServiceDay;
  busy: boolean;
  act: <T>(work: () => Promise<ActionResult<T>>, done: string) => Promise<boolean>;
}) {
  const [locations, setLocations] = React.useState<HandoverLocation[]>(day.locations);
  const changedLocations =
    [...locations].sort().join() !== [...day.locations].sort().join();
  const [start, setStart] = React.useState("13:00");
  const [end, setEnd] = React.useState("14:00");
  const [quota, setQuota] = React.useState("10");
  const [confirmClose, setConfirmClose] = React.useState(false);

  return (
    <div>
      <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-ok">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-ok" /> Buka untuk preorder
      </p>

      <LocationChecks value={locations} onChange={setLocations} disabled={busy} />
      {changedLocations && (
        <Button
          type="button"
          size="sm"
          variant="primary"
          className="mt-2"
          disabled={busy || locations.length === 0}
          onClick={() =>
            act(() => setDayLocationsAction({ dayId: day.id, locations }), "Lokasinya udah disimpan")
          }
        >
          Simpan lokasi
        </Button>
      )}

      <p className="mt-4 text-[13px] font-semibold text-ink">Rentang jam & kuota</p>
      <ul className="mt-2 flex flex-col gap-2">
        {day.windows.map((window) => (
          <WindowRow key={window.id} window={window} busy={busy} act={act} />
        ))}
      </ul>

      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void act(
            () =>
              addServiceWindowAction({
                dayId: day.id,
                startMinute: toMinute(start),
                endMinute: toMinute(end),
                quota: Number(quota),
              }),
            "Jamnya udah ditambah",
          );
        }}
      >
        <label className="text-[12px] font-semibold text-ink-soft">
          Mulai
          <input type="time" step={900} value={start} onChange={(event) => setStart(event.target.value)} className="mt-1 block h-11 rounded-[10px] border-[1.5px] border-line bg-white px-2" />
        </label>
        <label className="text-[12px] font-semibold text-ink-soft">
          Selesai
          <input type="time" step={900} value={end} onChange={(event) => setEnd(event.target.value)} className="mt-1 block h-11 rounded-[10px] border-[1.5px] border-line bg-white px-2" />
        </label>
        <label className="text-[12px] font-semibold text-ink-soft">
          Kuota
          <input inputMode="numeric" value={quota} onChange={(event) => setQuota(event.target.value.replace(/\D/g, ""))} className="mt-1 block h-11 w-20 rounded-[10px] border-[1.5px] border-line bg-white px-2" />
        </label>
        <Button type="submit" size="sm" variant="ghost" disabled={busy}>
          + Tambah jam
        </Button>
      </form>

      <Button
        type="button"
        variant="flat"
        fullWidth
        className="mt-5"
        disabled={busy}
        onClick={() => {
          if (!confirmClose) {
            setConfirmClose(true);
            return;
          }
          void act(() => closeServiceDayAction(day.id), `${formatServiceDate(day.date)} ditutup`);
        }}
      >
        {confirmClose ? "Yakin tutup? Pesanan yang udah masuk tetap aman" : "Tutup tanggal ini"}
      </Button>
    </div>
  );
}

function WindowRow({
  window,
  busy,
  act,
}: {
  window: AdminServiceDay["windows"][number];
  busy: boolean;
  act: <T>(work: () => Promise<ActionResult<T>>, done: string) => Promise<boolean>;
}) {
  const [quota, setQuota] = React.useState(String(window.quota));
  const changed = Number(quota) !== window.quota && quota !== "";
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-[10px] border-[1.5px] border-line bg-white p-2.5">
      <span className="min-w-[7.5rem] font-semibold tabular-nums text-ink">{window.label}</span>
      <span className="text-[12.5px] text-ink-soft">
        {window.booked}/{window.quota} terisi
      </span>
      <label className="ml-auto flex items-center gap-1.5 text-[12px] text-ink-soft">
        Kuota
        <input
          inputMode="numeric"
          aria-label={`Kuota ${window.label}`}
          value={quota}
          onChange={(event) => setQuota(event.target.value.replace(/\D/g, ""))}
          className="h-11 w-16 rounded-[10px] border-[1.5px] border-line bg-white px-2 text-ink"
        />
      </label>
      {changed && (
        <Button
          type="button"
          size="sm"
          variant="primary"
          disabled={busy}
          onClick={() =>
            act(() => updateWindowQuotaAction({ windowId: window.id, quota: Number(quota) }), "Kuotanya udah disimpan")
          }
        >
          Simpan
        </Button>
      )}
      <button
        type="button"
        aria-label={`Hapus jam ${window.label}`}
        disabled={busy || window.booked > 0}
        title={window.booked > 0 ? "Udah ada pesanan di jam ini" : undefined}
        onClick={() => act(() => deleteServiceWindowAction(window.id), "Jamnya udah dihapus")}
        className="flex h-11 w-11 items-center justify-center rounded-[10px] border-[1.5px] border-line text-ink-soft hover:border-hot hover:text-hot disabled:opacity-40"
      >
        ×
      </button>
    </li>
  );
}
