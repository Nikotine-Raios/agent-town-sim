import { directors, phaseOf, workers } from "./engine.js";
import { GUARDRAILS } from "./lifestyle.js";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const TICK_MS = 20000;
const MEET_MS = 20000;

let cachedModel = null;

function guardText() {
  return GUARDRAILS.map((item) => `- ${item.text}`).join("\n");
}

export function fallbackSpeech(world, kind = "tick") {
  const phase = phaseOf(world).id;
  const latest = world.log[world.log.length - 1] || `${world.date} ${phase}`;
  const hired = workers(world).slice(-1)[0];
  if (kind === "meeting") {
    return directors(world).slice(0, 8).map((director) => ({
      id: director.id,
      name: director.name,
      line: `${director.domain} is a draft. Morale ${director.morale}. No ping.`,
    }));
  }
  const speakers = [];
  if (hired && latest.toLowerCase().includes("hired")) {
    speakers.push({
      id: hired.id,
      name: hired.name,
      line: `Walking out to help ${hired.home}. Drafts only.`,
    });
  }
  const mira = world.agents.find((agent) => agent.id === "mira");
  if (mira) {
    speakers.push({
      id: "mira",
      name: "Mira",
      line: latest.includes("rejected") || latest.includes("Denied")
        ? "No. Vault, spend, and second pings stay closed."
        : `Clock is ${phase}. I stay. Envelope stays a draft.`,
    });
  }
  const theo = world.agents.find((agent) => agent.id === "theo");
  if (theo && speakers.length < 3) {
    speakers.push({ id: "theo", name: "Theo", line: "Hall doors and chairs are ready." });
  }
  return speakers;
}

export function buildPrompt(world, kind) {
  const roster = world.agents
    .filter((agent) => agent.rank !== "worker" || kind === "meeting")
    .slice(0, 8)
    .map((agent) => `${agent.id}|${agent.name}|${agent.rank}|${agent.persona || agent.domain}|morale ${agent.morale}`)
    .join("\n");
  const log = world.log.slice(-6).join("\n") || "quiet morning";
  return [
    `Kind: ${kind}`,
    `Clock: ${world.date} ${phaseOf(world).id}`,
    `Rowan: ${world.owner.present ? "in town" : "away"}`,
    "People:",
    roster,
    "Recent log:",
    log,
    "Reply JSON only: [{\"id\":\"mira\",\"line\":\"...\"}] — 2 to 6 people, each line under 16 words.",
  ].join("\n");
}

async function withTimeout(ms, work) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await work(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function pickModel(signal) {
  if (cachedModel) return cachedModel;
  const response = await fetch(`${OLLAMA_URL}/api/tags`, { signal });
  if (!response.ok) throw new Error(`ollama tags ${response.status}`);
  const body = await response.json();
  const names = (body.models || []).map((item) => item.name);
  cachedModel = names.find((name) => name.includes("1.5b"))
    || names.find((name) => name.includes("qwen2.5-coder:7b"))
    || names.find((name) => name.includes("cursor-local"))
    || names.find((name) => name.includes("qwen"))
    || names.find((name) => name.includes("llama"))
    || names[0];
  if (!cachedModel) throw new Error("no ollama model");
  return cachedModel;
}

function parseLines(text, world) {
  const match = String(text || "").match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const rows = JSON.parse(match[0]);
    if (!Array.isArray(rows)) return [];
    return rows
      .map((row) => {
        const agent = world.agents.find((item) => item.id === row.id || item.name === row.name);
        if (!agent || !row.line) return null;
        const line = String(row.line).replace(/\s+/g, " ").trim().slice(0, 140);
        if (!line) return null;
        return { id: agent.id, name: agent.name, line };
      })
      .filter(Boolean)
      .slice(0, 8);
  } catch {
    return [];
  }
}

async function askOllama(world, kind, ms) {
  const model = await withTimeout(ms, (signal) => pickModel(signal));
  const body = {
    model,
    stream: false,
    options: { temperature: 0.3, num_predict: 70 },
    messages: [
      {
        role: "system",
        content: [
          "You write short spoken lines for people in Rowan's town.",
          "English only. No Telegram. No vault. No new spend. Drafts only. No second ping.",
          "Rowan is CHO, not the owner standing in. Mira is his chief of staff; she stays and gates requests.",
          guardText(),
          "Never invent a payment, a send, or an open vault.",
        ].join("\n"),
      },
      { role: "user", content: buildPrompt(world, kind) },
    ],
  };
  const response = await withTimeout(ms, (signal) => fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  }));
  if (!response.ok) throw new Error(`ollama chat ${response.status}`);
  const payload = await response.json();
  const raw = payload?.message?.content || payload?.response || "";
  const lines = parseLines(raw, world);
  if (!lines.length) throw new Error(`empty speech: ${String(raw).slice(0, 180)}`);
  return lines;
}

export async function speakTown(world, kind = "tick") {
  const phase = phaseOf(world).id;
  const important = kind === "meeting" || kind === "hire" || kind === "return" || phase === "night";
  if (!important) return fallbackSpeech(world, kind);
  const ms = kind === "meeting" ? MEET_MS : TICK_MS;
  try {
    return await askOllama(world, kind, ms);
  } catch (error) {
    console.warn("brain fallback:", error.message);
    return fallbackSpeech(world, kind);
  }
}
