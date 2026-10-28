#!/usr/bin/env python3
"""Remove pauses (and, with faster-whisper, filler words like "um", "é…") from a video.

python3 tools/cut.py inbox/raw.mp4 -o out/nome/cut.mp4 [--keep-fillers] [--silence-db -35] [--min-silence 0.45]
"""
import argparse
from pathlib import Path
import re

from _common import FILLERS, duration, emit, has_audio, load_words, run

ap = argparse.ArgumentParser()
ap.add_argument("input")
ap.add_argument("-o", "--output", required=True)
ap.add_argument("--keep-fillers", action="store_true")
ap.add_argument("--silence-db", type=float, default=-35)
ap.add_argument("--min-silence", type=float, default=0.45)
ap.add_argument("--pad", type=float, default=0.08, help="seconds of air kept around speech")
ap.add_argument("--words-json", help="precomputed transcript (skips whisper)")
ap.add_argument("--model", default="small")
a = ap.parse_args()
Path(a.output).parent.mkdir(parents=True, exist_ok=True)

try:
    total = duration(a.input)
    cuts: list[tuple[float, float]] = []
    if has_audio(a.input):
        log = run(["ffmpeg", "-hide_banner", "-i", a.input, "-af", f"silencedetect=n={a.silence_db}dB:d={a.min_silence}", "-f", "null", "-"])
        starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", log)]
        ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", log)]
        for s, e in zip(starts, ends + [total] * (len(starts) - len(ends))):
            if e - s > 2 * a.pad:
                cuts.append((s + a.pad, e - a.pad))
    fillers = 0
    fillers_note = "kept" if a.keep_fillers else None
    if not a.keep_fillers:
        try:
            words = load_words(a.input, a.words_json, a.model)
            for w in words:
                if re.sub(r"[^\wé]", "", w["w"].lower()) in FILLERS:
                    cuts.append((w["s"], w["e"]))
                    fillers += 1
        except ImportError:
            fillers_note = "skipped (instale faster-whisper)"
    cuts.sort()
    keep, t = [], 0.0
    for s, e in cuts:
        if s > t:
            keep.append((t, s))
        t = max(t, e)
    if t < total:
        keep.append((t, total))
    keep = [(s, e) for s, e in keep if e - s > 0.05]
    expr = "+".join(f"between(t,{s:.3f},{e:.3f})" for s, e in keep)
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", a.input,
           "-vf", f"select='{expr}',setpts=N/FRAME_RATE/TB"]
    if has_audio(a.input):
        cmd += ["-af", f"aselect='{expr}',asetpts=N/SR/TB"]
    run(cmd + ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", a.output])
    emit("cut", input_s=round(total, 2), output_s=round(duration(a.output), 2), pauses=len(cuts) - fillers,
         fillers=fillers if fillers_note is None else fillers_note, output=a.output)
except Exception as e:  # noqa: BLE001
    emit("cut", ok=False, error=str(e))
