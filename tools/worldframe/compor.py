#!/usr/bin/env python3
"""Monta o projeto HyperFrames do vídeo a partir do roteiro e das durações da voz.

python3 tools/worldframe/compor.py out/<proj>      # lê roteiro.json + voz/duracoes.json -> timeline.json + hf/
A timeline vem só das durações da voz (fonte única de verdade). Todo texto fica entre 168 e 1330 px.
"""
import html
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
from _common import emit  # noqa: E402

W, H, FPS = 1080, 1920, 30
RA = 292            # raio dos anéis em volta do globo (px)
FINAL_TAIL = 2.6     # cartão final depois da última fala
LOOP = 0.6           # últimos segundos voltam ao frame 0 (loop)
BAND = (168, 1330)   # faixa onde todo texto precisa caber

PALETAS = {
    "principal": dict(bg="#07080C", glow="#121A3A", cor="#1F4BFF", funda="#0B1F7A", destaque="#C6FF1A",
                      texto="#F2F4F8", sec="#8A90A6", fonte_leg="'Instrument Serif'", peso_leg=400, caixa="none",
                      titulo="'Instrument Serif'", rotulo="'Barlow'"),
    "alternativa": dict(bg="#EFE6D2", glow="#E2D6BC", cor="#8E9A8B", funda="#6E7A6B", destaque="#6B1F2A",
                        texto="#2A2522", sec="#6B6359", fonte_leg="'Playfair Display'", peso_leg=500, caixa="none",
                        titulo="'Cinzel'", rotulo="'Barlow'"),
}

# Rotas ilustrativas por corredores reais de cabos (lat, lon)
ROTAS = [
    [(40.7, -74.0), (47, -45), (50.1, -5.5)],
    [(36.8, -76.0), (40, -40), (43.3, -3.0)],
    [(-3.7, -38.5), (15, -28), (38.7, -9.1)],
    [(-3.7, -38.5), (12, -55), (25.8, -80.2)],
    [(43.3, 5.4), (36.5, 15), (31.2, 29.9), (27, 34.5), (20, 38.5), (12, 45), (15, 60), (19.0, 72.8)],
    [(19.0, 72.8), (6, 80), (1.3, 103.8)],
    [(1.3, 103.8), (10, 113), (22.3, 114.2), (30, 128), (35.6, 139.7)],
    [(35.6, 139.7), (42, 170), (44, -150), (45.5, -123.9)],
    [(33.9, -118.4), (21.3, -157.8), (2, -175), (-20, 170), (-33.9, 151.2)],
    [(1.3, 103.8), (-12, 108), (-31.9, 115.8)],
    [(-33.9, 18.4), (-15, 8), (6.4, 3.4), (12, -18), (28, -16), (38.7, -9.1)],
    [(19.0, 72.8), (5, 58), (-4.0, 39.7)],
    [(-33.9, 151.2), (-38, 165), (-36.8, 174.7)],
    [(25.8, -80.2), (12, -70), (10.6, -66.9)],
]


def chunks(text: str, destaques: list[str]):
    """Blocos de 2 a 4 palavras; marca as palavras de destaque."""
    words = text.split()
    keys = {w.lower().strip(".,?!:;") for d in destaques for w in d.split()}
    groups, cur = [], []
    for w in words:
        cur.append(w)
        end = w.endswith((".", "?", "!", ","))
        if len(cur) >= 3 or (end and len(cur) >= 2) or len(cur) == 4:
            groups.append(cur); cur = []
    if cur:
        if groups and len(cur) == 1 and len(groups[-1]) < 4:
            groups[-1] += cur
        else:
            groups.append(cur)
    return [[(w, w.lower().strip(".,?!:;") in keys) for w in g] for g in groups]


def fmt_js(n: dict) -> str:
    return json.dumps(n)


def build(proj: Path):
    r = json.loads((proj / "roteiro.json").read_text())
    dur = json.loads((proj / "voz" / "duracoes.json").read_text())["cenas"]
    if len(dur) != len(r["cenas"]):
        raise ValueError("duracoes.json não bate com o número de cenas")
    P = PALETAS[r.get("paleta", "principal")]
    t, cenas = 0.0, []
    for d in dur:
        cenas.append({"inicio": round(t, 3), "dur": d})
        t += d
    vis_list = [c.get("visual") for c in r["cenas"]]
    ip = vis_list.index("pergunta") if "pergunta" in vis_list else len(cenas) - 1
    iq = vis_list.index("cta") if "cta" in vis_list else None
    final_ini = cenas[ip]["inicio"] + 0.2
    total = round(t + FINAL_TAIL, 3)
    tl = {"cenas": cenas, "final": {"inicio": round(final_ini, 3)}, "total": total, "fps": FPS}
    (proj / "timeline.json").write_text(json.dumps(tl, indent=1))

    hf = proj / "hf"
    (hf / "assets" / "lib").mkdir(parents=True, exist_ok=True)
    (hf / "assets" / "fonts").mkdir(parents=True, exist_ok=True)
    for f in ["gsap.min.js", "three.module.js", "terra.js"]:
        shutil.copy(ROOT / "assets/lib" / f, hf / "assets/lib" / f)
    shutil.copy(Path(__file__).with_name("diorama.js"), hf / "assets/lib" / "diorama.js")
    for f in (ROOT / "assets/fonts").glob("*.ttf"):
        shutil.copy(f, hf / "assets/fonts" / f.name)

    N = len(r["cenas"])
    clips, tweens = [], []
    vis0 = ""
    cap_id = 0

    def clip(id_, start, d, inner, style="", cls="", extra=""):
        clips.append(f'<div id="{id_}" class="clip {cls}" data-start="{start:.3f}" data-duration="{d:.3f}" '
                     f'data-track-index="{len(clips) % 8}" style="{style}" {extra}>{inner}</div>')

    for i, (c, tm) in enumerate(zip(r["cenas"], cenas)):
        s0, d = tm["inicio"], tm["dur"]
        last = i == N - 1
        # número grande + rótulo (topo)
        n = c.get("numero")
        if n:
            v_ini = n["ate"] if (i == 0 or n["de"] == n["ate"]) else n["de"]   # frame 0 é a capa: já mostra o número
            inner = (f'<div class="num"><span id="n{i}v">{v_ini}</span>'
                     f'<span class="suf">{html.escape(n.get("sufixo", ""))}</span></div>'
                     f'<div class="rot">{html.escape(n["rotulo"])}</div>')
            clip(f"num{i}", s0, d, f'<div id="num{i}in" class="numwrap">{inner}</div>', cls="topo")
            if i:
                tweens.append(f'tl.fromTo("#num{i}in",{{opacity:0,y:40,scale:.92}},{{opacity:1,y:0,scale:1,duration:.35,ease:"power3.out"}},{s0:.3f});')
            if n["de"] != n["ate"] and i:
                tweens.append(f'count("#n{i}v",{n["de"]},{n["ate"]},{n.get("casas", 0)},{s0 + 0.25:.3f},0.8);')
            tweens.append(f'tl.to("#num{i}in",{{scale:1.06,duration:{max(0.3, d - 0.6):.3f},ease:"none"}},{s0 + 0.4:.3f});')
        # fonte no rodapé
        if c.get("fonte"):
            clip(f"src{i}", s0, d, f'<span>SOURCE · {html.escape(c["fonte"])}</span>', cls="fonte")
        # visual SVG em volta do globo
        vis = c.get("visual", "globo")
        cx, cy = 540, 790
        if vis in ("contador", "numero", "anel", "voltas", "globo", "printar"):
            if vis == "anel":
                pct = float(c.get("anel", 50))
                circ = 2 * 3.14159 * RA
                svg = (f'<circle cx="{cx}" cy="{cy}" r="{RA}" class="trk" stroke-width="20"/>'
                       f'<circle id="a{i}" cx="{cx}" cy="{cy}" r="{RA}" class="hi" stroke-width="20" stroke-linecap="round" '
                       f'stroke-dasharray="{circ:.1f}" stroke-dashoffset="{circ:.1f}" transform="rotate(-90 {cx} {cy})"/>')
                tweens.append(f'tl.fromTo("#a{i}",{{attr:{{"stroke-dashoffset":{circ:.1f}}}}},{{attr:{{"stroke-dashoffset":{circ * (1 - pct / 100):.1f}}},duration:.9,ease:"power2.out"}},{s0 + 0.25:.3f});')
            elif vis == "contador":
                svg = (f'<circle cx="{cx}" cy="{cy}" r="{RA}" class="ticks" stroke-width="22" stroke-dasharray="3 19"/>'
                       f'<g id="g{i}"><circle cx="{cx}" cy="{cy - RA}" r="11" class="dot"/></g>')
                tweens.append(f'tl.fromTo("#g{i}",{{rotation:-40,svgOrigin:"{cx} {cy}"}},{{rotation:320,svgOrigin:"{cx} {cy}",duration:{d:.3f},ease:"power1.inOut"}},{s0:.3f});')
            elif vis == "voltas":
                svg = (f'<g id="g{i}"><circle cx="{cx}" cy="{cy}" r="{RA}" class="ring" stroke-width="3" stroke-dasharray="40 14"/></g>'
                       f'<g id="h{i}"><circle cx="{cx}" cy="{cy}" r="{RA + 22}" class="ring2" stroke-width="2" stroke-dasharray="6 18"/>'
                       f'<circle cx="{cx + RA + 22}" cy="{cy}" r="9" class="dot"/></g>')
                tweens.append(f'tl.fromTo("#g{i}",{{rotation:0,svgOrigin:"{cx} {cy}"}},{{rotation:-120,svgOrigin:"{cx} {cy}",duration:{d:.3f},ease:"none"}},{s0:.3f});')
                tweens.append(f'tl.fromTo("#h{i}",{{rotation:0,svgOrigin:"{cx} {cy}"}},{{rotation:37*36,svgOrigin:"{cx} {cy}",duration:{d:.3f},ease:"power2.inOut"}},{s0:.3f});')
            else:  # numero, globo, printar: arco que se desenha + ponto orbitando
                circ = 2 * 3.14159 * RA
                svg = (f'<circle id="a{i}" cx="{cx}" cy="{cy}" r="{RA}" class="ring" stroke-width="4" stroke-linecap="round" '
                       f'stroke-dasharray="{circ:.1f}" stroke-dashoffset="{circ:.1f}" transform="rotate(-90 {cx} {cy})"/>'
                       f'<g id="g{i}"><circle cx="{cx}" cy="{cy - RA}" r="8" class="dot2"/></g>')
                tweens.append(f'tl.fromTo("#a{i}",{{attr:{{"stroke-dashoffset":{circ:.1f}}}}},{{attr:{{"stroke-dashoffset":{circ * 0.18:.1f}}},duration:{min(1.6, d):.3f},ease:"power2.out"}},{s0:.3f});')
                tweens.append(f'tl.fromTo("#g{i}",{{rotation:0,svgOrigin:"{cx} {cy}"}},{{rotation:300,svgOrigin:"{cx} {cy}",duration:{d:.3f},ease:"power1.inOut"}},{s0:.3f});')
            clip(f"vis{i}", s0, d, f'<svg viewBox="0 0 {W} {H}" width="{W}" height="{H}">{svg}</svg>', cls="vis",
                 extra="data-layout-ignore")
            if i == 0:   # cópia parada do visual da cena 1 para o loop (estado do frame 0)
                vis0 = re.sub(r'id="(\w+)"', r'id="l\1"', svg)
                if vis in ("contador", "numero", "globo", "printar"):
                    vis0 = vis0.replace(f'<g id="lg0">', f'<g id="lg0" transform="rotate({-40 if vis == "contador" else 0} {cx} {cy})">')
        # legendas (não na pergunta final: ela fica no cartão)
        if vis not in ("pergunta", "cta"):
            groups = chunks(c["legenda"], c.get("destaques", []))
            chars = [sum(len(w) + 1 for w, _ in g) for g in groups]
            speak = max(0.5, d - 0.30)
            acc = 0
            for g, ch in zip(groups, chars):
                a = s0 + speak * acc / sum(chars)
                acc += ch
                b = s0 + speak * acc / sum(chars) if acc < sum(chars) else s0 + d
                words = " ".join(f'<b class="k">{html.escape(w)}</b>' if k else html.escape(w) for w, k in g)
                clip(f"cap{cap_id}", a, b - a, f'<div id="cap{cap_id}t" class="captxt">{words}</div>', cls="cap")
                if cap_id:  # a 1ª legenda já está na tela no frame 0
                    tweens.append(f'tl.fromTo("#cap{cap_id}t",{{opacity:0,y:18}},{{opacity:1,y:0,duration:.12,ease:"power2.out"}},{a:.3f});')
                cap_id += 1
        # dial: FACT 01/10
        clip(f"dl{i}", s0, (total - LOOP - s0) if last else d, f'<div class="dialtxt"><span class="dl">{html.escape(r.get("dial", "FACT"))}</span>'
                              f'<span class="dn">{i + 1:02d}/{N:02d}</span></div>', cls="dialbox")

    # cartão final: pergunta binária + opções + follow
    f = r["final"]
    fd = total - final_ini - LOOP
    opts = "".join(f'<div class="pill" id="op{k}">{html.escape(o)}</div>' for k, o in enumerate(f["opcoes"]))
    chaves = {w.lower().strip("?.,") for w in f.get("destaque", "").split()}
    pq = " ".join(f'<i class="k">{html.escape(w)}</i>' if w.lower().strip("?.,") in chaves else html.escape(w) for w in f["pergunta"].split())
    clip("fin", final_ini, fd, f'<div id="finq" class="finq">{pq}</div>'
                               f'<div id="fincm" class="fincm">COMMENT YOUR ANSWER</div><div class="pills">{opts}</div>'
                               f'<div class="cta"><div id="finlk" class="ctab">♥ <i>Like</i></div><div id="finfl" class="ctab">+ <i>Follow</i></div></div>'
                               f'<div id="finfw" class="finfw">for more videos like this</div>', cls="final")
    lk = (cenas[iq]["inicio"] + 0.1) if iq is not None else final_ini + 1.2
    fl = (cenas[iq]["inicio"] + cenas[iq]["dur"] * 0.42) if iq is not None else final_ini + 1.8
    tweens += [f'tl.fromTo("#finq",{{opacity:0,y:30}},{{opacity:1,y:0,duration:.4,ease:"power3.out"}},{final_ini:.3f});',
               f'tl.fromTo("#fincm",{{opacity:0}},{{opacity:1,duration:.3}},{final_ini + 0.3:.3f});',
               f'tl.fromTo("#op0",{{opacity:0,x:-60}},{{opacity:1,x:0,duration:.35,ease:"back.out(2)"}},{final_ini + 0.5:.3f});',
               f'tl.fromTo("#op1",{{opacity:0,x:60}},{{opacity:1,x:0,duration:.35,ease:"back.out(2)"}},{final_ini + 0.6:.3f});',
               f'tl.fromTo("#finlk",{{opacity:0,scale:.6}},{{opacity:1,scale:1,duration:.35,ease:"back.out(2.5)"}},{lk:.3f});',
               f'tl.fromTo("#finfl",{{opacity:0,scale:.6}},{{opacity:1,scale:1,duration:.35,ease:"back.out(2.5)"}},{fl:.3f});',
               f'tl.fromTo("#finfw",{{opacity:0}},{{opacity:1,duration:.3}},{fl + 0.2:.3f});',
               f'tl.fromTo("#gl",{{opacity:1}},{{opacity:.22,duration:.5,ease:"power2.out"}},{final_ini:.3f});',
               f'tl.to("#gl",{{opacity:1,duration:{LOOP * 0.8:.3f},ease:"power2.inOut"}},{total - LOOP:.3f});']
    # loop: os últimos LOOP s repetem o frame 0 (número, legenda, fonte e dial da cena 1)
    c0 = r["cenas"][0]
    ls = total - LOOP
    if c0.get("numero"):
        n = c0["numero"]
        v0 = n["ate"]
        clip("lnum", ls, LOOP, f'<div class="numwrap"><div class="num"><span>{v0}</span><span class="suf">{html.escape(n.get("sufixo", ""))}</span></div>'
                                f'<div class="rot">{html.escape(n["rotulo"])}</div></div>', cls="topo")
    if vis0:
        clip("lvis", ls, LOOP, f'<svg viewBox="0 0 {W} {H}" width="{W}" height="{H}">{vis0}</svg>', cls="vis", extra="data-layout-ignore")
    if c0.get("fonte"):
        clip("lsrc", ls, LOOP, f'<span>SOURCE · {html.escape(c0["fonte"])}</span>', cls="fonte")
    g0 = chunks(c0["legenda"], c0.get("destaques", []))[0]
    words0 = " ".join(f'<b class="k">{html.escape(w)}</b>' if k else html.escape(w) for w, k in g0)
    clip("lcap", ls, LOOP, f'<div class="captxt">{words0}</div>', cls="cap")
    clip("ldl", ls, LOOP, f'<div class="dialtxt"><span class="dl">{html.escape(r.get("dial", "FACT"))}</span><span class="dn">01/{N:02d}</span></div>', cls="dialbox")

    def cam(c):
        k = dict(c.get("camera", {}))
        if c.get("numero") or c.get("visual") in ("anel", "voltas", "contador"):
            k["dist"] = max(3.4, k.get("dist", 3.2))   # globo não sobe por baixo do número
        k["dist"] = max(2.45, k.get("dist", 3.2))      # nem desce sobre a fonte e a marca d'água (base < 1190 px)
        return k
    scene_data = [{"s": tm["inicio"], "d": tm["dur"], "cam": cam(c), "g": c.get("globo", {}),
                   "palco": c.get("palco", "globo"), "atores": c.get("atores", []), "terreno": c.get("terreno")}
                  for c, tm in zip(r["cenas"], cenas)]
    reps = max(0, int(total / 1.0) - 1)
    dial_steps = "".join(f'tl.to("#dialarc",{{attr:{{"stroke-dashoffset":{364.4 * (1 - (k + 1) / N):.1f}}},duration:.4,ease:"power2.out"}},{cenas[k]["inicio"]:.3f});' for k in range(N))
    doc = TEMPLATE.format(
        W=W, H=H, total=total, P=P, clips="\n      ".join(clips), tweens="\n      ".join(tweens),
        scenes=json.dumps(scene_data), rotas=json.dumps(ROTAS), reps=reps, dial_steps=dial_steps, loop=LOOP,
        titulo=html.escape(r["titulo"]))
    (hf / "index.html").write_text(doc)
    (hf / "hyperframes.json").write_text(json.dumps({"name": r["slug"]}, indent=1))
    # todo texto dentro da faixa: as posições são fixas no CSS; confere aqui
    for name, top, bottom in LAYOUT:
        if top < BAND[0] or bottom > BAND[1]:
            raise ValueError(f"{name} fora da faixa de texto ({top}-{bottom})")
    emit("compor", cenas=N, segundos=total, legendas=cap_id, projeto=str(hf))


# caixas de texto fixas (y topo, y base) usadas no CSS abaixo
LAYOUT = [("rec", 184, 222), ("dial", 176, 316), ("numero", 232, 446), ("legenda", 1100, 1240),
          ("fonte", 1250, 1282), ("marca", 1294, 1326), ("final", 300, 1240)]

TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width={W}, height={H}" />
<title>{titulo}</title>
<script src="assets/lib/gsap.min.js"></script>
<style>
  @font-face {{ font-family: 'Playfair Display'; src: url('assets/fonts/PlayfairDisplay-Italic.ttf'); font-style: italic; font-weight: 400 900; }}
  @font-face {{ font-family: 'Cinzel'; src: url('assets/fonts/Cinzel.ttf'); font-weight: 400 900; }}
  @font-face {{ font-family: 'Instrument Serif'; src: url('assets/fonts/InstrumentSerif-Regular.ttf'); font-style: normal; }}
  @font-face {{ font-family: 'Instrument Serif'; src: url('assets/fonts/InstrumentSerif-Italic.ttf'); font-style: italic; }}
  @font-face {{ font-family: 'Barlow'; src: url('assets/fonts/Barlow-Light.ttf'); font-weight: 300; }}
  @font-face {{ font-family: 'Barlow'; src: url('assets/fonts/Barlow-Regular.ttf'); font-weight: 400; }}
  :root {{ --bg: {P[bg]}; --glow: {P[glow]}; --cor: {P[cor]}; --funda: {P[funda]}; --hi: {P[destaque]}; --tx: {P[texto]}; --sec: {P[sec]}; }}
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  html, body {{ width: {W}px; height: {H}px; overflow: hidden; background: var(--bg); }}
  #root {{ position: relative; width: {W}px; height: {H}px; overflow: hidden; background: var(--bg); font-family: {P[rotulo]}; font-weight: 300; color: var(--tx); }}
  #glow {{ position: absolute; left: 90px; top: 340px; width: 900px; height: 900px; border-radius: 50%;
          background: radial-gradient(circle, var(--glow) 0%, rgba(0,0,0,0) 68%); }}
  .bokeh {{ position: absolute; border-radius: 50%; filter: blur(38px); opacity: .32; background: var(--funda); }}
  #shadow {{ position: absolute; left: 330px; top: 1140px; width: 500px; height: 60px; border-radius: 50%;
            background: radial-gradient(ellipse, rgba(0,0,0,.75), rgba(0,0,0,0) 70%); }}
  #gl {{ position: absolute; inset: 0; width: {W}px; height: {H}px; }}
  .vis {{ position: absolute; inset: 0; }}
  .vis svg {{ position: absolute; inset: 0; }}
  .trk {{ fill: none; stroke: var(--cor); stroke-opacity: .22; }}
  .hi {{ fill: none; stroke: var(--hi); }}
  .ring {{ fill: none; stroke: var(--cor); stroke-opacity: .9; }}
  .ring2 {{ fill: none; stroke: var(--cor); stroke-opacity: .5; }}
  .ticks {{ fill: none; stroke: var(--cor); stroke-opacity: .55; }}
  .dot {{ fill: var(--hi); }}
  .dot2 {{ fill: var(--tx); }}
  .topo {{ position: absolute; left: 0; right: 0; top: 232px; height: 214px; text-align: center; }}
  .numwrap {{ display: block; transform-origin: 50% 60%; }}
  .num {{ font-family: {P[titulo]}; font-size: 200px; line-height: 170px; color: var(--hi); letter-spacing: -.01em; }}
  .num .suf {{ font-size: 120px; margin-left: 8px; font-style: italic; }}
  .rot {{ margin-top: 10px; font-family: {P[rotulo]}; font-weight: 300; font-size: 28px; letter-spacing: .32em; color: var(--sec); }}
  .cap {{ position: absolute; left: 70px; right: 70px; top: 1100px; height: 140px; display: flex; align-items: center; justify-content: center; }}
  .captxt {{ font-family: {P[fonte_leg]}; font-weight: {P[peso_leg]}; text-transform: {P[caixa]}; font-size: 80px; line-height: 84px; letter-spacing: -.005em;
             text-align: center; color: var(--tx); text-shadow: 0 4px 24px rgba(0,0,0,.9); }}
  .captxt .k {{ color: var(--hi); font-weight: inherit; font-style: italic; }}
  .fonte {{ position: absolute; left: 70px; right: 70px; top: 1250px; height: 32px; text-align: center; font-size: 21px;
           letter-spacing: .08em; color: var(--sec); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
  #marca {{ position: absolute; left: 0; right: 0; top: 1294px; height: 32px; text-align: center; font-weight: 400; font-size: 24px;
           letter-spacing: .6em; color: var(--sec); opacity: .7; }}
  #rec {{ position: absolute; left: 64px; top: 184px; height: 38px; display: flex; align-items: center; gap: 12px;
         font-weight: 400; font-size: 26px; letter-spacing: .28em; color: var(--tx); }}
  #recdot {{ width: 18px; height: 18px; border-radius: 50%; background: var(--tx); }}
  #dial {{ position: absolute; left: 866px; top: 176px; width: 140px; height: 140px; }}
  .dialbox {{ position: absolute; left: 866px; top: 176px; width: 140px; height: 140px; display: flex; align-items: center; justify-content: center; }}
  .dialtxt {{ display: flex; flex-direction: column; align-items: center; line-height: 1; }}
  .dl {{ font-size: 16px; letter-spacing: .3em; color: var(--sec); font-weight: 400; }}
  .dn {{ margin-top: 4px; font-family: {P[titulo]}; font-size: 42px; color: var(--tx); }}
  .final {{ position: absolute; left: 70px; right: 70px; top: 300px; height: 940px; text-align: center; }}
  .finq {{ font-family: {P[titulo]}; font-size: 96px; line-height: 100px; color: var(--tx); letter-spacing: -.01em; }}
  .finq .k {{ color: var(--hi); font-style: italic; }}
  .fincm {{ margin-top: 150px; font-weight: 400; font-size: 30px; letter-spacing: .32em; color: var(--sec); }}
  .pills {{ margin-top: 26px; display: flex; justify-content: center; gap: 40px; }}
  .pill {{ min-width: 260px; padding: 18px 46px; border-radius: 999px; font-family: {P[titulo]}; font-style: italic; font-size: 84px; line-height: 88px;
          color: var(--bg); background: var(--hi); }}
  .pill + .pill {{ background: var(--tx); }}
  .cta {{ margin-top: 70px; display: flex; justify-content: center; gap: 36px; }}
  .ctab {{ padding: 14px 40px; border-radius: 999px; border: 2px solid var(--tx); font-family: {P[titulo]}; font-size: 64px; line-height: 70px; color: var(--tx); }}
  .ctab + .ctab {{ border-color: var(--hi); color: var(--hi); }}
  .finfw {{ margin-top: 26px; font-family: {P[titulo]}; font-style: italic; font-size: 44px; color: var(--sec); }}
</style>
</head>
<body>
  <div id="root" data-composition-id="main" data-start="0" data-duration="{total}" data-width="{W}" data-height="{H}">
    <div id="glow"></div>
    <div id="bk0" class="bokeh" style="left:-120px;top:240px;width:420px;height:420px"></div>
    <div id="bk1" class="bokeh" style="left:780px;top:520px;width:360px;height:360px"></div>
    <div id="bk2" class="bokeh" style="left:640px;top:1380px;width:520px;height:520px"></div>
    <div id="bk3" class="bokeh" style="left:-60px;top:1460px;width:300px;height:300px"></div>
    <div id="shadow"></div>
    <canvas id="gl" width="{W}" height="{H}" data-layout-ignore></canvas>
    <div id="rec"><div id="recdot"></div>REC</div>
    <svg id="dial" viewBox="0 0 140 140" data-layout-ignore>
      <circle cx="70" cy="70" r="58" fill="none" stroke="{P[cor]}" stroke-opacity=".25" stroke-width="6"/>
      <circle id="dialarc" cx="70" cy="70" r="58" fill="none" stroke="{P[cor]}" stroke-width="6" stroke-linecap="round"
              stroke-dasharray="364.4" stroke-dashoffset="364.4" transform="rotate(-90 70 70)"/>
    </svg>
    <div id="marca">WORLDFRAME</div>
      {clips}
  </div>
  <script>
    window.__hf = window.__hf || {{}};
    window.__hf.buildReady = window.__hf.buildReady || {{}};
    window.__hf.buildReady["globo"] = new Promise((res) => {{ window.__globoPronto = res; }});
    const tl = gsap.timeline({{ paused: true }});
    function count(sel, a, b, casas, at, d) {{
      const o = {{ v: a }}; const el = document.querySelector(sel);
      tl.fromTo(o, {{ v: a }}, {{ v: b, duration: d, ease: "power2.out", onUpdate: () => {{
        el.textContent = casas ? o.v.toFixed(casas) : Math.round(o.v).toLocaleString("en-US"); }} }}, at);
    }}
    tl.fromTo("#recdot", {{ opacity: 1 }}, {{ opacity: .15, duration: .5, ease: "steps(1)", repeat: {reps}, yoyo: true }}, 0);
    // fundo desfocado vai e volta: termina onde começou (o último frame emenda com o primeiro)
    tl.fromTo("#bk0", {{ x: 0, y: 0 }}, {{ x: 80, y: 60, duration: {total} / 2, ease: "sine.inOut", repeat: 1, yoyo: true }}, 0);
    tl.fromTo("#bk1", {{ x: 0, y: 0 }}, {{ x: -70, y: 90, duration: {total} / 2, ease: "sine.inOut", repeat: 1, yoyo: true }}, 0);
    tl.fromTo("#bk2", {{ x: 0, y: 0 }}, {{ x: -90, y: -50, duration: {total} / 2, ease: "sine.inOut", repeat: 1, yoyo: true }}, 0);
    tl.fromTo("#bk3", {{ x: 0, y: 0 }}, {{ x: 60, y: -70, duration: {total} / 2, ease: "sine.inOut", repeat: 1, yoyo: true }}, 0);
    {dial_steps}
    tl.to("#dialarc", {{ attr: {{ "stroke-dashoffset": 364.4 }}, duration: .3 }}, {total} - {loop});
      {tweens}
    window.__timelines["main"] = tl;
  </script>
  <script type="module">
    import * as THREE from "./assets/lib/three.module.js";
    import {{ TERRA }} from "./assets/lib/terra.js";
    import {{ Diorama }} from "./assets/lib/diorama.js";
    const SCENES = {scenes}, ROTAS = {rotas}, TOTAL = {total}, LOOP = {loop};
    const COR = new THREE.Color("{P[cor]}"), FUNDA = new THREE.Color("{P[funda]}"), HI = new THREE.Color("{P[destaque]}"), TX = new THREE.Color("{P[texto]}");
    const canvas = document.getElementById("gl");
    const renderer = new THREE.WebGLRenderer({{ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true }});
    renderer.setPixelRatio(1); renderer.setSize({W}, {H}, false);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, {W} / {H}, 0.1, 100);
    camera.setViewOffset({W}, {H}, 0, 170, {W}, {H});   // centro do globo em ~790 px
    const v3 = (lat, lon, r = 1) => {{ const a = lat * Math.PI / 180, b = lon * Math.PI / 180;
      return new THREE.Vector3(r * Math.cos(a) * Math.sin(b), r * Math.sin(a), r * Math.cos(a) * Math.cos(b)); }};
    // globo: esfera funda + borda fresnel + pontos de terra + paralelos
    const globe = new THREE.Group(); scene.add(globe);
    globe.add(new THREE.Mesh(new THREE.SphereGeometry(0.995, 64, 48), new THREE.MeshBasicMaterial({{ color: FUNDA, transparent: true, opacity: .55 }})));
    const rim = new THREE.ShaderMaterial({{ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {{ c: {{ value: COR }} }},
      vertexShader: "varying vec3 n; varying vec3 v; void main(){{ n=normalize(normalMatrix*normal); vec4 p=modelViewMatrix*vec4(position,1.); v=normalize(-p.xyz); gl_Position=projectionMatrix*p; }}",
      fragmentShader: "uniform vec3 c; varying vec3 n; varying vec3 v; void main(){{ float f=pow(1.-clamp(dot(n,v),0.,1.),2.6); gl_FragColor=vec4(c*f*1.4,f); }}" }});
    globe.add(new THREE.Mesh(new THREE.SphereGeometry(1.06, 64, 48), rim));
    const lp = new Float32Array(TERRA.length / 2 * 3);
    for (let i = 0; i < TERRA.length; i += 2) {{ const p = v3(TERRA[i], TERRA[i + 1], 1.003); lp.set([p.x, p.y, p.z], i / 2 * 3); }}
    const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.BufferAttribute(lp, 3));
    const landMat = new THREE.PointsMaterial({{ color: COR, size: 0.022, sizeAttenuation: true, transparent: true, opacity: .95 }});
    globe.add(new THREE.Points(lg, landMat));
    for (const lat of [-60, -30, 0, 30, 60]) {{
      const pts = []; for (let k = 0; k <= 128; k++) pts.push(v3(lat, -180 + k * 360 / 128, 1.004));
      globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({{ color: COR, transparent: true, opacity: .12 }})));
    }}
    // cabos: arcos de grande círculo entre pontos, como tubos; pacotes de luz correndo
    const slerp = (a, b, t) => {{ const o = a.angleTo(b); if (o < 1e-6) return a.clone();
      return a.clone().multiplyScalar(Math.sin((1 - t) * o) / Math.sin(o)).add(b.clone().multiplyScalar(Math.sin(t * o) / Math.sin(o))); }};
    const curves = [], cableMeshes = [];
    for (const rota of ROTAS) {{
      const pts = [];
      for (let k = 0; k < rota.length - 1; k++) {{ const a = v3(...rota[k]), b = v3(...rota[k + 1]);
        for (let s = 0; s < 24; s++) pts.push(slerp(a, b, s / 24).multiplyScalar(1.012)); }}
      pts.push(v3(...rota[rota.length - 1], 1.012));
      const curve = new THREE.CatmullRomCurve3(pts); curves.push(curve);
      const geo = new THREE.TubeGeometry(curve, pts.length * 2, 0.0045, 5, false);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({{ color: COR }}));
      const glow = new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 2, 0.012, 5, false),
        new THREE.MeshBasicMaterial({{ color: COR, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false }}));
      globe.add(m); globe.add(glow); cableMeshes.push([m, glow]);
    }}
    const dotTex = (() => {{ const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.35, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }})();
    const packets = [];
    curves.forEach((c, i) => {{ for (let k = 0; k < 3; k++) {{
      const s = new THREE.Sprite(new THREE.SpriteMaterial({{ map: dotTex, color: TX, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }}));
      s.scale.setScalar(0.045); globe.add(s); packets.push({{ s, c, off: (i * 0.37 + k / 3) % 1, sp: 0.09 + (i % 4) * 0.02 }}); }} }});
    const breaks = [0.42, 0.63, 0.25, 0.8, 0.5, 0.33].map((u, k) => {{
      const s = new THREE.Sprite(new THREE.SpriteMaterial({{ map: dotTex, color: HI, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }}));
      globe.add(s); return {{ s, c: curves[(k * 5 + 1) % curves.length], u, ph: k * 0.37 }}; }});
    const anel = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.006, 8, 220), new THREE.MeshBasicMaterial({{ color: COR, transparent: true, opacity: 0 }}));
    anel.rotation.x = Math.PI / 2.25; scene.add(anel);
    const anelHead = new THREE.Sprite(new THREE.SpriteMaterial({{ map: dotTex, color: HI, transparent: true, opacity: 0, depthWrite: false }}));
    anelHead.scale.setScalar(0.09); scene.add(anelHead);

    // câmera: pose da cena (lat, lon, dist) + deriva contínua + um "corte" de câmera no meio da cena
    const ease = (x) => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
    const lerp = (a, b, t) => a + (b - a) * t;
    const lerpLon = (a, b, t) => {{ let d = ((b - a + 540) % 360) - 180; return a + d * t; }};
    function pose(t) {{
      let i = 0; while (i < SCENES.length - 1 && t >= SCENES[i + 1].s) i++;
      const S = SCENES[i], P = SCENES[Math.max(0, i - 1)], lt = t - S.s;
      const k = i === 0 ? 1 : ease(lt / 1.1);
      const cam = S.cam, pc = P.cam;
      let lat = lerp(pc.lat ?? 20, cam.lat ?? 20, k), lon = lerpLon(pc.lon ?? 0, cam.lon ?? 0, k), d = lerp(pc.dist ?? 3, cam.dist ?? 3, k);
      const mid = ease((lt - S.d * 0.5) / 0.7);           // segundo plano da cena: órbita + push-in
      lon += lt * 4 + mid * 16; lat += mid * 5; d *= 1 - lt * 0.012 - mid * 0.06;
      return {{ lat, lon, d, i, lt }};
    }}
    const dio = new Diorama(THREE, scene, SCENES, {{ cor: "{P[cor]}", funda: "{P[funda]}", hi: "{P[destaque]}", tx: "{P[texto]}", sec: "{P[sec]}", bg: "{P[bg]}" }});
    function renderAt(t) {{
      let p = pose(t);
      const z = pose(0);
      const back = ease((t - (TOTAL - LOOP)) / (LOOP * 0.8));   // loop: volta à pose do frame 0
      if (SCENES[p.i].palco === "diorama") {{   // mundo em miniatura com atores
        globe.visible = false; anel.visible = false; anelHead.visible = false;
        dio.render(t, p.i, p.lt, camera, SCENES[0].palco === "diorama" ? back : 0, dio.pose0());
        renderer.render(scene, camera);
        return;
      }}
      dio.esconder(); globe.visible = true; anel.visible = true; anelHead.visible = true;
      const lat = lerp(p.lat, z.lat, back), lon = lerpLon(p.lon, z.lon, back), d = lerp(p.d, z.d, back);
      camera.position.copy(v3(lat, lon, d * 2.6)); camera.lookAt(0, 0, 0);
      camera.up.set(0, 1, 0);
      const S = SCENES[p.i], g = S.g || {{}};
      const fim = t >= SCENES[SCENES.length - 1].s;
      cableMeshes.forEach(([m, gl], i) => {{ const on = (g.cabos ?? 1) ? 1 : 0;
        m.visible = gl.visible = !!on; }});   // cabos prontos desde o frame 0: capa forte e loop sem salto
      packets.forEach((q) => {{ const u = (q.off + t * q.sp) % 1; q.s.position.copy(q.c.getPointAt(u)); q.s.material.opacity = fim ? .35 : .9; }});
      breaks.forEach((b, k) => {{ const on = k < (g.quebras || 0);
        const w = 0.5 + 0.5 * Math.sin((p.lt * 2.4 + b.ph) * Math.PI * 2);
        b.s.visible = on; b.s.position.copy(b.c.getPointAt(b.u)); b.s.scale.setScalar(0.06 + 0.12 * w); b.s.material.opacity = 0.4 + 0.6 * w; }});
      const anelOn = g.anel ? ease(p.lt / 0.6) : 0;
      anel.material.opacity = 0.85 * anelOn; anel.rotation.z = t * 0.9;
      const ang = p.lt * 37 * Math.PI * 2 / Math.max(1, S.d);
      anelHead.position.set(Math.cos(ang) * 1.32, 0, Math.sin(ang) * 1.32).applyEuler(anel.rotation); anelHead.material.opacity = anelOn;
      landMat.opacity = fim ? 0.55 : 0.95;
      renderer.render(scene, camera);
    }}
    window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
    renderAt(0);
    window.__globoPronto && window.__globoPronto();
  </script>
</body>
</html>
"""

if __name__ == "__main__":
    try:
        build(Path(sys.argv[1]))
    except Exception as e:  # noqa: BLE001
        emit("compor", ok=False, error=str(e))
