#!/usr/bin/env python3
"""Trilha original sintetizada (numpy) + mix com a narração + master -14 LUFS / TP -1.

python3 tools/worldframe/trilha.py out/<proj>            # usa roteiro.json, voz/, timeline.json -> audio/mix.wav
Sem música de terceiros: drone, pulso/arpejo e efeitos (whoosh, impacto, tique) gerados aqui.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
from _common import emit  # noqa: E402

SR = 48000
RNG = np.random.default_rng(7)  # semente fixa: a trilha é sempre igual para o mesmo roteiro


def env(n, a=0.005, r=0.2):
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    e[:na] = np.linspace(0, 1, na)
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def lowpass(x, cutoff):
    from scipy.signal import butter, sosfilt
    return sosfilt(butter(2, cutoff, btype="low", fs=SR, output="sos"), x)


def bandpass(x, lo, hi):
    from scipy.signal import butter, sosfilt
    return sosfilt(butter(2, [lo, hi], btype="band", fs=SR, output="sos"), x)


def drone(total, root, mood):
    t = np.arange(int(total * SR)) / SR
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * t / 9.0)
    ratios = [1, 1.5, 2, 2.4] if mood == "tenso" else [1, 1.5, 2, 3]
    x = sum(np.sin(2 * np.pi * root * r * t + r) * (0.5 / (i + 1)) for i, r in enumerate(ratios))
    x += 0.15 * np.sin(2 * np.pi * root * 0.5 * t)  # sub
    noise = lowpass(RNG.standard_normal(len(t)), 400) * 0.05
    return (x * (0.6 + 0.4 * lfo) + noise) * 0.35


def pulso(total, root, bpm):
    """Arpejo pentatônico menor em colcheias, com filtro abrindo devagar."""
    out = np.zeros(int(total * SR))
    step = 60 / bpm / 2
    scale = [1, 6 / 5, 4 / 3, 3 / 2, 9 / 5, 2]
    pattern = [0, 2, 4, 2, 5, 3, 1, 3]
    n = int(total / step)
    for k in range(n):
        f = root * 2 * scale[pattern[k % len(pattern)]]
        dur = step * 0.9
        tt = np.arange(int(dur * SR)) / SR
        note = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(4 * np.pi * f * tt)) * np.exp(-tt * 9)
        i = int(k * step * SR)
        out[i:i + len(note)] += note[: len(out) - i] * (0.55 + 0.45 * (k % 2 == 0))
    return lowpass(out, 2600) * 0.22


def whoosh(d=0.55):
    n = int(d * SR)
    x = RNG.standard_normal(n)
    sweep = np.linspace(0, 1, n)
    y = np.zeros(n)
    for j, (lo, hi) in enumerate([(300, 900), (900, 2500), (2500, 6000)]):
        y += bandpass(x, lo, hi) * np.clip(1 - abs(sweep - (0.25 + 0.25 * j)) * 3, 0, 1)
    return y * env(n, 0.05, 0.25) * 0.25


def impacto():
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * (55 + 60 * np.exp(-t * 18)) * t) * np.exp(-t * 4.5)
    click = lowpass(RNG.standard_normal(n), 3000) * np.exp(-t * 40) * 0.5
    return (boom + click) * 0.6


def tique():
    n = int(0.04 * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * 2200 * t) * np.exp(-t * 120) * 0.12


def add(buf, clip, at):
    i = int(at * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(clip))
    buf[i:j] += clip[: j - i]


try:
    proj = Path(sys.argv[1])
    r = json.loads((proj / "roteiro.json").read_text())
    tl = json.loads((proj / "timeline.json").read_text())
    total = tl["total"]
    mood = "tenso" if r.get("paleta") == "alternativa" else "tech"
    root = 55.0 if mood == "tenso" else 65.41  # A1 / C2

    # narração na timeline
    voz = np.zeros(int(total * SR))
    for i, c in enumerate(tl["cenas"]):
        v, sr = sf.read(proj / "voz" / f"cena_{i:02d}.wav", dtype="float32")
        if sr != SR:
            from scipy.signal import resample_poly
            v = resample_poly(v, SR, sr)
        add(voz, v, c["inicio"])

    musica = drone(total, root, mood) + pulso(total, root, 112 if mood == "tech" else 92)
    sfx = np.zeros_like(voz)
    for i, c in enumerate(tl["cenas"]):
        if i:
            add(sfx, whoosh(), max(0, c["inicio"] - 0.3))
        cena = r["cenas"][i]
        if cena.get("numero") and cena["numero"]["ate"] != cena["numero"]["de"]:
            n_ticks = 10
            for k in range(n_ticks):
                add(sfx, tique(), c["inicio"] + 0.25 + k * 0.08)
            add(sfx, impacto(), c["inicio"] + 0.25 + n_ticks * 0.08)
    add(sfx, impacto(), tl["final"]["inicio"])

    # ducking: a música abaixa ~9 dB sob a voz (envelope suavizado da voz)
    from scipy.ndimage import uniform_filter1d
    lvl = uniform_filter1d(np.abs(voz), size=int(0.12 * SR))
    duck = 1 - 0.65 * np.clip(lvl / (lvl.max() * 0.25 + 1e-9), 0, 1)
    duck = uniform_filter1d(duck, size=int(0.25 * SR))
    # fade de entrada curto e saída que emenda no loop
    fade = env(len(voz), 0.02, 0.6)
    mix = voz * 1.0 + musica * duck * fade + sfx
    mix = np.stack([mix, mix], 1) / max(1e-6, np.abs(mix).max()) * 0.9
    out = proj / "audio"
    out.mkdir(exist_ok=True)
    sf.write(out / "premaster.wav", mix.astype("float32"), SR)
    # master: loudnorm em 2 passagens (-14 LUFS integrado, true peak -1 dB)
    meas = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(out / "premaster.wav"), "-af",
                           "loudnorm=I=-14:TP=-1:LRA=11:print_format=json", "-f", "null", "-"],
                          capture_output=True, text=True).stderr
    m = json.loads(meas[meas.rindex("{"): meas.rindex("}") + 1])
    af = (f"loudnorm=I=-14:TP=-1:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(out / "premaster.wav"),
                    "-af", af, "-ar", str(SR), str(out / "mix.wav")], check=True)
    chk = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(out / "mix.wav"), "-af",
                          "loudnorm=I=-14:TP=-1:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
    c = json.loads(chk[chk.rindex("{"): chk.rindex("}") + 1])
    emit("trilha", segundos=round(total, 2), lufs=float(c["input_i"]), true_peak=float(c["input_tp"]), saida=str(out / "mix.wav"))
except Exception as e:  # noqa: BLE001
    emit("trilha", ok=False, error=str(e))
