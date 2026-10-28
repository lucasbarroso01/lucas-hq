# Lucas HQ — regras do escritório

Escritório de agentes do Lucas. Duas operações: **Máquina Viral** (Worldframe 5/dia, Funny Pets 1/dia) e **Agência Lucas** (B2B).
Times e agentes ficam em `.claude/agents/`; comandos em `.claude/commands/` (`/rodar-worldframe`, `/rodar-pets`, `/briefing-cliente`, `/status`).

## Regras para todo agente
- O agente decide; os scripts de `tools/` fazem os pixels. Não edite vídeo à mão, rode o script.
- Um comando por vez, sem `&&`. Sempre a partir da raiz do repo. Cada script imprime 1 linha JSON: leia `ok`.
- Fluxo de arquivos: `inbox/` (entrada) → `out/<nome>/` (trabalho) → `done/` (só após aprovação do Lucas).
- Cérebro: MCP `memory` (`brain/memory.jsonl`). Leia antes (`search_nodes`), escreva depois (`add_observations`). Toda leitura/escrita vira evento com `tools/hq.py event --type brain_read|brain_write`.
- Estado ao vivo: `tools/hq.py task|agent|event|skill|schedule` a cada mudança de etapa. A interface (`apps/office`) mostra tudo.
- Humano no loop: tudo que é público ou custa dinheiro espera o OK do Lucas (`tools/hq.py approval --task <id>`).
  - Funny Pets: cenas aprovadas antes de gerar no Higgsfield.
  - Worldframe: os 5 vídeos aprovados no Drive antes de mover para `done/`.
- Nunca publique em redes, nunca apague arquivos, nunca use `rm`.
- Líderes dividem trabalho com a Task tool em sub-agentes **paralelos**, sem chat compartilhado, e conferem cada entrega.

## Ambiente
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (agentes). Sem elas, `hq.py` grava em `out/_hq.log` (modo offline).
- `GOOGLE_APPLICATION_CREDENTIALS` para `drive_upload.py` (sem ela, os arquivos ficam em `out/_drive/`).
- Python: `pip install -r tools/requirements.txt`; precisa de `ffmpeg`.
