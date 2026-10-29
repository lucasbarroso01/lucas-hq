#!/usr/bin/env python3
"""Upload MP4 + .txt (caption, hashtags, post time) into the day's Drive folder.

python3 tools/drive_upload.py out/nome/edit.mp4 --page Worldframe --caption "..." --hashtags "#a #b" --time 18:00 [--date 2026-10-28] [--dry-run]

Drive path: Central de Conteúdo — Lucas/01 Máquina Viral/<Página>/AAAA-MM-DD
Auth, in this order:
  1. OAuth with your own Google account (personal Gmail): OAuth client JSON at $GDRIVE_OAUTH_CLIENT
     (default ~/.config/lucas-hq/oauth-client.json). Run once: python3 tools/drive_upload.py --login
     The token is kept at ~/.config/lucas-hq/drive-token.json.
  2. Service account via GOOGLE_APPLICATION_CREDENTIALS (only works with a Workspace shared drive).
Without either (or with --dry-run) files are staged in out/_drive/<path> and the JSON says so.
"""
import argparse
import datetime as dt
import json
import os
import shutil
import warnings
from pathlib import Path

from _common import emit

warnings.filterwarnings("ignore", category=FutureWarning)  # google libs nag about Python versions

ROOT = "Central de Conteúdo — Lucas"
SCOPES = ["https://www.googleapis.com/auth/drive"]
CONF = Path.home() / ".config" / "lucas-hq"
OAUTH_CLIENT = Path(os.environ.get("GDRIVE_OAUTH_CLIENT", CONF / "oauth-client.json")).expanduser()
TOKEN = CONF / "drive-token.json"

ap = argparse.ArgumentParser()
ap.add_argument("video", nargs="?")
ap.add_argument("--login", action="store_true", help="authorize your Google account once (opens the browser)")
ap.add_argument("--page", choices=["Worldframe", "Funny Pets"])
ap.add_argument("--caption")
ap.add_argument("--hashtags", default="")
ap.add_argument("--time", default="a definir", help="HH:MM (pode ficar \"a definir\": o Social define depois)")
ap.add_argument("--date", default=dt.date.today().isoformat())
ap.add_argument("--name", help="file name in Drive (default: video name)")
ap.add_argument("--dry-run", action="store_true")
ap.add_argument("--txt-only", action="store_true", help="só atualiza a legenda/horário (.txt); o vídeo já está no Drive")
ap.add_argument("--task", help="task id: saves the Drive links on it so the office shows an \"Abrir no Drive\" button")
a = ap.parse_args()
if not a.login and not (a.video and a.page and a.caption):
    ap.error("video, --page e --caption são obrigatórios (ou use --login)")


def oauth_creds(interactive: bool):
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials

    creds = Credentials.from_authorized_user_file(str(TOKEN), SCOPES) if TOKEN.exists() else None
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    elif not (creds and creds.valid):
        if not interactive:
            raise RuntimeError("Drive não autorizado: rode python3 tools/drive_upload.py --login")
        from google_auth_oauthlib.flow import InstalledAppFlow

        creds = InstalledAppFlow.from_client_secrets_file(str(OAUTH_CLIENT), SCOPES).run_local_server(port=0)
    CONF.mkdir(parents=True, exist_ok=True)
    TOKEN.write_text(creds.to_json())
    TOKEN.chmod(0o600)
    return creds


if a.login:
    try:
        if not OAUTH_CLIENT.exists():
            raise FileNotFoundError(f"cliente OAuth não encontrado em {OAUTH_CLIENT}")
        oauth_creds(interactive=True)
        emit("drive_upload", mode="login", token=str(TOKEN))
    except Exception as e:  # noqa: BLE001
        emit("drive_upload", ok=False, error=str(e))
    raise SystemExit

parts = [ROOT, "01 Máquina Viral", a.page, a.date]
name = a.name or Path(a.video).name
txt = f"{a.caption}\n\n{a.hashtags}\n\nPostar: {a.date} {a.time}\n"


def folder(svc, parent, title):
    q = f"name = '{title}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    if parent:
        q += f" and '{parent}' in parents"
    hit = svc.files().list(q=q, fields="files(id)", supportsAllDrives=True, includeItemsFromAllDrives=True).execute()["files"]
    if hit:
        return hit[0]["id"]
    meta = {"name": title, "mimeType": "application/vnd.google-apps.folder", **({"parents": [parent]} if parent else {})}
    return svc.files().create(body=meta, fields="id", supportsAllDrives=True).execute()["id"]


def put(svc, parent, title, media):
    """Cria ou substitui (mesmo nome na mesma pasta): subir de novo nunca duplica."""
    q = f"name = '{title}' and '{parent}' in parents and trashed = false"
    hit = svc.files().list(q=q, fields="files(id)", supportsAllDrives=True, includeItemsFromAllDrives=True).execute()["files"]
    if hit:
        return svc.files().update(fileId=hit[0]["id"], media_body=media, fields="id,webViewLink", supportsAllDrives=True).execute()
    return svc.files().create(body={"name": title, "parents": [parent]}, media_body=media, fields="id,webViewLink",
                              supportsAllDrives=True).execute()


try:
    if not Path(a.video).exists():
        raise FileNotFoundError(a.video)
    sa = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    use_oauth = OAUTH_CLIENT.exists() or TOKEN.exists()
    if a.dry_run or not (use_oauth or sa):
        dst = Path("out/_drive").joinpath(*parts)
        dst.mkdir(parents=True, exist_ok=True)
        if not a.txt_only:
            shutil.copy(a.video, dst / name)
        (dst / Path(name).with_suffix(".txt")).write_text(txt)
        emit("drive_upload", mode="staged", path="/".join(parts), file=name, local=str(dst), post_time=a.time)
    else:
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaFileUpload, MediaInMemoryUpload

        if use_oauth:
            creds = oauth_creds(interactive=False)
        else:
            from google.oauth2 import service_account

            creds = service_account.Credentials.from_service_account_file(sa, scopes=SCOPES)
        svc = build("drive", "v3", credentials=creds)
        parent = None
        for p in parts:
            parent = folder(svc, parent, p)
        if a.txt_only:
            q = f"name = '{name}' and '{parent}' in parents and trashed = false"
            hit = svc.files().list(q=q, fields="files(id,webViewLink)", supportsAllDrives=True, includeItemsFromAllDrives=True).execute()["files"]
            if not hit:
                raise FileNotFoundError(f"{name} ainda não está no Drive: rode sem --txt-only")
            vid = hit[0]
        else:
            vid = put(svc, parent, name, MediaFileUpload(a.video, resumable=True))
        put(svc, parent, Path(name).with_suffix(".txt").name, MediaInMemoryUpload(txt.encode(), mimetype="text/plain"))
        folder_url = f"https://drive.google.com/drive/folders/{parent}"
        try:  # botão "Abrir Drive" do site: pasta raiz e pasta do dia mais recente
            from _common import KEY, URL, rest
            if URL and KEY:
                raiz = folder(svc, None, ROOT)
                rest("PATCH", "controle", {"drive_raiz": f"https://drive.google.com/drive/folders/{raiz}",
                                           "drive_dia": folder_url, "drive_dia_data": a.date}, "?id=eq.operacao")
        except Exception:  # noqa: BLE001  (migração 0004 ainda não rodou)
            pass
        if a.task:
            import subprocess
            import sys

            hq = Path(__file__).with_name("hq.py")
            subprocess.run([sys.executable, str(hq), "task", "--id", a.task, "--drive-url", vid["webViewLink"],
                            "--payload", json.dumps({"drive_folder": folder_url}), "--log", f"subiu {name} no Drive"],
                           capture_output=True, text=True)
        emit("drive_upload", mode="oauth" if use_oauth else "service_account", path="/".join(parts), file=name,
             url=vid["webViewLink"], folder_url=folder_url, post_time=a.time)
except Exception as e:  # noqa: BLE001
    emit("drive_upload", ok=False, error=str(e))
