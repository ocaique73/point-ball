// Monta o mundo da versão 3D a partir dos mapas do 2D (servidor e navegador usam isto, pra ficar igual).
// Os mapas do 3D são 40% maiores e têm coisas só deles: casa na árvore na floresta, iglus na neve, portas automáticas
// na nave, andar de cima no mapa dos portais, postes nas pontas dos muros da cidade, paredes mais altas etc.
import { PORTAL, PLAT, BORDER_H, CEILING_Y, forestTrees, TREE } from './sim3d.js';
import BAKED_EDITS from './edits3d.js';

// ---------- editor de mapa: os ajustes salvos (edits3d.js) e, só no navegador de quem edita, o rascunho do editor ----------
let EDIT_OVERRIDE = null;
export function setEditOverride(o) { EDIT_OVERRIDE = o && typeof o === 'object' ? o : null; }
export function activeEdits() { return EDIT_OVERRIDE || BAKED_EDITS || {}; }
export const bakedEdits = () => BAKED_EDITS;
// o que o editor pode mexer: muros/caixas soltos, paredes diagonais, montanhas de areia, pirâmides e árvores
// (as peças especiais — iglu, casa na árvore, torres, portas, navio... — ficam fixas)
const SPECIAL = ['border', 'space', 'igloo', 'thouse', 'door3d', 'doorFrame', 'pframe', 'plat', 'slotDoor', 'mezz', 'mstep', 'mrail', 'piston', 'mast', 'keep', 'kroof', 'merlon', 'tpillar', 'cdeck', 'cabin', 'crail', 'sstep', 'smast', 'rail', 'bridge', 'void', 'hatch'];
export function isEditable(R) { return !SPECIAL.some((k) => R[k] != null && R[k] !== false); }
const r4 = (v) => Math.round(v * 10000) / 10000;
export function editableItems(w) {
  const W = w.W, H = w.H, out = [];
  for (const R of w.walls) {
    if (!isEditable(R)) continue;
    if (R.crest) out.push({ t: 'dune', ax: r4(R.crest[0] / W), az: r4(R.crest[1] / H), bx: r4(R.crest[2] / W), bz: r4(R.crest[3] / H), hk: R.dune[0], wk: R.dune[1] });
    else if (R.tree) out.push({ t: 'tree', x: r4((R.x + R.w / 2) / W), z: r4((R.y + R.h / 2) / H) });
    else out.push(Object.assign({ t: 'box', x: r4(R.x / W), z: r4(R.y / H), w: r4(R.w / W), h: r4(R.h / H), top: Math.round(R.top != null ? R.top : 120) }, R.y0 ? { y0: Math.round(R.y0) } : {}, R.tint ? { tint: R.tint } : {}, R.style ? { style: R.style } : {}));
  }
  for (const S of w.segs || []) if (S.user) out.push({ t: 'wall2', ax: r4(S.ax / W), az: r4(S.az / H), bx: r4(S.bx / W), bz: r4(S.bz / H), th: Math.round(S.t * 2), top: Math.round(S.top) });
  for (const q of w.pyramids || []) out.push({ t: 'pyr', x: r4(q.x / W), z: r4(q.z / H), half: q.half, top: q.top, h: q.h });
  return out;
}
function applyMapEdits(mapId, out, walls, W, H) {
  const E = activeEdits().maps && activeEdits().maps[mapId];
  if (!E || !Array.isArray(E.items)) { // sem ajuste: numera as peças na mesma ordem do editor (pra achar a peça clicando no 3D)
    let k = 0; for (const R of walls) if (isEditable(R)) R.item = k++;
    for (const S of out.segs || []) if (S.user) S.item = k++;
    for (const q of out.pyramids || []) q.item = k++;
    return walls;
  }
  const keep = walls.filter((R) => !isEditable(R)), n = (v, d) => (Number.isFinite(+v) ? +v : d);
  const pyr = [];
  E.items.forEach((it, item) => {
    if (it.t === 'box') keep.push(Object.assign({ item, x: n(it.x, 0) * W, y: n(it.z, 0) * H, w: Math.max(4, n(it.w, 0.02) * W), h: Math.max(4, n(it.h, 0.02) * H), top: n(it.top, 120) }, it.y0 ? { y0: n(it.y0, 0) } : {}, it.tint ? { tint: String(it.tint).slice(0, 9) } : {}, it.style ? { style: String(it.style).slice(0, 12) } : {}));
    else if (it.t === 'tree') keep.push({ item, x: n(it.x, 0.5) * W - TREE.r, y: n(it.z, 0.5) * H - TREE.r, w: TREE.r * 2, h: TREE.r * 2, tree: true, top: TREE.top });
    else if (it.t === 'dune') { const ax = n(it.ax, 0) * W, az = n(it.az, 0) * H, bx = n(it.bx, 0) * W, bz = n(it.bz, 0) * H; keep.push({ item, x: Math.min(ax, bx) - 12, y: Math.min(az, bz) - 12, w: Math.abs(bx - ax) + 24, h: Math.abs(bz - az) + 24, top: 120, crest: [ax, az, bx, bz], dune: [n(it.hk, 1), n(it.wk, 2)] }); }
    else if (it.t === 'wall2') { out.segs = out.segs || []; out.segs.push({ ax: n(it.ax, 0) * W, az: n(it.az, 0) * H, bx: n(it.bx, 0) * W, bz: n(it.bz, 0) * H, t: Math.max(4, n(it.th, 24)) / 2, top: n(it.top, 120), user: true, item }); }
    else if (it.t === 'pyr') pyr.push({ item, x: n(it.x, 0.5) * W, z: n(it.z, 0.5) * H, half: n(it.half, 230), top: n(it.top, 26), h: n(it.h, 270) });
  });
  if (mapId === 'deserto' || pyr.length) out.pyramids = pyr;
  return keep;
}


export const MAP_SCALE = 1.4;
export const MAP_SCALE_OF = { deserto: 1.6, castelo: 1.7 };

const segRect = (s, W, H, t) => {
  const x1 = s[0] * W, y1 = s[1] * H, x2 = s[2] * W, y2 = s[3] * H;
  return { x: Math.min(x1, x2) - t / 2, y: Math.min(y1, y2) - t / 2, w: Math.abs(x2 - x1) + t, h: Math.abs(y2 - y1) + t };
};
const same = (a, b) => Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5;
function findSeg(walls, seg, W, H, t) { const r = segRect(seg, W, H, t); return walls.findIndex((R) => !R.border && same(R, r)); }
const mirrorSeg = (s) => [1 - s[0], s[1], 1 - s[2], s[3]];

// iglu: anel de blocos (redondo por fora) com 3 entradas em triângulo (120° uma da outra: nenhuma dá visão direta pra outra) e um teto em cima
export const IGLOO = { r: 250, wall: 160, roof: 46, seg: 44, door: 12 * Math.PI / 180, open: 50, doors: [0, 2 * Math.PI / 3, -2 * Math.PI / 3] }; // o dobro do tamanho; open = meia largura da porta (visual)
function iglooBoxes(x, z, ang, k) {
  const out = [], R = IGLOO.r, N = IGLOO.seg, s = 2 * R * Math.sin(Math.PI / N) + 6, rr = R - s / 2;
  for (let i = 0; i < N; i++) {
    const a = (i + 0.5) / N * Math.PI * 2;
    if (IGLOO.doors.some((k) => Math.abs(Math.atan2(Math.sin(a - ang - k), Math.cos(a - ang - k))) < IGLOO.door)) continue; // entrada
    const cx = x + Math.cos(a) * rr, cz = z + Math.sin(a) * rr;
    out.push({ x: cx - s / 2, y: cz - s / 2, w: s, h: s, top: IGLOO.wall, igloo: k });
  }
  const q = R * 0.72; // teto (dá pra subir em cima)
  out.push({ x: x - q, y: z - q, w: q * 2, h: q * 2, y0: IGLOO.wall, top: IGLOO.wall + IGLOO.roof, igloo: k, roof: true });
  return out;
}

// ---------- peças redondas (paredes em anel feitas de pedacinhos de parede reta) ----------
// anel de parede: n pedaços; "cut(a)" diz, pra cada pedaço (ângulo do meio), as faixas de altura [y0, top] que existem
function ringSegs(cx, cz, R, half, n, cut) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, am = (a0 + a1) / 2;
    for (const [y0, top] of cut(am)) if (top - y0 > 1) out.push({ ax: cx + Math.cos(a0) * R, az: cz + Math.sin(a0) * R, bx: cx + Math.cos(a1) * R, bz: cz + Math.sin(a1) * R, t: half, y0, top, ring: true });
  }
  return out;
}
const angDist = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
// torre do castelo: parede redonda, coluna no meio e rampa em espiral por dentro (2 voltas) até a sacada lá em cima.
// Embaixo 2 portas; lá em cima a rampa chega num patamar com uma porta aberta pra sacada em volta da torre (sem parapeito).
export const TOWER = { R: 112, half: 8, n: 28, pillar: 22, r0: 32, r1: 100, top: 300, turns: 2, wallTop: 420, door: 48, lintel: 130, bal: 72, balDoor: 100 };
function towerParts(cx, cz, a0, dir) {
  const T = TOWER, segs = [], discs = [], spirals = [], boxes = [];
  const gd = [a0 - dir * 0.2, a0 - dir * 1.9], bd = a0 + dir * 0.42; // portas de baixo (logo antes do começo da rampa e mais pro lado) e da sacada
  const dh = T.door / T.R; // meia largura da porta em ângulo
  segs.push(...ringSegs(cx, cz, T.R, T.half, T.n, (am) => {
    if (gd.some((g) => angDist(am, g) < dh)) return [[T.lintel, T.wallTop]]; // porta embaixo (com verga em cima)
    if (angDist(am, bd) < dh * 1.1) return [[0, T.top], [T.top + T.balDoor, T.wallTop]]; // porta da sacada
    return [[0, T.wallTop]];
  }));
  boxes.push({ x: cx - T.pillar, y: cz - T.pillar, w: T.pillar * 2, h: T.pillar * 2, top: T.wallTop, tpillar: true });
  spirals.push({ cx, cz, r0: T.r0, r1: T.r1, y0: 0, y1: T.top, a0, turns: T.turns, dir, th: 10 });
  const la = dir > 0 ? [a0 - 0.05, a0 + 0.95] : [a0 - 0.95, a0 + 0.05];
  discs.push({ cx, cz, r0: T.r0 - 4, r1: T.R, y0: T.top - 12, top: T.top, a0: la[0], a1: la[1], landing: true }); // patamar lá em cima
  discs.push({ cx, cz, r0: T.R - 2, r1: T.R + T.bal, y0: T.top - 14, top: T.top, balcony: true }); // sacada em volta (sem parapeito)
  discs.push({ cx, cz, r0: 0, r1: T.R + 6, y0: T.wallTop, top: T.wallTop + 12, roof: true }); // teto da torre
  return { segs, discs, spirals, boxes, tower: { x: cx, z: cz, a0, dir, gd, bd } };
}

// casa na árvore (meio da floresta): tronco no meio, plataforma redonda bem alta (sem parapeito) e 2 escadas de mão
// presas no tronco — uma virada pra base de cada time — que sobem por um buraco no chão e saem no meio da casinha.
// O furacão passa por ela e joga longe quem estiver lá em cima.
export const TREEHOUSE = { r: 150, y: 380, th: 12, trunk: 34, hole: 64, holeW: 44, trunkTop: 620, tilt: 34 };
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
  // os 2 buracos das escadas têm TAMPA (alçapão): ninguém cai lá de cima; quem sobe sai em cima da tampa e,
  // pra descer, fica em cima da tampa de costas pra fora e aperta S (desce pela escada)
  f(cx - hx, cz - holeW, cx - trunk, cz + holeW, { y0, top: y, thouse: 'hatch' });
  f(cx + trunk, cz - holeW, cx + hx, cz + holeW, { y0, top: y, thouse: 'hatch' });
  // escadas de mão: na face do tronco virada pra cada base (x), sobe do chão até o chão da casinha
  // (a escada é um pouco inclinada: o pé fica afastado do tronco, que é mais largo embaixo)
  const ladders = [{ x: cx - trunk, z: cz, nx: -1, nz: 0, half: 26, top: y, hole, tilt: 34 }, { x: cx + trunk, z: cz, nx: 1, nz: 0, half: 26, top: y, hole, tilt: 34 }];
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

// deserto: cristas de areia [ax, az, bx, bz, altura (x108), largura (x150), no meio?] e pirâmides [x, z, meia-base, topo, altura]
// (cada uma aparece de novo girada no outro lado do mapa, menos as marcadas "no meio")
export const DESERT_LAYOUT = {
  pyramids: [[0.14, 0.22, 230, 26, 270], [0.14, 0.78, 230, 26, 270]], // 2 em cada base: uma em cada ponta
  dunes: [
    [0.5, 0.33, 0.5, 0.67, 2.35, 2.5, 1], // montanha alta bem no meio (tampa a visão de lado a lado)
    [0.5, 0.06, 0.5, 0.2, 1.3, 2.0], // no meio em cima (e embaixo, girada)
    [0.37, 0.24, 0.42, 0.38, 1.7, 2.2], // montanhas médias/altas em volta do meio
    [0.37, 0.62, 0.43, 0.76, 1.2, 2.1],
    [0.28, 0.44, 0.28, 0.58, 0.9, 1.8], // no meio do caminho entre a base e o meio
    [0.3, 0.86, 0.4, 0.9, 0.5, 1.9], // larga e baixinha
    [0.3, 0.1, 0.36, 0.16, 0.45, 1.7] // baixinha perto da pirâmide
  ]
};

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
      [0.2, 0.2, 0.03, 0.05, 480], [0.2, 0.75, 0.03, 0.05, 480], // pilares (mais grossos)
      [0.325, 0.3, 0.03, 0.05, 480], [0.325, 0.65, 0.03, 0.05, 480],
      [0.11, 0.24, 0.018, 0.17, 130], [0.11, 0.59, 0.018, 0.17, 130], // muretas perto do nascimento (maiores)
      [0.255, 0.43, 0.045, 0.14, 140], // bilheteria (maior)
      [0.37, 0.41, 0.014, 0.18, 110] // grade na beira do trilho
    ]).concat([ // ilha entre os 2 trilhos (no meio)
      [0.465, 0.15, 0.07, 0.05, 140], [0.465, 0.8, 0.07, 0.05, 140], [0.48, 0.43, 0.04, 0.14, 480]
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
  },
  // castelo de magia (estilo escola de bruxos): castelo grande no meio com um salão, terraço em cima e 4 torres redondas —
  // dentro de cada torre uma rampa em espiral sobe até uma sacada em volta dela (sem parapeito), pra atirar lá de cima
  castelo: {
    id: 'castelo', name: 'Castelo', hazard: null,
    theme: { ground: '#6f8a4c', ground2: '#647d44', wall: '#a6a6a2', wallEdge: '#6e6e6a', border: '#96968f', deco: 'none' },
    keep: [0.39, 0.33, 0.61, 0.67], // salão do meio [x0, z0, x1, z1]
    rects: mirR([
      [0.1, 0.2, 0.025, 0.16, 100, '#4e7a3a', 'hedge'], [0.1, 0.64, 0.025, 0.16, 100, '#4e7a3a', 'hedge'], // cercas vivas na frente do nascimento
      [0.19, 0.44, 0.035, 0.12, 120, '#a6a6a2', 'stone'], // mureta de pedra no meio do lado
      [0.2, 0.1, 0.07, 0.05, 130, '#8f897c', 'stone'], [0.2, 0.85, 0.07, 0.05, 130, '#8f897c', 'stone'], // ruínas nos cantos
      [0.27, 0.27, 0.03, 0.045, 150, '#b7b0a2', 'stone'], [0.27, 0.685, 0.03, 0.045, 150, '#b7b0a2', 'stone'], // pedestais de estátua
      [0.3, 0.46, 0.022, 0.08, 70, '#6b4a2a', 'wood'], // carroça de feno
      [0.44, 0.39, 0.016, 0.03, 228, '#8a847a', 'stone'], [0.44, 0.58, 0.016, 0.03, 228, '#8a847a', 'stone'] // colunas do salão
    ]).concat([
      [0.465, 0.1, 0.07, 0.05, 120, '#8f897c', 'stone'], [0.465, 0.85, 0.07, 0.05, 120, '#8f897c', 'stone'], // poços / portões
      [0.47, 0.47, 0.06, 0.06, 60, '#5a3f2a', 'wood'] // mesa grande no meio do salão
    ])
  },
  // navio antigo de bruxos numa tempestade: fora do casco é mar (caiu, morreu); o navio balança e inclina (mexe no pulo),
  // de 20 em 20 s vem uma onda grande de lado e ele inclina forte (tudo escorrega). Castelo de popa e de proa com cabine
  // por dentro, 3 mastros com escada de corda até o cesto lá em cima.
  navio: {
    id: 'navio', name: 'Navio na tempestade', hazard: 'swell',
    theme: { ground: '#7a5634', ground2: '#6e4c2d', wall: '#5e3f25', wallEdge: '#3f2a18', border: '#4a3220', deco: 'none' },
    hull: [[0.02, 0.5], [0.08, 0.3], [0.17, 0.21], [0.83, 0.21], [0.92, 0.3], [0.98, 0.5], [0.92, 0.7], [0.83, 0.79], [0.17, 0.79], [0.08, 0.7]],
    rects: mirR([
      [0.265, 0.34, 0.035, 0.05, 56, '#7a5a38', 'wood'], [0.265, 0.61, 0.035, 0.05, 56, '#7a5a38', 'wood'], // caixotes
      [0.29, 0.38, 0.02, 0.035, 38, '#6b4a2a', 'barrel'], [0.29, 0.59, 0.02, 0.035, 38, '#6b4a2a', 'barrel'], // barris
      [0.36, 0.225, 0.035, 0.03, 34, '#2d2d2d', 'cannon'], [0.36, 0.745, 0.035, 0.03, 34, '#2d2d2d', 'cannon'], // canhões na borda
      [0.42, 0.225, 0.035, 0.03, 34, '#2d2d2d', 'cannon'], [0.42, 0.745, 0.035, 0.03, 34, '#2d2d2d', 'cannon'],
      [0.39, 0.44, 0.028, 0.12, 74, '#7a5a38', 'wood'] // pilha de caixotes no meio do lado
    ]).concat([
      [0.46, 0.42, 0.08, 0.16, 22, '#4a3220', 'grate'] // escotilha grande no meio (dá pra subir)
    ])
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
    // mezanino alto em cada base + 2 RAMPAS (norte e sul) encostadas na parede de trás, com parapeito só na rampa
    // (a física usa degrauzinhos bem baixos = sobe liso, sem a câmera pular; o desenho é uma rampa inteira)
    const LH = 216, run = 330, lw = 160, sw = 120, pw = 12, z0 = 0.42 * H, z1 = 0.58 * H;
    out.ramps = []; out.slopes = [];
    for (const mir of [0, 1]) {
      const X = (x, w) => (mir ? W - x - w : x);
      walls.push({ x: X(t, lw), y: z0, w: lw, h: z1 - z0, y0: LH - 18, top: LH, mezz: true });
      // rampa lisa (a física calcula a altura certinha em cada ponto) + parapeito inclinado só nela
      const rx = X(t, sw), px = X(t + sw, pw);
      out.slopes.push({ x0: rx, x1: rx + sw, z0: z0 - run, z1: z0, axis: 'z', h0: 0, h1: LH }, { x0: rx, x1: rx + sw, z0: z1, z1: z1 + run, axis: 'z', h0: LH, h1: 0 });
      out.slopes.push({ x0: px, x1: px + pw, z0: z0 - run, z1: z0, axis: 'z', h0: 44, h1: LH + 44, rail: true }, { x0: px, x1: px + pw, z0: z1, z1: z1 + run, axis: 'z', h0: LH + 44, h1: 44, rail: true });
      // desenho: [x, largura, z do pé, z do topo, altura]
      out.ramps.push({ x: rx, w: sw, rx: px, rw: pw, zf: z0 - run, zt: z0, h: LH }, { x: rx, w: sw, rx: px, rw: pw, zf: z1 + run, zt: z1, h: LH });
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
    // 2 iglus grandes no MEIO do mapa (um em cima e um embaixo): 1 entrada virada pro meio do mapa e 2 viradas pros lados
    for (const seg of [[0.42, 0.12, 0.42, 0.24], [0.42, 0.76, 0.42, 0.88]]) del(seg);
    for (const seg of [[0.5, 0.26, 0.5, 0.38], [0.5, 0.62, 0.5, 0.74]]) { const i = findSeg(walls, seg, W, H, t); if (i >= 0) walls.splice(i, 1); }
    [0.255, 0.745].forEach((nz, k) => {
      const ang = k ? -Math.PI / 2 : Math.PI / 2; // a entrada principal aponta pro meio do mapa
      walls = walls.concat(iglooBoxes(W / 2, nz * H, ang, k));
      out.igloos.push({ x: W / 2, z: nz * H, ang, k });
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
  } else if (mapId === 'castelo') {
    // salão do meio: paredes grossas com 4 portas (verga em cima), terraço no telhado com ameias, e as 4 torres nos cantos
    const [kx0, kz0, kx1, kz1] = MAPS3D.castelo.keep.map((v, i) => v * (i % 2 ? H : W)), kt = 26, KH = 240, dw = 55;
    const kcx = (kx0 + kx1) / 2, kcz = (kz0 + kz1) / 2;
    const kw = (x, y, w, h, extra) => walls.push(Object.assign({ x, y, w, h, top: KH, keep: true, tint: '#a6a6a2', style: 'stone' }, extra));
    for (const x of [kx0, kx1 - kt]) { kw(x, kz0, kt, kcz - dw - kz0); kw(x, kcz + dw, kt, kz1 - kcz - dw); kw(x, kcz - dw, kt, dw * 2, { y0: 150 }); }
    for (const z of [kz0, kz1 - kt]) { kw(kx0 + kt, z, kcx - dw - kx0 - kt, kt); kw(kcx + dw, z, kx1 - kt - kcx - dw, kt); kw(kcx - dw, z, dw * 2, kt, { y0: 150 }); }
    walls.push({ x: kx0, y: kz0, w: kx1 - kx0, h: kz1 - kz0, y0: KH - 12, top: KH, kroof: true, tint: '#7d776b' }); // terraço (telhado reto)
    // ameias em volta do terraço (dá pra se esconder atrás)
    const mer = (x, y, w, h) => walls.push({ x, y, w, h, y0: KH, top: KH + 26, merlon: true, tint: '#a6a6a2', style: 'stone' });
    for (let x = kx0 + 30; x < kx1 - 60; x += 78) { mer(x, kz0, 34, 16); mer(x, kz1 - 16, 34, 16); }
    for (let z = kz0 + 30; z < kz1 - 60; z += 78) { mer(kx0, z, 16, 34); mer(kx1 - 16, z, 16, 34); }
    // 4 torres (uma em cada canto, um pouco pra fora): a porta de baixo virada pra base do time daquele lado
    out.segs = []; out.discs = []; out.spirals = []; out.towers = [];
    const o = 85;
    for (const [cx, cz, a0, dir] of [[kx0 - o, kz0 - o, Math.PI + 0.2, 1], [kx0 - o, kz1 + o, Math.PI - 0.2, -1], [kx1 + o, kz0 - o, -0.2, -1], [kx1 + o, kz1 + o, 0.2, 1]]) {
      const T = towerParts(cx, cz, a0, dir);
      out.segs.push(...T.segs); out.discs.push(...T.discs); out.spirals.push(...T.spirals); walls = walls.concat(T.boxes); out.towers.push(T.tower);
    }
  } else if (mapId === 'navio') {
    // navio: sem muro de borda (em volta é mar); a amurada é baixinha (dá pra pular e cair no mar)
    walls = walls.filter((R) => !R.border);
    const P = MAPS3D.navio.hull.map(([x, z]) => [x * W, z * H]);
    out.deck = { poly: P, kill: -140 }; out.shape = P; out.spawnX = [0.12 * W, 0.31 * W]; out.segs = []; out.discs = []; out.ladders = []; out.masts = [];
    for (let i = 0; i < P.length; i++) { const A = P[i], B = P[(i + 1) % P.length]; out.segs.push({ ax: A[0], az: A[1], bx: B[0], bz: B[1], t: 7, y0: 0, top: 30, rail: true }); }
    // castelo de popa (time A) e de proa (time B): cabine por dentro, convés em cima com amurada e 2 escadas de frente
    const CH = 110, CY0 = 96;
    for (const mir of [0, 1]) {
      const X = (x, w) => (mir ? W - x - w : x), xa = 0.105 * W, xb = 0.225 * W, za = 0.28 * H, zb = 0.72 * H, zc = 0.5 * H, dz = 0.04 * H;
      walls.push({ x: X(xa, xb - xa), y: za, w: xb - xa, h: zb - za, y0: CY0, top: CH, cdeck: true, tint: '#7a5634', style: 'plank' });
      // paredes da cabine (porta no meio da frente)
      walls.push({ x: X(xa, xb - xa), y: za, w: xb - xa, h: 12, top: CY0, cabin: true, tint: '#5e3f25', style: 'plank' }, { x: X(xa, xb - xa), y: zb - 12, w: xb - xa, h: 12, top: CY0, cabin: true, tint: '#5e3f25', style: 'plank' });
      walls.push({ x: X(xa, 12), y: za, w: 12, h: zb - za, top: CY0, cabin: true, tint: '#5e3f25', style: 'plank' });
      walls.push({ x: X(xb - 12, 12), y: za, w: 12, h: zc - dz - za, top: CY0, cabin: true, tint: '#5e3f25', style: 'plank' }, { x: X(xb - 12, 12), y: zc + dz, w: 12, h: zb - zc - dz, top: CY0, cabin: true, tint: '#5e3f25', style: 'plank' }, { x: X(xb - 12, 12), y: zc - dz, w: 12, h: dz * 2, y0: 80, top: CY0, cabin: true, tint: '#5e3f25', style: 'plank' });
      // amurada do convés de cima (menos onde as escadas chegam)
      const rail = (x, y, w, h) => walls.push({ x, y, w, h, y0: CH, top: CH + 26, crail: true, tint: '#4a3220', style: 'plank' });
      rail(X(xa, xb - xa), za, xb - xa, 8); rail(X(xa, xb - xa), zb - 8, xb - xa, 8); rail(X(xa, 8), za, 8, zb - za);
      const s1 = [0.36 * H, 0.44 * H], s2 = [0.56 * H, 0.64 * H];
      rail(X(xb - 8, 8), za, 8, s1[0] - za); rail(X(xb - 8, 8), s1[1], 8, s2[0] - s1[1]); rail(X(xb - 8, 8), s2[1], 8, zb - s2[1]);
      // escadas (degraus baixinhos) subindo da frente pro convés de cima
      const n = 11, run = 0.08 * W, sd = run / n;
      for (const [z0, z1] of [s1, s2]) for (let k = 1; k <= n; k++) walls.push({ x: X(xb + (n - k) * sd, sd + 0.01), y: z0, w: sd + 0.01, h: z1 - z0, top: CH * k / n, sstep: true, tint: '#6e4c2d', style: 'plank' });
    }
    // 3 mastros com cesto lá em cima (escada de corda dos 2 lados)
    for (const [fx, ny] of [[0.34, 330], [0.5, 410], [0.66, 330]]) {
      const mx = fx * W, mz = 0.5 * H, mr = 15, nr = fx === 0.5 ? 72 : 62;
      walls.push({ x: mx - mr, y: mz - mr, w: mr * 2, h: mr * 2, top: 820, smast: true });
      out.discs.push({ cx: mx, cz: mz, r0: 0, r1: nr, y0: ny - 12, top: ny, nest: true });
      out.segs.push(...ringSegs(mx, mz, nr + 2, 4, 18, () => [[ny, ny + 24]]));
      for (const nz of [-1, 1]) out.ladders.push({ x: mx, z: mz + nz * mr, nx: 0, nz, half: 20, top: ny, hole: 14, rope: true });
      out.masts.push({ x: mx, z: mz, r: mr, nest: ny, nr });
    }
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
    // duas pirâmides em cada base (uma em cada ponta, com areia baixinha em volta) e as montanhas de areia no meio;
    // a mais alta fica bem no meio pra tampar a visão de um lado a outro. Simetria girando o mapa (cada time igual).
    walls = walls.filter((R) => R.border);
    const D = DESERT_LAYOUT, rot = ([ax, az, bx, bz, hk, wk]) => [1 - ax, 1 - az, 1 - bx, 1 - bz, hk, wk];
    const list = D.dunes.concat(D.dunes.filter((d) => !d[6]).map(rot));
    for (const [ax, az, bx, bz, hk, wk] of list) {
      const x0 = Math.min(ax, bx) * W, x1 = Math.max(ax, bx) * W, z0 = Math.min(az, bz) * H, z1 = Math.max(az, bz) * H;
      walls.push({ x: x0 - 12, y: z0 - 12, w: x1 - x0 + 24, h: z1 - z0 + 24, top: 120, crest: [ax * W, az * H, bx * W, bz * H], dune: [hk, wk] });
    }
    out.pyramids = D.pyramids.concat(D.pyramids.map(([x, z, ...r]) => [1 - x, 1 - z, ...r])).map(([x, z, half, top, h]) => ({ x: x * W, z: z * H, half, top, h }));
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
  walls = applyMapEdits(mapId, out, walls, W, H);
  out.walls = walls;
  return out;
}

// opções do Sim3D a partir do mundo montado
export function simOptions(w) {
  const E = activeEdits();
  return { weapons: E.weapons || undefined, params: Object.keys(E.player || {}).length ? E.player : undefined, nade: E.nade || undefined, cfg: w.cfg, hazard: w.hazard, portalSlots: w.portalSlots, holes: w.holes, terrain: w.terrain, ceilingY: w.ceilingY, borderH: w.borderH, lamps: w.lamps, safeZones: w.safeZones, pyramids: w.pyramids, lanes: w.lanes, ship: w.ship, ramps: w.ramps, discs: w.discs, spirals: w.spirals, slopes: w.slopes, deck: w.deck, spawnX: w.spawnX, ladders: w.ladders, belts: w.belts, segs: w.segs, shape: w.shape };
}
