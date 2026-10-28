---
description: Pipeline Worldframe completo (Radar → Roteiros → Produção 5x paralelo → Qualidade → Social). Use `teste` para 1 vídeo.
argument-hint: "[teste]"
---
Rode a Máquina Viral para a página Worldframe de hoje. Argumentos: $ARGUMENTS

Se o argumento for `teste`: use só 1 vídeo (`inbox/teste_wf.mp4`), pule Radar/Roteiros, e o upload roda com `--dry-run`.

1. `radar-worldframe` → 5 temas (Task).
2. `roteirista-lead` → 5 roteiros (ele divide em sub-agentes).
3. `editor-lead` → 5 sub-agentes `video-editor` **em paralelo**, um por vídeo.
4. `brand-checker` → nota ≥ 8 ou devolve (máx. 2 voltas por vídeo).
5. `social-scheduler` → Drive em `Central de Conteúdo — Lucas/01 Máquina Viral/Worldframe/AAAA-MM-DD`, horários e relatório.
6. Pare em "aguardando você": eu aprovo os 5 vídeos no Drive pela interface. Mostre o relatório final com os horários.
