---
description: Produz o Funny Pets aprovado e prepara as cenas do próximo (aguardando você).
---
1. Veja se há tarefa de Funny Pets com aprovação: `python3 tools/hq.py approval --task <id>`.
2. Se `approved`: `pets-producer` gera no Higgsfield, `brand-checker` confere, `social-scheduler` sobe com horário 19:30.
3. Em seguida, `radar-pets` escolhe o próximo viral e `pets-producer` escreve as cenas do próximo com status **waiting** (nada é gerado sem meu OK).
