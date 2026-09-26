// Monta o mundo da versão 3D a partir dos mapas do 2D (servidor e navegador usam isto, pra ficar igual).
// Os mapas do 3D são 40% maiores e têm coisas só deles: casa na árvore na floresta, iglus na neve, portas automáticas
// na nave, andar de cima no mapa dos portais, postes nas pontas dos muros da cidade, paredes mais altas etc.
import { PORTAL, PLAT, BORDER_H, CEILING_Y, forestTrees } from './sim3d.js';

export const MAP_SCALE = 1.4;
export const MAP_SCALE_OF = { deserto: 1.6 };

const segRect = (s, W, H, t) => {
  const x1 = s[0] * W, y1 = s[1] * H, x2 = s[2] * W, y2 = s[3] * H;
  return { x: Math.min(x1, x2) - t / 2, y: Math.min(y1, y2) - t / 2, w: Math.abs(x2 - x1) + t, h: Math.abs(y2 - y1) + t };
};
const same = (a, b) => Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5;
function findSeg(walls, seg, W, H, t) { const r = segRect(seg, W, H, t); return walls.findIndex((R) => !R.border && same(R, r)); }
const mirrorSeg = (s) => [1 - s[0], s[1], 1 - s[2], s[3]];

// iglu: anel de blocos (redondo por fora) com 2 entradas opostas e um teto em cima
export const IGLOO = { r: 250, wall: 160, roof: 46, seg: 44, door: 12 * Math.PI / 180, open: 50 }; // o dobro do tamanho; open = meia largura da porta (visual)
function iglooBoxes(x, z, ang, k) {
  const out = [], R = IGLOO.r, N = IGLOO.seg, s = 2 * R * Math.sin(Math.PI / N) + 6, rr = R - s / 2;
  for (let i = 0; i < N; i++) {
    const a = (i + 0.5) / N * Math.PI * 2;
    let d1 = Math.abs(Math.atan2(Math.sin(a - ang), Math.cos(a - ang))), d2 = Math.abs(Math.atan2(Math.sin(a - ang - Math.PI), Math.cos(a - ang - Math.PI)));
    if (Math.min(d1, d2) < IGLOO.door) continue; // entrada
    const cx = x + Math.cos(a) * rr, cz = z + Math.sin(a) * rr;
    out.push({ x: cx - s / 2, y: cz - s / 2, w: s, h: s, top: IGLOO.wall, igloo: k });
  }
  const q = R * 0.72; // teto (dá pra subir em cima)
  out.push({ x: x - q, y: z - q, w: q * 2, h: q * 2, y0: IGLOO.wall, top: IGLOO.wall + IGLOO.roof, igloo: k, roof: true });
  return out;
}

// casa na árvore (meio da floresta): tronco no meio, plataforma redonda bem alta (sem parapeito) e 2 escadas de mão
// presas no tronco — uma virada pra base de cada time — que sobem por um buraco no chão e saem no meio da casinha.
// O furacão passa por ela e joga longe quem estiver lá em cima.
export const TREEHOUSE = { r: 150, y: 380, th: 12, trunk: 34, hole: 64, holeW: 44, trunkTop: 620 };
function treehouseBoxes(cx, cz) {
  const { r, y, th, trunk, hole, holeW, trunkTop } = TREEHOUSE, out = [], y0 = y - th;
  const f = (x0, z0, x1, z1, extra) => out.push(Object.assign({ x: x0, y: z0, w: x1 - x0, h: z1 - z0 }, extra));
  f(cx - trunk, cz - trunk, cx + trunk, cz + trunk, { top: trunkTop, thouse: 'trunk' });
  // chão redondo = faixas (quase um círculo); a faixa do meio tem os 2 buracos das escadas, dos lados do tronco
  const bands = [[-150, -120], [-120, -80], [-80, -holeW], [holeW, 80], [80, 120], [120, 150]];
  for (const [z0, z1] of bands) { const m = (Math.abs(z0) + Math.abs(z1)) / 2, hw = Math.sqrt(Math.max(0, r * r - m * m)); f(cx - hw, cz + z0, cx + hw, cz + z1, { y0, top: y, thouse: 'floor' }); }
  const hx = trunk + hole, hwm = Math.sqrt(r * r - holeW * holeW);
  f(cx - hwm, cz - holeW, cx - hx, cz + holeW, { y0, top: y, thouse: 'floor' });
  f(cx + hx, cz - holeW, cx + hwm, cz + holeW, { y0, top: y, thouse: 'floor' });
  // (os 2 buracos das escadas ficam abertos: quem chega lá em cima sai pro chão do lado do buraco)
  // escadas de mão: na face do tronco virada pra cada base (x), sobe do chão até o chão da casinha
  const ladders = [{ x: cx - trunk, z: cz, nx: -1, nz: 0, half: 26, top: y, hole }, { x: cx + trunk, z: cz, nx: 1, nz: 0, half: 26, top: y, hole }];
  return { boxes: out, ladders, zone: { x0: cx - r, z0: cz - r, x1: cx + r, z1: cz + r } };
}

// mapa dos portais: aberturas em baixo (as do 2D) e em cima (no andar das passarelas)
const PORTAL_SLOTS = {
  L: [[0.18, 0.34, 0], [0.66, 0.82, 0], [0.42, 0.58, 1]],
  R: [[0.18, 0.34, 0], [0.66, 0.82, 0], [0.42, 0.58, 1]],
  T: [[0.28, 0.38, 0], [0.62, 0.72, 0], [0.45, 0.55, 1]],
  B: [[0.28, 0.38, 0], [0.62, 0.72, 0], [0.45, 0.55, 1]]
};
function portalWorld(W, H, t) {
  const BH = BORDER_H.portal, walls = [], slots = [], { rx, ry, cy } = PORTAL, out3 = {};
  for (const sd of ['L', 'R', 'T', 'B']) {
    const horiz = sd === 'T' || sd === 'B', len = horiz ? W : H, fixed = sd === 'L' || sd === 'T' ? 0 : (horiz ? H : W) - t;
    // retângulo na parede: u = ao longo da parede, de u0 a u1; y de y0 a top
    const piece = (u0, u1, extra) => { if (u1 - u0 <= 0.5) return; walls.push(Object.assign(horiz ? { x: u0, y: fixed, w: u1 - u0, h: t } : { x: fixed, y: u0, w: t, h: u1 - u0 }, { border: true, top: BH }, extra)); };
    const list = PORTAL_SLOTS[sd].slice().sort((a, b) => a[0] - b[0]);
    let u = 0;
    for (const [a, b, up] of list) {
      const i = slots.length, mid = (a + b) / 2 * len, half = (b - a) / 2 * len, base = up ? PLAT.y : 0;
      piece(u, mid - half);
      piece(mid - half, mid - rx, { pframe: i }); piece(mid + rx, mid + half, { pframe: i });
      if (base) piece(mid - rx, mid + rx, { pframe: i, top: base + cy - ry });
      piece(mid - rx, mid + rx, { pframe: i, y0: base + cy + ry + 2 });
      piece(mid - rx, mid + rx, { pframe: i, y0: base + cy - ry, top: base + cy + ry + 2, slotDoor: i }); // tampa do portal fechado
      u = mid + half;
      let bx, bz, nx = 0, nz = 0;
      if (sd === 'L') { bx = 0; bz = mid; nx = 1; } else if (sd === 'R') { bx = W; bz = mid; nx = -1; }
      else if (sd === 'T') { bx = mid; bz = 0; nz = 1; } else { bx = mid; bz = H; nz = -1; }
      slots.push({ i, s: sd, up: !!up, base, bx, bz, cx: bx + nx * t, cz: bz + nz * t, nx, nz, tx: nz, tz: -nx, t, half });
    }
    piece(u, len);
  }
  // andar de cima: passarela em volta de tudo (mais estreita nos cantos) + 2 pontes finas cruzando o mapa;
  // uma das pontes tem um buraco (quebrada) que dá pra pular por cima. Sem parapeito.
  const y0 = PLAT.y - PLAT.th, top = PLAT.y, Wk = PLAT.walk, Wc = PLAT.corner, Lc = PLAT.cornerLen, Bw = PLAT.bridge / 2;
  const plat = (x, y, w, h, extra) => { if (w > 1 && h > 1) walls.push(Object.assign({ x, y, w, h, y0, top, plat: true }, extra)); };
  for (const [zz, flip] of [[t, 0], [H - t, 1]]) { // em cima e embaixo (cantos de Wc x Wc)
    const z = (w) => (flip ? zz - w : zz);
    plat(t, z(Wc), Lc, Wc); plat(t + Lc, z(Wk), W - 2 * t - 2 * Lc, Wk); plat(W - t - Lc, z(Wc), Lc, Wc);
  }
  for (const [xx, flip] of [[t, 0], [W - t, 1]]) { // esquerda e direita
    const x = (w) => (flip ? xx - w : xx);
    plat(x(Wk), t + Lc, Wk, H - 2 * t - 2 * Lc);
  }
  plat(t + Wk, H / 2 - Bw, W - 2 * t - 2 * Wk, Bw * 2, { bridge: 'x' });
  const gz0 = PLAT.gapZ - PLAT.gap / 2, gz1 = PLAT.gapZ + PLAT.gap / 2; // o buraco na ponte (lado de cima do mapa)
  plat(W / 2 - Bw, t + Wk, Bw * 2, gz0 - t - Wk, { bridge: 'z', broken: 1 });
  plat(W / 2 - Bw, gz1, Bw * 2, H / 2 - Bw - gz1, { bridge: 'z', broken: 0 });
  plat(W / 2 - Bw, H / 2 + Bw, Bw * 2, H - t - Wk - H / 2 - Bw, { bridge: 'z' });
  out3.gap = { x0: W / 2 - Bw, x1: W / 2 + Bw, z0: gz0, z1: gz1 };
  return { walls, slots, gap: out3.gap };
}

// ---------- mapas só do 3D ----------
// retângulos normalizados [x, z, w, h, top?] (espelhados no x pro outro time)
const mirR = (list) => list.concat(list.map(([x, z, w, h, top, col, st, y0]) => [1 - x - w, z, w, h, top, col, st, y0]));
export const MAPS3D = {
  // estação de metrô: 2 linhas de trem cortando o mapa de cima a baixo; de 20 em 20 s o trem passa por uma e volta pela outra.
  // Cada base tem um mezanino alto com escada de degraus (dá pra atirar lá de cima; o nascimento é sempre embaixo)
  metro: {
    id: 'metro', name: 'Estação de metrô', hazard: 'train', lanes: [0.42, 0.58],
    theme: { ground: '#8e9094', ground2: '#84868a', wall: '#ece6d4', wallEdge: '#a09478', border: '#d8cfb6', deco: 'none' },
    rects: mirR([
      // equilibrado: pilares grossos espalhados, 2 muretas, a bilheteria e uma grade no meio da beira do trilho
      [0.2, 0.2, 0.03, 0.05, 330], [0.2, 0.75, 0.03, 0.05, 330], // pilares (mais grossos)
      [0.325, 0.3, 0.03, 0.05, 330], [0.325, 0.65, 0.03, 0.05, 330],
      [0.11, 0.24, 0.018, 0.17, 130], [0.11, 0.59, 0.018, 0.17, 130], // muretas perto do nascimento (maiores)
      [0.255, 0.43, 0.045, 0.14, 140], // bilheteria (maior)
      [0.37, 0.41, 0.014, 0.18, 110] // grade na beira do trilho
    ]).concat([ // ilha entre os 2 trilhos (no meio)
      [0.465, 0.15, 0.07, 0.05, 140], [0.465, 0.8, 0.07, 0.05, 140], [0.48, 0.43, 0.04, 0.14, 330]
    ])
  },
  // plataforma no mar: porto de carga (estilo Cargo): fileiras de contêineres com corredores; em vários lugares dá pra subir
  // de caixote em contêiner e ficar lá em cima — a subida é sempre do lado do seu time, de frente pro nascimento inimigo.
  // Ondas gigantes invadem por cima da borda (menos do lado do navio). [x, z, w, h, altura, cor, estilo, base]
  mar: {
    id: 'mar', name: 'Plataforma no mar', hazard: 'wave', ship: 'T',
    theme: { ground: '#9a7650', ground2: '#8a6844', wall: '#2f6f9f', wallEdge: '#1f4f75', border: '#8a939c', deco: 'none' },
    rects: mirR([
      [0.08, 0.3, 0.03, 0.12, 120, '#2f6f9f'], [0.08, 0.58, 0.03, 0.12, 120, '#b03a2e'], // contêineres em pé na frente do nascimento
      // subida de cima: caixote -> contêiner -> contêiner empilhado (sobe andando pro lado do inimigo)
      [0.2, 0.15, 0.03, 0.05, 48, '#9a6b3f', 'wood'], [0.23, 0.15, 0.1, 0.05, 100, '#b03a2e'], [0.28, 0.15, 0.05, 0.05, 150, '#2f6f9f', null, 100],
      [0.2, 0.8, 0.03, 0.05, 48, '#9a6b3f', 'wood'], [0.23, 0.8, 0.1, 0.05, 100, '#2f8f5b'], [0.28, 0.8, 0.05, 0.05, 150, '#d9822b', null, 100],
      [0.2, 0.24, 0.14, 0.05, 130, '#8a939c'], [0.2, 0.71, 0.14, 0.05, 130, '#8a939c'], // fileira de contêineres (corredor estreito)
      [0.15, 0.36, 0.12, 0.05, 130, '#d9822b'], [0.15, 0.59, 0.12, 0.05, 130, '#2f6f9f'], // contêineres deitados no meio do lado
      [0.4, 0.33, 0.05, 0.13, 130, '#2f8f5b'], [0.4, 0.54, 0.05, 0.13, 130, '#b03a2e'], // contêineres em pé perto do meio
      [0.42, 0.47, 0.025, 0.06, 48, '#9a6b3f', 'wood'], [0.445, 0.47, 0.025, 0.06, 100, '#8a939c'] // subida pra cabine do meio (dos 2 lados)
    ]).concat([
      [0.47, 0.44, 0.06, 0.12, 150, '#e5e7eb'], // cabine no meio (dá pra subir dos 2 lados)
      [0.44, 0.13, 0.12, 0.05, 130, '#2f8f5b'], [0.44, 0.82, 0.12, 0.05, 130, '#d9822b'] // contêineres atravessados em cima e embaixo
    ])
  },
  // canteiro de obras (formato de OCTÓGONO, cantos cortados em diagonal): guindaste no meio; de 20 em 20 s a bola de
  // demolição dá 2 voltas em volta dele e arremessa quem estiver no caminho (o círculo no chão mostra por onde ela passa)
  obra: {
    id: 'obra', name: 'Canteiro de obras', hazard: 'crane',
    theme: { ground: '#8a7458', ground2: '#7a6448', wall: '#a3a3a3', wallEdge: '#6b6b6b', border: '#8f8f8f', deco: 'none' },
    shape: [[0.19, 0], [0.81, 0], [1, 0.3], [1, 0.7], [0.81, 1], [0.19, 1], [0, 0.7], [0, 0.3]],
    rects: mirR([
      [0.07, 0.42, 0.02, 0.16, 130, '#a8a29e'], // mureta alta na frente do nascimento
      [0.13, 0.33, 0.06, 0.07, 100, '#a8a29e'], [0.13, 0.6, 0.06, 0.07, 100, '#a8a29e'], // blocos de concreto
      [0.21, 0.17, 0.02, 0.2, 150, '#c08a3e', 'wood'], [0.21, 0.63, 0.02, 0.2, 150, '#c08a3e', 'wood'], // tapumes compridos
      [0.17, 0.46, 0.045, 0.08, 80, '#6b7280'], // pilha de canos
      [0.3, 0.06, 0.12, 0.07, 150, '#e2b33c'], [0.3, 0.87, 0.12, 0.07, 150, '#e2b33c'], // contêiner do escritório
      [0.23, 0.26, 0.04, 0.05, 100, '#9a6b3f', 'wood'], [0.23, 0.69, 0.04, 0.05, 100, '#9a6b3f', 'wood'] // caixotes
    ]).concat([
      [0.485, 0.465, 0.03, 0.07, 480, '#e2b33c'], // torre do guindaste
      [0.45, 0.33, 0.1, 0.02, 130, '#a8a29e'], [0.45, 0.65, 0.1, 0.02, 130, '#a8a29e'] // muros perto do guindaste
    ])
  },
  // fábrica (formato de HEXÁGONO, fechada com telhado): sem evento, mas o mapa se mexe sozinho — pistões gigantes sobem
  // até a passarela do meio e até o alto das pilhas de estoque (e descem de novo), e 2 esteiras levam quem pisa nelas
  fabrica: {
    id: 'fabrica', name: 'Fábrica', hazard: null,
    theme: { ground: '#6b6f76', ground2: '#62666d', wall: '#7a5a48', wallEdge: '#4b3a30', border: '#5a5f66', deco: 'none' },
    shape: [[0, 0.3], [0.5, 0], [1, 0.3], [1, 0.7], [0.5, 1], [0, 0.7]],
    rects: mirR([
      [0.08, 0.36, 0.06, 0.1, 150, '#4b5563'], [0.08, 0.54, 0.06, 0.1, 150, '#4b5563'], // máquinas
      [0.17, 0.26, 0.05, 0.07, 90, '#9a6b3f', 'wood'], [0.17, 0.67, 0.05, 0.07, 90, '#9a6b3f', 'wood'], // caixotes
      [0.24, 0.2, 0.07, 0.1, 230, '#8a6a48', 'wood'], [0.24, 0.7, 0.07, 0.1, 230, '#8a6a48', 'wood'], // pilhas de estoque (dá pra subir pelo pistão)
      [0.38, 0.22, 0.02, 0.18, 170, '#6b7280'], [0.38, 0.6, 0.02, 0.18, 170, '#6b7280'] // paredes de cano
    ]).concat([
      [0.45, 0.2, 0.1, 0.04, 150, '#4b5563'], [0.45, 0.76, 0.1, 0.04, 150, '#4b5563'],
      [0.305, 0.475, 0.39, 0.05, 230, '#9aa3ae', null, 216] // passarela lá em cima cruzando o meio (sobe pelo pistão)
    ]),
    // pistões [x, z, w, h, altura máx, fase 0..1] — sobem até a altura da passarela / das pilhas (230)
    pistons: mirR([[0.265, 0.45, 0.035, 0.1, 232, 0], [0.2, 0.215, 0.035, 0.07, 232, 0.5], [0.2, 0.715, 0.035, 0.07, 232, 0.25]]),
    // esteiras [x, z, w, h, velocidade em z] (a da esquerda desce, a da direita sobe)
    belts: [[0.33, 0.14, 0.05, 0.72, 115], [0.62, 0.14, 0.05, 0.72, -115]]
  }
};
function buildWalls3D(def, W, H, t, borderH) {
  const walls = [{ x: 0, y: 0, w: W, h: t, border: true }, { x: 0, y: H - t, w: W, h: t, border: true }, { x: 0, y: 0, w: t, h: H, border: true }, { x: W - t, y: 0, w: t, h: H, border: true }];
  for (const R of walls) if (borderH) R.top = borderH;
  for (const [x, z, w, h, top, tint, style, y0] of def.rects) walls.push(Object.assign({ x: x * W, y: z * H, w: w * W, h: h * H, top: top || 120 }, tint ? { tint } : {}, style ? { style } : {}, y0 ? { y0 } : {}));
  // recortes do formato (mapa irregular): blocos altos que ninguém atravessa
  for (const [x, z, w, h] of def.voids || []) walls.push(Object.assign({ x: x * W, y: z * H, w: w * W, h: h * H, top: borderH || 240, void: true }, def.voidTint ? { tint: def.voidTint, style: def.voidStyle } : {}));
  for (const [x, z, w, h, hi, ph] of def.pistons || []) walls.push({ x: x * W, y: z * H, w: w * W, h: h * H, top: 4, piston: { lo: 4, hi, period: 10, phase: ph || 0 } });
  return walls;
}

export function world3D(mapId, G, MAPS, CFG) {
  if (MAPS3D[mapId] && !MAPS[mapId]) MAPS = Object.assign({}, MAPS, MAPS3D);
  const SC = MAP_SCALE_OF[mapId] || MAP_SCALE; // (deserto um pouco maior)
  const W = Math.round(CFG.mapWidth * SC), H = Math.round(CFG.mapHeight * SC), t = CFG.wallThickness;
  const cfg = Object.assign({}, CFG, { mapWidth: W, mapHeight: H });
  const out = { mapId, W, H, t, cfg, walls: [], portalSlots: [], lamps: null, holes: null, safeZones: [], cave: null, igloos: [], doors: [],
    terrain: mapId === 'deserto' ? 'dunes' : null, ceilingY: CEILING_Y[mapId] || null, borderH: BORDER_H[mapId] || null, hazard: MAPS[mapId] ? MAPS[mapId].hazard : null };
  if (mapId === 'teste' || !MAPS[mapId]) {
    out.walls = [{ x: -20, y: -20, w: 20, h: H + 40, border: true }, { x: W, y: -20, w: 20, h: H + 40, border: true }, { x: -20, y: -20, w: W + 40, h: 20, border: true }, { x: -20, y: H, w: W + 40, h: 20, border: true }];
    out.hazard = null; out.terrain = null;
    return out;
  }
  let walls = MAPS3D[mapId] ? buildWalls3D(MAPS3D[mapId], W, H, t, BORDER_H[mapId]) : G.buildWalls(mapId, cfg, 0);
  if (mapId === 'metro') {
    out.lanes = MAPS3D.metro.lanes.map((f) => f * W);
    // mezanino alto em cada base + 2 escadas de degraus (norte e sul) encostadas na parede de trás
    // escada mais larga e com parapeito só nela (em cima fica só o mezanino)
    const LH = 216, n = 10, sh = LH / n, sd = 24, lw = 160, sw = 120, pw = 12, z0 = 0.42 * H, z1 = 0.58 * H;
    for (const mir of [0, 1]) {
      const X = (x, w) => (mir ? W - x - w : x);
      walls.push({ x: X(t, lw), y: z0, w: lw, h: z1 - z0, y0: LH - 18, top: LH, mezz: true });
      for (let k = 1; k <= n; k++) {
        for (const zz of [z0 - (n - k + 1) * sd, z1 + (n - k) * sd]) {
          walls.push({ x: X(t, sw), y: zz, w: sw, h: sd, top: sh * k, mstep: true });
          walls.push({ x: X(t + sw, pw), y: zz, w: pw, h: sd, top: sh * k + 44, mrail: true });
        }
      }
    }
  }
  if (mapId === 'mar') out.ship = MAPS3D.mar.ship;
  // formato irregular: cada lado do contorno que não é a borda retangular vira parede em diagonal
  if (MAPS3D[mapId] && MAPS3D[mapId].shape) {
    const P = MAPS3D[mapId].shape.map(([x, z]) => [x * W, z * H]); out.shape = P; out.segs = [];
    const BH = BORDER_H[mapId] || 240, onEdge = (a, b) => (a[0] === b[0] && (a[0] <= 0.5 || a[0] >= W - 0.5)) || (a[1] === b[1] && (a[1] <= 0.5 || a[1] >= H - 0.5));
    for (let i = 0; i < P.length; i++) { const A = P[i], B = P[(i + 1) % P.length]; if (!onEdge(A, B)) out.segs.push({ ax: A[0], az: A[1], bx: B[0], bz: B[1], t: t / 2 + 4, top: BH, inf: true, border: true }); }
  }
  if (MAPS3D[mapId] && MAPS3D[mapId].belts) out.belts = MAPS3D[mapId].belts.map(([x, z, w, h, v]) => ({ x0: x * W, z0: z * H, x1: (x + w) * W, z1: (z + h) * H, vx: 0, vz: v }));
  const del = (seg) => { for (const s of [seg, mirrorSeg(seg)]) { const i = findSeg(walls, s, W, H, t); if (i >= 0) walls.splice(i, 1); } };
  const setTop = (seg, top) => { for (const s of [seg, mirrorSeg(seg)]) { const i = findSeg(walls, s, W, H, t); if (i >= 0) walls[i].top = top; } };

  if (mapId === 'portal') {
    const pw = portalWorld(W, H, t);
    walls = walls.filter((R) => !R.border).concat(pw.walls);
    out.portalSlots = pw.slots; out.bridgeGap = pw.gap;
  } else if (mapId === 'floresta') {
    del([0.39, 0.5, 0.44, 0.5]); // tira os tocos do meio pra caber a casa na árvore
    // caminho reto do meio da base até a escada da árvore: abre um vão no meio das paredes que ficavam na frente
    for (const seg of [[0.19, 0.42, 0.19, 0.58], [0.39, 0.36, 0.39, 0.64]]) {
      for (const sg of [seg, mirrorSeg(seg)]) {
        const i = findSeg(walls, sg, W, H, t); if (i < 0) continue;
        walls.splice(i, 1);
        const gap = 0.045;
        walls.push(segRect([sg[0], sg[1], sg[2], 0.5 - gap], W, H, t), segRect([sg[0], 0.5 + gap, sg[2], sg[3]], W, H, t));
      }
    }
    const th = treehouseBoxes(W / 2, H / 2);
    walls = walls.concat(th.boxes);
    out.treehouse = { x: W / 2, z: H / 2, zone: th.zone }; out.ladders = th.ladders;
    walls = walls.concat(forestTrees(W, H, walls, [th.zone, { x0: 0, x1: W, z0: H / 2 - 40, z1: H / 2 + 40 }]));
  } else if (mapId === 'neve') {
    // 2 iglus grandes no MEIO do mapa (um em cima e um embaixo), com as entradas viradas pra base de cada time
    for (const seg of [[0.42, 0.12, 0.42, 0.24], [0.42, 0.76, 0.42, 0.88]]) del(seg);
    for (const seg of [[0.5, 0.26, 0.5, 0.38], [0.5, 0.62, 0.5, 0.74]]) { const i = findSeg(walls, seg, W, H, t); if (i >= 0) walls.splice(i, 1); }
    [0.255, 0.745].forEach((nz, k) => {
      walls = walls.concat(iglooBoxes(W / 2, nz * H, 0, k));
      out.igloos.push({ x: W / 2, z: nz * H, ang: 0, k });
    });
  } else if (mapId === 'nave') {
    // layout próprio do 3D: a baia de nascimento de cada time e a sala do meio são fechadas;
    // só se passa pelas portas automáticas (abrem pros lados quando chega perto e fecham depois)
    walls = walls.filter((R) => R.border || R.space);
    let k = 0;
    const dh = 50;
    // parede com portas: seg normalizado [x1, z1, x2, z2], doors = posições (0..1) ao longo dela
    const wallDoors = (seg, doors) => {
      const x1 = seg[0] * W, z1 = seg[1] * H, x2 = seg[2] * W, z2 = seg[3] * H, horiz = Math.abs(z2 - z1) < 1;
      const a = horiz ? Math.min(x1, x2) : Math.min(z1, z2), b = horiz ? Math.max(x1, x2) : Math.max(z1, z2), fix = horiz ? z1 : x1;
      const piece = (u0, u1, extra) => { if (u1 - u0 < 1) return; walls.push(Object.assign(horiz ? { x: u0, y: fix - t / 2, w: u1 - u0, h: t } : { x: fix - t / 2, y: u0, w: t, h: u1 - u0 }, extra)); };
      let u = a - t / 2;
      for (const f of doors) {
        const m = a + (b - a) * f;
        piece(u, m - dh, { doorFrame: k }); walls.push(Object.assign(horiz ? { x: m - dh, y: fix - t / 2 + 5, w: dh * 2, h: t - 10 } : { x: fix - t / 2 + 5, y: m - dh, w: t - 10, h: dh * 2 }, { door3d: k }));
        out.doors.push({ k, x: horiz ? m : fix, z: horiz ? fix : m, half: dh, axis: horiz ? 'x' : 'z', t });
        u = m + dh; k++;
      }
      piece(u, b + t / 2);
    };
    for (const mir of [0, 1]) {
      const X = (x) => (mir ? 1 - x : x);
      wallDoors([X(0.2), 0, X(0.2), 1], [0.3, 0.7]);                  // fecha a baia de nascimento de ponta a ponta
      wallDoors([X(0.4), 0.22, X(0.4), 0.78], [0.5]);                  // lado da sala do meio
      const cover = [[X(0.3), 0.1, X(0.3), 0.26], [X(0.3), 0.74, X(0.3), 0.9], [Math.min(X(0.27), X(0.33)), 0.5, Math.max(X(0.27), X(0.33)), 0.5]];
      for (const c of cover) walls.push(segRect(c, W, H, t));
    }
    wallDoors([0.4, 0.22, 0.6, 0.22], [0.5]); wallDoors([0.4, 0.78, 0.6, 0.78], [0.5]); // em cima e embaixo da sala do meio
    walls.push(segRect([0.5, 0.42, 0.5, 0.58], W, H, t)); // cobertura no meio da sala
  } else if (mapId === 'obra') {
    for (const R of walls) if (R.top === 480) R.mast = true; // torre do guindaste (a treliça é desenhada à parte)
  } else if (mapId === 'escuro') {
    // umas paredes mais altas (até o teto no meio) e o resto aberto
    del([0.34, 0.5, 0.4, 0.5]);
    for (const R of walls) if (!R.border) R.top = BORDER_H.escuro; // todas as paredes até o teto
  } else if (mapId === 'vulcao') {
    // todas as paredes com a mesma altura
    out.holes = [];
  } else if (mapId === 'deserto') {
    // uma pirâmide só, ENORME, no meio do mapa (tira as paredes/dunas do meio pra caber)
    del([0.36, 0.5, 0.42, 0.5]);
    { const i = findSeg(walls, [0.5, 0.36, 0.5, 0.64], W, H, t); if (i >= 0) walls.splice(i, 1); }
    out.pyramids = [{ x: W / 2, z: H / 2, half: 330, top: 34, h: 390 }];
    // dunas mais pros cantos: afasta cada crista do meio do mapa (a base da pirâmide fica livre, em volta fica baixinho)
    for (const R of walls) {
      if (R.border) continue;
      const cx = R.x + R.w / 2, cz = R.y + R.h / 2, nx = cx + (cx - W / 2) * 0.35, nz = cz + (cz - H / 2) * 0.3;
      R.x = Math.max(t + 40, Math.min(W - t - 40 - R.w, nx - R.w / 2)); R.y = Math.max(t + 40, Math.min(H - t - 40 - R.h, nz - R.h / 2));
    }
  } else if (mapId === 'cidade') {
    // postes grudados nas pontas dos muros (menos postes, braço virado pra rua)
    // cada pedaço do mapa tem UM poste (apagou = aquele lugar fica escuro de verdade), e o mapa todo tem luz (base também)
    const o = t / 2 + 6, L = [
      [0.14 * W - o, 0.32 * H, -1, 0], [0.14 * W - o, 0.68 * H, -1, 0], // base (em cima e embaixo)
      [0.3 * W + o, 0.2 * H, 0, 1], [0.3 * W + o, 0.8 * H, 0, -1], // ruas de cima e de baixo
      [0.36 * W, 0.42 * H + o, 1, 0] // meio de cada lado (onde 3 pontas se encontram, 1 poste só)
    ];
    out.lamps = L.concat(L.map(([x, z, dx, dz]) => [W - x, z, -dx, dz]))
      .concat([[0.5 * W, 0.17 * H, 0, 1], [0.5 * W, 0.83 * H, 0, -1], [0.5 * W, 0.5 * H - o, 0, -1]]); // no meio do mapa (em cima, embaixo e no centro)
  }
  out.walls = walls;
  return out;
}

// opções do Sim3D a partir do mundo montado
export function simOptions(w) {
  return { cfg: w.cfg, hazard: w.hazard, portalSlots: w.portalSlots, holes: w.holes, terrain: w.terrain, ceilingY: w.ceilingY, borderH: w.borderH, lamps: w.lamps, safeZones: w.safeZones, pyramids: w.pyramids, lanes: w.lanes, ship: w.ship, ladders: w.ladders, belts: w.belts, segs: w.segs, shape: w.shape };
}
