#!/usr/bin/env bash
# social-mcp em segundo plano, só em 127.0.0.1:3224 (nada exposto na rede).
# Uso: bash tools/social/servico.sh start | stop | status | garantir
# `garantir` (cron a cada 5 min e no boot) sobe o servidor se ele caiu: os agendamentos do Instagram
# ficam no SQLite da social-mcp e voltam sozinhos quando o processo volta.
set -uo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP="$DIR/tools/social-mcp"
PID="$APP/data/server.pid"
LOG="$DIR/out/_social.log"
vivo() { [ -f "$PID" ] && kill -0 "$(cat "$PID")" 2>/dev/null; }
case "${1:-status}" in
  start|garantir)
    if vivo; then [ "$1" = start ] && echo "social-mcp já está rodando (pid $(cat "$PID"))"; exit 0; fi
    [ -f "$APP/.env" ] || { echo "falta $APP/.env: rode bash tools/social/setup.sh"; exit 1; }
    mkdir -p "$APP/data" "$DIR/out"
    cd "$APP" && nohup "$APP/.venv/bin/python" server.py >>"$LOG" 2>&1 &
    echo $! > "$PID"
    echo "$(date '+%F %T') [social] servidor iniciado (pid $!) em 127.0.0.1:3224" >> "$DIR/out/_turnos.log"
    ;;
  stop) vivo && kill "$(cat "$PID")" && echo "parado" ;;
  status) vivo && echo "rodando (pid $(cat "$PID"))" || { echo "parado"; exit 1; } ;;
esac
