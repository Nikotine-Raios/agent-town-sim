# Agent Town Sim

A small simulated town of AI agents that keeps working while its owner is away, without being allowed to do anything risky. Directors pick up work, a chief of staff reviews every proposal against hard guardrails, new workers get hired when backlogs grow, and anything that needs the owner waits in an "envelope" until he is back. Dialogue comes from a local LLM through Ollama, with a deterministic fallback when the model is slow or missing.

All characters are fictional.

## How it works

**Tick engine (`engine.js`).** The world advances through day phases. Each tick, directors work their domains, morale and backlog change, and the chief of staff (Mira) reviews proposals:

| Proposal | Decision |
| --- | --- |
| Breaks a guardrail (spend, restricted vault, second ping, groups) | Denied, with the reason logged |
| Needs the owner (Rowan) | Held in the envelope; cannot be cleared until he returns |
| Internal | Approved |

Hiring is capped: a backlog of 4 triggers a hire, with at most 4 hires a night and 12 in total. Low morale triggers an optional culture event. Fixed calendar items (weekday planning, Sunday reflection, monthly reviews) fire once each, and silence never counts as a reason to ask again.

**Guardrails and schedule (`lifestyle.js`).** The rules and calendar live in data, not in prompts, so the engine enforces them whether or not a model is running.

**LLM dialogue (`brain.js`).** For important moments (meetings, hires, the owner returning, night) the town asks a local Ollama model for short spoken lines:

- Picks the best available local model from Ollama's tag list.
- Sends the roster, recent log and guardrails, and asks for JSON only.
- Validates the reply: extracts the JSON array, drops speakers who aren't in the roster, trims each line, caps the number of speakers.
- Times out after 20 seconds and falls back to deterministic lines, so the town never stalls on the model.

Routine ticks skip the model entirely to keep it cheap.

**Server and view (`serve.js`, `town.js`, `view.html`).** A local HTTP server exposes the world (`/api/state`, `/api/tick`, `/api/meet`, `/api/return`, `/api/resolve`, `/api/game`, `/api/reset`) and serves a browser view of the town. State persists to `state.json`.

## Run

```bash
npm install
npm test        # engine and brain tests, no model needed
npm start       # http://127.0.0.1:5176
```

For generated dialogue, run [Ollama](https://ollama.com) locally with any small model (for example `ollama pull qwen2.5-coder:1.5b`). Without it the town still runs on fallback lines.

A CLI drives the same engine without the browser:

```bash
node cli.js run --days 3   # reset, owner away, run three days
node cli.js return         # owner walks back in
```

## Tests

`engine.test.js` and `brain.test.js` cover the guardrails: three days away still hires help without breaking a rule, the chief of staff denies spend and vault requests without waiting for the owner, envelope items stay locked until the owner returns, scheduled asks fire once, and fallback speech never mentions sends or payments.
