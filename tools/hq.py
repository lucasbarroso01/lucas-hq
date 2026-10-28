#!/usr/bin/env python3
"""Report agent state to Supabase so the office shows it live. Uses SUPABASE_URL + SUPABASE_SERVICE_KEY.
Without them it appends to out/_hq.log (offline/test mode) and still prints the JSON line.

python3 tools/hq.py task --id wf-2026-10-28-01 --team producao-wf --agent video-editor --title wf_01.mp4 --etapa LEGENDAS --progress 50 [--status running] [--parent wf-batch]
python3 tools/hq.py agent --id video-editor --status working --doing "legendando wf_01"
python3 tools/hq.py event --type brain_write --team radar --agent radar-worldframe --note "tema X já usado"
python3 tools/hq.py event --type handoff --team roteiros --to producao-wf --text "Roteiros · 5 ganchos prontos"
python3 tools/hq.py skill --team producao-wf --skill hypit-video --progress 40 --state running
python3 tools/hq.py schedule --date 2026-10-28 --page Worldframe --time 18:00 --title wf_04.mp4 --status pronto --task wf-...
python3 tools/hq.py approval --task t2 [--wait 0]   # prints the latest decision; --wait N polls up to N seconds
"""
import argparse
import json
import os
import time
import urllib.parse
import urllib.error
import urllib.request
from pathlib import Path

from _common import emit

def _env(*names: str) -> str:
    """First non-empty var; tolerates values pasted as NAME=value."""
    for n in names:
        v = os.environ.get(n, "").strip()
        if "=" in v and not v.startswith("http") and not v.startswith("ey"):
            v = v.split("=", 1)[1].strip()
        if v:
            return v
    return ""


URL = _env("SUPABASE_URL", "VITE_SUPABASE_URL").rstrip("/")
URL = URL if URL.startswith("http") else None
KEY = _env("SUPABASE_SERVICE_KEY") or None
OP = {"inbox-b2b": "agencia-lucas", "criacao-b2b": "agencia-lucas"}


def rest(method: str, table: str, body=None, query: str = "", upsert: bool = False):
    if not (URL and KEY):
        Path("out").mkdir(exist_ok=True)
        with open("out/_hq.log", "a") as f:
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


ap = argparse.ArgumentParser()
sub = ap.add_subparsers(dest="cmd", required=True)
t = sub.add_parser("task")
for k in ["id", "team", "agent", "title", "etapa", "status", "parent", "drive-url", "post-time"]:
    t.add_argument(f"--{k}")
t.add_argument("--progress", type=int)
t.add_argument("--qa-score", type=float)
t.add_argument("--payload", help="JSON")
g = sub.add_parser("agent")
g.add_argument("--id", required=True)
g.add_argument("--status", choices=["working", "idle"], required=True)
g.add_argument("--doing", default="")
e = sub.add_parser("event")
e.add_argument("--type", required=True, choices=["handoff", "brain_read", "brain_write", "tool_run", "toast"])
for k in ["team", "agent", "to", "text", "note", "tool"]:
    e.add_argument(f"--{k}")
s = sub.add_parser("skill")
s.add_argument("--team", required=True)
s.add_argument("--skill", required=True)
s.add_argument("--progress", type=int, default=0)
s.add_argument("--state", choices=["running", "idle"], default="running")
c = sub.add_parser("schedule")
for k in ["date", "page", "time", "title", "status", "task"]:
    c.add_argument(f"--{k}")
p = sub.add_parser("approval")
p.add_argument("--task", required=True)
p.add_argument("--wait", type=int, default=0)
a = ap.parse_args()

try:
    if a.cmd == "task":
        row = {k: v for k, v in {
            "id": a.id, "team_id": a.team, "agent_id": a.agent, "titulo": a.title, "etapa": a.etapa, "status": a.status,
            "progress": a.progress, "parent_id": a.parent, "drive_url": a.drive_url, "post_time": a.post_time, "qa_score": a.qa_score,
            "payload": json.loads(a.payload) if a.payload else None,
            "operacao": OP.get(a.team, "maquina-viral") if a.team else None,
        }.items() if v is not None}
        if a.team:
            rest("POST", "tasks", row, "?on_conflict=id", upsert=True)
        else:  # partial update of an existing task
            if not rest("PATCH", "tasks", {k: v for k, v in row.items() if k != "id"}, f"?id=eq.{urllib.parse.quote(a.id)}") and URL and KEY:
                raise ValueError(f"tarefa {a.id} não existe: passe --team na primeira chamada")
        emit("hq", table="tasks", id=a.id, etapa=a.etapa, progress=a.progress, status=a.status)
    elif a.cmd == "agent":
        rest("PATCH", "agents", {"status": a.status, "doing_now": a.doing or ("ocioso" if a.status == "idle" else "trabalhando")}, f"?id=eq.{a.id}")
        emit("hq", table="agents", id=a.id, status=a.status)
    elif a.cmd == "event":
        payload = {k: v for k, v in {"to_team": a.to, "text": a.text, "note": a.note, "tool": a.tool}.items() if v}
        rest("POST", "events", {"type": a.type, "team_id": a.team, "agent_id": a.agent, "payload": payload})
        emit("hq", table="events", type=a.type)
    elif a.cmd == "skill":
        rest("POST", "skills_runtime", {"team_id": a.team, "skill": a.skill, "progress": a.progress, "state": a.state}, "?on_conflict=team_id,skill", upsert=True)
        emit("hq", table="skills_runtime", skill=a.skill, progress=a.progress)
    elif a.cmd == "schedule":
        row = {"id": f"{a.page}-{a.date}-{a.time}".replace(" ", "").lower(), "data": a.date, "pagina": a.page, "horario": a.time,
               "titulo": a.title or "", "status": a.status or "aguardando", "task_id": a.task}
        rest("POST", "schedule", row, "?on_conflict=id", upsert=True)
        emit("hq", table="schedule", id=row["id"], status=row["status"])
    elif a.cmd == "approval":
        deadline = time.time() + a.wait
        while True:
            rows = rest("GET", "approvals", None, f"?task_id=eq.{urllib.parse.quote(a.task)}&order=ts.desc&limit=1")
            if rows or time.time() >= deadline:
                break
            time.sleep(10)
        if rows:
            emit("hq", table="approvals", task=a.task, decision=rows[0]["decision"], feedback=rows[0].get("feedback") or "")
        else:
            emit("hq", table="approvals", task=a.task, decision="pending")
except Exception as ex:  # noqa: BLE001
    emit("hq", ok=False, error=str(ex))
