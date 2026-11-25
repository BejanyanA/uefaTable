import test from "node:test";
import assert from "node:assert/strict";
import { addDays, daysBetween, isValidDate, isValidTimeZone, localDateOf, localDayWindow, utcDatesOf } from "../../routes_endpoints/live/day.js";

const iso = (ms) => new Date(ms).toISOString();

test("dates and time zones are validated", () => {
  assert.equal(isValidDate("2026-11-25"), true);
  assert.equal(isValidDate("2026-02-30"), false);
  assert.equal(isValidDate("26-11-25"), false);
  assert.equal(isValidDate(undefined), false);
  assert.equal(isValidTimeZone("Asia/Yerevan"), true);
  assert.equal(isValidTimeZone("UTC"), true);
  assert.equal(isValidTimeZone("Mars/Olympus"), false);
  assert.equal(isValidTimeZone(""), false);
  assert.equal(isValidTimeZone("x".repeat(100)), false);
});

test("day arithmetic", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(daysBetween("2026-11-25", "2026-12-02"), 7);
  assert.equal(daysBetween("2026-11-25", "2026-11-20"), -5);
});

test("the viewer's day starts at their own midnight", () => {
  const yerevan = localDayWindow("2026-11-25", "Asia/Yerevan"); // UTC+4
  assert.equal(iso(yerevan.start), "2026-11-24T20:00:00.000Z");
  assert.equal(iso(yerevan.end), "2026-11-25T20:00:00.000Z");

  const la = localDayWindow("2026-11-25", "America/Los_Angeles"); // UTC-8
  assert.equal(iso(la.start), "2026-11-25T08:00:00.000Z");
  assert.equal(iso(la.end), "2026-11-26T08:00:00.000Z");

  const utc = localDayWindow("2026-11-25", "UTC");
  assert.equal(iso(utc.start), "2026-11-25T00:00:00.000Z");
});

test("days when the clocks change are 23 or 25 hours long", () => {
  const hours = (w) => (w.end - w.start) / 3600000;
  assert.equal(hours(localDayWindow("2026-03-29", "Europe/Paris")), 23);
  assert.equal(hours(localDayWindow("2026-10-25", "Europe/Paris")), 25);
  assert.equal(hours(localDayWindow("2026-11-25", "Europe/Paris")), 24);
  assert.equal(iso(localDayWindow("2026-03-29", "Europe/Paris").start), "2026-03-28T23:00:00.000Z");
  assert.equal(iso(localDayWindow("2026-03-30", "Europe/Paris").start), "2026-03-29T22:00:00.000Z");
});

test("a viewer's day touches one or two UTC dates", () => {
  assert.deepEqual(utcDatesOf(localDayWindow("2026-11-25", "UTC")), ["2026-11-25"]);
  assert.deepEqual(utcDatesOf(localDayWindow("2026-11-25", "Asia/Yerevan")), ["2026-11-24", "2026-11-25"]);
  assert.deepEqual(utcDatesOf(localDayWindow("2026-11-25", "America/Los_Angeles")), ["2026-11-25", "2026-11-26"]);
});

test("what date it is depends on where the viewer is", () => {
  const instant = Date.parse("2026-11-25T21:30:00Z");
  assert.equal(localDateOf(instant, "UTC"), "2026-11-25");
  assert.equal(localDateOf(instant, "Asia/Yerevan"), "2026-11-26");
  assert.equal(localDateOf(instant, "America/Los_Angeles"), "2026-11-25");
});
