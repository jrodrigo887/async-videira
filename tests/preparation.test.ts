import test from "node:test";
import assert from "node:assert/strict";
import { createPreparation, isStale } from "../src/domain/preparation/preparation.ts";
import type { HolyricsSchedule } from "../src/domain/types.ts";

const hash = (value: unknown) => JSON.stringify(value);
const setlist = { setlistId: "s1", title: "Culto", items: [] } as never;
const catalog = [{ id: "h1", title: "Santo", artist: "X" }] as never;
const fingerprint = { baseDir: "C:\\Holyrics", platform: "win", ip_list: ["192.168.1.2"], idsHash: "abc" } as never;
const temporary = (datetime: string) => ({ type: "temporary", name: "Temporário", datetime } as HolyricsSchedule);
const agenda = (datetime: string, eventId: number) => ({ type: "event", name: "Culto", datetime, metadata: { event: { id: eventId } } } as HolyricsSchedule);

const prepare = (schedule: HolyricsSchedule) =>
  createPreparation({ chosenId: "s1", setlist, catalog, fingerprint, schedule, plan: { items: [] } as never, preparedAt: "2026-10-30T19:45:00.000Z", hash });
const stale = (prepared: ReturnType<typeof prepare>, schedule: HolyricsSchedule) => isStale(prepared, { setlist, catalog, fingerprint, schedule }, hash);

test("a temporary destination does not go stale when its clock minute moves on", () => {
  const prepared = prepare(temporary("2026-10-30 16:45"));
  assert.equal(stale(prepared, temporary("2026-10-30 16:46")), false);
  assert.equal(prepared.schedule.datetime, "2026-10-30 16:45", "the shown time is still kept");
});

test("the time of a temporary destination never makes a preparation stale", () => {
  const prepared = prepare(temporary("2026-10-30 10:00"));
  assert.equal(stale(prepared, temporary("2026-10-30 23:59")), false);
  assert.equal(stale(prepared, temporary("2026-11-05 03:00")), false);
});

test("switching from a temporary destination to an agenda event is still detected", () => {
  assert.equal(stale(prepare(temporary("2026-10-30 16:45")), agenda("2026-10-30 16:45", 7)), true);
});

test("an agenda event going stale on date or event is still detected", () => {
  const prepared = prepare(agenda("2026-10-30 19:00", 7));
  assert.equal(stale(prepared, agenda("2026-10-30 19:00", 7)), false);
  assert.equal(stale(prepared, agenda("2026-10-31 19:00", 7)), true);
  assert.equal(stale(prepared, agenda("2026-10-30 19:00", 8)), true);
});
