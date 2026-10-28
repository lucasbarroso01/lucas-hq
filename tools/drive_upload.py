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
import os
import shutil
from pathlib import Path

from _common import emit

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
ap.add_argument("--time", help="HH:MM")
ap.add_argument("--date", default=dt.date.today().isoformat())
ap.add_argument("--name", help="file name in Drive (default: video name)")
ap.add_argument("--dry-run", action="store_true")
a = ap.parse_args()
if not a.login and not (a.video and a.page and a.caption and a.time):
    ap.error("video, --page, --caption e --time são obrigatórios (ou use --login)")


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


try:
    if not Path(a.video).exists():
        raise FileNotFoundError(a.video)
    sa = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    use_oauth = OAUTH_CLIENT.exists() or TOKEN.exists()
    if a.dry_run or not (use_oauth or sa):
        dst = Path("out/_drive").joinpath(*parts)
        dst.mkdir(parents=True, exist_ok=True)
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
        vid = svc.files().create(body={"name": name, "parents": [parent]}, media_body=MediaFileUpload(a.video, resumable=True),
                                 fields="id,webViewLink", supportsAllDrives=True).execute()
        svc.files().create(body={"name": Path(name).with_suffix(".txt").name, "parents": [parent]},
                           media_body=MediaInMemoryUpload(txt.encode(), mimetype="text/plain"), fields="id", supportsAllDrives=True).execute()
        emit("drive_upload", mode="oauth" if use_oauth else "service_account", path="/".join(parts), file=name, url=vid["webViewLink"], post_time=a.time)
except Exception as e:  # noqa: BLE001
    emit("drive_upload", ok=False, error=str(e))
