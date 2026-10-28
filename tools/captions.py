#!/usr/bin/env python3
"""Word-by-word burned captions (faster-whisper, local) with the active word highlighted in yellow.

python3 tools/captions.py out/nome/vertical.mp4 -o out/nome/captions.mp4 [--replace "Post=Posts"] [--words 3]
"""
import argparse
import json
from pathlib import Path

from _common import emit, load_words, run

ap = argparse.ArgumentParser()
ap.add_argument("input")
ap.add_argument("-o", "--output", required=True)
ap.add_argument("--replace", action="append", default=[], help='fix a word: "Errado=Certo" (repeatable)')
ap.add_argument("--words", type=int, default=3, help="words per caption")
ap.add_argument("--words-json", help="precomputed transcript (skips whisper)")
ap.add_argument("--model", default="small")
ap.add_argument("--font-size", type=int, default=92)
a = ap.parse_args()
Path(a.output).parent.mkdir(parents=True, exist_ok=True)

YELLOW, WHITE = "&H0033D6FF", "&H00FFFFFF"  # ASS is BGR


def ts(t: float) -> str:
    h, r = divmod(max(0.0, t), 3600)
    m, s = divmod(r, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


try:
    words = load_words(a.input, a.words_json, a.model)
    fixes = dict(r.split("=", 1) for r in a.replace)
    for w in words:
        core = w["w"].strip(".,!?")
        if core in fixes:
            w["w"] = w["w"].replace(core, fixes[core])
    groups = [words[i:i + a.words] for i in range(0, len(words), a.words)]
    lines = []
    for g in groups:
        for j, w in enumerate(g):
            end = g[j + 1]["s"] if j + 1 < len(g) else w["e"]
            text = " ".join(
                (f"{{\\c{YELLOW}\\fscx108\\fscy108}}{x['w'].upper()}{{\\c{WHITE}\\fscx100\\fscy100}}" if k == j else x["w"].upper())
                for k, x in enumerate(g)
            )
            lines.append(f"Dialogue: 0,{ts(w['s'])},{ts(end)},Cap,,0,0,0,,{text}")
    ass = Path(a.output).with_suffix(".ass")
    ass.write_text(
        "[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\n\n[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Cap,Inter,{a.font_size},{WHITE},{WHITE},&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,6,2,2,90,90,560,1\n\n"
        "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n" + "\n".join(lines) + "\n"
    )
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", a.input, "-vf", f"ass={ass}",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "copy", a.output])
    emit("captions", words=len(words), captions=len(groups), replaced=len(fixes), output=a.output)
except ImportError:
    emit("captions", ok=False, error="faster-whisper não instalado: pip install faster-whisper (ou use --words-json)")
except Exception as e:  # noqa: BLE001
    hint = " (falha ao baixar o modelo do Whisper: confira a internet/acesso a huggingface.co)" if "403" in str(e) or "huggingface" in str(e).lower() else ""
    emit("captions", ok=False, error=str(e) + hint)
