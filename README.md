# Task-MK

Aplicación para la gestión y el seguimiento de tareas en el desarrollo de aplicaciones.

Monorepo con `frontend/`, `backend/` e `infrastructure/` (Docker Compose, Caddy y MongoDB).

## Documentación

Toda la documentación está en [`docs/`](docs/):

- [`docs/frontend/`](docs/frontend/)
- [`docs/backend/`](docs/backend/)
- [`docs/infrastructure/`](docs/infrastructure/)
- [`docs/security/`](docs/security/)
- [`docs/deployment/`](docs/deployment/)

## Seguridad

Los avisos de vulnerabilidades van por el canal privado descrito en [`SECURITY.md`](SECURITY.md), nunca por *issues* públicos.

## Regla del repositorio público: sin datos operativos

Este repositorio es público. No se versiona nada que solo deba conocer quien opera el servicio:

- la IP o el nombre del VPS;
- los usuarios reales del servidor;
- el bucket de backups y sus rutas reales;
- las cuentas de proveedores (VPS, almacenamiento, logs, alertas);
- el dominio real.

La documentación de [`docs/deployment/`](docs/deployment/) usa marcadores como `<DOMAIN>` y `<VPS_HOST>`.
El dominio real solo existe en la variable `DOMAIN` del *environment* `production` de GitHub.
