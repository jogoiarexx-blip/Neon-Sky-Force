# Neon Sky Force v1.9 — Otimização de combate, música e progressão

Data: 12 de novembro de 2026  
Base: v1.8 / commit `622ae52235d76fdd85fac740b51ea30a1137701f`

## 1. Alterações efetivamente implementadas

### Renderização de inimigos e projéteis

- Nos perfis **Desempenho** e **Equilibrado**, as classes de inimigos **1, 2, 3, 4, 5 e 7** são renderizadas com sprites pré-calculados em canvas, com variantes de flash de dano. O spritesheet é criado sob demanda, reutilizado pelo restante da sessão e não afeta a simulação.
- Barras de vida, mira do sniper, status de buff e brilho de movimento são recompostos dinamicamente onde necessário.
- As classes **6 e 8** conservam a renderização dinâmica integral por dependerem de estados mais complexos (escudo, aura e rotação).
- O modo **Alta qualidade** continua com renderização original de todas as classes.
- Tiros inimigos nos dois perfis leves passam a ser agrupados por cor, desenhando trilhas e núcleos em lotes sem uma sombra cara por projétil.
- Efeitos de explosão recebem limite na criação: até 130 partículas em Desempenho e 230 em Equilibrado, com redução de tamanho por explosão. Score, dano, hitboxes e evolução de fase não mudam.

### Trilha e efeitos de áudio

- As fases **5 a 10** agora possuem sequências melódicas procedurais distintas de 16 passos, mais linhas discretas de baixo e variação de percussão; não há áudios externos nem novas transferências.
- Notas transitórias ganham limpeza `onended` após reprodução, além de herdar a gestão de timers introduzida na v1.8.
- Sons de tiro variam conforme nível da arma. Sons de explosão variam levemente na frequência e recebem envelope de volume e queda de tom para reduzir clicks.

### Gameplay — rasantes

- Passar a uma pequena distância de um tiro inimigo **sem colidir** concede **12 pontos** ou **20 usando precisão**.
- Cada projétil pode conceder um único bônus. Não há bônus durante invulnerabilidade, dash, transição ou colisão.
- Um pequeno contador no topo exibe os rasantes acumulados, com feedback e som discreto a cada 8.
- A pontuação de rasantes é reiniciada com a campanha, mas não altera as regras de rank, dificuldade ou dano.

## 2. Teste automatizado de verdade

Execução: [GitHub Actions — v1.9, Chromium + Playwright](https://github.com/jogoiarexx-blip/Neon-Sky-Force/actions/runs/43249026863)  
Resultado: **SUCCESS**. Todos os 3 testes da suíte passaram.

### Smoke test de campanha
- 10/10 fases carregadas e renderizadas.
- 10/10 músicas de fase inicializadas.
- 0 erros JavaScript e 0 erros de console registrados.
- Uma configuração completa de fase por vez ativa.
- Menus conferidos horizontalmente em 1366×768, 390×844 e 1024×600.

### Estresse visual
Simulação com **16 inimigos e 175 tiros inimigos**, amostras de aproximadamente 3–4 segundos em modo low, balanced e high.

| Perfil | Simulação avançada | P95 das amostras de RAF | Cache de sprites | Resultado |
| --- | ---: | ---: | ---: | --- |
| Desempenho | 35 ticks / 3,45 s | 33,2 ms | 6 tipos | Executado sem erro |
| Equilibrado | 55 ticks / 4,00 s | 16,7 ms | 6 tipos | Executado sem erro |
| Alta qualidade | 53 ticks / 3,34 s | 16,7 ms | 0 (original) | Executado sem erro |

**Alerta de interpretação:** o executor usa SwiftShader, e os testes registraram pausas do primeiro frame entre aproximadamente 2,5 e 3,1 segundos. As taxas de ticks incluem essa pausa e não são comparação justa de FPS sustentado, tampouco evidência de hardware real. O P95 foi calculado sobre amostras de RAF da execução e **não** garante desempenho contínuo.

### Gameplay: colidir e avançar de fase
Teste executado com motor real, simulando um projétil de dano fatal ao boss 1:
1. Envia projétil do jogador pela checagem real de colisão.
2. Confirma que o boss foi derrotado.
3. Confirma gravação de checkpoint na fase 2.
4. Aguarda apresentação de missão concluída, warp e troca real.
5. Confirma estado `playing`, nível 2, trilha `Level2Music`, somente configuração da fase 2 carregada.
6. Verifica graze: primeiro near miss dá +12, a repetição no mesmo projétil não dá pontos extras e HP fica inalterado.

**Resultado:** todas as assertivas passaram. O teste não jogou as ondas completas da fase 1; o boss foi criado artificialmente e derrotado usando o código real de colisão.

## 3. Pendências que continuam

1. Playtest humano até o fim das dez fases, incluindo equilíbrio de dificuldade, partidas longas e derrotas normais.
2. Comparativo de desempenho com GPU real (desktop integrado, celular Android e notebook), com 1% lows, p95/p99 e estatísticas de travamentos.
3. Otimização mais profunda do desenho de chefes, em especial efeitos radiais e auras extensas.
4. Testes de carga prolongados de áudio para verificar ganho de memória em sessões de 30–60 minutos.
5. Capturas de tela validadas em navegador real: screenshots do Chromium CI já apresentaram timeout na v1.8, portanto essa suíte verifica funcionamento, mas não substitui avaliação estética humana.

## 4. Arquivos

- `js/combat-optimizer.js`: cache e lote de projéteis, limite de partículas.
- `js/gameplay-polish.js`: rasantes.
- `js/v16-streaming.js`: motivos musicais das fases 5–10.
- `js/game.js`: timbre de SFX e envelopes.
- `tests/combat-and-transition.mjs`: teste de estresse e de progresso real fase 1→2.
- `index.html` e `.github/workflows/playtest.yml`: carregamento dos módulos e CI.

Todos os novos módulos são independentes e podem ser retirados sem afetar `StageLoader` ou os scripts das fases.
