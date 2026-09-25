// Simulação do jogo (autoritativa no servidor, e usada localmente na página /teste).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./config'), require('./maps'));
  else root.RC_GAME = factory(root.RC_CONFIG, root.RC_MAPS);
})(typeof self !== 'undefined' ? self : this, function (CONFIG, MAPSMOD) {
  const { MAPS, SPAWNS_Y, SPAWN_X } = MAPSMOD;

  // ---------------- Física ----------------
  function buildWalls(mapId, cfg, layout) {
    const map = MAPS[mapId] || MAPS.deserto;
    const W = cfg.mapWidth, H = cfg.mapHeight, t = cfg.wallThickness;
    const rects = [
      { x: 0, y: 0, w: W, h: t, border: true },
      { x: 0, y: H - t, w: W, h: t, border: true }
    ];
    const P = portalList(map);
    if (P.length) {
      // muros de borda com aberturas; cada abertura tem uma "porta" (door) que fecha o portal
      const side = (sd, horiz, fixed, len) => {
        const bands = P.filter((q) => q.s === sd).sort((a, b) => a.a - b.a);
        let u = 0;
        const seg = (u0, u1, extra) => { if (u1 - u0 <= 0) return; rects.push(Object.assign(horiz ? { x: u0, y: fixed, w: u1 - u0, h: t } : { x: fixed, y: u0, w: t, h: u1 - u0 }, { border: true }, extra || {})); };
        for (const q of bands) { seg(u, q.a * len); seg(q.a * len, q.b * len, { door: true, pi: q.i }); u = q.b * len; }
        seg(u, len);
      };
      rects.length = 0;
      side('T', true, 0, W); side('B', true, H - t, W);
      side('L', false, 0, H); side('R', false, W - t, H);
    } else {
      rects.push({ x: 0, y: 0, w: t, h: H, border: true }, { x: W - t, y: 0, w: t, h: H, border: true });
    }
    const seg = (s, extra) => {
      const x1 = s[0] * W, y1 = s[1] * H, x2 = s[2] * W, y2 = s[3] * H;
      const minx = Math.min(x1, x2), miny = Math.min(y1, y2);
      rects.push(Object.assign({ x: minx - t / 2, y: miny - t / 2, w: Math.abs(x2 - x1) + t, h: Math.abs(y2 - y1) + t }, extra || {}));
    };
    for (const s of map.walls) seg(s);
    // paredes que mudam de lugar (vulcão)
    if (map.layouts) for (const s of map.layouts[((layout || 0) % map.layouts.length + map.layouts.length) % map.layouts.length]) seg(s, { mv: true });
    // cantos do casco (nave): espaço, ninguém passa
    if (map.blocks) for (const b of map.blocks) rects.push({ x: b[0] * W, y: b[1] * H, w: b[2] * W, h: b[3] * H, space: true });
    // postes da cidade: bloqueiam e apagam quando levam tiro
    if (map.lamps) map.lamps.forEach((l, i) => rects.push({ x: l[0] * W - 8, y: l[1] * H - 8, w: 16, h: 16, lamp: i }));
    return rects;
  }

  // lista de portais do mapa: L/R = laterais (faixa de altura), T/B = cima/baixo (faixa de largura)
  function portalList(map) {
    if (!map || !map.portals) return [];
    if (map._pl) return map._pl;
    const out = [];
    for (const sd of ['L', 'R', 'T', 'B']) for (const [a, b] of (map.portals[sd] || [])) out.push({ i: out.length, s: sd, a, b });
    return (map._pl = out);
  }
  // geometria de um portal: centro na borda, normal apontando para dentro do mapa e tangente
  function portalGeom(q, cfg) {
    const W = cfg.mapWidth, H = cfg.mapHeight, t = cfg.wallThickness;
    if (q.s === 'L') return { cx: 0, cy: (q.a + q.b) / 2 * H, nx: 1, ny: 0, half: (q.b - q.a) / 2 * H, t };
    if (q.s === 'R') return { cx: W, cy: (q.a + q.b) / 2 * H, nx: -1, ny: 0, half: (q.b - q.a) / 2 * H, t };
    if (q.s === 'T') return { cx: (q.a + q.b) / 2 * W, cy: 0, nx: 0, ny: 1, half: (q.b - q.a) / 2 * W, t };
    return { cx: (q.a + q.b) / 2 * W, cy: H, nx: 0, ny: -1, half: (q.b - q.a) / 2 * W, t };
  }
  // qual portal está em (x,y), se passou do muro de borda dentro de uma abertura
  function portalAt(map, cfg, x, y) {
    const W = cfg.mapWidth, H = cfg.mapHeight, t = cfg.wallThickness;
    for (const q of portalList(map)) {
      if (q.s === 'L' && x < t && y > q.a * H && y < q.b * H) return q;
      if (q.s === 'R' && x > W - t && y > q.a * H && y < q.b * H) return q;
      if (q.s === 'T' && y < t && x > q.a * W && x < q.b * W) return q;
      if (q.s === 'B' && y > H - t && x > q.a * W && x < q.b * W) return q;
    }
    return null;
  }
  // portal aberto: entrou num portal, sai no par dele. pr = [[i,j],[k,l]] (pares abertos).
  // Retorna a nova posição e a rotação (cos, sin) para girar a velocidade da bala.
  function portalWrap(mapId, cfg, x, y, r, pr) {
    const map = MAPS[mapId];
    if (!map || !map.portals || !pr) return null;
    const q = portalAt(map, cfg, x, y);
    if (!q) return null;
    let to = -1;
    for (const [i, j] of pr) { if (i === q.i) to = j; else if (j === q.i) to = i; }
    if (to < 0) return null;
    const P = portalList(map), g1 = portalGeom(q, cfg), g2 = portalGeom(P[to], cfg);
    // gira a direção "saindo" do portal de entrada (-n1) para "entrando" no mapa pelo de saída (n2)
    const ang = Math.atan2(g2.ny, g2.nx) - Math.atan2(-g1.ny, -g1.nx);
    const co = Math.round(Math.cos(ang)), si = Math.round(Math.sin(ang));
    const rot = (vx, vy) => [vx * co - vy * si, vx * si + vy * co];
    // posição ao longo da abertura (girada junto), limitada para caber
    const [ox, oy] = rot(x - g1.cx, y - g1.cy);
    let u = ox * -g2.ny + oy * g2.nx; // componente tangente na saída
    const lim = Math.max(0, g2.half - r - 2); u = Math.max(-lim, Math.min(lim, u));
    const d = g2.t + r + 2;
    return { x: g2.cx + -g2.ny * u + g2.nx * d, y: g2.cy + g2.nx * u + g2.ny * d, co, si, from: q.i, to };
  }
  // paredes com os portais abertos (pr) sem a porta
  function openWalls(wallsAll, pr) {
    if (!pr) return wallsAll;
    const s = new Set(); for (const [i, j] of pr) { s.add(i); s.add(j); }
    return wallsAll.filter((R) => !(R.door && s.has(R.pi)));
  }
  // sorteia 2 pares entre todos os portais (nunca repete o mesmo sorteio seguido).
  // Regra: pelo menos um dos pares liga paredes diferentes (os dois pares na mesma parede perde a graça)
  function pickPortalPairs(list, prev, rnd) {
    rnd = rnd || Math.random;
    if (typeof list === 'number') { const n = list; list = []; for (let i = 0; i < n; i++) list.push({ i, s: String(i) }); }
    const n = list.length, side = (i) => list[i].s;
    const key = (pr) => pr.map((p) => p.slice().sort((a, b) => a - b).join('-')).sort().join('|');
    for (let tries = 0; tries < 60; tries++) {
      const ids = []; for (let i = 0; i < n; i++) ids.push(i);
      for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
      const pr = [[ids[0], ids[1]], [ids[2], ids[3]]];
      const same = pr.filter(([x, y]) => side(x) === side(y)).length;
      if (same >= 2) continue;
      if (!prev || key(pr) !== key(prev)) return pr;
    }
    return [[0, 2], [1, 3]];
  }
  // primeira abertura do round: portais de cima ligados aos de baixo (atravessa o mapa de cima para baixo)
  function firstPortalPairs(list) {
    const pr = [];
    for (const q of list) if (q.s === 'T') { const o = list.find((w) => w.s === 'B' && w.a === q.a); if (o) pr.push([q.i, o.i]); }
    return pr.length ? pr : pickPortalPairs(list, null);
  }

  // estado dos portais: abertos 3 s no começo (cima <-> baixo), fechados 6 s, depois abre 10 s / fecha 5 s repetindo.
  // k = número da abertura (-2 = abertura inicial, -1 = fechado inicial)
  function portalCycle(el, cfg) {
    const fo = cfg.portalFirstOpen, fc = cfg.portalFirstClosed;
    if (el < fo) return { o: 1, n: fo - el, k: -2 };
    if (el < fo + fc) return { o: 0, n: fo + fc - el, k: -1 };
    const e = el - fo - fc, p = cfg.portalOpen + cfg.portalClosed, t = e % p;
    const k = Math.floor(e / p);
    if (t < cfg.portalOpen) return { o: 1, n: cfg.portalOpen - t, k };
    return { o: 0, n: p - t, k };
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // Empurra um círculo para fora de um retângulo. Retorna null se não houver colisão.
  function circleRect(x, y, r, R) {
    const cx = clamp(x, R.x, R.x + R.w), cy = clamp(y, R.y, R.y + R.h);
    const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
    if (d2 >= r * r) return null;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
      return { x: cx + nx * r, y: cy + ny * r, nx, ny };
    }
    // centro dentro do retângulo: sai pelo lado mais próximo
    const l = x - R.x, rt = R.x + R.w - x, tp = y - R.y, bt = R.y + R.h - y;
    const m = Math.min(l, rt, tp, bt);
    if (m === l) return { x: R.x - r, y, nx: -1, ny: 0 };
    if (m === rt) return { x: R.x + R.w + r, y, nx: 1, ny: 0 };
    if (m === tp) return { x, y: R.y - r, nx: 0, ny: -1 };
    return { x, y: R.y + R.h + r, nx: 0, ny: 1 };
  }

  function moveCircle(x, y, mx, my, r, walls) {
    let nx = x + mx, ny = y + my;
    for (let it = 0; it < 4; it++) {
      let any = false;
      for (const R of walls) {
        const c = circleRect(nx, ny, r, R);
        if (c) { nx = c.x; ny = c.y; any = true; }
      }
      if (!any) break;
    }
    return { x: nx, y: ny };
  }

  function circleFree(x, y, r, walls, cfg) {
    const t = cfg.wallThickness;
    if (x < t + r || y < t + r || x > cfg.mapWidth - t - r || y > cfg.mapHeight - t - r) return false;
    for (const R of walls) if (circleRect(x, y, r, R)) return false;
    return true;
  }

  // Liang–Barsky: o segmento cruza o retângulo?
  function segRect(x1, y1, x2, y2, R) {
    let t0 = 0, t1 = 1;
    const dx = x2 - x1, dy = y2 - y1;
    const p = [-dx, dx, -dy, dy], q = [x1 - R.x, R.x + R.w - x1, y1 - R.y, R.y + R.h - y1];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return false; }
      else {
        const t = q[i] / p[i];
        if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
        else { if (t < t0) return false; if (t < t1) t1 = t; }
      }
    }
    return true;
  }
  function lineBlocked(x1, y1, x2, y2, walls) {
    for (const R of walls) if (segRect(x1, y1, x2, y2, R)) return true;
    return false;
  }

  function spawnPos(team, slot, cfg) {
    const y = SPAWNS_Y[slot % SPAWNS_Y.length];
    const x = team === 'A' ? SPAWN_X : 1 - SPAWN_X;
    return { x: x * cfg.mapWidth, y: y * cfg.mapHeight };
  }

  const r1 = (v) => Math.round(v * 10) / 10;

  // quem a faca acerta: o inimigo cujo corpo encosta na área do golpe (setor de raio corpo+alcance)
  function knifeTarget(px, py, ra, fx, fy, targets, cfg, walls) {
    const half = (cfg.knifeArc / 2) * Math.PI / 180;
    const reach = ra + cfg.knifeRange;
    let best = null, bestD = Infinity;
    for (const q of targets) {
      const dx = q.x - px, dy = q.y - py, d = Math.hypot(dx, dy);
      if (d - q.r > reach) continue;
      if (d > ra + q.r) { // não está encostado: confere o ângulo (conta o tamanho do alvo)
        const tol = Math.asin(Math.min(1, q.r / d));
        const cos = (dx * fx + dy * fy) / d;
        if (cos < Math.cos(Math.min(Math.PI, half + tol))) continue;
      }
      if (walls && lineBlocked(px, py, q.x, q.y, walls)) continue;
      if (d < bestD) { best = q.id; bestD = d; }
    }
    return best;
  }

  // ---------------- Jogo ----------------
  class Game {
    constructor(cfg, opts) {
      opts = opts || {};
      this.cfg = cfg;
      this.mode = opts.mode || 'match'; // 'match' | 'sandbox'
      // modo de jogo da partida: 'rounds' (eliminação), 'tdm' (mata-mata em equipe), 'ffa' (mata-mata cada um por si)
      this.gameMode = ['tdm', 'ffa', 'koth'].includes(opts.gameMode) ? opts.gameMode : 'rounds';
      this.hillTarget = opts.hillTarget || 100;  // koth: pontos para vencer
      this.matchTime = opts.matchTime || 180;   // tdm/ffa: duração (s)
      this.killLimit = opts.killLimit || 30;    // tdm/ffa: abates para vencer
      this.bombs = []; this.smokes = []; this.holes = []; this.nextHoleId = 1;
      this.lampOffUntil = []; this.layout = 0;
      this.nextBombId = 1;
      this.mapId = MAPS[opts.mapId] ? opts.mapId : 'deserto';
      this.totalRounds = opts.rounds || 3;
      this.players = new Map();
      this.bullets = [];
      this.time = 0;
      this.nextBulletId = 1;
      this.events = [];
      this.phase = this.mode === 'sandbox' ? 'playing' : 'waiting';
      this.phaseUntil = 0;
      this.round = 0;
      this.score = { A: 0, B: 0 };
      this.matchWinner = null;
      this.lightStart = 0;
      this.buildMap();
    }

    isDM() { return this.gameMode === 'tdm' || this.gameMode === 'ffa' || this.gameMode === 'koth'; }
    teamMode() { return this.gameMode === 'tdm' || this.gameMode === 'koth'; }

    // Rei da colina: a cada hillMoveEvery segundos a área vai para um lugar sorteado, mas equilibrado:
    // perto do ponto médio entre os dois times (1x1 = meio entre os 2; 2x2+ = meio entre os centros das duplas),
    // puxado para o centro do mapa e escolhendo, entre vários sorteios, um que fique a distância parecida dos dois lados.
    // Só é sorteado quando a área atual termina (ninguém sabe antes onde será a próxima).
    pickHillSpot(prev) {
      const c = this.cfg, W = c.mapWidth, H = c.mapHeight, R = c.hillRadius;
      const cen = { A: [0, 0, 0], B: [0, 0, 0] };
      for (const p of this.players.values()) {
        const k = cen[p.team]; if (!k) continue;
        // morto conta como se estivesse no lado do time (vai renascer lá)
        const x = p.alive ? p.x : (p.team === 'A' ? 0.1 : 0.9) * W, y = p.alive ? p.y : H / 2;
        k[0] += x; k[1] += y; k[2]++;
      }
      const ca = cen.A[2] ? [cen.A[0] / cen.A[2], cen.A[1] / cen.A[2]] : [0.1 * W, H / 2];
      const cb = cen.B[2] ? [cen.B[0] / cen.B[2], cen.B[1] / cen.B[2]] : [0.9 * W, H / 2];
      // alvo: 60% ponto médio dos times + 40% centro do mapa (nunca escorrega muito pra um lado)
      const mx = ((ca[0] + cb[0]) / 2) * 0.6 + (W / 2) * 0.4, my = ((ca[1] + cb[1]) / 2) * 0.6 + (H / 2) * 0.4;
      const minX = W * 0.32, maxX = W * 0.68, minY = R + c.wallThickness + 20, maxY = H - R - c.wallThickness - 20;
      let best = null, bestScore = Infinity;
      for (let i = 0; i < 40; i++) {
        const ang = Math.random() * Math.PI * 2, d = Math.random() * Math.min(W, H) * 0.32;
        const x = clamp(mx + Math.cos(ang) * d, minX, maxX), y = clamp(my + Math.sin(ang) * d, minY, maxY);
        if (!circleFree(x, y, 30, this.wallsAll, c)) continue;
        // equilíbrio: diferença de distância até cada time e até cada lado de nascimento
        const da = Math.hypot(x - ca[0], y - ca[1]), db = Math.hypot(x - cb[0], y - cb[1]);
        const sa = x, sb = W - x;
        let score = Math.abs(da - db) + Math.abs(sa - sb) * 0.4;
        if (prev && Math.hypot(x - prev.x, y - prev.y) < R * 1.6) score += 1e4; // não repetir o mesmo lugar
        score += Math.random() * 60; // um pouco de sorte entre os bons candidatos
        if (score < bestScore) { bestScore = score; best = { x, y }; }
      }
      return best || { x: W / 2, y: H / 2 };
    }
    hillState() {
      if (this.gameMode !== 'koth') return null;
      const c = this.cfg;
      const el = Math.max(0, this.time - this.lightStart);
      const idx = Math.floor(el / c.hillMoveEvery);
      if (!this.hill || this.hill.idx !== idx) {
        const pos = this.pickHillSpot(this.hill);
        this.hill = { idx, x: pos.x, y: pos.y };
      }
      return { idx, x: this.hill.x, y: this.hill.y, r: c.hillRadius, n: c.hillMoveEvery - (el - idx * c.hillMoveEvery) };
    }
    updateHill(dt) {
      if (this.gameMode !== 'koth' || this.phase !== 'playing') { this.hillOwner = null; return; }
      const H = this.hillState();
      const inside = { A: 0, B: 0 };
      for (const p of this.players.values()) {
        if (!p.alive || p.jump) continue;
        if (Math.hypot(p.x - H.x, p.y - H.y) <= H.r) inside[p.team]++;
      }
      const owner = inside.A && !inside.B ? 'A' : inside.B && !inside.A ? 'B' : inside.A && inside.B ? 'X' : null;
      if (owner === 'A' || owner === 'B') this.score[owner] += dt * this.cfg.hillPointsPerSec;
      this.hillOwner = owner;
    }
    // "time" usado para amigo/inimigo: no cada-um-por-si cada jogador é o seu próprio time
    teamKey(p) { return this.gameMode === 'ffa' ? p.id : p.team; }
    isEnemy(p, q) { return p !== q && this.teamKey(p) !== this.teamKey(q); }
    protectedNow(p) { return this.time < (p.protectUntil || 0); }

    isDark() { return !!(MAPS[this.mapId] && MAPS[this.mapId].dark); }

    hazardType() { return (MAPS[this.mapId] && MAPS[this.mapId].hazard) || null; }
    hazardsOn() { return this.mode === 'sandbox' || this.phase === 'playing'; }

    // ciclo genérico: espera (s=0) -> aviso (s=1, dura 'pre') -> efeito (s=2, dura 'dur') -> repete
    cycle(interval, pre, dur) {
      const period = interval + dur;
      const el = this.time - this.lightStart;
      if (!this.hazardsOn() || el < 0) return { idx: -1, s: 0, n: interval, k: 0 };
      const idx = Math.floor(el / period), t = el - idx * period;
      if (t < interval - pre) return { idx, s: 0, n: interval - t, k: 0 };
      if (t < interval) return { idx, s: 1, n: interval - t, k: pre > 0 ? (t - (interval - pre)) / pre : 1 };
      return { idx, s: 2, n: 0, k: (t - interval) / dur };
    }

    // ciclo da luz na sala escura: s=0 acesa, s=1 piscando, s=2 apagada; n = segundos até apagar
    lightState() {
      if (!this.isDark()) return null;
      const c = this.cfg, cy = this.cycle(c.lightsInterval, c.lightsFlicker, c.lightsOffDuration);
      return { n: cy.n, s: cy.s };
    }

    applySlow(p, factor, dur, kind) {
      if (this.time >= p.slowUntil || factor <= p.slowF) { p.slowF = factor; p.slowKind = kind; }
      p.slowUntil = Math.max(p.slowUntil, this.time + dur);
    }
    speedMul(p) { return this.time < p.slowUntil ? p.slowF : 1; }

    // joga o jogador para outro lugar do mapa (furacão)
    toss(p) {
      const c = this.cfg, r = this.radiusOf(p);
      for (let i = 0; i < 24; i++) {
        const a = Math.random() * Math.PI * 2, d = c.tornadoThrow * (0.7 + Math.random() * 0.6);
        const tx = p.x + Math.cos(a) * d, ty = p.y + Math.sin(a) * d;
        if (circleFree(tx, ty, r, this.walls, c)) {
          p.jump = { sx: p.x, sy: p.y, tx, ty, t0: this.time, dur: c.tornadoAirTime, toss: true };
          this.events.push({ type: 'tossed', id: p.id });
          return true;
        }
      }
      return false;
    }

    // o furacão pega o jogador: ele gira dentro dele e depois é jogado longe
    catchSpin(p, T) {
      const c = this.cfg;
      if (c.tornadoSpinTime <= 0) return this.toss(p);
      const dx = p.x - T.x, dy = p.y - T.y;
      p.jump = { spin: true, t0: this.time, dur: c.tornadoSpinTime, cx: T.x, cy: T.y, ang: Math.atan2(dy, dx),
        r0: Math.hypot(dx, dy), r1: c.tornadoRadius * 0.35, toss: true };
      this.events.push({ type: 'caught', id: p.id });
      return true;
    }

    updateHazards(dt) {
      const hz = this.hazardType(), c = this.cfg, W = c.mapWidth, H = c.mapHeight;
      if (!this.hazardsOn()) { this.tornado = null; this.storm = null; this.sand = null; this.lavaOn = false; return; }
      const alive = [...this.players.values()].filter((p) => p.alive && !p.jump);

      if (hz === 'sand') {
        const cy = this.cycle(c.sandInterval, c.sandWarn, c.sandDuration);
        const bw = c.sandBand * W;
        // centro de cada parede de areia: sai do meio e vai até passar das laterais
        const d = cy.s === 2 ? cy.k * (W / 2 + bw) : 0;
        this.sand = cy.s === 0 ? null : { s: cy.s, k: cy.k, n: cy.n, d, w: bw };
      } else if (hz === 'tornado') {
        const cy = this.cycle(c.tornadoInterval, c.tornadoGrow, c.tornadoActive);
        if (cy.s === 0) { this.tornado = null; return; }
        let T = this.tornado;
        if (!T || T.idx !== cy.idx) {
          // nasce em um lugar aleatório livre
          let x = W / 2, y = H / 2;
          for (let i = 0; i < 40; i++) {
            const tx = c.wallThickness + c.tornadoRadius + Math.random() * (W - 2 * (c.wallThickness + c.tornadoRadius));
            const ty = c.wallThickness + c.tornadoRadius + Math.random() * (H - 2 * (c.wallThickness + c.tornadoRadius));
            if (circleFree(tx, ty, c.tornadoRadius * 0.5, this.walls, c)) { x = tx; y = ty; break; }
          }
          const a = Math.random() * Math.PI * 2;
          T = this.tornado = { idx: cy.idx, x, y, vx: Math.cos(a), vy: Math.sin(a), hit: new Set(), turn: 0 };
          this.events.push({ type: 'tornado_spawn', x, y });
        }
        T.s = cy.s; T.k = cy.k; T.n = cy.n;
        if (cy.s === 2) {
          // gira e anda pelo mapa, quicando nas bordas e mudando de rumo aos poucos
          T.turn += (Math.random() - 0.5) * 6 * dt;
          const ca = Math.cos(T.turn * dt), sa = Math.sin(T.turn * dt);
          const vx = T.vx * ca - T.vy * sa, vy = T.vx * sa + T.vy * ca;
          T.vx = vx; T.vy = vy;
          T.x += T.vx * c.tornadoSpeed * dt; T.y += T.vy * c.tornadoSpeed * dt;
          const m = c.wallThickness + c.tornadoRadius * 0.6;
          if (T.x < m) { T.x = m; T.vx = Math.abs(T.vx); } if (T.x > W - m) { T.x = W - m; T.vx = -Math.abs(T.vx); }
          if (T.y < m) { T.y = m; T.vy = Math.abs(T.vy); } if (T.y > H - m) { T.y = H - m; T.vy = -Math.abs(T.vy); }
          for (const p of alive) {
            if (T.hit.has(p.id)) continue;
            const r = this.radiusOf(p);
            if ((p.x - T.x) ** 2 + (p.y - T.y) ** 2 < (r + c.tornadoRadius) ** 2) { T.hit.add(p.id); this.catchSpin(p, T); }
          }
        }
      } else if (hz === 'lava') {
        this.updateLava(dt, alive);
      } else if (hz === 'meteor') {
        this.updateMeteors(dt, alive);
      } else if (hz === 'storm') {
        const cy = this.cycle(c.stormInterval, c.stormWarn, c.stormDuration);
        if (cy.s === 0) { this.storm = null; return; }
        const bandH = c.stormBand * H, x0 = 0, x1 = W; // mapa inteiro
        const y0 = cy.s === 2 ? -bandH + cy.k * (H + bandH) : -bandH;
        this.storm = { s: cy.s, k: cy.k, n: cy.n, x0, x1, y0, h: bandH };
        if (cy.s === 2) {
          for (const p of alive) {
            if (p.x > x0 && p.x < x1 && p.y > y0 && p.y < y0 + bandH) this.applySlow(p, c.freezeSlow, c.freezeTime, 2);
          }
        }
      }
    }

    // ---------- Vulcão ----------
    updateLava(dt, alive) {
      const c = this.cfg, W = c.mapWidth, H = c.mapHeight;
      const cy = this.cycle(c.lavaInterval, c.lavaWarn, c.lavaDuration);
      this.lavaCy = cy;
      if (cy.s === 0) { this.lavaOn = false; return; }
      if (!this.lava || this.lava.idx !== cy.idx) {
        // sorteia as poças do lado esquerdo e espelha no direito (justo para os dois times)
        const pools = [];
        for (let i = 0; i < c.lavaPairs; i++) {
          for (let tries = 0; tries < 30; tries++) {
            const r = c.lavaRadius * (0.75 + Math.random() * 0.5);
            const x = W * 0.14 + r + Math.random() * (W * 0.46 - W * 0.14 - r * 1.2), y = c.wallThickness + r + Math.random() * (H - 2 * (c.wallThickness + r));
            if (pools.some((q) => Math.hypot(q.x - x, q.y - y) < q.r + r + 20)) continue;
            pools.push({ x, y, r }, { x: W - x, y, r });
            break;
          }
        }
        this.lava = { idx: cy.idx, pools, lay: this.layout || 0, next: ((this.layout || 0) + 1) % 2 };
      }
      if (cy.s === 2 && !this.lavaOn) { // erupção: lava sobe e as paredes do meio trocam de lugar
        this.lavaOn = true;
        this.setLayout(this.lava.next);
        this.events.push({ type: 'lava', x: W / 2, y: H / 2 });
      }
      if (cy.s !== 2) { this.lavaOn = false; return; }
      for (const p of alive) {
        const r = this.radiusOf(p);
        if (this.lava.pools.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < q.r + r * 0.3)) this.damage(p, null, 'lava');
      }
    }
    // troca as paredes que mudam; quem ficou dentro de uma parede nova é empurrado para fora
    setLayout(lay) {
      const map = MAPS[this.mapId];
      if (!map || !map.layouts) return;
      this.layout = lay;
      this.wallsAll = buildWalls(this.mapId, this.cfg, lay);
      this.walls = this.wallsAll;
      for (const p of this.players.values()) {
        if (!p.alive) continue;
        const m = moveCircle(p.x, p.y, 0, 0, this.radiusOf(p), this.walls);
        p.x = m.x; p.y = m.y;
      }
    }

    // ---------- Nave espacial ----------
    updateMeteors(dt, alive) {
      const c = this.cfg, W = c.mapWidth, H = c.mapHeight;
      const cy = this.cycle(c.meteorInterval, c.meteorWarn, 0.4);
      this.holes = this.holes.filter((h) => this.time < h.until);
      if (cy.s >= 1 && (!this.meteor || this.meteor.idx !== cy.idx)) {
        // lugar sorteado do lado esquerdo; o outro cai no ponto espelhado do lado direito
        const R = c.holeRadius;
        let x = W * 0.3, y = H / 2;
        for (let i = 0; i < 40; i++) {
          const tx = W * 0.14 + R + Math.random() * (W * 0.47 - W * 0.14 - R), ty = H * 0.12 + R * 0.5 + Math.random() * (H * 0.76 - R);
          if (this.holes.some((h) => Math.hypot(h.x - tx, h.y - ty) < h.r + R)) continue;
          x = tx; y = ty; break;
        }
        this.meteor = { idx: cy.idx, pts: [[x, y], [W - x, y]], hit: false };
      }
      if (cy.s === 2 && this.meteor && !this.meteor.hit) {
        this.meteor.hit = true;
        for (const [x, y] of this.meteor.pts) {
          this.holes.push({ id: this.nextHoleId++, x, y, r: c.holeRadius, t0: this.time, until: this.time + c.holeTime });
          this.events.push({ type: 'explode', x, y });
          this.events.push({ type: 'meteor', x, y });
        }
      }
      if (cy.s === 0 && this.meteor && this.meteor.hit) this.meteor = null;
      // cair no buraco: a beira "segura" um pouco (dá tempo de sair); no meio cai rápido
      for (const p of alive) {
        let hole = null, d = 0;
        for (const h of this.holes) { const dd = Math.hypot(p.x - h.x, p.y - h.y); if (dd < h.r * this.holeK(h)) { hole = h; d = dd; break; } }
        if (!hole) { p.fallT = Math.max(0, (p.fallT || 0) - dt * 2); continue; }
        p.fallT = (p.fallT || 0) + dt * (d < hole.r * 0.45 ? 3 : 1);
        if (d > 1) { // puxa devagar para o meio
          const m = moveCircle(p.x, p.y, (hole.x - p.x) / d * c.holePull * dt, (hole.y - p.y) / d * c.holePull * dt, this.radiusOf(p), this.walls);
          p.x = m.x; p.y = m.y;
        }
        if (p.fallT >= c.holeGrace) {
          p.fallT = 0;
          p.lives = 1; p.invulnUntil = 0; p.protectUntil = 0;
          this.damage(p, null, 'fall');
          this.events.push({ type: 'fall', id: p.id, x: hole.x, y: hole.y });
        }
      }
    }
    holeK(h) { return Math.min(1, (this.time - h.t0) / 0.25, (h.until - this.time) / 0.6 + 0.2); } // abre rápido, fecha no fim

    // ---------- Cidade à noite ----------
    lampOn(i) { return !(this.lampOffUntil && this.time < (this.lampOffUntil[i] || 0)); }
    litAt(x, y) {
      const map = MAPS[this.mapId], c = this.cfg;
      if (!map || !map.lamps) return true;
      for (let i = 0; i < map.lamps.length; i++) {
        if (!this.lampOn(i)) continue;
        if (Math.hypot(map.lamps[i][0] * c.mapWidth - x, map.lamps[i][1] * c.mapHeight - y) < c.lampLight * 0.8) return true;
      }
      return false;
    }
    // p consegue ver q? (fumaça e escuro da cidade) — usado pelos bots
    canSee(p, q) {
      if (this.smokeBlocks(p.x, p.y, q.x, q.y)) return false;
      const map = MAPS[this.mapId];
      if (map && map.lamps) {
        const near = Math.hypot(p.x - q.x, p.y - q.y) < this.cfg.nightSee + 30;
        const flash = this.time - (q.fireReady || 0) + this.cfg.fireCooldown < 0.25; // atirou agora: o clarão aparece
        return near || flash || this.litAt(q.x, q.y);
      }
      return true;
    }
    // perigo no chão (lava / buraco) perto de (x, y)? devolve o centro dele
    dangerAt(x, y, m) {
      if (this.lava && this.lavaCy && this.lavaCy.s >= 1) for (const q of this.lava.pools) if (Math.hypot(x - q.x, y - q.y) < q.r + m) return q;
      for (const h of this.holes) if (Math.hypot(x - h.x, y - h.y) < h.r + m) return h;
      return null;
    }

    hazardSnapshot() {
      const hz = this.hazardType(), c = this.cfg;
      if (hz === 'city') {
        const map = MAPS[this.mapId];
        return { t: 'city', lo: map.lamps.map((_, i) => this.lampOn(i) ? 0 : r1(this.lampOffUntil[i] - this.time)) };
      }
      if (hz === 'lava') {
        const cy = this.cycle(c.lavaInterval, c.lavaWarn, c.lavaDuration), L = this.lava;
        const out = { t: 'lava', s: cy.s, n: r1(cy.n), k: Math.round(cy.k * 100) / 100, lay: this.layout || 0 };
        if (cy.s >= 1 && L && L.idx === cy.idx) { out.p = L.pools.map((q) => [r1(q.x), r1(q.y), r1(q.r)]); out.nl = L.next; }
        return out;
      }
      if (hz === 'meteor') {
        const cy = this.cycle(c.meteorInterval, c.meteorWarn, 0.4);
        const out = { t: 'meteor', s: cy.s, n: r1(cy.n), k: Math.round(cy.k * 100) / 100,
          h: this.holes.map((h) => [h.id, r1(h.x), r1(h.y), r1(h.r * this.holeK(h)), r1(h.until - this.time)]) };
        if (cy.s === 1 && this.meteor) out.m = this.meteor.pts.map((q) => [r1(q[0]), r1(q[1])]);
        return out;
      }
      if (hz === 'tornado') {
        const cy = this.cycle(c.tornadoInterval, c.tornadoGrow, c.tornadoActive);
        const T = this.tornado;
        if (!T || cy.s === 0) return { t: 'tornado', s: 0, n: r1(cy.n) };
        return { t: 'tornado', s: T.s, n: r1(T.n), k: r1(T.k * 100) / 100, x: r1(T.x), y: r1(T.y) };
      }
      if (hz === 'sand') {
        const cy = this.cycle(c.sandInterval, c.sandWarn, c.sandDuration);
        const S = this.sand;
        if (!S || cy.s === 0) return { t: 'sand', s: 0, n: r1(cy.n) };
        return { t: 'sand', s: S.s, n: r1(S.n), k: r1(S.k * 100) / 100, d: r1(S.d), w: r1(S.w) };
      }
      if (hz === 'storm') {
        const cy = this.cycle(c.stormInterval, c.stormWarn, c.stormDuration);
        const S = this.storm;
        if (!S || cy.s === 0) return { t: 'storm', s: 0, n: r1(cy.n) };
        return { t: 'storm', s: S.s, n: r1(S.n), k: r1(S.k * 100) / 100, x0: r1(S.x0), x1: r1(S.x1), y0: r1(S.y0), h: r1(S.h) };
      }
      return null;
    }

    buildMap() {
      this.wallsAll = buildWalls(this.mapId, this.cfg);             // portais fechados
      this.walls = this.wallsAll;
      this.portalPick = null;                                          // { k, pr } sorteio da abertura atual
    }
    hasPortals() { return !!(MAPS[this.mapId] && MAPS[this.mapId].portals); }
    portalState() {
      if (!this.hasPortals()) return null;
      if (!this.hazardsOn()) return { o: 0, n: 0 };
      const st = portalCycle(this.time - this.lightStart, this.cfg);
      if (st.o) {
        if (!this.portalPick || this.portalPick.k !== st.k) {
          const prev = this.portalPick && this.portalPick.pr;
          const list = portalList(MAPS[this.mapId]);
          const pr = st.k === -2 ? firstPortalPairs(list) : pickPortalPairs(list, prev);
          this.portalPick = { k: st.k, pr, walls: openWalls(this.wallsAll, pr) };
        }
        st.pr = this.portalPick.pr;
      }
      return st;
    }

    radiusOf(p) { return this.cfg.playerRadius * (p.lives >= this.cfg.lives ? 1 : this.cfg.hitShrink); }

    addPlayer(info) {
      const p = {
        id: info.id, name: info.name || 'Jogador', team: info.team === 'B' ? 'B' : 'A',
        x: 0, y: 0, fx: 1, fy: 0,
        input: { up: false, down: false, left: false, right: false, fire: false },
        stats: { k: 0, d: 0, a: 0 }, bot: !!info.bot, clientKnife: !!info.clientKnife
      };
      this.players.set(p.id, p);
      this.resetPlayer(p, this.teamSlot(p));
      return p;
    }

    removePlayer(id) { this.players.delete(id); }

    teamSlot(p) {
      let i = 0;
      for (const q of this.players.values()) { if (q === p) return i; if (q.team === p.team) i++; }
      return i;
    }

    resetPlayer(p, slot, keepJump) {
      const c = this.cfg;
      const oldJ = p.jumps, oldAt = p.jumpReadyAt;
      const s = spawnPos(p.team, slot, c);
      p.x = s.x; p.y = s.y;
      p.fx = p.team === 'A' ? 1 : -1; p.fy = 0;
      p.lives = c.lives; p.alive = true;
      p.blinkUntil = 0; p.invulnUntil = 0;
      p.weapon = 'gun'; p.ammo = c.magSize; p.mags = c.magazines;
      p.reloadUntil = 0; p.fireReady = 0; p.knifeReady = 0; p.knifeAnimUntil = 0;
      p.jumps = c.jumpStartReady ? 1 : 0;
      p.jumpReadyAt = this.time + (this.mode === 'match' ? c.roundStartDelay : 0) + c.jumpCooldown;
      p.jump = null; p.respawnAt = 0;
      p.slowUntil = 0; p.slowF = 1; p.slowKind = 0;
      p.bombs = c.bombCount; p.smokes = c.smokeCount; p.protectUntil = 0;
      // morrer não perde o pulo: se estava carregado continua carregado; se estava carregando, continua de onde parou
      if (keepJump && oldAt != null) { p.jumps = oldJ >= 1 ? 1 : 0; p.jumpReadyAt = oldAt; }
    }

    // renascer (mata-mata / teste): posição longe dos inimigos e 1 s de proteção
    respawn(p) {
      const c = this.cfg, st = p.stats;
      this.resetPlayer(p, this.teamSlot(p), true);
      p.stats = st;
      if (this.mode !== 'sandbox') {
        const pos = this.farSpawn(p);
        p.x = pos.x; p.y = pos.y;
        p.protectUntil = this.time + c.spawnProtect;
        this.events.push({ type: 'respawn', id: p.id });
      }
    }

    // ponto livre o mais longe possível dos inimigos vivos
    farSpawn(p) {
      const c = this.cfg, r = c.playerRadius, m = c.wallThickness + r + 4;
      const enemies = [...this.players.values()].filter((q) => q.alive && this.isEnemy(p, q));
      let best = null, bestScore = -1;
      for (let i = 0; i < 60; i++) {
        let x, y;
        if (this.teamMode()) { // no seu lado do mapa
          const half = c.mapWidth / 2;
          x = (p.team === 'A' ? m : half) + Math.random() * (half - m);
          y = m + Math.random() * (c.mapHeight - 2 * m);
        } else {
          x = m + Math.random() * (c.mapWidth - 2 * m);
          y = m + Math.random() * (c.mapHeight - 2 * m);
        }
        if (!circleFree(x, y, r, this.walls, c) || this.dangerAt(x, y, r + 20)) continue;
        let score = 1e9;
        for (const q of enemies) score = Math.min(score, Math.hypot(q.x - x, q.y - y));
        if (score > bestScore) { bestScore = score; best = { x, y }; }
      }
      return best || spawnPos(p.team, 0, c);
    }

    // bomba: lança até o ponto (limitado pelo alcance); voa por cima dos muros e explode
    throwBomb(id, tx, ty, kind) {
      const p = this.players.get(id), c = this.cfg, smoke = kind === 'smoke';
      if (!p || !p.alive || p.jump || (smoke ? p.smokes : p.bombs) < 1 || !this.canAct() || this.protectedNow(p)) return false;
      if (!isFinite(tx) || !isFinite(ty)) return false;
      let dx = tx - p.x, dy = ty - p.y;
      const d = Math.hypot(dx, dy);
      if (d > c.bombRange) { dx *= c.bombRange / d; dy *= c.bombRange / d; }
      const m = c.wallThickness + 4;
      const ex = Math.min(c.mapWidth - m, Math.max(m, p.x + dx)), ey = Math.min(c.mapHeight - m, Math.max(m, p.y + dy));
      if (smoke) p.smokes--; else p.bombs--;
      this.bombs.push({ id: this.nextBombId++, owner: p.id, team: this.teamKey(p), sx: p.x, sy: p.y, tx: ex, ty: ey, smoke,
        t0: this.time, flight: c.bombFlight * (0.5 + 0.5 * Math.hypot(ex - p.x, ey - p.y) / c.bombRange), fuse: c.bombFuse });
      this.events.push({ type: smoke ? 'smoke_throw' : 'bomb_throw', id: p.id });
      return true;
    }

    updateBombs() {
      const c = this.cfg, keep = [];
      for (const b of this.bombs) {
        if (this.time < b.t0 + b.flight + b.fuse) { keep.push(b); continue; }
        if (b.smoke) { // fumaça: não machuca ninguém, só abre a cortina
          this.smokes.push({ id: b.id, x: b.tx, y: b.ty, t0: this.time, until: this.time + c.smokeTime });
          this.events.push({ type: 'smoke', x: b.tx, y: b.ty });
          continue;
        }
        // explode: tira 1 vida de cada inimigo no raio (muro protege)
        for (const q of this.players.values()) {
          if (!q.alive || q.jump || this.teamKey(q) === b.team || this.protectedNow(q)) continue;
          const d = Math.hypot(q.x - b.tx, q.y - b.ty);
          if (d > c.bombRadius + this.radiusOf(q)) continue;
          if (lineBlocked(b.tx, b.ty, q.x, q.y, this.walls)) continue;
          this.damage(q, b.owner, 'bomb');
        }
        this.events.push({ type: 'explode', x: b.tx, y: b.ty });
      }
      this.bombs = keep;
      this.smokes = this.smokes.filter((m) => this.time < m.until);
    }
    // a linha entre dois pontos passa pelo miolo fechado de alguma fumaça? (bots não enxergam através)
    smokeBlocks(x1, y1, x2, y2) {
      const c = this.cfg, R = c.smokeRadius * c.smokeCore;
      for (const m of this.smokes) {
        const k = this.smokeGrow(m); if (k < 0.6) continue;
        const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1;
        const u = Math.max(0, Math.min(1, ((m.x - x1) * dx + (m.y - y1) * dy) / L2));
        if (Math.hypot(x1 + dx * u - m.x, y1 + dy * u - m.y) < R * k) return true;
      }
      return false;
    }
    // 0..1: fumaça crescendo no começo e sumindo no fim
    smokeGrow(m) {
      const t = this.time;
      return Math.max(0, Math.min(1, (t - m.t0) / 0.35, (m.until - t) / 0.8));
    }

    setInput(id, inp) {
      const p = this.players.get(id);
      if (!p || !inp) return;
      p.input = { up: !!inp.up, down: !!inp.down, left: !!inp.left, right: !!inp.right, fire: !!inp.fire };
    }

    // mira (direção do mouse em volta do personagem)
    setAim(id, ax, ay) {
      const p = this.players.get(id);
      if (!p || !isFinite(ax) || !isFinite(ay)) return;
      const l = Math.hypot(ax, ay);
      if (l < 1e-6) return;
      p.ax = ax / l; p.ay = ay / l; p.hasAim = true;
    }

    canAct() { return this.mode === 'sandbox' || this.phase === 'playing'; }

    setWeapon(id, w) {
      const p = this.players.get(id);
      if (!p || !p.alive) return;
      p.weapon = w === 'knife' ? 'knife' : 'gun';
    }

    requestReload(id) {
      const p = this.players.get(id);
      if (p && p.alive) this.startReload(p);
    }

    startReload(p) {
      if (p.reloadUntil || p.mags <= 0 || p.ammo >= this.cfg.magSize) return;
      p.reloadUntil = this.time + this.cfg.reloadTime;
    }

    requestJump(id) {
      const p = this.players.get(id);
      if (!p || !p.alive || p.jump || p.jumps < 1 || !this.canAct()) return false;
      const c = this.cfg, r = this.radiusOf(p), D = c.jumpDistance;
      // pula para onde está andando; parado, pula para onde está mirando
      let dx = (p.input.right ? 1 : 0) - (p.input.left ? 1 : 0), dy = (p.input.down ? 1 : 0) - (p.input.up ? 1 : 0);
      if (!dx && !dy) { dx = p.fx; dy = p.fy; }
      const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      let target = null;
      for (let d = D; d <= D * 1.8 && !target; d += 6) {
        const tx = p.x + dx * d, ty = p.y + dy * d;
        if (circleFree(tx, ty, r, this.walls, c)) target = { x: tx, y: ty };
      }
      for (let d = D - 6; d >= r && !target; d -= 6) {
        const tx = p.x + dx * d, ty = p.y + dy * d;
        if (circleFree(tx, ty, r, this.walls, c)) target = { x: tx, y: ty };
      }
      if (!target) return false;
      p.jump = { sx: p.x, sy: p.y, tx: target.x, ty: target.y, t0: this.time, dur: c.jumpDuration };
      p.jumps = 0;
      p.jumpReadyAt = this.time + c.jumpCooldown; // contagem só começa quando gasta o pulo
      this.events.push({ type: 'jump', id: p.id });
      return true;
    }

    startMatch() {
      this.score = { A: 0, B: 0 };
      this.round = 0;
      this.matchWinner = null;
      this.bullets = [];
      for (const p of this.players.values()) p.stats = { k: 0, d: 0, a: 0 };
      this.startRound();
    }

    startRound() {
      this.round++;
      this.bullets = []; this.bombs = []; this.smokes = [];
      const slots = { A: 0, B: 0 };
      for (const p of this.players.values()) this.resetPlayer(p, slots[p.team]++, this.round > 1);
      if (this.gameMode === 'ffa') { // cada um nasce longe dos outros
        const placed = [];
        for (const p of this.players.values()) { p.alive = false; }
        for (const p of this.players.values()) { const pos = this.farSpawn(p); p.x = pos.x; p.y = pos.y; p.alive = true; placed.push(p); }
      }
      this.phase = 'countdown';
      this.phaseUntil = this.time + this.cfg.roundStartDelay;
      this.lightStart = this.phaseUntil;
      this.tornado = null; this.storm = null; this.sand = null;
      this.hill = null; this.portalPick = null;
      this.holes = []; this.meteor = null; this.lava = null; this.lavaOn = false; this.lampOffUntil = [];
      if (MAPS[this.mapId] && MAPS[this.mapId].layouts && this.layout) this.setLayout(0);
      this.events.push({ type: 'round_start', round: this.round });
    }

    step(dt) {
      this.time += dt;
      const c = this.cfg;
      if (this.phase === 'countdown' && this.time >= this.phaseUntil) {
        this.phase = 'playing';
        this.events.push({ type: 'go' });
      }
      const act = this.canAct();
      this.portalNow = null;
      if (this.hasPortals()) { const ps = this.portalState(); this.portalNow = ps; this.walls = ps.o ? this.portalPick.walls : this.wallsAll; }
      for (const p of this.players.values()) this.updatePlayer(p, dt, act);
      this.updateHazards(dt);
      this.updateBullets(dt);
      this.updateBombs();
      this.updateHill(dt);

      if (this.mode === 'sandbox' || (this.isDM() && this.phase === 'playing')) {
        for (const p of this.players.values()) {
          if (!p.alive && p.respawnAt && this.time >= p.respawnAt) this.respawn(p);
        }
        if (this.mode !== 'sandbox') this.checkDMEnd();
      } else if (this.isDM()) {
        // (fim de partida do mata-mata é tratado em checkDMEnd)
      } else {
        if (this.phase === 'playing') this.checkRoundEnd();
        else if (this.phase === 'roundEnd' && this.time >= this.phaseUntil) {
          if (this.isMatchOver()) this.endMatch();
          else this.startRound();
        }
      }
      const ev = this.events;
      this.events = [];
      return ev;
    }

    updatePlayer(p, dt, act) {
      const c = this.cfg;
      if (p.jumps < 1 && this.time >= p.jumpReadyAt) p.jumps = 1;
      if (p.reloadUntil && this.time >= p.reloadUntil) {
        p.reloadUntil = 0; p.ammo = c.magSize; p.mags--;
        this.events.push({ type: 'reloaded', id: p.id });
      }
      if (!p.alive) return;
      if (p.jump && p.jump.spin) {
        // girando dentro do furacão antes de ser jogado
        const j = p.jump, t = (this.time - j.t0) / j.dur;
        const T = this.tornado;
        if (T) { j.cx = T.x; j.cy = T.y; }
        j.ang += dt * 14;
        const rr = j.r0 + (j.r1 - j.r0) * Math.min(1, t);
        p.x = j.cx + Math.cos(j.ang) * rr; p.y = j.cy + Math.sin(j.ang) * rr;
        if (t >= 1) {
          p.jump = null;
          const c = this.cfg; p.x = Math.min(c.mapWidth - c.wallThickness - 1, Math.max(c.wallThickness + 1, p.x));
          p.y = Math.min(c.mapHeight - c.wallThickness - 1, Math.max(c.wallThickness + 1, p.y));
          if (!this.toss(p)) { // sem lugar para cair: solta onde está livre mais perto
            const m = moveCircle(p.x, p.y, 0, 0, this.radiusOf(p), this.walls); p.x = m.x; p.y = m.y;
          }
        }
        return;
      }
      if (p.jump) {
        const j = p.jump, t = (this.time - j.t0) / j.dur;
        if (t >= 1) { p.x = j.tx; p.y = j.ty; p.jump = null; this.events.push({ type: 'land', id: p.id }); }
        else { p.x = j.sx + (j.tx - j.sx) * t; p.y = j.sy + (j.ty - j.sy) * t; }
        return;
      }
      if (p.hasAim) { p.fx = p.ax; p.fy = p.ay; }
      if (!act) return;
      const inp = p.input;
      let mx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      let my = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
      if (mx || my) {
        const l = Math.hypot(mx, my); mx /= l; my /= l;
        if (!p.hasAim) { p.fx = mx; p.fy = my; }
        const sp = c.playerSpeed * this.speedMul(p);
        const m = moveCircle(p.x, p.y, mx * sp * dt, my * sp * dt, this.radiusOf(p), this.walls);
        p.x = m.x; p.y = m.y;
        if (this.portalNow && this.portalNow.o) {
          const w = portalWrap(this.mapId, c, p.x, p.y, this.radiusOf(p), this.portalNow.pr);
          if (w) { p.x = w.x; p.y = w.y; this.events.push({ type: 'portal', id: p.id, x: w.x, y: w.y }); }
        }
      }
      if (inp.fire && !this.protectedNow(p)) {
        if (p.weapon === 'gun') this.tryShoot(p);
        else if (!p.clientKnife) this.tryKnife(p);
      }
    }

    tryShoot(p) {
      const c = this.cfg;
      if (p.reloadUntil) return;
      if (p.ammo <= 0) {
        if (p.mags > 0) this.startReload(p);
        else p.weapon = 'knife';
        return;
      }
      if (this.time < p.fireReady) return;
      const r = this.radiusOf(p);
      let bx = p.x + p.fx * (r + c.bulletRadius + 2), by = p.y + p.fy * (r + c.bulletRadius + 2);
      if (lineBlocked(p.x, p.y, bx, by, this.walls)) { bx = p.x; by = p.y; }
      this.bullets.push({ id: this.nextBulletId++, x: bx, y: by, vx: p.fx * c.bulletSpeed, vy: p.fy * c.bulletSpeed,
        team: this.teamKey(p), owner: p.id, hits: 0, t0: this.time });
      p.ammo--;
      p.fireReady = this.time + c.fireCooldown;
      this.events.push({ type: 'shot', id: p.id });
      if (p.ammo <= 0) {
        if (p.mags > 0) this.startReload(p);
        else { p.weapon = 'knife'; this.events.push({ type: 'out_of_ammo', id: p.id }); }
      }
    }

    // golpe de faca calculado pelo servidor (bots e /teste)
    tryKnife(p) {
      const c = this.cfg;
      if (this.time < p.knifeReady) return;
      p.knifeReady = this.time + c.knifeCooldown;
      p.knifeAnimUntil = this.time + 0.18;
      p.knifeAng = Math.atan2(p.fy, p.fx);
      this.events.push({ type: 'knife', id: p.id });
      const targets = [];
      for (const q of this.players.values()) {
        if (!this.isEnemy(p, q) || !q.alive || q.jump || this.protectedNow(q)) continue;
        targets.push({ id: q.id, x: q.x, y: q.y, r: this.radiusOf(q) });
      }
      const hit = knifeTarget(p.x, p.y, this.radiusOf(p), p.fx, p.fy, targets, c, this.walls);
      if (hit) this.damage(this.players.get(hit), p.id, 'knife');
    }

    // golpe de faca de um jogador humano: o navegador diz quem ele acertou
    // (o que ele viu na tela) e o servidor só confere se é possível
    knifeSwing(id, targetId, ax, ay) {
      const p = this.players.get(id), c = this.cfg;
      if (!p || !p.alive || p.jump || p.weapon !== 'knife' || !this.canAct() || this.protectedNow(p)) return;
      if (this.time < p.knifeReady - 0.12) return; // tolerância de rede
      p.knifeReady = this.time + c.knifeCooldown;
      p.knifeAnimUntil = this.time + 0.18;
      if (isFinite(ax) && isFinite(ay) && (ax || ay)) { const l = Math.hypot(ax, ay); p.fx = ax / l; p.fy = ay / l; }
      p.knifeAng = Math.atan2(p.fy, p.fx);
      this.events.push({ type: 'knife', id: p.id });
      const q = targetId && this.players.get(targetId);
      if (!q || !this.isEnemy(p, q) || !q.alive || q.jump || this.protectedNow(q)) return;
      const reach = this.radiusOf(p) + c.knifeRange + this.radiusOf(q);
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d > reach * 1.5 + 60) return; // longe demais até considerando o atraso da rede
      if (lineBlocked(p.x, p.y, q.x, q.y, this.walls) && d > reach) return;
      this.damage(q, p.id, 'knife');
    }

    damage(v, attackerId, weapon) {
      const c = this.cfg;
      if (this.time < v.invulnUntil || this.protectedNow(v)) return false;
      const a = this.players.get(attackerId);
      v.lives--;
      v.blinkUntil = this.time + c.blinkDuration;
      v.invulnUntil = this.time + c.invulnDuration;
      if (v.lives <= 0) {
        v.alive = false; v.jump = null; v.reloadUntil = 0;
        v.stats.d++;
        if (a) a.stats.k++;
        if (this.mode === 'sandbox') v.respawnAt = this.time + 2;
        else if (this.isDM()) {
          v.respawnAt = this.time + c.respawnDelay;
          if (a && this.gameMode === 'tdm' && a.team !== v.team) this.score[a.team]++;
        }
        this.events.push({ type: 'kill', killer: attackerId, victim: v.id, weapon, x: v.x, y: v.y });
      } else {
        if (a) a.stats.a++; // assistência: acertou mas não matou
        this.events.push({ type: 'hit', by: attackerId, victim: v.id, weapon, x: v.x, y: v.y });
      }
      return true;
    }

    updateBullets(dt) {
      const c = this.cfg, br = c.bulletRadius;
      const stepLen = Math.max(1, Math.min(br, c.wallThickness / 2) * 0.8);
      const out = [];
      for (const b of this.bullets) {
        let dead = false;
        const dist = Math.hypot(b.vx, b.vy) * dt;
        const n = Math.max(1, Math.ceil(dist / stepLen));
        const sub = dt / n;
        for (let i = 0; i < n && !dead; i++) {
          b.x += b.vx * sub; b.y += b.vy * sub;
          // portal: atravessa para o outro lado sem contar como batida
          if (this.portalNow && this.portalNow.o) {
            const w = portalWrap(this.mapId, c, b.x, b.y, br, this.portalNow.pr);
            if (w) { b.x = w.x; b.y = w.y; const vx = b.vx; b.vx = vx * w.co - b.vy * w.si; b.vy = vx * w.si + b.vy * w.co; b.warped = true; }
          }
          // buraco da nave: a bala é sugada, não importa quantas batidas ainda tem
          if (this.holes.length && this.holes.some((h) => Math.hypot(b.x - h.x, b.y - h.y) < h.r * this.holeK(h) * 0.9)) {
            this.events.push({ type: 'sucked', x: b.x, y: b.y }); dead = true; break;
          }
          for (const R of this.walls) {
            const col = circleRect(b.x, b.y, br, R);
            if (!col) continue;
            if (R.lamp != null) { // tiro no poste: apaga a luz
              this.lampOffUntil[R.lamp] = this.time + c.lampOff;
              this.events.push({ type: 'lamp_off', x: R.x + R.w / 2, y: R.y + R.h / 2 });
              dead = true; break;
            }
            const dot = b.vx * col.nx + b.vy * col.ny;
            if (dot < 0) { b.vx -= 2 * dot * col.nx; b.vy -= 2 * dot * col.ny; }
            b.x = col.x + col.nx * 0.01; b.y = col.y + col.ny * 0.01;
            b.hits++;
            this.events.push({ type: 'bounce', x: b.x, y: b.y, left: c.maxBounces - b.hits });
            if (b.hits >= c.maxBounces) dead = true;
            break;
          }
          if (dead) break;
          for (const p of this.players.values()) {
            if (!p.alive || p.jump || this.teamKey(p) === b.team || this.protectedNow(p)) continue; // sem fogo amigo
            const r = this.radiusOf(p);
            if ((p.x - b.x) ** 2 + (p.y - b.y) ** 2 < (r + br) ** 2) {
              this.damage(p, b.owner, 'gun');
              dead = true;
              break;
            }
          }
        }
        if (!dead && this.time - b.t0 < 15) out.push(b);
      }
      this.bullets = out;
    }

    checkRoundEnd() {
      let aA = 0, aB = 0;
      for (const p of this.players.values()) if (p.alive) { if (p.team === 'A') aA++; else aB++; }
      const timeUp = this.time - this.lightStart >= this.cfg.roundTime;
      if (aA > 0 && aB > 0 && !timeUp) return;
      const winner = timeUp && aA > 0 && aB > 0 ? null : aA > 0 ? 'A' : aB > 0 ? 'B' : null; // tempo acabou = empate
      if (winner) this.score[winner]++;
      this.phase = 'roundEnd';
      this.phaseUntil = this.time + this.cfg.roundEndDelay;
      this.bullets = [];
      this.events.push({ type: 'round_end', winner, timeUp: timeUp && !!(aA && aB), score: Object.assign({}, this.score), round: this.round });
    }

    // mata-mata: acaba no tempo ou quando alguém chega no limite de abates
    checkDMEnd() {
      const timeUp = this.time - this.lightStart >= this.matchTime;
      let reached = false;
      if (this.gameMode === 'tdm') reached = this.score.A >= this.killLimit || this.score.B >= this.killLimit;
      else if (this.gameMode === 'koth') reached = this.score.A >= this.hillTarget || this.score.B >= this.hillTarget;
      else for (const p of this.players.values()) if (p.stats.k >= this.killLimit) reached = true;
      if (!timeUp && !reached) return;
      this.phase = 'matchEnd';
      this.bullets = []; this.bombs = []; this.smokes = [];
      let winner = null;
      if (this.teamMode()) {
        const a = Math.floor(this.score.A), b = Math.floor(this.score.B);
        winner = a > b ? 'A' : b > a ? 'B' : null;
      }
      else {
        const ranked = [...this.players.values()].sort((a, b) => b.stats.k - a.stats.k || a.stats.d - b.stats.d);
        if (ranked.length && (ranked.length < 2 || ranked[0].stats.k > ranked[1].stats.k)) winner = ranked[0].id;
      }
      this.matchWinner = winner;
      const sc = { A: Math.floor(this.score.A), B: Math.floor(this.score.B) };
      this.events.push({ type: 'match_end', winner, mode: this.gameMode, timeUp, score: sc });
    }

    isMatchOver() {
      const need = Math.floor(this.totalRounds / 2) + 1; // mais de 50% dos rounds
      return this.score.A >= need || this.score.B >= need || this.round >= this.totalRounds;
    }

    endMatch() {
      this.phase = 'matchEnd';
      const s = this.score;
      this.matchWinner = s.A > s.B ? 'A' : s.B > s.A ? 'B' : null; // null = empate
      this.events.push({ type: 'match_end', winner: this.matchWinner, mode: 'rounds', score: Object.assign({}, s) });
    }

    snapshot() {
      const t = this.time;
      const ps = [];
      for (const p of this.players.values()) {
        ps.push({
          id: p.id, x: r1(p.x), y: r1(p.y), fx: r1(p.fx), fy: r1(p.fy), tm: p.team,
          l: p.lives, al: p.alive ? 1 : 0, r: r1(this.radiusOf(p)),
          bl: t < p.blinkUntil ? 1 : 0, w: p.weapon === 'gun' ? 1 : 2, am: p.ammo, mg: p.mags,
          rl: p.reloadUntil ? r1(p.reloadUntil - t) : 0,
          j: p.jumps, jc: p.jumps ? 0 : r1(Math.max(0, p.jumpReadyAt - t)),
          jz: p.jump ? (p.jump.spin ? 0.12 : Math.min(1, (t - p.jump.t0) / p.jump.dur)) : -1,
          ka: t < p.knifeAnimUntil ? 1 : 0, kd: t < p.knifeAnimUntil ? Math.round(p.knifeAng * 100) / 100 : 0,
          fc: Math.round(Math.max(0, p.fireReady - t) * 100) / 100,
          bo: p.bombs, so: p.smokes, sp: this.protectedNow(p) ? 1 : 0,
          rs: !p.alive && p.respawnAt ? r1(Math.max(0, p.respawnAt - t)) : 0,
          sl: t < p.slowUntil ? p.slowF : 1, sk: t < p.slowUntil ? p.slowKind : 0,
          ts: p.jump && p.jump.toss ? 1 : 0, fa: p.fallT ? Math.round(Math.min(1, p.fallT / this.cfg.holeGrace) * 100) / 100 : 0,
          st: [p.stats.k, p.stats.d, p.stats.a]
        });
      }
      return {
        t: Math.round(t * 1000) / 1000, ph: this.phase, pu: r1(Math.max(0, this.phaseUntil - t)), rd: this.round,
        tr: this.totalRounds, sc: this.gameMode === 'koth' ? { A: Math.floor(this.score.A), B: Math.floor(this.score.B) } : this.score, map: this.mapId, lg: this.lightState(), hz: this.hazardSnapshot(), pt: this.portalState(),
        rt: this.mode === 'match' && this.phase === 'playing' ? r1(Math.max(0, (this.isDM() ? this.matchTime : this.cfg.roundTime) - (t - this.lightStart))) : null,
        md: this.gameMode, kl: this.gameMode === 'koth' ? this.hillTarget : this.killLimit,
        hl: this.gameMode === 'koth' ? (() => { const H = this.hillState(); return { x: r1(H.x), y: r1(H.y), r: H.r, n: r1(H.n), o: this.hillOwner || null }; })() : null,
        p: ps, b: this.bullets.map((b) => [b.id, r1(b.x), r1(b.y), b.hits, b.team]),
        bm: this.bombs.map((b) => {
          const k = Math.min(1, (t - b.t0) / b.flight);
          return [b.id, r1(b.sx + (b.tx - b.sx) * k), r1(b.sy + (b.ty - b.sy) * k), Math.round(k * 100) / 100, b.team,
            r1(Math.max(0, b.t0 + b.flight + b.fuse - t)), b.smoke ? 1 : 0];
        }),
        sm: this.smokes.map((m) => [m.id, r1(m.x), r1(m.y), Math.round(this.smokeGrow(m) * 100) / 100])
      };
    }
  }

  return { Game, buildWalls, moveCircle, circleFree, circleRect, lineBlocked, spawnPos, knifeTarget, portalWrap, portalCycle, portalList, portalGeom, openWalls, pickPortalPairs };
});
