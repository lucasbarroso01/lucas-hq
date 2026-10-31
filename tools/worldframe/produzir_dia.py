#!/usr/bin/env python3
"""Turno producao-worldframe SEM agente (sem cota): roda o produzir.py em cada roteiro do dia, um por vez.

python3 tools/worldframe/produzir_dia.py [--data AAAA-MM-DD]
- Roteiros: inbox/roteiros/<data>_*.json (sem "teste"). Pula o que já tem out/<data>_<slug>.mp4.
- 2 tentativas por vídeo; a tarefa producao-worldframe-<data> vira done (≥1 vídeo) ou error (nenhum).
- Cada vídeo vai para o Drive pelo próprio produzir.py; a Publicação revisa (qa_rapido) e agenda.
Imprime 1 linha JSON.
"""
import argparse
import datetime as dt
import json
import subprocess
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
PY = sys.executable


def hq(*a: str) -> None:
    subprocess.run([PY, str(ROOT / "tools/hq.py"), *a], cwd=ROOT, capture_output=True, check=False)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=dt.datetime.now(ZoneInfo("America/Sao_Paulo")).date().isoformat())
    a = ap.parse_args()
    tid = f"producao-worldframe-{a.data}"
    roteiros = [p for p in sorted((ROOT / "inbox/roteiros").glob(f"{a.data}_*.json")) if "teste" not in p.name]
    hq("task", "--id", tid, "--team", "producao-wf", "--title", f"Produção Worldframe {a.data}", "--status", "running",
       "--etapa", "RENDER", "--log", f"{len(roteiros)} roteiros, produção por script (sem agente)")
    feitos, falhas = [], []
    for k, r in enumerate(roteiros):
        slug = r.stem.split("_", 1)[1]
        if (ROOT / "out" / f"{a.data}_{slug}.mp4").exists():
            feitos.append(slug)
            continue
        ok, erro = False, ""
        for _ in range(2):
            p = subprocess.run([PY, str(ROOT / "tools/worldframe/produzir.py"), str(r), "--task", f"{tid}-{slug}"],
                               cwd=ROOT, capture_output=True, text=True)
            linhas = [l for l in p.stdout.splitlines() if l.startswith("{")]
            res = json.loads(linhas[-1]) if linhas else {"ok": False, "error": p.stderr[-300:]}
            ok, erro = bool(res.get("ok")), str(res.get("error") or res.get("problemas") or "")[:300]
            if ok:
                break
        (feitos if ok else falhas).append(slug if ok else f"{slug}: {erro}")
        hq("task", "--id", tid, "--progress", str(int((k + 1) / len(roteiros) * 100)), "--log", f"{slug}: {'ok' if ok else 'erro ' + erro}")
    st = "done" if feitos else "error"
    hq("task", "--id", tid, "--status", st, "--progress", "100", "--log", f"{len(feitos)} vídeos prontos, {len(falhas)} com erro")
    print(json.dumps({"tool": "produzir_dia", "ok": bool(feitos), "data": a.data, "feitos": feitos, "falhas": falhas}, ensure_ascii=False))


if __name__ == "__main__":
    main()
