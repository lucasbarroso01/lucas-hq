---
description: Roda UM turno do expediente (ex.: /turno producao-worldframe), respeitando horário, dependências e limites.
argument-hint: "<turno> [teste | recuperar AAAA-MM-DD HH:MM]"
---
Turno pedido: $ARGUMENTS

1. Veja os turnos válidos com `python3 tools/expediente.py turnos` (o primeiro argumento é o id do turno; `teste` ignora o horário, nunca as aprovações).
2. Rode `python3 tools/expediente.py pode-rodar --turno <id> --esperar` (acrescente `--teste` se pedido).
   - Com `recuperar <data hora>` (notebook estava fechado no horário): rode `python3 tools/expediente.py pode-rodar --turno <id> --ocorrencia "<data hora>"`, sem `--esperar`. O turno roda atrasado: passe `atrasado: true` e o horário perdido para o agente.
   - `ok: false` → responda só o `motivo` em 1 linha e **pare**. Não faça nenhuma etapa.
3. `ok: true` → chame **somente** o agente do turno (campo `agente`) com a Task tool, passando o id do turno e o `task_id`. Não chame mais nenhum agente: a próxima etapa tem o turno dela.
4. Ao voltar, confira na tabela `tasks` que a tarefa do turno ficou `done` e que a tarefa do próximo turno (`proximo_task_id`) foi criada como `na_fila`.
5. Responda em no máximo 3 linhas: o que foi feito, onde está, o que ficou pendente.
