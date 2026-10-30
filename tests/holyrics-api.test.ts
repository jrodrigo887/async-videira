import assert from "node:assert/strict";
import test from "node:test";
import { createHolyricsClient } from "../src/adapters/holyrics-api/client.ts";

test("getCurrentSchedule accepts both the observed array response and object form", async () => {
  const current = { type: "temporary", name: "Temporário", datetime: "2026-11-01 10:00" };
  const arrayClient = createHolyricsClient({
    token: "fake",
    fetchImpl: async () => new Response(JSON.stringify({ status: "ok", data: [current, { name: "ignored" }] })),
  });
  const objectClient = createHolyricsClient({
    token: "fake",
    fetchImpl: async () => new Response(JSON.stringify({ status: "ok", data: current })),
  });
  assert.deepEqual(await arrayClient.getCurrentSchedule(), current);
  assert.deepEqual(await objectClient.getCurrentSchedule(), current);
});
