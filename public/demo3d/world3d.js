// Monta o mundo da versão 3D a partir dos mapas do 2D (servidor e navegador usam isto, pra ficar igual).
// Os mapas do 3D são 40% maiores e têm coisas só deles: casa na árvore na floresta, iglus na neve, portas automáticas
// na nave, andar de cima no mapa dos portais, postes nas pontas dos muros da cidade, paredes mais altas etc.
import { PORTAL, PLAT, BORDER_H, CEILING_Y, forestTrees } from './sim3d.js';

export const MAP_SCALE = 1.4;

const segRect = (s, W, H, t) => {
  const x1 = s[0] * W, y1 = s[1] * H, x2 = s[2] * W, y2 = s[3] * H;
  return { x: Math.min(x1, x2) - t / 2, y: Math.min(y1, y2) - t / 2, w: Math.abs(x2 - x1) + t, h: Math.abs(y2 - y1) + t };
};
const same = (a, b) => Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5;
function findSeg(walls, seg, W, H, t) { const r = segRect(seg, W, H, t); return walls.findIndex((R) => !R.border && same(R, r)); }
const mirrorSeg = (s) => [1 - s[0], s[1], 1 - s[2], s[3]];

// iglu: anel de blocos (redondo por fora) com 2 entradas opostas e um teto em cima
export const IGLOO = { r: 130, wall: 112, roof: 34, seg: 28, door: 22 * Math.PI / 180, open: 44 }; // open = meia largura da porta (visual)
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

// casa na árvore (meio da floresta): tronco no meio, plataforma redonda lá em cima (sem parapeito) e 2 escadas.
// O furacão passa por ela e joga longe quem estiver lá em cima.
export const TREEHOUSE = { r: 150, y: 198, th: 12, trunk: 34, stepH: 22, stepD: 24, stairW: 72 };
function treehouseBoxes(cx, cz) {
  const { r, y, th, trunk, stepH, stepD, stairW } = TREEHOUSE, out = [], y0 = y - th;
  const f = (x0, z0, x1, z1, extra) => out.push(Object.assign({ x: x0, y: z0, w: x1 - x0, h: z1 - z0 }, extra));
  f(cx - trunk, cz - trunk, cx + trunk, cz + trunk, { top: 330, thouse: 'trunk' });
  // chão redondo = 3 retângulos que juntos quase fecham um círculo
  const a = r * 0.707, b = r * 0.42;
  f(cx - r, cz - b, cx + r, cz + b, { y0, top: y, thouse: 'floor' }); f(cx - b, cz - r, cx + b, cz + r, { y0, top: y, thouse: 'floor' }); f(cx - a, cz - a, cx + a, cz + a, { y0, top: y, thouse: 'floor' });
  // 2 escadas (uma de cada lado, pra cima e pra baixo no mapa); cada degrau é um bloco maciço
  const n = Math.round(y / stepH);
  for (const dir of [-1, 1]) for (let i = 0; i < n; i++) {
    const top = y - i * stepH, zA = cz + dir * (r - 6 + i * stepD), zB = zA + dir * stepD;
    f(cx - stairW / 2, Math.min(zA, zB), cx + stairW / 2, Math.max(zA, zB), { top, thouse: 'step' });
  }
  return { boxes: out, zone: { x0: cx - r, z0: cz - r - n * stepD, x1: cx + r, z1: cz + r + n * stepD } };
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
const mirR = (list) => list.concat(list.map(([x, z, w, h, top]) => [1 - x - w, z, w, h, top]));
export const MAPS3D = {
  // estação de metrô: 3 linhas de trem cortando o mapa de cima a baixo; de 20 em 20 s passa um trem numa delas
  metro: {
    id: 'metro', name: 'Estação de metrô', hazard: 'train', lanes: [0.34, 0.5, 0.66],
    theme: { ground: '#8e9094', ground2: '#84868a', wall: '#ece6d4', wallEdge: '#a09478', border: '#d8cfb6', deco: 'none' },
    rects: mirR([
      [0.212, 0.19, 0.022, 0.035, 330], [0.212, 0.39, 0.022, 0.035, 330], [0.212, 0.575, 0.022, 0.035, 330], [0.212, 0.775, 0.022, 0.035, 330], // pilares
      [0.41, 0.235, 0.022, 0.035, 330], [0.41, 0.4825, 0.022, 0.035, 330], [0.41, 0.73, 0.022, 0.035, 330],
      [0.11, 0.28, 0.012, 0.13, 120], [0.11, 0.59, 0.012, 0.13, 120], // muretas perto do nascimento
      [0.265, 0.46, 0.03, 0.08, 120], // bilheteria
      [0.25, 0.09, 0.05, 0.02, 60], [0.25, 0.89, 0.05, 0.02, 60] // bancos
    ])
  },
  // plataforma no mar: contêineres e caixotes; ondas gigantes invadem por cima da borda (menos do lado do navio)
  mar: {
    id: 'mar', name: 'Plataforma no mar', hazard: 'wave', ship: 'T',
    theme: { ground: '#9a7650', ground2: '#8a6844', wall: '#2f6f9f', wallEdge: '#1f4f75', border: '#8a939c', deco: 'none' },
    rects: mirR([
      [0.17, 0.13, 0.07, 0.17, 130], [0.17, 0.70, 0.07, 0.17, 130], // contêineres
      [0.33, 0.40, 0.045, 0.2, 90], // pilha de caixotes
      [0.27, 0.2, 0.03, 0.05, 55], [0.27, 0.75, 0.03, 0.05, 55], // caixote baixinho (dá pra subir)
      [0.41, 0.12, 0.05, 0.03, 70], [0.41, 0.85, 0.05, 0.03, 70] // barris
    ]).concat([[0.47, 0.46, 0.06, 0.08, 150]]) // cabine no meio
  }
};
function buildWalls3D(def, W, H, t, borderH) {
  const walls = [{ x: 0, y: 0, w: W, h: t, border: true }, { x: 0, y: H - t, w: W, h: t, border: true }, { x: 0, y: 0, w: t, h: H, border: true }, { x: W - t, y: 0, w: t, h: H, border: true }];
  for (const R of walls) if (borderH) R.top = borderH;
  for (const [x, z, w, h, top] of def.rects) walls.push({ x: x * W, y: z * H, w: w * W, h: h * H, top: top || 120 });
  return walls;
}

export function world3D(mapId, G, MAPS, CFG) {
  if (MAPS3D[mapId] && !MAPS[mapId]) MAPS = Object.assign({}, MAPS, MAPS3D);
  const W = Math.round(CFG.mapWidth * MAP_SCALE), H = Math.round(CFG.mapHeight * MAP_SCALE), t = CFG.wallThickness;
  const cfg = Object.assign({}, CFG, { mapWidth: W, mapHeight: H });
  const out = { mapId, W, H, t, cfg, walls: [], portalSlots: [], lamps: null, holes: null, safeZones: [], cave: null, igloos: [], doors: [],
    terrain: mapId === 'deserto' ? 'dunes' : null, ceilingY: CEILING_Y[mapId] || null, borderH: BORDER_H[mapId] || null, hazard: MAPS[mapId] ? MAPS[mapId].hazard : null };
  if (mapId === 'teste' || !MAPS[mapId]) {
    out.walls = [{ x: -20, y: -20, w: 20, h: H + 40, border: true }, { x: W, y: -20, w: 20, h: H + 40, border: true }, { x: -20, y: -20, w: W + 40, h: 20, border: true }, { x: -20, y: H, w: W + 40, h: 20, border: true }];
    out.hazard = null; out.terrain = null;
    return out;
  }
  let walls = MAPS3D[mapId] ? buildWalls3D(MAPS3D[mapId], W, H, t, BORDER_H[mapId]) : G.buildWalls(mapId, cfg, 0);
  if (mapId === 'metro') out.lanes = MAPS3D.metro.lanes.map((f) => f * W);
  if (mapId === 'mar') out.ship = MAPS3D.mar.ship;
  const del = (seg) => { for (const s of [seg, mirrorSeg(seg)]) { const i = findSeg(walls, s, W, H, t); if (i >= 0) walls.splice(i, 1); } };
  const setTop = (seg, top) => { for (const s of [seg, mirrorSeg(seg)]) { const i = findSeg(walls, s, W, H, t); if (i >= 0) walls[i].top = top; } };

  if (mapId === 'portal') {
    const pw = portalWorld(W, H, t);
    walls = walls.filter((R) => !R.border).concat(pw.walls);
    out.portalSlots = pw.slots; out.bridgeGap = pw.gap;
  } else if (mapId === 'floresta') {
    del([0.39, 0.5, 0.44, 0.5]); // tira os tocos do meio pra caber a casa na árvore
    const th = treehouseBoxes(W / 2, H / 2);
    walls = walls.concat(th.boxes);
    out.treehouse = { x: W / 2, z: H / 2, zone: th.zone };
    walls = walls.concat(forestTrees(W, H, walls, [th.zone]));
  } else if (mapId === 'neve') {
    // 2 iglus de cada lado (espelhados), com as entradas viradas pro meio e pra borda
    del([0.2, 0.4, 0.2, 0.6]); // tira a parede do meio de cada lado pra caber o iglu grande
    const spots = [[0.22, 0.5, 0]];
    spots.forEach(([nx, nz, a], k) => {
      for (const [x, ang, kk] of [[nx * W, a, k * 2], [W - nx * W, Math.PI - a, k * 2 + 1]]) {
        walls = walls.concat(iglooBoxes(x, nz * H, ang, kk));
        out.igloos.push({ x, z: nz * H, ang, k: kk });
      }
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
  } else if (mapId === 'escuro') {
    // umas paredes mais altas (até o teto no meio) e o resto aberto
    del([0.34, 0.5, 0.4, 0.5]);
    for (const R of walls) if (!R.border) R.top = BORDER_H.escuro; // todas as paredes até o teto
  } else if (mapId === 'vulcao') {
    // todas as paredes com a mesma altura
    out.holes = [];
  } else if (mapId === 'deserto') {
    out.pyramids = [{ x: 0.12 * W, z: 0.17 * H, half: 215, top: 26, h: 215 }, { x: 0.88 * W, z: 0.17 * H, half: 215, top: 26, h: 215 }];
  } else if (mapId === 'cidade') {
    // postes grudados nas pontas dos muros (menos postes, braço virado pra rua)
    const o = t / 2 + 6, L = [[0.3 * W + o, 0.2 * H, 0, 1], [0.3 * W + o, 0.8 * H, 0, -1], [0.36 * W, 0.42 * H + o, 1, 0]]; // onde 3 pontas se encontram, 1 poste só
    out.lamps = L.concat(L.map(([x, z, dx, dz]) => [W - x, z, -dx, dz]));
  }
  out.walls = walls;
  return out;
}

// opções do Sim3D a partir do mundo montado
export function simOptions(w) {
  return { cfg: w.cfg, hazard: w.hazard, portalSlots: w.portalSlots, holes: w.holes, terrain: w.terrain, ceilingY: w.ceilingY, borderH: w.borderH, lamps: w.lamps, safeZones: w.safeZones, pyramids: w.pyramids, lanes: w.lanes, ship: w.ship };
}
