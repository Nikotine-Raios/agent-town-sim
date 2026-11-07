import assert from "node:assert/strict";
import test from "node:test";
import { buildPrompt, fallbackSpeech } from "./brain.js";
import { createWorld, runDays } from "./engine.js";

test("fallback speech stays drafts-only and names Mira", () => {
  const world = runDays(createWorld({ present: false, startDate: "2026-10-05" }), 3);
  const lines = fallbackSpeech(world, "tick");
  assert.ok(lines.some((row) => row.id === "mira"));
  const blob = lines.map((row) => row.line).join(" ");
  assert.equal(/telegram|vault|paypal|stripe|spend \$/i.test(blob), false);
});

test("meeting fallback covers directors", () => {
  const world = createWorld({ present: false, startDate: "2026-10-05" });
  const lines = fallbackSpeech(world, "meeting");
  assert.ok(lines.length >= 6);
  assert.ok(lines.every((row) => row.line.length > 0));
});

test("ollama prompt repeats the closed gates", () => {
  const world = createWorld({ present: false, startDate: "2026-10-05" });
  const prompt = buildPrompt(world, "tick");
  assert.match(prompt, /mira\|Mira/);
  assert.match(prompt, /Rowan: away/);
});
