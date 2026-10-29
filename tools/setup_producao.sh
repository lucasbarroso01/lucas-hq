#!/usr/bin/env bash
# PASSO 0 da Produção Worldframe: confere e instala tudo que a geração de vídeo precisa.
# Idempotente: o que já está instalado só é conferido. Tudo vai para out/_turnos.log.
# Uso (da raiz do repo): bash tools/setup_producao.sh
set -uo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"
mkdir -p out models assets/fonts assets/lib video "$HOME/.config/lucas-hq"
LOG="$DIR/out/_turnos.log"
FAIL=0
log() { echo "$(date '+%F %T') [setup] $*" | tee -a "$LOG"; }
bad() { log "FALHOU: $*"; FAIL=1; }

# 1. Node.js 22+
NODE_MAJOR=$(node -v 2>/dev/null | sed 's/v\([0-9]*\).*/\1/')
if [ -z "$NODE_MAJOR" ] || [ "$NODE_MAJOR" -lt 22 ]; then
  log "Node $(node -v 2>/dev/null || echo ausente): instalando LTS 22 via nvm (sem sudo)"
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] || curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash >>"$LOG" 2>&1
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh" && nvm install 22 >>"$LOG" 2>&1 && nvm alias default 22 >>"$LOG" 2>&1 \
    && log "instalado: Node $(node -v)" || bad "não consegui instalar o Node 22"
else
  log "ok: Node $(node -v)"
fi

# 2. ffmpeg / ffprobe
if command -v ffmpeg >/dev/null && command -v ffprobe >/dev/null; then
  log "ok: $(ffmpeg -version | head -1 | cut -d' ' -f1-3)"
elif [ "$(uname)" = "Darwin" ]; then
  brew install ffmpeg >>"$LOG" 2>&1 && log "instalado: ffmpeg (brew)" || bad "brew install ffmpeg"
else
  sudo apt-get install -y ffmpeg >>"$LOG" 2>&1 && log "instalado: ffmpeg (apt)" || bad "apt install ffmpeg"
fi

# 3. Python 3.11+ no venv do projeto + pacotes
[ -d .venv ] || python3 -m venv .venv >>"$LOG" 2>&1 || bad "python3 -m venv .venv (instale python3-venv)"
# shellcheck disable=SC1091
source .venv/bin/activate
if python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)'; then
  log "ok: $(python3 --version) em .venv"
else
  bad "Python 3.11+ necessário (tem $(python3 --version))"
fi
if python3 -c 'import kokoro_onnx, soundfile, numpy, scipy, PIL, yaml' 2>/dev/null; then
  log "ok: kokoro-onnx soundfile numpy scipy pillow pyyaml"
else
  pip install -q kokoro-onnx soundfile numpy scipy pillow pyyaml >>"$LOG" 2>&1 \
    && log "instalado: kokoro-onnx soundfile numpy scipy pillow pyyaml" || bad "pip install dos pacotes de áudio"
fi

# 4. Modelo de voz Kokoro v1.0 + teste com am_michael
REL=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0
for f in kokoro-v1.0.onnx voices-v1.0.bin; do
  if [ -s "models/$f" ]; then log "ok: models/$f"
  else curl -fsSL -o "models/$f.part" "$REL/$f" && mv "models/$f.part" "models/$f" && log "baixado: models/$f" || bad "download de $f"; fi
done
if python3 tools/worldframe/tts.py --teste out/_voz_teste.wav >>"$LOG" 2>&1; then
  log "ok: voz am_michael (out/_voz_teste.wav)"
else
  bad "teste de voz Kokoro (veja as linhas acima no log)"
fi

# 5. HyperFrames + navegador
HF_VER=$(npx -y hyperframes --version 2>>"$LOG" | tail -1)
[ -n "$HF_VER" ] && log "ok: hyperframes $HF_VER" || bad "npx hyperframes --version"
# shellcheck disable=SC1091
[ -f "$HOME/.config/lucas-hq/browser" ] && source "$HOME/.config/lucas-hq/browser"
chrome_ok() { npx -y hyperframes doctor --json 2>/dev/null | python3 -c 'import json,sys
d=json.load(sys.stdin); sys.exit(0 if any(c["name"]=="Chrome" and c["ok"] for c in d.get("checks",[])) else 1)'; }
if [ -n "${HYPERFRAMES_BROWSER_PATH:-}" ] && [ -x "$HYPERFRAMES_BROWSER_PATH" ]; then
  log "ok: navegador $HYPERFRAMES_BROWSER_PATH"
elif chrome_ok; then
  log "ok: Chrome do HyperFrames"
else
  if true; then
    npx -y hyperframes browser ensure >>"$LOG" 2>&1 && log "instalado: Chrome do HyperFrames" || {
      for c in "$(command -v chromium 2>/dev/null)" "$(command -v chromium-browser 2>/dev/null)" "$(command -v google-chrome 2>/dev/null)" /opt/pw-browsers/chromium-*/chrome-linux*/chrome; do
        if [ -x "$c" ]; then echo "export HYPERFRAMES_BROWSER_PATH=$c" > "$HOME/.config/lucas-hq/browser"; export HYPERFRAMES_BROWSER_PATH="$c"; log "usando navegador já instalado: $c"; break; fi
      done
      [ -n "${HYPERFRAMES_BROWSER_PATH:-}" ] || bad "sem Chrome/Chromium para o HyperFrames"
    }
  fi
fi
# itens que esta produção usa (whisper-cpp, MusicGen e Docker são opcionais e não entram aqui)
log "hyperframes doctor: $(npx -y hyperframes doctor --json 2>/dev/null | python3 -c 'import json,sys
need = {"Node.js", "FFmpeg", "FFprobe", "Disk", "Memory"}
try:
    d = json.load(sys.stdin); falta = [c["name"] for c in d.get("checks", []) if c["name"] in need and not c["ok"]]
    print("ok (Node, FFmpeg, disco, memória)" if not falta else "faltando: " + ", ".join(falta))
except Exception: print("sem resposta")')"

# 6. Fontes (google/fonts, OFL)
FB=https://raw.githubusercontent.com/google/fonts/main/ofl
while read -r out path; do
  if [ -s "assets/fonts/$out" ]; then log "ok: fonte $out"
  else curl -fsSL -o "assets/fonts/$out" "$FB/$path" && log "baixada: fonte $out" || bad "fonte $out"; fi
done <<'EOF'
LeagueGothic.ttf leaguegothic/LeagueGothic%5Bwdth%5D.ttf
Oswald.ttf oswald/Oswald%5Bwght%5D.ttf
PlayfairDisplay-Italic.ttf playfairdisplay/PlayfairDisplay-Italic%5Bwght%5D.ttf
EBGaramond.ttf ebgaramond/EBGaramond%5Bwght%5D.ttf
EBGaramond-Italic.ttf ebgaramond/EBGaramond-Italic%5Bwght%5D.ttf
Cinzel.ttf cinzel/Cinzel%5Bwght%5D.ttf
EOF

# 7. Bibliotecas locais (sem CDN) + dados do mapa
if [ ! -s video/node_modules/three/build/three.module.js ]; then
  [ -f video/package.json ] || echo '{"name":"lucas-hq-video","private":true}' > video/package.json
  npm i -s --prefix video gsap@3.12.5 three@0.169.0 world-atlas@2.0.2 >>"$LOG" 2>&1 && log "instalado: gsap three world-atlas (video/)" || bad "npm i gsap three"
fi
cp video/node_modules/gsap/dist/gsap.min.js assets/lib/ 2>/dev/null && cp video/node_modules/three/build/three.module.js assets/lib/ 2>/dev/null \
  && log "ok: assets/lib/gsap.min.js e three.module.js" || bad "copiar gsap/three para assets/lib"
python3 tools/worldframe/terra.py >>"$LOG" 2>&1 && log "ok: assets/lib/terra.js (pontos do globo)" || bad "gerar pontos do globo"

if [ "$FAIL" = 0 ]; then log "PASSO 0 completo: produção pronta"; else log "PASSO 0 incompleto: corrija os itens FALHOU acima"; fi
exit "$FAIL"
