# Devcontainer de los agentes

Entorno aislado en el que trabajan los agentes (plan-infrastructure, fase 2; SEC-008). Los agentes nunca se ejecutan directamente en la máquina del desarrollador.

## Qué contiene

| Fichero | Función |
|---|---|
| `.devcontainer/devcontainer.json` | Servicio `workspace`, feature docker-in-docker, `GH_TOKEN` de la App, comprobación al arrancar |
| `.devcontainer/Dockerfile` | Debian (glibc) con Node 26, `git`, `make`, `gh` y Claude Code 2.1.322 |
| `.devcontainer/compose.yaml` | `workspace` en la red interna `agent`; proxy `egress` como única salida |
| `.devcontainer/egress/` | Imagen de Squid, su configuración y la lista de salida (S-25) |
| `.devcontainer/verify-isolation.sh` | Comprobaciones de los criterios de aceptación (`taskmk-verify-isolation`) |
| `.claude/settings.json` | Reglas `deny` de Claude Code (C-06, C-07) |

## Red de salida

Mecanismo aprobado el 2026-11-11. La lista es la de S-25 (2026-11-09), ampliada el 2026-11-11 con `api.anthropic.com`.

```
workspace (red agent, internal) ──CONNECT :443──► egress (Squid) ──► Internet, solo dominios de allowlist.txt
Docker interno ──NAT de workspace──┘
```

- `workspace` no tiene ruta a Internet: la red `agent` es `internal: true`. Lo que no pase por el proxy no sale.
- `egress` solo acepta `CONNECT` al puerto 443 de los dominios de `.devcontainer/egress/allowlist.txt` y rechaza destinos privados (red local, host, metadatos). Registra cada intento en sus logs (`docker logs taskmk-devcontainer-egress-1` en el host).
- `HTTP(S)_PROXY` y `~/.docker/config.json` solo indican a las herramientas por dónde salir; la restricción la impone la red.
- Cambiar la lista exige aprobación humana (S-25), revisar el PR (`CODEOWNERS` cubre `.devcontainer/`) y reconstruir el devcontainer desde el host.

## Arranque

1. En el host, emitir un token de instalación de la GitHub App (S-24) y exportarlo como `TASKMK_AGENT_GH_TOKEN`. La clave privada de la App no entra en el devcontainer.
2. Claude Code se instala en la imagen con la versión fijada en `compose.yaml` y en el `Dockerfile` (2.1.322, aprobada el 2026-11-11). Cambiarla exige aprobación humana y reconstruir.
3. Abrir el devcontainer (`devcontainer up --workspace-folder .` o VS Code). El token caduca en una hora: para renovarlo hay que reabrir el devcontainer con el nuevo valor.
4. Revisar la salida de `taskmk-verify-isolation`, que se ejecuta en cada arranque. `taskmk-verify-isolation --full` comprueba además `docker pull` y la salida de un contenedor anidado.

## Ajustes del host

VS Code reenvía por defecto el agente SSH y las credenciales de git del host. `devcontainer.json` lo desactiva en lo que puede, pero estos ajustes son de usuario y deben fijarse también en la configuración de VS Code del host:

- `"dev.containers.copyGitConfig": false`
- `"dev.containers.gitCredentialHelperConfigLocation": "none"`
- `"dev.containers.dockerCredentialHelper": false`: sin él, VS Code añade a `~/.docker/config.json` un ayudante que entrega al contenedor las credenciales de Docker del host (Docker Hub, GHCR). Cuando VS Code se cierra, ese ayudante deja de existir y `docker pull` falla con `error getting credentials`.

Con la CLI `devcontainer` no se reenvía nada. `taskmk-verify-isolation` falla si detecta un agente SSH, un ayudante de credenciales de git distinto de `gh` o un ayudante de credenciales de Docker.

## Reglas `deny`

Unión de `raw-infrastructure.md` §12 y SEC-008: lectura y edición de `.env*`, `**/*.env` (los `*.env.example` no coinciden), `infrastructure/.env`, `~/.ssh` y `~/.aws`; comandos `gh secret`, `ssh`, `make prod-deploy`, `make restore`, `make reset-db` y `make admin-*`. Además, por decisión del 2026-11-11 (SEC-008), el agente no puede editar `.claude/settings*.json` ni `.mcp.json`: solo una persona cambia sus reglas.

## Límites conocidos

- **R-02.** Docker-in-docker exige `privileged`. Un escape llega al entorno que aloja el devcontainer: usar una VM o Docker Desktop sin nada sensible.
- **Docker interno = root en el devcontainer.** Quien está en el grupo `docker` es root dentro de `workspace`. No rompe la red de salida, que se impone fuera, en la red `agent` y en `egress`.
- **Reglas `deny`.** Las de `Read` y `Edit` cubren las herramientas de ficheros de Claude Code, no los comandos de shell: `cat infrastructure/env/backend.env` no lo bloquean. Las de `Bash` comparan texto y no cubren `bash -c "…"`. Los ficheros de `infrastructure/env/` son solo de desarrollo; los de producción no existen en el devcontainer.
- **Exfiltración a dominios permitidos.** El proxy no inspecciona TLS: un agente podría enviar datos a un dominio de la lista (por ejemplo, a un PR público). Solo hay secretos de desarrollo al alcance.
- **DNS.** La red interna no resuelve nombres externos; las herramientas los resuelven a través del proxy.


# Comandos

# Comandos para arrancar:
- docker compose -f .devcontainer/compose.yaml down
- docker compose -f .devcontainer/compose.yaml build
- devcontainer up --workspace-folder .

## Recostruir el proxy:
- docker compose -f .devcontainer/compose.yaml up -d --build egress

- devcontainer exec --workspace-folder . taskmk-verify-isolation --full

## Comprobar que el token de la app solo ve Task-MK:
- devcontainer exec --workspace-folder . gh api /installation/repositories --jq '.repositories[].full_name'

## Entrar en la terminal:
- devcontainer exec --workspace-folder . bash

## Recostrucción:
- docker compose -f .devcontainer/compose.yaml down
- docker compose -f .devcontainer/compose.yaml build
- devcontainer up --workspace-folder .
- devcontainer exec --workspace-folder . taskmk-verify-isolation --full
- devcontainer exec --workspace-folder . claude --version