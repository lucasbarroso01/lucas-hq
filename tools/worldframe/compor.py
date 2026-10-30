#!/usr/bin/env python3
"""Monta o projeto HyperFrames do vídeo a partir do roteiro e das durações da voz.

python3 tools/worldframe/compor.py out/<proj>      # lê roteiro.json + voz/duracoes.json -> timeline.json + hf/
A timeline vem só das durações da voz (fonte única de verdade). Todo texto fica entre 168 e 1330 px.
"""
import html
import json
import math
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

# Paletas inspiradas no acervo de virais (acervo/fichas). Nunca azul com verde-limão (pedido do Lucas, 30/10).
# Cada vídeo do dia usa uma diferente (produzir.py escolhe se o roteiro não disser).
PALETAS = {
    "dossie": dict(bg="#ECE5D3", glow="#DCD2BA", cor="#8C7B5E", funda="#3A3128", destaque="#D7261E",
                   texto="#1B1814", sec="#6B6153", fonte_leg="'Instrument Serif'", peso_leg=400, caixa="none",
                   titulo="'Instrument Serif'", rotulo="'Barlow'"),
    "noite": dict(bg="#0D0D10", glow="#22161A", cor="#9A9AA6", funda="#2A2A33", destaque="#E5322D",
                  texto="#F4F1EC", sec="#9C968C", fonte_leg="'Instrument Serif'", peso_leg=400, caixa="none",
                  titulo="'Instrument Serif'", rotulo="'Barlow'"),
    "ouro": dict(bg="#111014", glow="#2A2216", cor="#B8A98A", funda="#3B3328", destaque="#F2B233",
                 texto="#F6F0E4", sec="#A39A88", fonte_leg="'Instrument Serif'", peso_leg=400, caixa="none",
                 titulo="'Instrument Serif'", rotulo="'Barlow'"),
    "entardecer": dict(bg="#241A33", glow="#3D2440", cor="#C98A8F", funda="#4A3352", destaque="#FF6B5A",
                       texto="#FBF1EA", sec="#B9A4B4", fonte_leg="'Instrument Serif'", peso_leg=400, caixa="none",
                       titulo="'Instrument Serif'", rotulo="'Barlow'"),
    "alternativa": dict(bg="#EFE6D2", glow="#E2D6BC", cor="#8E9A8B", funda="#6E7A6B", destaque="#6B1F2A",
                        texto="#2A2522", sec="#6B6359", fonte_leg="'Playfair Display'", peso_leg=500, caixa="none",
                        titulo="'Cinzel'", rotulo="'Barlow'"),
}
PALETAS_DIA = ["noite", "dossie", "ouro", "entardecer", "alternativa"]


def paleta_de(r: dict, slug: str) -> str:
    """Paleta do roteiro se válida; senão uma fixa por slug (estável entre refações)."""
    if r.get("paleta") in PALETAS:
        return r["paleta"]
    return PALETAS_DIA[sum(map(ord, slug)) % len(PALETAS_DIA)]


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


VERDE, VERMELHO = "#22C55E", "#EF4444"   # alta e baixa (bolsa, investimentos)
TELAS = {"celular": (306, 576), "tv": (868, 488), "computador": (832, 446), "nenhuma": (860, 520)}


def grafico_svg(g: dict, i: int, s0: float, w: int, h: int) -> tuple[str, list[str]]:
    """SVG do gráfico (pizza, linha, barras ou velas) + tweens que o desenham."""
    tipo, dados = g.get("tipo", "barras"), [float(x) for x in g.get("dados", [])]
    rot = [str(x) for x in g.get("rotulos", [])]
    merc = g.get("mercado", False)
    top, bot, lx = (96 if w < 400 else 80), 56, 30
    ch, cw = h - top - bot, w - 2 * lx
    tw, out = [], []
    hi = "var(--hi)"
    if tipo == "pizza":
        cx, cy, r = w / 2, top + ch / 2, min(cw, ch) / 2 * 0.46
        circ, acc, tot = 2 * 3.14159 * r, 0.0, sum(dados) or 1
        cores = [hi, "var(--tx)", "var(--sec)", "var(--cor)", "#E8B21A", "#8C7B5E"]
        for k, v in enumerate(dados):
            frac = v / tot
            out.append(f'<circle id="pz{i}_{k}" cx="{cx}" cy="{cy}" r="{r:.1f}" fill="none" style="stroke:{cores[k % len(cores)]}" stroke-width="{2 * r:.1f}" '
                       f'stroke-dasharray="0 {circ:.1f}" transform="rotate({-90 + acc * 360:.1f} {cx} {cy})"/>')
            tw.append(f'tl.to("#pz{i}_{k}",{{attr:{{"stroke-dasharray":"{frac * circ:.1f} {circ:.1f}"}},duration:.5,ease:"power2.out"}},{s0 + 0.3 + k * 0.35:.3f});')
            if k < len(rot):
                ang = (acc + frac / 2) * 6.28318 - 1.5708
                tx, ty = cx + (r * 2.3) * math.cos(ang), cy + (r * 2.3) * math.sin(ang) + 10
                out.append(f'<text id="pl{i}_{k}" x="{tx:.0f}" y="{ty:.0f}" text-anchor="middle" font-family="Barlow" font-size="{22 if w < 400 else 30}" fill="#E8E9EE" opacity="0">{html.escape(rot[k])} {v:g}%</text>')
                tw.append(f'tl.to("#pl{i}_{k}",{{opacity:1,duration:.3}},{s0 + 0.6 + k * 0.35:.3f});')
            acc += frac
        return "".join(out), tw
    lo, hi_v = min(dados + [0]) if tipo == "barras" else min(dados), max(dados)
    span = (hi_v - lo) or 1
    y = lambda v: top + ch - (v - lo) / span * ch
    if tipo == "linha":
        n = len(dados)
        pts = " ".join(f"{lx + k * cw / max(1, n - 1):.1f},{y(v):.1f}" for k, v in enumerate(dados))
        cor = (VERDE if dados[-1] >= dados[0] else VERMELHO) if merc else hi
        ln = sum(((cw / max(1, n - 1)) ** 2 + (y(dados[k + 1]) - y(dados[k])) ** 2) ** .5 for k in range(n - 1)) + 10
        out.append(f'<polyline id="ln{i}" points="{pts}" fill="none" style="stroke:{cor}" stroke-width="{5 if w < 400 else 7}" stroke-linejoin="round" '
                   f'stroke-dasharray="{ln:.0f}" stroke-dashoffset="{ln:.0f}"/>')
        ex, ey = lx + cw, y(dados[-1])
        out.append(f'<circle id="lp{i}" cx="{ex:.0f}" cy="{ey:.0f}" r="10" style="fill:{cor}" opacity="0"/>')
        if rot:
            out.append(f'<text id="lv{i}" x="{ex - 6:.0f}" y="{ey - 22:.0f}" text-anchor="end" font-family="Barlow" font-size="{26 if w < 400 else 36}" style="fill:{cor}" opacity="0">{html.escape(rot[-1])}</text>')
            tw.append(f'tl.to("#lv{i}",{{opacity:1,duration:.3}},{s0 + 1.6:.3f});')
        tw.append(f'tl.to("#ln{i}",{{attr:{{"stroke-dashoffset":0}},duration:1.4,ease:"power1.inOut"}},{s0 + 0.25:.3f});')
        tw.append(f'tl.to("#lp{i}",{{opacity:1,duration:.2}},{s0 + 1.6:.3f});')
        return "".join(out), tw
    if tipo == "velas":   # candles: verde sobe, vermelho cai
        n = len(dados) - 1
        bw = cw / max(1, n) * 0.55
        for k in range(n):
            a, b = dados[k], dados[k + 1]
            cor = VERDE if b >= a else VERMELHO
            x = lx + (k + 0.5) * cw / n
            y1, y2 = y(max(a, b)), y(min(a, b))
            out.append(f'<g id="cv{i}_{k}" opacity="0"><line x1="{x:.0f}" x2="{x:.0f}" y1="{y1 - 14:.0f}" y2="{y2 + 14:.0f}" stroke="{cor}" stroke-width="3"/>'
                       f'<rect x="{x - bw / 2:.0f}" y="{y1:.0f}" width="{bw:.0f}" height="{max(4, y2 - y1):.0f}" fill="{cor}"/></g>')
            tw.append(f'tl.to("#cv{i}_{k}",{{opacity:1,duration:.15}},{s0 + 0.25 + k * 0.12:.3f});')
        return "".join(out), tw
    # barras
    n = len(dados)
    bw = cw / max(1, n) * 0.62
    for k, v in enumerate(dados):
        cor = ((VERDE if k == 0 or v >= dados[k - 1] else VERMELHO) if merc else (hi if k == n - 1 else "var(--sec)"))
        x, yt = lx + (k + 0.19) * cw / n, y(v)
        out.append(f'<rect id="br{i}_{k}" x="{x:.0f}" y="{yt:.0f}" width="{bw:.0f}" height="{top + ch - yt:.0f}" style="fill:{cor}"/>')
        if k < len(rot):
            out.append(f'<text x="{x + bw / 2:.0f}" y="{top + ch + 34:.0f}" text-anchor="middle" font-family="Barlow" font-size="{18 if w < 400 else 24}" fill="#A7A9B2">{html.escape(rot[k])}</text>')
        tw.append(f'tl.fromTo("#br{i}_{k}",{{scaleY:0,transformOrigin:"50% 100%"}},{{scaleY:1,duration:.5,ease:"back.out(1.4)"}},{s0 + 0.25 + k * 0.14:.3f});')
    return "".join(out), tw


def camadas(c: dict, i: int, s0: float, d: float) -> tuple[str, list[str]]:
    """Camadas 2D no meio da tela: gráfico (em celular, TV ou computador), recibo, letreiro e carimbo."""
    parts, tw = [], []
    g = c.get("grafico")
    if g:
        tela = g.get("tela", "nenhuma")
        w, h = TELAS.get(tela, TELAS["nenhuma"])
        svg, t2 = grafico_svg(g, i, s0, w, h)
        tit = f'<div class="gt">{html.escape(g.get("titulo", ""))}</div>' if g.get("titulo") else ""
        dim = f' style="width:{w}px;height:{h}px"' if tela == "nenhuma" else ""
        corpo = f'<div id="gr{i}" class="tela {tela}"{dim}>{tit}<svg viewBox="0 0 {w} {h}" width="{w}" height="{h}">{svg}</svg></div>'
        if tela in ("tv", "computador"):
            corpo = f'<div style="position:relative">{corpo}<div class="pe"></div></div>'
        parts.append(corpo)
        tw += [f'tl.fromTo("#gr{i}",{{opacity:0,y:60,scale:.9}},{{opacity:1,y:0,scale:1,duration:.4,ease:"power3.out"}},{s0:.3f});'] + t2
    rc = c.get("recibo")
    if rc:
        linhas = "".join(f'<div class="li" id="rl{i}_{k}"><span>{html.escape(str(a))}</span><span>{html.escape(str(b))}</span></div>'
                         for k, (a, b) in enumerate(rc.get("itens", [])))
        parts.append(f'<div id="rc{i}" class="papel recibo">{linhas}<div class="tot" id="rt{i}">{html.escape(rc.get("total", ""))}</div>'
                     f'<div class="ty">{html.escape(rc.get("rodape", "THANK YOU"))}</div></div>')
        tw.append(f'tl.fromTo("#rc{i}",{{clipPath:"inset(0 0 100% 0)"}},{{clipPath:"inset(0 0 0% 0)",duration:{min(1.8, d * 0.6):.2f},ease:"steps(14)"}},{s0 + 0.1:.3f});')
        tw.append(f'tl.fromTo("#rt{i}",{{scale:1.25,opacity:0}},{{scale:1,opacity:1,duration:.3,ease:"back.out(2)"}},{s0 + min(1.8, d * 0.6):.3f});')
    lt = c.get("letreiro")
    if lt:
        txt = str(lt)[:9].upper()
        cel = "".join(f'<div class="fc" id="fc{i}_{k}">{html.escape(ch)}</div>' for k, ch in enumerate(txt))
        parts.append(f'<div class="flap" id="fl{i}">{cel}</div>')
        tw.append(f'tl.fromTo("#fl{i}",{{opacity:0,y:40}},{{opacity:1,y:0,duration:.3}},{s0:.3f});')
        for k, ch in enumerate(txt):   # gira por letras até parar na certa
            tw.append(f'flap("#fc{i}_{k}","{ch}",{s0 + 0.2 + k * 0.12:.3f},{0.5 + k * 0.08:.2f});')
    cb = c.get("carimbo")
    if cb:
        parts.append(f'<div class="carimbo" id="cb{i}">{html.escape(str(cb).upper())}</div>')
        tw.append(f'tl.fromTo("#cb{i}",{{opacity:0,scale:2.4,xPercent:-50,yPercent:-50,rotation:-14}},{{opacity:.92,scale:1,xPercent:-50,yPercent:-50,rotation:-12,duration:.18,ease:"power4.in"}},{s0 + min(1.2, d * 0.5):.3f});')
    if not parts:
        return "", []
    inner = parts[0] if len(parts) == 1 else f'<div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:24px">{"".join(parts)}</div>'
    return inner, tw


def build(proj: Path):
    r = json.loads((proj / "roteiro.json").read_text())
    dur = json.loads((proj / "voz" / "duracoes.json").read_text())["cenas"]
    if len(dur) != len(r["cenas"]):
        raise ValueError("duracoes.json não bate com o número de cenas")
    P = PALETAS[paleta_de(r, proj.name)]
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
            var = n.get("variacao")   # bolsa/investimento: "alta" verde ▲, "baixa" vermelho ▼
            seta = {"alta": "▲ ", "baixa": "▼ "}.get(var, "")
            inner = (f'<div class="num {var or ""}">{seta}<span id="n{i}v">{v_ini}</span>'
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
        if vis == "anel":   # gráfico redondo: no máximo 1 por vídeo (produzir.py confere)
            if True:
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
        # camadas 2D no meio da tela (gráfico em aparelho, recibo, letreiro, carimbo)
        meio, tw = camadas(c, i, s0, d)
        if meio:
            clip(f"mid{i}", s0, d, meio, cls="meio")
            tweens += tw
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
    doc = TEMPLATE.format(
        W=W, H=H, total=total, P=P, clips="\n      ".join(clips), tweens="\n      ".join(tweens),
        scenes=json.dumps(scene_data), rotas=json.dumps(ROTAS), reps=reps, loop=LOOP,
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
  @font-face {{ font-family: 'League Gothic'; src: url('assets/fonts/LeagueGothic.ttf'); }}
  @font-face {{ font-family: 'Oswald'; src: url('assets/fonts/Oswald.ttf'); font-weight: 200 700; }}
  @font-face {{ font-family: 'Cinzel'; src: url('assets/fonts/Cinzel.ttf'); font-weight: 400 900; }}
  @font-face {{ font-family: 'Instrument Serif'; src: url('assets/fonts/InstrumentSerif-Regular.ttf'); font-style: normal; }}
  @font-face {{ font-family: 'Instrument Serif'; src: url('assets/fonts/InstrumentSerif-Italic.ttf'); font-style: italic; }}
  @font-face {{ font-family: 'Barlow'; src: url('assets/fonts/Barlow-Light.ttf'); font-weight: 300; }}
  @font-face {{ font-family: 'Barlow'; src: url('assets/fonts/Barlow-Regular.ttf'); font-weight: 400; }}
  :root {{ --bg: {P[bg]}; --glow: {P[glow]}; --cor: {P[cor]}; --funda: {P[funda]}; --hi: {P[destaque]}; --tx: {P[texto]}; --sec: {P[sec]}; }}
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  html, body {{ width: {W}px; height: {H}px; overflow: hidden; background: var(--bg); }}
  #root {{ position: relative; width: {W}px; height: {H}px; overflow: hidden; background: var(--bg); font-family: {P[rotulo]}; font-weight: 300; color: var(--tx); }}
  #veu {{ position: absolute; inset: 0; pointer-events: none;
         background: linear-gradient(to bottom, var(--bg) 0%, transparent 34%, transparent 56%, var(--bg) 92%); opacity: .82; }}
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
  .num.alta {{ color: #22C55E; }}
  .num.baixa {{ color: #EF4444; }}
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
  .dialbox {{ position: absolute; left: 866px; top: 176px; width: 140px; height: 140px; display: flex; align-items: center; justify-content: center; }}
  .dialtxt {{ display: flex; flex-direction: column; align-items: center; line-height: 1; }}
  .dl {{ font-size: 16px; letter-spacing: .3em; color: var(--sec); font-weight: 400; }}
  .dn {{ margin-top: 4px; font-family: {P[titulo]}; font-size: 42px; color: var(--tx); }}
  .meio {{ position: absolute; left: 0; right: 0; top: 470px; height: 610px; display: flex; align-items: center; justify-content: center; }}
  .tela {{ position: relative; background: #0B0C10; box-shadow: 0 30px 80px rgba(0,0,0,.55); overflow: hidden; }}
  .tela.nenhuma {{ background: transparent; box-shadow: none; }}
  .tela.celular {{ width: 330px; height: 600px; border-radius: 48px; border: 12px solid #1C1D22; }}
  .tela.celular::before {{ content: ""; position: absolute; top: 10px; left: 50%; width: 90px; height: 22px; margin-left: -45px; border-radius: 12px; background: #1C1D22; z-index: 2; }}
  .tela.tv {{ width: 900px; height: 520px; border-radius: 10px; border: 16px solid #15161A; }}
  .tela.computador {{ width: 860px; height: 500px; border-radius: 14px; border: 14px solid #202127; border-bottom-width: 40px; }}
  .pe {{ position: absolute; left: 50%; width: 180px; height: 60px; margin-left: -90px; background: #202127; clip-path: polygon(30% 0, 70% 0, 100% 100%, 0 100%); }}
  .tela .gt {{ position: absolute; left: 26px; top: 22px; right: 26px; font-family: 'Barlow'; font-weight: 400; font-size: 24px; letter-spacing: .18em; color: #C9CBD3; }}
  .tela.celular .gt {{ top: 46px; font-size: 18px; }}
  .tela svg {{ position: absolute; left: 0; top: 0; }}
  .papel {{ background: #F3EFE6; color: #16130F; font-family: 'Courier New', monospace; box-shadow: 0 30px 80px rgba(0,0,0,.5); }}
  .recibo {{ width: 520px; padding: 36px 40px 30px; overflow: hidden; }}
  .recibo .li {{ display: flex; justify-content: space-between; font-size: 30px; line-height: 46px; }}
  .recibo .tot {{ margin-top: 18px; padding-top: 14px; border-top: 3px dashed #16130F; font-family: {P[titulo]}; font-size: 92px; line-height: 96px; text-align: center; }}
  .recibo .ty {{ font-size: 22px; letter-spacing: .3em; text-align: center; margin-top: 6px; }}
  .flap {{ display: flex; gap: 10px; padding: 22px; background: #121317; border-radius: 18px; box-shadow: 0 30px 80px rgba(0,0,0,.55); }}
  .flap .fc {{ width: 104px; height: 150px; border-radius: 10px; background: linear-gradient(#26272D 49%, #0D0E11 50%, #1E1F24 51%);
              color: #F3EFE6; font-family: 'League Gothic', 'Oswald', sans-serif; font-size: 128px; line-height: 150px; text-align: center; }}
  .carimbo {{ position: absolute; left: 50%; top: 50%; padding: 10px 34px; border: 8px solid #D7261E; border-radius: 12px; color: #D7261E;
             font-family: 'Barlow'; font-weight: 400; font-size: 76px; letter-spacing: .12em; white-space: nowrap; mix-blend-mode: multiply; }}
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
    <canvas id="gl" width="{W}" height="{H}" data-layout-ignore></canvas>
    <div id="veu"></div>
    <div id="rec"><div id="recdot"></div>REC</div>
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
    function flap(sel, ch, at, d) {{   // letreiro split-flap: troca letras até parar na certa
      const el = document.querySelector(sel), L = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$%"; const o = {{ v: 0 }};
      tl.fromTo(o, {{ v: 0 }}, {{ v: 1, duration: d, ease: "none", onUpdate: () => {{
        el.textContent = o.v >= 1 ? ch : L[Math.floor(o.v * 37 + ch.charCodeAt(0)) % L.length]; }} }}, at);
    }}
    tl.fromTo("#recdot", {{ opacity: 1 }}, {{ opacity: .15, duration: .5, ease: "steps(1)", repeat: {reps}, yoyo: true }}, 0);
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
