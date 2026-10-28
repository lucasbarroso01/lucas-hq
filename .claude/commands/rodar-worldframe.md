---
description: Rodada manual do Worldframe, turno a turno (Radar → Roteiros → Produção → Qualidade → Social). Use `teste` para 1 vídeo fora do horário.
argument-hint: "[teste]"
---
Argumentos: $ARGUMENTS

Rodada manual: execute os turnos **em ordem**, cada um exatamente como `/turno <id>` faria (passos 2 a 5 do `.claude/commands/turno.md`), sem pular verificações e sem um agente fazer o trabalho de outro:
`radar-worldframe` → `roteiros-worldframe` → `producao-worldframe` → `qa-worldframe` → `social-worldframe`.

- Com `teste`: use `--teste` no `pode-rodar`, só 1 vídeo (`inbox/teste_wf.mp4`), comece direto em `producao-worldframe` (crie antes as tarefas `radar-worldframe-<data>` e `roteiros-worldframe-<data>` como `done`, com `--log "pulado no teste"`). O upload vai de verdade para o Drive (com `--task`).
- Se um turno parar com `ok: false`, pare a rodada e mostre o motivo.
- No fim, pare em "aguardando você" e mostre o relatório com os horários.
