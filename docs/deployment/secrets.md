# Secretos de producción

En producción, los ficheros de entorno no salen del repositorio ni de `env-init`: los crea a mano una persona en el VPS. Nunca pasan por GitHub, ni como fichero, ni como secreto de Actions, ni en un PR o *issue*.

Este documento usa marcadores (`<DOMAIN>`, `<VPS_HOST>`…); los valores reales no se versionan (ver la regla del repositorio público en el [`README`](../../README.md)).

## Ficheros

| Fichero | Lo lee | Propietario | Permisos |
|---|---|---|---|
| `/etc/taskmk/backend.env` | `backend` | `deploy` | `600` |
| `/etc/taskmk/mongodb.env` | `mongodb` | `deploy` | `600` |
| `/etc/taskmk/migrate.env` | `migrate` | `deploy` | `600` |
| `/etc/taskmk/backup.env` | `backup.sh` (cron de `deploy`) | `deploy` | `600` |

Su contenido es el de los ejemplos de `infrastructure/env/*.env.example` (ver [`docs/infrastructure/environment.md`](../infrastructure/environment.md)), con estos cambios:

- Cada `CHANGE_ME` se sustituye por un secreto nuevo, distinto del de cualquier otro entorno:
  - `JWT_ACCESS_SECRET`, `CSRF_SECRET` y `LOGIN_THROTTLE_SECRET`: `openssl rand -base64 48`.
  - Contraseñas de MongoDB: `openssl rand -hex 32` (no hace falta codificarlas en el URI).
- `APP_URL=https://<DOMAIN>`.
- En `backup.env`, los valores reales del proveedor: `BACKUP_AGE_RECIPIENT` (clave pública `age`), `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET` y la credencial S3 de solo escritura.
- Las contraseñas de MongoDB deben coincidir entre `mongodb.env`, el `MONGODB_URI` de `backend.env` y de `migrate.env`, y `backup.env`.

`NODE_ENV`, `COOKIE_SECURE` y `TRUST_PROXY` no van en `backend.env`: los fija el override de producción (S-03).

`infrastructure/.env` de `/opt/taskmk` lleva `ENV_DIR=/etc/taskmk`, `DOMAIN=<DOMAIN>`, `ACME_EMAIL=<ACME_EMAIL>`, `GHCR_OWNER=<owner>` e `IMAGE_TAG`, que actualiza `make prod-deploy` (S-06). No es secreto, pero tampoco se versiona.

## Procedimiento

Lo hace una persona con el usuario `admin`, por SSH con clave, usando `sudo` (C-08). `env-init` no sirve aquí: aborta con `TASKMK_ENV=production`.

1. Generar los secretos en el propio VPS, sin pegarlos en ninguna herramienta externa salvo el gestor de contraseñas.
2. Crear el directorio y los ficheros sin que existan un momento con permisos abiertos:

   ```sh
   sudo install -d -o deploy -g deploy -m 700 /etc/taskmk
   sudo install -o deploy -g deploy -m 600 /dev/null /etc/taskmk/backend.env
   sudoedit -u deploy /etc/taskmk/backend.env
   # Repetir los dos últimos pasos con mongodb.env, migrate.env y backup.env.
   ```

3. Comprobar propietario y permisos:

   ```sh
   sudo sh -c "stat -c '%U %a %n' /etc/taskmk /etc/taskmk/*.env"
   ```

   Debe salir `deploy 700` para el directorio y `deploy 600` para cada fichero.

4. Comprobar que no queda ningún marcador: `sudo sh -c 'grep -c CHANGE_ME /etc/taskmk/*.env'` debe dar `0` en todos.
5. Guardar una copia de cada fichero en el gestor de contraseñas. La contraseña root de MongoDB solo está ahí y en `mongodb.env`; se necesita al restaurar.

## Reglas

- Nunca se copian a GitHub, a la CI, a un PR, a un *issue*, a un chat ni a los logs.
- Nunca se reutilizan secretos de desarrollo o E2E.
- `mongodb.env` solo tiene efecto al inicializar el volumen. Rotar una contraseña de MongoDB después exige el procedimiento manual con root de `production.md` (S-32, se documenta en la fase 12), que actualiza los dos ficheros afectados.
- Cambiar `LOGIN_THROTTLE_SECRET` reinicia los contadores de intentos de login.
