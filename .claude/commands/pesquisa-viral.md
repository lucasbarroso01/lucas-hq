---
description: Pesquisa mensal de virais do nicho no Instagram (skill ig-viral), feita COM o Lucas no navegador dele. Gera brain/swipe.md para o Radar e o Roteiro.
---
Use a skill **ig-viral** (`.claude/skills/ig-viral/SKILL.md`) à risca. Nicho: política, economia, geopolítica, guerras e curiosidades desses temas (`config/temas.yaml`).

Regras da própria skill, que não se negociam:
- Isto é **leitura com o Lucas presente**, no navegador dele, já logado. Nunca peça senha, nunca faça login por ele.
- **Nada de robô:** sem coleta automática, sem serviço de scraping, sem rodar em segundo plano ou agendado. São 6 a 12 contas, cerca de uma dúzia de reels cada, no ritmo de uma pessoa. Coleta automática viola os Termos do Instagram e bloqueia a conta.
- Copie a **fórmula**, nunca o vídeo, e cite a conta de origem em cada linha.

Passos:
1. Proponha 6 a 12 contas: 4 diretas (mesmo nicho, um pouco à frente), 4 adjacentes (mesmo público) e 2 a 4 grandes (só para formato). Peça a aprovação do Lucas e também a pasta "Salvos" dele.
2. Com o Lucas, abra cada conta e anote em `out/viral/captured.tsv` as colunas `account followers median views hook length cta`. Se o Instagram não mostrar o suficiente, o YouTube Shorts é a segunda fonte (público, sem login).
3. Rode `python3 .claude/skills/ig-viral/swipe.py out/viral/captured.tsv --out brain/swipe.md`.
4. Resuma para o Lucas em 5 linhas: as 3 fórmulas de gancho que mais passaram da média das contas e os 3 temas mais fortes.
