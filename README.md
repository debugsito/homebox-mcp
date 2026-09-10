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
| `npm run mcp` | Servidor MCP por stdio |
| `npm run seed` | Siembra la taxonomía (`--dry-run` para simular) |

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
| POST | `/mcp` | Servidor MCP por Streamable HTTP (requiere `Bearer`) |

## Tools

`find_item` · `search_item` · `get_item` · `list_items` · `list_locations`
`resolve_item` · `resolve_location` · `create_item` · `update_item` · `move_item`

`find_item` es la preferida para "¿dónde está X?": resuelve el nombre y devuelve la
ruta completa (`Homie > Cuarto Oficina > Escritorio > Cajón 1`) en una llamada.

## Variables de entorno

| Variable | Por defecto | Descripción |
|----------|-------------|-------------|
| `PORT` | `3000` | Puerto del servidor |
| `NODE_ENV` | `development` | Entorno |
| `HOMEBOX_URL` | — | URL de la instancia de HomeBox |
| `HOMEBOX_API_KEY` | — | API key de HomeBox |
| `AI_PROVIDER` | `groq` | `groq` \| `gemini` \| `minimax` |
| `GROQ_API_KEY` | — | Obligatoria solo si `AI_PROVIDER=groq` |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Modelo de Groq |
| `GEMINI_API_KEY` | — | Obligatoria solo si `AI_PROVIDER=gemini` |
| `GEMINI_MODEL` | `gemini-3.6-flash` | Modelo de Gemini, el que analiza las fotos |
| `MCP_AUTH_TOKEN` | — | Token del MCP por HTTP. Sin él, `/mcp` rechaza todo |

## MCP

Las mismas tools se exponen por MCP, con anotaciones para que el cliente
distinga consulta de escritura (`readOnlyHint`, `destructiveHint`), más un
recurso `homebox://locations` con el árbol completo.

**stdio** — para clientes locales. En `.mcp.json` o la config del cliente:

```json
{
  "mcpServers": {
    "homebox": {
      "command": "npx",
      "args": ["tsx", "src/mcp/stdio.ts"],
      "cwd": "/ruta/al/repo"
    }
  }
}
```

**HTTP** — `POST /mcp`, sin sesión, con `Authorization: Bearer $MCP_AUTH_TOKEN`.
Cada petición crea y cierra su propio servidor. `GET` y `DELETE` responden 405
porque el modo sin sesión no usa el canal SSE.

Prueba de humo end-to-end: `npx tsx scripts/smoke-mcp.ts`.

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
