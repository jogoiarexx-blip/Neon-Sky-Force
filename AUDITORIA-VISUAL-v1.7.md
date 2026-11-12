# Neon Sky Force — Auditoria e melhorias v1.7

Data: 12/11/2026  
Base: v1.6 Streaming Stages  
Escopo: apresentação, menus, desempenho de renderização (sem alterar lógica da campanha).

## Diagnóstico da base v1.6

- Menu principal renderizado dentro do canvas 420×640, com dificuldade e textos fixos. Ao mesmo tempo, os botões CONTINUAR/REGISTROS/CONFIGURAÇÕES eram HTML sobrepostos na tela.
- Interface legada com múltiplos tons neon, excesso de sombras e estilos não unificados em pausa, game over, vitória e configurações.
- O cenário recriava um gradiente vertical a cada frame; o pós-processamento recriava gradiente radial e desenhava 160 scanlines individualmente por frame.
- Cada disparo redesenhava dois gradientes e uma sombra, causando custo acumulado em sequências com muitos tiros.
- Canvas com densidade de até 2x sem opção de desempenho; 120 estrelas geradas inicialmente em todos os dispositivos.

## Alterações da v1.7

### Visual e navegação
- Novo hangar principal responsivo: nave vetorial, título, briefing, dificuldade em quatro cartões, botão principal e atalhos coerentes.
- Ações de CONTINUAR, REGISTROS e CONFIGURAÇÕES integradas ao mesmo painel, sem sobreposições com o canvas.
- Nova linguagem visual tática para pausa, vitória, game over, registros, configuração e remapeamento.
- Menus com navegação por teclado, foco visível, controles acessíveis, rolagem nos notebooks e suporte mobile.
- Diálogo de configuração/registro bloqueia o atalho global de iniciar campanha ao pressionar ENTER/ESPAÇO (exceto durante remapeamento).

### Gráficos e desempenho
- Qualidade **Desempenho**: backing buffer limitado a 1x, 50 estrelas, até 110 partículas, sem pós-processamento e sem trilhos extras.
- Qualidade **Equilibrado**: backing buffer até 1,5x, 90 estrelas, até 240 partículas, trilhos de profundidade e pós-processamento básico.
- Qualidade **Alta**: backing buffer até 2x, 120 estrelas, até 380 partículas e projéteis com gradientes originais.
- Modos Desempenho e Equilibrado usam projéteis com trilhas simples e legíveis, sem dois gradientes por projétil/frame.
- Gradiente de céu em cache por fase; pós-processamento usa padrão de scanline cacheado e vinheta cacheada.
- Menu HTML cobre o canvas: a tela de menu deixou de renderizar dezenas de partículas e textos animados a cada frame.
- Configurações: qualidade, redução de efeitos e contador FPS opcionais, salvos no navegador (chave: `nsf_v17_visual`).

### Compatibilidade
- Não modifica IA, dano, colisão, chefes, fase, checkpoints, ranking, áudio, progressão ou carregamento das 10 fases.
- Mantém o sistema v1.6 de streaming e módulos de fase.
- A qualidade pode ser alterada sem reiniciar o jogo.

## Testes efetuados
- Parse sintático JavaScript: 16/16 arquivos JS sem erro.
- Integridade do HTML: IDs sem duplicação, scripts existentes e novos IDs de interface presentes.
- Testes funcionais isolados com mocks: 8/8 aprovados (cap de estrelas, buffer, menu, recorde, checkpoint ausente, dificuldade, troca de qualidade e início da campanha).
- **Não realizados nesta entrega:** FPS medidos com GPU real, screenshots comparativos de desktop/celular, teste real de navegação completo pelas dez fases e stress test com chefe/centenas de disparos. Os valores de cap são limites implementados, **não** promessa de FPS.

## Próxima etapa recomendada
1. Playtest real em desktop 1366×768 e celular de tela estreita: menú, carregamento, pause, configurações, game over e retorno ao menu.
2. Medir FPS e tempo por frame com partículas/chefes; ajustar o modo Equilibrado ao hardware.
3. Criar spritesheets WebP/atlas das naves e cenários por fase; comparar memória e carga gráfica antes/depois.

Arquivos principais: `index.html`, `css/style.css`, `js/game.js`, `js/visual-polish.js`.
