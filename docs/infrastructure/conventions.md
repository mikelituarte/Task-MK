# Convenciones de infraestructura

## Migraciones de MongoDB

Las migraciones usan `migrate-mongo` y están en `infrastructure/mongodb/migrations/`. Configuración e imagen: [`mongodb.md`](mongodb.md).

### Reparto

- **Infraestructura** es dueña de la imagen `migrate`, de `migrate-mongo-config.js`, de la carpeta `migrations/` y de su ejecución en cada entorno. Valida `up`, `down` y `status` contra el stack.
- **El backend** decide qué esquema e índices hacen falta y escribe **todas** las migraciones, incluidas las primeras. Su código tolera el esquema de la versión siguiente.
- **El backend nunca crea índices al arrancar**: el usuario `app` no puede hacerlo (REQ-I04).
- `CODEOWNERS` exige revisión humana de todo `infrastructure/`, incluidas las migraciones.

### Reglas

1. **Nombre** `YYYYMMDDHHmmss-descripcion.js`, generado siempre con `migrate-mongo create <descripcion>` (con el `Makefile`: `make migrate-create n=<descripcion>`). La descripción va en minúsculas y con guiones.
2. **Forma**: CommonJS y exporta `up(db, client)` y `down(db, client)`. `down` deshace exactamente lo que hace su `up`.
3. **Inmutables** una vez fusionadas en `main`. Para corregir una migración, se escribe otra nueva.
4. ***Expand/contract***: primero se añade lo nuevo sin romper la versión actual (*expand*). Solo cuando ninguna versión desplegada usa lo antiguo, otra migración lo retira (*contract*). Hacer rollback de la aplicación no revierte migraciones, así que la versión anterior debe funcionar con el esquema nuevo.
5. **Probar en local `up` → `down` → `up`** antes de abrir el PR. Al final, `status` no debe mostrar pendientes.
6. **`down` nunca se ejecuta en producción sin confirmación humana.**
7. Las colecciones se crean de forma explícita en una migración: `app` no debe crearlas.
8. Los índices llevan nombre explícito.

### Dónde y cuándo se ejecutan

| Entorno | Cuándo | Cómo |
|---|---|---|
| Desarrollo | En cada `make up`, antes de `backend` | Servicio `migrate` de `docker-compose.dev.yml` (ver [`stack.md`](stack.md)) |
| Desarrollo, a mano | A petición | `make migrate`, `make migrate-status`, `make migrate-create n=<nombre>` (fase 6) |
| E2E y CI | Antes de `backend` | Servicio `migrate` (fases 7 y 8) |
| Producción | En `make prod-deploy`, después del backup `predeploy/` y antes de `up -d` | `docker compose --profile tools run --rm migrate` (fase 10) |
| Tests del backend | En sus tests de integración | Invocan `up(db, client)` directamente sobre `mongodb-memory-server` |

Todos los entornos usan el usuario `migrate`.
