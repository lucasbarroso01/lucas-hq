#!/usr/bin/env python3
"""Convert any video to vertical 1080x1920 (center crop, or blurred background with --fit).

python3 tools/reframe.py out/nome/cut.mp4 -o out/nome/vertical.mp4 [--fit]
"""
import argparse

from _common import emit, run

ap = argparse.ArgumentParser()
ap.add_argument("input")
ap.add_argument("-o", "--output", required=True)
ap.add_argument("--fit", action="store_true", help="keep the whole frame over a blurred copy instead of cropping")
a = ap.parse_args()

crop = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1"
fit = ("split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=30:5[bg];"
       "[b]scale=1080:1920:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1")
try:
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", a.input, "-filter_complex" if a.fit else "-vf", fit if a.fit else crop,
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "copy", a.output])
    emit("reframe", size="1080x1920", mode="fit" if a.fit else "crop", output=a.output)
except Exception as e:  # noqa: BLE001
    emit("reframe", ok=False, error=str(e))
