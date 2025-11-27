# diblab-unimus-backend

Minimal Node + Express backend scaffold using TypeScript.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Install dev dependencies (if npm doesn't install them automatically):

```bash
npm install --save-dev typescript ts-node-dev @types/node @types/express eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

## Scripts

- `npm run dev` — run in development with auto-reload (`ts-node-dev`).
- `npm run build` — compile TypeScript to `dist/`.
- `npm start` — run the compiled production build.

## Quick run

Development:

```bash
npm install
npm run dev
```

Build + run production:

```bash
npm install
npm run build
npm start
```

## MongoDB

1. Create a `.env` file from the provided `.env.example` and set `MONGO_URI`:

```bash
cp .env.example .env
# edit .env and set MONGO_URI to your connection string
```

2. The server will connect to MongoDB automatically on startup (reads `MONGO_URI`).

## Project layout

- `src/index.ts` — app entrypoint (exports `app` and starts server).
- `src/routes` — express route definitions.
- `src/controllers` — controllers/handlers.
- `src/middleware` — express middleware (error handler).

## Next steps (suggested)

- Add ESLint config and run `npm run lint`.
- Add unit tests (Jest + ts-jest) and export `app` for testing.
- Add Dockerfile and CI/CD pipeline.
