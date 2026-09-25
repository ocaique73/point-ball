// Simulação 3D do Point Ball (só da demo 3D). Não mexe no jogo 2D.
// Tem altura e gravidade: pulo, pulo duplo por cima dos muros, tiro e granada indo para onde a mira aponta,
// ricochete em muro e no chão, armas diferentes, fumaça, lápide e bots.
// Unidades iguais às do 2D (mapa 1600 x 1000). Eixos: x e z no chão, y para cima.

export const WEAPONS = {
  lancador:   { name: 'Lançador de borracha', speed: 900, grav: 0, r: 5, bounces: 3, cd: 0.9, mag: 20, mags: 4, reload: 1.5, rest: 1.0, model: 'blaster', arms: '1H' },
  estilingue: { name: 'Estilingue', speed: 780, grav: 520, r: 6, bounces: 4, cd: 0.65, mag: 12, mags: 5, reload: 1.2, rest: 0.9, model: 'sling', arms: '1H' },
  mao:        { name: 'Bolinha na mão', speed: 560, grav: 900, r: 8, bounces: 5, cd: 0.45, mag: 6, mags: 8, reload: 0.9, rest: 0.85, model: 'hand', arms: 'throw' },
  arco:       { name: 'Arco (flecha de borracha)', speed: 1500, minSpeed: 650, grav: 380, r: 5, bounces: 2, cd: 0.25, mag: 10, mags: 4, reload: 1.6, rest: 0.8, model: 'bow', arms: '2H', charge: 0.8, arrow: true },
  disco:      { name: 'Disco de borracha', speed: 620, grav: 0, r: 11, bounces: 7, cd: 1.1, mag: 8, mags: 4, reload: 1.8, rest: 1.0, model: 'disc', arms: 'throw', flat: true }
};
export const WEAPON_IDS = Object.keys(WEAPONS);

export const P = {
  radius: 25, height: 64, eye: 56, chest: 40, speed: 260, airControl: 0.35,
  gravity: 1400, jumpV: 400, doubleJumpV: 540, doubleJumpCd: 15, lives: 2, shrink: 0.65, invuln: 0.4,
  respawn: 2, protect: 1, tombTime: 8, wallH: 120, borderH: 150,
  knifeRange: 50, knifeCd: 0.4, knifeArc: 55 * Math.PI / 180,
  nadeR: 7, nadeSpeed: 620, nadeUp: 160, nadeFuse: 1.8, nadeRadius: 105, smokeFuse: 1.3, smokeRadius: 200, smokeTime: 6
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

// ---------- alturas por mapa ----------
// mapas fechados (sala escura, portais, base na Lua): parede de borda até o teto; o teto ricocheteia tiro
export const CEILING_Y = { floresta: 360, nave: 360, escuro: 360, portal: 360 };
export const BORDER_H = { nave: 360, escuro: 360, portal: 360 };
// poste da cidade: altura da lâmpada, distância dela pro poste e o raio que o tiro acerta
export const LAMP = { h: 128, off: 20, hitR: 30 };
// árvores da floresta: tronco alto (bate tiro e gente), copa lá em cima pra não atrapalhar a visão
export const TREE = { top: 235, r: 11 };
// eventos de mapa: igual ao 2D, o primeiro só acontece 25 s depois do começo e repete a cada 25 s
export const TORNADO = { r: 132, speed: 330, spin: 0.7, throwD: 450, air: 0.9 };
export const STORM = { r: 320, slow: 0.45, time: 1.5 }; // chuva congelante: 1/5 do mapa
export const ERUPT = { r: 72, max: 2 }; // vulcão: 2 erupções = 4 buracos (2 de cada lado)
function seededRnd(seed) { let v = seed >>> 0; return () => { v = (v * 1664525 + 1013904223) >>> 0; return v / 4294967296; }; }
// árvores espalhadas pela floresta (sempre as mesmas, espelhadas; servidor e navegador calculam igual)
export function forestTrees(W, H, walls) {
  const rnd = seededRnd(20260925), out = [], pts = [];
  const free = (x, z, m) => walls.every((R) => { const cx = clamp(x, R.x, R.x + R.w), cz = clamp(z, R.y, R.y + R.h); return (x - cx) ** 2 + (z - cz) ** 2 > m * m; });
  for (let i = 0; i < 5; i++) {
    for (let t = 0; t < 80; t++) {
      const x = W * 0.17 + rnd() * W * 0.29, z = H * 0.08 + rnd() * H * 0.84;
      if (!free(x, z, 55) || pts.some(([a, b]) => Math.hypot(a - x, b - z) < 170)) continue;
      pts.push([x, z], [W - x, z]); break;
    }
  }
  for (const [x, z] of pts) out.push({ x: x - TREE.r, y: z - TREE.r, w: TREE.r * 2, h: TREE.r * 2, tree: true, top: TREE.top });
  return out;
}

// ---------- vulcão: o mapa flutua em cima de um vulcão gigante; a erupção fura o chão ----------
// depth = grossura da laje; quem cai passa dela e morre ao chegar em -kill
export const HOLE = { depth: 90, kill: 300, far: 1400 };
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
      const r = 58 + rnd() * 24;
      const x = W * 0.17 + rnd() * (W * 0.24), z = 100 + rnd() * (H - 200);
      if (!free(x, z, r + 22) || !free(W - x, z, r + 22)) continue;
      const seed = Math.floor(rnd() * 1e6);
      holes.push({ x, z, r, seed, m: 0 }, { x: W - x, z, r, seed, m: 1 });
      break;
    }
  }
  return holes;
}

// ---------- deserto: montanhas de areia (dá pra andar e subir em cima) ----------
// cada parede do meio do deserto vira uma crista de areia; a altura é a mesma no servidor e no navegador
export const DUNE = { h: 108, w: 92, cell: 10 }; // só onde eram as paredes
export class DuneField {
  static isDune(R) { return !R.border && !R.space; }
  constructor(walls, W, H) {
    this.W = W; this.H = H;
    this.segs = [];
    for (const R of walls) {
      if (!DuneField.isDune(R)) continue;
      const horiz = R.w >= R.h, t = Math.min(R.w, R.h);
      const ax = horiz ? R.x + t / 2 : R.x + R.w / 2, az = horiz ? R.y + R.h / 2 : R.y + t / 2;
      const bx = horiz ? R.x + R.w - t / 2 : R.x + R.w / 2, bz = horiz ? R.y + R.h / 2 : R.y + R.h - t / 2;
      const len = Math.hypot(bx - ax, bz - az);
      // cristas curtas ficam mais baixinhas (montinho), as compridas viram serra
      const h = DUNE.h * clamp(0.72 + len / 900, 0.72, 1.05);
      this.segs.push({ ax, az, bx, bz, h, w: DUNE.w });
    }
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
    if (best <= 0) return 0;
    void k2;
    // ondinhas de vento na areia
    const rip = Math.sin(x * 0.045 + z * 0.018) * 0.6 + Math.sin(x * 0.021 - z * 0.05 + 1.7) * 0.4;
    return best + rip * 3.2 * Math.min(1, best / 30);
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
    this.WEAPONS = {}; for (const k of WEAPON_IDS) this.WEAPONS[k] = Object.assign({}, WEAPONS[k], (opts.weapons && opts.weapons[k]) || {});
    // sala de teste / modo teste: só quem está nesta lista não morre (você); os bots morrem normal
    this.godIds = new Set(opts.godIds || (opts.godMode ? ['me'] : []));
    // deserto: as paredes do meio viram montanhas de areia (terreno), só a borda continua sendo muro
    this.dunes = opts.terrain === 'dunes' ? new DuneField(walls, mapW, mapH) : null;
    this.boxes = walls.filter((R) => !R.space && !(this.dunes && DuneField.isDune(R))).map((R) => ({ x0: R.x, z0: R.y, x1: R.x + R.w, z1: R.y + R.h, y0: R.y0 || 0, top: R.top != null ? R.top : R.border ? this.P.borderH : this.P.wallH }));
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
    const c = this.cfg || {}, v = (x, d) => (x != null ? x : d);
    // [intervalo, aviso, duração] — mesmo ciclo do 2D (espera -> aviso -> efeito -> repete)
    this.hz = {
      sand: [v(c.sandInterval, 25), v(c.sandWarn, 2), 9],
      tornado: [v(c.tornadoInterval, 25), v(c.tornadoGrow, 2), v(c.tornadoActive, 4.5)],
      storm: [v(c.stormInterval, 25), 2, v(c.stormDuration, 3.5)],
      dark: [v(c.lightsInterval, 25), v(c.lightsFlicker, 1), v(c.lightsOffDuration, 1)],
      lava: [v(c.meteorInterval, 25), v(c.meteorWarn, 2), 0.4]
    };
    this.tornado = null; this.storm = null;
    this.sandActive = false; this.sandK = 0; this.sandS = 0;
    // portais abertos (vêm prontos do portalLayout): entra num, sai no par dele — gente, tiro e granada
    this.portals = opts.portals || [];
    // teto que ricocheteia tiro (folhas da floresta / vidro da nave), null = sem teto
    this.ceilingY = opts.ceilingY != null ? opts.ceilingY : null;
    // cidade à noite / sala escura: postes de luz e ciclo de escuridão
    this.lamps = (opts.lamps || []).map((p, i) => ({ x: p[0], z: p[1], i, offUntil: 0 }));
    this.lightOn = true; this.lightS = 0;
  }
  // ciclo genérico do 2D: s=0 esperando, s=1 aviso (k vai de 0 a 1), s=2 acontecendo; n = segundos até começar
  cycle(key) {
    const [interval, pre, dur] = this.hz[key], period = interval + dur, el = this.time;
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
    for (const h of this.holes) if ((x - h.x) ** 2 + (z - h.z) ** 2 < (h.r - (m || 0)) ** 2) return h;
    return null;
  }
  // pisa no chão? (fora dos buracos) — a altura do chão ali
  floorAt(x, z, r) {
    if (this.holeAt(x, z, r * 0.35)) return -Infinity;
    return this.groundAt(x, z);
  }

  // ---------- jogadores ----------
  addPlayer(o) {
    const p = {
      id: o.id, name: o.name, team: o.team, bot: !!o.bot, level: o.level || 'amador',
      primary: o.primary || 'lancador', x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, grounded: true,
      yaw: o.team === 'A' ? 0 : Math.PI, pitch: 0, lives: this.P.lives, alive: true,
      weapon: 'primary', lastWeapon: 'primary', ammo: {}, mags: {}, reloadUntil: 0, fireReady: 0, charge0: 0,
      nades: 1, smokes: 1, potions: 1, drinkReady: 0, invulnUntil: 0, protectUntil: 0, respawnAt: 0, djReadyAt: 0, djUsed: false, jumps: 0,
      k: 0, d: 0, a: 0, input: { fwd: 0, side: 0, fire: false }, ai: {}, lastHitBy: {}, deadAt: 0
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
    for (let i = 0; i < 60; i++) {
      const x = p.team === 'A' ? 60 + Math.random() * 160 : this.W - 60 - Math.random() * 160;
      const z = 80 + Math.random() * (this.H - 160);
      if (!this.boxes.some((b) => this.circleBox(x, z, r, b)) && !this.holeAt(x, z, -r - 20)) { p.x = x; p.z = z; break; }
    }
    p.y = this.groundAt(p.x, p.z); p.vx = p.vy = p.vz = 0; p.grounded = true;
    p.lives = this.P.lives; p.alive = true; p.weapon = 'primary';
    for (const w of WEAPON_IDS) { p.ammo[w] = this.WEAPONS[w].mag; p.mags[w] = this.WEAPONS[w].mags; }
    p.nades = 1; p.smokes = 1; p.potions = 1; p.reloadUntil = 0; p.charge0 = 0;
    p.protectUntil = this.time + this.P.protect; p.invulnUntil = 0;
    p.yaw = p.team === 'A' ? 0 : Math.PI;
    p.lastHitBy = {}; p.spin = null; p.slowUntil = 0;
  }
  weaponDef(p) { return this.WEAPONS[p.primary]; }
  aimDir(p) { const c = Math.cos(p.pitch); return [Math.cos(p.yaw) * c, Math.sin(p.pitch), Math.sin(p.yaw) * c]; }

  setWeapon(p, w) {
    if (!p.alive) return;
    if (w === 'nade' && p.nades < 1) return;
    if (w === 'smoke' && p.smokes < 1) return;
    if (w === 'potion' && (p.potions < 1 || p.lives >= this.P.lives)) return;
    if (p.weapon !== w) { if (p.weapon === 'primary' || p.weapon === 'knife') p.lastWeapon = p.weapon; p.weapon = w; p.reloadUntil = 0; p.charge0 = 0; }
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
    this.time += dt;
    for (const p of this.players.values()) this.updatePlayer(p, dt);
    this.updateBullets(dt);
    this.updateNades(dt);
    this.updatePickups();
    this.updateHazard(dt);
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
        k: p.k, d: p.d, a: p.a, charge0: p.charge0 || 0, fireReady: p.fireReady || 0,
        protectUntil: p.protectUntil || 0, respawnAt: p.respawnAt || 0, deadAt: p.deadAt || 0, lastHitBy: p.lastHitBy || {},
        slowUntil: p.slowUntil || 0, spin: !!p.spin });
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
      storm: this.storm ? { x: this.storm.x, z: this.storm.z, r: this.storm.r, s: this.storm.s, k: this.storm.k } : null,
      holes: this.holes, erupt: this.erupt && !this.erupt.done ? { pts: this.erupt.pts, r: this.erupt.r } : null,
      lamps: this.lamps.map((l) => ({ i: l.i, x: l.x, z: l.z, offUntil: l.offUntil }))
    };
  }

  updatePlayer(p, dt) {
    if (p.reloadUntil && this.time >= p.reloadUntil) {
      p.reloadUntil = 0; p.ammo[p.primary] = this.weaponDef(p).mag; p.mags[p.primary]--;
    }
    if (!p.alive) { if (this.time >= p.respawnAt) { this.spawn(p); this.events.push({ type: 'respawn', id: p.id }); } return; }
    // pego pelo furacão: gira subindo dentro dele e depois é jogado longe
    if (p.spin) { this.updateSpin(p, dt); return; }
    if (p.bot) this.botThink(p, dt);
    // andar relativo para onde olha
    const fx = Math.cos(p.yaw), fz = Math.sin(p.yaw), rx = -fz, rz = fx;
    let wx = fx * p.input.fwd + rx * p.input.side, wz = fz * p.input.fwd + rz * p.input.side;
    const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
    // tempestade de areia atrapalha andar; chuva congelante deixa bem devagar por um tempo
    const spdK = ((this.hazard === 'sand' && this.sandActive) ? 0.72 : 1) * (this.time < (p.slowUntil || 0) ? p.slowF : 1);
    wx *= this.P.speed * spdK; wz *= this.P.speed * spdK;
    // subindo a montanha de areia: fica mais devagar conforme a subida
    if (this.dunes && p.grounded && wl > 0.01) {
      const [gx, gz] = this.dunes.grad(p.x, p.z), up = (wx * gx + wz * gz) / this.P.speed;
      if (up > 0) { const k = 1 / (1 + up * 0.9); wx *= k; wz *= k; }
    }
    if (p.grounded) { p.vx = wx; p.vz = wz; }
    else { // no ar: mantém o impulso, com um pouco de controle
      const k = Math.min(1, this.P.airControl * dt * 6);
      if (wl > 0.01) { p.vx += (wx - p.vx) * k; p.vz += (wz - p.vz) * k; }
    }
    const r = this.radius(p);
    // horizontal: bate nos muros que estão na altura do corpo
    p.x += p.vx * dt; p.z += p.vz * dt;
    for (let it = 0; it < 3; it++) {
      for (const b of this.boxes) {
        if (p.y >= b.top - 2 || p.y + this.heightOf(p) <= b.y0) continue; // em cima do muro / por baixo (parede acima do portal)
        const o = this.pushOut(p.x, p.z, r, b);
        if (o) { p.x = o[0]; p.z = o[1]; }
      }
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
      const dx = p.x - pit.x, dz = p.z - pit.z, d = Math.hypot(dx, dz), lim = pit.r - r * 0.5;
      if (d > lim && d > 0) { p.x = pit.x + dx / d * lim; p.z = pit.z + dz / d * lim; }
    }
    // vertical: gravidade, chão (areia / buraco) e topo dos muros
    const y0 = p.y;
    p.vy -= this.P.gravity * dt; p.y += p.vy * dt;
    let floor = pit ? -Infinity : this.floorAt(p.x, p.z, r);
    for (const b of this.boxes) if (this.circleBox(p.x, p.z, r * 0.7, b) && y0 >= b.top - 2) floor = Math.max(floor, b.top);
    // descendo o morro andando: continua grudado no chão (sem ficar "pulando" ladeira abaixo)
    const snap = p.grounded && p.vy <= 0 && floor > -Infinity && y0 - floor < 16;
    if (p.y <= floor || snap) {
      if (!p.grounded && p.vy < -200) this.events.push({ type: 'land', id: p.id });
      p.y = floor; p.vy = 0;
      if (!p.grounded) { p.grounded = true; p.djUsed = false; p.jumps = 0; }
    } else p.grounded = false;
    // lá embaixo é lava
    if (this.holes && p.y < -HOLE.kill) { this.lavaFall(p); return; }
    // atirar / usar
    if (p.input.fire) this.useWeapon(p, false);
    else if (p.charge0) this.useWeapon(p, true); // soltou o botão do arco
  }

  useWeapon(p, released) {
    if (!p.alive || this.time < p.protectUntil) return;
    if (this.time < p.fireReady) return;
    if (p.weapon === 'knife') return this.knife(p);
    if (p.weapon === 'potion') return this.drinkPotion(p);
    if (p.weapon === 'nade' || p.weapon === 'smoke') return this.throwNade(p, p.weapon === 'smoke');
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
  // o tiro sai da mão e vai para o ponto que a mira mostra
  shoot(p, w, speed) {
    p.ammo[p.primary]--; p.fireReady = this.time + w.cd;
    const [ox, oy, oz, tx, ty, tz] = this.muzzleAndTarget(p);
    let dx = tx - ox, dy = ty - oy, dz = tz - oz;
    const L = Math.hypot(dx, dy, dz) || 1; dx /= L; dy /= L; dz /= L;
    if (w.grav) dy += w.grav * (L / speed) / speed * 0.5; // compensa a queda para cair perto da mira
    const l2 = Math.hypot(dx, dy, dz); dx /= l2; dy /= l2; dz /= l2;
    this.bullets.push({ id: this.nextId++, owner: p.id, team: p.team, x: ox, y: oy, z: oz, vx: dx * speed, vy: dy * speed, vz: dz * speed,
      r: w.r, grav: w.grav, bounces: 0, max: w.bounces, rest: w.rest, t0: this.time, kind: p.primary });
    this.events.push({ type: 'shot', id: p.id, weapon: p.primary });
    if (p.ammo[p.primary] <= 0) this.reload(p);
  }
  muzzleAndTarget(p) {
    const [dx, dy, dz] = this.aimDir(p);
    const ex = p.x, ey = p.y + this.P.eye, ez = p.z;
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
      if (!q.alive || q.team === p.team) continue;
      const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      if (d > this.radius(p) + this.P.knifeRange + this.radius(q) || Math.abs(q.y - p.y) > 50) continue;
      let da = Math.atan2(dz, dx) - p.yaw; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) < this.P.knifeArc && !this.segBlocked(p.x, p.y + this.P.chest, p.z, q.x, q.y + this.P.chest, q.z)) { this.damage(q, p.id, 'knife'); break; }
    }
  }
  // poção: bebe (animação no cliente) e recupera 1 vida, gasta 1 poção
  drinkPotion(p) {
    if (p.potions < 1 || p.lives >= this.P.lives) { p.weapon = p.lastWeapon || 'primary'; return; }
    p.fireReady = this.time + 1.1; // duração da animação de beber
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
    else if (this.hazard === 'storm') this.updateStorm();
    else if (this.hazard === 'lava' && this.holes) this.updateErupt();
  }
  // vulcão: caiu na lava = morreu (o abate vai pra quem acertou por último, se foi há pouco)
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
      const u = dx * P.tx + dz * P.tz;
      if (isPlayer) { if (Math.abs(u) > PORTAL.rx || o.y > PORTAL.cy + PORTAL.ry - 20) continue; }
      else { const eu = u / PORTAL.rx, ey = (o.y - PORTAL.cy) / PORTAL.ry; if (eu * eu + ey * ey > 1) continue; }
      const Q = this.portals[P.link]; if (!Q) continue;
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
        if (!this.boxes.some((b) => this.circleBox(tx, tz, R * 0.5, b))) { x = tx; z = tz; break; }
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
    for (const p of this.players.values()) {
      if (!p.alive || p.spin || T.hit.has(p.id)) continue;
      const dx = p.x - T.x, dz = p.z - T.z;
      if (dx * dx + dz * dz < (R + this.radius(p)) ** 2) {
        T.hit.add(p.id);
        p.spin = { t0: this.time, ang: Math.atan2(dz, dx), r0: Math.hypot(dx, dz), y0: p.y };
        this.events.push({ type: 'caught', id: p.id });
      }
    }
  }
  updateSpin(p, dt) {
    const S = p.spin, T = this.tornado, k = clamp((this.time - S.t0) / TORNADO.spin, 0, 1);
    if (T) { S.cx = T.x; S.cz = T.z; } else if (S.cx == null) { S.cx = p.x; S.cz = p.z; }
    const ang = S.ang + k * 11, rr = S.r0 + (TORNADO.r * 0.35 - S.r0) * k;
    p.x = S.cx + Math.cos(ang) * rr; p.z = S.cz + Math.sin(ang) * rr;
    p.y = S.y0 + 90 * k; p.vx = p.vz = p.vy = 0; p.grounded = false;
    p.yaw += dt * 9; p.input.fire = false;
    if (k < 1) return;
    // joga longe: escolhe uma direção que cai dentro do mapa (e fora de buraco)
    const sp = TORNADO.throwD / TORNADO.air, mm = this.wallT + 60;
    let a = Math.random() * Math.PI * 2;
    for (let i = 0; i < 16; i++) {
      const b = Math.random() * Math.PI * 2, tx = p.x + Math.cos(b) * TORNADO.throwD, tz = p.z + Math.sin(b) * TORNADO.throwD;
      if (tx > mm && tz > mm && tx < this.W - mm && tz < this.H - mm && !this.holeAt(tx, tz, -40)) { a = b; break; }
    }
    p.spin = null;
    p.vx = Math.cos(a) * sp; p.vz = Math.sin(a) * sp; p.vy = this.P.gravity * TORNADO.air / 2 - 90 / TORNADO.air;
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
  // neve: chuva congelante numa área sorteada (1/5 do mapa); antes aparece a sombra da nuvem no chão
  updateStorm() {
    const cy = this.cycle('storm');
    if (cy.s === 0) { if (this.storm) { this.storm = null; this.events.push({ type: 'storm_end' }); } return; }
    if (!this.storm || this.storm.idx !== cy.idx) {
      const r = STORM.r, x = r * 0.7 + Math.random() * (this.W - r * 1.4), z = r * 0.7 + Math.random() * (this.H - r * 1.4);
      this.storm = { idx: cy.idx, x, z, r, s: cy.s, k: 0, started: false };
      this.events.push({ type: 'storm_warn', x, z });
    }
    const S = this.storm; S.s = cy.s; S.k = cy.k;
    if (cy.s !== 2) return;
    if (!S.started) { S.started = true; this.events.push({ type: 'storm_start', x: S.x, z: S.z }); }
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      if ((p.x - S.x) ** 2 + (p.z - S.z) ** 2 < S.r * S.r) {
        if (this.time >= (p.slowUntil || 0)) this.events.push({ type: 'frozen', id: p.id });
        p.slowUntil = this.time + STORM.time; p.slowF = STORM.slow;
      }
    }
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
  // granada / fumaça: joga para onde a mira aponta, quica no muro e no chão
  throwNade(p, smoke) {
    if (smoke ? p.smokes < 1 : p.nades < 1) { p.weapon = p.lastWeapon; return; }
    if (smoke) p.smokes--; else p.nades--;
    p.fireReady = this.time + 0.6;
    const [dx, dy, dz] = this.aimDir(p);
    const ox = p.x + dx * 20, oy = p.y + this.P.eye, oz = p.z + dz * 20;
    this.nades.push({ id: this.nextId++, owner: p.id, team: p.team, smoke, x: ox, y: oy, z: oz,
      vx: dx * this.P.nadeSpeed + p.vx * 0.5, vy: dy * this.P.nadeSpeed + this.P.nadeUp + p.vy * 0.3, vz: dz * this.P.nadeSpeed + p.vz * 0.5, t0: this.time, spin: 0 });
    this.events.push({ type: smoke ? 'smoke_throw' : 'nade_throw', id: p.id });
    p.weapon = p.lastWeapon || 'primary'; // volta para a arma que estava
  }

  // move uma bolinha (bala ou granada) um pedacinho e quica: devolve true se bateu
  bounceStep(o, r, rest, dt) {
    o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt;
    let hit = false;
    // chão (menos em cima de um buraco do vulcão: cai lá dentro)
    if (o.y < r && !(this.holes && this.holeAt(o.x, o.z, 0))) { o.y = r; o.vy = Math.abs(o.vy) * rest; o.vx *= 0.98; o.vz *= 0.98; hit = 'floor'; }
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
        if (b.y < -HOLE.depth - 120 || b.x < -80 || b.z < -80 || b.x > this.W + 80 || b.z > this.H + 80) { dead = true; break; }
        // teto que ricocheteia (folhas da floresta / vidro da nave)
        if (!hit && this.ceilingY != null && b.y + b.r >= this.ceilingY && b.vy > 0) {
          b.y = this.ceilingY - b.r; b.vy = -Math.abs(b.vy) * (b.rest || 0.7); hit = 'ceiling';
        }
        if (hit) {
          b.bounces++;
          this.events.push({ type: 'bounce', x: b.x, y: b.y, z: b.z, left: b.max - b.bounces });
          if (b.bounces > b.max || (hit === 'floor' && Math.abs(b.vy) < 60 && b.grav)) dead = true;
        }
        for (const q of this.players.values()) {
          if (!q.alive || q.team === b.team || this.time < q.protectUntil) continue;
          const r = this.radius(q), h = this.heightOf(q);
          const cy = clamp(b.y, q.y + r * 0.5, q.y + h - r * 0.4);
          if ((b.x - q.x) ** 2 + (b.z - q.z) ** 2 + (b.y - cy) ** 2 < (r + b.r) ** 2) { this.damage(q, b.owner, b.kind); dead = true; break; }
        }
        // cidade à noite: atirar no poste apaga a luz por um tempo
        if (!dead) for (const L of this.lamps) {
          if (this.time < L.offUntil) continue;
          const onBulb = (b.x - L.x - LAMP.off) ** 2 + (b.y - LAMP.h) ** 2 + (b.z - L.z) ** 2 < LAMP.hitR ** 2;
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
        g.vy -= this.P.gravity * sub; this.bounceStep(g, this.P.nadeR, 0.45, sub);
        if (this.portals.length) this.portalCross(g, this.P.nadeR, false);
      }
      // caiu na lava: some (sem explodir)
      if (g.y < -HOLE.depth - 120) { this.events.push({ type: 'lava_splash', x: g.x, z: g.z }); continue; }
      if (g.y <= this.groundAt(g.x, g.z) + this.P.nadeR + 0.5) { g.vx *= 0.9; g.vz *= 0.9; } // rolando no chão
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
      if (!q.alive || q.team === g.team || this.time < q.protectUntil) continue;
      const cy = clamp(g.y, q.y, q.y + this.heightOf(q));
      const d = Math.hypot(q.x - g.x, cy - g.y, q.z - g.z);
      if (d > this.P.nadeRadius + this.radius(q)) continue;
      if (this.segBlocked(g.x, g.y + 2, g.z, q.x, q.y + this.P.chest, q.z)) continue;
      this.damage(q, g.owner, 'nade');
    }
  }

  damage(v, by, weapon) {
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
      if (a) a.k++;
      for (const id in v.lastHitBy) if (id !== by && this.time - v.lastHitBy[id] < 10) { const h = this.players.get(id); if (h) h.a++; }
      // lápide com o nome no lugar da morte (o corpo some)
      this.tombs.push({ id: this.nextId++, x: v.x, y: v.y, z: v.z, name: v.name, team: v.team, until: this.time + this.P.tombTime, t0: this.time });
      this.events.push({ type: 'kill', killer: by, victim: v.id, weapon });
    } else this.events.push({ type: 'hit', by, victim: v.id, weapon });
  }

  // ---------- bots ----------
  botThink(p, dt) {
    const L = BOT_LEVELS[p.level] || BOT_LEVELS.amador, ai = p.ai;
    ai.t = (ai.t || 0) - dt; ai.aimT = (ai.aimT || 0) - dt;
    let target = null, best = 1e9, sees = false;
    for (const q of this.players.values()) {
      if (!q.alive || q.team === p.team) continue;
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
      if (p.nades && dist > 220 && dist < 600 && Math.random() < dt * L.nade) { this.setWeapon(p, 'nade'); p.pitch = 0.35; this.throwNade(p, false); }
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
