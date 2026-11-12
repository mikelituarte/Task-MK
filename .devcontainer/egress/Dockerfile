# syntax=docker/dockerfile:1
#
# Proxy de salida de los agentes (plan-infrastructure, fase 2, tarea 2; propuesta aprobada el 2026-11-11).
#
# Base fijada por digest el 2026-11-12.
FROM debian:trixie-slim@sha256:a72b4433de1cf7d6bae0c4cee74d0547f58601a643b3375f070c51600d63b6b2

RUN apt-get update \
 && apt-get install -y --no-install-recommends squid \
 && rm -rf /var/lib/apt/lists/*

COPY squid.conf /etc/squid/squid.conf
COPY allowlist.txt /etc/squid/allowlist.txt

# Puerto no privilegiado: no necesita ninguna capability.
USER proxy
EXPOSE 3128
CMD ["squid", "-N", "-f", "/etc/squid/squid.conf"]
