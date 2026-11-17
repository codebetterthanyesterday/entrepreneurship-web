import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import {
  cutoffInstant,
  describeHandover,
  formatServiceDate,
  isBookable,
  isValidWindow,
  needsLocationReview,
  parseServiceDate,
  todayInJakarta,
  windowLabel,
} from "@/lib/schedule";

const at = (iso: string) => Temporal.Instant.from(iso);
const CUTOFF = 21 * 60;

describe("a date can be booked until 21.00 WIB the day before", () => {
  it("is open at 20.59 on the day before and closed from 21.00", () => {
    expect(isBookable("2026-11-24", CUTOFF, at("2026-11-23T20:59:00+07:00"))).toBe(true);
    expect(isBookable("2026-11-24", CUTOFF, at("2026-11-23T21:00:00+07:00"))).toBe(false);
  });

  it("is closed on the day itself", () => {
    expect(isBookable("2026-11-24", CUTOFF, at("2026-11-24T08:00:00+07:00"))).toBe(false);
  });

  it("goes by Jakarta's clock, not the server's", () => {
    // 14.30 UTC is 21.30 in Jakarta: past the cut-off already.
    expect(isBookable("2026-11-24", CUTOFF, at("2026-11-23T14:30:00Z"))).toBe(false);
    expect(cutoffInstant("2026-11-24", CUTOFF).toString()).toBe("2026-11-23T14:00:00Z");
  });

  it("follows a different cut-off set by staff", () => {
    expect(isBookable("2026-11-24", 12 * 60, at("2026-11-23T12:30:00+07:00"))).toBe(false);
  });

  it("refuses a date that is not a real calendar date", () => {
    expect(isBookable("2026-02-30", CUTOFF, at("2026-01-01T00:00:00+07:00"))).toBe(false);
    expect(parseServiceDate("24/11/2026")).toBeNull();
  });
});

describe("time ranges", () => {
  it("are written with a dot, as in the booth's signs", () => {
    expect(windowLabel(660, 720)).toBe("11.00 - 12.00");
    expect(windowLabel(570, 600)).toBe("09.30 - 10.00");
  });

  it("must sit inside one day and last at least 15 minutes", () => {
    expect(isValidWindow(660, 720)).toBe(true);
    expect(isValidWindow(720, 660)).toBe(false);
    expect(isValidWindow(660, 670)).toBe(false);
    expect(isValidWindow(1380, 1500)).toBe(false);
  });
});

describe("describeHandover", () => {
  it("says the date, the range, the place and the meeting point in one line", () => {
    expect(
      describeHandover({
        serviceDate: "2026-11-19",
        pickupSlot: "11.00 - 12.00",
        handoverLocation: "CAMPUS_C",
        handoverDetail: " Depan gazebo ",
      }),
    ).toBe("Kamis, 19 Nov 2026 · 11.00 - 12.00 · Kampus C (Minangkabau) · Depan gazebo");
  });

  it("still reads for an order from before the schedule, which has only the range", () => {
    expect(describeHandover({ pickupSlot: "09.00 - 10.00" })).toBe("09.00 - 10.00");
  });
});

describe("needsLocationReview", () => {
  it("holds a 'Lainnya' order until staff accept it, and nothing else", () => {
    expect(needsLocationReview({ handoverLocation: "OTHER", locationReviewedAt: null })).toBe(true);
    expect(needsLocationReview({ handoverLocation: "OTHER", locationReviewedAt: "x" })).toBe(false);
    expect(needsLocationReview({ handoverLocation: "OTHER", status: "CANCELLED" })).toBe(false);
    expect(needsLocationReview({ handoverLocation: "CAMPUS_B" })).toBe(false);
  });
});

describe("dates", () => {
  it("names the day in Indonesian", () => {
    expect(formatServiceDate("2026-11-24")).toBe("Selasa, 24 Nov 2026");
  });

  it("takes today from Jakarta", () => {
    expect(todayInJakarta(at("2026-11-23T18:00:00Z"))).toBe("2026-11-24");
  });
});
