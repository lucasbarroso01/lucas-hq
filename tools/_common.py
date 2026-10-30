"""Shared helpers for the deterministic tools. Every tool prints exactly one JSON line."""
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

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


# --- Supabase (service key, REST). Offline without keys: appends to out/_hq.log ---
# Sessions started outside iniciar.sh (e.g. `claude` typed by hand) don't source the env file: load it here.
_ENV_FILE = Path.home() / ".config/lucas-hq/env"
if "SUPABASE_URL" not in os.environ and _ENV_FILE.exists():
    for _line in _ENV_FILE.read_text().splitlines():
        _k, _, _v = _line.removeprefix("export ").partition("=")
        if _k.strip() and _v:
            os.environ.setdefault(_k.strip(), _v.strip().strip("'\""))
def _env(*names: str) -> str:
    """First non-empty var; tolerates values pasted as NAME=value."""
    for n in names:
        v = os.environ.get(n, "").strip()
        if "=" in v and not v.startswith("http") and not v.startswith("ey"):
            v = v.split("=", 1)[1].strip()
        if v:
            return v
    return ""


URL = _env("SUPABASE_URL", "VITE_SUPABASE_URL").rstrip("/").removesuffix("/rest/v1").rstrip("/")
URL = URL if URL.startswith("http") else None
KEY = _env("SUPABASE_SERVICE_KEY") or None
OP = {"inbox-b2b": "agencia-lucas", "criacao-b2b": "agencia-lucas"}


def rest(method: str, table: str, body=None, query: str = "", upsert: bool = False):
    if not (URL and KEY):
        (ROOT / "out").mkdir(exist_ok=True)
        with open(ROOT / "out" / "_hq.log", "a") as f:
            f.write(json.dumps({"ts": time.time(), "method": method, "table": table, "body": body, "query": query}, ensure_ascii=False) + "\n")
        return []
    headers = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json",
               "Prefer": "return=representation" + (",resolution=merge-duplicates" if upsert else "")}
    req = urllib.request.Request(f"{URL}/rest/v1/{table}{query}", method=method, headers=headers,
                                 data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            txt = r.read().decode()
            return json.loads(txt) if txt else []
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{e.code} {table}: {e.read().decode()[:200]}") from None




def pausa() -> tuple[bool, str]:
    """(pausado, motivo) do botão "Pausar operação". Sem Supabase ou sem a tabela: não pausado."""
    if not (URL and KEY):
        f = ROOT / "out" / "_pausa"
        return (True, f.read_text().strip()) if f.exists() else (False, "")
    try:
        rows = rest("GET", "controle", None, "?id=eq.operacao&select=pausado,motivo")
        return (bool(rows[0]["pausado"]), rows[0].get("motivo") or "") if rows else (False, "")
    except Exception:  # noqa: BLE001  (migração 0003 ainda não rodou)
        return (False, "")
