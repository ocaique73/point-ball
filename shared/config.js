// Configuração padrão do jogo. Compartilhada entre servidor e navegador.
// Os valores podem ser ajustados na página /teste e exportados em JSON.
// Para aplicar no jogo: salve o JSON baixado como game-config.json na raiz do projeto.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RC_CONFIG = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULT_CONFIG = {
    cfgVersion: 12,         // muda quando os padrões mudam (o /teste descarta valores salvos antigos)

    // ---- Mapa ----
    mapWidth: 1600,        // largura do mapa (unidades do mundo)
    mapHeight: 1000,       // altura do mapa
    wallThickness: 24,     // grossura do muro
    mapScreenScale: 0.96,  // quanto da tela o mapa ocupa (0.3 a 1)

    // ---- Personagem ----
    playerRadius: 25,      // tamanho (raio) do personagem
    playerSpeed: 260,      // velocidade (unidades/segundo)
    lives: 2,              // vidas por round
    hitShrink: 0.65,       // tamanho após perder 1 vida (0.65 = 35% menor)
    blinkDuration: 1.5,    // tempo piscando após ser atingido (s)
    invulnDuration: 0.4,   // invulnerável logo após ser atingido (s)

    // ---- Arma ----
    bulletRadius: 5,       // tamanho (raio) da bala
    bulletSpeed: 660,      // velocidade da bala
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
    jumpCooldown: 15,      // tempo para ganhar 1 pulo (s)
    jumpDistance: 170,     // distância do pulo
    jumpDuration: 0.55,    // duração no ar (s)
    jumpStartReady: false, // começa o round já com pulo?

    // ---- Bomba (botão direito) ----
    bombCount: 1,          // bombas por round / por vida
    bombRange: 380,        // distância máxima do lançamento
    bombFlight: 0.6,       // tempo voando no alcance máximo (s)
    bombFuse: 0.6,         // tempo no chão até explodir (s)
    bombRadius: 105,       // raio da explosão
    // ---- Fumaça (rodinha do mouse) — voa igual à bomba ----
    smokeCount: 1,         // fumaças por round / por vida
    smokeRadius: 200,      // raio da cortina de fumaça
    smokeTime: 5,          // quanto tempo a fumaça dura (s)
    smokeCore: 0.55,       // parte do meio totalmente fechada (0.55 = 55% do raio); daí até a borda vai clareando

    // ---- Cidade à noite ----
    lampLight: 190,        // raio da luz de cada poste
    lampOff: 8,            // tempo que o poste fica apagado depois de levar tiro (s)
    nightSee: 110,         // no escuro você enxerga só isso em volta de você
    nightDark: 0.9,        // quão escuro fica fora da luz (0-1)
    // ---- Vulcão ----
    lavaInterval: 25,      // a cada quantos segundos a lava sobe (s)
    lavaWarn: 2,           // aviso piscando antes (s)
    lavaDuration: 7,       // tempo com lava (s)
    lavaPairs: 3,          // pares de poças (um de cada lado)
    lavaRadius: 75,        // tamanho médio da poça
    // ---- Nave espacial ----
    meteorInterval: 25,    // a cada quantos segundos caem os 2 meteoros (s)
    meteorWarn: 2,         // tempo mostrando onde vai cair (s)
    holeRadius: 75,        // tamanho do buraco
    holeTime: 18,          // tempo até o buraco ser consertado (s)
    holeGrace: 1.1,        // tempo "segurando" na beira antes de cair (s)
    holePull: 55,          // força que o buraco puxa (unid/s)

    // ---- Mata-mata ----
    respawnDelay: 2,       // tempo para renascer (s)
    spawnProtect: 1,       // proteção ao renascer, sem poder atirar (s)

    // ---- Rei da colina ----
    hillRadius: 130,       // tamanho da colina
    hillPointsPerSec: 1,   // pontos por segundo dominando
    hillMoveEvery: 40,     // a colina muda de lugar a cada (s)

    // ---- Portais (mapa 'portal') ----
    portalFirstOpen: 3,    // abertos no começo do round, cima <-> baixo (s)
    portalFirstClosed: 6,  // depois fecham por esse tempo (s), e aí começa o ciclo normal
    portalOpen: 10,        // tempo aberto (s)
    portalClosed: 5,       // tempo fechado entre as aberturas (s)

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
    stormBand: [0.05, 1, 0.05], bombCount: [0, 5, 1], bombRange: [80, 900, 10], bombFlight: [0.1, 2, 0.05],
    bombFuse: [0, 3, 0.05], bombRadius: [20, 300, 5], smokeCount: [0, 5, 1], smokeRadius: [40, 400, 5], smokeTime: [0.5, 20, 0.5], smokeCore: [0.1, 1, 0.05], lampLight: [60, 500, 5], lampOff: [0, 60, 0.5], nightSee: [0, 400, 5], nightDark: [0.3, 1, 0.01], lavaInterval: [5, 120, 1], lavaWarn: [0, 5, 0.1], lavaDuration: [0.5, 30, 0.5], lavaPairs: [1, 6, 1], lavaRadius: [20, 200, 5], meteorInterval: [5, 120, 1], meteorWarn: [0.5, 5, 0.1], holeRadius: [20, 200, 5], holeTime: [2, 120, 1], holeGrace: [0, 3, 0.05], holePull: [0, 300, 5], respawnDelay: [0, 10, 0.5], hillRadius: [40, 400, 5], hillPointsPerSec: [0.1, 10, 0.1], hillMoveEvery: [5, 300, 1], portalFirstOpen: [0, 30, 0.5], portalFirstClosed: [0, 60, 1], portalOpen: [1, 60, 1], portalClosed: [1, 60, 1], spawnProtect: [0, 5, 0.1], freezeSlow: [0.1, 1, 0.05], freezeTime: [0.1, 6, 0.1]
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
