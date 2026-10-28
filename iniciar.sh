#!/usr/bin/env bash
# Abre o escritório do jeito certo: pasta do projeto, código atualizado, Python, chaves e Claude Code.
# Uso: ./iniciar.sh   (ou só "hq", depois de rodar ./iniciar.sh --instalar uma vez)
set -e
export PATH="$HOME/.local/bin:$PATH"   # o cron não carrega o PATH do terminal
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$HOME/.config/lucas-hq/env"

if [ "$1" = "--instalar" ]; then
  mkdir -p "$HOME/.config/lucas-hq"
  if [ ! -f "$ENV_FILE" ]; then
    read -rp "SUPABASE_SERVICE_KEY (sb_secret_...): " KEY
    printf 'export SUPABASE_URL=https://srwmjrnyatavuuatmwvr.supabase.co\nexport SUPABASE_SERVICE_KEY=%s\n' "$KEY" > "$ENV_FILE"
    chmod 600 "$ENV_FILE"
  fi
  grep -q "alias hq=" "$HOME/.bashrc" 2>/dev/null || echo "alias hq='$DIR/iniciar.sh'" >> "$HOME/.bashrc"
  echo "Pronto. Abra um terminal novo e digite: hq"
  exit 0
fi

if [ "$1" = "--agendar" ]; then
  cd "$DIR"
  case "$(readlink -f /etc/localtime)" in *America/Sao_Paulo) ;; *)
    echo "O relógio do Linux não está em America/Sao_Paulo. Rode:"
    echo "  sudo ln -sf /usr/share/zoneinfo/America/Sao_Paulo /etc/localtime"
    exit 1;; esac
  command -v crontab >/dev/null || { echo "Instale o cron: sudo apt install -y cron"; exit 1; }
  source .venv/bin/activate
  python3 tools/expediente.py agendamentos >/dev/null
  LINES=$(sed -n '/^```cron$/,/^```$/p' config/agendamentos.md | grep -v '^```')
  { crontab -l 2>/dev/null | grep -v 'lucas-hq/iniciar.sh --turno'; echo "$LINES"; } | crontab -
  sudo service cron start >/dev/null 2>&1 || true
  echo "Agendado ($(echo "$LINES" | wc -l) turnos). Confira com: crontab -l"
  exit 0
fi

cd "$DIR"
if [ "$1" = "--turno" ]; then
  # disparo agendado: sem perguntas, sem git pull interativo
  source .venv/bin/activate
  source "$ENV_FILE"
  exec claude -p "/turno $2"
fi
echo "→ atualizando o código"
git pull --ff-only || echo "  (não deu para atualizar; seguindo com a versão atual)"
[ -d .venv ] || { echo "Falta o .venv: rode python3 -m venv .venv e pip install -r tools/requirements.txt"; exit 1; }
# shellcheck disable=SC1091
source .venv/bin/activate
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
else
  echo "Faltam as chaves do Supabase: rode ./iniciar.sh --instalar"; exit 1
fi
python3 tools/hq.py approval --task ping >/dev/null && echo "→ Supabase conectado" || { echo "Supabase não respondeu: confira $ENV_FILE"; exit 1; }
echo "→ abrindo o Claude Code em $DIR"
exec claude "$@"
