# homebox-mcp

Servidor **MCP** y bot de **Telegram** sobre [HomeBox](https://homebox.software), para
consultar y mantener el inventario de tu casa en lenguaje natural.

```
tú: ¿dónde está el extensor hdmi?
 →  Homie > Cuarto Oficina > Escritorio > Cajón 1

tú: [foto de un cajón]
 →  ✓ Extensor HDMI via UTP
       extiende HDMI por cable de red
       → Homie > Cuarto Oficina > Escritorio > Cajón 1
         ahí están los cables de vídeo
    [ Guardar ]  [ Descartar ]
```

HomeBox pone la base de datos y la interfaz web. Esto pone encima una capa de once
herramientas —buscar, resolver nombres a ubicaciones, crear, mover, adjuntar fotos— y la
expone por tres vías que comparten el mismo registro:

- **MCP** (stdio y HTTP) para Claude Code, Claude Desktop o cualquier cliente MCP.
- **Bot de Telegram** para el día a día desde el móvil, con fotos.
- **API REST** propia, para lo que quieras montar encima.

## Requisitos

- Node.js 22+
- Una instancia de HomeBox **v0.26 o superior** (la API de `entities` cambió en esa versión)
- Una clave de [Groq](https://console.groq.com/keys) o de
  [Google AI Studio](https://aistudio.google.com/apikey) si quieres las funciones de IA.
  Para solo MCP no hace falta ninguna: el cliente pone su propio modelo.

## Puesta en marcha

```bash
git clone https://github.com/debugsito/homebox-mcp.git
cd homebox-mcp
npm install
cp .env.example .env      # y rellenar (ver tabla abajo)
npm run dev
```

Comprueba que conecta:

```bash
curl localhost:3000/tools/run -H 'Content-Type: application/json' \
  -d '{"tool":"list_locations"}'
```

## Variables de entorno

| Variable | Por defecto | Descripción |
|----------|-------------|-------------|
| `PORT` | `3000` | Puerto del servidor |
| `NODE_ENV` | `development` | Entorno |
| `HOMEBOX_URL` | — | URL de tu HomeBox |
| `HOMEBOX_API_KEY` | — | De *Perfil › API Tokens* en HomeBox |
| `AI_PROVIDER` | `groq` | `groq` \| `gemini` \| `minimax` |
| `GROQ_API_KEY` | — | Obligatoria solo si `AI_PROVIDER=groq` |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Groq retira modelos a menudo; ver nota abajo |
| `GEMINI_API_KEY` | — | Obligatoria solo si `AI_PROVIDER=gemini`. Es quien analiza las fotos |
| `GEMINI_MODEL` | `gemini-3.6-flash` | |
| `MCP_AUTH_TOKEN` | — | Mínimo 32 caracteres. Sin esto, `POST /mcp` rechaza todo |
| `TELEGRAM_BOT_TOKEN` | — | De [@BotFather](https://t.me/botfather) |
| `TELEGRAM_ALLOWED_CHAT_IDS` | — | Chat ids autorizados, separados por comas |

> **Los modelos caducan.** Los proveedores retiran modelos sin avisar y el síntoma es un 404
> *con la clave puesta* (una clave mala da 401). Comprueba qué tienes disponible con
> `GET https://api.groq.com/openai/v1/models` o `GET /v1beta/models` en Gemini. Ojo: Gemini
> puede listar un modelo que ya no sirve a cuentas nuevas.

## Diseñar tu taxonomía

Es la decisión que más te va a costar deshacer, así que merece unos minutos antes de cargar
nada. En HomeBox v0.26 todo es una `entity` y lo que distingue una ubicación de un objeto es
`entityType.isLocation`.

**La regla que mejor funciona: es ubicación todo lo que puedes levantar y llevarte con su
contenido dentro.** Las cajas de plástico, los organizadores y las maletas son ubicaciones, no
objetos. Si mueves una caja de estante, actualizas *un* registro; si su contenido colgara
directamente del estante, tendrías que reubicar sus treinta cosas una a una.

**Modela la estructura fija solo hasta donde mirar a ojo deje de ser cómodo.** Si abres una
vitrina y encuentras lo que buscas de un vistazo, subdividirla en «arriba» y «abajo» no te
ahorra nada y te obliga a elegir cada vez que guardas algo. Añade ese nivel el día que buscar
canse, no antes.

**Registra por separado lo que buscarías por su nombre.** Doscientos tornillos surtidos son
*un* registro con una buena descripción. La prueba: ¿te imaginas preguntando «¿dónde está X?»
Si sí, X merece ficha propia.

Un ejemplo que sale de aplicar esas tres reglas:

```
Sede > Cuarto > Mueble > (Cajón N | Vitrina N | Nicho N) > Caja portátil
```

`scripts/seed-taxonomy.ts` siembra tipos y árbol de forma idempotente; edita el `TREE` con el
tuyo y ejecuta `npm run seed -- --dry-run` para ver qué haría.

## Carga inicial

Para inventariar de golpe, declara lotes en JSON y aplícalos:

```bash
npx tsx scripts/import-lote.ts lotes/cajon-1.json --dry-run
npx tsx scripts/import-lote.ts lotes/cajon-1.json
```

Valida el lote entero antes de escribir —ubicaciones, tipos y ficheros de foto— y aborta sin
tocar nada si algo falla. Es idempotente: corriges el JSON y reejecutas. Ver
[`lotes/README.md`](lotes/README.md).

## MCP

Las once tools se exponen con anotaciones para que el cliente distinga consulta de escritura
(`readOnlyHint`, `destructiveHint`), más un recurso `homebox://locations` con el árbol completo.

**stdio** — para clientes locales:

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

**HTTP** — `POST /mcp` sin sesión, con `Authorization: Bearer $MCP_AUTH_TOKEN`. Cada petición
crea y cierra su propio servidor. `GET` y `DELETE` responden 405 porque el modo sin sesión no
usa el canal SSE.

Prueba end-to-end: `npx tsx scripts/smoke-mcp.ts`.

## Bot de Telegram

1. `/newbot` en [@BotFather](https://t.me/botfather) y guarda el token.
2. `/setprivacy` → **Disable**, o en grupos solo verá mensajes que empiecen por `/`.
3. Escríbele algo y saca tu chat id de
   `https://api.telegram.org/bot<TOKEN>/getUpdates`. Si sale vacío sin haber webhook, es que
   no pulsaste **INICIAR**.
4. Rellena `TELEGRAM_BOT_TOKEN` y `TELEGRAM_ALLOWED_CHAT_IDS`, y `npm run bot`.

Sin allowlist el bot no responde a nadie, y es deliberado: un bot de Telegram es público por
definición y este mueve tu inventario.

- **Texto** → tool-calling con historial de los últimos 12 mensajes.
- **Foto** → propuesta con botones. No escribe nada hasta que confirmas.
- `/ubicaciones` lista el árbol, `/olvidar` reinicia el hilo.

## Despliegue

`compose.yml` levanta solo la API contra un HomeBox externo. Para el despliegue completo
—HomeBox, esta API, el bot y Caddy con TLS— hay un ejemplo comentado en
[`docs/despliegue.md`](docs/despliegue.md).

Dos cosas que conviene no aprender por las malas:

- Si mueves el `compose.yml` de carpeta, **fija `name:`**. El nombre del proyecto prefija los
  volúmenes, y sin fijarlo apuntarás a un volumen nuevo y vacío con toda la pinta de que se
  borraron los datos. Comprueba con `docker compose ps` desde la ruta nueva antes de aplicar.
- Dale a Caddy un volumen para `/data`. Sin él pierde los certificados en cada recreación y
  vuelve a pedirlos a Let's Encrypt, que tiene un tope de 5 por semana y dominio.

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/homebox/items` | Lista items (paginado) |
| GET | `/homebox/items/search?q=` | Busca items por texto |
| GET | `/homebox/items/:id` | Detalle de un item |
| GET | `/homebox/locations` | Árbol de ubicaciones |
| GET | `/tools` | Lista las tools registradas |
| POST | `/tools/run` | Ejecuta una tool: `{ tool, input }` |
| GET | `/ai/tools` | Esquemas que se le mandan al LLM |
| POST | `/ai/chat` | Conversación con tool-calling |
| POST | `/mcp` | MCP por Streamable HTTP (requiere `Bearer`) |

Solo `/mcp` está pensado para exponerse a internet. El resto **no tiene autenticación propia**:
déjalo en la red interna o ponle una delante.

## Tools

`find_item` · `search_item` · `get_item` · `list_items` · `list_locations`
`resolve_item` · `resolve_location` · `create_item` · `update_item` · `move_item`
`attach_photo`

`find_item` es la preferida para «¿dónde está X?»: resuelve el nombre y devuelve la ruta
completa en una sola llamada. `list_items` acepta una `location` para no listar el inventario
entero.

## Notas sobre la API de HomeBox

Cosas de v0.26 que no están en el swagger y solo aparecen al probar:

- `PATCH /entities/{id}` **ignora en silencio** `name` y `description`. Renombrar exige `PUT`
  con la entidad completa; el cliente lo resuelve leyendo y fusionando.
- La ruta completa de un objeto sale de `GET /entities/{id}/path`. El campo `parent` de la
  entidad solo trae el contenedor inmediato.
- `POST /entities/{id}/attachments` responde `201` con **la entidad entera**, no con el
  adjunto creado: hay que localizarlo dentro de su lista `attachments`. El `DELETE` devuelve
  204 sin cuerpo.
- Con `FormData` no fijes `Content-Type` a mano o se pierde el boundary del multipart.
- Las entidades traen `parent` y `entityType` anidados enteros. Mandarlas crudas a un modelo
  desperdicia contexto: `summarizeItem()` las recorta a una sexta parte.

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor con recarga |
| `npm run build` | Compila a `dist/` |
| `npm start` | Arranca desde `dist/` |
| `npm test` | Suite de Vitest |
| `npm run lint` | ESLint |
| `npm run mcp` | MCP por stdio |
| `npm run bot` | Bot de Telegram |
| `npm run seed` | Siembra la taxonomía (`-- --dry-run` para simular) |

## Arquitectura

```
src/
├── config/       # Validación del entorno con Zod
├── modules/
│   ├── homebox/  # Cliente y servicio de HomeBox
│   ├── resolvers/# Nombre humano -> ID
│   ├── tools/    # Registry compartido por MCP, bot y API
│   ├── ingest/   # Propuestas a partir de fotos
│   └── ai/       # Proveedores y loop de tool-calling
├── mcp/          # Transportes stdio y HTTP
├── telegram/     # Bot
└── routes/       # API REST
```

El registry de tools es la pieza central: MCP, bot y API son tres fachadas sobre él, así que
una tool nueva aparece en las tres a la vez.

## Licencia

MIT. Ver [LICENSE](LICENSE).
