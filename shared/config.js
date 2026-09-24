// Configuração padrão do jogo. Compartilhada entre servidor e navegador.
// Os valores podem ser ajustados na página /teste e exportados em JSON.
// Para aplicar no jogo: salve o JSON baixado como game-config.json na raiz do projeto.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RC_CONFIG = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULT_CONFIG = {
    cfgVersion: 6,         // muda quando os padrões mudam (o /teste descarta valores salvos antigos)

    // ---- Mapa ----
    mapWidth: 1600,        // largura do mapa (unidades do mundo)
    mapHeight: 1000,       // altura do mapa
    wallThickness: 24,     // grossura do muro
    mapScreenScale: 0.96,  // quanto da tela o mapa ocupa (0.3 a 1)

    // ---- Personagem ----
    playerRadius: 22,      // tamanho (raio) do personagem
    playerSpeed: 260,      // velocidade (unidades/segundo)
    lives: 2,              // vidas por round
    hitShrink: 0.5,        // tamanho após perder 1 vida (0.5 = 50% menor)
    blinkDuration: 1.5,    // tempo piscando após ser atingido (s)
    invulnDuration: 0.4,   // invulnerável logo após ser atingido (s)

    // ---- Arma ----
    bulletRadius: 5,       // tamanho (raio) da bala
    bulletSpeed: 700,      // velocidade da bala
    maxBounces: 3,         // batidas na parede antes de sumir
    fireCooldown: 1.0,     // intervalo entre tiros (s)
    magSize: 20,           // balas por pente
    magazines: 4,          // pentes extras (recargas)
    reloadTime: 1.5,       // tempo de recarga (s)

    // ---- Faca ----
    knifeCooldown: 0.4,    // intervalo entre facadas (s)
    knifeRange: 50,        // alcance além do corpo
    knifeArc: 100,         // abertura do golpe (graus)

    // ---- Super pulo ----
    jumpCooldown: 25,      // tempo para ganhar 1 pulo (s)
    jumpDistance: 170,     // distância do pulo
    jumpDuration: 0.55,    // duração no ar (s)
    jumpStartReady: false, // começa o round já com pulo?

    // ---- Sala escura (mapa 'escuro') ----
    lightsInterval: 25,    // tempo com a luz acesa (s)
    lightsFlicker: 1,      // tempo piscando antes de apagar (s)
    lightsOffDuration: 1,  // tempo com a luz apagada (s)
    bulletGlow: 0.55,      // brilho do tiro no escuro (0 a 1)

    // ---- Deserto: tempestade de areia ----
    sandInterval: 25,      // a cada quantos segundos (s)
    sandWarn: 2,           // aviso antes (areia juntando no meio) (s)
    sandDuration: 4,       // tempo indo do meio até as laterais (s)
    sandBand: 0.58,        // largura de cada parede de areia (fração do mapa)

    // ---- Floresta: furacão ----
    tornadoInterval: 25,   // a cada quantos segundos (s)
    tornadoGrow: 2,        // tempo nascendo, ainda sem efeito (s)
    tornadoActive: 4.5,    // tempo girando e andando pelo mapa (s)
    tornadoRadius: 132,    // tamanho do furacão
    tornadoSpinTime: 0.7,  // tempo girando dentro do furacão antes de ser jogado (s)
    tornadoSpeed: 330,     // velocidade do furacão
    tornadoThrow: 450,     // distância que joga o jogador
    tornadoAirTime: 0.9,   // tempo no ar quando é jogado (s)

    // ---- Neve: tempestade fria ----
    stormInterval: 25,     // a cada quantos segundos (s)
    stormWarn: 1,          // aviso antes de começar (s)
    stormDuration: 3.5,    // tempo descendo de cima pra baixo (s)
    stormBand: 0.3,        // altura da nevasca (fração do mapa)
    freezeSlow: 0.45,      // velocidade congelado (0.45 = 45%)
    freezeTime: 1.5,       // tempo congelado (s)

    // ---- HUD ----
    hudScale: 1,           // tamanho do HUD

    // ---- Partida ----
    roundTime: 120,        // tempo máximo do round (s) — acabou, empata
    roundStartDelay: 3,    // contagem antes do round (s)
    roundEndDelay: 3,      // pausa após o round (s)

    // ---- Rede ----
    tickRate: 60,
    sendRate: 30
  };

  // Limites usados pelos sliders da página /teste e para validar o JSON
  const LIMITS = {
    mapWidth: [800, 3200, 50], mapHeight: [500, 2000, 50], wallThickness: [8, 80, 1], mapScreenScale: [0.3, 1, 0.01],
    playerRadius: [8, 60, 1], playerSpeed: [60, 700, 5], lives: [1, 5, 1], hitShrink: [0.2, 1, 0.05],
    blinkDuration: [0, 5, 0.1], invulnDuration: [0, 3, 0.05],
    bulletRadius: [2, 30, 1], bulletSpeed: [100, 2000, 10], maxBounces: [1, 10, 1], fireCooldown: [0.05, 3, 0.05],
    magSize: [1, 100, 1], magazines: [0, 20, 1], reloadTime: [0, 6, 0.1],
    knifeCooldown: [0.1, 3, 0.05], knifeRange: [5, 150, 1], knifeArc: [20, 360, 5],
    jumpCooldown: [1, 120, 1], jumpDistance: [40, 600, 5], jumpDuration: [0.1, 2, 0.05],
    hudScale: [0.5, 2, 0.05],
    lightsInterval: [5, 120, 1], lightsFlicker: [0, 5, 0.1], lightsOffDuration: [0.2, 10, 0.1], bulletGlow: [0.1, 1, 0.05], roundStartDelay: [0, 10, 1], roundEndDelay: [0, 10, 1], roundTime: [20, 600, 5],
    sandInterval: [5, 120, 1], sandWarn: [0, 5, 0.1], sandDuration: [0.5, 15, 0.1], sandBand: [0.05, 1, 0.01], tornadoSpinTime: [0, 3, 0.05],
    tornadoInterval: [5, 120, 1], tornadoGrow: [0.2, 5, 0.1], tornadoActive: [0.5, 10, 0.1], tornadoRadius: [15, 200, 1],
    tornadoSpeed: [50, 1000, 10], tornadoThrow: [80, 1000, 10], tornadoAirTime: [0.3, 3, 0.05],
    stormInterval: [5, 120, 1], stormWarn: [0, 5, 0.1], stormDuration: [0.5, 15, 0.1],
    stormBand: [0.05, 1, 0.05], freezeSlow: [0.1, 1, 0.05], freezeTime: [0.1, 6, 0.1]
  };

  function mergeConfig(base, override) {
    const out = Object.assign({}, base);
    if (!override || typeof override !== 'object') return out;
    for (const k of Object.keys(base)) {
      if (!(k in override)) continue;
      const v = override[k];
      if (typeof base[k] === 'number' && typeof v === 'number' && isFinite(v)) {
        const lim = LIMITS[k];
        out[k] = lim ? Math.min(lim[1], Math.max(lim[0], v)) : v;
      } else if (typeof base[k] === 'boolean' && typeof v === 'boolean') out[k] = v;
    }
    return out;
  }

  return { DEFAULT_CONFIG, LIMITS, mergeConfig };
});
