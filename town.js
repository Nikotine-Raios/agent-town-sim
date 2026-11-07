const TILE = 24;
const COLS = 42;
const ROWS = 28;
const MAP_W = COLS * TILE;
const MAP_H = ROWS * TILE;

const BUILDINGS = [
  { id: "house", name: "House", director: "mira", x: 3, y: 8, w: 7, h: 6, roof: "#b23b3b", wall: "#f3e6c8" },
  { id: "hall", name: "Town hall", director: "theo", x: 17, y: 4, w: 8, h: 7, roof: "#5c6570", wall: "#d8d2c6" },
  { id: "shop", name: "Shop", director: "iris", x: 31, y: 8, w: 7, h: 6, roof: "#8a5a2b", wall: "#e6c9a0" },
  { id: "court", name: "Rally court", director: "rafa", x: 31, y: 18, w: 8, h: 6, roof: "#2f6b4a", wall: "#cfe8d4" },
  { id: "daily", name: "Daily board", director: "pulse", x: 4, y: 3, w: 5, h: 3, roof: "#3d4a6b", wall: "#c9d2e6" },
  { id: "records", name: "Records", director: "jessica", x: 12, y: 20, w: 5, h: 4, roof: "#6b4a28", wall: "#ead7a8" },
];

const COLORS = {
  rowan: "#6b7a3a",
  mira: "#2f8a7a",
  theo: "#c4a574",
  iris: "#c45c2a",
  rafa: "#2f6b4a",
  pulse: "#3d6bb0",
  knot: "#8a3d6b",
  mirror: "#6b4a8a",
  compass: "#2f5a8a",
  forge: "#8a4a2f",
  jessica: "#6b5a3d",
  harbor: "#2f7a8a",
  ledger: "#5a5a3d",
  echo: "#8a6b2f",
  quiet: "#4a5a4a",
};

const canvas = document.getElementById("world");
const hint = document.getElementById("hint");
const sheet = document.getElementById("sheet");
const billing = document.getElementById("billing");
const ctx = canvas.getContext("2d");
const keys = new Set();
const actors = [];
const portraits = new Map();
const faces = new Map();

let sim = null;
let selected = null;
let meeting = null;
let ready = false;
let last = performance.now();
let walkMark = null;
let scale = 1;
let ox = 0;
let oy = 0;

function doorOf(building) {
  return {
    x: (building.x + building.w / 2) * TILE,
    y: (building.y + building.h + 0.8) * TILE,
  };
}

function buildingFor(directorId) {
  return BUILDINGS.find((item) => item.director === directorId) || BUILDINGS.find((item) => item.id === "hall");
}

function workplaceOf(actor) {
  const agent = sim?.agents?.find((item) => item.id === actor.id);
  if (actor.id === "rowan") return BUILDINGS.find((item) => item.id === "house");
  if (agent?.rank === "worker") return buildingFor(agent.reportsTo);
  return buildingFor(actor.id);
}

function workSpot(actor) {
  if (actor.home) return actor.home;
  const building = workplaceOf(actor);
  const door = doorOf(building);
  if (actor.id === "mira") return { x: door.x - 18, y: door.y + 28 };
  if (actor.id === "rowan") return { x: door.x + 22, y: door.y + 46 };
  const roster = actors.some((item) => item.id === actor.id) ? actors : [...actors, actor];
  const peers = roster
    .filter((item) => item.id !== "rowan" && item.id !== "mira" && workplaceOf(item).id === building.id)
    .sort((a, b) => a.id.localeCompare(b.id));
  const index = Math.max(0, peers.findIndex((item) => item.id === actor.id));
  return {
    x: door.x + ((index % 3) - 1) * 22,
    y: door.y + 18 + Math.floor(index / 3) * 18,
  };
}

function player() {
  return actors.find((actor) => actor.id === "rowan");
}

function blocked(x, y) {
  const tx = x / TILE;
  const ty = y / TILE;
  return BUILDINGS.some((b) => tx > b.x + 0.15 && tx < b.x + b.w - 0.15 && ty > b.y + 0.15 && ty < b.y + b.h);
}

function isStudioRose(r, g, b) {
  if (r < 80 || g > 110) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  if (sat < 0.42 || max === min) return false;
  let hue = 0;
  const span = max - min;
  if (max === r) hue = (g - b) / span;
  else if (max === g) hue = 2 + (b - r) / span;
  else hue = 4 + (r - g) / span;
  hue *= 60;
  if (hue < 0) hue += 360;
  return hue >= 318 && hue <= 348;
}

function keyStudio(px, w, h) {
  const orig = new Uint8ClampedArray(px);
  const seen = new Uint8Array(w * h);
  const stack = [];
  const enqueue = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (seen[p]) return;
    seen[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < w; x += 1) {
    enqueue(x, 0);
    enqueue(x, h - 1);
  }
  for (let y = 0; y < h; y += 1) {
    enqueue(0, y);
    enqueue(w - 1, y);
  }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w;
    const y = (p - x) / w;
    px[p * 4 + 3] = 0;
    const tryNeighbor = (nx, ny) => {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
      const np = ny * w + nx;
      if (seen[np]) return;
      if (isStudioRose(orig[np * 4], orig[np * 4 + 1], orig[np * 4 + 2])) enqueue(nx, ny);
    };
    tryNeighbor(x - 1, y);
    tryNeighbor(x + 1, y);
    tryNeighbor(x, y - 1);
    tryNeighbor(x, y + 1);
  }
}

function loadPortrait(id) {
  if (portraits.has(id)) return portraits.get(id);
  const pending = new Promise((resolve) => {
  const image = new Image();
    image.crossOrigin = "anonymous";
  image.onload = () => {
      const board = document.createElement("canvas");
      board.width = image.naturalWidth;
      board.height = image.naturalHeight;
      const cut = board.getContext("2d", { willReadFrequently: true });
      cut.drawImage(image, 0, 0);
      const pixels = cut.getImageData(0, 0, board.width, board.height);
      keyStudio(pixels.data, board.width, board.height);
      cut.putImageData(pixels, 0, 0);
      const face = document.createElement("canvas");
      face.width = 64;
      face.height = 64;
      const fx = face.getContext("2d");
      fx.beginPath();
      fx.arc(32, 32, 30, 0, Math.PI * 2);
      fx.clip();
      fx.drawImage(board, 0, 0, board.width, board.height * 0.55, 0, 0, 64, 64);
      faces.set(id, face);
      resolve({ board, face });
    };
    image.onerror = () => resolve(null);
    image.src = `/avatars/${id}.jpg?v=16`;
  });
  portraits.set(id, pending);
  return pending;
}

function hallSeats() {
  const hall = BUILDINGS.find((item) => item.id === "hall");
  const door = doorOf(hall);
  return Array.from({ length: 20 }, (_, index) => ({
    x: door.x + ((index % 5) - 2) * 20,
    y: door.y + 36 + Math.floor(index / 5) * 18,
  }));
}

function resize() {
  const box = canvas.parentElement.getBoundingClientRect();
  canvas.width = Math.floor(box.width * devicePixelRatio);
  canvas.height = Math.floor(box.height * devicePixelRatio);
  scale = Math.min(canvas.width / MAP_W, canvas.height / MAP_H);
  ox = (canvas.width - MAP_W * scale) / 2;
  oy = (canvas.height - MAP_H * scale) / 2;
}

function worldFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const sx = (event.clientX - rect.left) * (canvas.width / rect.width);
  const sy = (event.clientY - rect.top) * (canvas.height / rect.height);
  return {
    x: Math.max(TILE, Math.min(MAP_W - TILE, (sx - ox) / scale)),
    y: Math.max(TILE, Math.min(MAP_H - TILE, (sy - oy) / scale)),
  };
}

function drawMap() {
  ctx.fillStyle = "#2f5a36";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      ctx.fillStyle = (x + y) % 2 ? "#3f6d45" : "#37633e";
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
  }

  ctx.fillStyle = "#d7b48a";
  const path = [
    [2, 14, 38, 3],
    [10, 11, 3, 12],
    [20, 11, 3, 10],
    [29, 11, 3, 12],
    [10, 11, 22, 3],
    [4, 7, 3, 8],
    [31, 16, 8, 2],
  ];
  for (const [x, y, w, h] of path) {
    ctx.fillRect(x * TILE, y * TILE, w * TILE, h * TILE);
  }

  ctx.fillStyle = "#c4d8e6";
  ctx.beginPath();
  ctx.arc(21.5 * TILE, 16.2 * TILE, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#7aa3b8";
  ctx.beginPath();
  ctx.arc(21.5 * TILE, 16.2 * TILE, 10, 0, Math.PI * 2);
  ctx.fill();

  for (const tree of [[8, 18], [15, 17], [26, 18], [36, 5], [2, 22], [39, 22]]) {
    ctx.fillStyle = "#1f4a28";
    ctx.fillRect(tree[0] * TILE + 9, tree[1] * TILE + 14, 6, 10);
    ctx.fillStyle = "#245c32";
    ctx.beginPath();
    ctx.arc(tree[0] * TILE + 12, tree[1] * TILE + 10, 12, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const building of BUILDINGS) {
    const x = building.x * TILE;
    const y = building.y * TILE;
    const w = building.w * TILE;
    const h = building.h * TILE;
    ctx.fillStyle = "#1a140e";
    ctx.fillRect(x + 4, y + 6, w, h);
    ctx.fillStyle = building.wall;
    ctx.fillRect(x, y + 10, w, h - 10);
    ctx.fillStyle = building.roof;
    ctx.beginPath();
    ctx.moveTo(x - 6, y + 14);
    ctx.lineTo(x + w / 2, y - 6);
    ctx.lineTo(x + w + 6, y + 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#1c1712";
    ctx.fillRect(x + w / 2 - 8, y + h - 18, 16, 18);
    ctx.fillStyle = "#f7f1e6";
    ctx.font = "700 11px Bricolage, sans-serif";
    ctx.fillText(building.name, x + 8, y + h - 8);
  }

  if (walkMark) {
    ctx.strokeStyle = "#1c1712";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(walkMark.x, walkMark.y, 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  const drawn = [...actors].sort((a, b) => a.y - b.y);
  for (const actor of drawn) drawActor(actor);
  ctx.restore();
}

function drawActor(actor) {
  const color = COLORS[actor.id] || "#5a4632";
  ctx.fillStyle = "rgba(20, 14, 8, 0.35)";
  ctx.beginPath();
  ctx.ellipse(actor.x, actor.y + 4, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1c1712";
  ctx.fillRect(actor.x - 8, actor.y - 22, 16, 20);
  ctx.fillStyle = color;
  ctx.fillRect(actor.x - 7, actor.y - 21, 14, 18);
  const face = faces.get(actor.id);
  if (face) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(actor.x, actor.y - 28, 11, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(face, actor.x - 11, actor.y - 39, 22, 22);
    ctx.restore();
    ctx.strokeStyle = "#1c1712";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(actor.x, actor.y - 28, 11, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#f3e0c8";
    ctx.beginPath();
    ctx.arc(actor.x, actor.y - 28, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  if (selected === actor.id || actor.id === "rowan") {
    ctx.fillStyle = "#1c1712";
    ctx.font = "700 11px Bricolage, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(actor.id === "rowan" ? "Rowan" : actor.name || actor.id, actor.x, actor.y + 16);
    ctx.textAlign = "left";
  }
}

async function makeActor(id, x, y, rank, arriving = false) {
  await loadPortrait(id);
  const agent = sim?.agents?.find((item) => item.id === id);
  return {
    id,
    name: id === "rowan" ? "Rowan" : agent?.name || id,
    rank,
    x,
    y,
    tx: x,
    ty: y,
    walking: false,
    arriving,
    seated: false,
    seat: null,
    home: null,
  };
}

async function ensurePlayer() {
  if (actors.some((actor) => actor.id === "rowan")) return;
  const house = BUILDINGS.find((item) => item.id === "house");
  const door = doorOf(house);
  const actor = await makeActor("rowan", door.x + 22, door.y + 46, "cho");
  actor.home = { x: actor.x, y: actor.y };
  actors.push(actor);
}

function taskFor(id) {
  const agent = sim?.agents?.find((item) => item.id === id);
  if (!agent) return "Checking the house";
  if (agent.rank === "worker") return agent.persona || "Helping";
  if (agent.backlog > 0) return `${agent.domain} · ${agent.backlog} in the pile`;
  return agent.domain;
}

async function showSheet(id) {
  selected = id;
  const agent = id === "rowan"
    ? { name: "Rowan", rank: "cho", domain: "Chief human officer", persona: "Walks the town. Approves drafts when he is back.", morale: 80 }
    : sim?.agents?.find((item) => item.id === id);
  if (!agent) return;
  sheet.hidden = false;
  document.getElementById("sheetName").textContent = agent.name;
  document.getElementById("sheetRole").textContent = `${agent.rank} · ${agent.domain || agent.persona || ""}`;
  document.getElementById("swatchMorale").textContent = `morale ${agent.morale ?? "—"}`;
  document.getElementById("swatchMorale").style.background = `hsl(${Math.round((agent.morale ?? 0) * 1.1)}, 36%, 78%)`;
  document.getElementById("swatchRank").textContent = agent.rank;
  document.getElementById("sheetNote").textContent = taskFor(id);
  const portrait = document.getElementById("portrait");
  const keyed = await loadPortrait(id);
  if (portrait && keyed?.board) portrait.src = keyed.board.toDataURL("image/png");
}

function clearFocus() {
  selected = null;
  sheet.hidden = true;
}

function applySpeech(rows) {
  if (!rows?.length || !hint) return;
  hint.textContent = `${rows[0].name}: ${rows[0].line}`;
}

async function sync(state) {
  sim = state;
  if (!ready) return;
  await ensurePlayer();
  const known = new Set(state.agents.map((agent) => agent.id));
  known.add("rowan");
  for (let index = actors.length - 1; index >= 0; index -= 1) {
    if (!known.has(actors[index].id)) actors.splice(index, 1);
  }
  for (const agent of state.agents) {
    if (actors.some((actor) => actor.id === agent.id)) continue;
    const building = workplaceOf({ id: agent.id, rank: agent.rank, reportsTo: agent.reportsTo });
    const door = doorOf(building);
    const arriving = (state.hired || []).some((hire) => hire.id === agent.id);
    const actor = await makeActor(agent.id, door.x, door.y, agent.rank, arriving);
    const spot = workSpot(actor);
    actor.home = spot;
    if (arriving) {
      actor.x = door.x;
      actor.y = door.y;
      actor.tx = spot.x;
      actor.ty = spot.y;
      if (hint) hint.textContent = `${agent.name} walked out of ${building.name}.`;
    } else {
      actor.x = spot.x;
      actor.y = spot.y;
      actor.tx = spot.x;
      actor.ty = spot.y;
    }
    actors.push(actor);
  }
  for (const actor of actors) {
    actor.home = null;
    actor.home = workSpot(actor);
    if (!actor.arriving && !meeting) {
      actor.x = actor.home.x;
      actor.y = actor.home.y;
      actor.tx = actor.home.x;
      actor.ty = actor.home.y;
    }
  }
  applySpeech(state.speech);
  if (selected) showSheet(selected);
}

function moveToward(actor, dt) {
  const dx = actor.tx - actor.x;
  const dy = actor.ty - actor.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 4) {
    actor.x = actor.tx;
    actor.y = actor.ty;
    actor.walking = false;
    if (actor.id === "rowan") walkMark = null;
    return true;
  }
  const speed = actor.id === "rowan" ? 110 : actor.arriving ? 80 : 55;
  const step = Math.min(dist, speed * dt);
  const nx = actor.x + (dx / dist) * step;
  const ny = actor.y + (dy / dist) * step;
  if (!blocked(nx, ny)) {
    actor.x = nx;
    actor.y = ny;
  } else if (!blocked(nx, actor.y)) {
    actor.x = nx;
  } else if (!blocked(actor.x, ny)) {
    actor.y = ny;
  }
  actor.walking = true;
  return false;
}

function steerPlayer(dt) {
  const me = player();
  if (!me || meeting?.phase === "sit") return;
  let x = 0;
  let y = 0;
  if (keys.has("w") || keys.has("arrowup")) y -= 1;
  if (keys.has("s") || keys.has("arrowdown")) y += 1;
  if (keys.has("a") || keys.has("arrowleft")) x -= 1;
  if (keys.has("d") || keys.has("arrowright")) x += 1;
  if (x || y) {
    const len = Math.hypot(x, y);
    me.tx = me.x + (x / len) * 48;
    me.ty = me.y + (y / len) * 48;
  } else if (meeting?.phase === "walk") {
    const door = doorOf(BUILDINGS.find((item) => item.id === "hall"));
    me.tx = door.x;
    me.ty = door.y + 20;
  }
  moveToward(me, dt);
}

function wander(dt) {
  if (!sim || meeting?.phase === "sit") return;
  for (const actor of actors) {
    if (actor.id === "rowan" && meeting?.phase !== "walk") continue;
    if (meeting?.phase !== "walk" && !actor.arriving) {
      const spot = workSpot(actor);
      actor.tx = spot.x;
      actor.ty = spot.y;
    }
    const arrived = moveToward(actor, dt);
    if (arrived && actor.arriving) actor.arriving = false;
  }
  if (meeting?.phase === "walk") maybeMeet();
}

function meetButton() {
  const button = document.getElementById("meet");
  if (button) button.textContent = meeting ? "Leave hall" : "Call meeting";
}

function callMeeting() {
  const door = doorOf(BUILDINGS.find((item) => item.id === "hall"));
  meeting = { phase: "walk", started: performance.now(), lines: [], spoken: 0 };
  actors.forEach((actor) => {
    actor.seated = false;
    actor.seat = null;
    actor.arriving = false;
    actor.tx = door.x + (Math.random() - 0.5) * 20;
    actor.ty = door.y + 16 + (Math.random() - 0.5) * 10;
  });
  meetButton();
  if (hint) hint.textContent = "Everyone is walking to Town Hall.";
  fetch("/api/meet")
    .then((response) => response.json())
    .then((body) => {
      if (!meeting) return;
      meeting.lines = (body.speech || []).map((row) => `${row.name}: ${row.line}`);
      if (!meeting.lines.length) meeting.lines = body.lines || [];
      if (meeting.phase === "sit") openMeeting();
    })
    .catch(() => {});
}

function maybeMeet() {
  if (!meeting || meeting.phase !== "walk") return;
  const door = doorOf(BUILDINGS.find((item) => item.id === "hall"));
  const arrived = actors.filter((actor) => Math.hypot(actor.x - door.x, actor.y - door.y) < 40).length;
  if (arrived >= Math.max(3, actors.length * 0.45) || performance.now() - meeting.started > 4000) sitDown();
}

function seatRank(actor) {
  if (actor.id === "rowan") return 0;
  if (actor.id === "mira") return 1;
  if (actor.rank === "friend") return 2;
  if (actor.rank === "worker") return 4;
  return 3;
}

function sitDown() {
  meeting.phase = "sit";
  const seats = hallSeats();
  [...actors].sort((a, b) => seatRank(a) - seatRank(b)).forEach((actor, index) => {
    actor.seat = seats[index] || seats[seats.length - 1];
    actor.tx = actor.seat.x;
    actor.ty = actor.seat.y;
    actor.seated = false;
  });
  if (hint) hint.textContent = "Town hall is in session.";
  meetButton();
  openMeeting();
}

function finishSit(actor) {
  if (!actor.seat || actor.seated) return;
  if (Math.hypot(actor.x - actor.seat.x, actor.y - actor.seat.y) > 4) return;
  actor.seated = true;
  actor.walking = false;
  if (meeting?.lines?.length && hint) {
    hint.textContent = meeting.lines[meeting.spoken % meeting.lines.length];
  meeting.spoken += 1;
  }
}

function leaveHall() {
  const door = doorOf(BUILDINGS.find((item) => item.id === "hall"));
  meeting = null;
  actors.forEach((actor) => {
    actor.seated = false;
    actor.seat = null;
    actor.x = door.x + (Math.random() - 0.5) * 24;
    actor.y = door.y + 24;
    const spot = workSpot(actor);
    actor.tx = spot.x;
    actor.ty = spot.y;
  });
  meetButton();
  billing.hidden = true;
  if (hint) hint.textContent = "Click the path to walk. Click a person to talk.";
}

function paintLines(lines) {
  document.getElementById("overlayBody").innerHTML = lines.map((line) => {
    const [name, ...rest] = String(line).split(":");
    const text = rest.join(":").trim() || name;
    return `<li>${rest.length ? `${name}<span>${text}</span>` : line}</li>`;
  }).join("");
}

function openMeeting() {
  billing.hidden = false;
  document.getElementById("overlayTitle").textContent = "Town hall";
  document.getElementById("billingNote").textContent = "In session";
  paintLines(meeting?.lines?.length ? meeting.lines : ["The room is gathering."]);
}

function nearestActor(x, y, max = 28) {
  let best = null;
  let bestDist = max;
  for (const actor of actors) {
    if (actor.id === "rowan") continue;
    const dist = Math.hypot(actor.x - x, actor.y - y);
    if (dist < bestDist) {
      best = actor;
      bestDist = dist;
    }
  }
  return best;
}

canvas.addEventListener("click", (event) => {
  if (!ready) return;
  const point = worldFromEvent(event);
  const near = nearestActor(point.x, point.y);
  if (near) {
    showSheet(near.id);
    const me = player();
    if (me && meeting?.phase !== "sit") {
      me.tx = near.x;
      me.ty = near.y + 16;
    }
    return;
  }
  const me = player();
  if (!me || meeting?.phase === "sit" || blocked(point.x, point.y)) return;
  me.tx = point.x;
  me.ty = point.y;
  walkMark = { x: point.x, y: point.y };
  if (hint) hint.textContent = "Rowan is walking.";
});

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) event.preventDefault();
  keys.add(key);
  if (key === "escape") {
    billing.hidden = true;
    clearFocus();
    if (meeting) leaveHall();
  }
});
window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener("resize", resize);
document.getElementById("meet").addEventListener("click", () => {
  if (meeting) leaveHall();
  else callMeeting();
});
document.getElementById("closeSheet").addEventListener("click", clearFocus);
document.getElementById("closeOverlay").addEventListener("click", () => {
  billing.hidden = true;
});
billing.addEventListener("click", async (event) => {
  const id = event.target.dataset?.approve;
  if (!id || !window.townApprove) return;
  await window.townApprove(id);
});

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (ready) {
    steerPlayer(dt);
    wander(dt);
    for (const actor of actors) {
      if (meeting?.phase === "sit") {
        if (!actor.seated) moveToward(actor, dt);
        finishSit(actor);
      }
    }
  }
  drawMap();
  requestAnimationFrame(frame);
}

async function boot() {
resize();
  ready = true;
  if (sim) await sync(sim);
  else await ensurePlayer();
  if (hint) hint.textContent = "Click the path to walk. Click a person to talk.";
}

requestAnimationFrame(frame);
boot();

window.townSync = (state) => {
  sync(state);
};
window.__walkOwner = (x, y) => {
  const me = player();
  if (!me) return false;
  me.tx = x;
  me.ty = y;
  walkMark = { x, y };
  return true;
};
window.__enterHall = () => {
  if (!meeting) callMeeting();
  sitDown();
};
window.__townDebug = () => ({
  ready,
  meeting: meeting?.phase || null,
  count: actors.length,
  people: actors.map((actor) => ({ id: actor.id, x: Math.round(actor.x), y: Math.round(actor.y) })),
});
