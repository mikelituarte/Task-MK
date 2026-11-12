# syntax=docker/dockerfile:1
#
# Imagen del devcontainer de los agentes (plan-infrastructure, fase 2, tarea 1).
#
# - Debian (glibc), no Alpine: `make check` y `mongodb-memory-server` corren aquí (C-01, V-10).
# - Node 26 (C-02, decidido 2026-11-09).
# - Docker propio (docker-in-docker) y Compose v2 los instala la feature declarada en
#   devcontainer.json. Nunca se monta el socket de Docker del host.
# - La salida a Internet no se controla aquí, sino en la red de compose.yaml (tarea 2):
#   este contenedor solo está en una red `internal` y sale por el proxy `egress`.
#
# Base fijada por digest el 2026-11-12 (`docker buildx imagetools inspect node:26-trixie`).
ARG NODE_IMAGE=node:26-trixie@sha256:e18c3ccdf7d71619990b0e85639f506e2028a95410999cab24cc373cbd10e0ac
FROM ${NODE_IMAGE}

# Versión exacta de Claude Code, aprobada el 2026-11-11. Cambiarla exige aprobación humana.
# Vacía, no se instala. Se instala como root, fuera del alcance de escritura del agente.
ARG CLAUDE_CODE_VERSION=2.1.322

# Herramientas base. `gh` sale del repositorio de Debian (firmado por Debian), sin
# añadir orígenes de paquetes de terceros ni `curl | sh`.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      git \
      make \
      gh \
      jq \
      less \
      procps \
      iproute2 \
      netcat-openbsd \
 && rm -rf /var/lib/apt/lists/*

# `--ignore-scripts` (SEC-009) y después solo el postinstall de Claude Code, que enlaza el
# binario nativo del paquete opcional de la plataforma: lista explícita, como pide C-03.
RUN if [ -n "${CLAUDE_CODE_VERSION}" ]; then \
      npm install -g --ignore-scripts "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
      && cd "$(npm root -g)/@anthropic-ai/claude-code" \
      && node install.cjs \
      && claude --version \
      && npm cache clean --force; \
    else \
      echo "AVISO: CLAUDE_CODE_VERSION vacío; Claude Code no se instala en la imagen." >&2; \
    fi

# Git usa siempre el token de la GitHub App (GH_TOKEN, S-24) a través de `gh`, a nivel de
# sistema. Ninguna credencial personal del host debe sustituirlo (ver
# docs/infrastructure/devcontainer.md, «Ajustes del host»).
RUN git config --system credential.https://github.com.helper '' \
 && git config --system --add credential.https://github.com.helper '!gh auth git-credential' \
 && git config --system safe.directory /workspaces/Task-MK

# Directorios del usuario `node` que se montan como volúmenes nombrados: se crean aquí
# para que el volumen herede el propietario.
RUN mkdir -p /home/node/.claude /home/node/.docker \
 && chown -R node:node /home/node/.claude /home/node/.docker

# Proxy para los contenedores y builds del Docker interno: el cliente de Docker inyecta
# estas variables. Usa la IP fija del proxy porque el DNS interno de Docker no resuelve
# `egress` desde los contenedores anidados. Es solo comodidad: sin el proxy no hay ruta.
COPY --chown=node:node docker-client-config.json /home/node/.docker/config.json

COPY --chmod=0755 verify-isolation.sh /usr/local/bin/taskmk-verify-isolation
