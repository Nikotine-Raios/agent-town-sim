import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createWorld,
  logGame,
  ownerReturns,
  renderReport,
  resolveEnvelope,
  runDays,
  townHall,
} from "./engine.js";

const statePath = path.join(path.dirname(fileURLToPath(import.meta.url)), "state.json");

function load() {
  if (!fs.existsSync(statePath)) return createWorld();
  return JSON.parse(fs.readFileSync(statePath, "utf8"));
}

function save(world) {
  fs.writeFileSync(statePath, JSON.stringify(world, null, 2));
}

function help() {
  return `Lifestyle town sim (local only, nothing is sent)

  node cli.js run --days 3     Reset, leave Rowan away, run that many days
  node cli.js status           Print the town
  node cli.js meet             Town hall lines
  node cli.js envelope         What is waiting
  node cli.js return           Rowan walks back in
  node cli.js approve env-1    Approve one waiting item
  node cli.js deny env-1       Deny one waiting item
  node cli.js game "practice"  Log badminton as win or practice
  node cli.js reset            New town at 2026-10-05 dawn

  node serve.js                Open http://127.0.0.1:5176
`;
}

const [command, ...rest] = process.argv.slice(2);

if (!command || command === "help" || command === "--help") {
  console.log(help());
  process.exit(0);
}

if (command === "reset") {
  save(createWorld());
  console.log(renderReport(load()));
  process.exit(0);
}

if (command === "run") {
  const daysFlag = rest.indexOf("--days");
  const days = daysFlag === -1 ? 3 : Number(rest[daysFlag + 1]);
  if (!Number.isInteger(days) || days < 1) {
    console.error("Use --days with a positive integer.");
    process.exit(1);
  }
  const world = createWorld({ present: false, startDate: "2026-10-05" });
  runDays(world, days);
  save(world);
  console.log(renderReport(world));
  process.exit(0);
}

if (command === "status") {
  console.log(renderReport(load()));
  process.exit(0);
}

if (command === "meet") {
  const hall = townHall(load());
  console.log(hall.lines.join("\n"));
  process.exit(0);
}

if (command === "envelope") {
  const world = load();
  const waiting = world.envelope.filter((item) => item.status === "waiting");
  if (waiting.length === 0) console.log("Envelope is empty.");
  for (const item of waiting) console.log(`${item.id}  ${item.title}`);
  process.exit(0);
}

if (command === "return") {
  const world = ownerReturns(load());
  save(world);
  console.log(renderReport(world));
  process.exit(0);
}

if (command === "approve" || command === "deny") {
  const id = rest[0];
  if (!id) {
    console.error(`Usage: node cli.js ${command} env-1`);
    process.exit(1);
  }
  const world = load();
  try {
    const item = resolveEnvelope(world, id, command === "approve" ? "approve" : "deny");
    save(world);
    console.log(`${item.id} ${item.status} by ${item.resolvedBy}: ${item.title}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  process.exit(0);
}

if (command === "game") {
  const world = load();
  const result = logGame(world, rest.join(" "));
  if (!result.ok) {
    console.error(result.reason);
    process.exit(1);
  }
  save(world);
  console.log(renderReport(world));
  process.exit(0);
}

console.error(help());
process.exit(1);
