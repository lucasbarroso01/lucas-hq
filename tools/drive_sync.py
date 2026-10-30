#!/usr/bin/env python3
"""Envia para o Drive todos os vídeos prontos de um dia (out/AAAA-MM-DD_*.mp4), com a legenda ao lado.

python3 tools/drive_sync.py [--data 2026-10-29] [--pagina Worldframe]

Usa o tools/drive_upload.py (substitui o que já existe com o mesmo nome: rodar de novo não duplica).
Serve para quando o upload falhou na produção ou só as legendas chegaram ao Drive.
"""
import argparse
import datetime as dt
import json
import subprocess
import sys
from pathlib import Path

from _common import ROOT, emit

ap = argparse.ArgumentParser()
ap.add_argument("--data", default=dt.date.today().isoformat())
ap.add_argument("--pagina", default="Worldframe", choices=["Worldframe"])
a = ap.parse_args()

enviados, falhas = [], []
videos = sorted(p for p in (ROOT / "out").glob(f"{a.data}_*.mp4"))
for v in videos:
    txt = v.with_suffix(".txt")
    caption = txt.read_text().strip() if txt.exists() else v.stem
    p = subprocess.run([sys.executable, str(ROOT / "tools/drive_upload.py"), str(v), "--page", a.pagina,
                        "--caption", caption, "--date", a.data], cwd=ROOT, capture_output=True, text=True)
    last = (p.stdout.strip().splitlines() or ["{}"])[-1]
    try:
        r = json.loads(last)
    except json.JSONDecodeError:
        r = {"ok": False, "error": (p.stderr or p.stdout)[-300:]}
    (enviados if r.get("ok") else falhas).append({"video": v.name, **({"url": r.get("url") or r.get("local")} if r.get("ok") else {"erro": r.get("error")})})
emit("drive_sync", ok=not falhas, data=a.data, videos=len(videos), enviados=enviados, falhas=falhas)
