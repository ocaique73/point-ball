// Mapas do jogo. Paredes são segmentos (x1,y1,x2,y2) em coordenadas normalizadas (0..1),
// então o mapa se adapta ao tamanho configurado. A metade esquerda é espelhada para a direita
// para os dois times terem o mesmo terreno.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RC_MAPS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function mirror(half, center) {
    const out = [];
    for (const s of half) {
      out.push(s);
      out.push([1 - s[0], s[1], 1 - s[2], s[3]]);
    }
    return out.concat(center || []);
  }

  function mirrorPts(half) {
    const out = [];
    for (const p of half) { out.push(p); out.push([1 - p[0], p[1]]); }
    return out;
  }

  const MAPS = {
    deserto: {
      id: 'deserto',
      name: 'Deserto',
      hazard: 'sand', // tempestade de areia do meio para as laterais (tampa a visão)
      theme: { ground: '#e8c98f', ground2: '#dfbc7c', wall: '#a8733f', wallEdge: '#7a5028', deco: 'rocks', border: '#6b4524' },
      walls: mirror([
        [0.15, 0.36, 0.15, 0.64],
        [0.28, 0.1, 0.28, 0.3],
        [0.28, 0.7, 0.28, 0.9],
        [0.38, 0.2, 0.45, 0.2],
        [0.38, 0.8, 0.45, 0.8],
        [0.36, 0.5, 0.42, 0.5]
      ], [[0.5, 0.36, 0.5, 0.64]])
    },
    neve: {
      id: 'neve',
      name: 'Neve',
      hazard: 'storm', // tempestade fria descendo de cima para baixo
      theme: { ground: '#eef4fa', ground2: '#dde8f3', wall: '#8fb3d6', wallEdge: '#5f86ad', deco: 'snow', border: '#4b6f94' },
      walls: mirror([
        [0.1, 0.2, 0.26, 0.2],
        [0.1, 0.8, 0.26, 0.8],
        [0.2, 0.4, 0.2, 0.6],
        [0.34, 0.3, 0.34, 0.46],
        [0.34, 0.54, 0.34, 0.7],
        [0.42, 0.12, 0.42, 0.24],
        [0.42, 0.76, 0.42, 0.88]
      ], [[0.44, 0.5, 0.56, 0.5], [0.5, 0.26, 0.5, 0.38], [0.5, 0.62, 0.5, 0.74]])
    },
    floresta: {
      id: 'floresta',
      name: 'Floresta',
      hazard: 'tornado', // furacão que joga os jogadores longe
      theme: { ground: '#7fb069', ground2: '#72a35d', wall: '#5a3e2b', wallEdge: '#3b271a', deco: 'tree', border: '#2f1f14' },
      walls: mirror([
        [0.13, 0.16, 0.28, 0.16],
        [0.28, 0.16, 0.28, 0.32],
        [0.13, 0.84, 0.28, 0.84],
        [0.28, 0.68, 0.28, 0.84],
        [0.19, 0.42, 0.19, 0.58],
        [0.39, 0.36, 0.39, 0.64],
        [0.39, 0.5, 0.44, 0.5]
      ], [[0.46, 0.18, 0.54, 0.18], [0.46, 0.82, 0.54, 0.82]])
    },
    escuro: {
      id: 'escuro',
      name: 'Sala escura',
      dark: true, // a luz apaga de tempos em tempos
      hazard: 'dark',
      theme: { ground: '#2b2d33', ground2: '#26282d', wall: '#15161a', wallEdge: '#454955', deco: 'tiles', border: '#0b0b0d' },
      walls: mirror([
        [0.12, 0.3, 0.22, 0.3],
        [0.12, 0.7, 0.22, 0.7],
        [0.3, 0.14, 0.3, 0.38],
        [0.3, 0.62, 0.3, 0.86],
        [0.4, 0.32, 0.4, 0.68],
        [0.34, 0.5, 0.4, 0.5]
      ], [[0.5, 0.1, 0.5, 0.28], [0.5, 0.72, 0.5, 0.9], [0.45, 0.5, 0.55, 0.5]])
    }
  };

  // Portais: 2 em cada muro de borda; abrem 2 pares sorteados; quem entra num sai no par dele
  MAPS.portal = {
    id: 'portal',
    name: 'Portais',
    hazard: 'portal',
    // 8 aberturas: 2 em cada lado. A cada abertura, 4 delas (2 pares) abrem sorteadas
    portals: { L: [[0.18, 0.34], [0.66, 0.82]], R: [[0.18, 0.34], [0.66, 0.82]], T: [[0.28, 0.38], [0.62, 0.72]], B: [[0.28, 0.38], [0.62, 0.72]] },
    theme: { ground: '#1d1a36', ground2: '#241f45', wall: '#4b3f8f', wallEdge: '#8b7cf6', deco: 'tiles', border: '#2c245e' },
    walls: mirror([
      [0.18, 0.1, 0.18, 0.28],
      [0.18, 0.72, 0.18, 0.9],
      [0.3, 0.4, 0.3, 0.6],
      [0.24, 0.5, 0.3, 0.5],
      [0.4, 0.2, 0.4, 0.36],
      [0.4, 0.64, 0.4, 0.8]
    ], [[0.46, 0.5, 0.54, 0.5], [0.5, 0.1, 0.5, 0.26], [0.5, 0.74, 0.5, 0.9]])
  };

  // Cidade à noite: escuro o tempo todo, só os postes iluminam. Atirar no poste apaga a luz por um tempo
  MAPS.cidade = {
    id: 'cidade',
    name: 'Cidade à noite',
    hazard: 'city',
    lamps: mirrorPts([[0.085, 0.5], [0.22, 0.1], [0.22, 0.9], [0.3, 0.5], [0.44, 0.34], [0.44, 0.66]]).concat([[0.5, 0.2], [0.5, 0.8]]),
    theme: { ground: '#2a2d35', ground2: '#30343d', wall: '#3b3f4a', wallEdge: '#5b6170', deco: 'city', border: '#16181d' },
    walls: mirror([
      [0.14, 0.2, 0.3, 0.2],
      [0.14, 0.2, 0.14, 0.32],
      [0.14, 0.8, 0.3, 0.8],
      [0.14, 0.68, 0.14, 0.8],
      [0.24, 0.4, 0.24, 0.6],
      [0.36, 0.28, 0.36, 0.42],
      [0.36, 0.58, 0.36, 0.72],
      [0.42, 0.1, 0.42, 0.2],
      [0.42, 0.8, 0.42, 0.9]
    ], [[0.46, 0.5, 0.54, 0.5]])
  };

  // Vulcão: poças de lava nascem em lugares sorteados (sempre espelhadas) e as paredes do meio mudam de lugar
  MAPS.vulcao = {
    id: 'vulcao',
    name: 'Vulcão',
    hazard: 'lava',
    theme: { ground: '#3a2a26', ground2: '#46322c', wall: '#5a4038', wallEdge: '#2b1d18', deco: 'ash', border: '#1f1411' },
    walls: mirror([
      [0.14, 0.24, 0.14, 0.4],
      [0.14, 0.6, 0.14, 0.76],
      [0.28, 0.12, 0.28, 0.26],
      [0.28, 0.74, 0.28, 0.88]
    ]),
    // paredes que mudam: alterna entre os dois desenhos a cada erupção
    layouts: [
      mirror([[0.36, 0.3, 0.36, 0.46], [0.36, 0.54, 0.36, 0.7], [0.22, 0.5, 0.3, 0.5]], [[0.46, 0.5, 0.54, 0.5]]),
      mirror([[0.33, 0.38, 0.43, 0.38], [0.33, 0.62, 0.43, 0.62], [0.22, 0.44, 0.22, 0.56]], [[0.5, 0.26, 0.5, 0.4], [0.5, 0.6, 0.5, 0.74]])
    ]
  };

  // Nave espacial: a cada 25 s caem 2 meteoros (um de cada lado, sempre espelhados) e abrem buracos para o espaço
  MAPS.nave = {
    id: 'nave',
    name: 'Nave espacial',
    hazard: 'meteor',
    space: true,
    // cantos "cortados" (casco da nave) — é espaço, ninguém passa
    blocks: [[0, 0, 0.1, 0.07], [0, 0.07, 0.035, 0.05], [0.9, 0, 0.1, 0.07], [0.965, 0.07, 0.035, 0.05],
      [0, 0.93, 0.1, 0.07], [0, 0.88, 0.035, 0.05], [0.9, 0.93, 0.1, 0.07], [0.965, 0.88, 0.035, 0.05]],
    theme: { ground: '#2b3340', ground2: '#323b4a', wall: '#56627a', wallEdge: '#8a9bb8', deco: 'panels', border: '#39435a' },
    walls: mirror([
      [0.16, 0.32, 0.16, 0.68],
      [0.3, 0.14, 0.3, 0.3],
      [0.3, 0.7, 0.3, 0.86],
      [0.4, 0.42, 0.4, 0.58],
      [0.34, 0.5, 0.4, 0.5]
    ], [[0.5, 0.12, 0.5, 0.28], [0.5, 0.72, 0.5, 0.88]])
  };

  // posições de nascimento (normalizadas) - time A à esquerda, time B à direita
  const SPAWNS_Y = [0.5, 0.3, 0.7, 0.12, 0.88];
  const SPAWN_X = 0.055;

  return { MAPS, SPAWNS_Y, SPAWN_X, MAP_IDS: Object.keys(MAPS) };
});
