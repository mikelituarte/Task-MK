#!/usr/bin/env bash
# Comprueba los criterios de aceptación de la fase 2 que se pueden verificar desde dentro.
#   taskmk-verify-isolation          comprobaciones rápidas (sin descargas)
#   taskmk-verify-isolation --full   además `docker pull` y salida de un contenedor anidado
# Sale con 1 si alguna comprobación falla.
set -uo pipefail

PROXY_URL="http://10.250.250.10:3128"
FAILED=0
ok()   { printf '  OK    %s\n' "$1"; }
fail() { printf '  FALLO %s\n' "$1"; FAILED=1; }

check() { # check "<descripción>" <comando…>   (debe tener éxito)
  local desc=$1; shift
  if "$@" >/dev/null 2>&1; then ok "$desc"; else fail "$desc"; fi
}
check_not() { # check_not "<descripción>" <comando…>   (debe fallar)
  local desc=$1; shift
  if "$@" >/dev/null 2>&1; then fail "$desc"; else ok "$desc"; fi
}

echo "Credenciales"
check_not "no existe ~/.ssh"                       test -e "$HOME/.ssh"
check_not "no existe ~/.aws"                       test -e "$HOME/.aws"
check_not "no existe /etc/taskmk"                  test -e /etc/taskmk
check_not "no hay agente SSH reenviado"            test -S "${SSH_AUTH_SOCK:-/nonexistent}"
check_not "git no usa ayudantes de credenciales del host" \
  bash -c "git config --get-all credential.helper | grep -Ev '^$|gh auth git-credential'"
check_not "Docker no usa ayudantes de credenciales del host" \
  grep -Eq '"(credsStore|credHelpers)"' "$HOME/.docker/config.json"

echo "Docker"
# El daemon interno arranca en segundo plano: se espera hasta 30 s.
for _ in $(seq 1 30); do docker info >/dev/null 2>&1 && break; sleep 1; done
check_not "el socket de Docker no está montado desde el host" \
  grep -q 'docker.sock' /proc/self/mountinfo
check "el daemon de Docker es el interno" \
  bash -c '[ "$(docker info --format "{{.Name}}")" = "$(hostname)" ]'

echo "Red de salida"
check "dominio de la lista por el proxy (registry.npmjs.org)" \
  curl -fsS --max-time 15 --proxy "$PROXY_URL" -o /dev/null https://registry.npmjs.org/
check_not "dominio fuera de la lista por el proxy (example.com)" \
  curl -fsS --max-time 15 --proxy "$PROXY_URL" -o /dev/null https://example.com/
check_not "HTTP sin TLS por el proxy" \
  curl -fsS --max-time 15 --proxy "$PROXY_URL" -o /dev/null http://registry.npmjs.org/
check_not "conexión directa sin proxy a un dominio de la lista" \
  curl -fsS --max-time 10 --noproxy '*' -o /dev/null https://registry.npmjs.org/
check_not "conexión directa a una IP pública (1.1.1.1:443)" \
  nc -z -w 5 1.1.1.1 443

if [ "${1:-}" = "--full" ]; then
  echo "Docker interno (--full)"
  if docker pull -q busybox:1.37 >/dev/null 2>&1; then
    ok "docker pull por el proxy (busybox:1.37)"
    check_not "un contenedor anidado no sale directamente a Internet" \
      docker run --rm busybox:1.37 nc -z -w 5 1.1.1.1 443
  else
    fail "docker pull por el proxy (busybox:1.37)"
    fail "un contenedor anidado no sale directamente a Internet (sin imagen, no se puede comprobar)"
  fi
fi

if [ "$FAILED" -ne 0 ]; then
  echo "Resultado: FALLO" >&2
  exit 1
fi
echo "Resultado: OK"
