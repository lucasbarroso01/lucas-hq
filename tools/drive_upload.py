#!/usr/bin/env python3
"""Upload MP4 + .txt (caption, hashtags, post time) into the day's Drive folder.

python3 tools/drive_upload.py out/nome/edit.mp4 --page Worldframe --caption "..." --hashtags "#a #b" --time 18:00 [--date 2026-10-28] [--dry-run]

Drive path: Central de Conteúdo — Lucas/01 Máquina Viral/<Página>/AAAA-MM-DD
Needs GOOGLE_APPLICATION_CREDENTIALS (service account with access to the folder) and google-api-python-client.
Without them (or with --dry-run) files are staged in out/_drive/<path> and the JSON says so.
"""
import argparse
import datetime as dt
import os
import shutil
from pathlib import Path

from _common import emit

ROOT = "Central de Conteúdo — Lucas"
ap = argparse.ArgumentParser()
ap.add_argument("video")
ap.add_argument("--page", required=True, choices=["Worldframe", "Funny Pets"])
ap.add_argument("--caption", required=True)
ap.add_argument("--hashtags", default="")
ap.add_argument("--time", required=True, help="HH:MM")
ap.add_argument("--date", default=dt.date.today().isoformat())
ap.add_argument("--name", help="file name in Drive (default: video name)")
ap.add_argument("--dry-run", action="store_true")
a = ap.parse_args()

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
    creds = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if a.dry_run or not creds:
        dst = Path("out/_drive").joinpath(*parts)
        dst.mkdir(parents=True, exist_ok=True)
        shutil.copy(a.video, dst / name)
        (dst / Path(name).with_suffix(".txt")).write_text(txt)
        emit("drive_upload", mode="staged", path="/".join(parts), file=name, local=str(dst), post_time=a.time)
    else:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaFileUpload, MediaInMemoryUpload

        svc = build("drive", "v3", credentials=service_account.Credentials.from_service_account_file(creds, scopes=["https://www.googleapis.com/auth/drive"]))
        parent = None
        for p in parts:
            parent = folder(svc, parent, p)
        vid = svc.files().create(body={"name": name, "parents": [parent]}, media_body=MediaFileUpload(a.video, resumable=True),
                                 fields="id,webViewLink", supportsAllDrives=True).execute()
        svc.files().create(body={"name": Path(name).with_suffix(".txt").name, "parents": [parent]},
                           media_body=MediaInMemoryUpload(txt.encode(), mimetype="text/plain"), fields="id", supportsAllDrives=True).execute()
        emit("drive_upload", mode="drive", path="/".join(parts), file=name, url=vid["webViewLink"], post_time=a.time)
except Exception as e:  # noqa: BLE001
    emit("drive_upload", ok=False, error=str(e))
