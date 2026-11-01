#!/usr/bin/env python3
"""Pautas pedidas pelo Lucas na aba "Pautas" (tabela pautas do Supabase). O Radar usa estas antes de buscar temas.

python3 tools/pautas.py proximas [--n 5]            # próximas da fila (pula as que repetem vídeo dos últimos 45 dias)
python3 tools/pautas.py marcar --id <uuid> --status em_uso|feito|descartado [--slug <video>] [--nota "..."]
Imprime 1 linha JSON.
"""
import argparse
import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent / "worldframe"))
from _common import URL, emit, rest  # noqa: E402


def marcar(pid: str, status: str, slug: str = "", nota: str = "") -> None:
    body = {"status": status}
    if status in ("em_uso", "feito"):
        body["usado_em"] = dt.date.today().isoformat()
    if slug:
        body["video_slug"] = slug
    if nota:
        body["nota"] = nota
    rest("PATCH", "pautas", body, f"?id=eq.{pid}")


def proximas(n: int) -> list[dict]:
    from temas import repetido  # noqa: PLC0415
    fila = rest("GET", "pautas", None, "?status=eq.fila&order=ordem.asc,criado_em.asc&limit=50") or []
    out = []
    for p in fila:
        rep = repetido(p["tema"] + " " + p.get("gancho", ""))
        if rep:   # já virou vídeo há pouco: sai da fila com o motivo (o Lucas vê na aba)
            marcar(p["id"], "descartado", nota=f"repete o vídeo {rep['data']} {rep['slug']}")
            continue
        out.append({k: p[k] for k in ("id", "tema", "gancho", "categoria")})
        if len(out) >= n:
            break
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("proximas")
    p.add_argument("--n", type=int, default=5)
    m = sub.add_parser("marcar")
    m.add_argument("--id", required=True)
    m.add_argument("--status", required=True, choices=["em_uso", "feito", "descartado", "fila"])
    m.add_argument("--slug", default="")
    m.add_argument("--nota", default="")
    a = ap.parse_args()
    try:
        if not URL:
            emit("pautas", ok=False, error="sem Supabase (SUPABASE_URL)")
        elif a.cmd == "proximas":
            emit("pautas", pautas=proximas(a.n))
        else:
            marcar(a.id, a.status, a.slug, a.nota)
            emit("pautas", id=a.id, status=a.status)
    except Exception as e:  # noqa: BLE001
        emit("pautas", ok=False, error=str(e)[:200], pautas=[])
