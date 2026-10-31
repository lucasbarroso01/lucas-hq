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
  LINES=$(python3 tools/expediente.py crontab)
  N=$(printf '%s\n' "$LINES" | grep -c 'iniciar.sh --turno' || true)
  [ "$N" -gt 0 ] || { echo "Não consegui gerar os horários (python3 tools/expediente.py crontab)"; exit 1; }
  { crontab -l 2>/dev/null | grep -vE 'lucas-hq/iniciar.sh --(turno|recuperar)' || true; printf '%s\n' "$LINES"; } | crontab -
  sudo service cron start >/dev/null 2>&1 || true
  # conta o que ficou gravado de fato no cron
  N=$(crontab -l 2>/dev/null | grep -c -- 'iniciar.sh --turno' || true)
  R=$(crontab -l 2>/dev/null | grep -c -- 'iniciar.sh --recuperar' || true)
  echo "Agendado: $N turnos + $R verificações de recuperação (a cada 5 min e ao ligar). Confira com: crontab -l"
  exit 0
fi

cd "$DIR"
LOCK="$HOME/.config/lucas-hq/turno.lock"   # um turno por vez no notebook (agendado ou recuperado)
FOLGA="$HOME/.config/lucas-hq/folga_ate"    # dia encerrado pela Publicação: nenhum turno até este horário (economiza a cota)
if { [ "$1" = "--turno" ] || [ "$1" = "--recuperar" ]; } && [ -f "$FOLGA" ] && [ "$(date +%s)" -lt "$(cut -d. -f1 "$FOLGA")" ]; then
  exit 0
fi
if [ "$1" = "--turno" ]; then
  # disparo agendado: sem perguntas; espera um turno em andamento terminar
  source .venv/bin/activate
  source "$ENV_FILE"
  exec flock -w 7200 "$LOCK" claude -p --model "${LUCAS_HQ_MODELO:-sonnet}" "/turno $2"
fi
if [ "$1" = "--recuperar" ]; then
  # notebook estava fechado no horário: roda os turnos perdidos, do post mais urgente ao menos urgente
  source .venv/bin/activate
  source "$ENV_FILE"
  exec 9>"$LOCK"
  flock -n 9 || exit 0                      # já tem turno rodando: tenta de novo no próximo ciclo
  TRIES="$HOME/.config/lucas-hq/tentativas"; mkdir -p "$TRIES"
  MAX=$(python3 -c 'import yaml; print(yaml.safe_load(open("config/expediente.yaml"))["limites"]["tentativas_por_item"])')
  LAST=""
  for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do
    [ -f "$FOLGA" ] && [ "$(date +%s)" -lt "$(cut -d. -f1 "$FOLGA")" ] && exit 0   # a Publicação encerrou o dia
    NEXT=$(python3 tools/expediente.py proximo-pendente)
    echo "$NEXT" | grep -q '"ok": true' || exit 0
    read -r T O ID < <(echo "$NEXT" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["turno"], d["ocorrencia"].replace(" ", "T"), d["task_id"])')
    O="${O/T/ }"
    [ "$ID" = "$LAST" ] && exit 0            # o mesmo turno não andou: tenta no próximo ciclo
    N=$(( $(cat "$TRIES/$ID" 2>/dev/null || echo 0) + 1 ))
    if [ "$N" -gt "$MAX" ]; then
      python3 tools/hq.py task --id "$ID" --status error --log "recuperação falhou $MAX vezes: veja out/_turnos.log" >/dev/null || true
      echo "$(date '+%F %T') $T: $MAX tentativas sem sucesso, marcado como error"
      LAST="$ID"; continue
    fi
    echo "$N" > "$TRIES/$ID"
    echo "$(date '+%F %T') recuperando $T (perdido em $O, tentativa $N/$MAX)"
    SAIDA=$(claude -p --model "${LUCAS_HQ_MODELO:-sonnet}" "/turno $T recuperar $O" 2>&1); echo "$SAIDA"
    if echo "$SAIDA" | grep -qiE "hit your .*limit|usage limit|limite de uso"; then
      # cota do plano esgotada: não conta como tentativa; volta quando o limite zerar
      echo "$((N - 1))" > "$TRIES/$ID"
      echo "$(date '+%F %T') $T: limite de uso do Claude atingido; tenta de novo quando a cota voltar (não contou tentativa)"
      exit 0
    fi
    LAST="$ID"
  done
  exit 0
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
