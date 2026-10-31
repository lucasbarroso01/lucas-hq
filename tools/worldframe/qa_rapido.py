#!/usr/bin/env python3
"""Revisão rápida e sem cota (nenhum agente): confere um vídeo de out/ antes da Publicação.

python3 tools/worldframe/qa_rapido.py out/AAAA-MM-DD_<slug>.mp4
Checa: 1080x1920, áudio presente, duração dentro de config (61-120 s), sem trecho preto (> 1 s),
sem imagem congelada (> 4 s, fora do cartão final), legenda .txt presente, sem hífen e terminando em pergunta.
Imprime 1 linha JSON com ok e os problemas. Leva poucos segundos por vídeo.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def limites() -> tuple[float, float]:
    t = (ROOT / "config/expediente.yaml").read_text()
    mn = re.search(r"duracao_min_s:\s*([\d.]+)", t)
    mx = re.search(r"duracao_max_s:\s*([\d.]+)", t)
    return float(mn.group(1) if mn else 61), float(mx.group(1) if mx else 120)


def checar(v: Path) -> list[str]:
    probs = []
    pr = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height:format=duration",
                                    "-of", "json", str(v)], capture_output=True, text=True, check=True).stdout)
    vid = [s for s in pr["streams"] if s["codec_type"] == "video"]
    dur = float(pr["format"]["duration"])
    mn, mx = limites()
    if not vid or (vid[0].get("width"), vid[0].get("height")) != (1080, 1920):
        probs.append("não é 1080x1920")
    if not any(s["codec_type"] == "audio" for s in pr["streams"]):
        probs.append("sem áudio")
    if not mn <= dur <= mx:
        probs.append(f"duração {dur:.1f}s fora de {mn:.0f}-{mx:.0f}s")
    # preto e congelado numa passada só, em baixa resolução (rápido)
    r = subprocess.run(["ffmpeg", "-v", "info", "-i", str(v), "-vf", "scale=270:-1,blackdetect=d=1:pix_th=0.06,freezedetect=n=0.002:d=4",
                        "-an", "-f", "null", "-"], capture_output=True, text=True)
    if "black_start" in r.stderr:
        probs.append("trecho preto de mais de 1 s")
    for ini in re.findall(r"freeze_start: ([\d.]+)", r.stderr):
        if float(ini) < dur - 12:   # o cartão final (pergunta, like, follow) fica parado de propósito
            probs.append(f"imagem congelada a partir de {float(ini):.0f}s")
            break
    txt = v.with_suffix(".txt")
    leg = txt.read_text().strip() if txt.exists() else ""
    if not leg:
        probs.append("sem legenda .txt")
    else:
        if re.search(r"[‐-―-]", leg.split("#")[0]):
            probs.append("legenda com hífen")
        if not leg.split("#")[0].strip().endswith("?"):
            probs.append("legenda não termina em pergunta")
    return probs


if __name__ == "__main__":
    v = Path(sys.argv[1])
    try:
        p = checar(v)
        print(json.dumps({"tool": "qa_rapido", "ok": not p, "video": v.name, "problemas": p}, ensure_ascii=False))
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"tool": "qa_rapido", "ok": False, "video": v.name, "problemas": [f"{type(e).__name__}: {e}"[:200]]}, ensure_ascii=False))
