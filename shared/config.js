// Configuração padrão do jogo. Compartilhada entre servidor e navegador.
// Os valores podem ser ajustados na página /teste e exportados em JSON.
// Para aplicar no jogo: salve o JSON baixado como game-config.json na raiz do projeto.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RC_CONFIG = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULT_CONFIG = {
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
    bulletRadius: 7,       // tamanho (raio) da bala
    bulletSpeed: 650,      // velocidade da bala
    maxBounces: 3,         // batidas na parede antes de sumir
    fireCooldown: 1.0,     // intervalo entre tiros (s)
    magSize: 20,           // balas por pente
    magazines: 4,          // pentes extras (recargas)
    reloadTime: 1.5,       // tempo de recarga (s)

    // ---- Faca ----
    knifeCooldown: 0.65,   // intervalo entre facadas (s)
    knifeRange: 30,        // alcance além do corpo
    knifeArc: 100,         // abertura do golpe (graus)

    // ---- Super pulo ----
    jumpCooldown: 25,      // tempo para ganhar 1 pulo (s)
    jumpDistance: 170,     // distância do pulo
    jumpDuration: 0.55,    // duração no ar (s)
    jumpStartReady: false, // começa o round já com pulo?

    // ---- HUD ----
    hudScale: 1,           // tamanho do HUD

    // ---- Partida ----
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
    hudScale: [0.5, 2, 0.05], roundStartDelay: [0, 10, 1], roundEndDelay: [0, 10, 1]
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
