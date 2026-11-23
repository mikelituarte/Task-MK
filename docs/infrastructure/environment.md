# Ficheros de entorno y secretos

Cada servicio recibe su propio fichero de entorno. En el repositorio solo se versionan los ejemplos (`infrastructure/env/*.env.example`); los ficheros reales están en `.gitignore` y nunca se suben (SEC-023, SEC-047).

Producción no usa estos ficheros: ver [`docs/deployment/secrets.md`](../deployment/secrets.md).

## Ficheros

| Ejemplo | Fichero real (dev) | Lo lee | Variables |
|---|---|---|---|
| `env/backend.env.example` | `env/backend.env` | `backend` | `PORT`, `MONGODB_URI` (usuario `app`), `JWT_ACCESS_SECRET`, `JWT_ACCESS_TTL`, `REFRESH_TTL`, `REFRESH_FAMILY_TTL`, `REFRESH_GRACE_SECONDS`, `CSRF_SECRET`, `LOGIN_THROTTLE_SECRET`, `APP_URL`, `LOG_LEVEL` |
| `env/mongodb.env.example` | `env/mongodb.env` | `mongodb` | `MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_ROOT_PASSWORD`, `MONGO_INITDB_DATABASE`, `MONGO_APP_USER`, `MONGO_APP_PASSWORD`, `MONGO_MIGRATE_USER`, `MONGO_MIGRATE_PASSWORD`, `MONGO_BACKUP_USER`, `MONGO_BACKUP_PASSWORD` |
| `env/migrate.env.example` | `env/migrate.env` | `migrate` | `MONGODB_URI` (usuario `migrate`; la ruta del URI es la base de datos de `migrate-mongo-config.js`) |
| `env/backup.env.example` | `env/backup.env` | `backup.sh` (host) | `MONGO_BACKUP_USER`, `MONGO_BACKUP_PASSWORD`, `BACKUP_AGE_RECIPIENT`, `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY` |
| `env/compose.env.example` | `infrastructure/.env` | Docker Compose (interpolación) | `ENV_DIR`, `DOMAIN`, `ACME_EMAIL`, `IMAGE_TAG`, `GHCR_OWNER`. Nada secreto |

Las rutas son relativas a `infrastructure/`. Para E2E hay un juego aparte en `infrastructure/env/e2e/`: `backend.env`, `mongodb.env`, `migrate.env` y `compose.env` (con `ENV_DIR=./env/e2e` y `DOMAIN=localhost`). E2E no usa `backup.env`.

Reglas:

- Cada secreto lleva en el ejemplo el marcador `CHANGE_ME`. El backend rechaza al arrancar cualquier secreto que lo contenga, en todos los entornos (`plan-backend` D-22).
- El backend también rechaza cualquier variable `BACKUP_*` o `MONGO_INITDB_*`: cada fichero llega solo a su servicio.
- Las contraseñas de MongoDB se repiten y deben coincidir: `MONGO_APP_PASSWORD` con el `MONGODB_URI` de `backend.env`, `MONGO_MIGRATE_PASSWORD` con el de `migrate.env`, y `MONGO_BACKUP_*` de `mongodb.env` con los de `backup.env`.
- `mongodb.env` solo tiene efecto al inicializar un volumen vacío, cuando `init.js` crea los usuarios (ver [`mongodb.md`](mongodb.md)). Cambiar una contraseña después exige el procedimiento de rotación de producción (S-32) o recrear el volumen en desarrollo.
- En desarrollo, `backup.env` lleva valores de relleno: `make backup` local no cifra ni sube a S3 (S-08).
- Toda variable nueva se añade a la vez en su `*.env.example`, en la validación Zod (si es del backend), en `env-init` (si es secreta) y en este documento.

## Generar los ficheros: `env-init`

```sh
infrastructure/scripts/env-init
```

El target `make env-init` llegará con el `Makefile` (fase 6) y llamará a este script.

Qué hace:

- Crea los ficheros de dev y de E2E a partir de los ejemplos, sustituyendo cada `CHANGE_ME` por un valor aleatorio:
  - `JWT_ACCESS_SECRET`, `CSRF_SECRET` y `LOGIN_THROTTLE_SECRET`: `openssl rand -base64 48`.
  - Contraseñas de MongoDB: `openssl rand -hex 32`. Solo contienen `[0-9a-f]`, así que van dentro de `MONGODB_URI` sin codificar (C-10).
  - Credenciales S3 de relleno de `backup.env`: `openssl rand -hex 32`.
- Usa la misma contraseña de cada usuario de MongoDB en todos los ficheros donde aparece. Dev y E2E tienen secretos distintos.
- Nunca sobrescribe un fichero existente: ejecutarlo dos veces no cambia nada.
- Crea los ficheros con permisos `600` (`umask 077`).
- No imprime ningún secreto: solo los nombres de los ficheros que crea.
- Aborta sin crear nada si `TASKMK_ENV=production`.
- Solo necesita `bash` y `openssl`.

Los ficheros que comparten contraseñas de MongoDB forman un conjunto (`backend`, `mongodb`, `migrate` y, en dev, `backup`). Si falta alguno pero existe otro del mismo conjunto, `env-init` aborta: no lee los existentes, y generar uno nuevo rompería la coincidencia de contraseñas. Para regenerar, borra todos los ficheros del conjunto y, si el volumen de MongoDB ya estaba inicializado, también el volumen. `infrastructure/.env` y `env/e2e/compose.env` no tienen secretos y se generan por separado.

Si añades una variable secreta a un ejemplo, `env-init` falla hasta que se le enseñe a generarla.

## Regla de precedencia (S-03)

- `NODE_ENV`, `COOKIE_SECURE` y `TRUST_PROXY` **no** van en `backend.env`. Los fija el bloque `environment:` del servicio `backend` en cada override de Compose (`dev`, `e2e`, `prod`).
- Si una variable aparece en `environment:` y en `env_file`, prevalece `environment:`.
- `APP_URL` vive en `backend.env` (`http://localhost:5173` en dev, `https://<DOMAIN>` en prod). El override `e2e` lo fija a `https://localhost` en `environment:`.

| Variable | `dev` | `e2e` | `prod` | Dónde |
|---|---|---|---|---|
| `NODE_ENV` | `development` | `production` | `production` | `environment:` del override |
| `COOKIE_SECURE` | `false` | `true` | `true` | `environment:` del override |
| `TRUST_PROXY` | `1` | `2` | `2` | `environment:` del override |
| `APP_URL` | `http://localhost:5173` | `https://localhost` | `https://<DOMAIN>` | `backend.env`; en `e2e`, `environment:` |
| `ENV_DIR` | `./env` | `./env/e2e` | `/etc/taskmk` | `infrastructure/.env`, `env/e2e/compose.env` o `/opt/taskmk/infrastructure/.env` |
| `DOMAIN` | No se usa | `localhost` | Dominio dedicado | Ídem |

Los ficheros de Compose que aplican esta regla llegan en las fases 5 y 7.

## Agentes

Las reglas `deny` de `.claude/settings.json` impiden a Claude Code leer o editar `**/*.env` y `.env*` (ver [`devcontainer.md`](devcontainer.md)). Los ejemplos `*.env.example` sí son accesibles. Para comprobar los ficheros generados, usa solo comprobaciones que no revelen valores: existencia, permisos, número de líneas, `grep -c CHANGE_ME` y `sha256sum`.
