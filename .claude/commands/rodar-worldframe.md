---
description: Rodada manual do Worldframe, turno a turno (Radar → Roteiros → Produção → Qualidade → Social). Use `teste` para 1 vídeo fora do horário.
argument-hint: "[teste|agora]"
---
Argumentos: $ARGUMENTS

Rodada manual: execute os turnos **em ordem**, cada um exatamente como `/turno <id>` faria (passos 2 a 5 do `.claude/commands/turno.md`), sem pular verificações e sem um agente fazer o trabalho de outro:
`radar-worldframe` → `roteiros-worldframe` → `producao-worldframe` → `qa-worldframe` → `social-worldframe`.

- Com `teste`: use `--teste` no `pode-rodar`, só 1 vídeo (`inbox/teste_wf.mp4`), comece direto em `producao-worldframe` (crie antes as tarefas `radar-worldframe-<data>` e `roteiros-worldframe-<data>` como `done`, com `--log "pulado no teste"`). O upload vai de verdade para o Drive (com `--task`).
- Com `agora` (refazer o dia fora do horário, pedido pelo Lucas): os 5 vídeos completos, todos os turnos em ordem, com `--teste` no `pode-rodar` (ignora só o horário; pausa, limites e aprovações valem). Tarefas de hoje em qualquer status (inclusive `waiting`, `running`, `done` de rodadas anteriores) são descartadas e refeitas: reabra cada uma com `hq.py task --id <id> --status na_fila --log "refeito no modo agora"` antes do turno. Não reaproveite roteiros antigos de hoje: o Radar escolhe temas novos pelo filtro de editorias. Horários dos posts: aplique a regra 5 (`expediente.py proximo-horario --pagina Worldframe`) para os que já passaram. Nunca apague os vídeos antigos do Drive; os novos sobem ao lado.
- Se um turno parar com `ok: false`, pare a rodada e mostre o motivo.
- No fim, pare em "aguardando você" e mostre o relatório com os horários.
