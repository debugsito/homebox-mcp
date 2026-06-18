# inventory-ai-api

Backend API layer between HomeBox and AI assistants.

## Stack

- Node.js 22+
- TypeScript
- Fastify
- Docker / Docker Compose
- ESLint / Prettier
- Zod
- Pino Logger

## Getting Started

### Development

```bash
npm install
npm run dev
```

### Production (Docker)

```bash
docker compose up --build
```

### Production (Local)

```bash
npm run build
npm start
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment mode |

## Architecture

```
src/
├── app.ts          # App factory
├── server.ts       # Entry point
├── config/         # Environment configuration
├── modules/        # Business logic modules
├── services/       # External service integrations
├── routes/         # HTTP route definitions
├── plugins/        # Fastify plugins
├── middlewares/    # Express-style middlewares
├── schemas/        # Zod validation schemas
├── types/          # TypeScript type definitions
└── utils/          # Utility functions
```
