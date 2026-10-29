#!/usr/bin/env python3
"""Filtro de temas do Worldframe (config/temas.yaml).

python3 tools/worldframe/temas.py checar --categoria geopolitica --tema "Strait of Hormuz chokepoint" [--notas '{"explica":8,"em_jogo":9,"atual":9,"dados":8}']
python3 tools/worldframe/temas.py editorias      # lista o que vale
"""
import argparse
import json
import re
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import ROOT, emit  # noqa: E402

CFG = yaml.safe_load((ROOT / "config" / "temas.yaml").read_text())


def checar(categoria: str, tema: str, notas: dict | None = None) -> list[str]:
    probs = []
    if categoria not in CFG["editorias"]:
        probs.append(f"categoria '{categoria}' fora das editorias ({', '.join(CFG['editorias'])})")
    low = f" {tema.lower().replace('-', ' ').replace('_', ' ')} "
    hits = [w for w in CFG["palavras_fora"] if re.search(rf"\b{re.escape(w.lower())}\b", low)]
    if hits:
        probs.append(f"tema fora da proposta da página (palavras: {', '.join(hits)})")
    if notas is not None:
        faltam = [k for k in CFG["criterios"] if k not in notas]
        if faltam:
            probs.append(f"faltam notas: {', '.join(faltam)}")
        else:
            media = sum(float(notas[k]) for k in CFG["criterios"]) / len(CFG["criterios"])
            if media < 7 or float(notas["explica"]) < 7:
                probs.append(f"nota baixa (média {media:.1f}, explica {notas['explica']}): precisa média ≥ 7 e explica ≥ 7")
    return probs


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("checar")
    c.add_argument("--categoria", required=True)
    c.add_argument("--tema", required=True)
    c.add_argument("--notas", help="JSON com as notas dos critérios")
    sub.add_parser("editorias")
    a = ap.parse_args()
    if a.cmd == "editorias":
        emit("temas", editorias=CFG["editorias"], fora=CFG["fora"], criterios=CFG["criterios"])
    else:
        p = checar(a.categoria, a.tema, json.loads(a.notas) if a.notas else None)
        emit("temas", ok=not p, categoria=a.categoria, tema=a.tema, motivo="; ".join(p) or "tema aprovado")
