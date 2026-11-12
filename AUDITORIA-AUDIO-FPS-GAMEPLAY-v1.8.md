# Neon Sky Force v1.8 — Auditoria de áudio, FPS, travamentos e gameplay

Data: 12/11/2026  
Base avaliada: v1.7 (commit `8b8ff07`)  
Implementação: branch `qa/audio-fps-gameplay-v18`

## 1. Diagnóstico das causas confirmadas no código

| Subsistema | Antes | Depois | Efeito esperado |
| --- | --- | --- | --- |
| Música 1–4 + menu/boss/vitória | 23 chamadas recorrentes de `setTimeout` sem rastreamento/cancelamento centralizado | `ProceduralMusic.later` mantém um `Set` de timers pendentes, retira cada um ao executar e cancela todos em `stop` | Evita callbacks antigos e reduz atividade residual entre faixas |
| Música 5–10 | `StageThemeMusic.timers` acumulava identificadores já executados | Temporizadores gerenciados pelo mecanismo comum | Estabiliza o consumo em sessões longas |
| Áudio | Osciladores de SFX sem desconexão explícita ao terminar; melodias com ataque imediato | `onended` desconecta SFX; filtro passa-baixas + compressor no canal de música; ataque/release suave nas notas dos setores 5–10 | Menos clicks, picos e encadeamento de nós ociosos |
| Inicialização musical | Duas camadas podiam chamar `level1` e reiniciar a mesma faixa seguidamente | Identificação da faixa ativa e reutilização se ainda toca | Evita reinício duplicado e trabalho desnecessário |
| Disparo sonoro | Um novo tom a cada disparo, mesmo nos modos de cadência alta | Intervalo mínimo de 95 ms entre SFX de tiro | Menos instâncias de oscilador e fadiga sonora |
| Loop do motor | Em uma atualização atrasada, podia desenhar até seis quadros completos seguidos | Limite de duas atualizações completas por `requestAnimationFrame` e acumulador limitado | Evita transformar lag temporário em sequência de frames caros |
| Nave do jogador | Gradientes, engine glow e sombras recriados por frame | Sprite pré-renderizado por nível de arma nos perfis Desempenho/Equilibrado; sobreposições dinâmicas para motor, foco e escudo | Reduz custo de canvas, preservando hitbox e arte do modo Alta qualidade |
| Aba inativa | A simulação podia continuar sem a pessoa poder jogar | Pausa automática com `visibilitychange` | Evita mortes involuntárias em segundo plano |
| Coleta de itens | Power-up exigia contato mais preciso | Atração suave a até 68px | Melhora ergonomia em meio aos projéteis |

## 2. Testes executados de verdade

**Ferramenta:** Playwright + Chromium headless no GitHub Actions, servido via servidor HTTP local.

**Testes de fluxo** (`tests/e2e-playtest.mjs`):
- Menu inicial e três resoluções: **1366×768, 390×844, 1024×600**. Painéis dentro dos limites horizontais em todos os casos.
- Lançamento da campanha, movimento pelo teclado, disparo contínuo durante ~7,5s e pausa/retorno.
- Carregamento e renderização **10/10** scripts de fase e inicialização das trilhas correspondentes.
- Uma fase completa por vez ativa na memória, validada pelo `StageLoader`.
- Nenhum erro JS nem erro de console registrado na execução bem-sucedida.
- Instância musical final com `isPlaying=false` e zero timers pendentes após `stopMusic`.

**Benchmark indicativo em Chromium headless com entrada contínua:**
- Uma execução anterior ao cache da nave: 288 ticks simulados em 7,51 s (~38,3 ticks/s).
- Uma execução com o cache: 442 ticks em 7,51 s (~58,8 ticks/s).
- Há variabilidade entre executores compartilhados do CI. **Esses números não provam ganho idêntico no PC ou celular do jogador.**

**Teste isolado de níveis** (`tests/isolated-stage-perf.mjs`):
- Testou níveis **1, 7, 9 e 10** em páginas separadas, sem acúmulo intencional de fases.
- Houve uma espera inicial de ~2,25–2,63 segundos antes do primeiro `requestAnimationFrame` em vários testes, inclusive na fase 1, ao usar a renderização SwiftShader do executor.
- A medição isolada não atribui esse evento a uma fase específica. É necessário testar com GPU real para esclarecer a origem da espera.
- Algumas medições artificiais com troca acelerada entre todas as fases também desaceleraram no final. Isso **não** demonstra que uma campanha normal trave na fase 10, e fica registrado como área de observação.

## 3. Limites dos testes

- **Não foi jogada uma campanha completa até os créditos**; as 10 fases foram carregadas e renderizadas por teste de automação, com transições de teste forçadas.
- Não houve inspeção visual manual de frames capturados; o executor apresentou timeout no mecanismo de screenshot de cena animada, então a captura foi desabilitada.
- A comparação não representa hardware dedicado de Windows ou aparelhos Android.
- A troca de nível sob estresse é diferente da transição normal pós-chefe. Falta teste completo de 1ª a 10ª missão por progressão natural.

## 4. Prioridades para próxima iteração

1. Playtest humano ou automação mais próxima do usuário, incluindo a transição real após chefes, save, game over e retorno do pause.
2. Profile de 60 segundos com GPU real na fase 9/10, medindo percentis p95/p99 e número de frames acima de 33ms e 50ms; comparar modos gráficos.
3. Substituir gradualmente loops de áudio sintético por trilhas originais produzidas e compactadas em Opus, com streaming e fallback procedural.
4. Criar sprites/atlas de inimigos e bosses e limitar renderização fora da tela para reduzir `shadowBlur` por entidade, medindo antes de aplicar.

## 5. Arquivos da atualização

- `js/game.js` — temporizadores musicais e cadeia de áudio.
- `js/v16-streaming.js` — cap de atualizações e envelope de notas.
- `js/runtime-polish.js` — pause seguro, música sem reinício duplicado, pickup magnet e SFX.
- `js/performance-renderer.js` — cache visual da nave.
- `index.html` — inclusão dos módulos.
- `tests/e2e-playtest.mjs`, `tests/isolated-stage-perf.mjs`, `.github/workflows/playtest.yml` — suíte reprodutível de QA.

**Execuções de referência:** [playtest aprovado de 10 fases](https://github.com/jogoiarexx-blip/Neon-Sky-Force/actions/runs/43200601916) · [playtest + cenários isolados](https://github.com/jogoiarexx-blip/Neon-Sky-Force/actions/runs/43201018606).
