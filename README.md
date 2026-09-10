# inventory-ai-api

Capa de API entre HomeBox y asistentes de IA, para consultar y mantener el inventario
de casa en lenguaje natural.

## Stack

- Node.js 22+ · TypeScript · Fastify
- Zod · Pino · Vitest
- ESLint / Prettier
- Docker / Docker Compose

## Puesta en marcha

```bash
npm install
cp .env.example .env   # y rellenar las claves
npm run dev
```

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo con recarga |
| `npm run build` | Compila TypeScript a `dist/` |
| `npm start` | Arranca desde `dist/` |
| `npm test` | Ejecuta la suite de Vitest |
| `npm run lint` | ESLint sobre `src` |

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/homebox/items` | Lista items (paginado) |
| GET | `/homebox/items/search?q=` | Busca items por texto |
| GET | `/homebox/items/:id` | Detalle de un item |
| GET | `/homebox/locations` | Árbol de ubicaciones |
| GET | `/homebox/locations/:id` | Detalle de una ubicación |
| GET | `/tools` | Lista las tools registradas |
| POST | `/tools/run` | Ejecuta una tool: `{ tool, input }` |
| GET | `/ai/tools` | Esquemas que se le mandan al LLM |
| POST | `/ai/chat` | Conversación con tool-calling |
| POST | `/ai/debug` | Inspecciona una vuelta de tool-calling |

## Tools

`find_item` · `search_item` · `get_item` · `list_items` · `list_locations`
`resolve_item` · `resolve_location` · `create_item` · `update_item` · `move_item`

`find_item` es la preferida para "¿dónde está X?": resuelve el nombre y devuelve la
ruta completa (`Homie > Cuarto Oficina > Cajones Escritorio > Cajon 1`) en una llamada.

## Variables de entorno

| Variable | Por defecto | Descripción |
|----------|-------------|-------------|
| `PORT` | `3000` | Puerto del servidor |
| `NODE_ENV` | `development` | Entorno |
| `HOMEBOX_URL` | — | URL de la instancia de HomeBox |
| `HOMEBOX_API_KEY` | — | API key de HomeBox |
| `AI_PROVIDER` | `groq` | `groq` \| `gemini` \| `minimax` |
| `GROQ_API_KEY` | — | Requerida aunque el proveedor sea otro |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Modelo de Groq |

## Notas sobre la API de HomeBox

Contra HomeBox v0.26, donde todo es una `entity` y `entityType.isLocation` distingue
una ubicación de un objeto:

- `PATCH /entities/{id}` **ignora en silencio** `name` y `description`. Renombrar exige
  `PUT` con la entidad completa; el cliente lo resuelve leyendo y fusionando.
- La ruta completa de un objeto sale de `GET /entities/{id}/path`. El campo `parent` que
  trae la entidad solo tiene el contenedor inmediato.

## Arquitectura

```
src/
├── app.ts              # Factory de la app
├── server.ts           # Entrypoint
├── config/             # Validación del entorno
├── modules/
│   ├── homebox/        # Cliente y servicio de HomeBox
│   ├── resolvers/      # Nombre humano -> ID
│   ├── tools/          # Registry de tools
│   └── ai/             # Proveedores y loop de tool-calling
├── plugins/            # Plugins de Fastify
├── routes/             # Rutas HTTP
├── schemas/            # Esquemas Zod
└── utils/              # Utilidades
```
