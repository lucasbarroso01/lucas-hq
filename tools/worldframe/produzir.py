#!/usr/bin/env python3
"""Produz UM vídeo Worldframe a partir de um roteiro.json (sem vídeo bruto).

python3 tools/worldframe/produzir.py inbox/roteiros/AAAA-MM-DD_slug.json [--task <id>] [--rascunho]

Etapas: pré-requisitos → roteiro (checagens) → voz (Kokoro) → composição (HyperFrames) → trilha + master →
lint + snapshots (12 instantes) + contact sheet → render delivery → mux → legenda do post.
Saída: out/AAAA-MM-DD_slug.mp4, out/AAAA-MM-DD_slug.txt (legenda), out/AAAA-MM-DD_slug_contato.jpg; log em out/_turnos.log.
"""
import argparse
import datetime as dt
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
from _common import emit  # noqa: E402

LOG = ROOT / "out" / "_turnos.log"
PY = sys.executable
WF = ROOT / "tools" / "worldframe"
PRE = [ROOT / "models/kokoro-v1.0.onnx", ROOT / "models/voices-v1.0.bin", ROOT / "assets/lib/gsap.min.js",
       ROOT / "assets/lib/three.module.js", ROOT / "assets/lib/terra.js", ROOT / "assets/fonts/LeagueGothic.ttf",
       ROOT / "assets/fonts/Oswald.ttf"]


def log(msg: str):
    LOG.parent.mkdir(exist_ok=True)
    with open(LOG, "a") as f:
        f.write(f"{dt.datetime.now():%F %T} [produzir] {msg}\n")


def step(name: str, cmd: list[str], cwd: Path = ROOT, env=None) -> dict:
    p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, env=env)
    last = next((ln for ln in reversed(p.stdout.strip().splitlines()) if ln.startswith("{")), "")
    try:
        res = json.loads(last) if last else {"ok": p.returncode == 0}
    except json.JSONDecodeError:
        res = {"ok": p.returncode == 0}
    if p.returncode != 0 or not res.get("ok", True):
        tail = (p.stderr or p.stdout).strip().splitlines()[-3:]
        raise RuntimeError(f"{name}: {res.get('error') or ' | '.join(tail)}")
    log(f"{name}: ok {json.dumps({k: v for k, v in res.items() if k not in ('tool', 'ok')}, ensure_ascii=False)[:240]}")
    return res


def hq(task: str | None, etapa: str, progress: int, text: str):
    if task:
        subprocess.run([PY, str(ROOT / "tools/hq.py"), "task", "--id", task, "--etapa", etapa, "--progress", str(progress),
                        "--log", text], cwd=ROOT, capture_output=True)


def checar_roteiro(r: dict) -> list[str]:
    """Regras do roteiro: duração, cena ≤ 19 palavras, fonte em todo número, gancho, final, legenda do post."""
    probs = []
    falas = [c["fala"] for c in r["cenas"]]
    palavras = sum(len(f.split()) for f in falas)
    if not 100 <= palavras <= 220:
        probs.append(f"{palavras} palavras (mire 140 a 220 para 45 a 90 s)")
    for i, c in enumerate(r["cenas"]):
        if len(c["fala"].split()) > 19:
            probs.append(f"cena {i + 1} tem {len(c['fala'].split())} palavras (máx. 19)")
        if re.search(r"\d", c["fala"]):
            probs.append(f"cena {i + 1}: número em dígitos na fala (escreva por extenso)")
        if (c.get("numero") or re.search(r"\d", c.get("legenda", ""))) and not c.get("fonte"):
            probs.append(f"cena {i + 1}: número sem fonte (corte o número ou cite a fonte)")
    g = r["cenas"][0]["fala"].lower()
    if g.startswith("what if") or g.rstrip().endswith("?"):
        probs.append("gancho em forma de pergunta genérica: faça uma afirmação concreta com algo em jogo")
    if not r.get("final", {}).get("opcoes") or len(r["final"]["opcoes"]) != 2:
        probs.append("final precisa de pergunta binária com 2 opções")
    post = r.get("legenda_post", "")
    if re.search(r"[-–—]", post):
        probs.append("legenda do post com hífen ou travessão")
    if not post.rstrip().endswith("?"):
        probs.append("legenda do post precisa terminar com pergunta")
    return probs


ap = argparse.ArgumentParser()
ap.add_argument("roteiro")
ap.add_argument("--task", help="id da tarefa na Supabase (atualiza etapa e log ao vivo)")
ap.add_argument("--rascunho", action="store_true", help="render draft (mais rápido, para conferir)")
a = ap.parse_args()

try:
    src = Path(a.roteiro)
    r = json.loads(src.read_text())
    nome = src.stem if re.match(r"\d{4}-\d{2}-\d{2}_", src.stem) else f"{dt.date.today()}_{r['slug']}"
    proj = ROOT / "out" / f"_proj_{nome}"
    log(f"início {nome} ({len(r['cenas'])} cenas)")

    # 0. pré-requisitos (PASSO 0); se faltar algo, instala
    if any(not p.exists() for p in PRE):
        log("pré-requisitos faltando: rodando tools/setup_producao.sh")
        if subprocess.run(["bash", str(ROOT / "tools/setup_producao.sh")], cwd=ROOT).returncode != 0:
            raise RuntimeError("PASSO 0 falhou: veja as linhas [setup] no log")

    # 1. roteiro
    probs = checar_roteiro(r)
    if probs:
        raise RuntimeError("roteiro reprovado: " + "; ".join(probs))
    proj.mkdir(parents=True, exist_ok=True)
    (proj / "roteiro.json").write_text(json.dumps(r, ensure_ascii=False, indent=1))
    hq(a.task, "ROTEIRO", 5, f"roteiro ok: {nome}")

    # 2. voz → 3. composição (timeline vem da voz) → 4. trilha
    step("voz", [PY, str(WF / "tts.py"), str(proj / "roteiro.json"), str(proj / "voz")])
    hq(a.task, "VOZ", 20, "narração Kokoro pronta")
    step("composição", [PY, str(WF / "compor.py"), str(proj)])
    step("trilha", [PY, str(WF / "trilha.py"), str(proj)])
    hq(a.task, "TRILHA", 35, "trilha e master −14 LUFS prontos")

    # 5. revisão antes do render: lint, 12 snapshots, contact sheet
    hf = proj / "hf"
    npx = shutil.which("npx") or "npx"
    lint = subprocess.run([npx, "hyperframes", "lint"], cwd=hf, capture_output=True, text=True)
    m = re.search(r"(\d+) error", lint.stdout + lint.stderr)
    if not m or int(m.group(1)) > 0:
        raise RuntimeError("lint com erros:\n" + (lint.stdout + lint.stderr)[-800:])
    log("lint: 0 erros")
    tl = json.loads((proj / "timeline.json").read_text())
    ts = [0.0] + [round(c["inicio"] + c["dur"] * 0.55, 2) for c in tl["cenas"]][:10] + [round(tl["final"]["inicio"] + 1.6, 2)]
    snap = subprocess.run([npx, "hyperframes", "snapshot", "--at", ",".join(map(str, ts[:12]))], cwd=hf, capture_output=True, text=True)
    sheets = re.findall(r"(\S+contact-sheet[^\s]*\.jpg)", snap.stdout)
    if not sheets:
        raise RuntimeError("snapshot falhou: " + snap.stdout[-400:])
    contato = ROOT / "out" / f"{nome}_contato.jpg"
    if len(sheets) == 1:
        shutil.copy(sheets[0], contato)
    else:
        from PIL import Image
        ims = [Image.open(s) for s in sheets]
        w = max(i.width for i in ims)
        out = Image.new("RGB", (w, sum(i.height for i in ims)), "#111")
        y = 0
        for i in ims:
            out.paste(i, (0, y)); y += i.height
        out.save(contato, quality=88)
    log(f"contact sheet: {contato.relative_to(ROOT)}")
    hq(a.task, "REVISÃO", 45, "lint ok, 12 snapshots e contact sheet")

    # 6. render + mux
    silent = proj / "video_mudo.mp4"
    env = dict(os.environ)
    import fcntl
    lockf = Path.home() / ".config" / "lucas-hq" / "render.lock"   # limites.renders_simultaneos = 1
    lockf.parent.mkdir(parents=True, exist_ok=True)
    with open(lockf, "w") as lk:
        hq(a.task, "NA FILA DO RENDER", 48, "esperando a vez do render (1 por vez)")
        fcntl.flock(lk, fcntl.LOCK_EX)
        hq(a.task, "RENDER", 50, "renderizando")
        t_r = dt.datetime.now()
        rend = subprocess.run([npx, "hyperframes", "render", "-q", "draft" if a.rascunho else "delivery", "-o", str(silent)],
                              cwd=hf, capture_output=True, text=True, env=env)
    log(f"render levou {(dt.datetime.now() - t_r).seconds // 60} min {(dt.datetime.now() - t_r).seconds % 60} s")
    if rend.returncode != 0 or not silent.exists():
        raise RuntimeError("render falhou: " + (rend.stdout + rend.stderr)[-600:])
    log("render: ok")
    final = ROOT / "out" / f"{nome}.mp4"
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(silent), "-i", str(proj / "audio/mix.wav"),
                    "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest",
                    "-movflags", "+faststart", str(final)], check=True)
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(final)],
                               capture_output=True, text=True).stdout.strip())
    if abs(dur - tl["total"]) > 0.5:
        raise RuntimeError(f"duração {dur:.2f}s não bate com a timeline {tl['total']:.2f}s")
    loud = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(final), "-af", "loudnorm=I=-14:TP=-1:print_format=json",
                           "-f", "null", "-"], capture_output=True, text=True).stderr
    lj = json.loads(loud[loud.rindex("{"): loud.rindex("}") + 1])
    if abs(float(lj["input_i"]) + 14) > 1 or float(lj["input_tp"]) > -1:
        raise RuntimeError(f"áudio final fora do master: {lj['input_i']} LUFS, TP {lj['input_tp']}")
    # contact sheet também do arquivo final (quadros decodificados do mp4)
    subprocess.run([PY, str(ROOT / "tools/frames.py"), str(final), "--grid", "4x3", "-o", str(ROOT / "out" / f"{nome}_final.jpg")],
                   cwd=ROOT, capture_output=True)
    (ROOT / "out" / f"{nome}.txt").write_text(r["legenda_post"].strip() + "\n")
    hq(a.task, "PRONTO", 100, f"{final.name} ({dur:.1f}s) pronto")
    log(f"fim {nome}: {final.relative_to(ROOT)} ({dur:.1f}s, {lj['input_i']} LUFS, TP {lj['input_tp']})")
    emit("produzir", video=str(final.relative_to(ROOT)), segundos=round(dur, 2), legenda=f"out/{nome}.txt",
         contato=str(contato.relative_to(ROOT)))
except Exception as e:  # noqa: BLE001
    log(f"ERRO: {e}")
    emit("produzir", ok=False, error=str(e))
