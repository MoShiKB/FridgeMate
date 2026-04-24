# FridgeMate

Full-stack web app for managing kitchen inventory, sharing posts, and
generating AI recipes from what you have in your fridge.

## Project structure

```
FridgeMate/
├── client/      React + TypeScript SPA (Vite)
├── server/      Node.js + Express + MongoDB API
├── Makefile     Deployment + dev helpers
└── .nvmrc       Pinned Node version
```

## Tech stack

- **Client**: React 18, TypeScript, Vite 8, react-leaflet, Socket.io client
- **Server**: Node.js ≥ 20.19, Express, MongoDB (Mongoose), Socket.io
- **Auth**: JWT access + refresh tokens, optional Google OAuth
- **AI**: Google Gemini (recipes, image search), Spoonacular (recipe images)
- **Process manager (prod)**: PM2 via `server/ecosystem.config.js`
- **Reverse proxy (prod)**: nginx serving `client/dist/` + proxying `/api`

## Prerequisites

- Node.js ≥ 20.19 (run `nvm use` — picks up `.nvmrc`)
- MongoDB (local or Atlas)
- A Gemini API key for recipe generation

## Setup

### 1. Configure environment variables

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Edit each `.env` and fill in the values (MongoDB URI, JWT secrets, Gemini
API key, OAuth credentials if you want Google login). **Rotate all JWT
secrets before using in production.**

### 2. Install dependencies

```bash
make install
# or manually:
# cd server && npm ci
# cd client && npm ci
```

### 3. Run in development

```bash
# terminal 1
cd server && npm run start:dev   # nodemon on :3001

# terminal 2
cd client && npm run dev         # vite on :3000
```

### 4. (Optional) Seed demo fridge items

```bash
cd server && npm run seed
```

Adds a handful of mock items (milk, eggs, etc.) to every user who has an
empty fridge. Safe to re-run — skips users who already have items.

## Deployment (node51)

Deploy targets live in the root `Makefile`. Typical workflow:

```bash
# full deploy: install deps, build, copy client to /var/www, (re)start PM2
make deploy

# operations
make status
make logs
make restart
```

See `make help` for the full list.

### Nginx

nginx must be configured to serve the client from
`/var/www/fridgemate/client/dist` and proxy `/api` to the PM2 process on
port `3001`. After editing the config:

```bash
make nginx-reload
```

## Tests

```bash
make test
# or: cd server && npm test
```

Currently Jest covers the server only — client has no test suite.

## Makefile quick reference

| Target | Purpose |
|---|---|
| `make help` | Show all targets (default) |
| `make install` | Install deps (checks Node version first) |
| `make build` | Build server (tsc) + client (vite) |
| `make deploy` | Full production deploy |
| `make start` / `stop` / `restart` | PM2 lifecycle |
| `make logs` / `status` | PM2 observability |
| `make test` | Server Jest tests |
| `make clean` | Remove `server/dist` and `client/dist` |
| `make check-node` | Verify Node ≥ 20.19 |
| `make nginx-test` / `nginx-reload` | Test and reload nginx |

## URLs (production)

- Frontend: https://node51.cs.colman.ac.il
- API: https://node51.cs.colman.ac.il/api/
- Swagger: https://node51.cs.colman.ac.il/api/api-docs
