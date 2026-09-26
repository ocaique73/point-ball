// Simulação 3D do Point Ball (só da demo 3D). Não mexe no jogo 2D.
// Tem altura e gravidade: pulo, pulo duplo por cima dos muros, tiro e granada indo para onde a mira aponta,
// ricochete em muro e no chão, armas diferentes, fumaça, lápide e bots.
// Unidades iguais às do 2D (mapa 1600 x 1000). Eixos: x e z no chão, y para cima.

export const WEAPONS = {
  lancador:   { name: 'Lançador de borracha', speed: 900, grav: 0, r: 5, bounces: 3, cd: 0.9, mag: 20, mags: 4, reload: 1.5, rest: 1.0, model: 'blaster', arms: '1H' },
  estilingue: { name: 'Estilingue', speed: 1050, grav: 520, r: 6, bounces: 4, cd: 0.65, mag: 12, mags: 5, reload: 1.2, rest: 0.9, model: 'sling', arms: '1H' },
  mao:        { name: 'Bolinha na mão', speed: 760, grav: 900, r: 8, bounces: 5, cd: 0.45, mag: 6, mags: 8, reload: 0.9, rest: 0.85, model: 'hand', arms: 'throw' },
  arco:       { name: 'Besta (flecha de borracha)', speed: 2700, minSpeed: 650, grav: 380, r: 5, bounces: 2, cd: 0.25, mag: 10, mags: 4, reload: 1.6, rest: 0.8, model: 'bow', arms: '2H', arrow: true }, // besta: sai sempre na força máxima de antes (como se tivesse carregado tudo)
  varinha:    { name: 'Varinha mágica', speed: 1650, grav: 0, r: 4, bounces: 3, cd: 0.5, mag: 8, mags: 5, reload: 1.3, rest: 0.95, model: 'wand', arms: '1H', ray: true },
  disco:      { name: 'Disco de borracha', speed: 620, grav: 0, r: 11, bounces: 7, cd: 1.1, mag: 8, mags: 4, reload: 1.8, rest: 1.0, model: 'disc', arms: 'throw', flat: true }
};
// armas que dá pra escolher (o Caique deixou só estas); o tiro ficou 25% menor
export const WEAPON_IDS = ['arco', 'estilingue', 'mao', 'varinha'];
WEAPONS.arco.r = 3.75; WEAPONS.estilingue.r = 4.5; WEAPONS.mao.r = 6;
export const MODES = ['tdm', 'rounds', 'ffa', 'koth', 'livre'];
export const HZ_EVERY = 20; // eventos de mapa a cada 20 s (o primeiro 20 s depois do começo)
export const SPRINT = { k: 1.5, out: 0.18 }; // correr (Shift): 50% mais rápido, sem atirar; 0,18 s pra poder atirar depois
// mirar (botão direito): só zoom pra ver longe e anda um pouco mais devagar
export const AIM = { charge: 1.2, boost: 0, slow: 0.82 }; // mirar só aproxima; anda só um pouco mais devagar
// poção: tempo da animação de beber
export const DRINK = 1.1;

export const P = {
  radius: 25, height: 64, eye: 56, chest: 40, speed: 260, airControl: 0.35,
  gravity: 1400, jumpV: 400, doubleJumpV: 540, doubleJumpCd: 15, lives: 2, shrink: 0.65, invuln: 0.4,
  respawn: 2, protect: 1, tombTime: 8, wallH: 120, borderH: 150,
  knifeRange: 50, knifeCd: 0.4, knifeArc: 55 * Math.PI / 180,
  nadeR: 7, nadeSpeed: 800, nadeUp: 200, nadeFuse: 1.8, nadeRadius: 150, smokeFuse: 1.3, smokeRadius: 200, smokeTime: 6
};

export const BOT_LEVELS = {
  iniciante: { err: 0.12, react: 0.6, fire: 0.4, idle: 0.3, nade: 0.01, jump: 0.05 },
  amador:    { err: 0.05, react: 0.25, fire: 0.75, idle: 0.1, nade: 0.04, jump: 0.12 },
  pro:       { err: 0.016, react: 0.08, fire: 1, idle: 0, nade: 0.08, jump: 0.2 }
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---------- portais (estilo oval, na parede de borda) ----------
// rx/ry = meia largura/meia altura do oval; cy = altura do centro do oval
export const PORTAL = { rx: 56, ry: 70, cy: 72 };
// monta os portais abertos a partir da lista de aberturas do mapa (G.portalList) e dos pares sorteados:
// tira a "porta" de cada abertura aberta e deixa só um vão do tamanho do oval (o resto vira moldura)
export function portalLayout(walls, list, pairs, W, H, t) {
  if (!list || !list.length || !pairs) return { walls, portals: [] };
  const open = new Map();
  pairs.forEach(([i, j], k) => { open.set(i, { k, end: 0, to: j }); open.set(j, { k, end: 1, to: i }); });
  const out = [], rx = PORTAL.rx;
  for (const R of walls) {
    if (!(R.door && open.has(R.pi))) { out.push(R); continue; }
    const q = list[R.pi], horiz = q.s === 'T' || q.s === 'B';
    if (horiz) {
      const mid = R.x + R.w / 2;
      out.push({ x: R.x, y: R.y, w: mid - rx - R.x, h: R.h, border: true, pframe: R.pi });
      out.push({ x: mid + rx, y: R.y, w: R.x + R.w - (mid + rx), h: R.h, border: true, pframe: R.pi });
      out.push({ x: mid - rx, y: R.y, w: rx * 2, h: R.h, border: true, pframe: R.pi, y0: PORTAL.cy + PORTAL.ry + 2 }); // parede acima do oval
    } else {
      const mid = R.y + R.h / 2;
      out.push({ x: R.x, y: R.y, w: R.w, h: mid - rx - R.y, border: true, pframe: R.pi });
      out.push({ x: R.x, y: mid + rx, w: R.w, h: R.y + R.h - (mid + rx), border: true, pframe: R.pi });
      out.push({ x: R.x, y: mid - rx, w: R.w, h: rx * 2, border: true, pframe: R.pi, y0: PORTAL.cy + PORTAL.ry + 2 }); // parede acima do oval
    }
  }
  const portals = [];
  for (const q of list) {
    if (!open.has(q.i)) continue;
    const o = open.get(q.i), m = (q.a + q.b) / 2;
    let bx, bz, nx = 0, nz = 0;
    if (q.s === 'L') { bx = 0; bz = m * H; nx = 1; }
    else if (q.s === 'R') { bx = W; bz = m * H; nx = -1; }
    else if (q.s === 'T') { bx = m * W; bz = 0; nz = 1; }
    else { bx = m * W; bz = H; nz = -1; }
    // c = centro da face de dentro da parede; n = normal pra dentro do mapa; tg = tangente (x local)
    portals.push({ i: q.i, s: q.s, bx, bz, cx: bx + nx * t, cz: bz + nz * t, nx, nz, tx: nz, tz: -nx, pair: o.k, end: o.end, to: o.to, t, half: (q.b - q.a) / 2 * (q.s === 'L' || q.s === 'R' ? H : W) });
  }
  for (const p of portals) p.link = portals.findIndex((o) => o.i === p.to);
  return { walls: out, portals };
}

// portais 3D: ciclo do evento (começa aberto 2,5 s; fecha 6; abre 5; depois fecha 6 / abre 6 até o fim)
export function portalPhase(el) {
  if (el < 0) return { open: false, idx: -1, n: -el };
  if (el < 2.5) return { open: true, idx: 0, n: 2.5 - el };
  if (el < 8.5) return { open: false, idx: 0, n: 8.5 - el };
  if (el < 13.5) return { open: true, idx: 1, n: 13.5 - el };
  const t = el - 13.5, k = Math.floor(t / 12), r = t - k * 12;
  return r < 6 ? { open: false, idx: 1 + k, n: 6 - r } : { open: true, idx: 2 + k, n: 12 - r };
}
// sorteia 2 pares de portais: cada par tem pelo menos 1 portal embaixo (nunca um par todo em cima),
// e nunca 2 portais abertos na mesma parede no mesmo andar (em cima + embaixo na mesma parede pode)
export function pickPortalPairs3D(slots, prev, rnd) {
  rnd = rnd || Math.random;
  const key = (pr) => pr.map((q) => q.slice().sort((a, b) => a - b).join('-')).sort().join('|');
  const clash = (a, b) => a.s === b.s && a.up === b.up;
  let fallback = null;
  for (let tries = 0; tries < 200; tries++) {
    const ids = slots.map((q) => q.i);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    const pick = ids.slice(0, 4).map((i) => slots[i]);
    let ok = true;
    for (let a = 0; a < 4 && ok; a++) for (let b = a + 1; b < 4; b++) if (clash(pick[a], pick[b])) { ok = false; break; }
    if (!ok) continue;
    const pr = [[pick[0].i, pick[1].i], [pick[2].i, pick[3].i]];
    if (pr.some(([a, b]) => slots[a].up && slots[b].up)) continue;
    if (!fallback) fallback = pr;
    if (!prev || key(pr) !== key(prev)) return pr;
  }
  return fallback || [[slots[0].i, slots[1].i]];
}

// ---------- alturas por mapa ----------
// mapas fechados (sala escura, portais, base na Lua): parede de borda até o teto; o teto ricocheteia tiro
export const CEILING_Y = { floresta: 700, nave: 360, escuro: 360, portal: 660, metro: 480, fabrica: 400 };
export const BORDER_H = { nave: 360, escuro: 360, portal: 660, metro: 480, mar: 100, fabrica: 400, obra: 240, castelo: 200 };
// portais: andar de cima (passarelas e pontes); só dá pra subir por um portal
export const PLAT = { y: 300, th: 14, walk: 115, corner: 190, cornerLen: 190, bridge: 70, gapZ: 390, gap: 115 }; // cantos = quadrados largos
// poste da cidade: altura da lâmpada, distância dela pro poste e o raio que o tiro acerta
export const LAMP = { h: 128, off: 20, hitR: 30 };
// árvores da floresta: tronco alto (bate tiro e gente), copa lá em cima pra não atrapalhar a visão
export const TREE = { top: 470, r: 11 }; // copas bem altas (não atrapalham mirar pra baixo lá da casa na árvore)
// eventos de mapa: igual ao 2D, o primeiro só acontece 25 s depois do começo e repete a cada 25 s
export const TORNADO = { r: 265, speed: 410, spin: 1.6, turns: 2, rise: 430, throwD: 480, air: 0.9 }; // gira 2 voltas subindo até o topo e é lançado
// neve: tempestade congelante = faixa de vento gelado que atravessa o mapa de ponta a ponta (nunca no nascimento)
export const FROST = { w: 182, slow: 0.45, time: 1.2, push: 150, spawnX: 280 };
export const ERUPT = { r: 110, max: 2 }; // (30% maior) // vulcão: 2 erupções = 4 buracos (2 de cada lado)
// nave: meteoro cai do céu, fura o vidro do teto e fica dentro (pedra fixa que tampa visão/passagem)
// metrô: trem passando numa linha (de cima pra baixo ou ao contrário); quem estiver no trilho é arremessado
// trem: bem comprido (tampa a visão de um lado pro outro); vai por um trilho e volta pelo outro (gap = pausa entre ida e volta)
// fábrica: altura do pistão no tempo t (sobe, fica um pouco lá em cima, desce, fica um pouco embaixo)
export function pistonTop(pz, t) {
  const u = ((t + pz.phase * pz.period) % pz.period) / pz.period, k = Math.max(0, Math.min(1, 0.5 - 0.5 * Math.cos(u * Math.PI * 2)) * 1.25 - 0.125);
  return pz.lo + (pz.hi - pz.lo) * Math.max(0, Math.min(1, k));
}
// canteiro de obras: bola de demolição presa no guindaste do meio, dá uma volta inteira no mapa varrendo quem estiver no caminho
export const CRANE = { R: 440, ball: 62, y: 96, dur: 5.2, turns: 2, push: 620, up: 330, parkY: 340 }; // 2 voltas inteiras
export function craneAngle(c, t) { const u = Math.max(0, Math.min(1, (t - c.t2) / CRANE.dur)), e = u * u * (3 - 2 * u); return c.a0 + c.dir * Math.PI * 2 * CRANE.turns * e; }
// granada: segura pra jogar mais longe (min..max em 1 s); quica menos e rola pouco
export const NADE = { min: 380, max: 980, charge: 1.0, air: 1.15, rest: 0.3, roll: 0.82 };
export const DOOR_HOLD = 3.5; // nave: a porta fica aberta 3,5 s depois que ninguém está perto
export const TRAIN = { half: 72, len: 1400, speed: 1650, push: 650, up: 380, gap: 0.5 };
export const trainLegT = (H) => (H + TRAIN.len * 1.4) / TRAIN.speed; // quanto tempo o trem leva pra passar inteiro
// mar: onda gigante que atravessa o mapa e arrasta junto quem ela pegar
export const WAVE = { band: 240, speed: 760, carry: 0.92, lift: 140 };
export const METEOR = { r: 95, box: 70, top: 175, hitR: 135, max: 2 }; // pedra grande
function seededRnd(seed) { let v = seed >>> 0; return () => { v = (v * 1664525 + 1013904223) >>> 0; return v / 4294967296; }; }
// árvores espalhadas pela floresta (sempre as mesmas, espelhadas; servidor e navegador calculam igual)
export function forestTrees(W, H, walls, avoid) {
  const rnd = seededRnd(20260925), out = [], pts = [];
  const inAvoid = (x, z) => (avoid || []).some((A) => x > A.x0 - 60 && x < A.x1 + 60 && z > A.z0 - 60 && z < A.z1 + 60);
  const free = (x, z, m) => !inAvoid(x, z) && walls.every((R) => { const cx = clamp(x, R.x, R.x + R.w), cz = clamp(z, R.y, R.y + R.h); return (x - cx) ** 2 + (z - cz) ** 2 > m * m; });
  for (let i = 0; i < 6; i++) {
    for (let t = 0; t < 120; t++) {
      const x = W * 0.17 + rnd() * W * 0.29, z = H * 0.08 + rnd() * H * 0.84;
      if (!free(x, z, 60) || pts.some(([a, b]) => Math.hypot(a - x, b - z) < 220)) continue;
      pts.push([x, z], [W - x, z]); break;
    }
  }
  for (const [x, z] of pts) out.push({ x: x - TREE.r, y: z - TREE.r, w: TREE.r * 2, h: TREE.r * 2, tree: true, top: TREE.top });
  return out;
}

// ---------- vulcão: o mapa flutua em cima de um vulcão gigante; a erupção fura o chão ----------
// depth = grossura da laje; quem cai passa dela e morre ao chegar em -kill
export const HOLE = { depth: 90, kill: 300, far: 1500 };
// navio: balanço (graus em radianos) e quanto isso empurra quem está em cima
export const SWAY = { roll: 0.07, pitch: 0.025, heave: 10, big: 0.19, slide: 700, air: 380 };
// sorteia 3 pares de buracos espelhados, longe das paredes e do meio (onde ficam as áreas de reabastecer)
export function makeLavaHoles(W, H, walls, rnd) {
  rnd = rnd || Math.random;
  const holes = [];
  const free = (x, z, r) => {
    for (const R of walls) {
      const cx = clamp(x, R.x, R.x + R.w), cz = clamp(z, R.y, R.y + R.h);
      if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return false;
    }
    return !holes.some((h) => Math.hypot(h.x - x, h.z - z) < h.r + r + 10);
  };
  for (let i = 0; i < 3; i++) {
    for (let tries = 0; tries < 60; tries++) {
      const r = (58 + rnd() * 24) * 1.3; // buracos 30% maiores
      const x = W * 0.17 + rnd() * (W * 0.24), z = 100 + rnd() * (H - 200);
      if (!free(x, z, r + 22) || !free(W - x, z, r + 22)) continue;
      const seed = Math.floor(rnd() * 1e6);
      holes.push({ x, z, r, seed, m: 0 }, { x: W - x, z, r, seed, m: 1 });
      break;
    }
  }
  return holes;
}

// borda do buraco da lava: irregular (não é círculo), igual no servidor e no navegador; m = espelhado
export function holeEdgeR(h, a) {
  const aa = h.m ? Math.PI - a : a, s = ((h.seed || 7) % 1000) / 159;
  return h.r * (0.92 + 0.13 * Math.sin(2 * aa + s) + 0.09 * Math.sin(3 * aa + s * 2.3) + 0.06 * Math.sin(5 * aa + s * 4.1) + 0.035 * Math.sin(9 * aa + s * 1.7));
}

// ---------- deserto: montanhas de areia (dá pra andar e subir em cima) ----------
// cada parede do meio do deserto vira uma crista de areia; a altura é a mesma no servidor e no navegador
export const DUNE = { h: 108, w: 150, cell: 10 }; // só onde eram as paredes (mais largas, mesma altura)
export class DuneField {
  static isDune(R) { return !R.border && !R.space; }
  constructor(walls, W, H, opts) {
    this.W = W; this.H = H;
    this.segs = [];
    for (const R of walls) {
      if (!DuneField.isDune(R)) continue;
      if (R.crest) { // crista desenhada à mão (deserto do 3D): [ax, az, bx, bz] + altura/largura
        const [ax, az, bx, bz] = R.crest, [hk, wk] = R.dune || [1, 2];
        this.segs.push({ ax, az, bx, bz, h: DUNE.h * hk, w: DUNE.w * wk }); continue;
      }
      const horiz = R.w >= R.h, t = Math.min(R.w, R.h);
      const ax = horiz ? R.x + t / 2 : R.x + R.w / 2, az = horiz ? R.y + R.h / 2 : R.y + t / 2;
      const bx = horiz ? R.x + R.w - t / 2 : R.x + R.w / 2, bz = horiz ? R.y + R.h / 2 : R.y + R.h - t / 2;
      const len = Math.hypot(bx - ax, bz - az);
      // cada duna é de um tipo (igual nos 2 lados do mapa): larga e baixinha, média, ou montanha alta
      // 0 = larga e baixinha, 1 = média, 2 = alta, 3 = montanha bem alta (nem todas iguais)
      const type = [1, 3, 0, 2, 3, 1, 0][Math.floor(this.segs.length / 2) % 7]; // as paredes vêm em pares espelhados
      const [hk, wk] = [[0.42, 1.9], [0.85, 1.8], [1.4, 2.2], [2.2, 2.7]][type]; // bem mais largas que altas: dá pra subir andando
      const h = DUNE.h * hk * clamp(0.8 + len / 1400, 0.8, 1.1);
      this.segs.push({ ax, az, bx, bz, h, w: DUNE.w * wk });
    }
    // pirâmide (no meio do mapa: enorme, com topo reto pra atirar)
    this.pyr = (opts && opts.pyramids) || [];
    const c = DUNE.cell;
    this.nx = Math.ceil(W / c) + 1; this.nz = Math.ceil(H / c) + 1;
    this.grid = new Float32Array(this.nx * this.nz);
    let mx = 0;
    for (let j = 0; j < this.nz; j++) for (let i = 0; i < this.nx; i++) {
      const v = this.raw(i * c, j * c); this.grid[j * this.nx + i] = v; if (v > mx) mx = v;
    }
    this.maxH = mx;
  }
  raw(x, z) {
    let best = 0, k2 = 0;
    for (const s of this.segs) {
      const dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx * dx + dz * dz || 1;
      const u = clamp(((x - s.ax) * dx + (z - s.az) * dz) / L2, 0, 1);
      const d = Math.hypot(x - (s.ax + dx * u), z - (s.az + dz * u));
      if (d >= s.w) continue;
      const k = 1 - d / s.w, prof = k * k * (3 - 2 * k);
      // o topo da crista sobe e desce um pouco (não fica reto)
      const wob = 0.86 + 0.14 * Math.sin(u * 5.1 + s.ax * 0.013 + s.az * 0.021);
      const v = s.h * prof * wob;
      if (v > best) { k2 = best; best = v; } else if (v > k2) k2 = v;
    }
    void k2;
    let py = 0;
    for (const q of this.pyr) {
      const d = Math.max(Math.abs(x - q.x), Math.abs(z - q.z)); if (d < q.half) py = Math.max(py, Math.min(q.h, (q.half - d) / (q.half - q.top) * q.h));
      const k = clamp((d - q.half - 30) / 220, 0, 1); best *= k * k * (3 - 2 * k); // em volta da pirâmide a areia fica baixinha (a base não some)
    }
    if (best <= 0) return py;
    // ondinhas de vento na areia
    const rip = Math.sin(x * 0.045 + z * 0.018) * 0.6 + Math.sin(x * 0.021 - z * 0.05 + 1.7) * 0.4;
    return Math.max(py, best + rip * 3.2 * Math.min(1, best / 30));
  }
  at(x, z) {
    const c = DUNE.cell, fx = x / c, fz = z / c;
    if (fx < 0 || fz < 0 || fx >= this.nx - 1 || fz >= this.nz - 1) return 0;
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, n = this.nx, g = this.grid;
    const a = g[j * n + i], b = g[j * n + i + 1], cc = g[(j + 1) * n + i], d = g[(j + 1) * n + i + 1];
    return (a * (1 - u) + b * u) * (1 - v) + (cc * (1 - u) + d * u) * v;
  }
  grad(x, z) {
    const e = 6;
    return [(this.at(x + e, z) - this.at(x - e, z)) / (2 * e), (this.at(x, z + e) - this.at(x, z - e)) / (2 * e)];
  }
}

export class Sim3D {
  // walls = retângulos do 2D ({x, y, w, h, border}) — y do 2D vira z aqui
  constructor(walls, mapW, mapH, opts) {
    opts = opts || {};
    this.W = mapW; this.H = mapH;
    // sala de teste pode ajustar velocidade/pulo/etc sem mexer nos valores padrão
    this.P = Object.assign({}, P, opts.params || {});
    if (opts.borderH) this.P.borderH = opts.borderH; // mapa fechado: borda até o teto
    this.cfg = opts.cfg || null;
    this.NADE = Object.assign({}, NADE, opts.nade || {}); // granada (força, quique, rolar) — o editor pode mudar
    this.WEAPONS = {}; for (const k of WEAPON_IDS) this.WEAPONS[k] = Object.assign({}, WEAPONS[k], (opts.weapons && opts.weapons[k]) || {});
    // sala de teste / modo teste: só quem está nesta lista não morre (você); os bots morrem normal
    this.godIds = new Set(opts.godIds || (opts.godMode ? ['me'] : []));
    // deserto: as paredes do meio viram montanhas de areia (terreno), só a borda continua sendo muro
    this.dunes = opts.terrain === 'dunes' ? new DuneField(walls, mapW, mapH, { pyramids: opts.pyramids }) : null;
    // (as vidraças dos cantos da nave também são sólidas)
    const all = walls.filter((R) => !(this.dunes && DuneField.isDune(R))).map((R) => ({ x0: R.x, z0: R.y, x1: R.x + R.w, z1: R.y + R.h, y0: R.y0 || 0, top: R.top != null ? R.top : R.border || R.space ? this.P.borderH : this.P.wallH, slot: R.slotDoor, door: R.door3d, hatch: !!R.hatch, piston: R.piston || null }));
    // caixas fixas + as que mudam (porta do portal fechada, porta automática da nave, meteoro caído)
    this.staticBoxes = all.filter((b) => b.slot == null && b.door == null);
    this.slotBoxes = all.filter((b) => b.slot != null);
    // nave: portas automáticas que abrem pro lado quando alguém chega perto
    this.doors = all.filter((b) => b.door != null).sort((a, b) => a.door - b.door).map((b) => ({ box: b, cx: (b.x0 + b.x1) / 2, cz: (b.z0 + b.z1) / 2, open: 0, until: 0, solid: true }));
    this.meteorBoxes = [];
    // paredes em diagonal (mapas de formato irregular: octógono, hexágono...) e o contorno do mapa
    this.segs = (opts.segs || []).map((q) => { const dx = q.bx - q.ax, dz = q.bz - q.az, len = Math.hypot(dx, dz) || 1; return Object.assign({}, q, { ux: dx / len, uz: dz / len, len, nx: -dz / len, nz: dx / len }); });
    this.shape = opts.shape || null;
    // pisos redondos (anel: sacada em volta da torre, patamar) e rampas em espiral (dentro das torres do castelo)
    this.discs = (opts.discs || []).map((d) => Object.assign({ r0: 0, y0: d.top - 12 }, d));
    this.spirals = opts.spirals || [];
    // rampas retas (metrô): chão inclinado e maciço embaixo [x0, z0, x1, z1, eixo, altura no começo, altura no fim]
    this.slopes = opts.slopes || [];
    // navio: fora do casco é mar (cai e morre); o navio balança (inclina e sobe/desce) e isso mexe no pulo
    this.spawnX = opts.spawnX || null; // faixa (x) onde o time A nasce (o B é espelhado)
    this.deck = opts.deck || null; this.swayState = { roll: 0, pitch: 0, heave: 0, vh: 0, ah: 0 };
    // fábrica: pistões que sobem e descem sozinhos (carregam quem está em cima) e esteiras que levam quem pisa nelas
    this.pistons = this.staticBoxes.filter((b) => b.piston);
    for (const b of this.pistons) b.top = pistonTop(b.piston, 0);
    this.belts = opts.belts || [];
    // canteiro de obras: guindaste no meio com a bola de demolição
    this.crane = null;
    // áreas onde o furacão não entra (caverna da floresta)
    this.safeZones = opts.safeZones || [];
    this.wallT = (opts.cfg && opts.cfg.wallThickness) || 24;
    // vulcão: buracos no chão (abertos pela erupção; quem cai morre). null = mapa sem buraco
    this.holes = Array.isArray(opts.holes) ? opts.holes.slice() : null;
    this.erupt = null; this.erupted = 0;
    this.players = new Map();
    this.bullets = []; this.nades = []; this.smokes = []; this.tombs = [];
    this.time = 0; this.nextId = 1; this.events = [];
    // áreas que reabastecem granada/fumaça e poção: desligadas (o Caique pediu pra tirar); opts.pickups liga de novo
    this.pickups = !opts.pickups ? [] : [
      { id: 1, type: 'nade', x: this.W * 0.5, y: 0, z: this.H * 0.28, r: 55, cdUntil: 0 },
      { id: 2, type: 'potion', x: this.W * 0.5, y: 0, z: this.H * 0.72, r: 55, cdUntil: 0 }
    ];
    // eventos especiais de mapa (furacão/tempestade de areia) e portais (igual ao 2D)
    this.hazard = opts.hazard || null;
    const c = this.cfg || {}, v = (x, d) => (x != null ? x : d), E = HZ_EVERY;
    // [intervalo, aviso, duração] — mesmo ciclo do 2D (espera -> aviso -> efeito -> repete); no 3D todos a cada 20 s
    this.hz = {
      sand: [E, v(c.sandWarn, 2), 9],
      tornado: [E, v(c.tornadoGrow, 2), 6.5], // 3D: base maior, dura mais e anda mais rápido
      storm: [E, 2, 4.5], // nevasca: 30% mais larga e 1 s a mais
      dark: [E, v(c.lightsFlicker, 1), 2.5], // 3D: luz apagada 2,5 s
      lava: [E, v(c.meteorWarn, 2), 0.4],
      meteor: [E, v(c.meteorWarn, 2) + 0.6, 0.6],
      train: [E, 2.5, 2 * trainLegT(this.H) + TRAIN.gap + 0.1], // ida + volta
      crane: [E, 2.5, CRANE.dur],
      wave: [E, 3.5, 3.6], // 3,5 s de aviso: a onda vem crescendo lá do horizonte
      swell: [E, 2.5, 5] // navio: onda grande de lado (o navio inclina forte e tudo escorrega)
    };
    this.tornado = null; this.storm = null;
    this.sandActive = false; this.sandK = 0; this.sandS = 0;
    // portais abertos (vêm prontos do portalLayout): entra num, sai no par dele — gente, tiro e granada
    this.portals = opts.portals || [];
    // portais 3D: todas as aberturas (em baixo e em cima); abrem e fecham sozinhas com pares sorteados
    this.slots = opts.portalSlots || [];
    this.portalPairs = null; this.portalIdx = -99; this.portalN = 0;
    if (this.slots.length) this.hazard = 'portal';
    // nave: meteoros caídos e furos no vidro do teto
    this.meteors = []; this.meteorFall = null; this.meteorsDone = 0; this.ceilHoles = [];
    this.lanes = opts.lanes || []; this.train = null; // metrô
    this.ladders = opts.ladders || []; // escadas de mão (casa na árvore)
    this.shipSide = opts.ship || null; this.wave = null; // mar
    // teto que ricocheteia tiro (folhas da floresta / vidro da nave), null = sem teto
    this.ceilingY = opts.ceilingY != null ? opts.ceilingY : null;
    // cidade à noite / sala escura: postes de luz e ciclo de escuridão
    this.lamps = (opts.lamps || []).map((p, i) => ({ x: p[0], z: p[1], dx: p[2] != null ? p[2] : 1, dz: p[3] != null ? p[3] : 0, i, offUntil: 0 }));
    this.lightOn = true; this.lightS = 0;
    // modos (iguais ao 2D): tdm = mata-mata em equipe, rounds = eliminação, ffa = cada um por si, koth = rei da colina, livre = sem fim
    this.mode = MODES.includes(opts.mode) ? opts.mode : 'livre';
    this.killLimit = opts.killLimit || 0; this.matchTime = opts.matchTime || 0;
    this.totalRounds = opts.rounds || 3; this.hillTarget = opts.hillTarget || 100;
    this.roundTime = v(c.roundTime, 120); this.startDelay = v(c.roundStartDelay, 3); this.endDelay = v(c.roundEndDelay, 3);
    this.score = { A: 0, B: 0 }; this.round = 1; this.result = null; this.hill = null; this.hillOwner = null;
    this.phase = this.mode === 'rounds' ? 'countdown' : 'playing';
    this.phaseUntil = this.mode === 'rounds' ? this.startDelay : 0;
    this.hzStart = this.phaseUntil; // os eventos do mapa contam a partir do começo do round
    this.lastKill = null;
    this.refreshBoxes();
  }
  // junta as caixas de colisão que valem agora
  refreshBoxes() {
    const open = new Set(); for (const P of this.portals) if (P.i != null) open.add(P.i);
    this.boxes = this.staticBoxes.concat(this.slotBoxes.filter((b) => !open.has(b.slot)), this.doors.filter((d) => d.solid).map((d) => d.box), this.meteorBoxes);
  }
  // portais 3D: aplica os pares abertos (null = tudo fechado); o cliente do multiplayer usa isso com o que vem do servidor
  applyPortalPairs(pairs) {
    this.portalPairs = pairs && pairs.length ? pairs : null;
    const out = [];
    if (this.portalPairs) this.portalPairs.forEach(([a, b], k) => {
      const A = this.slots[a], B = this.slots[b]; if (!A || !B) return;
      out.push(Object.assign({}, A, { pair: k, end: 0, to: b }), Object.assign({}, B, { pair: k, end: 1, to: a }));
    });
    for (const q of out) q.link = out.findIndex((o) => o.i === q.to);
    this.portals = out;
    this.refreshBoxes();
  }
  updatePortals() {
    if (!this.slots.length) return;
    const ph = this.phase === 'playing' || this.phase === 'roundEnd' ? portalPhase(this.time - (this.hzStart || 0)) : { open: false, idx: -1, n: 0 };
    this.portalN = ph.n;
    const want = ph.open ? ph.idx : -1;
    if (want === this.portalIdx) return;
    this.portalIdx = want;
    if (want < 0) { if (this.portalPairs) { this.applyPortalPairs(null); this.events.push({ type: 'portals_close' }); } return; }
    this.applyPortalPairs(pickPortalPairs3D(this.slots, this.portalPairs || this.lastPairs));
    this.lastPairs = this.portalPairs;
    this.events.push({ type: 'portals_open', pairs: this.portalPairs });
  }
  // nave: porta abre quando alguém chega perto, fica aberta um tempo e fecha (não fecha com gente no meio)
  updateDoors(dt) {
    if (!this.doors.length) return;
    let changed = false;
    for (const d of this.doors) {
      let near = false, inside = false;
      for (const p of this.players.values()) {
        if (!p.alive) continue;
        if (Math.hypot(p.x - d.cx, p.z - d.cz) < 130) near = true;
        if (this.circleBox(p.x, p.z, this.radius(p) + 2, d.box)) inside = true;
      }
      if (near || inside) { if (d.open < 0.05 && d.until < this.time) this.events.push({ type: 'door_open', x: d.cx, z: d.cz }); d.until = this.time + DOOR_HOLD; }
      const target = this.time < d.until ? 1 : 0;
      d.open = clamp(d.open + (target ? 1 : -1) * dt / 0.4, 0, 1);
      const solid = d.open < 0.35 && !inside;
      if (solid !== d.solid) { d.solid = solid; changed = true; }
    }
    if (changed) this.refreshBoxes();
  }
  // quem é inimigo de quem (no "cada um por si" todo mundo é inimigo)
  hostile(ownerId, team, q) { return this.mode === 'ffa' ? q.id !== ownerId : q.team !== team; }
  canAct() { return this.phase === 'playing'; }
  // ciclo genérico do 2D: s=0 esperando, s=1 aviso (k vai de 0 a 1), s=2 acontecendo; n = segundos até começar
  cycle(key) {
    const [interval, pre, dur] = this.hz[key], period = interval + dur, el = this.time - (this.hzStart || 0);
    if (this.phase !== 'playing' || el < 0) return { idx: -1, s: 0, n: interval - Math.max(0, el), k: 0 };
    const idx = Math.floor(el / period), t = el - idx * period;
    if (t < interval - pre) return { idx, s: 0, n: interval - t, k: 0 };
    if (t < interval) return { idx, s: 1, n: interval - t, k: pre > 0 ? (t - (interval - pre)) / pre : 1 };
    return { idx, s: 2, n: 0, k: dur > 0 ? (t - interval) / dur : 1 };
  }
  // sala de teste: muda um valor de física ao vivo (ex: 'speed', 'jumpV')
  setParam(key, val) { if (key in this.P) this.P[key] = val; }
  // sala de teste: muda cadência/recarga/etc de uma arma ao vivo
  setWeaponParam(wid, key, val) { if (this.WEAPONS[wid] && key in this.WEAPONS[wid]) this.WEAPONS[wid][key] = val; }
  // compatibilidade: "godMode" liga/desliga só pra você ('me')
  get godMode() { return this.godIds.has('me'); }
  set godMode(v) { if (v) this.godIds.add('me'); else this.godIds.delete('me'); }
  // altura do chão (montanhas de areia); 0 no chão comum
  groundAt(x, z) { return this.dunes ? this.dunes.at(x, z) : 0; }
  // está em cima de um buraco de lava? m = margem (positivo = precisa estar mais pra dentro)
  holeAt(x, z, m) {
    if (!this.holes || !this.holes.length) return null;
    for (const h of this.holes) { const dx = x - h.x, dz = z - h.z, rr = holeEdgeR(h, Math.atan2(dz, dx)) - (m || 0); if (dx * dx + dz * dz < rr * rr) return h; }
    return null;
  }
  // pisa no chão? (fora dos buracos) — a altura do chão ali
  floorAt(x, z, r) {
    if (this.holeAt(x, z, r * 0.35)) return -Infinity;
    if (this.deck && !this.onDeck(x, z, r * 0.3)) return -Infinity; // navio: fora do casco é mar
    return this.groundAt(x, z);
  }
  onDeck(x, z, m) {
    const P = this.deck.poly; let inn = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inn = !inn; }
    void m; return inn;
  }
  // rampa em espiral: alturas da rampa nesse ponto (uma por volta); [] se está fora do anel
  spiralHs(S, x, z) {
    const dx = x - S.cx, dz = z - S.cz, rr = dx * dx + dz * dz;
    if (rr < S.r0 * S.r0 || rr > S.r1 * S.r1) return null;
    let f = ((Math.atan2(dz, dx) - S.a0) * (S.dir || 1)) / (Math.PI * 2); f -= Math.floor(f);
    const per = (S.y1 - S.y0) / S.turns, out = [];
    for (let k = 0; k <= S.turns; k++) { const u = (f + k) / S.turns; if (u <= 1) out.push(S.y0 + (S.y1 - S.y0) * u); }
    void per; return out;
  }
  slopeH(S, x, z) {
    if (x < S.x0 || x > S.x1 || z < S.z0 || z > S.z1) return null;
    const u = S.axis === 'x' ? (x - S.x0) / (S.x1 - S.x0) : (z - S.z0) / (S.z1 - S.z0);
    return S.h0 + (S.h1 - S.h0) * u;
  }
  // chão extra (rampas e pisos redondos) debaixo de quem está na altura y (sobe até "up" de degrau)
  extraFloor(x, z, y, up) {
    let f = -Infinity;
    for (const S of this.slopes) { const h = this.slopeH(S, x, z); if (h != null && h <= y + up && h > f) f = h; }
    for (const S of this.spirals) { const hs = this.spiralHs(S, x, z); if (hs) for (const h of hs) if (h <= y + up && h > f) f = h; }
    for (const D of this.discs) if (D.top <= y + up && D.top > f && this.inDisc(D, x, z)) f = D.top;
    return f;
  }
  // teto baixo (parte de baixo da volta de cima da rampa / do piso redondo) acima de y
  extraCeil(x, z, y) {
    let c = Infinity;
    for (const S of this.spirals) { const hs = this.spiralHs(S, x, z); if (hs) for (const h of hs) { const b = h - (S.th || 10); if (b > y + 2 && b < c) c = b; } }
    for (const D of this.discs) if (D.y0 > y + 2 && D.y0 < c && this.inDisc(D, x, z)) c = D.y0;
    return c;
  }
  // raio bate num piso redondo (em cima ou embaixo)? devolve t ou Infinity
  discRay(D, ox, oy, oz, dx, dy, dz, tMax) {
    if (Math.abs(dy) < 1e-9) return Infinity;
    const y = oy > D.top ? D.top : oy < D.y0 ? D.y0 : null; if (y == null) return Infinity;
    const t = (y - oy) / dy; if (t < 0 || t > tMax) return Infinity;
    return this.inDisc(D, ox + dx * t, oz + dz * t) ? t : Infinity;
  }
  // ponto dentro do piso redondo (anel, ou só um pedaço dele se tiver a0/a1)
  inDisc(D, x, z) {
    const dx = x - D.cx, dz = z - D.cz, rr = dx * dx + dz * dz;
    if (rr < D.r0 * D.r0 || rr > D.r1 * D.r1) return false;
    if (D.a1 == null) return true;
    let a = Math.atan2(dz, dx) - D.a0; a -= Math.floor(a / (Math.PI * 2)) * Math.PI * 2;
    return a <= D.a1 - D.a0;
  }

  // ---------- jogadores ----------
  addPlayer(o) {
    const p = {
      id: o.id, name: o.name, team: o.team, bot: !!o.bot, level: o.level || 'amador', look: o.look || null,
      primary: WEAPON_IDS.includes(o.primary) ? o.primary : o.bot ? WEAPON_IDS[Math.floor(Math.random() * WEAPON_IDS.length)] : 'arco', x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, grounded: true,
      yaw: o.team === 'A' ? 0 : Math.PI, pitch: 0, lives: this.P.lives, alive: true,
      weapon: 'primary', lastWeapon: 'primary', ammo: {}, mags: {}, reloadUntil: 0, fireReady: 0, charge0: 0,
      nades: 1, smokes: 1, potions: 1, drinkReady: 0, invulnUntil: 0, protectUntil: 0, respawnAt: 0, djReadyAt: 0, djUsed: false, jumps: 0,
      k: 0, d: 0, a: 0, input: { fwd: 0, side: 0, fire: false, sprint: false, aim: false }, ai: {}, lastHitBy: {}, deadAt: 0, sprinting: false, sprintOut: 0
    };
    for (const w of WEAPON_IDS) { p.ammo[w] = this.WEAPONS[w].mag; p.mags[w] = this.WEAPONS[w].mags; }
    this.players.set(p.id, p);
    this.spawn(p);
    return p;
  }
  radius(p) { return this.P.radius * (p.lives >= this.P.lives ? 1 : this.P.shrink); }
  heightOf(p) { return this.P.height * (p.lives >= this.P.lives ? 1 : this.P.shrink); }
  spawn(p) {
    const r = this.P.radius + 6;
    let bestD = -1;
    for (let i = 0; i < 60; i++) {
      // cada um por si: nasce em qualquer lugar, o mais longe possível dos outros
      const ffa = this.mode === 'ffa';
      const sx = this.spawnX || [60, 250], sxv = sx[0] + Math.random() * (sx[1] - sx[0]);
      const x = ffa ? 70 + Math.random() * (this.W - 140) : p.team === 'A' ? sxv : this.W - sxv;
      const z = 80 + Math.random() * (this.H - 160);
      if (this.boxes.some((b) => b.y0 < this.P.height && this.circleBox(x, z, r, b)) || this.holeAt(x, z, -r - 20) || !this.inside(x, z, r + 4) || this.slopes.some((S) => x > S.x0 - r && x < S.x1 + r && z > S.z0 - r && z < S.z1 + r)) continue;
      if (!ffa) { p.x = x; p.z = z; break; }
      let d = 1e9; for (const q of this.players.values()) if (q !== p && q.alive) d = Math.min(d, Math.hypot(q.x - x, q.z - z));
      if (d > bestD) { bestD = d; p.x = x; p.z = z; }
      if (i > 20 && bestD > 500) break;
    }
    p.y = this.groundAt(p.x, p.z); p.vx = p.vy = p.vz = 0; p.grounded = true;
    p.lives = this.P.lives; p.alive = true; p.weapon = 'primary';
    for (const w of WEAPON_IDS) { p.ammo[w] = this.WEAPONS[w].mag; p.mags[w] = this.WEAPONS[w].mags; }
    p.nades = 1; p.smokes = 1; p.potions = 1; p.reloadUntil = 0; p.charge0 = 0; p.nade0 = 0;
    p.protectUntil = this.time + this.P.protect; p.invulnUntil = 0;
    p.yaw = p.team === 'A' ? 0 : Math.PI;
    p.lastHitBy = {}; p.spin = null; p.ladder = null; p.slowUntil = 0; p.aiming = false; p.aimT0 = 0; p.drinkUntil = 0;
  }
  weaponDef(p) { return this.WEAPONS[p.primary]; }
  // troca a arma principal (menu Esc)
  setPrimary(p, w) { if (!WEAPON_IDS.includes(w)) return; p.primary = w; p.reloadUntil = 0; p.charge0 = 0; }
  aimDir(p) { const c = Math.cos(p.pitch); return [Math.cos(p.yaw) * c, Math.sin(p.pitch), Math.sin(p.yaw) * c]; }

  setWeapon(p, w) {
    if (!p.alive) return;
    if (w === 'nade' && p.nades < 1) return;
    if (w === 'smoke' && p.smokes < 1) return;
    if (w === 'potion' && (p.potions < 1 || p.lives >= this.P.lives)) return;
    if (p.weapon !== w) { if (p.weapon === 'primary' || p.weapon === 'knife') p.lastWeapon = p.weapon; p.weapon = w; p.reloadUntil = 0; p.charge0 = 0; p.nade0 = 0; }
  }
  // rodinha do mouse: próxima/anterior arma da lista
  cycleWeapon(p, dir) {
    const list = ['primary', 'knife'].concat(p.nades ? ['nade'] : [], p.smokes ? ['smoke'] : [], (p.potions && p.lives < this.P.lives) ? ['potion'] : []);
    const i = list.indexOf(p.weapon);
    this.setWeapon(p, list[(i + dir + list.length) % list.length]);
  }
  reload(p) {
    if (!p.alive || p.weapon !== 'primary' || p.reloadUntil) return;
    const w = this.weaponDef(p);
    if (p.ammo[p.primary] >= w.mag || p.mags[p.primary] <= 0) return;
    p.reloadUntil = this.time + w.reload;
    this.events.push({ type: 'reload', id: p.id });
  }
  jump(p) {
    if (!p.alive) return;
    if (p.ladder) { const L = p.ladder; p.ladder = null; p.vy = 260; p.vx = L.nx * 200; p.vz = L.nz * 200; p.jumps = 1; this.events.push({ type: 'jump', id: p.id }); return; } // pula pra fora da escada
    if (p.grounded) { // pulo normal: sem limite, vai para onde você está andando
      p.vy = this.P.jumpV; p.grounded = false; p.jumps = 1;
      this.events.push({ type: 'jump', id: p.id });
    } else if (!p.djUsed && this.time >= p.djReadyAt) { // pulo duplo: precisa estar carregado
      p.vy = this.P.doubleJumpV; p.djUsed = true; p.djReadyAt = this.time + this.P.doubleJumpCd; p.jumps = 2;
      const [fx, , fz] = this.aimDir(p), l = Math.hypot(fx, fz) || 1;
      if (Math.hypot(p.vx, p.vz) < 60) { p.vx += fx / l * 120; p.vz += fz / l * 120; }
      this.events.push({ type: 'djump', id: p.id });
    }
  }

  // ---------- colisão ----------
  circleBox(x, z, r, b) {
    const cx = clamp(x, b.x0, b.x1), cz = clamp(z, b.z0, b.z1);
    return (x - cx) ** 2 + (z - cz) ** 2 < r * r;
  }
  pushOut(x, z, r, b) {
    const cx = clamp(x, b.x0, b.x1), cz = clamp(z, b.z0, b.z1);
    const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) return null;
    if (d2 > 1e-9) { const d = Math.sqrt(d2); return [cx + dx / d * r, cz + dz / d * r]; }
    const l = x - b.x0, rt = b.x1 - x, tp = z - b.z0, bt = b.z1 - z, m = Math.min(l, rt, tp, bt);
    if (m === l) return [b.x0 - r, z]; if (m === rt) return [b.x1 + r, z]; if (m === tp) return [x, b.z0 - r]; return [x, b.z1 + r];
  }
  // raio (o + d*t) entra na areia? devolve o primeiro t (mesma escala de d) ou Infinity
  terrainHit(ox, oy, oz, dx, dy, dz, tMax) {
    const D = this.dunes; if (!D) return Infinity;
    const top = D.maxH + 1;
    if (oy > top && dy >= 0) return Infinity;
    const dl = Math.hypot(dx, dy, dz) || 1, st = 9 / dl;
    let t = 0;
    if (oy > top) t = (top - oy) / dy; // pula direto pra altura onde a areia pode estar
    let prev = t;
    for (; t <= tMax; t += st) {
      const y = oy + dy * t;
      if (y > top) { if (dy >= 0) return Infinity; prev = t; continue; }
      if (y < D.at(ox + dx * t, oz + dz * t)) {
        let a = prev, b = t; // refina
        for (let k = 0; k < 6; k++) { const m = (a + b) / 2; if (oy + dy * m < D.at(ox + dx * m, oz + dz * m)) b = m; else a = m; }
        return b;
      }
      prev = t;
    }
    return Infinity;
  }
  // segmento (a -> b) bate em algum muro? (visão dos bots, explosão)
  segBlocked(ax, ay, az, bx, by, bz) {
    if (this.dunes && this.terrainHit(ax, ay, az, bx - ax, by - ay, bz - az, 1) <= 1) return true;
    for (const S of this.segs) if (this.segRay(S, ax, ay, az, bx - ax, by - ay, bz - az, 1) <= 1) return true;
    for (const D of this.discs) if (this.discRay(D, ax, ay, az, bx - ax, by - ay, bz - az, 1) <= 1) return true;
    for (const b of this.boxes) {
      let t0 = 0, t1 = 1;
      const d = [bx - ax, by - ay, bz - az], o = [ax, ay, az], mn = [b.x0, b.y0, b.z0], mx = [b.x1, b.top, b.z1];
      let hit = true;
      for (let i = 0; i < 3; i++) {
        if (Math.abs(d[i]) < 1e-9) { if (o[i] < mn[i] || o[i] > mx[i]) { hit = false; break; } continue; }
        let ta = (mn[i] - o[i]) / d[i], tb = (mx[i] - o[i]) / d[i];
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) { hit = false; break; }
      }
      if (hit) return true;
    }
    return false;
  }
  smokeBlocks(ax, ay, az, bx, by, bz) {
    for (const s of this.smokes) {
      const k = this.smokeK(s); if (k < 0.6) continue;
      const R = this.P.smokeRadius * 0.55 * k;
      const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
      const u = clamp(((s.x - ax) * dx + (s.z - az) * dz) / L2, 0, 1);
      const px = ax + dx * u, pz = az + dz * u, py = ay + (by - ay) * u;
      if (Math.hypot(px - s.x, pz - s.z) < R && py < this.P.smokeRadius * 0.9) return true;
    }
    return false;
  }
  smokeK(s) { return clamp(Math.min((this.time - s.t0) / 0.5, (s.until - this.time) / 1.0), 0, 1); }
  canSee(p, q) {
    return !this.segBlocked(p.x, p.y + this.P.eye, p.z, q.x, q.y + this.P.chest, q.z) && !this.smokeBlocks(p.x, p.y + this.P.eye, p.z, q.x, q.y + this.P.chest, q.z);
  }
  // ---------- paredes em diagonal ----------
  // ponto mais perto da parede S (no chão): [cx, cz, distância]
  segNear(S, x, z) { const u = clamp((x - S.ax) * S.ux + (z - S.az) * S.uz, 0, S.len), cx = S.ax + S.ux * u, cz = S.az + S.uz * u; return [cx, cz, Math.hypot(x - cx, z - cz)]; }
  // está dentro do formato do mapa? (m = margem pra dentro)
  inside(x, z, m) {
    if (!this.shape) return true;
    const P = this.shape; let inn = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inn = !inn; }
    if (!inn) return false;
    if (m) for (const S of this.segs) if (this.segNear(S, x, z)[2] < S.t + m) return false;
    return true;
  }
  // raio (o + d*t) bate na parede diagonal S? devolve t ou Infinity
  segRay(S, ox, oy, oz, dx, dy, dz, tMax) {
    const dn = dx * S.nx + dz * S.nz; if (Math.abs(dn) < 1e-9) return Infinity;
    const side = (ox - S.ax) * S.nx + (oz - S.az) * S.nz >= 0 ? 1 : -1;
    const t = ((S.ax + S.nx * S.t * side - ox) * S.nx + (S.az + S.nz * S.t * side - oz) * S.nz) / dn;
    if (t < 0 || t > tMax) return Infinity;
    const hx = ox + dx * t, hz = oz + dz * t, u = (hx - S.ax) * S.ux + (hz - S.az) * S.uz, y = oy + dy * t;
    if (u < -S.t || u > S.len + S.t || y < (S.y0 || 0) || y > S.top) return Infinity;
    return t;
  }
  // a mira: primeiro ponto que o raio (olho -> direção) acerta (muro, chão ou alguém)
  raycast(ox, oy, oz, dx, dy, dz, maxD, ignoreId) {
    let best = maxD;
    if (dy < -1e-6) {
      let tf = -oy / dy;
      // mirando dentro de um buraco do vulcão: o ponto é lá embaixo na lava
      if (this.holes && this.holeAt(ox + dx * tf, oz + dz * tf, 0)) tf = (-HOLE.far - oy) / dy;
      best = Math.min(best, tf);
    }
    if (this.dunes) best = Math.min(best, this.terrainHit(ox, oy, oz, dx, dy, dz, best));
    for (const S of this.segs) best = Math.min(best, this.segRay(S, ox, oy, oz, dx, dy, dz, best));
    for (const D of this.discs) best = Math.min(best, this.discRay(D, ox, oy, oz, dx, dy, dz, best));
    for (const b of this.boxes) {
      let t0 = 0, t1 = best;
      const d = [dx, dy, dz], o = [ox, oy, oz], mn = [b.x0, b.y0, b.z0], mx = [b.x1, b.top, b.z1];
      let ok = true;
      for (let i = 0; i < 3; i++) {
        if (Math.abs(d[i]) < 1e-9) { if (o[i] < mn[i] || o[i] > mx[i]) { ok = false; break; } continue; }
        let ta = (mn[i] - o[i]) / d[i], tb = (mx[i] - o[i]) / d[i];
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) { ok = false; break; }
      }
      if (ok && t0 < best) best = t0;
    }
    for (const q of this.players.values()) {
      if (!q.alive || q.id === ignoreId) continue;
      const r = this.radius(q), h = this.heightOf(q);
      // cilindro vertical
      const fx = ox - q.x, fz = oz - q.z, a = dx * dx + dz * dz, bb = 2 * (fx * dx + fz * dz), c = fx * fx + fz * fz - r * r;
      const disc = bb * bb - 4 * a * c;
      if (a < 1e-9 || disc < 0) continue;
      const t = (-bb - Math.sqrt(disc)) / (2 * a);
      if (t > 0 && t < best) { const y = oy + dy * t; if (y >= q.y && y <= q.y + h) best = t; }
    }
    return best;
  }

  // ---------- passo da simulação ----------
  step(dt) {
    if (this.deck) this.updateSway();
    this.time += dt;
    this.updatePhase();
    if (this.phase === 'matchEnd') { const ev = this.events; this.events = []; return ev; }
    this.updatePistons();
    for (const p of this.players.values()) this.updatePlayer(p, dt);
    this.updateBullets(dt);
    this.updateNades(dt);
    this.updatePickups();
    this.updateHazard(dt);
    this.updatePortals();
    this.updateDoors(dt);
    this.updateHill(dt);
    this.checkEnd();
    this.smokes = this.smokes.filter((s) => this.time < s.until);
    this.tombs = this.tombs.filter((t) => this.time < t.until);
    const ev = this.events; this.events = [];
    return ev;
  }
  // estado leve pra mandar pela rede (multiplayer): só o que o cliente precisa pra desenhar
  snapshot() {
    const players = [];
    for (const p of this.players.values()) {
      players.push({ id: p.id, name: p.name, team: p.team, bot: p.bot, x: p.x, y: p.y, z: p.z, vx: p.vx, vy: p.vy, vz: p.vz,
        yaw: p.yaw, pitch: p.pitch, lives: p.lives, alive: p.alive, weapon: p.weapon, primary: p.primary, grounded: !!p.grounded,
        ammo: p.ammo[p.primary], mag: this.WEAPONS[p.primary].mag, mags: p.mags[p.primary], reloadUntil: p.reloadUntil || 0,
        nades: p.nades, smokes: p.smokes, potions: p.potions, djReadyAt: p.djReadyAt || 0,
        k: p.k, d: p.d, a: p.a, charge0: p.charge0 || 0, nade0: p.nade0 || 0, fireReady: p.fireReady || 0,
        protectUntil: p.protectUntil || 0, respawnAt: p.respawnAt || 0, deadAt: p.deadAt || 0, lastHitBy: p.lastHitBy || {},
        look: p.look, slowUntil: p.slowUntil || 0, spin: !!p.spin, climb: !!p.ladder, sprinting: !!p.sprinting, aiming: !!p.aiming, aimT0: p.aimT0 || 0, drinkUntil: p.drinkUntil || 0 });
    }
    return {
      time: this.time, players,
      bullets: this.bullets.map((b) => ({ id: b.id, team: b.team, x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, r: b.r, kind: b.kind })),
      nades: this.nades.map((g) => ({ id: g.id, team: g.team, smoke: g.smoke, x: g.x, y: g.y, z: g.z, spin: g.spin, t0: g.t0 })),
      smokes: this.smokes.map((s) => ({ id: s.id, x: s.x, z: s.z, t0: s.t0, until: s.until })),
      tombs: this.tombs.map((t) => ({ id: t.id, x: t.x, y: t.y, z: t.z, name: t.name, team: t.team, t0: t.t0, until: t.until })),
      pickups: this.pickups.map((u) => ({ id: u.id, type: u.type, x: u.x, z: u.z, r: u.r, cdUntil: u.cdUntil })),
      hazard: this.hazard, sandK: this.sandK, lightOn: this.lightOn, lightS: this.lightS,
      tornado: this.tornado ? { x: this.tornado.x, z: this.tornado.z, s: this.tornado.s, k: this.tornado.k } : null,
      storm: this.storm ? { x: this.storm.x, w: this.storm.w, dir: this.storm.dir, s: this.storm.s, k: this.storm.k } : null,
      train: this.train ? { x: this.train.x, dir: this.train.dir, t2: this.train.t2, lt: this.train.lt, on: this.train.on, xb: this.train.xb, leg: this.train.leg, s: this.train.s, k: this.train.k } : null,
      crane: this.crane ? { a0: this.crane.a0, dir: this.crane.dir, t2: this.crane.t2, s: this.crane.s, k: this.crane.k, rest: this.crane.rest } : null,
      wave: this.wave ? { side: this.wave.side, t2: this.wave.t2, s: this.wave.s, k: this.wave.k } : null,
      sway: this.deck ? this.swayState : null,
      holes: this.holes, erupt: this.erupt && !this.erupt.done ? { pts: this.erupt.pts, r: this.erupt.r } : null,
      lamps: this.lamps.map((l) => ({ i: l.i, x: l.x, z: l.z, dx: l.dx, dz: l.dz, offUntil: l.offUntil })),
      portalPairs: this.portalPairs, portalN: this.portalN, doors: this.doors.map((d) => Math.round(d.open * 100) / 100), doorsT: this.doors.map((d) => Math.max(0, Math.round((d.until - this.time) * 20) / 20)),
      meteors: this.meteors, meteorFall: this.meteorFall, ceilHoles: this.ceilHoles, lastKill: this.lastKill,
      mode: this.mode, phase: this.phase, phaseUntil: this.phaseUntil, hzStart: this.hzStart, score: this.score, round: this.round,
      totalRounds: this.totalRounds, killLimit: this.killLimit, hillTarget: this.hillTarget, matchTime: this.matchTime,
      hill: this.hill ? { x: this.hill.x, z: this.hill.z, r: this.hill.r, n: this.hill.n, pv: this.hill.pv, o: this.hillOwner } : null, result: this.result
    };
  }

  updatePlayer(p, dt) {
    if (p.reloadUntil && this.time >= p.reloadUntil) {
      p.reloadUntil = 0; p.ammo[p.primary] = this.weaponDef(p).mag; p.mags[p.primary]--;
    }
    if (!p.alive) { if (this.mode !== 'rounds' && this.time >= p.respawnAt) { this.spawn(p); this.events.push({ type: 'respawn', id: p.id }); } return; }
    // contagem antes do round / fim de round: ninguém anda nem atira
    if (!this.canAct()) { p.vx = p.vz = 0; p.input.fire = false; p.charge0 = 0; if (p.bot) p.input.fwd = p.input.side = 0; }
    // pego pelo furacão: gira subindo dentro dele e depois é jogado longe
    if (p.spin) { this.updateSpin(p, dt); return; }
    if (p.bot) this.botThink(p, dt);
    // andar relativo para onde olha
    const fx = Math.cos(p.yaw), fz = Math.sin(p.yaw), rx = -fz, rz = fx;
    let wx = fx * p.input.fwd + rx * p.input.side, wz = fz * p.input.fwd + rz * p.input.side;
    const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
    // tempestade congelante deixa devagar por um tempo (a de areia só tampa a visão)
    // mirar (botão direito): anda mais devagar e carrega a força do tiro; não dá pra correr mirando
    const aiming = !!p.input.aim && this.canAct() && p.weapon === 'primary' && !p.reloadUntil;
    if (aiming && !p.aiming) p.aimT0 = this.time;
    p.aiming = aiming;
    // correr (Shift): só andando pra frente; enquanto corre não atira (igual BF/COD)
    const sprint = !!p.input.sprint && p.input.fwd > 0 && this.canAct() && !aiming;
    if (p.sprinting && !sprint) p.sprintOut = this.time + SPRINT.out;
    p.sprinting = sprint; if (sprint) p.charge0 = 0;
    const spdK = (this.time < (p.slowUntil || 0) ? p.slowF : 1) * (sprint ? SPRINT.k : 1) * (p.aiming ? AIM.slow : 1);
    wx *= this.P.speed * spdK; wz *= this.P.speed * spdK;
    // subindo a montanha de areia: fica mais devagar conforme a subida
    if (this.dunes && p.grounded && wl > 0.01) {
      const [gx, gz] = this.dunes.grad(p.x, p.z), up = (wx * gx + wz * gz) / this.P.speed;
      if (up > 0) { const k = 1 / (1 + up * 0.45); wx *= k; wz *= k; }
    }
    if (p.grounded) { p.vx = wx; p.vz = wz; }
    else { // no ar: mantém o impulso, com um pouco de controle
      const k = Math.min(1, this.P.airControl * dt * 6);
      if (wl > 0.01) { p.vx += (wx - p.vx) * k; p.vz += (wz - p.vz) * k; }
    }
    // navio inclinado: quem está em pé escorrega pro lado mais baixo; no ar, o pulo é levado pro lado (e fica mais alto/baixo com o sobe-desce)
    if (this.deck) {
      const S = this.swayState, sx = Math.sin(S.pitch), sz = Math.sin(S.roll);
      if (p.grounded) { p.vx += sx * SWAY.slide; p.vz += sz * SWAY.slide; } // escorrega (velocidade)
      else { p.vx += sx * SWAY.air * dt; p.vz += sz * SWAY.air * dt; p.vy -= S.ah * 6 * dt; } // no ar: é levado pro lado
    }
    const r = this.radius(p);
    // horizontal: bate nos muros que estão na altura do corpo
    const px0 = p.x, pz0 = p.z;
    p.x += p.vx * dt; p.z += p.vz * dt;
    // esteira da fábrica: quem está pisando nela é levado junto
    if (this.belts.length && p.grounded && p.y < 2) for (const B of this.belts) if (p.x > B.x0 && p.x < B.x1 && p.z > B.z0 && p.z < B.z1) { p.x += B.vx * dt; p.z += B.vz * dt; break; }
    for (let it = 0; it < 3; it++) {
      for (const b of this.boxes) {
        if (p.y >= b.top - 2 || p.y + this.heightOf(p) <= b.y0 + 0.5) continue; // em cima do muro / por baixo (parede acima do portal, plataforma)
        // degrau baixinho (escada): sobe andando
        if (p.grounded && b.top - p.y <= 22 && b.y0 <= p.y + 1 && this.circleBox(p.x, p.z, r, b)) { p.y = b.top; continue; }
        const o = this.pushOut(p.x, p.z, r, b);
        if (o) { p.x = o[0]; p.z = o[1]; }
      }
    }
    // paredes em diagonal (contorno do mapa): empurram pra fora; as de contorno valem em qualquer altura
    for (const S of this.segs) {
      if (!S.inf && (p.y >= S.top - 2 || p.y + this.heightOf(p) <= (S.y0 || 0) + 0.5)) continue;
      const [cx, cz, d] = this.segNear(S, p.x, p.z), m = r + S.t;
      if (d >= m) continue;
      if (d > 1e-6) { p.x = cx + (p.x - cx) / d * m; p.z = cz + (p.z - cz) / d * m; }
      else { p.x = cx + S.nx * m; p.z = cz + S.nz * m; }
    }
    // rampa em espiral na altura do corpo (não dá pra atravessar andando): volta pra onde estava
    if (this.slopes.length) for (const S of this.slopes) { const h = this.slopeH(S, p.x, p.z); if (h != null && h > p.y + 14) { p.x = px0; p.z = pz0; break; } } // rampa é maciça embaixo
    if (this.spirals.length) {
      const ph0 = this.heightOf(p);
      for (const S of this.spirals) { const hs = this.spiralHs(S, p.x, p.z); if (hs && hs.some((h) => h > p.y + 14 && h - (S.th || 10) < p.y + ph0)) { p.x = px0; p.z = pz0; break; } }
    }
    // parede invisível em cima da borda: ninguém sai do mapa pulando por cima do muro
    if (p.y >= this.P.borderH - 6) { const m = this.wallT + r; p.x = clamp(p.x, m, this.W - m); p.z = clamp(p.z, m, this.H - m); }
    if (p.x < -40 || p.z < -40 || p.x > this.W + 40 || p.z > this.H + 40) { this.spawn(p); this.events.push({ type: 'respawn', id: p.id }); return; }
    // portal: entrou no oval, sai no par dele (olhando pro lado certo, com o mesmo embalo)
    if (this.portals.length) {
      const w = this.portalCross(p, r, true);
      if (w) {
        const oy = p.yaw, fx2 = Math.cos(oy), fz2 = Math.sin(oy);
        const fu = fx2 * w.P.tx + fz2 * w.P.tz, fn = fx2 * w.P.nx + fz2 * w.P.nz;
        p.yaw = Math.atan2(-fu * w.Q.tz - fn * w.Q.nz, -fu * w.Q.tx - fn * w.Q.nx);
        let dyaw = p.yaw - oy; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
        this.events.push({ type: 'portal', id: p.id, x: p.x, z: p.z, dyaw, from: w.P.i, to: w.Q.i });
      }
    }
    // caiu num buraco do vulcão: não sai mais pelos lados (só pulo duplo salva, se ainda der)
    const pit = this.holes && p.y < -2 ? this.holeAt(p.x, p.z, -r) : null;
    if (pit) {
      const dx = p.x - pit.x, dz = p.z - pit.z, d = Math.hypot(dx, dz), lim = holeEdgeR(pit, Math.atan2(dz, dx)) - r * 0.5;
      if (d > lim && d > 0) { p.x = pit.x + dx / d * lim; p.z = pit.z + dz / d * lim; }
    }
    // escada de mão: andando pra frente de cara pra escada, sobe; pra trás, desce; pulo solta
    if (this.ladders.length && this.updateLadder(p, dt, r)) { this.fireInput(p); return; }
    // vertical: gravidade, chão (areia / buraco) e topo dos muros
    const y0 = p.y, ph = this.heightOf(p);
    p.vy -= this.P.gravity * dt; p.y += p.vy * dt;
    // bate a cabeça embaixo de plataforma/teto baixo (andar de cima do mapa dos portais)
    if (p.vy > 0) for (const b of this.boxes) {
      if (b.y0 > 0 && y0 + ph <= b.y0 + 1 && p.y + ph > b.y0 && this.circleBox(p.x, p.z, r * 0.8, b)) { p.y = b.y0 - ph; p.vy = 0; }
    }
    if (p.vy > 0 && (this.spirals.length || this.discs.length)) { const c = this.extraCeil(p.x, p.z, y0 + ph - 2); if (p.y + ph > c) { p.y = c - ph; p.vy = 0; } }
    let floor = pit ? -Infinity : this.floorAt(p.x, p.z, r);
    for (const b of this.boxes) if (this.circleBox(p.x, p.z, r * 0.7, b) && y0 >= b.top - 2) floor = Math.max(floor, b.top);
    if (this.spirals.length || this.discs.length || this.slopes.length) floor = Math.max(floor, this.extraFloor(p.x, p.z, y0, p.grounded ? 14 : 2));
    // descendo o morro andando: continua grudado no chão (sem ficar "pulando" ladeira abaixo)
    const snap = p.grounded && p.vy <= 0 && floor > -Infinity && y0 - floor < 16;
    if (p.y <= floor || snap) {
      if (!p.grounded && p.vy < -200) this.events.push({ type: 'land', id: p.id });
      p.y = floor; p.vy = 0;
      if (!p.grounded) { p.grounded = true; p.djUsed = false; p.jumps = 0; }
    } else p.grounded = false;
    // lá embaixo é lava
    if (this.holes && p.y < -HOLE.kill) { this.lavaFall(p); return; }
    // navio: caiu no mar
    if (this.deck && p.y < this.deck.kill) { this.drown(p); return; }
    this.fireInput(p);
  }
  // atirar / usar
  fireInput(p) {
    // correndo: só não atira nem dá facada (poção, granada e fumaça pode)
    const run = p.sprinting || this.time < p.sprintOut, free = p.weapon === 'potion' || p.weapon === 'nade' || p.weapon === 'smoke';
    if (!this.canAct() || (run && !free)) { if (p.charge0 && !p.input.fire) p.charge0 = 0; }
    else if (p.input.fire) this.useWeapon(p, false);
    else if (p.charge0 || p.nade0) this.useWeapon(p, true); // soltou o botão (granada)
  }
  // escada de mão presa no tronco: devolve true enquanto está pendurado nela
  updateLadder(p, dt, r) {
    const CLIMB = 210;
    let L = p.ladder;
    if (!L) {
      if (!p.input.fwd) return false;
      for (const q of this.ladders) {
        const dx = p.x - q.x, dz = p.z - q.z, out = dx * q.nx + dz * q.nz, lat = -dx * q.nz + dz * q.nx;
        if (out < 0 || out > r + 16 || Math.abs(lat) > q.half) continue;
        if (-(Math.cos(p.yaw) * q.nx + Math.sin(p.yaw) * q.nz) < 0.3) continue; // precisa estar de frente pra escada
        // de frente pra escada, W sobe (S desce enquanto está nela; pra descer de lá de cima, é só cair pelo buraco)
        const up = p.input.fwd > 0 && p.y >= -2 && p.y < q.top - 4;
        if (!up) continue;
        L = q; break;
      }
      // lá em cima, em pé na tampa do alçapão, de costas pra fora + S = desce pela escada
      if (!L && p.input.fwd < 0 && p.grounded) for (const q of this.ladders) {
        if (Math.abs(p.y - q.top) > 3) continue;
        const dx = p.x - q.x, dz = p.z - q.z, out = dx * q.nx + dz * q.nz, lat = -dx * q.nz + dz * q.nx;
        if (out < -2 || out > (q.hole || 64) + r || Math.abs(lat) > q.half + 12) continue;
        L = q; p.y = q.top - 6; break;
      }
      if (!L) return false;
      p.ladder = L; this.events.push({ type: 'ladder', id: p.id });
    }
    const lat = Math.max(-8, Math.min(8, -(p.x - L.x) * L.nz + (p.z - L.z) * L.nx));
    const off = r + 3 + (L.tilt || 0) * Math.max(0, 1 - p.y / L.top); // escada inclinada: embaixo fica mais longe do tronco
    p.x = L.x + L.nx * off - L.nz * lat; p.z = L.z + L.nz * off + L.nx * lat;
    p.vx = p.vz = 0; p.vy = 0; p.grounded = false; p.sprinting = false;
    p.y += CLIMB * dt * Math.sign(p.input.fwd);
    if (p.y >= L.top) { // chegou lá em cima: sai do buraco e fica em pé no chão da casinha, do lado de fora do buraco
      const d = (L.hole || 64) + r * 0.7 + 4;
      p.x = L.x + L.nx * d; p.z = L.z + L.nz * d;
      p.y = L.top; p.ladder = null; p.vy = 0; p.grounded = true; p.djUsed = false; p.jumps = 0;
      return false;
    }
    if (p.y <= 0) { p.y = 0; p.ladder = null; p.grounded = true; return false; }
    return true;
  }

  useWeapon(p, released) {
    if (!p.alive || this.time < p.protectUntil) return;
    if (this.time < p.fireReady) return;
    if (p.weapon === 'knife') return this.knife(p);
    if (p.weapon === 'potion') return this.drinkPotion(p);
    if (p.weapon === 'nade' || p.weapon === 'smoke') { // clicou = joga (sempre na força máxima)
      if (released) return;
      p.nade0 = 0;
      return this.throwNade(p, p.weapon === 'smoke', 1);
    }
    const w = this.weaponDef(p);
    if (p.reloadUntil) return;
    if (p.ammo[p.primary] <= 0) { this.reload(p); return; }
    if (w.charge) { // arco: segura para puxar, solta para atirar
      if (!released) { if (!p.charge0) { p.charge0 = this.time; this.events.push({ type: 'draw', id: p.id }); } return; }
      const k = clamp((this.time - p.charge0) / w.charge, 0.15, 1);
      p.charge0 = 0;
      return this.shoot(p, w, w.minSpeed + (w.speed - w.minSpeed) * k);
    }
    if (released) return;
    this.shoot(p, w, w.speed);
  }
  // força do tiro mirando (botão direito): 0 a 1 conforme segura
  aimCharge(p) { return p.aiming && p.aimT0 ? clamp((this.time - p.aimT0) / AIM.charge, 0, 1) : 0; }
  // o tiro sai da mão e vai para o ponto que a mira mostra
  shoot(p, w, speed) {
    p.ammo[p.primary]--; p.fireReady = this.time + w.cd;
    const [ox, oy, oz, tx, ty, tz] = this.muzzleAndTarget(p);
    let dx = tx - ox, dy = ty - oy, dz = tz - oz;
    const L = Math.hypot(dx, dy, dz) || 1; dx /= L; dy /= L; dz /= L;
    // sem compensação automática da queda: o tiro sai reto pra onde a mira aponta (quem calcula a distância é o jogador)
    const l2 = Math.hypot(dx, dy, dz); dx /= l2; dy /= l2; dz /= l2;
    this.bullets.push({ id: this.nextId++, owner: p.id, team: p.team, x: ox, y: oy, z: oz, vx: dx * speed, vy: dy * speed, vz: dz * speed,
      r: w.r, grav: w.grav, bounces: 0, max: w.bounces, rest: w.rest, t0: this.time, kind: p.primary });
    this.events.push({ type: 'shot', id: p.id, weapon: p.primary });
    if (p.ammo[p.primary] <= 0) this.reload(p);
  }
  muzzleAndTarget(p) {
    const [dx, dy, dz] = this.aimDir(p);
    const ex = p.x, ey = p.y + this.P.eye * (this.radius(p) / this.P.radius), ez = p.z; // mesma altura da câmera (segue o tamanho)
    const eye = p.camPos || [ex, ey, ez]; // na 3ª pessoa a mira sai da câmera
    const t = this.raycast(eye[0], eye[1], eye[2], dx, dy, dz, 4000, p.id);
    const tx = eye[0] + dx * t, ty = eye[1] + dy * t, tz = eye[2] + dz * t;
    const rx = -Math.sin(p.yaw), rz = Math.cos(p.yaw);
    const r = this.radius(p);
    const ox = p.x + Math.cos(p.yaw) * (r + 4) + rx * 8, oy = p.y + this.P.chest + 4, oz = p.z + Math.sin(p.yaw) * (r + 4) + rz * 8;
    return [ox, oy, oz, tx, ty, tz];
  }
  knife(p) {
    p.fireReady = this.time + this.P.knifeCd;
    this.events.push({ type: 'knife', id: p.id });
    for (const q of this.players.values()) {
      if (!q.alive || !this.hostile(p.id, p.team, q)) continue;
      const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      if (d > this.radius(p) + this.P.knifeRange + this.radius(q) || Math.abs(q.y - p.y) > 50) continue;
      let da = Math.atan2(dz, dx) - p.yaw; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) < this.P.knifeArc && !this.segBlocked(p.x, p.y + this.P.chest, p.z, q.x, q.y + this.P.chest, q.z)) { this.damage(q, p.id, 'knife'); break; }
    }
  }
  // poção: bebe (animação no cliente) e recupera 1 vida, gasta 1 poção
  drinkPotion(p) {
    if (p.potions < 1 || p.lives >= this.P.lives) { p.weapon = p.lastWeapon || 'primary'; return; }
    p.fireReady = this.time + DRINK; // duração da animação de beber
    p.drinkUntil = this.time + DRINK;
    p.potions--; p.lives = Math.min(this.P.lives, p.lives + 1);
    this.events.push({ type: 'drink', id: p.id });
    p.weapon = p.lastWeapon || 'primary';
  }
  // ---------- áreas de reabastecimento ----------
  updatePickups() {
    for (const u of this.pickups) {
      if (this.time < u.cdUntil) continue;
      for (const p of this.players.values()) {
        if (!p.alive) continue;
        const d = Math.hypot(p.x - u.x, p.z - u.z);
        if (d > u.r) continue;
        if (u.type === 'nade') {
          if (p.nades >= 1 && p.smokes >= 1) continue;
          p.nades = 1; p.smokes = 1;
        } else { // potion
          if (p.potions >= 1) continue;
          p.potions = 1;
        }
        u.cdUntil = this.time + 18;
        this.events.push({ type: 'pickup', id: p.id, kind: u.type, x: u.x, z: u.z });
        break;
      }
    }
  }
  // ---------- eventos especiais de mapa ----------
  updateHazard(dt) {
    if (this.hazard === 'tornado') this.updateTornado(dt);
    else if (this.hazard === 'sand') this.updateSand(dt);
    else if (this.hazard === 'dark') this.updateDark();
    else if (this.hazard === 'storm') this.updateStorm(dt);
    else if (this.hazard === 'lava' && this.holes) this.updateErupt();
    else if (this.hazard === 'meteor') this.updateMeteor();
    else if (this.hazard === 'train') this.updateTrain();
    else if (this.hazard === 'wave') this.updateWave(dt);
    else if (this.hazard === 'swell') this.updateSwell();
    else if (this.hazard === 'crane') this.updateCrane();
  }
  // vulcão: caiu na lava = morreu (o abate vai pra quem acertou por último, se foi há pouco)
  drown(p) { // caiu do navio no mar
    if (this.godIds.has(p.id)) { this.spawn(p); this.events.push({ type: 'respawn', id: p.id }); this.events.push({ type: 'drown', id: p.id, x: p.x, z: p.z, saved: true }); return; }
    let by = null, bt = -1;
    for (const id in p.lastHitBy) if (this.time - p.lastHitBy[id] < 5 && p.lastHitBy[id] > bt) { bt = p.lastHitBy[id]; by = id; }
    this.events.push({ type: 'drown', id: p.id, x: p.x, z: p.z });
    p.lives = 1; p.invulnUntil = 0; p.protectUntil = 0;
    this.damage(p, by, 'sea');
  }
  lavaFall(p) {
    if (this.godIds.has(p.id)) { this.spawn(p); this.events.push({ type: 'respawn', id: p.id }); this.events.push({ type: 'lava_fall', id: p.id, x: p.x, z: p.z, saved: true }); return; }
    let by = null, bt = -1;
    for (const id in p.lastHitBy) if (this.time - p.lastHitBy[id] < 5 && p.lastHitBy[id] > bt) { bt = p.lastHitBy[id]; by = id; }
    this.events.push({ type: 'lava_fall', id: p.id, x: p.x, z: p.z });
    p.lives = 1; p.invulnUntil = 0; p.protectUntil = 0;
    this.damage(p, by, 'lava');
  }
  // portal: o objeto o (x, y, z, vx, vz) passou da face do portal? leva pro par (gira posição e velocidade)
  portalCross(o, rad, isPlayer) {
    for (const P of this.portals) {
      const dx = o.x - P.cx, dz = o.z - P.cz, v = dx * P.nx + dz * P.nz;
      if (v >= 0 || v < -(P.t + rad + 40)) continue;
      const u = dx * P.tx + dz * P.tz, ly = o.y - (P.base || 0);
      if (isPlayer) { if (Math.abs(u) > PORTAL.rx || ly < -4 || ly > PORTAL.cy + PORTAL.ry - 20) continue; }
      else { const eu = u / PORTAL.rx, ey = (ly - PORTAL.cy) / PORTAL.ry; if (eu * eu + ey * ey > 1) continue; }
      const Q = this.portals[P.link]; if (!Q) continue;
      o.y += (Q.base || 0) - (P.base || 0); // portal de cima <-> de baixo
      let u2 = -u;
      if (isPlayer) { const lim = PORTAL.rx - rad - 1; u2 = clamp(u2, -lim, lim); }
      const v2 = Math.max(-v, rad + 3);
      o.x = Q.cx + Q.tx * u2 + Q.nx * v2; o.z = Q.cz + Q.tz * u2 + Q.nz * v2;
      const vu = o.vx * P.tx + o.vz * P.tz, vn = o.vx * P.nx + o.vz * P.nz;
      o.vx = -vu * Q.tx - vn * Q.nx; o.vz = -vu * Q.tz - vn * Q.nz;
      return { P, Q };
    }
    return null;
  }
  // sala escura: igual ao 2D — acesa, pisca 1 s e apaga; s = 0 acesa, 1 piscando, 2 apagada
  updateDark() {
    const cy = this.cycle('dark'), on = cy.s !== 2;
    if (cy.s === 1 && this.lightS === 0) this.events.push({ type: 'light_flicker' });
    this.lightS = cy.s;
    if (on !== this.lightOn) { this.lightOn = on; this.events.push({ type: on ? 'light_on' : 'light_off' }); }
  }
  // furacão da floresta (igual ao 2D): nasce num lugar livre, cresce 2 s sem efeito, depois anda pelo mapa;
  // quem ele pega gira subindo dentro dele e é jogado longe
  updateTornado(dt) {
    const cy = this.cycle('tornado');
    if (cy.s === 0) { if (this.tornado) { this.tornado = null; this.events.push({ type: 'tornado_end' }); } return; }
    let T = this.tornado;
    const R = TORNADO.r, m = this.wallT + R * 0.6;
    if (!T || T.idx !== cy.idx) {
      let x = this.W / 2, z = this.H / 2;
      for (let i = 0; i < 40; i++) {
        const tx = m + Math.random() * (this.W - 2 * m), tz = m + Math.random() * (this.H - 2 * m);
        if (!this.boxes.some((b) => this.circleBox(tx, tz, R * 0.5, b)) && !this.inSafe(tx, tz, R)) { x = tx; z = tz; break; }
      }
      const a = Math.random() * Math.PI * 2;
      T = this.tornado = { idx: cy.idx, x, z, vx: Math.cos(a), vz: Math.sin(a), turn: 0, hit: new Set(), s: cy.s, k: 0 };
      this.events.push({ type: 'tornado_start', x, z });
    }
    T.s = cy.s; T.k = cy.k;
    if (cy.s !== 2) return;
    T.turn += (Math.random() - 0.5) * 6 * dt;
    const ca = Math.cos(T.turn * dt), sa = Math.sin(T.turn * dt);
    const vx = T.vx * ca - T.vz * sa, vz = T.vx * sa + T.vz * ca; T.vx = vx; T.vz = vz;
    T.x += T.vx * TORNADO.speed * dt; T.z += T.vz * TORNADO.speed * dt;
    if (T.x < m) { T.x = m; T.vx = Math.abs(T.vx); } if (T.x > this.W - m) { T.x = this.W - m; T.vx = -Math.abs(T.vx); }
    if (T.z < m) { T.z = m; T.vz = Math.abs(T.vz); } if (T.z > this.H - m) { T.z = this.H - m; T.vz = -Math.abs(T.vz); }
    // caverna: o furacão não entra (desvia pela borda de fora)
    for (const A of this.safeZones) {
      const x0 = A.x0 - R, x1 = A.x1 + R, z0 = A.z0 - R, z1 = A.z1 + R;
      if (T.x > x0 && T.x < x1 && T.z > z0 && T.z < z1) {
        const dl = T.x - x0, dr = x1 - T.x, dt2 = T.z - z0, db = z1 - T.z, mn = Math.min(dl, dr, dt2, db);
        if (mn === dl) { T.x = x0; T.vx = -Math.abs(T.vx); } else if (mn === dr) { T.x = x1; T.vx = Math.abs(T.vx); }
        else if (mn === dt2) { T.z = z0; T.vz = -Math.abs(T.vz); } else { T.z = z1; T.vz = Math.abs(T.vz); }
      }
    }
    for (const p of this.players.values()) {
      if (!p.alive || p.spin || T.hit.has(p.id) || this.inSafe(p.x, p.z, 0)) continue;
      const dx = p.x - T.x, dz = p.z - T.z;
      if (dx * dx + dz * dz < (R + this.radius(p)) ** 2) {
        T.hit.add(p.id);
        p.ladder = null; p.spin = { t0: this.time, ang: Math.atan2(dz, dx), r0: Math.hypot(dx, dz), y0: p.y };
        this.events.push({ type: 'caught', id: p.id });
      }
    }
  }
  // dentro da caverna (área onde o furacão não entra)? m = margem
  inSafe(x, z, m) { return this.safeZones.some((A) => x > A.x0 - m && x < A.x1 + m && z > A.z0 - m && z < A.z1 + m); }
  updateSpin(p, dt) {
    const S = p.spin, T = this.tornado, k = clamp((this.time - S.t0) / TORNADO.spin, 0, 1);
    if (T) { S.cx = T.x; S.cz = T.z; } else if (S.cx == null) { S.cx = p.x; S.cz = p.z; }
    // 2 voltas inteiras subindo pelo funil (acompanha o formato: afina no meio e abre em cima)
    const e = k * k * (3 - 2 * k), ang = S.ang + k * Math.PI * 2 * TORNADO.turns;
    const rr = S.r0 * (1 - e) + TORNADO.r * (0.45 + 0.55 * Math.max(0, e - 0.4) / 0.6) * e;
    p.x = S.cx + Math.cos(ang) * rr; p.z = S.cz + Math.sin(ang) * rr;
    p.y = Math.min(S.y0 + TORNADO.rise * e, this.ceilingY != null ? this.ceilingY - 80 : 1e9); p.vx = p.vz = p.vy = 0; p.grounded = false;
    if (S.yaw0 == null) S.yaw0 = p.yaw;
    p.yaw = S.yaw0 + (ang - S.ang); p.input.fire = false; // gira junto com a volta: 2 voltas no total (não mais)
    if (k < 1) return;
    // joga longe: escolhe uma direção que cai dentro do mapa (e fora de buraco)
    const sp = TORNADO.throwD / TORNADO.air, mm = this.wallT + 60;
    let a = Math.random() * Math.PI * 2;
    for (let i = 0; i < 16; i++) {
      const b = Math.random() * Math.PI * 2, tx = p.x + Math.cos(b) * TORNADO.throwD, tz = p.z + Math.sin(b) * TORNADO.throwD;
      if (tx > mm && tz > mm && tx < this.W - mm && tz < this.H - mm && !this.holeAt(tx, tz, -40) && !this.inSafe(tx, tz, 40)) { a = b; break; }
    }
    p.spin = null;
    p.vx = Math.cos(a) * sp; p.vz = Math.sin(a) * sp; p.vy = 160; // lá do topo, lançado pra um lado
    this.events.push({ type: 'tossed', id: p.id });
  }
  // tempestade de areia do deserto: junta 2 s e depois fecha a visão quase no mapa todo (e deixa mais devagar)
  updateSand(dt) {
    const cy = this.cycle('sand');
    if (cy.s === 2 && this.sandS !== 2) this.events.push({ type: 'sand_start' });
    if (cy.s !== 2 && this.sandS === 2) this.events.push({ type: 'sand_end' });
    this.sandS = cy.s; this.sandActive = cy.s === 2;
    const want = cy.s === 2 ? 1 : cy.s === 1 ? 0.25 * cy.k : 0;
    this.sandK += (want - this.sandK) * Math.min(1, dt * 1.4);
  }
  // neve: tempestade congelante — uma faixa de vento gelado corta o mapa de ponta a ponta (de cima pra baixo
  // ou de baixo pra cima), num lugar sorteado que nunca passa na área de nascimento; antes aparece o aviso no chão
  updateStorm(dt) {
    const cy = this.cycle('storm');
    if (cy.s === 0) { if (this.storm) { this.storm = null; this.events.push({ type: 'storm_end' }); } return; }
    if (!this.storm || this.storm.idx !== cy.idx) {
      const w = FROST.w, lo = FROST.spawnX + w, hi = this.W - FROST.spawnX - w;
      const x = lo + Math.random() * Math.max(1, hi - lo), dir = Math.random() < 0.5 ? 1 : -1;
      this.storm = { idx: cy.idx, x, w, dir, s: cy.s, k: 0, started: false };
      this.events.push({ type: 'storm_warn', x });
    }
    const S = this.storm; S.s = cy.s; S.k = cy.k;
    if (cy.s !== 2) return;
    if (!S.started) { S.started = true; this.events.push({ type: 'storm_start', x: S.x }); }
    for (const p of this.players.values()) {
      if (!p.alive || Math.abs(p.x - S.x) > S.w) continue;
      if (this.time >= (p.slowUntil || 0)) this.events.push({ type: 'frozen', id: p.id });
      p.slowUntil = this.time + FROST.time; p.slowF = FROST.slow;
      // o vento empurra na direção que está soprando
      const nz = p.z + S.dir * FROST.push * dt, r = this.radius(p);
      if (!this.boxes.some((b) => p.y < b.top - 2 && p.y + this.heightOf(p) > b.y0 && this.circleBox(p.x, nz, r, b))) p.z = clamp(nz, this.wallT + r, this.H - this.wallT - r);
    }
  }
  // nave (meteoro do 2D, mudado): a cada 25 s aparece a sombra em 2 lugares (um de cada lado, espelhados);
  // o meteoro cai do céu, fura o vidro do teto e fica ali dentro de vez (tampa visão e passagem). 2 vezes por partida.
  updateMeteor() {
    const cy = this.cycle('meteor'), R = METEOR.r;
    if (this.meteorsDone < METEOR.max && cy.s >= 1 && (!this.meteorFall || this.meteorFall.idx !== cy.idx)) {
      let x = this.W * 0.3, z = this.H / 2;
      for (let i = 0; i < 80; i++) {
        const tx = this.W * 0.15 + Math.random() * this.W * 0.3, tz = this.H * 0.14 + Math.random() * this.H * 0.72;
        if (this.boxes.some((b) => b.y0 < 100 && this.circleBox(tx, tz, R + 20, b))) continue;
        if (this.doors.some((d) => Math.hypot(d.cx - tx, d.cz - tz) < 190 || Math.hypot(this.W - d.cx - tx, d.cz - tz) < 190)) continue;
        if (this.meteors.some((m) => Math.hypot(m.x - tx, m.z - tz) < R * 3)) continue;
        x = tx; z = tz; break;
      }
      const [interval, pre] = this.hz.meteor;
      this.meteorFall = { idx: cy.idx, pts: [[x, z], [this.W - x, z]], r: R, t1: this.hzStart + cy.idx * (interval + this.hz.meteor[2]) + interval, pre, done: false };
      this.events.push({ type: 'meteor_warn', pts: this.meteorFall.pts });
    }
    const F = this.meteorFall;
    if (cy.s === 2 && F && !F.done) {
      F.done = true; this.meteorsDone++;
      F.pts.forEach(([x, z]) => {
        this.meteors.push({ x, z, r: R, seed: Math.floor(Math.random() * 1e6) });
        this.ceilHoles.push({ x, z, r: R * 1.3 });
        this.meteorBoxes.push({ x0: x - METEOR.box, z0: z - METEOR.box, x1: x + METEOR.box, z1: z + METEOR.box, y0: 0, top: METEOR.top });
        this.events.push({ type: 'meteor_hit', x, z, r: R });
        for (const p of this.players.values()) if (p.alive && Math.hypot(p.x - x, p.z - z) < METEOR.hitR) this.damage(p, null, 'meteor');
      });
      this.refreshBoxes();
    }
    if (cy.s === 0 && F && F.done) this.meteorFall = null;
  }
  // vulcão (igual ao meteoro do 2D): a cada 25 s mostra 2 lugares (um de cada lado) e o fogo do vulcão lá
  // embaixo fura o chão ali; só 2 vezes por partida = 4 buracos, que ficam até o fim
  updateErupt() {
    const cy = this.cycle('lava'), R = ERUPT.r;
    if (this.erupted < ERUPT.max && cy.s >= 1 && (!this.erupt || this.erupt.idx !== cy.idx)) {
      let x = this.W * 0.3, z = this.H / 2;
      for (let i = 0; i < 60; i++) {
        const tx = this.W * 0.14 + R + Math.random() * (this.W * 0.4 - this.W * 0.14 - R), tz = this.H * 0.12 + R * 0.5 + Math.random() * (this.H * 0.76 - R);
        if (this.holes.some((h) => Math.hypot(h.x - tx, h.z - tz) < h.r + R + 30)) continue;
        if (this.boxes.some((b) => this.circleBox(tx, tz, R + 12, b))) continue;
        x = tx; z = tz; break;
      }
      this.erupt = { idx: cy.idx, pts: [[x, z], [this.W - x, z]], r: R, done: false, seed: Math.floor(Math.random() * 1e6) };
      this.events.push({ type: 'erupt_warn', pts: this.erupt.pts });
    }
    if (cy.s === 2 && this.erupt && !this.erupt.done) {
      const E = this.erupt; E.done = true; this.erupted++;
      E.pts.forEach(([x, z], i) => {
        this.holes.push({ x, z, r: R, seed: E.seed, m: i });
        this.events.push({ type: 'erupt', x, z, r: R });
        for (const p of this.players.values()) { // quem estava em cima é jogado pra cima pelo fogo (e cai no buraco)
          if (p.alive && (p.x - x) ** 2 + (p.z - z) ** 2 < R * R) { p.vy = 380; p.grounded = false; p.spin = null; }
        }
      });
    }
    if (cy.s === 0 && this.erupt && this.erupt.done) this.erupt = null;
  }
  // de onde sai e com que velocidade a granada (a mão vai pra frente e um pouco pra cima; o navegador desenha o arco com isso)
  // força da granada: k = 0..1 (quanto mais segura o botão, mais longe); pulando vai um pouco mais forte
  nadeLaunch(p, k) {
    k = k == null ? 0.75 : clamp(k, 0, 1);
    const [dx, dy, dz] = this.aimDir(p), h = Math.hypot(dx, dz) || 1;
    const sp = (this.NADE.min + (this.NADE.max - this.NADE.min) * k) * (p.grounded ? 1 : this.NADE.air), up = this.P.nadeUp * (0.6 + 0.4 * k);
    const ox = p.x + dx / h * 26, oy = p.y + this.P.eye * (this.radius(p) / this.P.radius) + 6, oz = p.z + dz / h * 26;
    return [ox, oy, oz, dx * sp + p.vx * 0.4, dy * sp + up + Math.max(0, p.vy) * 0.3, dz * sp + p.vz * 0.4];
  }
  nadeK(p) { return 1; } // (sem carregar: sempre força máxima)
  // prevê o arco até o primeiro toque (uma linha só) e onde a granada vai parar (a área da explosão)
  predictNade(p, smoke, k) {
    const [x, y, z, vx, vy, vz] = this.nadeLaunch(p, k), g = { x, y, z, vx, vy, vz }, pts = [[x, y, z]], fuse = smoke ? this.P.smokeFuse : this.P.nadeFuse;
    const saveEv = this.events.length; let flying = true;
    for (let t = 0, n = 0; t < fuse; t += 1 / 60, n++) {
      for (let i = 0; i < 4; i++) { g.vy -= this.P.gravity / 240; if (this.bounceStep(g, this.P.nadeR, this.NADE.rest, 1 / 240)) { if (flying) pts.push([g.x, g.y, g.z]); flying = false; } }
      if (g.y <= this.groundAt(g.x, g.z) + this.P.nadeR + 0.5) { g.vx *= this.NADE.roll; g.vz *= this.NADE.roll; }
      if (flying && n % 2 === 0) pts.push([g.x, g.y, g.z]);
      if (g.y < -HOLE.depth - 120) break;
    }
    this.events.length = saveEv;
    pts.end = [g.x, g.y, g.z];
    return pts;
  }
  // metrô: aviso (luz vermelha e buzina) numa linha sorteada, depois o trem cruza o mapa inteiro
  updateTrain() {
    if (!this.lanes.length) return;
    const cy = this.cycle('train');
    if (cy.s === 0) { if (this.train) { this.train = null; this.events.push({ type: 'train_end' }); } return; }
    if (!this.train || this.train.idx !== cy.idx) {
      // sorteia por qual trilho começa e pra que lado; na volta vem pelo outro trilho, no sentido contrário
      const i0 = Math.floor(Math.random() * this.lanes.length), x = this.lanes[i0], x2 = this.lanes.length > 1 ? this.lanes[(i0 + 1) % this.lanes.length] : x, dir = Math.random() < 0.5 ? 1 : -1;
      const [interval] = this.hz.train, dur = this.hz.train[2], t2 = this.hzStart + cy.idx * (interval + dur) + interval;
      this.train = { idx: cy.idx, x, dir, xa: x, xb: x2, dir0: dir, t2, lt: t2, leg: 0, s: cy.s, k: 0, hit: [], on: false };
      this.events.push({ type: 'train_warn', x, dir });
    }
    const T = this.train; T.s = cy.s; T.k = cy.k;
    if (cy.s !== 2) return;
    const legT = trainLegT(this.H), el = this.time - T.t2;
    const leg = el < legT ? 0 : el >= legT + TRAIN.gap ? 1 : -1;
    if (leg === 1 && T.leg !== 1) { T.leg = 1; T.x = T.xb; T.dir = -T.dir0; T.lt = T.t2 + legT + TRAIN.gap; T.hit = []; this.events.push({ type: 'train_back', x: T.x, dir: T.dir }); }
    T.on = leg >= 0;
    if (!T.on) return;
    const front = (T.dir > 0 ? -TRAIN.len * 0.2 : this.H + TRAIN.len * 0.2) + T.dir * TRAIN.speed * (this.time - T.lt), back = front - T.dir * TRAIN.len;
    T.front = front;
    for (const p of this.players.values()) {
      if (!p.alive || T.hit.includes(p.id) || Math.abs(p.x - T.x) > TRAIN.half + this.radius(p) || p.y > 150) continue;
      if ((p.z - front) * (p.z - back) > 0) continue; // fora do trem
      T.hit.push(p.id);
      const side = p.x >= T.x ? 1 : -1;
      p.vx = side * TRAIN.push; p.vz = T.dir * TRAIN.push * 0.7; p.vy = TRAIN.up; p.grounded = false;
      this.events.push({ type: 'train_hit', id: p.id, x: p.x, z: p.z });
      this.damage(p, null, 'train');
    }
  }
  // fábrica: move os pistões; quem estava em pé em cima vai junto
  updatePistons() {
    if (!this.pistons.length) return;
    for (const b of this.pistons) {
      const old = b.top; b.top = pistonTop(b.piston, this.time);
      if (b.top === old) continue;
      for (const p of this.players.values()) {
        if (!p.alive || !p.grounded || Math.abs(p.y - old) > 3 || !this.circleBox(p.x, p.z, this.radius(p) * 0.7, b)) continue;
        p.y = b.top;
      }
    }
  }
  // canteiro de obras: a bola de demolição dá uma volta inteira em volta do guindaste e arremessa quem estiver no caminho
  updateCrane() {
    const cy = this.cycle('crane');
    // a bola começa a girar de onde parou da última vez (não "pula" pro outro lado)
    if (this.craneRest == null) this.craneRest = 0;
    if (cy.s === 0) { if (this.crane && this.crane.s !== 0) { this.craneRest = (craneAngle(this.crane, 1e9) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); this.crane.s = 0; } if (this.crane) this.crane.rest = this.craneRest; return; }
    if (!this.crane || this.crane.idx !== cy.idx) {
      const [interval] = this.hz.crane, dur = this.hz.crane[2], t2 = this.hzStart + cy.idx * (interval + dur) + interval;
      this.crane = { idx: cy.idx, a0: this.craneRest, dir: Math.random() < 0.5 ? 1 : -1, t2, s: cy.s, k: 0, hit: [], rest: this.craneRest };
      this.events.push({ type: 'crane_warn' });
    }
    const C = this.crane; C.s = cy.s; C.k = cy.k;
    if (cy.s !== 2) return;
    const a = craneAngle(C, this.time), bx = this.W / 2 + Math.cos(a) * CRANE.R, bz = this.H / 2 + Math.sin(a) * CRANE.R;
    for (const p of this.players.values()) {
      if (!p.alive || C.hit.includes(p.id)) continue;
      const r = this.radius(p), dx = p.x - bx, dz = p.z - bz;
      if (dx * dx + dz * dz > (CRANE.ball + r) ** 2 || p.y > CRANE.y + CRANE.ball || p.y + this.heightOf(p) < CRANE.y - CRANE.ball) continue;
      C.hit.push(p.id); p.ladder = null;
      const tx = -Math.sin(a) * C.dir, tz = Math.cos(a) * C.dir, rx = Math.cos(a), rz = Math.sin(a);
      p.vx = tx * CRANE.push + rx * 200; p.vz = tz * CRANE.push + rz * 200; p.vy = CRANE.up; p.grounded = false;
      this.events.push({ type: 'crane_hit', id: p.id, x: p.x, z: p.z });
      this.damage(p, null, 'crane');
    }
  }
  // mar: a onda vem de um lado sorteado (menos o do navio), passa por cima da borda e arrasta quem pegar
  // navio balançando: inclina pros lados (roll), pra frente/trás (pitch) e sobe/desce (heave)
  updateSway() {
    const t = this.time, S = this.swayState, SW = this.swell;
    let big = 0;
    if (SW && SW.s === 2) big = Math.sin(Math.PI * Math.min(1, SW.k)) * SW.side; // onda grande: inclina forte e volta
    S.roll = SWAY.roll * Math.sin(t * 2 * Math.PI / 7.3) + SWAY.big * big;
    S.pitch = SWAY.pitch * Math.sin(t * 2 * Math.PI / 9.1 + 1.3);
    const w = 2 * Math.PI / 5.2; S.heave = SWAY.heave * Math.sin(t * w); S.ah = -SWAY.heave * w * w * Math.sin(t * w); S.vh = SWAY.heave * w * Math.cos(t * w);
  }
  updateSwell() {
    const cy = this.cycle('swell');
    if (!this.swell || this.swell.idx !== cy.idx) this.swell = { idx: cy.idx, side: Math.random() < 0.5 ? -1 : 1, s: 0, k: 0, warned: false, started: false };
    const W = this.swell; W.s = cy.s; W.k = cy.k;
    if (cy.s >= 1 && !W.warned) { W.warned = true; this.events.push({ type: 'swell_warn', side: W.side }); }
    if (cy.s === 2 && !W.started) { W.started = true; this.events.push({ type: 'swell_start', side: W.side }); }
  }
  updateWave(dt) {
    const cy = this.cycle('wave'), idx = Math.max(0, cy.idx);
    const [interval, , dur] = this.hz.wave;
    // a próxima onda já é sorteada assim que a anterior acaba: ela aparece lá longe e vem crescendo o tempo todo
    if (!this.wave || this.wave.idx !== idx) {
      const sides = ['L', 'R', 'T', 'B'].filter((q) => q !== this.shipSide), side = sides[Math.floor(Math.random() * sides.length)];
      const t2 = (this.phase === 'playing' ? this.hzStart : (this.hzStart || this.time)) + idx * (interval + dur) + interval;
      if (this.wave) { for (const p of this.players.values()) p.inWave = false; this.events.push({ type: 'wave_end' }); }
      this.wave = { idx, side, t2, s: 0, k: 0, warned: false };
    }
    const Wv = this.wave; Wv.s = cy.s; Wv.k = cy.k;
    if (cy.s >= 1 && !Wv.warned) { Wv.warned = true; this.events.push({ type: 'wave_warn', side: Wv.side }); }
    if (cy.s !== 2) return;
    const horiz = Wv.side === 'L' || Wv.side === 'R', len = horiz ? this.W : this.H, dir = Wv.side === 'L' || Wv.side === 'T' ? 1 : -1;
    const d = (this.time - Wv.t2) * WAVE.speed - WAVE.band, pos = dir > 0 ? d : len - d; // frente da onda
    Wv.pos = pos; Wv.dir = dir; Wv.horiz = horiz;
    if (d >= 0 && !Wv.arrived) { Wv.arrived = true; this.events.push({ type: 'wave_arrive', side: Wv.side }); } // chegou na plataforma (o som toca 1 vez)
    for (const p of this.players.values()) {
      if (!p.alive || p.spin || p.y > 160) continue;
      const c = horiz ? p.x : p.z;
      if ((c - pos) * dir > 0 || (pos - c) * dir > WAVE.band) continue; // fora da faixa da onda
      const v = dir * WAVE.speed * WAVE.carry;
      if (horiz) p.vx = v; else p.vz = v;
      if (p.grounded) { p.vy = WAVE.lift; p.grounded = false; }
      if (!p.inWave) { p.inWave = true; this.events.push({ type: 'wave_hit', id: p.id }); }
    }
    for (const p of this.players.values()) if (p.inWave) { const c = horiz ? p.x : p.z; if ((c - pos) * dir > 0 || (pos - c) * dir > WAVE.band) p.inWave = false; }
  }
  // granada / fumaça: joga para onde a mira aponta, quica no muro e no chão
  throwNade(p, smoke, k) {
    if (smoke ? p.smokes < 1 : p.nades < 1) { p.weapon = p.lastWeapon; return; }
    if (smoke) p.smokes--; else p.nades--;
    p.fireReady = this.time + 0.6;
    const [ox, oy, oz, vx, vy, vz] = this.nadeLaunch(p, k);
    this.nades.push({ id: this.nextId++, owner: p.id, team: p.team, smoke, x: ox, y: oy, z: oz,
      vx, vy, vz, t0: this.time, spin: 0 });
    this.events.push({ type: smoke ? 'smoke_throw' : 'nade_throw', id: p.id, k: k == null ? 0.75 : k });
    p.weapon = p.lastWeapon || 'primary'; // volta para a arma que estava
  }

  // move uma bolinha (bala ou granada) um pedacinho e quica: devolve true se bateu
  bounceStep(o, r, rest, dt) {
    o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt;
    let hit = false;
    // chão (menos em cima de um buraco do vulcão: cai lá dentro)
    if (o.y < r && !(this.holes && this.holeAt(o.x, o.z, 0)) && !(this.deck && !this.onDeck(o.x, o.z, 0))) { o.y = r; o.vy = Math.abs(o.vy) * rest; o.vx *= 0.98; o.vz *= 0.98; hit = 'floor'; }
    // montanha de areia: quica seguindo a inclinação do morro
    if (this.dunes) {
      const g = this.dunes.at(o.x, o.z);
      if (g > 0.5 && o.y - r < g) {
        const [gx, gz] = this.dunes.grad(o.x, o.z), l = Math.hypot(gx, 1, gz);
        const nx = -gx / l, ny = 1 / l, nz = -gz / l;
        o.y = g + r;
        const dot = o.vx * nx + o.vy * ny + o.vz * nz;
        if (dot < 0) { o.vx -= (1 + rest) * dot * nx; o.vy -= (1 + rest) * dot * ny; o.vz -= (1 + rest) * dot * nz; if (rest < 1) { o.vx *= 0.97; o.vz *= 0.97; } }
        hit = 'floor';
      }
    }
    // pisos redondos (sacada/patamar) e rampas em espiral: quicam por cima e por baixo
    for (const D of this.discs) {
      if (o.y - r > D.top || o.y + r < D.y0 || !this.inDisc(D, o.x, o.z)) continue;
      if (o.vy <= 0 && o.y > (D.top + D.y0) / 2) { o.y = D.top + r; o.vy = Math.abs(o.vy) * rest; o.vx *= 0.98; o.vz *= 0.98; hit = 'floor'; }
      else { o.y = D.y0 - r; o.vy = -Math.abs(o.vy) * rest; hit = 'wall'; }
    }
    for (const S of this.slopes) { const h = this.slopeH(S, o.x, o.z); if (h != null && o.y - r < h) { o.y = h + r; o.vy = Math.abs(o.vy) * rest; o.vx *= 0.98; o.vz *= 0.98; hit = 'floor'; } }
    for (const S of this.spirals) {
      const hs = this.spiralHs(S, o.x, o.z); if (!hs) continue;
      for (const h of hs) if (o.y - r < h && o.y + r > h - (S.th || 10)) { if (o.vy <= 0 && o.y > h - 5) { o.y = h + r; o.vy = Math.abs(o.vy) * rest; o.vx *= 0.98; o.vz *= 0.98; hit = 'floor'; } else { o.y = h - (S.th || 10) - r; o.vy = -Math.abs(o.vy) * rest; hit = 'wall'; } }
    }
    for (const S of this.segs) {
      if (o.y - r > S.top || o.y + r < (S.y0 || 0)) continue;
      const [cx, cz, d] = this.segNear(S, o.x, o.z), m = r + S.t;
      if (d >= m) continue;
      const nx = d > 1e-6 ? (o.x - cx) / d : S.nx, nz = d > 1e-6 ? (o.z - cz) / d : S.nz;
      o.x = cx + nx * (m + 0.5); o.z = cz + nz * (m + 0.5);
      const dot = o.vx * nx + o.vz * nz;
      if (dot < 0) { o.vx -= (1 + rest) * dot * nx; o.vz -= (1 + rest) * dot * nz; if (rest < 1) { o.vx *= rest; o.vz *= rest; } }
      return 'wall';
    }
    for (const b of this.boxes) {
      const cx = clamp(o.x, b.x0, b.x1), cy = clamp(o.y, b.y0, b.top), cz = clamp(o.z, b.z0, b.z1);
      let nx = o.x - cx, ny = o.y - cy, nz = o.z - cz; const d2 = nx * nx + ny * ny + nz * nz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-9) { const d = Math.sqrt(d2); nx /= d; ny /= d; nz /= d; }
      else { // dentro da caixa: sai pela face mais perto
        const opts = [[o.x - b.x0, -1, 0, 0], [b.x1 - o.x, 1, 0, 0], [b.top - o.y, 0, 1, 0], [o.z - b.z0, 0, 0, -1], [b.z1 - o.z, 0, 0, 1]].concat(b.y0 > 0 ? [[o.y - b.y0, 0, -1, 0]] : []);
        opts.sort((a, c) => a[0] - c[0]); [, nx, ny, nz] = opts[0];
      }
      o.x = cx + nx * (r + 0.5); o.y = cy + ny * (r + 0.5); o.z = cz + nz * (r + 0.5);
      const dot = o.vx * nx + o.vy * ny + o.vz * nz;
      if (dot < 0) { o.vx -= (1 + rest) * dot * nx; o.vy -= (1 + rest) * dot * ny; o.vz -= (1 + rest) * dot * nz; if (rest < 1) { o.vx *= rest; o.vz *= rest; } }
      hit = 'wall';
      break;
    }
    return hit;
  }

  updateBullets(dt) {
    const keep = [];
    for (const b of this.bullets) {
      const sp = Math.hypot(b.vx, b.vy, b.vz), n = Math.max(1, Math.ceil(sp * dt / (b.r * 0.9)));
      const sub = dt / n; let dead = false;
      for (let i = 0; i < n && !dead; i++) {
        b.vy -= b.grav * sub;
        let hit = this.bounceStep(b, b.r, b.rest, sub);
        if (this.portals.length && this.portalCross(b, b.r, false)) this.events.push({ type: 'portal_shot', x: b.x, y: b.y, z: b.z });
        // caiu na lava ou saiu do mapa: some
        if (b.y < -HOLE.depth - 120 || b.y > 1600 || b.x < -80 || b.z < -80 || b.x > this.W + 80 || b.z > this.H + 80) { dead = true; break; }
        // teto que ricocheteia (folhas da floresta / vidro da nave)
        if (!hit && this.ceilingY != null && b.y + b.r >= this.ceilingY && b.vy > 0 && !this.ceilHoles.some((h) => (b.x - h.x) ** 2 + (b.z - h.z) ** 2 < h.r * h.r)) {
          b.y = this.ceilingY - b.r; b.vy = -Math.abs(b.vy) * (b.rest || 0.7); hit = 'ceiling';
        }
        if (hit) {
          b.bounces++;
          this.events.push({ type: 'bounce', x: b.x, y: b.y, z: b.z, left: b.max - b.bounces });
          if (b.bounces > b.max || (hit === 'floor' && Math.abs(b.vy) < 60 && b.grav)) dead = true;
        }
        for (const q of this.players.values()) {
          if (!q.alive || !this.hostile(b.owner, b.team, q) || this.time < q.protectUntil) continue;
          const r = this.radius(q), h = this.heightOf(q);
          const cy = clamp(b.y, q.y + r * 0.5, q.y + h - r * 0.4);
          if ((b.x - q.x) ** 2 + (b.z - q.z) ** 2 + (b.y - cy) ** 2 < (r + b.r) ** 2) { this.damage(q, b.owner, b.kind, b); dead = true; break; }
        }
        // cidade à noite: atirar no poste apaga a luz por um tempo
        if (!dead) for (const L of this.lamps) {
          if (this.time < L.offUntil) continue;
          const onBulb = (b.x - L.x - L.dx * LAMP.off) ** 2 + (b.y - LAMP.h) ** 2 + (b.z - L.z - L.dz * LAMP.off) ** 2 < LAMP.hitR ** 2;
          const onPole = b.y > 10 && b.y < LAMP.h + 6 && (b.x - L.x) ** 2 + (b.z - L.z) ** 2 < 16 ** 2;
          if (onBulb || onPole) {
            L.offUntil = this.time + 9; this.events.push({ type: 'lamp_off', i: L.i, x: L.x, z: L.z }); dead = true; break;
          }
        }
      }
      if (!dead && this.time - b.t0 < 8) keep.push(b);
    }
    this.bullets = keep;
  }

  updateNades(dt) {
    const keep = [];
    for (const g of this.nades) {
      const n = 4, sub = dt / n;
      for (let i = 0; i < n; i++) {
        g.vy -= this.P.gravity * sub; this.bounceStep(g, this.P.nadeR, this.NADE.rest, sub);
        if (this.portals.length) this.portalCross(g, this.P.nadeR, false);
      }
      // caiu na lava: some (sem explodir)
      if (g.y < -HOLE.depth - 120 || (this.deck && g.y < this.deck.kill)) { this.events.push({ type: this.deck ? 'sea_splash' : 'lava_splash', x: g.x, z: g.z }); continue; }
      if (g.y <= this.groundAt(g.x, g.z) + this.P.nadeR + 0.5) { g.vx *= this.NADE.roll; g.vz *= this.NADE.roll; } // rolando no chão (pouco)
      g.spin += Math.hypot(g.vx, g.vz) * dt * 0.05;
      const age = this.time - g.t0;
      if (g.smoke ? age >= this.P.smokeFuse : age >= this.P.nadeFuse) {
        if (g.smoke) {
          this.smokes.push({ id: g.id, x: g.x, z: g.z, t0: this.time, until: this.time + this.P.smokeTime });
          this.events.push({ type: 'smoke', x: g.x, y: 0, z: g.z });
        } else this.explode(g);
        continue;
      }
      keep.push(g);
    }
    this.nades = keep;
  }
  explode(g) {
    this.events.push({ type: 'explode', x: g.x, y: g.y, z: g.z });
    for (const q of this.players.values()) {
      if (!q.alive || !this.hostile(g.owner, g.team, q) || this.time < q.protectUntil) continue;
      const cy = clamp(g.y, q.y, q.y + this.heightOf(q));
      const d = Math.hypot(q.x - g.x, cy - g.y, q.z - g.z);
      if (d > this.P.nadeRadius + this.radius(q)) continue;
      if (this.segBlocked(g.x, g.y + 2, g.z, q.x, q.y + this.P.chest, q.z)) continue;
      this.damage(q, g.owner, 'nade');
    }
  }

  damage(v, by, weapon, bullet) {
    if (!v.alive || this.time < v.invulnUntil || this.time < v.protectUntil) return;
    if (this.godIds.has(v.id)) { // sala de teste / modo teste: você não morre, só mostra o marcador de acerto
      v.invulnUntil = this.time + this.P.invuln;
      this.events.push({ type: 'hit', by, victim: v.id, weapon });
      return;
    }
    v.lives--; v.invulnUntil = this.time + this.P.invuln;
    if (by) v.lastHitBy[by] = this.time;
    const a = this.players.get(by);
    if (v.lives <= 0) {
      v.alive = false; v.d++; v.respawnAt = this.time + this.P.respawn; v.deadAt = this.time; v.reloadUntil = 0; v.charge0 = 0;
      if (a) { a.k++; if (this.mode === 'tdm' && a.team !== v.team) this.score[a.team]++; }
      for (const id in v.lastHitBy) if (id !== by && this.time - v.lastHitBy[id] < 10) { const h = this.players.get(id); if (h) h.a++; }
      // lápide com o nome no lugar da morte (o corpo some)
      this.tombs.push({ id: this.nextId++, x: v.x, y: v.y, z: v.z, name: v.name, team: v.team, until: this.time + this.P.tombTime, t0: this.time });
      // (killcam: qual tiro matou, quando saiu e se quem atirou estava em 1ª pessoa)
      this.lastKill = { killer: by || null, victim: v.id, t: this.time, bid: bullet ? bullet.id : null, bt0: bullet ? bullet.t0 : null, fp: a ? !!a.fp : false };
      this.events.push({ type: 'kill', killer: by, victim: v.id, weapon });
    } else this.events.push({ type: 'hit', by, victim: v.id, weapon });
  }

  // ---------- modos de jogo ----------
  // troca de fase: contagem -> jogando -> fim do round -> (próximo round | fim da partida)
  updatePhase() {
    if (this.phase === 'countdown' && this.time >= this.phaseUntil) {
      this.phase = 'playing'; this.hzStart = this.time;
      this.events.push({ type: 'round_start', round: this.round });
    } else if (this.phase === 'roundEnd' && this.time >= this.phaseUntil) {
      const need = Math.floor(this.totalRounds / 2) + 1;
      if (this.score.A >= need || this.score.B >= need || this.round >= this.totalRounds) {
        const s = this.score, winner = s.A > s.B ? 'A' : s.B > s.A ? 'B' : null;
        this.finish({ mode: 'rounds', winner, score: Object.assign({}, s) });
      } else this.nextRound();
    }
  }
  nextRound() {
    this.round++;
    this.bullets = []; this.nades = []; this.smokes = []; this.tombs = [];
    if (this.holes) { this.holes = []; this.erupted = 0; this.erupt = null; }
    this.tornado = null; this.storm = null; this.train = null; this.wave = null; this.crane = null; this.craneRest = 0; this.sandK = 0; this.sandS = 0; this.sandActive = false; this.lightOn = true; this.lightS = 0;
    for (const L of this.lamps) L.offUntil = 0;
    this.meteors = []; this.meteorBoxes = []; this.ceilHoles = []; this.meteorsDone = 0; this.meteorFall = null;
    for (const d of this.doors) { d.open = 0; d.until = 0; d.solid = true; }
    this.portalIdx = -99; this.applyPortalPairs(null);
    for (const p of this.players.values()) this.spawn(p);
    this.phase = 'countdown'; this.phaseUntil = this.time + this.startDelay; this.hzStart = this.phaseUntil;
    this.events.push({ type: 'round_countdown', round: this.round });
  }
  finish(res) {
    if (this.phase === 'matchEnd') return;
    const players = [...this.players.values()].map((p) => ({ id: p.id, name: p.name, team: p.team, k: p.k, d: p.d, a: p.a }));
    this.result = Object.assign({ players, rounds: this.totalRounds, killLimit: this.killLimit, hillTarget: this.hillTarget }, res);
    this.phase = 'matchEnd'; this.bullets = []; this.nades = [];
    this.events.push(Object.assign({ type: 'match_end' }, this.result));
  }
  checkEnd() {
    if (this.phase !== 'playing') return;
    const el = this.time - this.hzStart;
    if (this.mode === 'rounds') {
      let aA = 0, aB = 0;
      for (const p of this.players.values()) if (p.alive) { if (p.team === 'A') aA++; else aB++; }
      const timeUp = el >= this.roundTime;
      if (aA > 0 && aB > 0 && !timeUp) return;
      const winner = timeUp && aA > 0 && aB > 0 ? null : aA > 0 ? 'A' : aB > 0 ? 'B' : null; // tempo acabou = empate
      if (winner) this.score[winner]++;
      this.phase = 'roundEnd'; this.phaseUntil = this.time + this.endDelay; this.bullets = [];
      this.events.push({ type: 'round_end', winner, timeUp: timeUp && !!(aA && aB), score: Object.assign({}, this.score), round: this.round });
      return;
    }
    if (this.mode === 'livre') return;
    const timeUp = this.matchTime > 0 && el >= this.matchTime;
    let reached = false;
    if (this.mode === 'tdm') reached = this.killLimit > 0 && (this.score.A >= this.killLimit || this.score.B >= this.killLimit);
    else if (this.mode === 'koth') reached = this.score.A >= this.hillTarget || this.score.B >= this.hillTarget;
    else if (this.mode === 'ffa') for (const p of this.players.values()) if (this.killLimit > 0 && p.k >= this.killLimit) reached = true;
    if (!timeUp && !reached) return;
    let winner = null;
    if (this.mode === 'ffa') {
      const ranked = [...this.players.values()].sort((a, b) => b.k - a.k || a.d - b.d);
      if (ranked.length && (ranked.length < 2 || ranked[0].k > ranked[1].k)) winner = ranked[0].id;
    } else {
      const a = Math.floor(this.score.A), b = Math.floor(this.score.B); winner = a > b ? 'A' : b > a ? 'B' : null;
    }
    this.finish({ mode: this.mode, winner, timeUp, score: { A: Math.floor(this.score.A), B: Math.floor(this.score.B) } });
  }
  // rei da colina: a área vale 30 s (depois mostra 3 s onde vai ser a próxima); ponto por segundo pra quem estiver sozinho nela
  updateHill(dt) {
    if (this.mode !== 'koth') return;
    const c = this.cfg || {}, every = c.hillMoveEvery || 30, prev = c.hillPreview != null ? c.hillPreview : 3, R = c.hillRadius || 130;
    const el = Math.max(0, this.time - this.hzStart);
    let idx, n, pv = 0;
    if (el < every) { idx = 0; n = every - el; }
    else { const per = prev + every, e = el - every, t = e % per; idx = 1 + Math.floor(e / per); if (t < prev) { pv = 1; n = prev - t; } else n = per - t; }
    if (!this.hill || this.hill.idx !== idx) {
      let best = null;
      for (let i = 0; i < 60; i++) {
        const x = this.W * (0.32 + Math.random() * 0.36), z = R + this.wallT + 20 + Math.random() * (this.H - 2 * (R + this.wallT + 20));
        if (this.boxes.some((b) => this.circleBox(x, z, 30, b)) || this.holeAt(x, z, -40) || !this.inside(x, z, R * 0.6)) continue;
        if (this.hill && Math.hypot(x - this.hill.x, z - this.hill.z) < R * 1.6) continue;
        best = { x, z }; break;
      }
      best = best || { x: this.W / 2, z: this.H / 2 };
      this.hill = { idx, x: best.x, z: best.z, r: R };
      this.events.push({ type: 'hill_move', x: best.x, z: best.z });
    }
    this.hill.n = n; this.hill.pv = pv;
    if (pv || this.phase !== 'playing') { this.hillOwner = null; return; }
    const inside = { A: 0, B: 0 };
    for (const p of this.players.values()) if (p.alive && Math.hypot(p.x - this.hill.x, p.z - this.hill.z) <= R && p.y < this.groundAt(p.x, p.z) + 80) inside[p.team]++;
    const owner = inside.A && !inside.B ? 'A' : inside.B && !inside.A ? 'B' : inside.A && inside.B ? 'X' : null;
    if (owner === 'A' || owner === 'B') this.score[owner] += dt * (c.hillPointsPerSec || 1);
    this.hillOwner = owner;
  }

  // ---------- bots ----------
  botThink(p, dt) {
    const L = BOT_LEVELS[p.level] || BOT_LEVELS.amador, ai = p.ai;
    ai.t = (ai.t || 0) - dt; ai.aimT = (ai.aimT || 0) - dt;
    let target = null, best = 1e9, sees = false;
    for (const q of this.players.values()) {
      if (!q.alive || !this.hostile(p.id, p.team, q)) continue;
      const d = Math.hypot(q.x - p.x, q.z - p.z), vis = this.canSee(p, q), score = d + (vis ? 0 : 700);
      if (score < best) { best = score; target = q; sees = vis; }
    }
    ai.seeT = sees ? (ai.seeT || 0) + dt : 0;
    const dist = target ? Math.hypot(target.x - p.x, target.z - p.z) : 0;
    if (ai.t <= 0) {
      ai.t = 0.5 + Math.random() * 0.9;
      let fwd = 1, side = 0;
      if (Math.random() < L.idle) fwd = 0;
      else if (target && sees) { fwd = dist > 350 ? 0.6 : dist < 150 ? -0.4 : 0; side = Math.random() < 0.5 ? 1 : -1; }
      else if (target) { fwd = 1; side = (Math.random() - 0.5) * 0.8; ai.wander = Math.atan2(target.z - p.z, target.x - p.x) + (Math.random() - 0.5) * 1.2; }
      else { ai.wander = Math.random() * Math.PI * 2; }
      // rei da colina: sem inimigo à vista, vai pra colina (e fica rondando lá dentro)
      if (this.mode === 'koth' && this.hill && !this.hill.pv && !(target && sees)) {
        const dh = Math.hypot(this.hill.x - p.x, this.hill.z - p.z);
        ai.wander = Math.atan2(this.hill.z - p.z, this.hill.x - p.x) + (dh < this.hill.r * 0.6 ? Math.PI * (Math.random() - 0.5) * 2 : (Math.random() - 0.5) * 0.5);
        fwd = dh < this.hill.r * 0.5 ? (Math.random() < 0.5 ? 0.4 : 0) : 1; side = 0;
      }
      ai.fwd = fwd; ai.side = side;
      if (Math.random() < L.jump) this.jump(p);
    }
    // travado no muro: pula (e às vezes pula duplo)
    const moved = Math.hypot(p.x - (ai.lx ?? p.x), p.z - (ai.lz ?? p.z));
    ai.stuck = moved < 1 && (ai.fwd || ai.side) ? (ai.stuck || 0) + dt : 0;
    ai.lx = p.x; ai.lz = p.z;
    if (ai.stuck > 0.3) { if (p.grounded) this.jump(p); else if (p.vy < 50) this.jump(p); ai.wander = Math.random() * Math.PI * 2; ai.t = 0.5; ai.stuck = 0; }
    if (target && sees) {
      if (ai.aimT <= 0) { // mira com reação e erro
        ai.aimT = L.react;
        const tt = dist / 900;
        const tx = target.x + target.vx * tt, tz = target.z + target.vz * tt, ty = target.y + this.P.chest;
        ai.yaw = Math.atan2(tz - p.z, tx - p.x) + (Math.random() - 0.5) * 2 * L.err;
        ai.pitch = Math.atan2(ty - (p.y + this.P.eye), Math.hypot(tx - p.x, tz - p.z)) + (Math.random() - 0.5) * L.err;
      }
      p.yaw += Math.atan2(Math.sin(ai.yaw - p.yaw), Math.cos(ai.yaw - p.yaw)) * Math.min(1, dt * 14);
      p.pitch += (ai.pitch - p.pitch) * Math.min(1, dt * 14);
      p.input.fire = ai.seeT > L.react && Math.random() < L.fire;
      if (p.nades && dist > 220 && dist < 600 && Math.random() < dt * L.nade) { this.setWeapon(p, 'nade'); p.pitch = 0.35; this.throwNade(p, false, 0.55 + Math.random() * 0.4); }
    } else {
      p.input.fire = false;
      if (ai.wander != null) p.yaw += Math.atan2(Math.sin(ai.wander - p.yaw), Math.cos(ai.wander - p.yaw)) * Math.min(1, dt * 4);
      p.pitch *= 0.9;
    }
    p.input.fwd = ai.fwd || 0; p.input.side = ai.side || 0;
    // vulcão: não anda pra dentro do buraco de lava
    if (this.holes && p.grounded && (p.input.fwd || p.input.side)) {
      const fx = Math.cos(p.yaw), fz = Math.sin(p.yaw);
      let wx = fx * p.input.fwd - fz * p.input.side, wz = fz * p.input.fwd + fx * p.input.side;
      const wl = Math.hypot(wx, wz) || 1; wx /= wl; wz /= wl;
      const h = this.holeAt(p.x + wx * 60, p.z + wz * 60, -22);
      if (h) { p.input.fwd = 0; p.input.side = 0; ai.wander = Math.atan2(p.z - h.z, p.x - h.x); ai.t = Math.min(ai.t, 0.35); ai.stuck = 0; if (!sees) ai.fwd = 0; }
    }
    if (p.weapon !== 'primary' && p.weapon !== 'knife') p.weapon = 'primary';
  }
}
