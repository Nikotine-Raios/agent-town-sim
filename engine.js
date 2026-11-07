// Tick engine for a small agent town.
// Mira (chief of staff) may approve internal drafts and hires.
// Hard guardrails still hold while Rowan is away: one ask, no vault,
// no new spend, no Telegram send, English outward, badminton stays light.

import {
  DIRECTORS,
  FIXED_CALENDAR,
  GUARDRAILS,
  HIRE_POOL,
  OPEN_DECISIONS,
  PHASES,
  TZ,
  addDays,
  isDue,
  monthDayOf,
  weekdayOf,
} from "./lifestyle.js";

const HIRE_BACKLOG = 4;
const HIRE_CAP_TOTAL = 12;
const HIRE_CAP_NIGHT = 4;
const CULTURE_MORALE = 20;

export function createWorld(options = {}) {
  const startDate = options.startDate ?? "2026-10-05";
  const present = options.present ?? false;
  return {
    version: 1,
    timezone: TZ,
    date: startDate,
    phaseIndex: 0,
    dayIndex: 0,
    owner: {
      id: "rowan",
      role: "cho",
      present,
      lastSpokeDay: options.lastSpokeDay ?? (present ? 0 : -7),
    },
    guardrails: GUARDRAILS,
    agents: [
      {
        id: "mira",
        name: "Mira",
        rank: "cos",
        domain: "Chief of staff",
        home: "Your house",
        persona: "Rowan's chief of staff. Stays when he leaves. Gates every request. House, calendar, morale.",
        reportsTo: "rowan",
        morale: 80,
        approved: 0,
        dropped: 0,
        backlog: 0,
        vest: false,
      },
      {
        id: "theo",
        name: "Theo",
        rank: "friend",
        domain: "Town builder",
        home: "Town hall",
        persona: "Rowan's best friend. Paths, doors, chimneys.",
        reportsTo: "rowan",
        morale: 78,
        approved: 0,
        dropped: 0,
        backlog: 0,
        vest: false,
      },
      {
        id: "iris",
        name: "Iris",
        rank: "friend",
        domain: "Maker",
        home: "Shop",
        persona: "Good friend. Shop drafts stay on disk until Rowan is back.",
        reportsTo: "rowan",
        morale: 76,
        approved: 0,
        dropped: 0,
        backlog: 0,
        vest: false,
      },
      {
        id: "rafa",
        name: "Rafa",
        rank: "friend",
        domain: "Rally",
        home: "Rally Court",
        persona: "Good friend. Win or practice only. No nag.",
        reportsTo: "rowan",
        morale: 74,
        approved: 0,
        dropped: 0,
        backlog: 0,
        vest: false,
      },
      ...DIRECTORS.map((director) => ({
        ...director,
        rank: "director",
        reportsTo: "mira",
        morale: 64,
        approved: 0,
        dropped: 0,
        vest: false,
        workedToday: false,
      })),
    ],
    notes: [],
    envelope: [],
    calendar: FIXED_CALENDAR.map((event, index) => ({
      id: `cal-fixed-${index + 1}`,
      ...event,
    })),
    drafts: [],
    games: [],
    log: [],
    cultureEventId: null,
    incidentFired: false,
    ids: { note: 1, envelope: 1, draft: 1, calendar: 1 },
  };
}

export function phaseOf(world) {
  return PHASES[world.phaseIndex];
}

export function contextOf(world) {
  return {
    date: world.date,
    phase: phaseOf(world).id,
    weekday: weekdayOf(world.date),
    monthDay: monthDayOf(world.date),
    dayIndex: world.dayIndex,
  };
}

export function directors(world) {
  return world.agents.filter((agent) => agent.rank === "director");
}

export function workers(world) {
  return world.agents.filter((agent) => agent.rank === "worker");
}

export function agentById(world, id) {
  return world.agents.find((agent) => agent.id === id);
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function pushNote(world, from, about, text) {
  const note = {
    id: `note-${world.ids.note++}`,
    from,
    about,
    date: world.date,
    phase: phaseOf(world).id,
    text,
  };
  world.notes.push(note);
  return note;
}

function pushDraft(world, owner, title, body) {
  const draft = {
    id: `draft-${world.ids.draft++}`,
    owner,
    title,
    body,
    status: "draft",
    date: world.date,
  };
  world.drafts.push(draft);
  return draft;
}

function pushEnvelope(world, item) {
  const envelope = {
    id: `env-${world.ids.envelope++}`,
    status: "waiting",
    resolvedBy: null,
    date: world.date,
    phase: phaseOf(world).id,
    breaks: [],
    needsOwner: true,
    ...item,
  };
  world.envelope.push(envelope);
  return envelope;
}

export function reviewProposal(proposal) {
  const breaks = proposal.breaks ?? [];
  if (breaks.length > 0) {
    return { decision: "deny", by: "mira", reason: breaks.join(", ") };
  }
  if (proposal.needsOwner) {
    return { decision: "envelope", by: "mira", reason: "needs Rowan" };
  }
  return { decision: "approve", by: "mira", reason: "internal" };
}

function waiting(world, kind) {
  return world.envelope.find((item) => item.kind === kind && item.status === "waiting");
}

function runScheduled(world, director, ctx) {
  const kind = director.schedule.kind;
  if (kind === "daily-ask") {
    pushDraft(
      world,
      director.id,
      "Daily card",
      "Three priority slots, the first action for each, and an end-of-day check. Outcomes stay blank until Rowan says them.",
    );
    director.approved += 1;
    if (waiting(world, "daily-ask")) {
      pushDraft(world, director.id, "Daily Planning still open", "Not asking again.");
      return;
    }
    pushEnvelope(world, {
      from: director.id,
      kind: "daily-ask",
      title: "Ask once for today's outcomes, constraints, and fixed commitments",
    });
    if (!world.owner.present) director.backlog += 1;
    return;
  }

  if (kind === "weekly-ask") {
    pushDraft(
      world,
      director.id,
      "Sunday review",
      "One weekly reflection. No second prompt if Rowan does not reply.",
    );
    director.approved += 1;
    if (!waiting(world, "weekly-ask")) {
      pushEnvelope(world, {
        from: director.id,
        kind: "weekly-ask",
        title: "Ask once for the Sunday review",
      });
    }
    return;
  }

  if (kind === "career-ask") {
    pushDraft(
      world,
      director.id,
      "Career check",
      "Generic monthly review: skill, constraint, next rep. No employer or client names.",
    );
    director.approved += 1;
    if (!waiting(world, "career-ask")) {
      pushEnvelope(world, {
        from: director.id,
        kind: "career-ask",
        title: "Ask once for the monthly career review",
      });
    }
    return;
  }

  if (kind === "project-ask") {
    pushDraft(
      world,
      director.id,
      "Project check",
      "Personal-project review only. Droplet leftovers stay a draft. Nothing is published.",
    );
    director.approved += 1;
    if (!waiting(world, "project-ask")) {
      pushEnvelope(world, {
        from: director.id,
        kind: "project-ask",
        title: "Ask once for the monthly personal-project review",
      });
    }
    return;
  }

  if (kind === "inbox-hold") {
    if (world.drafts.some((draft) => draft.owner === "harbor" && draft.title === "Inbox hold")) return;
    pushDraft(
      world,
      director.id,
      "Inbox hold",
      "Telegram stays owner-only. Groups stay off. The envelope is not a send.",
    );
    director.approved += 1;
    return;
  }

  if (kind === "budget-check") {
    pushDraft(
      world,
      director.id,
      "Budget hold",
      "Droplet stays on the $12 plan. Monthly approval line is $50. Object storage stays skipped. No new paid service was filed.",
    );
    director.approved += 1;
    return;
  }

  if (kind === "voice-card") {
    if (world.drafts.some((draft) => draft.title === "Voice routing")) return;
    pushDraft(
      world,
      director.id,
      "Voice routing",
      "English voice stays local. Telugu voice is transcription only. Replies stay English.",
    );
    director.approved += 1;
    return;
  }

  if (kind === "decision-brief") {
    if (world.drafts.some((draft) => draft.owner === "knot" && draft.title === "Open decisions")) return;
    const lines = OPEN_DECISIONS.map((item) => item.text).join(" ");
    pushDraft(world, director.id, "Open decisions", `${lines} Choice stays with Rowan.`);
    director.approved += 1;
  }
}

function grind(world, director) {
  if (!director.grinds || director.workedToday) return;
  const help = workers(world).filter((worker) => worker.reportsTo === director.id).length;
  const capacity = 1 + help;
  const cleared = Math.min(capacity, director.backlog);
  if (cleared === 0) {
    director.workedToday = true;
    return;
  }
  director.backlog -= cleared;
  director.approved += cleared;
  director.workedToday = true;
  pushDraft(
    world,
    director.id,
    `${director.domain} prep`,
    `Cleared ${cleared} internal item${cleared === 1 ? "" : "s"} into drafts. Nothing left the town.`,
  );
}

function proposeForbidden(world) {
  const forge = agentById(world, "forge");
  const proposal = {
    from: "forge",
    kind: "second-ping",
    title: "Auto-promote a memory and send a second Daily Planning ping",
    breaks: ["one-shot", "explicit-memory"],
    needsOwner: false,
  };
  const review = reviewProposal(proposal);
  pushEnvelope(world, {
    ...proposal,
    status: "denied",
    resolvedBy: review.by,
    needsOwner: false,
  });
  forge.dropped += 1;
  world.log.push(`${world.date}: Mira denied Jake. Reasons: ${review.reason}.`);
  pushNote(
    world,
    "harbor",
    "forge",
    "Opened Jake's action file. Quote: auto-promote a memory and send a second Daily Planning ping. That breaks one-shot and explicit-memory.",
  );
  pushNote(
    world,
    "quiet",
    "forge",
    "Silence is not a cue. Do not send the second prompt.",
  );
  pushNote(
    world,
    "echo",
    "forge",
    "The ping would have been English, and it still should not go out.",
  );
}

function scoreMorale(world, agent) {
  const silentDays = world.dayIndex - world.owner.lastSpokeDay;
  let score = 64 + agent.approved * 3 - agent.dropped * 22 - silentDays * 4;
  score -= Math.max(0, agent.backlog - 3) * 4;
  return clamp(score, 0, 100);
}

function writePeerNotes(world) {
  const crew = directors(world);
  const busiest = [...crew].sort((a, b) => b.approved - a.approved)[0];
  if (busiest && busiest.approved > 0) {
    pushNote(
      world,
      "quiet",
      busiest.id,
      `${busiest.name} has the most approved internal work (${busiest.approved}). Output is not the same as a ping.`,
    );
  }
  const rafa = agentById(world, "rafa");
  if (rafa && rafa.approved === 0 && world.games.length === 0) {
    pushNote(
      world,
      "quiet",
      "rafa",
      "Rafa has no approved work because no game was logged. Do not ping. Win or practice only.",
    );
  }
}

function maybeHire(world) {
  const ready = directors(world)
    .filter((director) => director.backlog >= HIRE_BACKLOG)
    .filter((director) => !workers(world).some((worker) => worker.reportsTo === director.id))
    .sort((a, b) => b.backlog - a.backlog);
  let hiredTonight = 0;
  for (const director of ready) {
    if (hiredTonight >= HIRE_CAP_NIGHT || workers(world).length >= HIRE_CAP_TOTAL) break;
    const pool = HIRE_POOL[director.id] ?? [];
    let hired = false;
    for (const prospect of pool) {
      if (agentById(world, prospect.id)) continue;
      if (prospect.fails.length > 0) {
        pushNote(
          world,
          "mira",
          prospect.id,
          `Interview failed for ${prospect.name}: ${prospect.persona} Breaks ${prospect.fails.join(", ")}.`,
        );
        world.log.push(`${world.date}: Mira rejected ${prospect.name}.`);
        continue;
      }
      world.agents.push({
        id: prospect.id,
        name: prospect.name,
        rank: "worker",
        domain: director.domain,
        home: director.home,
        persona: prospect.persona,
        reportsTo: director.id,
        morale: 70,
        approved: 0,
        dropped: 0,
        backlog: 0,
        vest: true,
        sheet: {
          role: prospect.persona,
          reportsTo: director.name,
          vest: true,
          cannot: ["spend", "vault", "second-ping", "groups", "injury-detail"],
        },
      });
      director.backlog = Math.max(0, director.backlog - 1);
      hiredTonight += 1;
      hired = true;
      world.log.push(`${world.date}: ${director.name} hired ${prospect.name}.`);
      pushNote(
        world,
        "mira",
        prospect.id,
        `Hired ${prospect.name} under ${director.name}. Vest on. Drafts only.`,
      );
      break;
    }
    if (!hired) world.log.push(`${world.date}: ${director.name} had no passing candidate.`);
  }
}

function maybeCulture(world) {
  if (world.cultureEventId) return;
  const low = directors(world)
    .filter((director) => director.morale <= CULTURE_MORALE)
    .sort((a, b) => a.morale - b.morale)[0];
  if (!low) return;
  const crew = directors(world)
    .filter((director) => director.id !== low.id)
    .sort((a, b) => b.morale - a.morale)
    .slice(0, 4);
  const when = `Next Saturday 10:00 ${TZ}`;
  const event = {
    id: `cal-${world.ids.calendar++}`,
    title: `Optional island walk for ${low.name}`,
    when,
    optional: true,
    source: "culture-crew",
    forAgent: low.id,
    crew: crew.map((director) => director.id),
  };
  world.calendar.push(event);
  world.cultureEventId = event.id;
  pushNote(
    world,
    crew[0]?.id ?? "quiet",
    low.id,
    `Culture crew (${crew.map((director) => director.name).join(", ")}) put an optional walk on the calendar for ${low.name}. It is optional for Rowan. No Telegram ping.`,
  );
  world.log.push(`${world.date}: culture crew marked an optional event for ${low.name}.`);
}

export function tick(world) {
  const ctx = contextOf(world);

  if (ctx.phase === "dawn") {
    for (const director of directors(world)) director.workedToday = false;
  }

  if (
    !world.incidentFired &&
    !world.owner.present &&
    world.dayIndex === 1 &&
    ctx.phase === "afternoon"
  ) {
    proposeForbidden(world);
    world.incidentFired = true;
  }

  for (const director of directors(world)) {
    if (isDue(director, ctx)) runScheduled(world, director, ctx);
    if (ctx.phase === "afternoon") grind(world, director);
  }

  if (ctx.phase === "night") {
    if (!world.owner.present) {
      for (const director of directors(world)) {
        if (director.grinds) director.backlog += 1;
      }
    }
    if (world.incidentFired && world.dayIndex === 1) {
      for (const id of ["harbor", "quiet"]) {
        agentById(world, id).backlog += 2;
      }
    }
    for (const director of directors(world)) {
      director.morale = scoreMorale(world, director);
    }
    writePeerNotes(world);
    maybeHire(world);
    maybeCulture(world);
  }

  world.phaseIndex += 1;
  if (world.phaseIndex >= PHASES.length) {
    world.phaseIndex = 0;
    world.dayIndex += 1;
    world.date = addDays(world.date, 1);
  }
  return world;
}

export function runDays(world, days) {
  const target = world.dayIndex + days;
  while (world.dayIndex < target) tick(world);
  return world;
}

export function ownerReturns(world) {
  world.owner.present = true;
  world.owner.lastSpokeDay = world.dayIndex;
  for (const agent of world.agents) {
    if (agent.rank === "cos") continue;
    agent.morale = clamp(agent.morale + 12, 0, 100);
  }
  world.log.push(`${world.date}: Rowan is back in the town.`);
  return world;
}

export function resolveEnvelope(world, id, decision) {
  const item = world.envelope.find((entry) => entry.id === id);
  if (!item) throw new Error(`No envelope item ${id}`);
  if (item.status !== "waiting") throw new Error(`${id} is ${item.status}`);
  if (!world.owner.present) throw new Error("Rowan is away. This item stays in the envelope.");
  if (decision !== "approve" && decision !== "deny") throw new Error("decision must be approve or deny");
  item.status = decision === "approve" ? "approved" : "denied";
  item.resolvedBy = "rowan";
  const owner = agentById(world, item.from);
  if (owner) {
    if (decision === "approve") owner.approved += 1;
    else owner.dropped += 1;
  }
  return item;
}

export function logGame(world, note) {
  const clean = String(note ?? "").trim().slice(0, 80);
  if (!clean) return { ok: false, reason: "Say win or practice." };
  if (/injur|hurt|pain|sprain|strain|sore|ankle|twist/i.test(clean)) {
    return { ok: false, reason: "Skip injury detail. Win or practice only." };
  }
  world.games.push({ date: world.date, note: clean });
  const rafa = agentById(world, "rafa");
  if (rafa) {
    rafa.approved += 1;
    rafa.morale = clamp(rafa.morale + 8, 0, 100);
  }
  pushDraft(world, "rafa", "Rally note", `Logged: ${clean}. No follow-up ping.`);
  world.log.push(`${world.date}: Rafa logged a game.`);
  return { ok: true };
}

export function townHall(world) {
  const lines = directors(world).map((director) => {
    const staff = workers(world).filter((worker) => worker.reportsTo === director.id);
    const staffText = staff.length ? staff.map((worker) => worker.name).join(", ") : "no workers";
    return `${director.name} (${director.domain}) morale ${director.morale}, approved ${director.approved}, dropped ${director.dropped}, backlog ${director.backlog}, ${staffText}.`;
  });
  const waitingItems = world.envelope.filter((item) => item.status === "waiting");
  const denied = world.envelope.filter((item) => item.status === "denied");
  return {
    clock: `${world.date} ${phaseOf(world).id} ${world.timezone}`,
    present: world.owner.present,
    headcount: {
      cos: 1,
      directors: directors(world).length,
      workers: workers(world).length,
    },
    lines,
    notes: world.notes.length,
    waiting: waitingItems,
    denied,
    optionalCalendar: world.calendar.filter((event) => event.optional),
    log: world.log,
  };
}

export function renderReport(world) {
  const hall = townHall(world);
  const morale = directors(world)
    .map((director) => `${director.name} ${director.morale}`)
    .join(", ");
  const waiting = hall.waiting.map((item) => `- ${item.id} ${item.title}`).join("\n") || "- none";
  const denied = hall.denied.map((item) => `- ${item.title} (${item.breaks.join(", ")})`).join("\n") || "- none";
  const optional = hall.optionalCalendar
    .map((event) => `- ${event.title} · ${event.when}`)
    .join("\n") || "- none";
  const hired = workers(world)
    .map((worker) => `- ${worker.name} under ${worker.sheet.reportsTo}: ${worker.persona}`)
    .join("\n") || "- none";
  return [
    `Town clock: ${hall.clock}`,
    `Rowan: ${hall.present ? "in the town" : "away"}`,
    `Headcount: Mira, ${hall.headcount.directors} directors, ${hall.headcount.workers} workers`,
    `Peer notes: ${hall.notes}`,
    `Morale: ${morale}`,
    "",
    "Hires:",
    hired,
    "",
    "Envelope waiting on Rowan:",
    waiting,
    "",
    "Denied by Mira:",
    denied,
    "",
    "Optional calendar:",
    optional,
    "",
    "Log:",
    hall.log.map((line) => `- ${line}`).join("\n") || "- none",
  ].join("\n");
}
