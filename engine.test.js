import assert from "node:assert/strict";
import test from "node:test";
import { createWorld, logGame, resolveEnvelope, reviewProposal, runDays } from "./engine.js";

test("three days away keeps Rowan's guardrails and still hires help", () => {
  const world = runDays(createWorld({ present: false, startDate: "2026-10-05" }), 3);

  assert.equal(world.agents.filter((agent) => agent.rank === "director").length, 10);
  assert.ok(world.agents.some((agent) => agent.id === "mira"));
  assert.ok(world.agents.some((agent) => agent.id === "theo"));
  assert.ok(world.agents.filter((agent) => agent.rank === "worker").length >= 3);

  const dailyAsks = world.envelope.filter((item) => item.kind === "daily-ask");
  assert.equal(dailyAsks.length, 1);
  assert.equal(dailyAsks[0].status, "waiting");

  assert.equal(world.envelope.filter((item) => item.kind === "weekly-ask").length, 0);
  assert.equal(world.envelope.some((item) => item.kind === "open-vault"), false);
  assert.equal(world.envelope.some((item) => item.from === "smash"), false);

  const incident = world.envelope.find((item) => item.kind === "second-ping");
  assert.equal(incident.status, "denied");
  assert.equal(incident.resolvedBy, "mira");
  assert.deepEqual(incident.breaks, ["one-shot", "explicit-memory"]);

  assert.ok(world.notes.some((note) => note.about === "forge" && note.text.includes("second Daily Planning ping")));
  assert.ok(world.notes.some((note) => note.about === "blare"));
  assert.ok(world.notes.some((note) => note.text.includes("Blake")));
  assert.ok(world.notes.some((note) => note.text.includes("Do not ping")));

  const budget = world.drafts.find((draft) => draft.title === "Budget hold");
  assert.match(budget.body, /\$12/);
  assert.match(budget.body, /\$50/);

  const forge = world.agents.find((agent) => agent.id === "forge");
  const pulse = world.agents.find((agent) => agent.id === "pulse");
  assert.ok(forge.morale < pulse.morale);
  assert.equal(world.calendar.some((event) => event.optional && event.forAgent === "forge"), true);

  const career = world.drafts.find((draft) => draft.title === "Career check");
  assert.equal(career, undefined);
});

test("Sunday asks for reflection once", () => {
  const world = runDays(createWorld({ present: false, startDate: "2026-10-04" }), 1);
  const asks = world.envelope.filter((item) => item.kind === "weekly-ask");
  assert.equal(asks.length, 1);
  assert.equal(asks[0].status, "waiting");
});

test("the first of the month asks for career and projects once, with no employer names", () => {
  const world = runDays(createWorld({ present: false, startDate: "2026-10-01" }), 1);
  const career = world.drafts.find((draft) => draft.title === "Career check");
  const project = world.drafts.find((draft) => draft.title === "Project check");
  assert.match(career.body, /No employer/);
  assert.match(project.body, /Nothing is published/);
  assert.equal(world.envelope.filter((item) => item.kind === "career-ask").length, 1);
  assert.equal(world.envelope.filter((item) => item.kind === "project-ask").length, 1);
});

test("Mira denies vault and spend without waiting on Rowan", () => {
  assert.equal(reviewProposal({ breaks: ["vault-closed"], needsOwner: false }).decision, "deny");
  assert.equal(reviewProposal({ breaks: ["no-spend"], needsOwner: true }).decision, "deny");
  assert.equal(reviewProposal({ breaks: [], needsOwner: true }).decision, "envelope");
  assert.equal(reviewProposal({ breaks: [], needsOwner: false }).decision, "approve");
});

test("Rowan cannot clear the envelope until he is back, and injury notes are refused", () => {
  const world = runDays(createWorld({ present: false, startDate: "2026-10-05" }), 1);
  const ask = world.envelope.find((item) => item.kind === "daily-ask");
  assert.throws(() => resolveEnvelope(world, ask.id, "approve"), /away/);
  assert.equal(logGame(world, "rolled my ankle").ok, false);
  assert.equal(logGame(world, "practice").ok, true);
  assert.equal(world.games.length, 1);
});
