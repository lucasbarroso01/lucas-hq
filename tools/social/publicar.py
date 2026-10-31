#!/usr/bin/env python3
"""Etapa "Publicação": agenda cada vídeo novo de out/ no próximo horário livre da grade, no Facebook e no Instagram.

Roda pelo cron a cada 15 min (tools/social/ativar_publicacao.sh), com o Python da social-mcp:
    tools/social-mcp/.venv/bin/python tools/social/publicar.py [--simular]

- Grade (Brasília): config/expediente.yaml -> paginas.Worldframe.publicacao (09:30, 14:00, 17:00, 20:00, 22:30).
- Vídeo novo = out/AAAA-MM-DD_<slug>.mp4 com o .txt da legenda, criado depois da ativação, parado há 3 min
  (render terminou), sem "teste" no nome e ainda não agendado (out/_publicacao.json).
- Facebook: schedule_facebook_reel_native (a Meta publica sozinha). Instagram: schedule_instagram_local_reel
  (fila local; o vídeo sobe para o Supabase só na hora).
- Token expirado (código 190): grava out/_publicacao_parada, avisa no escritório e não agenda mais nada
  até o Lucas renovar (bash tools/social/setup.sh --novo-token) e apagar o aviso com --retomar.
- Respeita o botão "Pausar operação". Tudo vai para out/_turnos.log; nenhum token é lido ou impresso aqui.
"""
import argparse
import asyncio
import datetime as dt
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "out"
IMAGES = ROOT / "tools/social-mcp/data/images"
ESTADO = OUT / "_publicacao.json"
PARADA = OUT / "_publicacao_parada"
ATIVADO = Path.home() / ".config/lucas-hq/publicacao_ativada_em"
LOG = OUT / "_turnos.log"
MCP_URL = "http://127.0.0.1:3224/mcp"
TZ = ZoneInfo("America/Sao_Paulo")
ANTECEDENCIA = dt.timedelta(minutes=20)   # a Meta exige pelo menos 10 min para agendamento nativo
NOME = re.compile(r"^(\d{4}-\d{2}-\d{2})_[a-z0-9-]+\.mp4$")


def log(msg: str) -> None:
    with LOG.open("a") as f:
        f.write(f"{dt.datetime.now(TZ):%Y-%m-%d %H:%M:%S} [publicacao] {msg}\n")


def hq(*args: str) -> None:
    subprocess.run([str(ROOT / ".venv/bin/python") if (ROOT / ".venv").exists() else "python3", str(ROOT / "tools/hq.py"), *args],
                   cwd=ROOT, check=False, capture_output=True)


def grade() -> list[str]:
    import yaml  # noqa: PLC0415
    cfg = yaml.safe_load((ROOT / "config/expediente.yaml").read_text())
    return cfg["paginas"]["Worldframe"]["publicacao"]


def pausado() -> bool:
    sys.path.insert(0, str(ROOT / "tools"))
    try:
        from _common import pausa  # noqa: PLC0415
        return bool(pausa()[0])
    except Exception:  # noqa: BLE001
        return False


def proximo_horario(ocupados: set[str], agora: dt.datetime) -> dt.datetime:
    g = grade()
    dia = agora.date()
    for _ in range(30):
        for hm in g:
            h, m = map(int, hm.split(":"))
            t = dt.datetime(dia.year, dia.month, dia.day, h, m, tzinfo=TZ)
            if t >= agora + ANTECEDENCIA and t.isoformat() not in ocupados:
                return t
        dia += dt.timedelta(days=1)
    raise RuntimeError("grade cheia nos próximos 30 dias")


def novos(estado: dict, desde: float) -> list[Path]:
    agora = dt.datetime.now().timestamp()
    out = []
    for p in sorted(OUT.glob("*.mp4"), key=lambda x: x.stat().st_mtime):
        if not NOME.match(p.name) or "teste" in p.name or p.name in estado:
            continue
        st = p.stat().st_mtime
        if st < desde or agora - st < 180 or not p.with_suffix(".txt").exists():
            continue
        out.append(p)
    return out


def token_expirado(res: dict) -> bool:
    txt = json.dumps(res, ensure_ascii=False)
    return '"code": 190' in txt or "Error validating access token" in txt or "Session has expired" in txt


async def chamar(sessao, tool: str, args: dict) -> dict:
    r = await sessao.call_tool(tool, args)
    txt = "".join(getattr(c, "text", "") for c in r.content)
    try:
        return json.loads(txt)
    except ValueError:
        return {"ok": False, "error": txt[:500]}


async def rodar(simular: bool) -> dict:
    from mcp import ClientSession  # noqa: PLC0415
    from mcp.client.streamable_http import streamablehttp_client  # noqa: PLC0415

    if PARADA.exists():
        return {"ok": False, "parada": PARADA.read_text().strip()}
    if pausado():
        return {"ok": True, "pausado": True}
    if not ATIVADO.exists():
        return {"ok": True, "desligada": "rode bash tools/social/ativar_publicacao.sh"}
    desde = float(ATIVADO.read_text().strip())
    estado = json.loads(ESTADO.read_text()) if ESTADO.exists() else {}
    fila = novos(estado, desde)
    if not fila:
        return {"ok": True, "agendados": []}
    ocupados = {v["horario"] for v in estado.values()}
    feitos = []
    async with streamablehttp_client(MCP_URL) as (r, w, _), ClientSession(r, w) as s:
        await s.initialize()
        for video in fila:
            quando = proximo_horario(ocupados, dt.datetime.now(TZ))
            iso = quando.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            legenda = video.with_suffix(".txt").read_text().strip()
            if simular:
                feitos.append({"video": video.name, "horario": quando.isoformat()})
                ocupados.add(quando.isoformat())
                continue
            IMAGES.mkdir(parents=True, exist_ok=True)
            shutil.copy2(video, IMAGES / video.name)   # copia: o original fica em out/
            fb = await chamar(s, "schedule_facebook_reel_native", {"filename": video.name, "when": iso, "description": legenda})
            ig = await chamar(s, "schedule_instagram_local_reel", {"filename": video.name, "when": iso, "caption": legenda})
            if token_expirado(fb) or token_expirado(ig):
                PARADA.write_text(f"{dt.datetime.now(TZ):%Y-%m-%d %H:%M} token da Meta expirado (código 190)\n")
                log(f"PAROU: token da Meta expirado ao agendar {video.name}. Renove: bash tools/social/setup.sh --novo-token")
                hq("task", "--id", f"token-meta-expirado-{dt.date.today()}", "--team", "social", "--title", "Token da Meta expirou: publicação parada",
                   "--status", "waiting", "--etapa", "TOKEN", "--log", "bash tools/social/setup.sh --novo-token; depois publicar.py --retomar")
                hq("event", "--type", "toast", "--team", "social", "--note", "Token da Meta expirou: publicação parada até você renovar")
                return {"ok": False, "erro": "token expirado", "agendados": feitos}
            item = {"horario": quando.isoformat(), "fb_video_id": fb.get("video_id"), "ig_job_id": ig.get("job_id"),
                    "fb_ok": bool(fb.get("ok")), "ig_ok": bool(ig.get("ok"))}
            if not item["fb_ok"]:
                item["fb_erro"] = str(fb.get("error"))[:300]
            if not item["ig_ok"]:
                item["ig_erro"] = str(ig.get("error"))[:300]
            estado[video.name] = item
            ESTADO.write_text(json.dumps(estado, indent=1, ensure_ascii=False))
            ocupados.add(quando.isoformat())
            log(f"{video.name} -> {quando:%d/%m %H:%M} | FB {'ok ' + str(item['fb_video_id']) if item['fb_ok'] else 'ERRO ' + item['fb_erro']}"
                f" | IG {'ok ' + str(item['ig_job_id']) if item['ig_ok'] else 'ERRO ' + item['ig_erro']}")
            hq("event", "--type", "tool_run", "--team", "social", "--note", f"Publicação: {video.name} agendado para {quando:%d/%m %H:%M} (FB e IG)")
            feitos.append({"video": video.name, **item})
    return {"ok": True, "agendados": feitos}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--simular", action="store_true", help="mostra o que agendaria, sem chamar a Meta")
    ap.add_argument("--retomar", action="store_true", help="apaga o aviso de token expirado depois de renovar o token")
    a = ap.parse_args()
    if a.retomar:
        if PARADA.exists():
            PARADA.rename(PARADA.with_suffix(".resolvido"))
        log("retomada pelo Lucas (token renovado)")
        print(json.dumps({"tool": "publicar", "ok": True, "retomada": True}))
        return
    try:
        res = asyncio.run(rodar(a.simular))
    except Exception as e:  # noqa: BLE001
        res = {"ok": False, "erro": f"{type(e).__name__}: {e}"[:300]}
        log(f"erro: {res['erro']}")
    print(json.dumps({"tool": "publicar", **res}, ensure_ascii=False))


if __name__ == "__main__":
    main()
