# Lucas HQ — regras do escritório

Escritório de agentes do Lucas. Duas operações: **Máquina Viral** (Worldframe 5/dia, com o **Acervo de Virais** como banco de referências) e **Agência Lucas** (B2B). O Funny Pets saiu do escritório (o Lucas faz à mão no chat).
Times e agentes ficam em `.claude/agents/`; comandos em `.claude/commands/` (`/rodar-worldframe`, `/alimentar-acervo`, `/briefing-cliente`, `/status`).

## Regras para todo agente
- O agente decide; os scripts de `tools/` fazem os pixels. Não edite vídeo à mão, rode o script.
- Um comando por vez, sem `&&`. Sempre a partir da raiz do repo. Cada script imprime 1 linha JSON: leia `ok`.
- Fluxo de arquivos: `inbox/roteiros/` (roteiros .json) → `out/` (vídeo, legenda e contact sheet) → `done/` (só após aprovação do Lucas). Worldframe é **gerado em código** por `tools/worldframe/produzir.py` (não há vídeo bruto), tem **mais de 60 s** e vai para o Drive assim que o render termina.
- Cérebro: MCP `memory` (`brain/memory.jsonl`). Leia antes (`search_nodes`), escreva depois (`add_observations`). Toda leitura/escrita vira evento com `tools/hq.py event --type brain_read|brain_write`.
- Estado ao vivo: `tools/hq.py task|agent|event|skill|schedule` a cada mudança de etapa. A interface (`apps/office`) mostra tudo.
- Humano no loop: tudo que é público ou custa dinheiro espera o OK do Lucas (`tools/hq.py approval --task <id>`).
  - Worldframe: os 5 vídeos aprovados no Drive antes de mover para `done/`.
- Nunca publique em redes por conta própria, nunca apague arquivos, nunca use `rm`. Agendar posts só pela MCP `social` (social-mcp em 127.0.0.1, `tools/social/`) e só com o OK do Lucas: a etapa automática "Publicação" fica **desligada** até ele confirmar o teste. Token da Meta e chaves só no `tools/social-mcp/.env`: nunca leia, imprima ou registre esse arquivo. Se a API responder token expirado (código 190), pare e avise o Lucas.
- Drive **só pelos scripts** (`tools/drive_upload.py`, `tools/drive_sync.py`): eles sobem o vídeo junto com a legenda. Nunca crie, copie ou renomeie arquivos no Drive pelo conector.
- Líderes dividem trabalho com a Task tool em sub-agentes **paralelos**, sem chat compartilhado, e conferem cada entrega.

## Regras de expediente
Fonte única: `config/expediente.yaml` (fuso America/Sao_Paulo). Nunca escreva horários soltos: consulte `python3 tools/expediente.py`.
1. **Um agente, uma função.** Faça só a sua etapa. Nunca faça o trabalho de outro time nem adiante a próxima etapa.
2. **Só no seu horário e com a entrega anterior pronta.** Comece com `python3 tools/expediente.py pode-rodar --turno <id> --esperar`. Se `ok=false`, encerre sem fazer nada (ele já registra `waiting_upstream` quando a etapa anterior não entregou em 15 min).
3. **Bastão só pela tabela `tasks`.** Ao terminar: sua tarefa (`expediente.py task-id --turno <id>`) vira `done`, crie a tarefa do próximo turno (`proximo_task_id` do `pode-rodar`) com `--status na_fila` e registre `hq.py handoff`. Não chame o próximo agente.
4. **Limites:** máx. 5 sub-agentes no escritório (`expediente.py vagas`), 1 rodada por time, 2 tentativas por item (na 3ª falha: `error` com motivo e siga com os demais), Higgsfield 1 geração/dia (+1 refação) com saldo checado antes.
5. **Prazo estourado:** entregue o que estiver pronto, marque o resto `atrasado` e use `expediente.py proximo-horario --pagina <p>` (nunca 2 posts da mesma página com menos de 2h).
6. **Não refaça o que está pronto:** confira `tasks` e `temas-usados` no cérebro antes de começar.
7. **Silêncio 23:30–04:30:** ninguém roda, exceto a manutenção de domingo. **Pausa:** com o botão "Pausar operação" ligado (`hq.py pausa`), nenhum turno começa e a produção para antes do render.
8. **Humano no loop:** nada é publicado, apagado ou pago sem aprovação; pare em "aguardando você".
9. **Relatório curto:** no máximo 3 linhas (o que fez, onde está, o que ficou pendente).
10. **Recuperação (notebook fechado no horário):** o turno perdido roda assim que o Linux voltar (`iniciar.sh --recuperar`, a cada 5 min e ao ligar), um por vez, do post mais urgente ao menos urgente, respeitando o silêncio e as dependências; perdido há mais de 16h, fica para o próximo ciclo. Rodando com `atrasado: true`, entregue normalmente e aplique a regra 5 (posts que já passaram vão para `proximo-horario`).

Pesquisa de virais do nicho: `/pesquisa-viral`, uma vez por mês, **com o Lucas presente** no navegador (skill ig-viral; nada de coleta automática). Gera `brain/swipe.md`, que o Radar e o Roteiro leem.

Turnos: `python3 tools/expediente.py turnos`. Disparo: `/turno <id>` (um turno por tarefa agendada, ver `config/agendamentos.md`).

## Ambiente
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (agentes). Sem elas, `hq.py` grava em `out/_hq.log` (modo offline).
- Drive (Gmail pessoal): cliente OAuth em `~/.config/lucas-hq/oauth-client.json` e login único com `python3 tools/drive_upload.py --login`. Sem isso, os arquivos ficam em `out/_drive/`.
- Python: `pip install -r tools/requirements.txt`; precisa de `ffmpeg`.
- Produção Worldframe: `bash tools/setup_producao.sh` (PASSO 0: Node 22+, ffmpeg, Kokoro e modelo, HyperFrames e Chrome, fontes e bibliotecas locais). Formato do roteiro: `tools/worldframe/ROTEIRO.md`.
