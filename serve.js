import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { speakTown } from "./brain.js";
import {
  createWorld,
  logGame,
  ownerReturns,
  phaseOf,
  resolveEnvelope,
  tick,
  townHall,
} from "./engine.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const threeRoot = path.join(root, "node_modules", "three");
const statePath = path.join(root, "state.json");
const viewPath = path.join(root, "view.html");
const port = 5176;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".bin": "application/octet-stream",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

function load() {
  if (!fs.existsSync(statePath)) return createWorld();
  return JSON.parse(fs.readFileSync(statePath, "utf8"));
}

let world = load();

function save() {
  fs.writeFileSync(statePath, JSON.stringify(world, null, 2));
}

function viewModel(current, extras = {}) {
  return {
    clock: `${current.date} ${phaseOf(current).id}`,
    timezone: current.timezone,
    date: current.date,
    phase: phaseOf(current).id,
    dayIndex: current.dayIndex,
    present: current.owner.present,
    agents: current.agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      rank: agent.rank,
      domain: agent.domain,
      home: agent.home,
      morale: agent.morale,
      approved: agent.approved,
      dropped: agent.dropped,
      backlog: agent.backlog,
      vest: agent.vest,
      reportsTo: agent.reportsTo,
      persona: agent.persona ?? agent.domain,
    })),
    notes: current.notes.slice(-12).reverse(),
    envelope: current.envelope,
    calendar: current.calendar,
    log: current.log.slice(-12).reverse(),
    games: current.games,
    speech: extras.speech || [],
    hired: extras.hired || [],
  };
}

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}

function sendFile(res, file) {
  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
  fs.createReadStream(file).pipe(res);
}

function safeJoin(base, rel) {
  const file = path.join(base, rel);
  const rootPath = path.resolve(base);
  if (!path.resolve(file).startsWith(rootPath) || rel.includes("..")) return null;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  return file;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function newHires(before, after) {
  const old = new Set(before.map((agent) => agent.id));
  return after
    .filter((agent) => agent.rank === "worker" && !old.has(agent.id))
    .map((agent) => ({ id: agent.id, name: agent.name, reportsTo: agent.reportsTo, home: agent.home }));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  try {
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/view.html")) {
      send(res, 200, fs.readFileSync(viewPath), "text/html; charset=utf-8");
      return;
    }
    if (req.method === "GET" && url.pathname.startsWith("/vendor/three/")) {
      const file = safeJoin(threeRoot, decodeURIComponent(url.pathname.slice("/vendor/three/".length)));
      if (!file) {
        send(res, 404, { error: "not found" });
        return;
      }
      sendFile(res, file);
      return;
    }
    if (req.method === "GET" && (url.pathname === "/town.js" || url.pathname.startsWith("/avatars/") || url.pathname.startsWith("/fonts/"))) {
      const file = safeJoin(root, decodeURIComponent(url.pathname).replace(/^\/+/, ""));
      if (!file) {
        send(res, 404, { error: "not found" });
        return;
      }
      sendFile(res, file);
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/state") {
      send(res, 200, viewModel(world));
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/meet") {
      const hall = townHall(world);
      const speech = await speakTown(world, "meeting");
      send(res, 200, { ...hall, speech });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/reset") {
      world = createWorld({ present: false, startDate: "2026-10-05" });
      save();
      send(res, 200, viewModel(world));
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/tick") {
      const before = world.agents.map((agent) => ({ ...agent }));
      tick(world);
      save();
      const hired = newHires(before, world.agents);
      const speech = await speakTown(world, hired.length ? "hire" : "tick");
      send(res, 200, viewModel(world, { speech, hired }));
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/return") {
      ownerReturns(world);
      save();
      send(res, 200, viewModel(world, { speech: await speakTown(world, "return") }));
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/resolve") {
      const body = await readBody(req);
      const item = resolveEnvelope(world, body.id, body.decision);
      save();
      send(res, 200, { item, state: viewModel(world) });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/game") {
      const body = await readBody(req);
      const result = logGame(world, body.note);
      if (!result.ok) {
        send(res, 400, result);
        return;
      }
      save();
      send(res, 200, { result, state: viewModel(world) });
      return;
    }
    send(res, 404, { error: "not found" });
  } catch (error) {
    send(res, 400, { error: error.message });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Town view: http://127.0.0.1:${port}`);
});
