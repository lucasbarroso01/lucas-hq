# Roteiro Worldframe (`inbox/roteiros/AAAA-MM-DD_<slug>.json`)

O `roteirista-lead` escreve um arquivo por vídeo; o `video-editor` passa ele para `python3 tools/worldframe/produzir.py`.
Exemplo completo: `tools/worldframe/exemplo_roteiro.json`.

## Regras de conteúdo
- **Tema**: só as editorias de `config/temas.yaml` (política, economia, geopolítica, guerras e curiosidades ligadas a elas). O roteiro declara `categoria` e `notas_tema` (do Radar); o `produzir.py` barra tema fora.
- **Toda frase tem uma palavra-chave** em `destaques` que aparece na `legenda`: ela sai em itálico verde-limão.
- **Conectores**: o fim de cada frase abre curiosidade para a próxima. O agente `conector` escreve 5 variações por passagem, dá nota e aplica a melhor; tudo fica em `conectores`.
- **Final**: a última cena é a pergunta (`visual: "pergunta"`, pede "Comment ..."). Depois dela o `produzir.py` acrescenta sozinho: "Hit like if this surprised you, and follow for more videos like this." Não escreva o like nem o follow no roteiro.
- Inglês, **mais de 60 s** (monetização no Facebook) e até 90 s. O Kokoro fala ~2,9 palavras/s na velocidade 1.1: mire **180 a 240 palavras** no total (12 a 16 cenas). O `produzir.py` barra roteiro curto.
- Uma frase/ideia por cena, **no máximo 19 palavras**. `fala` com números por extenso; `legenda` com dígitos.
- **Gancho** (cena 1): afirmação concreta, fala com "you" e tem algo em jogo. Nunca "What if…?".
- Estrutura: gancho → número que surpreende → escada de 4 a 6 fatos, cada um maior → virada → momento para printar → pergunta final binária que divide sem tomar partido.
- **Todo número tem fonte real** (`fonte`, aparece no rodapé). Sem fonte confiável: corte o número, não estime. Fatos que mudam rápido (política, cotações, conflitos): cheque no dia e anote em `fontes_checadas_em`.
- Temas políticos: afirmações contestadas sempre atribuídas ("supporters say…", "the court found…").
- Paleta `principal` (padrão) ou `alternativa` (históricos/sérios; use também a voz `am_onyx`).
- `legenda_post`: sem hífen nem travessão, termina com pergunta para comentário.
- Fotos de pessoas: só as que o Lucas colocar em `assets/`. Nunca baixar da internet.

## Campos
| Campo | |
|---|---|
| `slug`, `titulo` | identificação |
| `paleta` | `principal` \| `alternativa` |
| `voz`, `velocidade` | `am_michael` (padrão) ou `am_onyx`; ~1.1 |
| `dial` | rótulo do dial de progresso (ex.: `FACT`, `DAY`, `STEP`) |
| `cenas[]` | ver abaixo |
| `categoria`, `notas_tema` | editoria e notas do Radar (`config/temas.yaml`) |
| `conectores` | `[{"cena": N, "variacoes": [5], "notas": [5], "escolhida": i}]` para cada passagem |
| `final` | `{"pergunta": "...", "destaque": "palavras em itálico", "opcoes": ["YES", "NO"]}` |
| `legenda_post` | texto do post |

Cada cena: `fala`, `legenda`, `destaques` (palavras em verde-limão), `fonte`, `visual`
(`contador` \| `numero` \| `anel` + `"anel": 80` \| `voltas` \| `globo` \| `printar` \| `pergunta` na última),
`numero` opcional (`de`, `ate`, `casas`, `sufixo`, `rotulo`), `camera` (`lat`, `lon`, `dist` 1.9 a 3.6) e
`globo` (`cabos` 0/1, `quebras` 0 a 6 pontos piscando, `anel` 0/1).
