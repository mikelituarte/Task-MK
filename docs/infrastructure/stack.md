# Stack de Docker Compose

Ficheros en `infrastructure/`:

| Fichero | Uso |
|---|---|
| `docker-compose.yml` | Base: servicios, redes, volumen, health checks y restricciones. Sin `ports:`. No se usa solo |
| `docker-compose.dev.yml` | Desarrollo: build local (`target: dev`), código montado, `migrate` automático y puertos en `127.0.0.1` |
| `docker-compose.prod.yml`, `docker-compose.e2e.yml` | Producción y E2E, con `proxy` (Caddy). Llegan en la fase 7 |

## Registro de imágenes base

Todas se fijan por digest y las actualiza Dependabot con 7 días de espera. Al cambiar una, se actualiza esta tabla.

| Imagen | Versión | Digest | Consultado | Dónde |
|---|---|---|---|---|
| `mongo` | 8.0.38 | `sha256:479e85ced54ffb8a40dade1dcde2da2a9ae858515b9415e9cc54bfb8f0575d01` | 2026-11-23 | `docker-compose.yml` (`mongodb`) |
| `node` | 26-alpine (Node 26.13.1) | `sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5` | 2026-11-23 | `infrastructure/mongodb/Dockerfile` (`migrate`) |

La versión de MongoDB es la misma que deben usar los tests del backend con `mongodb-memory-server`.

## Desarrollo

### Servicios

| Servicio | Imagen | Redes | Puerto publicado | Health check | Espera a |
|---|---|---|---|---|---|
| `mongodb` | `mongo` (registro) | `data` | `127.0.0.1:27017` | `mongosh` `ping` contra la IP del contenedor | — |
| `migrate` | `infrastructure/mongodb/Dockerfile` | `data` | — | — (tarea puntual, termina con 0) | `mongodb` `healthy` |
| `backend` | `backend/Dockerfile`, `target: dev` | `app`, `data` | `127.0.0.1:3000` | `GET /health` en 3000 | `mongodb` `healthy` y `migrate` terminado con 0 |
| `frontend` | `frontend/Dockerfile`, `target: dev` | `edge`, `app` | `127.0.0.1:5173` | `GET /` en 5173 | `backend` `healthy` |

- `frontend` no está en `data`: no ve `mongodb` (SEC-035).
- En `dev` ninguna red es `internal`. En `prod` y `e2e`, `data` y `app` lo son (fase 7).
- Volumen nombrado `mongo-data` para `/data/db`. `init.js` se monta en solo lectura.
- `backend` y `frontend` montan su código en `/app`, con un volumen anónimo en `/app/node_modules`.
- `migrate` monta `infrastructure/mongodb/migrations/` en lectura y escritura, porque `migrate-mongo create` escribe ahí; `up` no escribe nada. Para crear una migración, se ejecuta con el uid del usuario, para que el fichero sea suyo:

  ```sh
  docker compose … run --rm --no-deps --user "$(id -u):$(id -g)" migrate create <descripcion>
  ```

  En la fase 6 lo hará `make migrate-create n=<descripcion>`.
- `NODE_ENV`, `COOKIE_SECURE` y `TRUST_PROXY` los fija `environment:` del override (S-03, ver [`environment.md`](environment.md)).

### Restricciones de contenedor

| Servicio | `no-new-privileges` | `cap_drop: [ALL]` | `read_only` | `tmpfs` | `pids_limit` |
|---|---|---|---|---|---|
| `frontend` | Sí | Sí | Sí | `/tmp`, `/var/cache/nginx` | 200 |
| `backend` | Sí | Sí | Sí | `/tmp` | 200 |
| `migrate` | Sí | Sí | Sí | `/tmp` | 200 |
| `mongodb` | Sí | No | No | — | 500 |

Los límites de CPU y memoria (`deploy.resources`) son solo de producción.

### Health check de `mongodb`

La imagen oficial de `mongo` arranca, al inicializar un volumen vacío, un `mongod` temporal que solo escucha en `127.0.0.1`, ejecuta `init.js` y lo para antes de arrancar el definitivo. Un `ping` a `localhost` responde también al temporal, y `mongodb` quedaría `healthy` antes de que existan los usuarios. Por eso el health check conecta a `$(hostname)`, la IP del contenedor, a la que solo responde el servidor definitivo.

Se aparta del comando del plan (`mongosh --quiet --eval "db.adminCommand('ping').ok"`, sin `--host`). Se comprobó el 2026-11-23: durante `init.js`, el comando del plan ya daba OK y el nuevo no.

### Arrancar

Mientras no exista el `Makefile` (fase 6), desde `infrastructure/`:

```sh
scripts/env-init        # una sola vez: genera env/*.env e infrastructure/.env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.dev.yml ps
```

`ENV_DIR` sale de `infrastructure/.env`. Si falta, Compose se para con el mensaje `Falta ENV_DIR`.

Para borrar los datos de desarrollo hay que bajar el stack con `down -v`, que elimina el volumen `mongo-data`. Hace falta, por ejemplo, para regenerar los ficheros de entorno. No se hace nunca sin confirmación humana.
