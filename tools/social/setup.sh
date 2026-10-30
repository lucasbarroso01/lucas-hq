#!/usr/bin/env bash
# Instala a social-mcp (github.com/bmachek/social-mcp) com as adaptações do Lucas HQ (tools/social/social-mcp.patch):
#   - Instagram: vídeo sobe no bucket PRIVADO social-staging do Supabase NA HORA da publicação, link assinado de 1 h,
#     apagado assim que a Meta responde; recomprime para caber em 50 MB (limite do plano gratuito)
#   - Facebook: schedule_facebook_reel_native (agendamento nativo da Meta, não depende do computador)
#   - agendador tolera o Chromebook ligar até 2 h atrasado; nenhum token ou link assinado vai para log
# O token da Meta é digitado aqui (sem eco, fora do histórico) e fica só em tools/social-mcp/.env (chmod 600).
# Uso, da raiz do repo: bash tools/social/setup.sh
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$DIR"
APP=tools/social-mcp
REV=d2634c3f428d7895d29cd72245f3d92a677e7d02
log() { echo "$(date '+%F %T') [social-setup] $*" | tee -a out/_turnos.log; }
mkdir -p out

# 1. código (versão fixa + patch)
if [ ! -d "$APP/.git" ]; then
  git clone -q https://github.com/bmachek/social-mcp "$APP"
  git -C "$APP" checkout -q "$REV"
  git -C "$APP" apply "$DIR/tools/social/social-mcp.patch"
  log "clonado em $APP (rev ${REV:0:7}) com o patch do Lucas HQ"
else
  log "ok: $APP já existe"
fi

# 2. dependências (venv próprio; mcp<2 porque o código usa FastMCP)
[ -d "$APP/.venv" ] || python3 -m venv "$APP/.venv"
"$APP/.venv/bin/pip" install -q -r "$APP/requirements.txt" "mcp>=1.2,<2"
command -v ffmpeg >/dev/null || { log "FALTA ffmpeg (sudo apt-get install -y ffmpeg)"; exit 1; }
log "ok: dependências"

# 3. .env (token pedido sem eco; nada disso vai para log nem para o histórico do shell)
if [ ! -f "$APP/.env" ] || [ "${1:-}" = "--novo-token" ]; then
  [ -f "$HOME/.config/lucas-hq/env" ] || { echo "falta ~/.config/lucas-hq/env (rode ./iniciar.sh --instalar)"; exit 1; }
  # shellcheck disable=SC1091
  source "$HOME/.config/lucas-hq/env"
  printf 'Cole o token de longa duração da Meta e aperte Enter (não aparece na tela): '
  IFS= read -rs META_TOKEN; echo
  [ -n "$META_TOKEN" ] || { echo "token vazio"; exit 1; }
  umask 077
  cat > "$APP/.env" <<ENV
META_ACCESS_TOKEN=$META_TOKEN
FB_PAGE_ID=1339139755956700
IG_USER_ID=17841469949549809
GRAPH_API_VERSION=v25.0
DATA_DIR=$DIR/$APP/data
SCHEDULER_DB=$DIR/$APP/data/scheduler/scheduled.db
MCP_TRANSPORT=streamable-http
MCP_HOST=127.0.0.1
MCP_PORT=3224
PUBLIC_BASE_URL=supabase
SUPABASE_URL=$SUPABASE_URL
SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY
SUPABASE_STAGING_BUCKET=social-staging
SUPABASE_SIGNED_URL_SECONDS=3600
IG_REEL_CONTAINER_TIMEOUT_SECONDS=600
LOG_LEVEL=INFO
ENV
  chmod 600 "$APP/.env"
  unset META_TOKEN
  date +%F > "$HOME/.config/lucas-hq/meta_token_data"
  log "ok: .env criado (chmod 600); data do token registrada para o lembrete de 50 dias"
fi
mkdir -p "$APP/data/images" "$APP/data/scheduler"

# 4. servidor em segundo plano (127.0.0.1) + volta sozinho no boot e se cair
bash tools/social/servico.sh stop >/dev/null 2>&1 || true
bash tools/social/servico.sh start
CR="$(crontab -l 2>/dev/null | grep -v 'tools/social/' || true)"
printf '%s\n@reboot cd %s && bash tools/social/servico.sh garantir\n*/5 * * * * cd %s && bash tools/social/servico.sh garantir\n7 9 * * * cd %s && .venv/bin/python tools/social/lembrete_token.py >> out/_turnos.log 2>&1\n' \
  "$CR" "$DIR" "$DIR" "$DIR" | crontab -
log "ok: servidor no ar em 127.0.0.1:3224; cron @reboot, a cada 5 min e lembrete do token às 09:07"

# 5. registra no Claude Code (só local, transporte HTTP em 127.0.0.1)
claude mcp remove social -s user >/dev/null 2>&1 || true
claude mcp add --transport http -s user social http://127.0.0.1:3224/mcp
log "ok: MCP 'social' registrado no Claude Code (http://127.0.0.1:3224/mcp)"
echo "Pronto. Teste: bash tools/social/servico.sh status"
