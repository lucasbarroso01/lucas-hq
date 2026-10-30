# Roteiro Worldframe (`inbox/roteiros/AAAA-MM-DD_<slug>.json`)

O `roteirista-lead` escreve um arquivo por vídeo; o `video-editor` passa ele para `python3 tools/worldframe/produzir.py`.
Exemplo completo: `tools/worldframe/exemplo_roteiro.json`.

## Regras de conteúdo
- **Tema**: só as editorias de `config/temas.yaml` (política, economia, geopolítica, guerras e curiosidades ligadas a elas). O roteiro declara `categoria` e `notas_tema` (do Radar); o `produzir.py` barra tema fora.
- **Toda frase tem uma palavra-chave** em `destaques` que aparece na `legenda`: ela sai em itálico verde-limão.
- **Conectores**: o fim de cada frase abre curiosidade para a próxima. O agente `conector` escreve 5 variações por passagem, dá nota e aplica a melhor; tudo fica em `conectores`.
- **Final**: a última cena é a pergunta (`visual: "pergunta"`, pede "Comment ..."). Depois dela o `produzir.py` acrescenta sozinho: "Hit like if this surprised you, and follow for more videos like this." Não escreva o like nem o follow no roteiro.
- Inglês, **entre 60 e 120 s** (monetização no Facebook). O Kokoro fala ~2,9 palavras/s na velocidade 1.1: mire **180 a 320 palavras** no total (12 a 20 cenas). O `produzir.py` barra roteiro curto ou longo.
- **Gancho com nota ≥ 75** no `python3 .claude/skills/ig-reel/hookscore.py --hook "<legenda da cena 1>"` (skill ig-reel). Ele mostra o ponto mais fraco: corrija e rode de novo. Honesto: nada de prometer o que o vídeo não mostra.
- Uma frase/ideia por cena, **no máximo 19 palavras**. `fala` com números por extenso; `legenda` com dígitos.
- **Gancho** (cena 1): afirmação concreta, fala com "you" e tem algo em jogo. Nunca "What if…?".
- Estrutura: gancho → número que surpreende → escada de 4 a 6 fatos, cada um maior → virada → momento para printar → pergunta final binária que divide sem tomar partido.
- **Todo número tem fonte real** (`fonte`, aparece no rodapé). Sem fonte confiável: corte o número, não estime. Fatos que mudam rápido (política, cotações, conflitos): cheque no dia e anote em `fontes_checadas_em`.
- Temas políticos: afirmações contestadas sempre atribuídas ("supporters say…", "the court found…").
- Paleta `principal` (padrão) ou `alternativa` (históricos/sérios; use também a voz `am_onyx`).
- `legenda_post`: sem hífen nem travessão, termina com pergunta para comentário.
- Fotos de pessoas: só as que o Lucas colocar em `assets/`. Nunca baixar da internet.

## Animação: palcos e atores (o que prende a atenção)
Pelo menos **metade das cenas** usa `"palco": "diorama"`, um mundo em miniatura com **atores animados**. As outras podem usar `"palco": "globo"` (mapas, rotas).
| ator (`atores[].tipo`) | o que faz | use para |
|---|---|---|
| `pessoas` (`acao`: `andar`, `multidao`, `fila`, `protesto`) | gente andando, aglomerada, em fila, protestando | população, eleitores, consumidores, protestos |
| `navios` | petroleiros cruzando um estreito | comércio, petróleo, rotas, bloqueios |
| `avioes` | aviões circulando | transporte, ouro levado para casa, guerra aérea |
| `drones` | drones pairando, hélices girando | guerra moderna, vigilância |
| `tanques` | tanques avançando, torre girando | guerra, fronteiras |
| `misseis` | mísseis em arco com explosão | ataques, defesa |
| `barras` | barras de ouro empilhando até virar um cubo | ouro, reservas |
| `dinheiro` | notas caindo | inflação, sanções, dívida |
| `predios` | cidade com janelas acesas | economia, países |
| `fabrica` | fábricas soltando fumaça | indústria, produção |
| `barris` | barris de petróleo empilhando | petróleo, energia |

`qtd` (1 a 80) e `destaque: true` (o primeiro sai em verde-limão). `terreno` opcional: `mar`, `cidade`, `campo`, `cofre` (se faltar, ele escolhe pelos atores).

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
