#!/usr/bin/env python3
"""Lembrete: renovar o token da Meta a cada 50 dias (ele vale ~60).

Lê a data gravada pelo setup (~/.config/lucas-hq/meta_token_data). Do 50º dia em diante cria no escritório
a tarefa "Renovar token da Meta" como `waiting` (aparece em "esperando você") e um aviso.
Para renovar: bash tools/social/setup.sh --novo-token  (a data volta a contar).
"""
import datetime as dt
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
F = Path.home() / ".config/lucas-hq/meta_token_data"
DIAS = 50
if not F.exists():
    print(json.dumps({"tool": "lembrete_token", "ok": True, "aviso": "token ainda não configurado"}))
    sys.exit(0)
desde = dt.date.fromisoformat(F.read_text().strip())
idade = (dt.date.today() - desde).days
vence = desde + dt.timedelta(days=60)
if idade >= DIAS:
    hq = [sys.executable, str(ROOT / "tools/hq.py")]
    tid = f"renovar-token-meta-{desde.isoformat()}"
    subprocess.run(hq + ["task", "--id", tid, "--team", "social", "--title", f"Renovar token da Meta (vence {vence:%d/%m})",
                         "--status", "waiting", "--etapa", "TOKEN", "--log", "rode: bash tools/social/setup.sh --novo-token"], check=False)
    subprocess.run(hq + ["event", "--type", "toast", "--team", "social", "--note", f"Token da Meta com {idade} dias: renove até {vence:%d/%m}"], check=False)
print(json.dumps({"tool": "lembrete_token", "ok": True, "dias": idade, "vence": vence.isoformat(), "avisou": idade >= DIAS}))
