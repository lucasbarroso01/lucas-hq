#!/usr/bin/env python3
"""Filtro de temas do Worldframe (config/temas.yaml).

python3 tools/worldframe/temas.py checar --categoria geopolitica --tema "Strait of Hormuz chokepoint" [--notas '{"explica":8,"em_jogo":9,"atual":9,"dados":8}']
python3 tools/worldframe/temas.py editorias      # lista o que vale
python3 tools/worldframe/temas.py usados [--dias 45]   # temas já feitos (roteiros e vídeos): não repita
checar também recusa tema que repete um vídeo dos últimos 45 dias.
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


PARADAS = {"the", "and", "for", "with", "from", "that", "this", "what", "when", "why", "how", "who", "your", "into", "over",
           "than", "more", "most", "just", "only", "will", "would", "could", "about", "after", "before", "their", "there",
           "world", "worlds", "biggest", "secret", "real", "truth", "every", "years", "year", "dilemma", "war", "wars"}
# palavras genéricas não bastam sozinhas para dizer que é o mesmo tema (Malaca ≠ Ormuz só por "strait")
GENERICAS = {"strait", "fund", "bank", "money", "price", "market", "country", "crisi", "trade", "power", "empire",
             "cost", "debt", "energy", "chokepoint", "reserve", "border", "election", "tariff", "currency"}


def _palavras(txt: str) -> set[str]:
    return {w.rstrip("s") for w in re.findall(r"[a-z]{4,}", txt.lower().replace("-", " ")) if w not in PARADAS}


def usados(dias: int = 45, excluir: str = "") -> list[dict]:
    """Temas já feitos: roteiros em inbox/roteiros e vídeos em out/ e done/ dos últimos `dias` (menos o slug `excluir`)."""
    import datetime as dt  # noqa: PLC0415
    corte = (dt.date.today() - dt.timedelta(days=dias)).isoformat()
    vistos: dict[str, dict] = {}
    for pasta, ext in (("inbox/roteiros", "*.json"), ("out", "*.mp4"), ("done", "*.mp4")):
        for f in (ROOT / pasta).glob(ext):
            m = re.match(r"(\d{4}-\d{2}-\d{2})_(.+)$", f.stem)
            if not m or m.group(1) < corte or "teste" in f.stem or m.group(2) == excluir:
                continue
            titulo = ""
            if f.suffix == ".json":
                try:
                    titulo = json.loads(f.read_text()).get("titulo", "")
                except ValueError:
                    pass
            v = vistos.setdefault(f.stem, {"data": m.group(1), "slug": m.group(2), "titulo": ""})
            v["titulo"] = v["titulo"] or titulo
    return sorted(vistos.values(), key=lambda v: v["data"])


def repetido(tema: str, excluir: str = "") -> dict | None:
    """O tema repete algum já feito? Dois termos em comum, ou um nome próprio raro (5+ letras) em tema curto."""
    a = _palavras(tema)
    for u in usados(excluir=excluir):
        b = _palavras(u["slug"] + " " + u["titulo"])
        comum = a & b
        if len(comum) >= 2 or (comum - GENERICAS and min(len(a), len(_palavras(u["slug"]))) <= 2
                                 and max(map(len, comum - GENERICAS)) >= 6):
            return {**u, "em_comum": sorted(comum)}
    return None


def checar(categoria: str, tema: str, notas: dict | None = None, excluir: str = "") -> list[str]:
    probs = []
    rep = repetido(tema, excluir)
    if rep:
        probs.append(f"tema repetido: já feito em {rep['data']} ({rep['slug']}; em comum: {', '.join(rep['em_comum'])}). Escolha outro ângulo ou outro tema")
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
    u = sub.add_parser("usados")
    u.add_argument("--dias", type=int, default=45)
    a = ap.parse_args()
    if a.cmd == "usados":
        emit("temas", usados=usados(a.dias))
    elif a.cmd == "editorias":
        emit("temas", editorias=CFG["editorias"], fora=CFG["fora"], criterios=CFG["criterios"])
    else:
        p = checar(a.categoria, a.tema, json.loads(a.notas) if a.notas else None)
        emit("temas", ok=not p, categoria=a.categoria, tema=a.tema, motivo="; ".join(p) or "tema aprovado")
