"""Shared helpers for the deterministic tools. Every tool prints exactly one JSON line."""
import json
import subprocess
import sys
from pathlib import Path

FILLERS = {"um", "uh", "é", "éé", "ééé", "hum", "hã", "tipo", "né", "ahn", "eh"}


def emit(tool: str, ok: bool = True, **data) -> None:
    print(json.dumps({"tool": tool, "ok": ok, **data}, ensure_ascii=False))
    if not ok:
        sys.exit(1)


def run(cmd: list[str]) -> str:
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.strip().splitlines()[-1] if p.stderr.strip() else f"exit {p.returncode}")
    return p.stdout + p.stderr


def duration(path: str | Path) -> float:
    out = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)])
    return float(out.strip().splitlines()[0])


def has_audio(path: str | Path) -> bool:
    out = run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", str(path)])
    return bool(out.strip())


def transcribe(path: str | Path, model: str = "small") -> list[dict]:
    """Word-level transcript with faster-whisper: [{"w": str, "s": float, "e": float}]."""
    from faster_whisper import WhisperModel  # local, no API

    m = WhisperModel(model, device="auto", compute_type="int8")
    segments, _ = m.transcribe(str(path), language="pt", word_timestamps=True, vad_filter=True)
    return [{"w": w.word.strip(), "s": w.start, "e": w.end} for seg in segments for w in (seg.words or [])]


def load_words(path: str | Path, words_json: str | None, model: str) -> list[dict]:
    if words_json:
        return json.loads(Path(words_json).read_text())
    return transcribe(path, model)


BOLD_FONT = next(
    (str(p) for p in [
        Path("/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"),
        Path("/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
        Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
    ] if p.exists()),
    None,
)
