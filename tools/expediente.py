#!/usr/bin/env python3
"""Expediente dos agentes: lê config/expediente.yaml e aplica as regras de horário, dependência e limites.

python3 tools/expediente.py turnos                                  # tabela de turnos (markdown)
python3 tools/expediente.py pode-rodar --turno producao-worldframe  # ok=true/false + motivo; não faz nada
python3 tools/expediente.py pode-rodar --turno producao-worldframe --esperar   # espera a etapa anterior (máx. 15 min)
python3 tools/expediente.py task-id --turno qa-worldframe           # id da tarefa do turno (ex.: qa-worldframe-2026-10-29)
python3 tools/expediente.py vagas                                   # sub-agentes livres no escritório (máx. 5)
python3 tools/expediente.py proximo-horario --pagina Worldframe     # próximo horário livre (respeita 2h entre posts)
python3 tools/expediente.py agendamentos                            # gera config/agendamentos.md

--agora "2026-10-29 05:50" simula o relógio (testes). --teste ignora horário e silêncio, mas nunca as aprovações.
"""
import argparse
import datetime as dt
import json
import time
import urllib.parse
from zoneinfo import ZoneInfo

import yaml

from _common import KEY, ROOT, URL, emit, pausa, rest

CFG = yaml.safe_load((ROOT / "config" / "expediente.yaml").read_text())
TZ = ZoneInfo(CFG["fuso"])
LIM = CFG["limites"]
TURNOS = {t["id"]: t for t in CFG["turnos"]}
DIAS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"]
ONLINE = bool(URL and KEY)


def hm(s: str) -> dt.time:
    h, m = s.split(":")
    return dt.time(int(h), int(m))


def mins(t: dt.time) -> int:
    return t.hour * 60 + t.minute


def in_window(now: dt.time, ini: str, fim: str) -> bool:
    a, b, n = mins(hm(ini)), mins(hm(fim)), mins(now)
    return a <= n < b if a <= b else n >= a or n < b  # janela que cruza a meia-noite


def post_date(t: dict, now: dt.datetime) -> dt.date:
    """Data do post a que o turno serve (turnos com prepara_dia_seguinte trabalham para amanhã)."""
    return now.date() + dt.timedelta(days=1) if t.get("prepara_dia_seguinte") else now.date()


def task_id(t: dict, now: dt.datetime) -> str:
    return f"{t['id']}-{post_date(t, now).isoformat()}"


def get_task(tid: str) -> dict | None:
    rows = rest("GET", "tasks", None, f"?id=eq.{urllib.parse.quote(tid)}&select=id,status,etapa,team_id")
    return rows[0] if rows else None


def running_in_team(team: str, own: str) -> list[str]:
    rows = rest("GET", "tasks", None, f"?team_id=eq.{team}&status=eq.running&parent_id=is.null&select=id")
    return [r["id"] for r in rows if r["id"] != own]


def running_subagents() -> int:
    rows = rest("GET", "tasks", None, "?status=eq.running&parent_id=not.is.null&select=id")
    return len(rows)


SKIP = {"done": "já está done (não refaça)", "waiting": "já entregou e espera o Lucas", "running": "já está rodando",
        "error": "terminou com erro (veja o motivo na tarefa)", "atrasado": "já foi entregue com atraso"}


def check(t: dict, now: dt.datetime, teste: bool, ocorrencia: dt.datetime | None = None, refazer: bool = False) -> tuple[bool, str, str | None]:
    """(ok, motivo, status_a_registrar). Com `ocorrencia` (recuperação), datas e ids vêm do horário perdido
    e só o silêncio é checado no relógio real."""
    clock = now.time()
    pausado, motivo = pausa()
    if pausado:
        return False, "operação pausada pelo Lucas" + (f": {motivo}" if motivo else ""), None
    if ocorrencia is not None:
        if not t.get("manutencao") and in_window(clock, CFG["silencio"]["inicio"], CFG["silencio"]["fim"]):
            return False, f"horário de silêncio ({CFG['silencio']['inicio']}–{CFG['silencio']['fim']})", None
        if now - ocorrencia > dt.timedelta(hours=CFG["recuperacao"]["max_horas"]):
            return False, f"turno perdido há mais de {CFG['recuperacao']['max_horas']}h: fica para o próximo ciclo", None
        now = ocorrencia
    elif not teste:
        if t.get("dias") and DIAS[now.weekday()] not in t["dias"]:
            return False, f"turno só roda em {', '.join(t['dias'])}", None
        if not t.get("manutencao") and in_window(clock, CFG["silencio"]["inicio"], CFG["silencio"]["fim"]):
            return False, f"horário de silêncio ({CFG['silencio']['inicio']}–{CFG['silencio']['fim']})", None
        if not in_window(clock, t["inicio"], t["prazo"]):
            return False, f"fora do turno ({t['inicio']}–{t['prazo']})", None
    if t.get("humano"):
        return False, "etapa humana: é o Lucas quem faz", None
    if not ONLINE:
        return True, "offline (sem Supabase): dependências não verificadas", None
    own = task_id(t, now)
    mine = get_task(own)
    if mine and mine["status"] in SKIP and not refazer:
        return False, f"{own} {SKIP[mine['status']]}", None
    busy = running_in_team(t["time"], own)
    if busy:
        return False, f"o time {t['time']} já tem rodada em andamento: {', '.join(busy)}", None
    up_id = t.get("depende_de")
    if up_id:
        uid = f"{up_id}-{post_date(t, now).isoformat()}"  # mesma data de post (cenas da véspera servem ao post de hoje)
        u = get_task(uid)
        delivered = u and (u["status"] == "done" or (t.get("exige_aprovacao") and u["status"] in ("waiting", "running")))
        if not delivered:
            return False, f"etapa anterior {uid} não entregou (status: {u['status'] if u else 'inexistente'})", "waiting_upstream"
        if t.get("exige_aprovacao"):
            ap = rest("GET", "approvals", None, f"?task_id=eq.{urllib.parse.quote(uid)}&order=ts.desc&limit=1")
            if not ap or ap[0]["decision"] != "approved":
                return False, f"{uid} ainda não foi aprovado pelo Lucas", "waiting_upstream"
    return True, "pode rodar", None


def next_turno(t: dict) -> str | None:
    return next((x["id"] for x in CFG["turnos"] if x.get("depende_de") == t["id"]), None)


def occurrence(t: dict, now: dt.datetime) -> dt.datetime | None:
    """Último horário de início do turno que já passou (hoje ou ontem), respeitando `dias`."""
    for back in (0, 1, 2, 3, 4, 5, 6):
        day = now.date() - dt.timedelta(days=back)
        start = dt.datetime.combine(day, hm(t["inicio"]), TZ)
        if start <= now and (not t.get("dias") or DIAS[day.weekday()] in t["dias"]):
            return start
    return None


def pendentes(now: dt.datetime) -> list[dict]:
    """Turnos cujo horário passou sem a tarefa ter sido feita, do mais antigo ao mais novo."""
    out = []
    for t in CFG["turnos"]:
        if t.get("humano"):
            continue
        occ = occurrence(t, now)
        if not occ or now - occ > dt.timedelta(hours=CFG["recuperacao"]["max_horas"]):
            continue
        tid = task_id(t, occ)
        task = get_task(tid) if ONLINE else None
        if task and task["status"] in SKIP:
            continue
        ok, why, _ = check(t, now, False, occ)
        pg = CFG["paginas"].get(t.get("pagina") or "")
        # urgência: o primeiro post da página na data servida; sem página (analytics) vai por último
        post = f"{post_date(t, occ).isoformat()} {pg['posts'][0]}" if pg else "9999"
        out.append({"turno": t["id"], "ocorrencia": occ.strftime("%Y-%m-%d %H:%M"), "task_id": tid, "pronto": ok,
                    "motivo": why, "primeiro_post": post if pg else None})
    return sorted(out, key=lambda x: (x["primeiro_post"] or "9999", x["ocorrencia"]))


def cmd_pode_rodar(a, now):
    t = TURNOS.get(a.turno)
    if not t:
        emit("expediente", ok=False, error=f"turno desconhecido: {a.turno}. Válidos: {', '.join(TURNOS)}")
    occ = dt.datetime.strptime(a.ocorrencia, "%Y-%m-%d %H:%M").replace(tzinfo=TZ) if a.ocorrencia else None
    if occ is not None:  # recuperação: não espera nem registra nada, só responde
        ok, why, _ = check(t, now, a.teste, occ, a.refazer)
        nxt = next_turno(t)
        print(json.dumps({"tool": "expediente", "ok": ok, "turno": t["id"], "agente": t["agente"], "task_id": task_id(t, occ),
                          "proximo_task_id": f"{nxt}-{post_date(t, occ).isoformat()}" if nxt else None,
                          "atrasado": True, "ocorrencia": a.ocorrencia, "prazo_original": t["prazo"], "motivo": why}, ensure_ascii=False))
        return
    ok, why, st = check(t, now, a.teste, refazer=a.refazer)
    if not ok and st == "waiting_upstream" and a.esperar:
        deadline = time.time() + LIM["espera_upstream_min"] * 60
        while not ok and time.time() < deadline:
            time.sleep(60)
            ok, why, st = check(t, dt.datetime.now(TZ), a.teste, refazer=a.refazer)
    if not ok and st == "waiting_upstream" and ONLINE:
        rest("POST", "tasks", {"id": task_id(t, now), "team_id": t["time"], "agent_id": t["agente"], "operacao": "maquina-viral",
                               "titulo": f"{t['faz']} · {post_date(t, now).isoformat()}", "etapa": "ESPERANDO", "status": "waiting_upstream",
                               "progress": 0}, "?on_conflict=id", upsert=True)
        rest("POST", "events", {"type": "toast", "team_id": t["time"], "agent_id": t["agente"],
                                "payload": {"task": task_id(t, now), "text": f"{t['agente']} · esperando etapa anterior ({why})"}})
    nxt = next_turno(t)
    print_json = dict(turno=t["id"], agente=t["agente"], task_id=task_id(t, now),
                      proximo_task_id=f"{nxt}-{post_date(t, now).isoformat()}" if nxt else None,
                      atrasado=False, janela=f"{t['inicio']}–{t['prazo']}", prazo=t["prazo"], motivo=why)
    print(json.dumps({"tool": "expediente", "ok": ok, **print_json}, ensure_ascii=False))


def slots_taken(pagina: str, day: dt.date) -> list[dt.time]:
    rows = rest("GET", "schedule", None, f"?data=eq.{day.isoformat()}&pagina=eq.{urllib.parse.quote(pagina)}&select=horario,status")
    return [hm(r["horario"]) for r in rows if r["status"] != "atrasado"]


def cmd_proximo(a, now):
    pg = CFG["paginas"][a.pagina]
    gap = LIM["intervalo_minimo_posts_h"] * 60
    for add in range(0, 3):
        day = now.date() + dt.timedelta(days=add)
        taken = slots_taken(a.pagina, day) if ONLINE else []
        for s in pg["posts"]:
            t = hm(s)
            if add == 0 and mins(t) <= mins(now.time()):
                continue
            if any(abs(mins(t) - mins(x)) < gap for x in taken):
                continue
            emit("expediente", pagina=a.pagina, data=day.isoformat(), horario=s)
            return
    emit("expediente", ok=False, error="nenhum horário livre nos próximos 3 dias")


def cron_for(t: dict) -> str:
    h, m = t["inicio"].split(":")
    dow = ",".join(str((DIAS.index(d) + 1) % 7) for d in t["dias"]) if t.get("dias") else "*"
    return f"CRON_TZ={CFG['fuso']} {int(m)} {int(h)} * * {dow}"


def cmd_turnos(_a, _now):
    print("| Turno | Página | Início | Prazo | Agente | Faz | Depende de |")
    print("|---|---|---|---|---|---|---|")
    for t in CFG["turnos"]:
        dias = f" ({', '.join(t['dias'])})" if t.get("dias") else ""
        print(f"| {t['id']} | {t.get('pagina', '—')} | {t['inicio']}{dias} | {t['prazo']} | {t['agente']} | {t['faz']} | {t.get('depende_de') or '—'} |")


def crontab_lines() -> list[str]:
    log = ">> $HOME/lucas-hq/out/_turnos.log 2>&1"
    lines = [f"{cron_for(t).split(' ', 1)[1]} $HOME/lucas-hq/iniciar.sh --turno {t['id']} {log}"
             for t in CFG["turnos"] if not t.get("humano")]
    if CFG["recuperacao"]["ativa"]:
        n = CFG["recuperacao"]["verificar_a_cada_min"]
        lines += [f"*/{n} * * * * $HOME/lucas-hq/iniciar.sh --recuperar {log}",
                  f"@reboot sleep 90; $HOME/lucas-hq/iniciar.sh --recuperar {log}"]
    return lines


def cmd_agendamentos(_a, _now):
    lines = ["# Agendamentos dos turnos (gerado por `python3 tools/expediente.py agendamentos`)", "",
             f"Fuso: **{CFG['fuso']}**. Um turno por tarefa agendada. Cada disparo roda `/turno <id>`, que chama "
             "`tools/expediente.py pode-rodar` antes de fazer qualquer coisa.", "",
             "| Nome | Cron | Comando |", "|---|---|---|"]
    auto = [t for t in CFG["turnos"] if not t.get("humano")]
    for t in auto:
        lines.append(f"| Lucas HQ · {t['id']} | `{cron_for(t)}` | `/turno {t['id']}` |")
    rc = CFG["recuperacao"]
    lines += ["", "## Recuperação (notebook fechado no horário)", "",
              f"A cada {rc['verificar_a_cada_min']} min e ao ligar, `iniciar.sh --recuperar` roda os turnos perdidos, um por vez, "
              f"do post mais urgente ao menos urgente, respeitando o silêncio e as dependências. Perdido há mais de {rc['max_horas']}h, "
              f"fica para o próximo ciclo. No máximo {LIM['tentativas_por_item']} tentativas por turno; depois, `error` na tarefa.",
              "", "## No seu computador (cron do Linux)", "",
              "O cron do Debian não entende `CRON_TZ`, então o relógio do Linux precisa estar em "
              f"{CFG['fuso']}. O computador precisa estar ligado e com o Linux aberto no horário. "
              "Instale com `./iniciar.sh --agendar`, que grava estas linhas no `crontab`:", "", "```cron"]
    lines += crontab_lines()
    lines += ["```", ""]
    out = ROOT / "config" / "agendamentos.md"
    out.write_text("\n".join(lines))
    emit("expediente", arquivo=str(out.relative_to(ROOT)), agendamentos=len(auto))


ap = argparse.ArgumentParser()
ap.add_argument("--agora", help='simula o relógio: "AAAA-MM-DD HH:MM" (fuso de Brasília)')
sub = ap.add_subparsers(dest="cmd", required=True)
p = sub.add_parser("pode-rodar")
p.add_argument("--turno", required=True)
p.add_argument("--esperar", action="store_true", help="espera a etapa anterior por até limites.espera_upstream_min")
p.add_argument("--teste", action="store_true", help="ignora horário/silêncio (nunca as aprovações)")
p.add_argument("--refazer", action="store_true", help="refaz a tarefa do dia em qualquer status (/rodar-worldframe agora); aprovações seguem valendo")
p.add_argument("--ocorrencia", help='recuperação: horário perdido "AAAA-MM-DD HH:MM" (dado por proximo-pendente)')
sub.add_parser("pendentes", help="turnos perdidos (notebook fechado no horário)")
sub.add_parser("proximo-pendente", help="o turno perdido mais antigo que já pode rodar")
i = sub.add_parser("task-id")
i.add_argument("--turno", required=True)
sub.add_parser("vagas")
x = sub.add_parser("proximo-horario")
x.add_argument("--pagina", required=True, choices=list(CFG["paginas"]))
sub.add_parser("turnos")
sub.add_parser("agendamentos")
sub.add_parser("crontab", help="só as linhas do crontab (usado pelo iniciar.sh --agendar)")
a = ap.parse_args()

try:
    now = dt.datetime.strptime(a.agora, "%Y-%m-%d %H:%M").replace(tzinfo=TZ) if a.agora else dt.datetime.now(TZ)
    if a.cmd == "pode-rodar":
        cmd_pode_rodar(a, now)
    elif a.cmd == "task-id":
        emit("expediente", task_id=task_id(TURNOS[a.turno], now))
    elif a.cmd == "vagas":
        usados = running_subagents() if ONLINE else 0
        emit("expediente", vagas=max(0, LIM["subagentes_simultaneos"] - usados), em_uso=usados, maximo=LIM["subagentes_simultaneos"])
    elif a.cmd == "proximo-horario":
        cmd_proximo(a, now)
    elif a.cmd == "turnos":
        cmd_turnos(a, now)
    elif a.cmd == "pendentes":
        emit("expediente", pendentes=pendentes(now) if CFG["recuperacao"]["ativa"] else [])
    elif a.cmd == "proximo-pendente":
        pend = [x for x in pendentes(now) if x["pronto"]] if CFG["recuperacao"]["ativa"] else []
        if pend:
            emit("expediente", **pend[0])
        else:
            print(json.dumps({"tool": "expediente", "ok": False, "motivo": "nenhum turno perdido pronto para rodar"}, ensure_ascii=False))
    elif a.cmd == "crontab":
        print("\n".join(crontab_lines()))
    elif a.cmd == "agendamentos":
        cmd_agendamentos(a, now)
except SystemExit:
    raise
except Exception as e:  # noqa: BLE001
    emit("expediente", ok=False, error=str(e))
