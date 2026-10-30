#!/usr/bin/env python3
"""Report agent state to Supabase so the office shows it live. Uses SUPABASE_URL + SUPABASE_SERVICE_KEY.
Without them it appends to out/_hq.log (offline/test mode) and still prints the JSON line.

python3 tools/hq.py task --id wf-2026-10-28-01 --team producao-wf --agent video-editor --title wf_01.mp4 --etapa LEGENDAS --progress 50 [--status running] [--parent wf-batch]
python3 tools/hq.py agent --id video-editor --status working --doing "legendando wf_01"
python3 tools/hq.py event --type brain_write --team radar --agent radar-worldframe --note "tema X já usado"
python3 tools/hq.py handoff --team roteiros --to producao-wf --text "Roteiros · 5 ganchos prontos"
python3 tools/hq.py skill --team producao-wf --skill hypit-video --progress 40 --state running
python3 tools/hq.py schedule --date 2026-10-28 --page Worldframe --time 18:00 --title wf_04.mp4 --status planejado|pronto|aprovado|postado|atrasado [--drive-url ...] [--task ...]
python3 tools/hq.py approval --task t2 [--wait 0]   # prints the latest decision; --wait N polls up to N seconds
python3 tools/hq.py pausa [--on --motivo "..." | --off]   # botão Pausar operação
"""
import argparse
import json
import os
import time
import urllib.parse
import urllib.error
import urllib.request
from pathlib import Path

from _common import KEY, OP, URL, emit, pausa, rest

ap = argparse.ArgumentParser()
sub = ap.add_subparsers(dest="cmd", required=True)
t = sub.add_parser("task")
for k in ["id", "team", "agent", "title", "etapa", "parent", "drive-url", "post-time"]:
    t.add_argument(f"--{k}")
t.add_argument("--status", choices=["na_fila", "running", "waiting", "waiting_upstream", "done", "error", "atrasado"])
t.add_argument("--progress", type=int)
t.add_argument("--qa-score", type=float)
t.add_argument("--payload", help="JSON, merged into the existing payload (e.g. {\"notes\": \"...\"})")
t.add_argument("--log", help="one human sentence for the task's live log (default: etapa + progress)")
g = sub.add_parser("agent")
g.add_argument("--id", required=True)
g.add_argument("--status", choices=["working", "idle"], required=True)
g.add_argument("--doing", default="")
e = sub.add_parser("event")
e.add_argument("--type", required=True, choices=["handoff", "brain_read", "brain_write", "tool_run", "toast"])
for k in ["team", "agent", "to", "text", "note", "tool", "task"]:
    e.add_argument(f"--{k}")
h = sub.add_parser("handoff", help="pass work to another team (walker + toast in the office)")
h.add_argument("--team", required=True, help="team handing off")
h.add_argument("--to", required=True, help="team receiving")
h.add_argument("--text", required=True)
h.add_argument("--agent")
s = sub.add_parser("skill")
s.add_argument("--team", required=True)
s.add_argument("--skill", required=True)
s.add_argument("--progress", type=int, default=0)
s.add_argument("--state", choices=["running", "idle"], default="running")
c = sub.add_parser("schedule", help="cria/atualiza um post na Agenda (crie assim que o horário for definido)")
for k in ["date", "time", "title", "task", "drive-url"]:
    c.add_argument(f"--{k}")
c.add_argument("--page", choices=["Worldframe"])
c.add_argument("--status", choices=["planejado", "pronto", "aprovado", "postado", "atrasado"])
z = sub.add_parser("pausa", help="liga/desliga o botão Pausar operação (sem opções: mostra o estado)")
z.add_argument("--on", action="store_true")
z.add_argument("--off", action="store_true")
z.add_argument("--motivo", default="")
p = sub.add_parser("approval")
p.add_argument("--task", required=True)
p.add_argument("--wait", type=int, default=0)
a = ap.parse_args()

try:
    if a.cmd == "task":
        row = {k: v for k, v in {
            "id": a.id, "team_id": a.team, "agent_id": a.agent, "titulo": a.title, "etapa": a.etapa, "status": a.status,
            "progress": a.progress, "parent_id": a.parent, "drive_url": a.drive_url, "post_time": a.post_time, "qa_score": a.qa_score,
            "payload": None,
            "operacao": OP.get(a.team, "maquina-viral") if a.team else None,
        }.items() if v is not None}
        q = f"?id=eq.{urllib.parse.quote(a.id)}"
        if a.payload:
            old = rest("GET", "tasks", None, q + "&select=payload")
            row["payload"] = {**((old[0].get("payload") or {}) if old else {}), **json.loads(a.payload)}
        if a.team:
            saved = rest("POST", "tasks", row, "?on_conflict=id", upsert=True)
        else:  # partial update of an existing task
            saved = rest("PATCH", "tasks", {k: v for k, v in row.items() if k != "id"}, q)
            if not saved and URL and KEY:
                raise ValueError(f"tarefa {a.id} não existe: passe --team na primeira chamada")
        # every step also lands in the task's live log in the office
        team = a.team or (saved[0].get("team_id") if saved else None)
        agent = a.agent or (saved[0].get("agent_id") if saved else None)
        text = a.log or " · ".join(x for x in [a.etapa, f"{a.progress}%" if a.progress is not None else None, a.status] if x) or "atualizou a tarefa"
        rest("POST", "events", {"type": "tool_run", "team_id": team, "agent_id": agent, "payload": {"task": a.id, "text": text}})
        emit("hq", table="tasks", id=a.id, etapa=a.etapa, progress=a.progress, status=a.status)
    elif a.cmd == "agent":
        rest("PATCH", "agents", {"status": a.status, "doing_now": a.doing or ("ocioso" if a.status == "idle" else "trabalhando")}, f"?id=eq.{a.id}")
        emit("hq", table="agents", id=a.id, status=a.status)
    elif a.cmd == "event":
        payload = {k: v for k, v in {"to_team": a.to, "text": a.text, "note": a.note, "tool": a.tool, "task": a.task}.items() if v}
        rest("POST", "events", {"type": a.type, "team_id": a.team, "agent_id": a.agent, "payload": payload})
        emit("hq", table="events", type=a.type)
    elif a.cmd == "handoff":
        rest("POST", "events", {"type": "handoff", "team_id": a.team, "agent_id": a.agent, "payload": {"to_team": a.to, "text": a.text}})
        emit("hq", table="events", type="handoff", to=a.to)
    elif a.cmd == "skill":
        rest("POST", "skills_runtime", {"team_id": a.team, "skill": a.skill, "progress": a.progress, "state": a.state}, "?on_conflict=team_id,skill", upsert=True)
        emit("hq", table="skills_runtime", skill=a.skill, progress=a.progress)
    elif a.cmd == "schedule":
        row = {"id": f"{a.page}-{a.date}-{a.time}".replace(" ", "").lower(), "data": a.date, "pagina": a.page, "horario": a.time,
               "titulo": a.title or "", "status": a.status or "planejado", "task_id": a.task}
        if a.drive_url:
            row["drive_url"] = a.drive_url
        rest("POST", "schedule", row, "?on_conflict=id", upsert=True)
        emit("hq", table="schedule", id=row["id"], status=row["status"])
    elif a.cmd == "pausa":
        if a.on or a.off:
            import datetime as _dt
            if URL and KEY:
                rest("PATCH", "controle", {"pausado": bool(a.on), "motivo": a.motivo if a.on else "",
                                           "atualizado_em": _dt.datetime.now(_dt.timezone.utc).isoformat()}, "?id=eq.operacao")
            else:
                from _common import ROOT
                f = ROOT / "out" / "_pausa"
                f.write_text(a.motivo) if a.on else f.unlink(missing_ok=True)
        st, mot = pausa()
        emit("hq", table="controle", pausado=st, motivo=mot)
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
