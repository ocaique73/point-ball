// Efeitos visuais do tiro (valores padrão). O Editor de mapa (aba "Efeitos") muda estes números;
// o que foi salvo fica em edits3d.js (fx) e vale por cima destes.
export const FX_DEFAULT = {
  wand: { len: 200, segs: 8, core: 0.45, glow: 1.5, coreOp: 0.95, glowOp: 0.55, fade: 1.8, jitter: 5, head: 22, headCore: 9, forks: 2 },
  bullet: { size: 1, glow: 1 },
  explosion: { size: 1, fire: 7, ringFire: 16, smoke: 0.55, sparks: 34 }
};
// nomes e limites de cada número (usado pelo editor pra montar os controles)
export const FX_INFO = {
  wand: { _: 'Rastro da varinha', len: ['Comprimento do rastro', 40, 500, 5], segs: ['Pedaços do raio', 2, 16, 1], core: ['Grossura do miolo branco', 0.05, 2, 0.05], glow: ['Grossura do brilho colorido', 0.1, 5, 0.05], coreOp: ['Força do miolo (0 a 1)', 0, 1, 0.05], glowOp: ['Força do brilho (0 a 1)', 0, 1, 0.05], fade: ['Degradê (maior = some mais rápido atrás)', 0.3, 5, 0.1], jitter: ['Tremida do raio', 0, 20, 0.5], head: ['Tamanho da ponta brilhando', 4, 60, 1], headCore: ['Miolo da ponta', 0, 30, 1], forks: ['Faíscas do lado', 0, 4, 1] },
  bullet: { _: 'Tiro (flecha, pedra, bolinha)', size: ['Tamanho na tela', 0.3, 3, 0.05], glow: ['Brilho', 0, 3, 0.05] },
  explosion: { _: 'Explosão da granada', size: ['Tamanho do fogo', 0.3, 2.5, 0.05], fire: ['Bolas de fogo', 0, 16, 1], ringFire: ['Fogo em volta (mostra a área)', 0, 32, 1], smoke: ['Fumaça (0 a 1)', 0, 1, 0.05], sparks: ['Faíscas', 0, 120, 1] }
};
