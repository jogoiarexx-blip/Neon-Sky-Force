# Neon Sky Force v2.1 — Sustentação de combate, partículas e monitor de FPS

**Data:** 12/11/2026  
**Base:** v2.0 (commit `39a19be00533466fc5a300d7f5ada8cc831566f5`)  
**Status:** implementado e validado na branch; consultar CI e publicação da `main` para status final.

## 1. Auditoria: problemas reproduzidos

**Trajetórias horizontais erradas.** A atualização dos projéteis usava `b.y += b.vy || 5`. A expressão convertia uma velocidade vertical válida de 0 em 5. Um tiro destinado a viajar exatamente na horizontal passava a descer 5 unidades por atualização. Foi trocada por `b.y += b.vy ?? 5`, preservando zero e mantendo o valor padrão apenas quando a propriedade está ausente. O teste real `Game.fixedStep()` confirmou o projétil saindo de (170,330) e chegando a (172,5,330).

**Trabalho redundante no Iron Core.** A rotina de atualização do chefe tipo 6 separava o array de projéteis entre "antigos" e "novos" e recriava o conjunto toda vez, mesmo sem canhões destruídos. A nova verificação só trata os tiros novos se realmente existir uma torre destruída; executa esse filtro antes da limpeza de projéteis na troca de fase. O teste confirmou que a torre quebrada não continua disparando.

**Perda de explosões em batalhas intensas.** A v1.9 simplesmente ignorava explosões novas quando o limite dos modos leves estava cheio; o modo Alta qualidade não tinha limite equivalente. A v2.1 usa orçamento finito em todos os modos e descarta efeitos antigos para permitir uma explosão importante mais recente. Trails de tiro são os primeiros a ceder espaço; nenhum dano, hitbox ou pontuação depende das partículas.

## 2. O que foi implementado

| Subsistema | Antes | v2.1 |
| --- | --- | --- |
| Tiros com `vy=0` | Desciam 5 unidades por passo | Horizontal verdadeira |
| Iron Core | Recriação de arrays toda atualização | Filtra somente novos tiros de canhões quebrados |
| Partículas — Desempenho | Máximo 130, explosões novas podiam sumir | Máximo 130; preserva novos impactos |
| Partículas — Equilibrado | Máximo 230, explosões novas podiam sumir | Máximo 230; preserva novos impactos |
| Partículas — Alta qualidade | Sem limite no manipulador de efeitos | Máximo 420; mantém as explosões mais recentes |
| Rajadas em excesso | Sem proteção por dificuldade | Limite suave para **novos tiros**, sem excluir os já disparados |
| Monitor de FPS | Apenas FPS médio | FPS, P95 do intervalo entre quadros, tiros e partículas |
| Versão exibida no menu | Edição visual 1.7 | v2.1 |

**Limites suaves de projéteis em batalhas com chefe:**

| Dificuldade | Alvo de tiros simultâneos |
| --- | ---: |
| EASY | 130 |
| NORMAL | 160 |
| HARD | 200 |
| NIGHTMARE | 240 |

Esse limite impede *novas* rajadas de ultrapassarem o orçamento durante uma situação de alta densidade. **Não elimina tiros já existentes**, preservando o tempo de reação do jogador e os padrões em voo. Não depende do FPS nem da qualidade gráfica. A aparência das rajadas é mantida por seleção uniforme dos novos tiros quando necessário. Em combate usual, abaixo do limite, os padrões não mudam.

## 3. Testes executados

**Suíte Playwright + Chromium (GitHub Actions):** [execução aprovada 43265115852](https://github.com/jogoiarexx-blip/Neon-Sky-Force/actions/runs/43265115852).

Resultados verificáveis:
- **10/10 fases** carregadas e renderizadas na regressão geral.
- **8/8 tipos de chefes** desenhados em três perfis, incluindo suas rajadas finais.
- **0 erros de página e 0 erros de console** no conjunto da suíte.
- Derrota do primeiro boss mediante colisão real e avanço até a fase 2, com checkpoint e música corretos.
- Movimento horizontal: `x:170→172,5`, `y:330→330`.
- Limites de partículas respeitados nos três perfis: 130, 230, 420; novos efeitos de impacto continuam presentes mesmo com a lista cheia.
- Cenário de saturação em NORMAL: **158 projéteis já existentes preservados**, apenas 2 novos aceitos no limite de 160, 3 tiros novos suprimidos. Em NIGHTMARE: limite de 240, mais tiros aceitos na mesma situação.
- Iron Core: cenário de torre esquerda destruída, tiros restantes emitidos somente pelo lado funcional/centro.

### Simulação prolongada do chefe final

O teste `tests/sustained-battle.mjs` executou **1.800 atualizações da lógica de combate por perfil** (30 segundos de tempo simulado por perfil, 90 segundos no total), movendo e eliminando tiros fora dos limites. A arte real do chefe e dos tiros foi desenhada **a cada 5 atualizações**; não é uma partida humana completa nem uma medição de FPS normal.

| Perfil | Pico de tiros em voo | Rajadas/ativações observadas | Fim da simulação |
| --- | ---: | ---: | --- |
| Desempenho | 63 | 72 | 44 tiros em voo |
| Equilibrado | 65 | 72 | 45 tiros em voo |
| Alta qualidade | 64 | 72 | 46 tiros em voo |

Os três mantiveram o chefe ativo, com rajadas regulares e sem exceder o limite NORMAL de 160. Em um teste distinto, a saturação forçada confirmou que o limitador funciona quando necessário. A quantidade natural de projéteis **não se acumulou indefinidamente** no cenário simulado.

O monitor exibiu em um instante `FPS 10 · P95 17ms · TIROS 0 · FX 0`. O número de FPS baixo em CI é influenciado pelo navegador headless e inicialização de SwiftShader e não deve ser interpretado como taxa constante do jogo em hardware real. O P95 mostrado é calculado a partir de amostras do intervalo entre animações durante cerca de um segundo, não um percentil universal da sessão.

## 4. Pontos ainda não comprovados

1. Não foi jogada a campanha inteira da fase 1 aos créditos como um usuário humano.
2. O teste de 90 segundos equivale a **tempo virtual de lógica**, não a uma sessão real cronometrada de 90 segundos a 60 FPS.
3. Não há medição comparativa confiável em dispositivo real (notebook com GPU integrada, PC com GPU dedicada ou Android). Use "Mostrar FPS" no próprio jogo durante 3–5 minutos de uma batalha para registrar FPS/P95 com as configurações reais.
4. Falta avaliação manual de áudio, conforto dos avisos de chefes e dificuldade após alguns minutos nas fases 8, 9 e 10.

## 5. Arquivos alterados

- `js/v16-streaming.js`: velocidade vertical correta e filtros seletivos de canhões.
- `js/combat-optimizer.js`: orçamentos de partículas e prioridade de explosões.
- `js/battle-stability.js`: limite suave por dificuldade, sem deletar tiros anteriores.
- `js/visual-polish.js`: FPS, p95, tiros e partículas no monitor existente.
- `index.html`: carregamento do módulo e versão atualizada.
- `tests/sustained-battle.mjs`: novas regressões e simulações de 30 segundos por perfil.
- `.github/workflows/playtest.yml`: novo estágio do CI.

**Recomendação seguinte:** analisar uma sessão prolongada *inteira* com entrada real, combate nos chefes 8–10 e histórico de frame time em hardware real, antes de mexer mais agressivamente na lógica de disparos.
