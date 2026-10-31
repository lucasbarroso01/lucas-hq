#!/usr/bin/env bash
# Liga a etapa "Publicação": só vídeos criados DEPOIS deste momento são agendados (os antigos de out/ ficam de fora).
# Uso, da raiz do repo: bash tools/social/ativar_publicacao.sh      (desligar: bash tools/social/ativar_publicacao.sh --desligar)
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$DIR"
F="$HOME/.config/lucas-hq/publicacao_ativada_em"
CR="$(crontab -l 2>/dev/null | grep -v 'tools/social/publicar.py' || true)"
if [ "${1:-}" = "--desligar" ]; then
  printf '%s\n' "$CR" | crontab -
  echo "$(date '+%F %T') [publicacao] desligada pelo Lucas" >> out/_turnos.log
  echo "Publicação desligada."; exit 0
fi
[ -x tools/social-mcp/.venv/bin/python ] || { echo "rode antes: bash tools/social/setup.sh"; exit 1; }
[ -f "$F" ] || date +%s > "$F"
printf '%s\n*/15 * * * * cd %s && tools/social-mcp/.venv/bin/python tools/social/publicar.py >/dev/null 2>&1\n' "$CR" "$DIR" | crontab -
echo "$(date '+%F %T') [publicacao] ligada: vídeos novos em out/ entram na grade a cada 15 min" >> out/_turnos.log
echo "Publicação ligada. Teste sem chamar a Meta: tools/social-mcp/.venv/bin/python tools/social/publicar.py --simular"
