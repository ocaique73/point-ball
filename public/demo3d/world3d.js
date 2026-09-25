// Monta o mundo da versão 3D a partir dos mapas do 2D (servidor e navegador usam isto, pra ficar igual).
// Os mapas do 3D são 40% maiores e têm coisas só deles: caverna na floresta, iglus na neve, portas automáticas
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
export const IGLOO = { r: 95, wall: 104, roof: 30, seg: 22, door: 36 * Math.PI / 180 };
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

// caverna da floresta: sala de pedra com 4 saídas (uma em cada lado) e teto; o furacão não entra
export const CAVE = { hw: 135, hh: 205, wall: 30, h: 150, roof: 26, exit: 50 };
function caveBoxes(cx, cz) {
  const { hw, hh, wall: t, h, roof, exit } = CAVE, out = [], x0 = cx - hw, x1 = cx + hw, z0 = cz - hh, z1 = cz + hh;
  const f = (x, y, w, hgt) => out.push({ x, y, w, h: hgt, top: h, cave: true });
  f(x0, z0, cx - exit - x0, t); f(cx + exit, z0, x1 - cx - exit, t); // lado de cima (com saída no meio)
  f(x0, z1 - t, cx - exit - x0, t); f(cx + exit, z1 - t, x1 - cx - exit, t);
  f(x0, z0 + t, t, cz - exit - z0 - t); f(x0, cz + exit, t, z1 - t - cz - exit); // lado esquerdo
  f(x1 - t, z0 + t, t, cz - exit - z0 - t); f(x1 - t, cz + exit, t, z1 - t - cz - exit);
  out.push({ x: x0, y: z0, w: hw * 2, h: hh * 2, y0: h, top: h + roof, cave: true, roof: true });
  return { boxes: out, zone: { x0, z0, x1, z1 } };
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
    plat(x(Wc), t + Wc, Wc, Lc - Wc); plat(x(Wk), t + Lc, Wk, H - 2 * t - 2 * Lc); plat(x(Wc), H - t - Lc, Wc, Lc - Wc);
  }
  plat(t + Wk, H / 2 - Bw, W - 2 * t - 2 * Wk, Bw * 2, { bridge: 'x' });
  const gz0 = PLAT.gapZ - PLAT.gap / 2, gz1 = PLAT.gapZ + PLAT.gap / 2; // o buraco na ponte (lado de cima do mapa)
  plat(W / 2 - Bw, t + Wk, Bw * 2, gz0 - t - Wk, { bridge: 'z', broken: 1 });
  plat(W / 2 - Bw, gz1, Bw * 2, H / 2 - Bw - gz1, { bridge: 'z', broken: 0 });
  plat(W / 2 - Bw, H / 2 + Bw, Bw * 2, H - t - Wk - H / 2 - Bw, { bridge: 'z' });
  out3.gap = { x0: W / 2 - Bw, x1: W / 2 + Bw, z0: gz0, z1: gz1 };
  return { walls, slots, gap: out3.gap };
}

export function world3D(mapId, G, MAPS, CFG) {
  const W = Math.round(CFG.mapWidth * MAP_SCALE), H = Math.round(CFG.mapHeight * MAP_SCALE), t = CFG.wallThickness;
  const cfg = Object.assign({}, CFG, { mapWidth: W, mapHeight: H });
  const out = { mapId, W, H, t, cfg, walls: [], portalSlots: [], lamps: null, holes: null, safeZones: [], cave: null, igloos: [], doors: [],
    terrain: mapId === 'deserto' ? 'dunes' : null, ceilingY: CEILING_Y[mapId] || null, borderH: BORDER_H[mapId] || null, hazard: MAPS[mapId] ? MAPS[mapId].hazard : null };
  if (mapId === 'teste' || !MAPS[mapId]) {
    out.walls = [{ x: -20, y: -20, w: 20, h: H + 40, border: true }, { x: W, y: -20, w: 20, h: H + 40, border: true }, { x: -20, y: -20, w: W + 40, h: 20, border: true }, { x: -20, y: H, w: W + 40, h: 20, border: true }];
    out.hazard = null; out.terrain = null;
    return out;
  }
  let walls = G.buildWalls(mapId, cfg, 0);
  const del = (seg) => { for (const s of [seg, mirrorSeg(seg)]) { const i = findSeg(walls, s, W, H, t); if (i >= 0) walls.splice(i, 1); } };
  const setTop = (seg, top) => { for (const s of [seg, mirrorSeg(seg)]) { const i = findSeg(walls, s, W, H, t); if (i >= 0) walls[i].top = top; } };

  if (mapId === 'portal') {
    const pw = portalWorld(W, H, t);
    walls = walls.filter((R) => !R.border).concat(pw.walls);
    out.portalSlots = pw.slots; out.bridgeGap = pw.gap;
  } else if (mapId === 'floresta') {
    del([0.39, 0.5, 0.44, 0.5]); // tira os tocos do meio pra caber a caverna
    const cv = caveBoxes(W / 2, H / 2);
    walls = walls.concat(cv.boxes);
    out.cave = cv.zone; out.safeZones = [cv.zone];
    walls = walls.concat(forestTrees(W, H, walls, [cv.zone]));
  } else if (mapId === 'neve') {
    // 2 iglus de cada lado (espelhados), com as entradas viradas pro meio e pra borda
    const spots = [[0.335, 0.14, 0], [0.335, 0.86, 0]];
    spots.forEach(([nx, nz, a], k) => {
      for (const [x, ang, kk] of [[nx * W, a, k * 2], [W - nx * W, Math.PI - a, k * 2 + 1]]) {
        walls = walls.concat(iglooBoxes(x, nz * H, ang, kk));
        out.igloos.push({ x, z: nz * H, ang, k: kk });
      }
    });
  } else if (mapId === 'nave') {
    // portas automáticas no meio de 4 paredes (abrem pros lados quando chega perto)
    let k = 0;
    for (const seg of [[0.16, 0.32, 0.16, 0.68], [0.84, 0.32, 0.84, 0.68], [0.5, 0.12, 0.5, 0.28], [0.5, 0.72, 0.5, 0.88]]) {
      const i = findSeg(walls, seg, W, H, t); if (i < 0) continue;
      const R = walls[i], mid = R.y + R.h / 2, dh = 50;
      walls.splice(i, 1,
        { x: R.x, y: R.y, w: R.w, h: mid - dh - R.y, doorFrame: k },
        { x: R.x, y: mid + dh, w: R.w, h: R.y + R.h - mid - dh, doorFrame: k },
        { x: R.x + 5, y: mid - dh, w: R.w - 10, h: dh * 2, door3d: k });
      out.doors.push({ k, x: R.x + R.w / 2, z: mid, half: dh, axis: 'z', t: R.w });
      k++;
    }
  } else if (mapId === 'escuro') {
    // umas paredes mais altas (até o teto no meio) e o resto aberto
    setTop([0.5, 0.1, 0.5, 0.28], BORDER_H.escuro); setTop([0.5, 0.72, 0.5, 0.9], BORDER_H.escuro);
    setTop([0.3, 0.14, 0.3, 0.38], 210); setTop([0.3, 0.62, 0.3, 0.86], 210);
    del([0.34, 0.5, 0.4, 0.5]);
  } else if (mapId === 'vulcao') {
    for (const R of walls) if (R.mv) R.top = 190; // as paredes do meio ficam mais altas
    out.holes = [];
  } else if (mapId === 'cidade') {
    // postes grudados nas pontas dos muros (menos postes, braço virado pra rua)
    const o = t / 2 + 6, L = [[0.3 * W + o, 0.2 * H, 0, 1], [0.3 * W + o, 0.8 * H, 0, -1], [0.36 * W, 0.42 * H + o, 1, 0], [0.36 * W, 0.58 * H - o, 1, 0]];
    out.lamps = L.concat(L.map(([x, z, dx, dz]) => [W - x, z, -dx, dz]));
  }
  out.walls = walls;
  return out;
}

// opções do Sim3D a partir do mundo montado
export function simOptions(w) {
  return { cfg: w.cfg, hazard: w.hazard, portalSlots: w.portalSlots, holes: w.holes, terrain: w.terrain, ceilingY: w.ceilingY, borderH: w.borderH, lamps: w.lamps, safeZones: w.safeZones };
}
