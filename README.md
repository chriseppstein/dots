# Dots 3D

The classic Dots and Boxes game, in three dimensions. Draw lines between
dots on a 3D lattice; complete a square face to claim it (and go again);
claim 4 of a cube's 6 faces to win the cube. Most cubes wins.

**Live**: [dots-3d.com](https://dots-3d.com)

## Features

- Grids from 3×3×3 (quick, 8 cubes) to 6×6×6 (marathon, 125 cubes)
- Three modes: pass-and-play, versus computer (three difficulties),
  online with a shareable link
- Consequence-colored aiming: hovering a line shows whether it's safe,
  completes a face, starts a chain, or hands your opponent a gift
- Slice tool to see and reach the inside of the lattice
- Touch controls (tap to preview, tap to confirm; drag to orbit, pinch to zoom)
- Online games survive disconnects — reopen the link to rejoin; extra
  visitors spectate live

## Development

```bash
npm install
npm run dev          # game client → http://localhost:3000
npm run dev:worker   # multiplayer API (Cloudflare worker) → :8787, only for online mode
npm test             # 90 tests: rules engine, analyzer, AI, room protocol, session
npm run typecheck    # client + worker TypeScript
```

## Architecture

- `src/engine/` — pure rules: an integer-indexed lattice (stable
  edge/face/cube ids with precomputed adjacency) and one reducer,
  `applyMove`. Shared verbatim by the browser and the server.
- `src/ai/` — three-tier computer player built on the shared analyzer.
- `src/render/` — Three.js board view (PBR pipeline, raycast picking, slicing).
- `src/app/` — Lit UI and the per-mode `GameSession`.
- `src/protocol/` + `worker/` — WebSocket protocol and the Cloudflare
  Durable Object that hosts each room as an append-only move log.

Deployment (Cloudflare Pages + Workers): see [docs/deployment.md](docs/deployment.md).

## Tech

TypeScript, Lit, Three.js, Vite, Vitest, Cloudflare Workers + Durable Objects.
