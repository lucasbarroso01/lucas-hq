#!/usr/bin/env python3
"""Contact sheet (frames.jpg) next to the video, for the QA agent to look at.

python3 tools/frames.py out/nome/edit.mp4 [--grid 3x3]
"""
import argparse
from pathlib import Path

from _common import duration, emit, run

ap = argparse.ArgumentParser()
ap.add_argument("input")
ap.add_argument("--grid", default="3x3")
ap.add_argument("-o", "--output")
a = ap.parse_args()

try:
    cols, rows = (int(x) for x in a.grid.split("x"))
    n = cols * rows
    out = a.output or str(Path(a.input).with_name("frames.jpg"))
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    fps = n / max(0.1, duration(a.input))
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", a.input,
         "-vf", f"fps={fps:.4f},scale=360:-2,drawtext=text='%{{pts\\:hms}}':x=10:y=10:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6,tile={cols}x{rows}:padding=6:margin=6",
         "-frames:v", "1", "-q:v", "3", out])
    emit("frames", frames=n, grid=a.grid, output=out)
except Exception as e:  # noqa: BLE001
    emit("frames", ok=False, error=str(e))
