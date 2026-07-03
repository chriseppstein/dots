# Deployment

Two deployables, both on Cloudflare:

| Piece | What | Where | Deploy command |
|---|---|---|---|
| Site | Static Vite build (`dist/`) | Cloudflare Pages, project `dots-3d`, domain [dots-3d.com](https://dots-3d.com) | `npm run deploy:pages` |
| API | Multiplayer worker + `GameRoom` Durable Objects | Cloudflare Workers, `dots-3d-api` | `npm run deploy:worker` |

The site talks to the API over HTTPS/WebSocket at the URL baked in at
build time via `VITE_API_URL` (defaults to `http://localhost:8787` for
local dev against `npm run dev:worker`).

## One-time setup

1. `npx wrangler login` (or set `CLOUDFLARE_API_TOKEN`).
2. Create the Pages project once: `npx wrangler pages project create dots-3d`.
3. Deploy the worker: `npm run deploy:worker`. Note its URL
   (`https://dots-3d-api.<account>.workers.dev`), or attach a custom
   domain such as `api.dots-3d.com` in the Cloudflare dashboard.
4. Update `ALLOWED_ORIGINS` in `worker/wrangler.toml` if the site's
   origins change.

## CI (GitHub Actions)

`.github/workflows/deploy.yml` runs typecheck + tests on every push and
PR, and on pushes to `main` deploys worker then site.

Repository secrets:
- `CLOUDFLARE_API_TOKEN` — token with Pages:Edit and Workers:Edit
- `CLOUDFLARE_ACCOUNT_ID`

Repository variable:
- `VITE_API_URL` — the worker's public URL (e.g. `https://api.dots-3d.com`)

## Local development

```bash
npm run dev          # site on http://localhost:3000
npm run dev:worker   # api on http://localhost:8787 (only needed for online mode)
```

Rooms live in Durable Object storage as an append-only move log; the
worker is stateless in memory, so `wrangler dev` restarts don't lose
games. Idle rooms self-delete after 30 days via a storage alarm.
