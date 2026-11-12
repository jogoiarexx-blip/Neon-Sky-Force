# Neon Sky Force v2.0 — Chefes, FPS e leitura dos ataques

Data: 12/11/2026  
Base: v1.9, commit `0b43c3492fc34874a26ec461f7a0036d3343226e`  
Escopo: apenas o fluxo de desenho de bosses, indicações de ataque e pequenos golpes finais nas fases avançadas.

## 1. Problema detectado na auditoria

O método base de desenho de chefes recalcula em todos os frames efeitos de `shadowBlur`, gradientes radiais e lineares, anéis animados e HUD da barra de vida. O jogo já reduz pixels em qualidades mais baixas, mas continuar desenhando o boss inteiro mais de uma vez após um frame atrasado ainda custa CPU/GPU.

**Importante:** cache indiscriminado também pode piorar o desempenho. O teste inicial mostrou que os chefes 5–8 possuem geometria relativamente barata: processar um canvas intermediário e copiar sua imagem em algumas configurações ficou mais lento que o desenho direto. Por isso, a implementação final usa seleção baseada em medição.

## 2. Otimizações implementadas

| Perfil | Chefes desenhados por cache | Chefes desenhados pelo método original |
| --- | --- | --- |
| Desempenho | Tipos 1, 2, 3 e 4 | Tipos 5, 6, 7 e 8 |
| Equilibrado | Tipos 1, 2 e 3 | Tipos 4, 5, 6, 7 e 8 |
| Alta qualidade | Nenhum | Todos |

- O cache só existe quando o chefe está ativo. Há no máximo um canvas por perfil; a textura é reutilizada entre chefes.
- A tela continua atualizando posição e mira normalmente a cada frame. O desenho completo da arte ocorre uma vez a cada **4 frames no modo Desempenho** ou a cada **3 frames no modo Equilibrado**, com atualização antecipada em mudança de fase, de chefe, de flash de dano ou de estado das peças.
- A renderização offscreen altera `this.ctx` e as coordenadas do boss **somente durante a chamada síncrona de desenho**, restaurando tudo em `finally`. Não toca hitbox, HP, movimento, lógica de ondas ou score.
- O modo Alta qualidade mantém a arte vetorial original.

## 3. Melhorias de gameplay dos chefes

- **Aviso de ataque:** um anel sinalizador com arco crescente aparece nos últimos 21 frames antes da próxima rajada, usando cores diferentes para indicar a fase. Nos chefes com tiros direcionados há uma linha discreta mostrando a orientação do disparo. É uma pista, não um hitbox.
- **Golpes finais:** na terceira fase de vida, os chefes tipos 5–8 usam uma pequena rajada adicional após **cada quarta sequência normal**. A técnica é própria de cada boss:
  - Tipo 5: dois tiros convergentes pelos lados.
  - Tipo 6: tiros das torres ainda funcionais; destruir uma torre impede o tiro correspondente.
  - Tipo 7: dupla de projéteis com ângulos distintos.
  - Tipo 8: três tiros orientados com pequena abertura entre eles.
- A lógica original de tiros, quantidade de vida, invulnerabilidade, score e checkpoints é preservada. Os novos tiros **aumentam levemente a dificuldade da terceira fase dos quatro últimos tipos de chefes**, uma alteração intencional.

## 4. Testes reprodutíveis

Teste: `tests/boss-playtest.mjs` via Playwright + Chromium, somado aos testes já existentes de campanha, estresse de 16 inimigos/175 tiros e derrota real do boss1 → checkpoint e fase2.

O teste de chefe:
1. Carrega o jogo e inicia campanha normalmente;
2. instancia **8 tipos de chefes** e desenha cada um **36 vezes** em Alta, Equilibrado e Desempenho;
3. certifica que desenho não modifica coordenadas, HP nem emite projéteis;
4. confirma que o modo Alta não gera sprites e que os modos leves só armazenam os tipos selecionados;
5. provoca a terceira fase e verifica novos tiros exclusivamente nos tipos 5–8;
6. confirma que não houve erro de console JavaScript.

**Primeira execução (todas as verificações aprovadas):** [Actions 43260651276](https://github.com/jogoiarexx-blip/Neon-Sky-Force/actions/runs/43260651276).  
**Execução após a primeira seleção por perfil:** [Actions 43261157920](https://github.com/jogoiarexx-blip/Neon-Sky-Force/actions/runs/43261157920), aprovada.  
**Seleção final:** revisão adicional para evitar cache nos chefes 4–8 no Equilibrado e 5–8 no Desempenho. Verificar a última execução do GitHub Actions vinculada à versão publicada.

### Resultados e limitações

Na segunda execução, observou-se, em **36 desenhos** de bosses selecionados:
- Boss 1: 8,7 ms direto versus 5,0 ms no Equilibrado e 2,1 ms no Desempenho;
- Boss 3: 4,9 ms direto versus 3,7 ms no Equilibrado e 2,2 ms no Desempenho;
- Boss 4: 6,7 ms direto versus 7,3 ms no Equilibrado e 3,0 ms no Desempenho.

Esses tempos são de uma microamostra do **desenho isolado do boss** em SwiftShader, sem uma batalha completa nem taxa real de atualização estável. Variação entre execuções do CI é alta; **não se deve apresentar esses dados como FPS garantido para PC/Android**. A seleção final privilegia o caminho menos arriscado em cenários onde o cache não foi consistentemente superior.

## 5. Pendências

1. Campanha completa, jogada de modo natural até os créditos (não feita neste teste).
2. Benchmark confiável de lutas prolongadas com GPU real em notebook e Android, com percentil p95/p99 e 1% low.
3. Verificação visual manual de cada chefe e dos indicadores no celular e em monitor real.
4. Refinamento de sons específicos de telegraph/ataque e balanço da terceira fase segundo feedback dos jogadores.

## 6. Arquivos

- `js/boss-optimizer.js` — camada de cache adaptativo, avisos e rajadas finais.
- `index.html` — carrega a camada depois de todos os patches existentes.
- `tests/boss-playtest.mjs` — QA para 8 arquétipos de chefes.
- `.github/workflows/playtest.yml` — roda o QA novo em commits e publicação na main.
