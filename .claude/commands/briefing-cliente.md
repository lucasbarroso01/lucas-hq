---
description: Pipeline da Agência Lucas a partir do pedido de um cliente.
argument-hint: "<texto do pedido>"
---
Pedido do cliente: $ARGUMENTS

0. Janela da Agência: só entre 09:00 e 18:00 (Brasília, `config/expediente.yaml` → `sob_demanda`), um cliente por vez. Fora da janela ou com outro cliente em andamento, registre o pedido como tarefa `na_fila` do time `inbox-b2b` e pare.
1. `briefing` → briefing estruturado + entidade do cliente no cérebro.
2. `roteirista-b2b` → 3 formatos e 3 roteiros, status "aguardando você".
3. Resuma em 5 linhas o que foi entregue e onde está.
