# MongoDB

Una sola instancia de MongoDB 8, arrancada con `--noscripting` y autenticación (SEC-024). Cada componente usa su propio usuario con el mínimo privilegio. El esquema (colecciones e índices) lo crean las migraciones: ver [`conventions.md`](conventions.md).

## Ficheros

| Fichero | Función |
|---|---|
| `infrastructure/mongodb/init.js` | Crea los usuarios `app`, `migrate` y `backup` |
| `infrastructure/mongodb/Dockerfile` | Imagen `migrate` (`node:26-alpine` por digest, usuario `node`, por defecto `migrate-mongo up`) |
| `infrastructure/mongodb/package.json`, `package-lock.json` | `migrate-mongo` y el driver `mongodb` en versión exacta (S-28) |
| `infrastructure/mongodb/migrate-mongo-config.js` | Configuración de `migrate-mongo` |
| `infrastructure/mongodb/migrations/` | Migraciones. Las escribe el backend |

## Usuarios

| Usuario | Lo usa | Privilegios | Base de autenticación |
|---|---|---|---|
| `app` | `backend` | Rol propio `taskmkApp`: `find`, `insert`, `update` y `remove` sobre todas las colecciones de `taskmk` | `taskmk` |
| `migrate` | `migrate` | `readWrite` sobre `taskmk` | `taskmk` |
| `backup` | `backup.sh` | Rol `backup` | `admin` |
| root | Solo una persona, de forma interactiva (restauración, rotación) | `root` | `admin` |

- `app` no puede crear índices (`createIndex`), borrar colecciones (`drop`) ni la base (`dropDatabase`). Por eso **el backend nunca crea índices al arrancar** (REQ-I04).
- MongoDB deja que cualquier usuario con `insert` cree colecciones, también de forma explícita (`createCollection`). `app` lo tiene, pero no debe usarlo: las colecciones las crean las migraciones.
- `app` tampoco tiene `listCollections` ni `listIndexes`.
- `backup` lee todas las bases para `mongodump`, pero no puede escribir en `taskmk`.
- Cada usuario se autentica en su base. Con `app` y `migrate`, el URI `mongodb://<usuario>:<contraseña>@mongodb:27017/taskmk` ya autentica en `taskmk` sin `authSource`. `backup` necesita `authSource=admin`.
- Los nombres y las contraseñas llegan desde `mongodb.env` (ver [`environment.md`](environment.md)).

## Cuándo se ejecuta `init.js`

La imagen oficial de `mongo` ejecuta los ficheros de `/docker-entrypoint-initdb.d/` **solo al inicializar un volumen vacío**, como root (que crea la propia imagen con `MONGO_INITDB_ROOT_*`). `docker-compose.yml` monta `init.js` ahí en solo lectura (ver [`stack.md`](stack.md)).

- Con un volumen que ya tiene datos, `init.js` no se ejecuta: cambiar `mongodb.env` después no cambia nada.
- Si falta alguna variable `MONGO_INITDB_DATABASE`, `MONGO_APP_*`, `MONGO_MIGRATE_*` o `MONGO_BACKUP_*`, aborta con un error que nombra las que faltan. La inicialización falla y el contenedor no llega a arrancar.
- Comprueba si el rol o el usuario ya existen antes de crearlos, y no modifica los que existen.
- Nunca imprime contraseñas.
- No crea colecciones ni índices.

## `--noscripting`

El servidor no ejecuta JavaScript. `$where`, `$function`, `$accumulator` y `mapReduce` con JavaScript fallan con un error del motor de JavaScript. No es una restricción de permisos: afecta también a root.

## Rotar contraseñas

Como `init.js` no se repite, para rotar una contraseña hay que cambiarla a mano con root (`db.changeUserPassword`) y actualizar a la vez `mongodb.env` y el otro fichero que la contiene (`backend.env`, `migrate.env` o `backup.env`). En producción se sigue el procedimiento de `docs/deployment/production.md` (S-32, se documenta en la fase 12). En desarrollo basta con recrear el volumen y los ficheros (ver [`environment.md`](environment.md)).

## Imagen `migrate`

- Por defecto ejecuta `migrate-mongo up` y termina. Otros subcomandos se pasan como argumento: `status`, `down` (solo en desarrollo, ver [`conventions.md`](conventions.md)).
- Lee solo `MONGODB_URI` (`migrate.env`). La base de datos sale de la ruta del URI. Si falta la variable o la ruta, falla.
- Corre como `node` (uid 1000). El código pertenece a root y es de solo lectura. Funciona con `read_only`, `cap_drop: [ALL]` y `no-new-privileges`, con un `tmpfs` en `/tmp`.
- Solo contiene `node_modules` (sin dependencias de desarrollo; `npm ci --ignore-scripts`), `migrate-mongo-config.js` y `migrations/`.
- Registra las migraciones aplicadas en la colección `migrations` de `taskmk`.
- Dependabot actualiza la base y el lockfile, con 7 días de espera.
