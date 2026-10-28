---
description: Rodada manual do Funny Pets, turno a turno. Respeita a aprovação das cenas.
argument-hint: "[teste]"
---
Argumentos: $ARGUMENTS

Execute, cada um como `/turno <id>` faria (com `--teste` no `pode-rodar` se pedido):
1. Se `cenas-pets` de hoje já foi aprovado: `producao-pets` → `qa-pets` → `social-pets`.
2. Depois prepare o de amanhã: `radar-pets` → `cenas-pets` (termina em "aguardando você"; nada é gerado sem o OK do Lucas).
Pare no primeiro `ok: false` e mostre o motivo.
