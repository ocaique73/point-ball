// Point Ball 3D — modo Bomber (estilo Super Bomberman, visto em 1ª ou 3ª pessoa).
// Simulação compartilhada: roda no servidor (multiplayer) e no navegador (solo contra bots). Sem dependências.
// Unidades: 1 célula do mapa = 100. Eixos x e z no chão, y pra cima. Frente do personagem = (cos yaw, sin yaw).

export const CELL = 100;
export const BM = {
  size: 15,                      // mapa quadrado de 15 x 15 células (a borda é parede)
  r: 24,                         // raio do personagem
  speed: 230, skate: 1.4,        // velocidade base e com o patinete
  fuse: 3.0, fire: 0.6,          // pavio da bomba e tempo do fogo (segundos)
  startBombs: 1, startRange: 1, maxBombs: 8, maxRange: 9, maxSmoke: 5,
  slideSpeed: 520,               // bomba chutada
  throwCells: 3, throwTime: 0.55,// bomba jogada com a luva: cai 3 células à frente, por cima de tudo
  density: 0.8,                  // quanto do mapa é bloco que quebra (mapa bem fechado)
  itemChance: 0.38,
  smoke: { dist: 4, fly: 0.7, time: 8, r: 170, slow: 0.6 },
  curseTime: 14,
  roundTime: 180, sudden: 120, hard: 240, ready: 3, endDelay: 3.5,
  wallH: 122, pillarH: 148,      // paredes bem mais altas que o personagem (64): não dá pra ver o corredor do lado
  jumpCd: 15, jumpTime: 0.5, jumpCells: 2, // super pulo: pula 2 células (por cima de parede/bomba) e só de novo depois de 15 s
  beltSpeed: 110, windSpeed: 100, iceAccel: 2.2
};
// Mapas inspirados nos do Point Ball 3D. Cada um é 1/4 do mapa (8x8, espelhado nos outros 3):
// # parede fixa · . espaço que pode ter bloco quebrável · , sempre vazio (sem bloco)
export const BOMBER_MAPS = {
  classic: { name: 'Clássico', desc: 'O Bomberman de sempre', density: 0.8, q: ['########', '#.......', '#.#.#.#.', '#.......', '#.#.#.#.', '#.......', '#.#.#.#.', '#.......'] },
  metro: { name: 'Estação de metrô', desc: 'Trilhos no meio: a cada 20 s passa um trem', density: 0.85, hz: { k: 'train', first: 12, every: 20 }, q: ['########', '#....,,,', '#.##.#,,', '#.....,,', '#.##.#,,', '#.....,,', '#.#.#.,,', '#.....,,'] },
  mar: { name: 'Plataforma no mar', desc: 'Contêineres e ondas gigantes que varrem corredores', density: 0.8, hz: { k: 'wave', first: 14, every: 20, lines: 2, speed: 900 }, q: ['########', '#.......', '#.##.##.', '#.......', '#.#..#..', '#.......', '#.##.##.', '#.......'] },
  obra: { name: 'Canteiro de obras', desc: 'A bola de demolição gira em volta do guindaste', density: 0.8, hz: { k: 'ball', first: 15, every: 22 }, q: ['########', '#.......', '#.#.#.#.', '#.......', '#.#.#.#.', '#....,,,', '#.#.#,##', '#....,##'] },
  fabrica: { name: 'Fábrica', desc: 'Esteiras rolantes empurram você e as bombas', density: 0.78, belts: [{ ax: 'x', idx: 3, dir: 1 }, { ax: 'x', idx: 11, dir: -1 }], q: ['########', '#.......', '#.#####.', '#,,,,,,,', '#.#.#.#.', '#.......', '#.#####.', '#.......'] },
  castelo: { name: 'Castelo', desc: 'O dragão sopra fogo em fileiras inteiras', density: 0.8, hz: { k: 'dragon', first: 16, every: 20, lines: 2 }, q: ['########', '#.......', '#.#.#.#.', '#.......', '#.#.#.#.', '#....##,', '#....#,,', '#....,,#'] },
  navio: { name: 'Navio na tempestade', desc: 'Ondas varrem o convés e caem raios', density: 0.9, hz: { k: 'wave', first: 12, every: 16, lines: 3, speed: 700 }, q: ['########', '#.......', '#.#.#.#.', '#.......', '#.#...#.', '#.......', '#.#.###.', '#.....#,'] },
  lua: { name: 'Base na Lua', desc: 'Meteoros caem (com aviso) e a gravidade baixa joga a bomba mais longe', density: 0.8, lowg: true, hz: { k: 'meteor', first: 18, every: 18, count: 2 }, q: ['########', '#.......', '#.##.##.', '#.#...#.', '#.....,,', '#.##.#,,', '#.#.,,,,', '#...,,,,'] },
  portais: { name: 'Portais', desc: 'Dois pares de portais que abrem e fecham', density: 0.8, portals: [[3, 3, 11, 11], [11, 3, 3, 11]], q: ['########', '#.......', '#.#.#.#.', '#..,....', '#.#.#.#.', '#....,,,', '#.#.#,#,', '#....,,,'] },
  vulcao: { name: 'Vulcão', desc: 'Erupções de lava surgem no chão depois de um aviso', density: 0.8, hz: { k: 'lava', first: 10, every: 11, count: 3 }, q: ['########', '#.......', '#.#.#.#.', '#...#...', '#.#.#.#.', '#.......', '#.#.#.#.', '#...#...'] },
  escuro: { name: 'Sala escura', desc: 'A luz apaga e você só enxerga perto', density: 0.85, hz: { k: 'dark', period: 24, lit: 10 }, q: ['########', '#.......', '#.#####.', '#.......', '#.#.#.#.', '#.....#.', '#.#.#.#.', '#.......'] },
  neve: { name: 'Neve', desc: 'Gelo escorregadio e tempestade que atrasa todo mundo', density: 0.8, ice: true, hz: { k: 'blizzard', first: 20, every: 25, dur: 7 }, q: ['########', '#.......', '#.#.#.#.', '#.......', '#.#.##..', '#.......', '#.#.#.#.', '#.......'] },
  deserto: { name: 'Deserto', desc: 'Tempestade de areia empurra todo mundo', density: 0.8, hz: { k: 'sand', first: 18, every: 24, dur: 7 }, q: ['########', '#.......', '#.#...#.', '#.......', '#.....#.', '#.#.....', '#.#...#.', '#.......'] }
};
export const MAP_LIST = Object.keys(BOMBER_MAPS).map((id) => ({ id, name: BOMBER_MAPS[id].name, desc: BOMBER_MAPS[id].desc }));
export function pickMap(id, seed) { return BOMBER_MAPS[id] ? id : id === 'rand' ? MAP_LIST[(seed >>> 0) % MAP_LIST.length].id : 'classic'; }
export const ITEM_KINDS = ['bomb', 'fire', 'skate', 'glove', 'kick', 'smoke', 'skull', 'jump'];
const ITEM_W = { bomb: 26, fire: 26, skate: 7, glove: 7, kick: 8, smoke: 14, skull: 12, jump: 8 };
export const CURSES = ['reverse', 'slow', 'fast', 'minrange', 'nobomb', 'autobomb', 'invisible'];
export const CURSE_NAME = {
  reverse: 'Controles invertidos', slow: 'Super lento', fast: 'Super rápido', minrange: 'Bombas fraquinhas',
  nobomb: 'Sem bombas', autobomb: 'Solta bombas sozinho', invisible: 'Invisível'
};
const DIRS = [[1, 0, 'h', 'R'], [-1, 0, 'h', 'L'], [0, 1, 'v', 'D'], [0, -1, 'v', 'U']];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const cellOf = (v) => Math.floor(v / CELL);
export const centerOf = (c) => (c + 0.5) * CELL;

function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// cantos onde cada jogador nasce (1 a 4): jogadores 1 e 2 em cantos opostos
export function spawnCells(N) { return [[1, 1], [N - 2, N - 2], [N - 2, 1], [1, N - 2]]; }

export class BomberSim {
  // opts: { size, seed, rounds, players: [{ id, name, bot, ch }], practice }
  constructor(opts) {
    opts = opts || {};
    this.N = opts.size || BM.size;
    this.seed = (opts.seed >>> 0) || ((Math.random() * 4294967296) >>> 0);
    this.mapId = pickMap(opts.map, this.seed); this.isMirror = false; this.strikes = []; this.storm = 0; this.wind = [0, 0]; this.dark = false; this.portalOpen = true; this.hzT = 0;
    this.winsNeeded = Math.max(1, opts.rounds || 3);
    this.roundTime = opts.roundTime || BM.roundTime;
    this.players = new Map();
    let slot = 0;
    for (const d of (opts.players || []).slice(0, 4)) {
      this.players.set(d.id, { id: d.id, name: d.name || 'Jogador', bot: !!d.bot, ch: d.ch || 'hood', slot: slot++, wins: 0, kills: 0 });
    }
    this.practice = this.players.size < 2; // sozinho sem bots: treino livre (a rodada não acaba)
    this.time = 0; this.round = 0; this.phase = 'ready'; this.rt = 0; this.phaseT = 0;
    this.events = []; this.nextId = 1; this.winner = null; this.matchWinner = null;
    this.startRound();
  }
  get mp() { return BOMBER_MAPS[this.mapId] || BOMBER_MAPS.classic; }
  rndRound() { return mulberry32(this.seed + this.round * 7919); }

  // ---------- mapa ----------
  genGrid() {
    const N = this.N, g = new Uint8Array(N * N), rnd = this.rndRound(), mp = BOMBER_MAPS[this.mapId || 'classic'];
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const edge = x === 0 || z === 0 || x === N - 1 || z === N - 1;
      let ch = N === 15 ? mp.q[Math.min(z, N - 1 - z)][Math.min(x, N - 1 - x)] : (x % 2 === 0 && z % 2 === 0 ? '#' : '.');
      if (edge) ch = '#';
      g[z * N + x] = ch === '#' ? 1 : ch === ',' ? 0 : (rnd() < mp.density ? 2 : 0);
    }
    for (const [ax, az, bx, bz] of (mp.portals || [])) { g[az * N + ax] = 0; g[bz * N + bx] = 0; }
    // cada canto fica livre em L (nasce + 2 células pra cada lado: dá pra fugir da própria bomba)
    for (const [sx, sz] of spawnCells(N)) {
      const dx = sx < N / 2 ? 1 : -1, dz = sz < N / 2 ? 1 : -1;
      g[sz * N + sx] = 0; for (let i = 1; i <= 2; i++) { g[sz * N + sx + dx * i] = 0; g[(sz + dz * i) * N + sx] = 0; }
    }
    return g;
  }
  cell(cx, cz) { return cx < 0 || cz < 0 || cx >= this.N || cz >= this.N ? 1 : this.grid[cz * this.N + cx]; }
  solidCell(cx, cz) { return this.cell(cx, cz) !== 0; }
  gridString() { let s = ''; for (let i = 0; i < this.grid.length; i++) s += this.grid[i]; return s; }

  startRound() {
    this.round++;
    this.grid = this.genGrid();
    this.bombs = []; this.fires = []; this.items = []; this.smokes = [];
    this.rt = 0; this.phase = 'ready'; this.phaseT = BM.ready; this.winner = null; this.dropT = 0; this.dropI = 0;
    this.strikes = []; this.storm = 0; this.wind = [0, 0]; this.dark = false; this.portalOpen = true; this.hzT = (this.mp.hz && this.mp.hz.first) || 0;
    this.spiral = this.makeSpiral();
    const sp = spawnCells(this.N);
    for (const p of this.players.values()) {
      const [cx, cz] = sp[p.slot];
      Object.assign(p, {
        x: centerOf(cx), z: centerOf(cz), yaw: cx < this.N / 2 ? 0 : Math.PI, vx: 0, vz: 0, alive: true,
        maxBombs: BM.startBombs, range: BM.startRange, skate: false, glove: false, kick: false, smoke: 0,
        curse: null, curseLeft: 0, curseCool: 0, carry: null, jumpItem: false, jumpCd: 0, jmp: null, jumpGuard: 0, portCool: 0, cvx: 0, cvz: 0, inv: 1.2, autoT: 0, lastIn: this.time, ai: null, corr: false, deadT: 0
      });
    }
    this.events.push({ e: 'round', n: this.round });
  }
  makeSpiral() { // ordem das células que caem na morte súbita: de fora pra dentro, em espiral
    const N = this.N, out = []; let x0 = 1, z0 = 1, x1 = N - 2, z1 = N - 2;
    while (x0 <= x1 && z0 <= z1) {
      for (let x = x0; x <= x1; x++) out.push([x, z0]);
      for (let z = z0 + 1; z <= z1; z++) out.push([x1, z]);
      if (z1 > z0) for (let x = x1 - 1; x >= x0; x--) out.push([x, z1]);
      if (x1 > x0) for (let z = z1 - 1; z > z0; z--) out.push([x0, z]);
      x0++; z0++; x1--; z1--;
    }
    return out;
  }

  // ---------- consultas ----------
  bombAtCell(cx, cz, except) {
    for (const b of this.bombs) if ((b.st === 'idle' || b.st === 'slide') && b !== except && cellOf(b.x) === cx && cellOf(b.z) === cz) return b;
    return null;
  }
  blockedFor(p, cx, cz) {
    if (this.solidCell(cx, cz)) return true;
    const b = this.bombAtCell(cx, cz);
    return !!(b && !(p.pass && p.pass.has(b.id)));
  }
  overlapsCell(p, cx, cz, margin) {
    const m = margin || 0, qx = clamp(p.x, cx * CELL, (cx + 1) * CELL), qz = clamp(p.z, cz * CELL, (cz + 1) * CELL);
    return (p.x - qx) ** 2 + (p.z - qz) ** 2 < (BM.r + m) ** 2;
  }
  rangeOf(p) { return p.curse === 'minrange' ? 1 : p.range; }
  activeBombs(p) { let n = 0; for (const b of this.bombs) if (b.o === p.id) n++; return n; }
  speedOf(p) {
    let s = BM.speed * (p.skate ? BM.skate : 1);
    if (p.curse === 'slow') s *= 0.45; else if (p.curse === 'fast') s *= 1.7;
    if (p.inSmoke) s *= BM.smoke.slow;
    if (this.storm > 0 && this.mp.hz && this.mp.hz.k === 'blizzard') s *= 0.7;
    return s;
  }

  // ---------- movimento ----------
  resolve(p, x, z) {
    const r = BM.r;
    for (let it = 0; it < 3; it++) {
      const cx0 = cellOf(x), cz0 = cellOf(z); let moved = false;
      for (let cz = cz0 - 1; cz <= cz0 + 1; cz++) for (let cx = cx0 - 1; cx <= cx0 + 1; cx++) {
        if (!this.blockedFor(p, cx, cz)) continue;
        const minx = cx * CELL, maxx = minx + CELL, minz = cz * CELL, maxz = minz + CELL;
        const qx = clamp(x, minx, maxx), qz = clamp(z, minz, maxz), dx = x - qx, dz = z - qz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-6) { const d = Math.sqrt(d2), push = r - d; x += dx / d * push; z += dz / d * push; }
        else { const l = x - minx, rr = maxx - x, t = z - minz, b = maxz - z, m = Math.min(l, rr, t, b); if (m === l) x = minx - r; else if (m === rr) x = maxx + r; else if (m === t) z = minz - r; else z = maxz + r; }
        moved = true;
      }
      if (!moved) break;
    }
    return [x, z];
  }
  // (dx, dz) = direção desejada no mundo (tamanho até 1). Roda no solo e na previsão do próprio jogador no multiplayer.
  moveLocal(p, dx, dz, dt) {
    if (!p.alive || this.phase !== 'play') { p.vx = p.vz = 0; return; }
    dt = Math.min(dt, 0.05);
    if (p.jumpGuard > 0) p.jumpGuard -= dt;
    if (p.jmp) { if (this.isMirror) this.advanceJump(p, dt); p.vx = p.vz = 0; return; }
    if (p.curse === 'reverse') { dx = -dx; dz = -dz; }
    const len = Math.hypot(dx, dz); if (len > 1) { dx /= len; dz /= len; }
    const sp = this.speedOf(p);
    if (this.mp.ice) { const k = Math.min(1, dt * BM.iceAccel); p.cvx = (p.cvx || 0) + (dx * sp - (p.cvx || 0)) * k; p.cvz = (p.cvz || 0) + (dz * sp - (p.cvz || 0)) * k; } else { p.cvx = dx * sp; p.cvz = dz * sp; }
    const push = this.pushAt(p), mx = (p.cvx + push[0]) * dt, mz = (p.cvz + push[1]) * dt, want = Math.hypot(mx, mz);
    let [nx, nz] = this.resolve(p, p.x + mx, p.z + mz);
    if (want > 0 && Math.hypot(nx - p.x, nz - p.z) < want * 0.55) { // esquina: escorrega pro vão do corredor
      const horiz = Math.abs(mx) >= Math.abs(mz);
      if (horiz) { const cz = cellOf(nz), off = centerOf(cz) - nz; if (Math.abs(off) < 38 && Math.abs(off) > 0.5 && !this.blockedFor(p, cellOf(nx) + Math.sign(mx), cz)) nz += clamp(off, -want, want); }
      else { const cx = cellOf(nx), off = centerOf(cx) - nx; if (Math.abs(off) < 38 && Math.abs(off) > 0.5 && !this.blockedFor(p, cx, cellOf(nz) + Math.sign(mz))) nx += clamp(off, -want, want); }
      [nx, nz] = this.resolve(p, nx, nz);
      if (this.mp.ice) { p.cvx *= 0.4; p.cvz *= 0.4; }
    }
    p.vx = (nx - p.x) / dt - push[0]; p.vz = (nz - p.z) / dt - push[1]; p.x = nx; p.z = nz;
    this.afterMove(p, dx, dz);
  }
  // esteira rolante e vento empurram quem está em cima / no mapa
  beltAt(cx, cz) {
    const bl = this.mp.belts; if (!bl || this.solidCell(cx, cz)) return null;
    for (const b of bl) { if (b.ax === 'x' && cz === b.idx && cx > 0 && cx < this.N - 1) return [b.dir, 0]; if (b.ax === 'z' && cx === b.idx && cz > 0 && cz < this.N - 1) return [0, b.dir]; }
    return null;
  }
  pushAt(p) {
    let px = this.wind[0], pz = this.wind[1]; const b = this.beltAt(cellOf(p.x), cellOf(p.z));
    if (b) { px += b[0] * BM.beltSpeed; pz += b[1] * BM.beltSpeed; }
    return [px, pz];
  }
  // ---------- super pulo ----------
  startJump(p) {
    if (!p.alive || !p.jumpItem || p.jumpCd > 0 || p.jmp || this.phase !== 'play') return false;
    const [dx, dz] = this.snapDir(p.yaw), cx = cellOf(p.x), cz = cellOf(p.z), N = this.N; let tgt = null;
    for (const k of [BM.jumpCells, BM.jumpCells + 1]) { const x = cx + dx * k, z = cz + dz * k; if (x > 0 && z > 0 && x < N - 1 && z < N - 1 && !this.solidCell(x, z) && !this.bombAtCell(x, z)) { tgt = [x, z]; break; } }
    if (!tgt) return false;
    p.jmp = { sx: p.x, sz: p.z, tx: centerOf(tgt[0]), tz: centerOf(tgt[1]), t: 0, T: BM.jumpTime }; p.jumpCd = BM.jumpCd; p.jumpGuard = 0.6; p.vx = p.vz = 0;
    this.events.push({ e: 'jump', pid: p.id }); return true;
  }
  advanceJump(p, dt) {
    const j = p.jmp; if (!j) return; j.t += dt; const u = Math.min(1, j.t / j.T);
    p.x = j.sx + (j.tx - j.sx) * u; p.z = j.sz + (j.tz - j.sz) * u;
    if (u >= 1) { p.jmp = null; this.events.push({ e: 'jland', pid: p.id }); }
  }
  // servidor (multiplayer): o navegador manda a própria posição; aceita se for plausível e não estiver dentro de parede
  acceptPos(p, x, z, dx, dz) {
    if (!p.alive || this.phase !== 'play') { p.vx = p.vz = 0; return false; }
    if (p.jmp) { p.lastIn = this.time; return false; } // no ar: o servidor é quem move
    const dt = clamp(this.time - p.lastIn, 0.016, 0.25); p.lastIn = this.time;
    const lim = this.speedOf(p) * 1.9 * dt + 24, ddx = x - p.x, ddz = z - p.z, d = Math.hypot(ddx, ddz);
    if (!Number.isFinite(x) || !Number.isFinite(z) || d > lim) { p.corr = true; return false; }
    const [rx, rz] = this.resolve(p, x, z);
    if (Math.hypot(rx - x, rz - z) > 7) { p.corr = true; return false; }
    p.vx = (rx - p.x) / dt; p.vz = (rz - p.z) / dt; p.x = rx; p.z = rz;
    this.afterMove(p, dx, dz);
    return true;
  }
  afterMove(p, dx, dz) {
    const len = Math.hypot(dx, dz);
    if (len > 0.2 && p.kick) this.tryKick(p, dx, dz);
  }
  tryKick(p, dx, dz) {
    const horiz = Math.abs(dx) >= Math.abs(dz), sx = horiz ? Math.sign(dx) : 0, sz = horiz ? 0 : Math.sign(dz);
    const cx = cellOf(p.x) + sx, cz = cellOf(p.z) + sz, b = this.bombAtCell(cx, cz);
    if (!b || b.st !== 'idle' || (p.pass && p.pass.has(b.id))) return;
    const along = horiz ? Math.abs(b.x - p.x) : Math.abs(b.z - p.z), perp = horiz ? Math.abs(b.z - p.z) : Math.abs(b.x - p.x);
    if (along > CELL / 2 + BM.r + 6 || perp > 42) return;
    if (this.solidCell(cx + sx, cz + sz)) return; // não tem pra onde ir
    b.st = 'slide'; b.dx = sx; b.dz = sz;
    this.events.push({ e: 'kick', pid: p.id, id: b.id });
  }

  // ---------- ações ----------
  act(id, what) {
    const p = this.players.get(id); if (!p || !p.alive || this.phase !== 'play') return;
    if (what === 'bomb') this.actBomb(p);
    else if (what === 'smoke') this.throwSmoke(p);
    else if (what === 'jump') this.startJump(p);
  }
  canPlace(p) { return p.alive && p.curse !== 'nobomb' && !p.carry && this.activeBombs(p) < p.maxBombs; }
  actBomb(p) {
    if (p.carry) { this.throwBomb(p); return; }
    const cx = cellOf(p.x), cz = cellOf(p.z), here = this.bombAtCell(cx, cz);
    if (here) { if (p.glove && here.st === 'idle') this.pickUp(p, here); return; }
    if (!this.canPlace(p) || this.solidCell(cx, cz)) return;
    this.placeBomb(p, cx, cz);
  }
  placeBomb(p, cx, cz) {
    const b = { id: this.nextId++, o: p.id, x: centerOf(cx), z: centerOf(cz), y: 0, f: BM.fuse, r: this.rangeOf(p), st: 'idle', dx: 0, dz: 0, pass: new Set(), ft: null };
    for (const q of this.players.values()) if (q.alive && this.overlapsCell(q, cx, cz)) { b.pass.add(q.id); (q.pass || (q.pass = new Set())).add(b.id); }
    this.bombs.push(b);
    this.events.push({ e: 'place', id: b.id, pid: p.id, cx, cz });
    return b;
  }
  pickUp(p, b) {
    b.st = 'carried'; b.carrier = p.id; p.carry = b.id;
    for (const q of this.players.values()) if (q.pass) q.pass.delete(b.id);
    this.events.push({ e: 'pickup_bomb', pid: p.id, id: b.id });
  }
  snapDir(yaw) { const c = Math.cos(yaw), s = Math.sin(yaw); return Math.abs(c) >= Math.abs(s) ? [Math.sign(c) || 1, 0] : [0, Math.sign(s) || 1]; }
  throwBomb(p) {
    const b = this.bombs.find((x) => x.id === p.carry); p.carry = null; if (!b) return;
    const [dx, dz] = this.snapDir(p.yaw), cx = cellOf(p.x), cz = cellOf(p.z);
    const N = this.N, free = (x, z) => x > 0 && z > 0 && x < N - 1 && z < N - 1 && !this.solidCell(x, z) && !this.bombAtCell(x, z);
    const tc = this.mp.lowg ? 5 : BM.throwCells; let tx = clamp(cx + dx * tc, 1, N - 2), tz = clamp(cz + dz * tc, 1, N - 2), found = null;
    for (let x = tx, z = tz; x > 0 && z > 0 && x < N - 1 && z < N - 1; x += dx, z += dz) if (free(x, z)) { found = [x, z]; break; } // não achou: quica pra frente até uma célula livre
    if (!found) for (let x = tx - dx, z = tz - dz; x !== cx || z !== cz; x -= dx, z -= dz) if (free(x, z)) { found = [x, z]; break; }
    if (!found) found = [cx, cz];
    b.st = 'thrown'; b.carrier = null; b.ft = { sx: b.x, sz: b.z, tx: centerOf(found[0]), tz: centerOf(found[1]), t: 0, T: this.mp.lowg ? 0.9 : BM.throwTime };
    this.events.push({ e: 'throw', pid: p.id, id: b.id });
  }
  throwSmoke(p) {
    if (p.smoke <= 0) return; p.smoke--;
    const [dx, dz] = this.snapDir(p.yaw); let cx = cellOf(p.x), cz = cellOf(p.z);
    for (let i = 0; i < BM.smoke.dist; i++) { if (this.solidCell(cx + dx, cz + dz)) break; cx += dx; cz += dz; }
    this.smokes.push({ id: this.nextId++, sx: p.x, sz: p.z, x: p.x, z: p.z, tx: centerOf(cx), tz: centerOf(cz), fly: BM.smoke.fly, t: BM.smoke.time, landed: false });
    this.events.push({ e: 'smoke_throw', pid: p.id });
  }

  // ---------- explosão ----------
  blast(cx, cz, range, skip) {
    const cells = [{ cx, cz, k: 'c' }], blocks = [], hit = [];
    for (const [dx, dz, kk, end] of DIRS) {
      for (let i = 1; i <= range; i++) {
        const x = cx + dx * i, z = cz + dz * i, g = this.cell(x, z);
        if (g === 1) break;
        if (g === 2) { blocks.push([x, z]); cells.push({ cx: x, cz: z, k: end }); break; }
        const ob = this.bombAtCell(x, z, skip);
        if (ob) { hit.push(ob); cells.push({ cx: x, cz: z, k: end }); break; }
        cells.push({ cx: x, cz: z, k: i === range ? end : kk });
      }
    }
    return { cells, blocks, hit };
  }
  explode(b) {
    const i = this.bombs.indexOf(b); if (i < 0) return;
    this.bombs.splice(i, 1);
    for (const q of this.players.values()) { if (q.pass) q.pass.delete(b.id); if (q.carry === b.id) q.carry = null; }
    const cx = cellOf(b.x), cz = cellOf(b.z), res = this.blast(cx, cz, b.r, b);
    for (const c of res.cells) {
      const f = this.fires.find((f2) => f2.cx === c.cx && f2.cz === c.cz);
      if (f) { f.t = BM.fire; f.T = BM.fire; f.hz = false; if (c.k === 'c') f.k = 'c'; } else this.fires.push({ cx: c.cx, cz: c.cz, k: c.k, t: BM.fire, T: BM.fire });
      // item no chão queima (menos o que acabou de aparecer)
      for (let j = this.items.length - 1; j >= 0; j--) { const it = this.items[j]; if (it.cx === c.cx && it.cz === c.cz && this.time >= it.safe) { this.items.splice(j, 1); this.events.push({ e: 'item_burn', cx: c.cx, cz: c.cz }); } }
    }
    for (const [bx, bz] of res.blocks) {
      if (this.cell(bx, bz) !== 2) continue;
      this.grid[bz * this.N + bx] = 0;
      this.events.push({ e: 'blk', cx: bx, cz: bz });
      if (Math.random() < BM.itemChance) this.items.push({ id: this.nextId++, cx: bx, cz: bz, k: this.pickItem(), safe: this.time + BM.fire + 0.15 });
    }
    for (const o of res.hit) if (o.f > 0.04) o.f = 0.04; // reação em cadeia
    this.events.push({ e: 'boom', id: b.id, cx, cz, o: b.o, cells: res.cells.map((c) => [c.cx, c.cz, c.k]) });
  }
  pickItem() {
    let r = Math.random() * 100;
    for (const k of ITEM_KINDS) { r -= ITEM_W[k]; if (r <= 0) return k; }
    return 'bomb';
  }

  // ---------- passo da simulação ----------
  step(dt) {
    this.time += dt;
    if (this.phase === 'ready') {
      this.phaseT -= dt; if (this.phaseT <= 0) { this.phase = 'play'; this.events.push({ e: 'go' }); }
      return;
    }
    if (this.phase === 'matchEnd') return;
    const playing = this.phase === 'play';
    if (playing) this.rt += dt;
    this.updateBombs(dt);
    this.updateFires(dt);
    if (playing) {
      for (const p of this.players.values()) if (p.alive && p.bot) this.botThink(p, dt);
      this.updateHazard(dt);
      this.updatePlayers(dt);
      this.updateSmokes(dt);
      this.updateSudden(dt);
      this.checkEnd();
    } else {
      this.updateSmokes(dt);
      this.phaseT -= dt;
      if (this.phaseT <= 0) { if (this.matchWinner) this.phase = 'matchEnd'; else this.startRound(); }
    }
    for (const p of this.players.values()) if (!p.alive) p.deadT += dt;
    // vencedor comemora (some do jogo só no próximo round)
  }
  updatePlayers(dt) {
    const P = [...this.players.values()];
    for (const p of P) {
      if (!p.alive) continue;
      if (p.inv > 0) p.inv -= dt;
      if (p.curseCool > 0) p.curseCool -= dt;
      if (p.jumpCd > 0) p.jumpCd -= dt;
      if (p.portCool > 0) p.portCool -= dt;
      if (p.jmp) this.advanceJump(p, dt);
      this.portalCheck(p);
      if (p.curse) { p.curseLeft -= dt; if (p.curseLeft <= 0) { p.curse = null; this.events.push({ e: 'curse_end', pid: p.id }); } }
      if (p.curse === 'autobomb') { p.autoT -= dt; if (p.autoT <= 0) { p.autoT = 0.55; const cx = cellOf(p.x), cz = cellOf(p.z); if (this.canPlace(p) && !this.bombAtCell(cx, cz)) this.placeBomb(p, cx, cz); } }
      // sai de cima da própria bomba: ela vira parede
      if (p.pass) for (const id of [...p.pass]) {
        const b = this.bombs.find((x) => x.id === id);
        if (!b || !this.overlapsCell(p, cellOf(b.x), cellOf(b.z))) { p.pass.delete(id); if (b) b.pass.delete(p.id); }
      }
      // fogo mata
      if (p.inv <= 0 && !p.jmp) for (const f of this.fires) if (this.overlapsCell(p, f.cx, f.cz, -9)) { this.kill(p, f); break; }
      if (!p.alive) continue;
      // pega item
      for (let i = this.items.length - 1; i >= 0; i--) {
        const it = this.items[i];
        if (Math.hypot(p.x - centerOf(it.cx), p.z - centerOf(it.cz)) < 42 && this.applyItem(p, it)) { this.items.splice(i, 1); this.events.push({ e: 'pickup', pid: p.id, k: it.k, cx: it.cx, cz: it.cz }); }
      }
    }
    // caveira passa de um jogador pro outro encostando
    for (const a of P) {
      if (!a.alive || !a.curse || a.curseCool > 0) continue;
      for (const b of P) {
        if (b === a || !b.alive || b.curseCool > 0) continue;
        if (Math.hypot(a.x - b.x, a.z - b.z) < BM.r * 2 + 4) {
          b.curse = a.curse; b.curseLeft = Math.max(a.curseLeft, 8); b.curseCool = a.curseCool = 1.2; a.curse = null; a.curseLeft = 0;
          this.events.push({ e: 'curse', pid: b.id, c: b.curse });
          break;
        }
      }
    }
    // dentro da fumaça?
    for (const p of P) { p.inSmoke = false; if (p.alive) for (const s of this.smokes) if (s.landed && Math.hypot(p.x - s.x, p.z - s.z) < BM.smoke.r) { p.inSmoke = true; break; } }
  }
  applyItem(p, it) {
    switch (it.k) {
      case 'bomb': if (p.maxBombs >= BM.maxBombs) return true; p.maxBombs++; return true;
      case 'fire': if (p.range >= BM.maxRange) return true; p.range++; return true;
      case 'skate': if (p.skate) return false; p.skate = true; return true;   // patinete: só dá pra pegar uma vez
      case 'jump': if (p.jumpItem) return false; p.jumpItem = true; p.jumpCd = 0; return true;
      case 'glove': if (p.glove) return false; p.glove = true; return true;
      case 'kick': if (p.kick) return false; p.kick = true; return true;
      case 'smoke': if (p.smoke >= BM.maxSmoke) return false; p.smoke++; return true;
      case 'skull': {
        p.curse = CURSES[Math.floor(Math.random() * CURSES.length)]; p.curseLeft = BM.curseTime; p.autoT = 0.3;
        this.events.push({ e: 'curse', pid: p.id, c: p.curse }); return true;
      }
    }
    return true;
  }
  kill(p, by) {
    p.alive = false; p.deadT = 0; p.vx = p.vz = 0;
    if (p.carry) { const b = this.bombs.find((x) => x.id === p.carry); if (b) { b.st = 'idle'; b.carrier = null; b.x = centerOf(cellOf(p.x)); b.z = centerOf(cellOf(p.z)); b.y = 0; } p.carry = null; }
    this.events.push({ e: 'die', pid: p.id });
  }
  updateBombs(dt) {
    const due = [];
    for (const b of this.bombs) {
      if (b.st === 'carried') {
        const c = this.players.get(b.carrier);
        if (c) { b.x = c.x; b.z = c.z; b.y = BM.wallH; }
        b.f -= dt; if (b.f <= 0 && c) b.f = 0.05; // não explode na mão: só quando ela largar... ou o carregador morrer
        continue;
      }
      b.f -= dt;
      if (b.st === 'slide') {
        const step = BM.slideSpeed * dt; b.x += b.dx * step; b.z += b.dz * step;
        const ex = b.x + b.dx * 46, ez = b.z + b.dz * 46, ax = cellOf(ex), az = cellOf(ez), cx = cellOf(b.x), cz = cellOf(b.z);
        if ((ax !== cx || az !== cz) && (this.solidCell(ax, az) || this.bombAtCell(ax, az, b) || this.playerNear(ax, az))) { b.x = centerOf(cx); b.z = centerOf(cz); b.st = 'idle'; b.dx = b.dz = 0; }
      } else if (b.st === 'thrown') {
        b.ft.t += dt; const u = Math.min(1, b.ft.t / b.ft.T);
        b.x = b.ft.sx + (b.ft.tx - b.ft.sx) * u; b.z = b.ft.sz + (b.ft.tz - b.ft.sz) * u;
        b.y = BM.wallH * 0.8 + 150 * 4 * u * (1 - u) - (BM.wallH * 0.8) * u;
        if (b.f < 0.05) b.f = 0.05; // no ar o pavio não acaba: explode só quando pousar
        if (u >= 1) { b.st = 'idle'; b.y = 0; b.x = b.ft.tx; b.z = b.ft.tz; b.ft = null; b.pass = new Set(); for (const q of this.players.values()) if (q.alive && this.overlapsCell(q, cellOf(b.x), cellOf(b.z))) { b.pass.add(q.id); (q.pass || (q.pass = new Set())).add(b.id); } this.events.push({ e: 'land', id: b.id, x: b.x, z: b.z }); }
      }
      if (b.f <= 0 && b.st !== 'thrown') due.push(b);
    }
    // explode as vencidas e as que pegaram fogo na hora (reação em cadeia no mesmo passo)
    let guard = 0;
    while (guard++ < 64) {
      const next = this.bombs.find((b) => b.f <= 0 && b.st !== 'thrown' && b.st !== 'carried');
      if (!next) break; this.explode(next);
    }
  }
  playerNear(cx, cz) {
    const x = centerOf(cx), z = centerOf(cz);
    for (const p of this.players.values()) if (p.alive && Math.hypot(p.x - x, p.z - z) < 62) return true;
    return false;
  }
  updateFires(dt) {
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i]; f.t -= dt; if (f.t <= 0) { this.fires.splice(i, 1); continue; }
      if (f.hz) for (const b of this.bombs) if ((b.st === 'idle' || b.st === 'slide') && cellOf(b.x) === f.cx && cellOf(b.z) === f.cz && b.f > 0.04) b.f = 0.04; // fogo de perigo do mapa acende bombas
    }
  }
  updateSmokes(dt) {
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i];
      if (!s.landed) { s.fly -= dt; const u = clamp(1 - s.fly / BM.smoke.fly, 0, 1); s.x = s.sx + (s.tx - s.sx) * u; s.z = s.sz + (s.tz - s.sz) * u; if (s.fly <= 0) { s.landed = true; s.x = s.tx; s.z = s.tz; this.events.push({ e: 'smoke', x: s.x, z: s.z }); } }
      else { s.t -= dt; if (s.t <= 0) this.smokes.splice(i, 1); }
    }
  }
  updateSudden(dt) {
    if (this.rt < this.roundTime - (BM.roundTime - BM.sudden)) return; // morte súbita nos últimos 60 s
    this.dropT -= dt;
    while (this.dropT <= 0 && this.dropI < this.spiral.length) {
      const [cx, cz] = this.spiral[this.dropI++];
      if (this.cell(cx, cz) === 1) continue; // já era parede: pula sem esperar
      this.dropT += 0.28;
      this.grid[cz * this.N + cx] = 1;
      this.bombs = this.bombs.filter((b) => !(cellOf(b.x) === cx && cellOf(b.z) === cz && b.st !== 'thrown' && b.st !== 'carried'));
      this.items = this.items.filter((it) => !(it.cx === cx && it.cz === cz));
      for (const p of this.players.values()) if (p.alive && this.overlapsCell(p, cx, cz, -6)) this.kill(p, null);
      this.events.push({ e: 'drop', cx, cz });
    }
  }
  checkEnd() {
    if (this.practice) return;
    const alive = [...this.players.values()].filter((p) => p.alive);
    if (alive.length > 1 && this.rt < this.roundTime + 60) return;
    this.phase = 'roundEnd'; this.phaseT = BM.endDelay;
    if (alive.length === 1) {
      this.winner = alive[0].id; alive[0].wins++;
      this.events.push({ e: 'win', pid: this.winner });
      if (alive[0].wins >= this.winsNeeded) this.matchWinner = alive[0].id;
    } else { this.winner = null; this.events.push({ e: 'draw' }); }
  }

  // ---------- perigos do mapa ----------
  portalCheck(p) {
    const pl = this.mp.portals; if (!pl || !this.portalOpen || p.portCool > 0 || p.jmp) return;
    for (const [ax, az, bx, bz] of pl) for (const [a, b] of [[[ax, az], [bx, bz]], [[bx, bz], [ax, az]]]) {
      if (Math.hypot(p.x - centerOf(a[0]), p.z - centerOf(a[1])) < 30) {
        p.x = centerOf(b[0]); p.z = centerOf(b[1]); p.portCool = 1.4; p.corr = true; p.vx = p.vz = 0; p.cvx = p.cvz = 0;
        this.events.push({ e: 'portal', pid: p.id, x: p.x, z: p.z, fx: centerOf(a[0]), fz: centerOf(a[1]) }); return;
      }
    }
  }
  addFire(cx, cz, T, hz) {
    if (this.cell(cx, cz) === 1) return;
    const f = this.fires.find((q) => q.cx === cx && q.cz === cz);
    if (f) { f.t = Math.max(f.t, T); f.T = Math.max(f.T || 0, T); f.hz = !!hz; f.k = 'c'; } else this.fires.push({ cx, cz, k: 'c', t: T, T, hz: !!hz });
    for (let j = this.items.length - 1; j >= 0; j--) { const it = this.items[j]; if (it.cx === cx && it.cz === cz && this.time >= it.safe) { this.items.splice(j, 1); this.events.push({ e: 'item_burn', cx, cz }); } }
  }
  breakBlock(cx, cz) {
    if (this.cell(cx, cz) !== 2) return false;
    this.grid[cz * this.N + cx] = 0; this.events.push({ e: 'blk', cx, cz });
    if (Math.random() < BM.itemChance) this.items.push({ id: this.nextId++, cx, cz, k: this.pickItem(), safe: this.time + 0.3 });
    return true;
  }
  randomCell(minCorner) {
    const N = this.N, sp = spawnCells(N);
    for (let i = 0; i < 60; i++) {
      const x = 1 + Math.floor(Math.random() * (N - 2)), z = 1 + Math.floor(Math.random() * (N - 2));
      if (this.cell(x, z) === 1) continue;
      if (sp.some(([a, b]) => Math.abs(a - x) + Math.abs(b - z) < minCorner)) continue;
      return [x, z];
    }
    return null;
  }
  bandStrike(o) { o.L = this.N * CELL; o.T = o.a = (o.L + 2 * o.len) / o.sp; o.id = this.nextId++; o.f = 0; return o; }
  spawnStrikes(h) {
    const N = this.N, id = () => this.nextId++;
    switch (h.k) {
      case 'train': this.trainN = (this.trainN || 0) + 1; this.strikes.push(this.bandStrike({ k: 'train', ax: 'z', lo: 6 * CELL, hi: 9 * CELL, dir: this.trainN % 2 ? 1 : -1, len: 380, sp: 1500, w: 3 })); this.events.push({ e: 'warn', k: 'train' }); break;
      case 'wave': {
        const ax = Math.random() < 0.5 ? 'x' : 'z', idx = [1, 3, 5, 7, 9, 11, 13].sort(() => Math.random() - 0.5).slice(0, h.lines || 2);
        for (const i of idx) this.strikes.push(this.bandStrike({ k: 'wave', ax, lo: i * CELL, hi: (i + 1) * CELL, dir: Math.random() < 0.5 ? 1 : -1, len: 320, sp: h.speed || 900, w: 2.6 }));
        this.events.push({ e: 'warn', k: 'wave' }); break;
      }
      case 'ball': this.strikes.push({ id: id(), k: 'ball', cx: N * CELL / 2, cz: N * CELL / 2, R: 2 * CELL, ang0: Math.random() * 6.283, dir: Math.random() < 0.5 ? 1 : -1, laps: 2, w: 2.6, T: 4.4, a: 4.4, bx: 0, bz: 0 }); this.events.push({ e: 'warn', k: 'ball' }); break;
      case 'meteor': {
        const c1 = this.randomCell(4); if (!c1) break; const c2 = [N - 1 - c1[0], N - 1 - c1[1]];
        for (const c of (h.count || 2) > 1 && this.cell(c2[0], c2[1]) !== 1 ? [c1, c2] : [c1]) this.strikes.push({ id: id(), k: 'meteor', cx: c[0], cz: c[1], w: 2.6, T: 0.9, a: 0.9 });
        this.events.push({ e: 'warn', k: 'meteor' }); break;
      }
      case 'lava': {
        for (let i = 0; i < (h.count || 3); i++) { const c = this.randomCell(4); if (c) this.strikes.push({ id: id(), k: 'lava', cx: c[0], cz: c[1], w: 2.2, T: 2.0, a: 2.0 }); }
        this.events.push({ e: 'warn', k: 'lava' }); break;
      }
      case 'dragon': {
        const ax = Math.random() < 0.5 ? 'x' : 'z', idx = [1, 3, 5, 7, 9, 11, 13].sort(() => Math.random() - 0.5).slice(0, h.lines || 2);
        for (const i of idx) this.strikes.push({ id: id(), k: 'fire', ax, idx: i, dir: Math.random() < 0.5 ? 1 : -1, w: 2.8, T: 1.1, a: 1.1 });
        this.events.push({ e: 'warn', k: 'dragon' }); break;
      }
    }
  }
  activateStrike(s) {
    const N = this.N;
    if (s.k === 'train' || s.k === 'wave' || s.k === 'ball') this.events.push({ e: s.k === 'ball' ? 'ballgo' : s.k + 'go' });
    else if (s.k === 'meteor') {
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { this.addFire(s.cx + dx, s.cz + dz, 0.9, true); this.breakBlock(s.cx + dx, s.cz + dz); }
      if (this.cell(s.cx, s.cz) === 0) this.grid[s.cz * N + s.cx] = 2; // a pedra do meteoro fica no chão (dá pra quebrar com bomba)
      this.events.push({ e: 'meteor', cx: s.cx, cz: s.cz });
    } else if (s.k === 'lava') {
      for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) this.addFire(s.cx + dx, s.cz + dz, 2.0, true);
      this.events.push({ e: 'erupt', cx: s.cx, cz: s.cz });
    } else if (s.k === 'fire') {
      for (let i = 1; i < N - 1; i++) { const x = s.ax === 'x' ? i : s.idx, z = s.ax === 'x' ? s.idx : i; this.addFire(x, z, 1.1, true); this.breakBlock(x, z); }
      this.events.push({ e: 'dragon', ax: s.ax, idx: s.idx });
    }
  }
  killAt(p, byHazard) { if (p.alive && p.inv <= 0 && !p.jmp) this.kill(p, byHazard || null); }
  runStrike(s) {
    if (s.k === 'train' || s.k === 'wave') {
      const u = clamp(1 - s.a / s.T, 0, 1), start = s.dir > 0 ? -s.len : s.L + s.len, end = s.dir > 0 ? s.L + s.len : -s.len, f = start + (end - start) * u;
      s.f = f; const b0 = Math.min(f, f - s.dir * s.len), b1 = Math.max(f, f - s.dir * s.len);
      const inBand = (x, z, m) => { const al = s.ax === 'z' ? z : x, cr = s.ax === 'z' ? x : z; return al >= b0 - m && al <= b1 + m && cr >= s.lo - m && cr <= s.hi + m; };
      for (const p of this.players.values()) if (p.alive && inBand(p.x, p.z, 8)) this.killAt(p, s);
      this.bombs = this.bombs.filter((b) => !((b.st === 'idle' || b.st === 'slide') && inBand(b.x, b.z, 0)));
      for (let j = this.items.length - 1; j >= 0; j--) { const it = this.items[j]; if (inBand(centerOf(it.cx), centerOf(it.cz), 0)) { this.items.splice(j, 1); this.events.push({ e: 'item_burn', cx: it.cx, cz: it.cz }); } }
    } else if (s.k === 'ball') {
      const u = clamp(1 - s.a / s.T, 0, 1), ang = s.ang0 + s.dir * s.laps * 6.283 * u; s.bx = s.cx + Math.cos(ang) * s.R; s.bz = s.cz + Math.sin(ang) * s.R;
      for (const p of this.players.values()) if (p.alive && Math.hypot(p.x - s.bx, p.z - s.bz) < 64) this.killAt(p, s);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const cx = cellOf(s.bx) + dx, cz = cellOf(s.bz) + dz; if (Math.hypot(centerOf(cx) - s.bx, centerOf(cz) - s.bz) < 80) this.breakBlock(cx, cz); }
      this.bombs = this.bombs.filter((b) => !((b.st === 'idle' || b.st === 'slide') && Math.hypot(b.x - s.bx, b.z - s.bz) < 60));
    }
  }
  updateHazard(dt) {
    const mp = this.mp, h = mp.hz;
    if (mp.portals) this.portalOpen = (this.rt % 15) < 10;
    if (h) {
      if (h.k === 'dark') { const t = this.rt - 8; this.dark = t >= 0 && (t % h.period) >= h.lit; }
      else if (h.k === 'blizzard' || h.k === 'sand') {
        if (this.storm > 0) { this.storm -= dt; if (this.storm <= 0) { this.storm = 0; this.wind = [0, 0]; } }
        this.hzT -= dt;
        if (this.hzT <= 0) {
          this.hzT = h.every; this.storm = h.dur;
          if (h.k === 'sand') { const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][(Math.random() * 4) | 0]; this.wind = [d[0] * BM.windSpeed, d[1] * BM.windSpeed]; }
          this.events.push({ e: 'storm', k: h.k });
        }
      } else { this.hzT -= dt; if (this.hzT <= 0) { this.hzT = h.every; this.spawnStrikes(h); } }
    }
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i];
      if (s.w > 0) { s.w -= dt; if (s.w <= 0) { s.w = 0; this.activateStrike(s); } }
      else { s.a -= dt; this.runStrike(s); if (s.a <= 0) this.strikes.splice(i, 1); }
    }
  }
  strikeCells(s) { // células perigosas de um perigo (pros bots fugirem)
    const N = this.N, out = [], add = (x, z) => { if (x > 0 && z > 0 && x < N - 1 && z < N - 1) out.push(this.idx(x, z)); };
    if (s.k === 'train' || s.k === 'wave') { for (let c = cellOf(s.lo); c <= cellOf(s.hi - 1); c++) for (let i = 1; i < N - 1; i++) s.ax === 'z' ? add(c, i) : add(i, c); }
    else if (s.k === 'ball') { for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) if (Math.abs(Math.hypot(centerOf(x) - s.cx, centerOf(z) - s.cz) - s.R) < 95) add(x, z); }
    else if (s.k === 'meteor') { for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) add(s.cx + dx, s.cz + dz); }
    else if (s.k === 'lava') { for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) add(s.cx + dx, s.cz + dz); }
    else if (s.k === 'fire') { for (let i = 1; i < N - 1; i++) s.ax === 'x' ? add(i, s.idx) : add(s.idx, i); }
    return out;
  }

  // ---------- bots ----------
  idx(cx, cz) { return cz * this.N + cx; }
  dangerSet(horizon) {
    const set = new Set(), q = [], seen = new Set();
    for (const f of this.fires) set.add(this.idx(f.cx, f.cz));
    for (const b of this.bombs) if ((b.st === 'idle' || b.st === 'slide') && b.f <= horizon) { q.push(b); seen.add(b); }
    while (q.length) {
      const b = q.pop(), r = this.blast(cellOf(b.x), cellOf(b.z), b.r, b);
      for (const c of r.cells) set.add(this.idx(c.cx, c.cz));
      for (const o of r.hit) if (!seen.has(o)) { seen.add(o); q.push(o); }
    }
    for (const s of this.strikes) if (s.w <= 3.4 || s.a < s.T) for (const c of this.strikeCells(s)) set.add(c);
    // morte súbita: próximas células a cair
    if (this.rt >= this.roundTime - (BM.roundTime - BM.sudden) - 3) for (let i = this.dropI; i < Math.min(this.spiral.length, this.dropI + 14); i++) set.add(this.idx(this.spiral[i][0], this.spiral[i][1]));
    return set;
  }
  // busca em largura: devolve a lista de células até a primeira que satisfaz goal()
  bfs(sx, sz, goal, passable, maxLen) {
    const N = this.N, prev = new Int32Array(N * N).fill(-2), dist = new Int16Array(N * N), q = [this.idx(sx, sz)];
    prev[q[0]] = -1;
    for (let h = 0; h < q.length; h++) {
      const cur = q[h], cx = cur % N, cz = (cur / N) | 0;
      if (h > 0 && goal(cx, cz)) { const path = []; for (let c = cur; c !== -1; c = prev[c]) path.push([c % N, (c / N) | 0]); path.reverse(); path.shift(); return path; }
      if (maxLen && dist[cur] >= maxLen) continue;
      for (const [dx, dz] of DIRS) {
        const nx = cx + dx, nz = cz + dz; if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
        const ni = this.idx(nx, nz); if (prev[ni] !== -2 || !passable(nx, nz)) continue;
        prev[ni] = cur; dist[ni] = dist[cur] + 1; q.push(ni);
      }
    }
    return null;
  }
  botThink(p, dt) {
    const ai = p.ai || (p.ai = { t: 0, path: [], cool: 0 });
    ai.t -= dt; ai.cool -= dt;
    const cx = cellOf(p.x), cz = cellOf(p.z);
    if (ai.t <= 0) {
      ai.t = 0.1 + Math.random() * 0.1;
      const danger = this.dangerSet(1.5), here = danger.has(this.idx(cx, cz));
      const solid = (x, z) => this.solidCell(x, z) || !!this.bombAtCell(x, z);
      if (here) {
        ai.path = this.bfs(cx, cz, (x, z) => !danger.has(this.idx(x, z)), (x, z) => !solid(x, z), 12) || [];
      } else {
        let acted = false;
        if (ai.cool <= 0 && this.canPlace(p) && !this.bombAtCell(cx, cz) && this.botWantsBomb(p, cx, cz)) {
          const b = this.blast(cx, cz, this.rangeOf(p)), unsafe = new Set(danger);
          for (const c of b.cells) unsafe.add(this.idx(c.cx, c.cz));
          const esc = this.bfs(cx, cz, (x, z) => !unsafe.has(this.idx(x, z)), (x, z) => !solid(x, z), 9);
          if (esc && esc.length <= 8) { this.placeBomb(p, cx, cz); ai.path = esc; ai.cool = 0.5 + Math.random() * 0.8; acted = true; }
        }
        if (!acted) {
          const safe = (x, z) => !solid(x, z) && !danger.has(this.idx(x, z));
          const enemies = [...this.players.values()].filter((o) => o !== p && o.alive);
          const hasItem = (x, z) => this.items.some((it) => it.cx === x && it.cz === z && it.k !== 'skull' && this.itemWanted(p, it));
          const nearBlock = (x, z) => DIRS.some(([dx, dz]) => this.cell(x + dx, z + dz) === 2);
          const nearEnemy = (x, z) => enemies.some((o) => Math.abs(cellOf(o.x) - x) + Math.abs(cellOf(o.z) - z) <= 1);
          let path = this.bfs(cx, cz, hasItem, safe, 14);
          if (!path && this.canPlace(p)) path = this.bfs(cx, cz, (x, z) => nearBlock(x, z) || nearEnemy(x, z), safe, 30);
          if (!path) path = this.bfs(cx, cz, (x, z) => enemies.some((o) => cellOf(o.x) === x && cellOf(o.z) === z), safe, 40);
          ai.path = path || [];
        }
      }
    }
    // anda até o centro da próxima célula do caminho
    while (ai.path.length) {
      const [px, pz] = ai.path[0];
      if (Math.hypot(centerOf(px) - p.x, centerOf(pz) - p.z) < 9) ai.path.shift(); else break;
    }
    if (ai.path.length) {
      const [px, pz] = ai.path[0], dx = centerOf(px) - p.x, dz = centerOf(pz) - p.z, d = Math.hypot(dx, dz) || 1;
      p.yaw = Math.atan2(dz, dx); this.moveLocal(p, dx / d, dz / d, dt);
    } else { p.vx = p.vz = 0; }
  }
  itemWanted(p, it) {
    if (it.k === 'skate') return !p.skate; if (it.k === 'glove') return !p.glove; if (it.k === 'kick') return !p.kick;
    if (it.k === 'smoke') return p.smoke < BM.maxSmoke; if (it.k === 'bomb') return p.maxBombs < BM.maxBombs; if (it.k === 'fire') return p.range < BM.maxRange;
    return true;
  }
  botWantsBomb(p, cx, cz) {
    if (DIRS.some(([dx, dz]) => this.cell(cx + dx, cz + dz) === 2) && Math.random() < 0.92) return true;
    const b = this.blast(cx, cz, this.rangeOf(p));
    for (const o of this.players.values()) if (o !== p && o.alive && b.cells.some((c) => c.cx === cellOf(o.x) && c.cz === cellOf(o.z))) return true;
    return false;
  }

  // ---------- estado pra rede / tela ----------
  drainEvents() { const e = this.events; this.events = []; return e; }
  snapshot() {
    const pl = [];
    for (const p of this.players.values()) {
      pl.push({ id: p.id, nm: p.name, sl: p.slot, bt: p.bot ? 1 : 0, ch: p.ch, x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10, yaw: Math.round(p.yaw * 100) / 100,
        vx: Math.round(p.vx), vz: Math.round(p.vz), al: p.alive ? 1 : 0, mb: p.maxBombs, rg: p.range, sk: p.skate ? 1 : 0, gl: p.glove ? 1 : 0, kk: p.kick ? 1 : 0, sm: p.smoke,
        cu: p.curse, cl: p.curse ? Math.round(p.curseLeft * 10) / 10 : 0, cr: p.carry || 0, jp: p.jumpItem ? 1 : 0, jc: Math.round(Math.max(0, p.jumpCd) * 10) / 10, jm: p.jmp ? Math.round(p.jmp.t / p.jmp.T * 100) / 100 : -1, wn: p.wins, sp: p.inSmoke ? 1 : 0, iv: p.inv > 0 ? 1 : 0, dt: Math.round(p.deadT * 10) / 10, ab: this.activeBombs(p) });
    }
    return {
      t: Math.round(this.time * 1000) / 1000, ph: this.phase, pt: Math.max(0, Math.round(this.phaseT * 10) / 10), rt: Math.round(this.rt * 10) / 10, rn: this.round, rl: this.roundTime, n: this.N, g: this.gridString(),
      mp: this.mapId, w: this.winner, mw: this.matchWinner, wn: this.winsNeeded, pr: this.practice ? 1 : 0, p: pl,
      b: this.bombs.map((b) => ({ id: b.id, o: b.o, x: Math.round(b.x), z: Math.round(b.z), y: Math.round(b.y), f: Math.round(b.f * 100) / 100, r: b.r, st: b.st })),
      fi: this.fires.map((f) => ({ cx: f.cx, cz: f.cz, k: f.k, t: Math.round(f.t * 100) / 100, T: Math.round((f.T || BM.fire) * 100) / 100, h: f.hz ? 1 : 0 })),
      hz: this.strikes.map((s) => { const o = { id: s.id, k: s.k, w: Math.round(s.w * 100) / 100, a: Math.round(s.a * 100) / 100, T: s.T }; if (s.k === 'train' || s.k === 'wave') Object.assign(o, { ax: s.ax, lo: s.lo, hi: s.hi, dir: s.dir, len: s.len, L: s.L, f: Math.round(s.f) }); else if (s.k === 'ball') Object.assign(o, { cx: s.cx, cz: s.cz, R: s.R, bx: Math.round(s.bx), bz: Math.round(s.bz) }); else if (s.k === 'fire') Object.assign(o, { ax: s.ax, idx: s.idx, dir: s.dir }); else Object.assign(o, { cx: s.cx, cz: s.cz }); return o; }),
      stm: Math.round(this.storm * 10) / 10, wd: this.wind, dk: this.dark ? 1 : 0, po: this.portalOpen ? 1 : 0,
      it: this.items.map((i) => ({ id: i.id, cx: i.cx, cz: i.cz, k: i.k })),
      sm: this.smokes.map((s) => ({ id: s.id, x: Math.round(s.x), z: Math.round(s.z), t: Math.round(s.t * 10) / 10, l: s.landed ? 1 : 0 }))
    };
  }
}

// ---------- espelho do estado (navegador, multiplayer) ----------
// Guarda o mapa e as bombas que o servidor mandou, só pra o próprio jogador andar na hora (previsão) com a mesma regra de colisão.
export class BomberMirror extends BomberSim {
  constructor(N) {
    super({ size: N || BM.size, players: [], practice: true });
    this.phase = 'play'; this.isMirror = true;
  }
  startRound() { this.grid = new Uint8Array(this.N * this.N); this.bombs = []; this.fires = []; this.items = []; this.smokes = []; this.spiral = []; }
  apply(s, meId) {
    this.N = s.n; if (this.grid.length !== s.n * s.n) this.grid = new Uint8Array(s.n * s.n);
    for (let i = 0; i < s.g.length; i++) this.grid[i] = s.g.charCodeAt(i) - 48;
    this.phase = s.ph; this.time = s.t; this.mapId = s.mp || 'classic'; this.storm = s.stm || 0; this.wind = s.wd || [0, 0];
    const me = this.players.get(meId);
    const sp = s.p.find((q) => q.id === meId);
    if (sp) {
      if (!me) this.players.set(meId, { id: meId, x: sp.x, z: sp.z, yaw: sp.yaw, vx: 0, vz: 0, alive: !!sp.al, cvx: 0, cvz: 0, jmp: null, jumpGuard: 0, jumpCd: 0, jumpItem: false });
      const m = this.players.get(meId); m.alive = !!sp.al; m.skate = !!sp.sk; m.curse = sp.cu; m.inSmoke = !!sp.sp; m.kick = !!sp.kk; m.sx = sp.x; m.sz = sp.z; m.jumpItem = !!sp.jp; if (!(m.jumpGuard > 0)) m.jumpCd = sp.jc; // sx/sz: onde o servidor diz que estou
    }
    const keep = new Map(this.bombs.map((b) => [b.id, b]));
    this.bombs = s.b.map((b) => { const o = keep.get(b.id) || { id: b.id, pass: new Set() }; Object.assign(o, { x: b.x, z: b.z, y: b.y, f: b.f, st: b.st, o: b.o }); return o; });
    const m2 = this.players.get(meId);
    if (m2) { if (!m2.pass) m2.pass = new Set(); for (const b of this.bombs) if (this.overlapsCell(m2, cellOf(b.x), cellOf(b.z)) && !b.seenBy) { b.pass.add(meId); m2.pass.add(b.id); } for (const b of this.bombs) b.seenBy = true; for (const id of [...m2.pass]) if (!this.bombs.some((b) => b.id === id)) m2.pass.delete(id); }
  }
  // sem passos de simulação próprios (o servidor manda): só movimento do jogador local
  step() {}
  updatePassLocal(me) {
    if (!me || !me.pass) return;
    for (const id of [...me.pass]) { const b = this.bombs.find((x) => x.id === id); if (!b || !this.overlapsCell(me, cellOf(b.x), cellOf(b.z))) { me.pass.delete(id); if (b) b.pass.delete(me.id); } }
  }
}
