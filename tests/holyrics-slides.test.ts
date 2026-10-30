import test from "node:test";
import assert from "node:assert/strict";
import { toHolyricsSlides } from "../src/domain/lyrics/holyrics-slides.ts";

test("blocks within the limit stay as they are, one blank line apart", () => {
  assert.equal(toHolyricsSlides("a\nb\n\nc\nd\ne"), "a\nb\n\nc\nd\ne");
});

test("a long section is split into evenly sized slides", () => {
  assert.equal(toHolyricsSlides("1\n2\n3\n4\n5\n6"), "1\n2\n3\n\n4\n5\n6");
  assert.equal(toHolyricsSlides("1\n2\n3\n4\n5"), "1\n2\n3\n\n4\n5");
  assert.equal(toHolyricsSlides("1\n2\n3\n4\n5\n6\n7\n8"), "1\n2\n3\n4\n\n5\n6\n7\n8");
});

test("extra blank lines, spaces and CRLF are normalised", () => {
  assert.equal(toHolyricsSlides("  a \r\n b\r\n\r\n\r\n   \r\nc\r\n"), "a\nb\n\nc");
});

test("an empty lyrics text stays empty", () => {
  assert.equal(toHolyricsSlides(" \n\n "), "");
});
