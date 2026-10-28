#!/usr/bin/env python3
"""Pick the sharpest frame and stamp up to 3 bold words on it.

python3 tools/thumbnail.py out/nome/edit.mp4 --text "CIDADE SOB ÁGUA" -o out/nome/capa.jpg [--at 3.2] [--pos top|middle|bottom]
"""
import argparse
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageStat

from _common import BOLD_FONT, duration, emit, run

ap = argparse.ArgumentParser()
ap.add_argument("input")
ap.add_argument("-o", "--output", required=True)
ap.add_argument("--text", required=True)
ap.add_argument("--at", type=float, help="use the frame at this second instead of the sharpest")
ap.add_argument("--pos", choices=["top", "middle", "bottom"], default="top")
ap.add_argument("--samples", type=int, default=12)
a = ap.parse_args()
Path(a.output).parent.mkdir(parents=True, exist_ok=True)


def grab(t: float, dst: Path) -> Path:
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-ss", f"{t:.2f}", "-i", a.input, "-frames:v", "1", str(dst)])
    return dst


try:
    words = a.text.split()
    if len(words) > 3:
        raise ValueError("máximo de 3 palavras na capa")
    with tempfile.TemporaryDirectory() as tmp:
        if a.at is not None:
            t, frame = a.at, grab(a.at, Path(tmp) / "f.png")
        else:
            d = duration(a.input)
            best = (-1.0, 0.0, None)
            for i in range(a.samples):
                t = d * (i + 0.5) / a.samples
                f = grab(t, Path(tmp) / f"f{i}.png")
                sharp = ImageStat.Stat(Image.open(f).convert("L").filter(ImageFilter.FIND_EDGES)).var[0]
                if sharp > best[0]:
                    best = (sharp, t, f)
            _, t, frame = best
        img = Image.open(frame).convert("RGB")
    W, H = img.size
    draw = ImageDraw.Draw(img)
    size = int(W * 0.15)
    font = ImageFont.truetype(BOLD_FONT, size) if BOLD_FONT else ImageFont.load_default()
    y0 = {"top": H * 0.12, "middle": H * 0.5 - size * len(words) * 0.55, "bottom": H * 0.72 - size * len(words) * 0.55}[a.pos]
    for i, w in enumerate(words):
        w = w.upper()
        box = draw.textbbox((0, 0), w, font=font, stroke_width=10)
        x, y = (W - (box[2] - box[0])) / 2, y0 + i * size * 1.1
        draw.text((x, y), w, font=font, fill="#FFD633" if i == len(words) - 1 else "white", stroke_width=10, stroke_fill="black")
    img.save(a.output, quality=92)
    emit("thumbnail", at=round(t, 2), pos=a.pos, words=len(words), output=a.output)
except Exception as e:  # noqa: BLE001
    emit("thumbnail", ok=False, error=str(e))
