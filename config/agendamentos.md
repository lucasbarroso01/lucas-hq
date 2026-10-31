# Agendamentos dos turnos (gerado por `python3 tools/expediente.py agendamentos`)

Fuso: **America/Sao_Paulo**. Um turno por tarefa agendada. Cada disparo roda `/turno <id>`, que chama `tools/expediente.py pode-rodar` antes de fazer qualquer coisa.

| Nome | Cron | Comando |
|---|---|---|
| Lucas HQ · radar-worldframe | `CRON_TZ=America/Sao_Paulo 30 4 * * *` | `/turno radar-worldframe` |
| Lucas HQ · roteiros-worldframe | `CRON_TZ=America/Sao_Paulo 0 5 * * *` | `/turno roteiros-worldframe` |
| Lucas HQ · producao-worldframe | `CRON_TZ=America/Sao_Paulo 45 5 * * *` | `/turno producao-worldframe` |
| Lucas HQ · acervo-semanal | `CRON_TZ=America/Sao_Paulo 0 10 * * 0` | `/turno acervo-semanal` |
| Lucas HQ · manutencao-cerebro | `CRON_TZ=America/Sao_Paulo 0 23 * * 0` | `/turno manutencao-cerebro` |

## Recuperação (notebook fechado no horário)

A cada 5 min e ao ligar, `iniciar.sh --recuperar` roda os turnos perdidos, um por vez, do post mais urgente ao menos urgente, respeitando o silêncio e as dependências. Perdido há mais de 16h, fica para o próximo ciclo. No máximo 2 tentativas por turno; depois, `error` na tarefa.

## No seu computador (cron do Linux)

O cron do Debian não entende `CRON_TZ`, então o relógio do Linux precisa estar em America/Sao_Paulo. O computador precisa estar ligado e com o Linux aberto no horário. Instale com `./iniciar.sh --agendar`, que grava estas linhas no `crontab`:

```cron
30 4 * * * $HOME/lucas-hq/iniciar.sh --turno radar-worldframe >> $HOME/lucas-hq/out/_turnos.log 2>&1
0 5 * * * $HOME/lucas-hq/iniciar.sh --turno roteiros-worldframe >> $HOME/lucas-hq/out/_turnos.log 2>&1
45 5 * * * $HOME/lucas-hq/iniciar.sh --turno producao-worldframe >> $HOME/lucas-hq/out/_turnos.log 2>&1
0 10 * * 0 $HOME/lucas-hq/iniciar.sh --turno acervo-semanal >> $HOME/lucas-hq/out/_turnos.log 2>&1
0 23 * * 0 $HOME/lucas-hq/iniciar.sh --turno manutencao-cerebro >> $HOME/lucas-hq/out/_turnos.log 2>&1
*/5 * * * * $HOME/lucas-hq/iniciar.sh --recuperar >> $HOME/lucas-hq/out/_turnos.log 2>&1
@reboot sleep 90; $HOME/lucas-hq/iniciar.sh --recuperar >> $HOME/lucas-hq/out/_turnos.log 2>&1
```
