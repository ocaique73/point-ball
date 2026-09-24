// Simulação do jogo (autoritativa no servidor, e usada localmente na página /teste).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./config'), require('./maps'));
  else root.RC_GAME = factory(root.RC_CONFIG, root.RC_MAPS);
})(typeof self !== 'undefined' ? self : this, function (CONFIG, MAPSMOD) {
  const { MAPS, SPAWNS_Y, SPAWN_X } = MAPSMOD;

  // ---------------- Física ----------------
  function buildWalls(mapId, cfg) {
    const map = MAPS[mapId] || MAPS.deserto;
    const W = cfg.mapWidth, H = cfg.mapHeight, t = cfg.wallThickness;
    const rects = [
      { x: 0, y: 0, w: W, h: t, border: true },
      { x: 0, y: H - t, w: W, h: t, border: true },
      { x: 0, y: 0, w: t, h: H, border: true },
      { x: W - t, y: 0, w: t, h: H, border: true }
    ];
    for (const s of map.walls) {
      const x1 = s[0] * W, y1 = s[1] * H, x2 = s[2] * W, y2 = s[3] * H;
      const minx = Math.min(x1, x2), miny = Math.min(y1, y2);
      rects.push({ x: minx - t / 2, y: miny - t / 2, w: Math.abs(x2 - x1) + t, h: Math.abs(y2 - y1) + t });
    }
    return rects;
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
      if (!this.hazardsOn()) { this.tornado = null; this.storm = null; this.sand = null; return; }
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

    hazardSnapshot() {
      const hz = this.hazardType(), c = this.cfg;
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

    buildMap() { this.walls = buildWalls(this.mapId, this.cfg); }

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

    resetPlayer(p, slot) {
      const c = this.cfg;
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
      this.bullets = [];
      const slots = { A: 0, B: 0 };
      for (const p of this.players.values()) this.resetPlayer(p, slots[p.team]++);
      this.phase = 'countdown';
      this.phaseUntil = this.time + this.cfg.roundStartDelay;
      this.lightStart = this.phaseUntil;
      this.tornado = null; this.storm = null; this.sand = null;
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
      for (const p of this.players.values()) this.updatePlayer(p, dt, act);
      this.updateHazards(dt);
      this.updateBullets(dt);

      if (this.mode === 'sandbox') {
        for (const p of this.players.values()) {
          if (!p.alive && p.respawnAt && this.time >= p.respawnAt) {
            const st = p.stats; this.resetPlayer(p, this.teamSlot(p)); p.stats = st;
          }
        }
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
      }
      if (inp.fire) {
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
        team: p.team, owner: p.id, hits: 0, t0: this.time });
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
        if (q.team === p.team || !q.alive || q.jump) continue;
        targets.push({ id: q.id, x: q.x, y: q.y, r: this.radiusOf(q) });
      }
      const hit = knifeTarget(p.x, p.y, this.radiusOf(p), p.fx, p.fy, targets, c, this.walls);
      if (hit) this.damage(this.players.get(hit), p.id, 'knife');
    }

    // golpe de faca de um jogador humano: o navegador diz quem ele acertou
    // (o que ele viu na tela) e o servidor só confere se é possível
    knifeSwing(id, targetId, ax, ay) {
      const p = this.players.get(id), c = this.cfg;
      if (!p || !p.alive || p.jump || p.weapon !== 'knife' || !this.canAct()) return;
      if (this.time < p.knifeReady - 0.12) return; // tolerância de rede
      p.knifeReady = this.time + c.knifeCooldown;
      p.knifeAnimUntil = this.time + 0.18;
      if (isFinite(ax) && isFinite(ay) && (ax || ay)) { const l = Math.hypot(ax, ay); p.fx = ax / l; p.fy = ay / l; }
      p.knifeAng = Math.atan2(p.fy, p.fx);
      this.events.push({ type: 'knife', id: p.id });
      const q = targetId && this.players.get(targetId);
      if (!q || q.team === p.team || !q.alive || q.jump) return;
      const reach = this.radiusOf(p) + c.knifeRange + this.radiusOf(q);
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d > reach * 1.5 + 60) return; // longe demais até considerando o atraso da rede
      if (lineBlocked(p.x, p.y, q.x, q.y, this.walls) && d > reach) return;
      this.damage(q, p.id, 'knife');
    }

    damage(v, attackerId, weapon) {
      const c = this.cfg;
      if (this.time < v.invulnUntil) return false;
      const a = this.players.get(attackerId);
      v.lives--;
      v.blinkUntil = this.time + c.blinkDuration;
      v.invulnUntil = this.time + c.invulnDuration;
      if (v.lives <= 0) {
        v.alive = false; v.jump = null; v.reloadUntil = 0;
        v.stats.d++;
        if (a) a.stats.k++;
        if (this.mode === 'sandbox') v.respawnAt = this.time + 2;
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
          for (const R of this.walls) {
            const col = circleRect(b.x, b.y, br, R);
            if (!col) continue;
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
            if (!p.alive || p.jump || p.team === b.team) continue; // sem fogo amigo
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

    isMatchOver() {
      const need = Math.floor(this.totalRounds / 2) + 1; // mais de 50% dos rounds
      return this.score.A >= need || this.score.B >= need || this.round >= this.totalRounds;
    }

    endMatch() {
      this.phase = 'matchEnd';
      const s = this.score;
      this.matchWinner = s.A > s.B ? 'A' : s.B > s.A ? 'B' : null; // null = empate
      this.events.push({ type: 'match_end', winner: this.matchWinner, score: Object.assign({}, s) });
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
          fc: r1(Math.max(0, p.fireReady - t)),
          sl: t < p.slowUntil ? p.slowF : 1, sk: t < p.slowUntil ? p.slowKind : 0,
          ts: p.jump && p.jump.toss ? 1 : 0,
          st: [p.stats.k, p.stats.d, p.stats.a]
        });
      }
      return {
        t: Math.round(t * 1000) / 1000, ph: this.phase, pu: r1(Math.max(0, this.phaseUntil - t)), rd: this.round,
        tr: this.totalRounds, sc: this.score, map: this.mapId, lg: this.lightState(), hz: this.hazardSnapshot(),
        rt: this.mode === 'match' && this.phase === 'playing' ? r1(Math.max(0, this.cfg.roundTime - (t - this.lightStart))) : null,
        p: ps, b: this.bullets.map((b) => [b.id, r1(b.x), r1(b.y), b.hits, b.team])
      };
    }
  }

  return { Game, buildWalls, moveCircle, circleFree, circleRect, lineBlocked, spawnPos, knifeTarget };
});
