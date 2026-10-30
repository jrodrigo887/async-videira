import test from "node:test";
import assert from "node:assert/strict";
import { createVideiraClient, VideiraApiError } from "../src/adapters/videira/client.ts";

function respond(status: number, body: unknown) {
  return async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

test("listPublishedSetlists treats 404 SETLISTS_NOT_FOUND as an empty list", async () => {
  const client = createVideiraClient({ token: "test-token", fetchImpl: respond(404, { error: { code: "SETLISTS_NOT_FOUND", message: "Nenhum setlist publicado a partir de hoje." } }) });
  assert.deepEqual(await client.listPublishedSetlists(), { setlists: [] });
});

test("listPublishedSetlists still fails on other 404 responses", async () => {
  const client = createVideiraClient({ token: "test-token", fetchImpl: respond(404, { error: { code: "ROUTE_NOT_FOUND" } }) });
  await assert.rejects(client.listPublishedSetlists(), (error) => error instanceof VideiraApiError && error.status === 404);
});
