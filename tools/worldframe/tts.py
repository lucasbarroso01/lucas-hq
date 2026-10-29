#!/usr/bin/env python3
"""Narração offline com Kokoro (kokoro-onnx, modelo v1.0): um WAV por cena.

python3 tools/worldframe/tts.py --teste out/_voz_teste.wav
python3 tools/worldframe/tts.py out/<proj>/roteiro.json out/<proj>/voz     # -> voz/cena_NN.wav + voz/duracoes.json
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
from _common import emit  # noqa: E402

MODEL = ROOT / "models" / "kokoro-v1.0.onnx"
VOICES = ROOT / "models" / "voices-v1.0.bin"
PAUSA = 0.30  # respiro no fim de cada cena (s)


def kokoro():
    from kokoro_onnx import Kokoro
    return Kokoro(str(MODEL), str(VOICES))


def falar(k, texto: str, voz: str, speed: float):
    import numpy as np
    samples, sr = k.create(texto, voice=voz, speed=speed, lang="en-us")
    samples = np.asarray(samples, dtype="float32")
    # corta silêncio das pontas, deixa um respiro no fim
    thr = 0.01 * float(np.max(np.abs(samples)) or 1)
    idx = np.where(np.abs(samples) > thr)[0]
    if len(idx):
        samples = samples[max(0, idx[0] - int(0.02 * sr)): idx[-1] + int(0.04 * sr)]
    samples = np.concatenate([samples, np.zeros(int(PAUSA * sr), dtype="float32")])
    return samples, sr


ap = argparse.ArgumentParser()
ap.add_argument("roteiro", nargs="?")
ap.add_argument("saida", nargs="?")
ap.add_argument("--teste", metavar="WAV", help="gera 1 frase de teste com am_michael")
a = ap.parse_args()

try:
    import soundfile as sf
    k = kokoro()
    if a.teste:
        s, sr = falar(k, "Worldframe. Understand the world in sixty seconds.", "am_michael", 1.1)
        Path(a.teste).parent.mkdir(parents=True, exist_ok=True)
        sf.write(a.teste, s, sr)
        emit("tts", teste=a.teste, segundos=round(len(s) / sr, 2))
        raise SystemExit
    r = json.loads(Path(a.roteiro).read_text())
    out = Path(a.saida)
    out.mkdir(parents=True, exist_ok=True)
    voz, speed = r.get("voz", "am_michael"), float(r.get("velocidade", 1.1))
    dur = []
    for i, c in enumerate(r["cenas"]):
        s, sr = falar(k, c["fala"], voz, speed)
        sf.write(out / f"cena_{i:02d}.wav", s, sr)
        dur.append(round(len(s) / sr, 3))
    (out / "duracoes.json").write_text(json.dumps({"sr": sr, "cenas": dur}, indent=1))
    emit("tts", voz=voz, cenas=len(dur), segundos=round(sum(dur), 2), saida=str(out))
except SystemExit:
    raise
except Exception as e:  # noqa: BLE001
    emit("tts", ok=False, error=str(e))
