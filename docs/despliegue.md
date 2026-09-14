# Despliegue

Un solo `compose.yml` con HomeBox, esta API, el bot y Caddy haciendo de proxy con TLS.
Estructura en el servidor:

```
/opt/inventario/
├── compose.yml
├── .env                 # solo el pepper de HomeBox        (chmod 600)
├── app.env              # secretos de la API y del bot     (chmod 600)
├── app/                 # clon de este repo
└── caddy/Caddyfile
```

## compose.yml

```yaml
# Fíjalo a propósito: el nombre del proyecto prefija los volúmenes, y sin esto
# mover el fichero de carpeta apuntaría a un volumen nuevo y vacío.
name: inventario

services:
  homebox:
    image: ghcr.io/sysadminsmedia/homebox:latest
    restart: always
    environment:
      - HBOX_LOG_LEVEL=info
      - HBOX_WEB_MAX_UPLOAD_SIZE=50          # MB; las fotos de móvil pesan
      - HBOX_OPTIONS_ALLOW_ANALYTICS=false
      - HBOX_OPTIONS_ALLOW_REGISTRATION=false
      - HBOX_AUTH_API_KEY_PEPPER=${HBOX_AUTH_API_KEY_PEPPER:?falta en .env}
    volumes:
      - homebox-data:/data/
    ports:
      - 127.0.0.1:3100:7745                  # solo loopback: entra por Caddy

  api:
    build:
      context: ./app
      target: runtime
    restart: unless-stopped
    env_file: ./app.env
    environment:
      - NODE_ENV=production
      - PORT=3000
      - HOMEBOX_URL=http://homebox:7745      # red interna, sin salir a internet
    depends_on:
      homebox:
        condition: service_healthy

  bot:
    build:
      context: ./app
      target: runtime
    restart: unless-stopped
    env_file: ./app.env
    environment:
      - NODE_ENV=production
      - HOMEBOX_URL=http://homebox:7745
    command: ["node", "dist/telegram/start.js"]
    # El bot no sirve HTTP: el healthcheck de la imagen lo daría por muerto.
    healthcheck:
      disable: true
    depends_on:
      homebox:
        condition: service_healthy

  caddy:
    image: caddy:latest
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile
      - caddy-data:/data                     # sin esto pierde los certificados
      - caddy-config:/config
    depends_on:
      - homebox
      - api

volumes:
  homebox-data:
  caddy-data:
  caddy-config:
```

## Caddyfile

```
inventario.example.com {
	reverse_proxy homebox:7745
}

mcp.example.com {
	# Solo /mcp se publica. El resto de la API no tiene autenticación propia
	# y se queda en la red interna.
	handle /mcp* {
		reverse_proxy api:3000
	}
	handle {
		respond "Not found" 404
	}
}
```

## Puesta en marcha

```bash
# El pepper hashea las API keys de HomeBox. Cambiarlo invalida las existentes,
# que es justo lo que quieres si alguna se filtró.
umask 077
printf 'HBOX_AUTH_API_KEY_PEPPER=%s\n' "$(openssl rand -hex 32)" > .env

git clone https://github.com/debugsito/homebox-mcp.git app
# Crea app.env con HOMEBOX_API_KEY, la clave de IA, MCP_AUTH_TOKEN y lo de Telegram
chmod 600 app.env

docker compose up -d
```

Para actualizar:

```bash
cd app && git pull && cd ..
docker compose build api bot && docker compose up -d api bot
```

## Cosas que muerden

**Mover el compose renombra los volúmenes.** Docker Compose deriva el nombre del proyecto de
la carpeta, y ese nombre prefija los volúmenes. Mover el fichero sin fijar `name:` hace que
apunte a un volumen nuevo y vacío, con toda la pinta de que se borraron los datos. Antes de
aplicar un compose movido: `docker compose ps` desde la ruta nueva debe listar los
contenedores que ya corren.

**Caddy sin volumen pierde los certificados.** En cada recreación los vuelve a pedir a Let's
Encrypt, que tiene un tope de 5 certificados duplicados por semana y dominio. Se agota antes
de lo que parece mientras ajustas la configuración.

**El bot hereda el healthcheck de la imagen.** Como no sirve HTTP, Docker lo da por muerto y
lo reinicia en bucle. De ahí el `healthcheck: disable: true`.

**Copiar la base de datos en caliente da una base vacía.** HomeBox usa SQLite en modo WAL, y
casi todo vive en el `-wal`. Para un backup consistente hay que parar el contenedor y copiar
el volumen entero, no solo el `.db`.

**Si el pepper cambia, todas las API keys dejan de valer.** Es la forma rápida de revocar una
clave filtrada, pero hay que acordarse de crear una nueva y actualizar `app.env`.

## Backup

Con el contenedor parado, para que el WAL esté consolidado:

```bash
docker compose stop homebox
cp -a /var/lib/docker/volumes/inventario_homebox-data/_data \
      ./backups/homebox-$(date +%Y%m%d-%H%M%S)
docker compose start homebox
```
