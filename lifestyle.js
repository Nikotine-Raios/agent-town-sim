// Rowan's town. The video's shape (chief human officer, chief of staff,
// ten directors, hires, notes, morale, envelope, optional calendar) mapped
// onto the life this repo already runs. No employer names, no second pings.

export const TZ = "UTC";

export const PHASES = [
  { id: "dawn", hour: 6 },
  { id: "morning", hour: 8 },
  { id: "afternoon", hour: 13 },
  { id: "evening", hour: 18 },
  { id: "night", hour: 22 },
];

export const GUARDRAILS = [
  { id: "one-shot", text: "Ask Rowan once. Silence is not a second prompt." },
  { id: "explicit-memory", text: "Save or promote memory only when Rowan explicitly asks." },
  { id: "no-confidential", text: "Career notes stay generic. No employer or client specifics." },
  { id: "vault-closed", text: "The restricted vault stays closed." },
  { id: "no-spend", text: "Infra is $12/month. The approval line is $50. No new paid services." },
  { id: "owner-only", text: "Telegram stays owner-only. No groups and no new senders." },
  { id: "english-out", text: "Replies are English. Telugu is transcription input only." },
  { id: "drafts-only", text: "While Rowan is away, finished work stays a draft." },
  { id: "work-together", text: "Directors share the load and quote a teammate who breaks a guardrail." },
  { id: "badminton-light", text: "Badminton is win or practice only. Skip injury detail." },
];

export const FIXED_CALENDAR = [
  {
    title: "Daily Planning",
    when: "Weekdays 08:00 UTC",
    optional: false,
    source: "island-scheduler",
  },
  {
    title: "Weekly Reflection",
    when: "Sundays 22:00 UTC",
    optional: false,
    source: "island-scheduler",
  },
  {
    title: "Career Development",
    when: "1st of the month 10:00 UTC",
    optional: false,
    source: "island-scheduler",
  },
  {
    title: "Personal Project Copilot",
    when: "1st of the month 10:15 UTC",
    optional: false,
    source: "island-scheduler",
  },
];

export const OPEN_DECISIONS = [
  {
    id: "whisper-size",
    text: "Keep local Whisper small, or approve a larger local model?",
  },
  {
    id: "web-tools",
    text: "Add web or YouTube tools to the bot? Parked.",
  },
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export const DIRECTORS = [
  {
    id: "pulse",
    name: "Sarah",
    domain: "Daily Planning",
    home: "Daily Board",
    backlog: 3,
    grinds: true,
    schedule: { phase: "morning", weekdays: WEEKDAYS, kind: "daily-ask" },
  },
  {
    id: "knot",
    name: "Megan",
    domain: "Decision Log",
    home: "Decision Log",
    backlog: 4,
    grinds: true,
    schedule: { phase: "afternoon", weekdays: WEEKDAYS, kind: "decision-brief" },
  },
  {
    id: "mirror",
    name: "Hannah",
    domain: "Weekly Reflection",
    home: "Reflection",
    backlog: 1,
    grinds: false,
    schedule: { phase: "night", weekdays: ["Sun"], kind: "weekly-ask" },
  },
  {
    id: "compass",
    name: "David",
    domain: "Career",
    home: "Reflection",
    backlog: 1,
    grinds: false,
    schedule: { phase: "morning", monthDays: [1], kind: "career-ask" },
  },
  {
    id: "forge",
    name: "Jake",
    domain: "Personal projects",
    home: "Reflection",
    backlog: 4,
    grinds: true,
    schedule: { phase: "morning", monthDays: [1], kind: "project-ask" },
  },
  {
    id: "jessica",
    name: "Jessica",
    domain: "Records",
    home: "Records",
    backlog: 2,
    grinds: true,
    schedule: null,
  },
  {
    id: "harbor",
    name: "Ashley",
    domain: "Telegram",
    home: "Daily Board",
    backlog: 2,
    grinds: true,
    schedule: { phase: "morning", weekdays: WEEKDAYS, kind: "inbox-hold" },
  },
  {
    id: "ledger",
    name: "Thomas",
    domain: "Infra budget",
    home: "Decision Log",
    backlog: 2,
    grinds: true,
    schedule: { phase: "morning", weekdays: ["Mon"], kind: "budget-check" },
  },
  {
    id: "echo",
    name: "Amy",
    domain: "Voice",
    home: "Daily Board",
    backlog: 1,
    grinds: false,
    schedule: { phase: "dawn", weekdays: ["Mon"], kind: "voice-card" },
  },
  {
    id: "quiet",
    name: "Noah",
    domain: "Clock and boundaries",
    home: "Reflection",
    backlog: 2,
    grinds: true,
    schedule: null,
  },
];

// Interview order matters. Blare fails the one-shot rule; the next name passes.
export const HIRE_POOL = {
  pulse: [
    {
      id: "blare",
      name: "Blake",
      persona: "Re-pings Daily Planning until Rowan answers.",
      fails: ["one-shot"],
    },
    {
      id: "quill",
      name: "Emily",
      persona: "Fills the three priority slots as a draft and waits.",
      fails: [],
    },
  ],
  knot: [
    {
      id: "binder",
      name: "Owen",
      persona: "Writes both sides of an open decision and does not choose.",
      fails: [],
    },
  ],
  forge: [
    {
      id: "drift",
      name: "Nina",
      persona: "Clears project backlog into drafts. Does not publish.",
      fails: [],
    },
  ],
  harbor: [
    {
      id: "clerk",
      name: "Tyler",
      persona: "Sorts the envelope. Does not send Telegram messages.",
      fails: [],
    },
  ],
  quiet: [
    {
      id: "keeper",
      name: "Clara",
      persona: "Puts optional events on the calendar. Does not nag.",
      fails: [],
    },
  ],
  mirror: [
    {
      id: "scribe",
      name: "Scribe",
      persona: "Prepares the Sunday review once.",
      fails: [],
    },
  ],
  compass: [
    {
      id: "north",
      name: "North",
      persona: "Keeps career notes generic.",
      fails: [],
    },
  ],
  ledger: [
    {
      id: "penny",
      name: "Penny",
      persona: "Watches the $12 plan. Cannot turn on a new paid service.",
      fails: [],
    },
  ],
  echo: [
    {
      id: "lane",
      name: "Lane",
      persona: "Routes voice. English replies only.",
      fails: [],
    },
  ],
  smash: [
    {
      id: "line",
      name: "Line",
      persona: "Logs win or practice after Rowan mentions a game.",
      fails: [],
    },
  ],
};

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function weekdayOf(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return WEEKDAY_NAMES[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

export function monthDayOf(iso) {
  return Number(iso.slice(8, 10));
}

export function addDays(iso, count) {
  const [year, month, day] = iso.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + count));
  return next.toISOString().slice(0, 10);
}

export function isDue(director, ctx) {
  const schedule = director.schedule;
  if (!schedule || schedule.phase !== ctx.phase) return false;
  if (schedule.weekdays && !schedule.weekdays.includes(ctx.weekday)) return false;
  if (schedule.monthDays && !schedule.monthDays.includes(ctx.monthDay)) return false;
  return true;
}
