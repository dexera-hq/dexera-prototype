#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
COMPOSE_FILE="$ROOT_DIR/docker-compose.dev.yml"
COMPOSE_STUBS_FILE="$ROOT_DIR/docker-compose.dev.stubs.yml"
DOTENV_FILE="$ROOT_DIR/.env"
DOTENV_EXAMPLE_FILE="$ROOT_DIR/.env.example"
COMPOSE_PROJECT_NAME="dexera-dev"

if docker compose version >/dev/null 2>&1; then
  COMPOSE_VARIANT="plugin"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_VARIANT="standalone"
else
  echo "Docker Compose was not found. Install either 'docker compose' plugin or 'docker-compose'." >&2
  exit 1
fi

run_compose() {
  if [ "$COMPOSE_VARIANT" = "plugin" ]; then
    docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" "$@"
  else
    docker-compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" "$@"
  fi
}

run_compose_profiled() {
  if [ "${STUBS:-0}" = "1" ]; then
    if [ "$COMPOSE_VARIANT" = "plugin" ]; then
      docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" -f "$COMPOSE_STUBS_FILE" "$@"
    else
      docker-compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" -f "$COMPOSE_STUBS_FILE" "$@"
    fi
  else
    run_compose "$@"
  fi
}

down_all() {
  if [ -f "$COMPOSE_STUBS_FILE" ]; then
    if [ "$COMPOSE_VARIANT" = "plugin" ]; then
      docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" -f "$COMPOSE_STUBS_FILE" down -v --remove-orphans >/dev/null 2>&1 || true
    else
      docker-compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" -f "$COMPOSE_STUBS_FILE" down -v --remove-orphans >/dev/null 2>&1 || true
    fi
  fi
  run_compose down -v --remove-orphans >/dev/null 2>&1 || true
}

COMMAND=${CMD:-up}

case "$COMMAND" in
  up)
    if [ ! -f "$DOTENV_FILE" ]; then
      if [ -f "$DOTENV_EXAMPLE_FILE" ]; then
        cp "$DOTENV_EXAMPLE_FILE" "$DOTENV_FILE"
        echo "Created .env from .env.example"
      else
        echo "Missing .env and .env.example. Create .env before starting the Docker dev stack." >&2
        exit 1
      fi
    fi

    echo "Resetting Docker dev stack to deterministic state..."
    down_all
    if [ "${STUBS:-0}" = "1" ]; then
      echo "Starting API with Redis/Postgres stubs..."
    else
      echo "Starting API only..."
    fi
    run_compose_profiled up --build -d
    run_compose_profiled ps
    ;;
  down)
    if [ "$COMPOSE_VARIANT" = "plugin" ]; then
      docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" -f "$COMPOSE_STUBS_FILE" down -v --remove-orphans || true
    else
      docker-compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" -f "$COMPOSE_STUBS_FILE" down -v --remove-orphans || true
    fi
    run_compose down -v --remove-orphans || true
    ;;
  logs)
    run_compose_profiled logs -f
    ;;
  ps)
    run_compose_profiled ps
    ;;
  *)
    echo "Unsupported CMD='$COMMAND'. Expected one of: up, down, logs, ps." >&2
    exit 1
    ;;
esac
