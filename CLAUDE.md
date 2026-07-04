# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

```bash
npm run dev          # game client (Vite) → http://localhost:3000
npm run dev:worker   # multiplayer API (wrangler dev) → http://localhost:8787
npm test             # run all tests (vitest, single pass)
npm run test:watch   # vitest watch mode
npm run typecheck    # tsc for BOTH the client project and worker/
npm run build        # typecheck + production build to dist/
```

Online multiplayer needs both `dev` and `dev:worker` running. Local and
AI modes need only `dev`. The client finds the API via `VITE_API_URL`
(defaults to `http://localhost:8787`).

## Architecture

**Dots 3D** is 3D dots-and-boxes. Rules: completing a face grants
another turn; owning 4 of a cube's 6 faces claims the cube; the game
ends when every edge is drawn; most cubes wins; equal cubes is a draw
(faces split 3–3 leave a cube unclaimed).

The design rests on two load-bearing ideas. Preserve them:

1. **One geometry oracle.** `src/engine/lattice.ts` assigns every edge,
   face, and cube a stable integer id and precomputes all adjacency
   (edge↔face, face↔cube). Nothing else may re-derive geometry from
   coordinates — the previous implementation had three divergent copies
   of "what does this move complete?" and that was the root cause of
   its worst bugs.

2. **One reducer, shared verbatim.** `src/engine/game.ts#applyMove` is
   the only code that changes game state, and it is imported unchanged
   by the browser and the Cloudflare worker. State is immutable; scores
   are derived from ownership arrays, never stored. `replay()` folds a
   move log back into exact state.

Layout:

- `src/engine/` — lattice, reducer, `analyzer.ts` (move-consequence
  classification used by BOTH the hover preview and the AI — keep it single)
- `src/ai/` — easy/medium/hard, all via the analyzer; deterministic
  under an injected seeded rng
- `src/protocol/` — wire messages shared by client and worker
- `src/app/` — Lit components; `session.ts` routes move intent per mode;
  `theme.ts` is the only place seat indices become colors/names
- `src/render/` — `BoardRenderer`, a pure Three.js view over `GameState`
- `src/net/` — WebSocket client with token reconnect and seq resync
- `worker/` — separate deployable: `room-logic.ts` (runtime-agnostic,
  unit-tested) wrapped by the `GameRoom` Durable Object

**Online model:** server-authoritative. Rooms persist an append-only
move log in Durable Object storage; state is rebuilt by folding the
reducer over the log, so eviction/hibernation lose nothing. Clients
never apply their own moves optimistically — they send `move{seq,edgeId}`
and apply the server's `move-applied` echo. A seq mismatch triggers a
resync, never a divergence. Identity is a durable random token
(localStorage) mapped to seat 0/1; a third token spectates.

**Shared view:** online games show both players the same board. The
player on turn drives the camera and hover; the server relays `view`
and `hover` messages (ephemeral, never persisted, dropped unless the
sender is the seated player currently on turn in a running game) to
everyone else, whose local board input is locked until control flips
with the turn. Both sides are unlocked after the game ends.

## Development Rules

**Server stays presentation-agnostic.** The wire protocol speaks seat
indices only — no names-as-identity, no colors, no UI state. Clients
translate seats to colors via `src/app/theme.ts` (kept in sync with
`src/styles/tokens.css`).

**TDD is mandatory.** Write failing tests first, then implement. See
[docs/TDD-Process-Instructions.md](docs/TDD-Process-Instructions.md).
Never write a test that passes while a bug exists (no
`expect(bugExists).toBe(true)`, no vacuous `if`-guarded assertions).

**Do not test WebGL/Three.js rendering** — the test environment
(happy-dom) has no GL context. `BoardRenderer` stays a thin view;
anything worth testing (geometry, consequence analysis, session logic)
belongs in the pure modules, which are fully testable.

**Both typechecks must pass** before work is complete:
`npm run typecheck` covers the client project and `worker/` (which uses
`@cloudflare/workers-types`).

**All tests green before committing.**

## Deployment

Cloudflare Pages (site, project `dots-3d`, domain
[dots-3d.com](https://dots-3d.com)) + a separate Cloudflare Worker
(`dots-3d-api`) for multiplayer. CI in `.github/workflows/deploy.yml`
tests every push and deploys on `main`. Details: [docs/deployment.md](docs/deployment.md).
