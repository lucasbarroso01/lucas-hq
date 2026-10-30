#!/usr/bin/env python3
"""Acervo de virais: prepara as referências que o Lucas manda para o curador fichar.

python3 tools/acervo.py baixar                       # traz os vídeos enviados pela interface (bucket "acervo" do Supabase)
python3 tools/acervo.py pendentes                    # vídeos em acervo/referencias/ ainda sem ficha
python3 tools/acervo.py fichar acervo/referencias/x.mp4
    -> out/acervo/<slug>/: cortes.jpg (1 frame por corte de cena), legendas_NN.jpg (1 frame a cada 1,5 s,
       para ler a copy queimada), audio.wav; imprime duração, nº de cortes e cortes por segundo.
python3 tools/acervo.py resumo                       # junta as fichas em brain/acervo.md (lido por Radar e Roteiro)

Só lê os vídeos (nunca apaga nem move). Imprime 1 linha JSON.
"""
import argparse
import json
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import KEY, URL  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
REFS = ROOT / "acervo" / "referencias"
FICHAS = ROOT / "acervo" / "fichas"
OUT = ROOT / "out" / "acervo"
EXT = {".mp4", ".mov", ".webm", ".m4v"}


def slug(p: Path) -> str:
    return re.sub(r"[^a-z0-9]+", "-", p.stem.lower()).strip("-")[:60]


def dur(p: Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                       capture_output=True, text=True)
    return float(r.stdout.strip() or 0)


def ff(*args: str) -> None:
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)


def pendentes() -> list[Path]:
    vids = sorted(p for p in REFS.glob("*") if p.suffix.lower() in EXT) if REFS.exists() else []
    return [p for p in vids if not (FICHAS / f"{slug(p)}.md").exists()]


def fichar(p: Path) -> dict:
    d = dur(p)
    o = OUT / slug(p)
    o.mkdir(parents=True, exist_ok=True)
    # cortes de cena: frame de cada troca (limiar 0.3), em grade 4 colunas
    r = subprocess.run(["ffmpeg", "-v", "info", "-i", str(p), "-vf", "select='gt(scene,0.3)',showinfo", "-f", "null", "-"],
                       capture_output=True, text=True)
    cortes = len(re.findall(r"pts_time:", r.stderr))
    ff("-i", str(p), "-vf", "select='eq(n,0)+gt(scene,0.3)',scale=270:-1,tile=4x4", "-vsync", "vfr",
       "-frames:v", "1", str(o / "cortes.jpg"))
    # legendas: 1 frame a cada 1,5 s, páginas de 4x3
    ff("-i", str(p), "-vf", "fps=1/1.5,scale=270:-1,tile=4x3", "-vsync", "vfr", str(o / "legendas_%02d.jpg"))
    ff("-i", str(p), "-vn", "-ac", "1", "-ar", "16000", str(o / "audio.wav"))
    return {"video": str(p.relative_to(ROOT)), "slug": slug(p), "segundos": round(d, 1), "cortes": cortes,
            "cortes_por_s": round(cortes / d, 2) if d else 0, "pasta": str(o.relative_to(ROOT)),
            "frames": sorted(x.name for x in o.glob("*.jpg")), "ficha": str((FICHAS / f"{slug(p)}.md").relative_to(ROOT))}


def baixar() -> dict:
    """Baixa de referencias/ no Storage o que ainda não está em acervo/referencias/ (não apaga nada lá)."""
    if not (URL and KEY):
        return {"baixados": [], "aviso": "sem SUPABASE_URL/SUPABASE_SERVICE_KEY: nada a baixar"}
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
    req = urllib.request.Request(f"{URL}/storage/v1/object/list/acervo", method="POST", headers={**h, "Content-Type": "application/json"},
                                 data=json.dumps({"prefix": "referencias/", "limit": 1000}).encode())
    itens = json.load(urllib.request.urlopen(req, timeout=60))
    REFS.mkdir(parents=True, exist_ok=True)
    novos = []
    for it in itens:
        nome = it.get("name") or ""
        if not nome or Path(nome).suffix.lower() not in EXT or (REFS / nome).exists():
            continue
        r = urllib.request.Request(f"{URL}/storage/v1/object/acervo/referencias/{urllib.parse.quote(nome)}", headers=h)
        with urllib.request.urlopen(r, timeout=300) as src, open(REFS / f".{nome}.part", "wb") as dst:
            dst.write(src.read())
        (REFS / f".{nome}.part").rename(REFS / nome)
        novos.append(nome)
    return {"baixados": novos, "no_storage": len(itens)}


def resumo() -> dict:
    fichas = sorted(FICHAS.glob("*.md"))
    partes = ["# Acervo de virais (gerado por `tools/acervo.py resumo`; não edite à mão)", "",
              "Radar e Roteiro: modelem a fórmula (tema, gancho, ritmo, animação), nunca copiem o vídeo.", ""]
    for f in fichas:
        partes += [f.read_text().strip(), "", "---", ""]
    dest = ROOT / "brain" / "acervo.md"
    dest.write_text("\n".join(partes))
    return {"fichas": len(fichas), "arquivo": str(dest.relative_to(ROOT))}


ap = argparse.ArgumentParser()
sp = ap.add_subparsers(dest="cmd", required=True)
sp.add_parser("baixar")
sp.add_parser("pendentes")
f = sp.add_parser("fichar")
f.add_argument("video")
sp.add_parser("resumo")
a = ap.parse_args()
try:
    if a.cmd == "baixar":
        res = baixar()
    elif a.cmd == "pendentes":
        res = {"pendentes": [str(p.relative_to(ROOT)) for p in pendentes()]}
    elif a.cmd == "fichar":
        res = fichar(Path(a.video).resolve())
    else:
        res = resumo()
    print(json.dumps({"tool": "acervo", "ok": True, **res}, ensure_ascii=False))
except Exception as e:  # noqa: BLE001
    print(json.dumps({"tool": "acervo", "ok": False, "erro": str(e)}, ensure_ascii=False))
    sys.exit(1)
