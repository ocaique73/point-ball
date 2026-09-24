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
      this.buildMap();
    }

    buildMap() { this.walls = buildWalls(this.mapId, this.cfg); }

    radiusOf(p) { return this.cfg.playerRadius * (p.lives >= this.cfg.lives ? 1 : this.cfg.hitShrink); }

    addPlayer(info) {
      const p = {
        id: info.id, name: info.name || 'Jogador', team: info.team === 'B' ? 'B' : 'A',
        x: 0, y: 0, fx: 1, fy: 0,
        input: { up: false, down: false, left: false, right: false, fire: false },
        stats: { k: 0, d: 0, a: 0 }, bot: !!info.bot
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
    }

    setInput(id, inp) {
      const p = this.players.get(id);
      if (!p || !inp) return;
      p.input = { up: !!inp.up, down: !!inp.down, left: !!inp.left, right: !!inp.right, fire: !!inp.fire };
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
      let target = null;
      for (let d = D; d <= D * 1.8 && !target; d += 6) {
        const tx = p.x + p.fx * d, ty = p.y + p.fy * d;
        if (circleFree(tx, ty, r, this.walls, c)) target = { x: tx, y: ty };
      }
      for (let d = D - 6; d >= r && !target; d -= 6) {
        const tx = p.x + p.fx * d, ty = p.y + p.fy * d;
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
      if (p.jump) {
        const j = p.jump, t = (this.time - j.t0) / j.dur;
        if (t >= 1) { p.x = j.tx; p.y = j.ty; p.jump = null; this.events.push({ type: 'land', id: p.id }); }
        else { p.x = j.sx + (j.tx - j.sx) * t; p.y = j.sy + (j.ty - j.sy) * t; }
        return;
      }
      if (!act) return;
      const inp = p.input;
      let mx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      let my = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
      if (mx || my) {
        const l = Math.hypot(mx, my); mx /= l; my /= l;
        p.fx = mx; p.fy = my;
        const m = moveCircle(p.x, p.y, mx * c.playerSpeed * dt, my * c.playerSpeed * dt, this.radiusOf(p), this.walls);
        p.x = m.x; p.y = m.y;
      }
      if (inp.fire) {
        if (p.weapon === 'gun') this.tryShoot(p);
        else this.tryKnife(p);
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

    tryKnife(p) {
      const c = this.cfg;
      if (this.time < p.knifeReady) return;
      p.knifeReady = this.time + c.knifeCooldown;
      p.knifeAnimUntil = this.time + 0.18;
      this.events.push({ type: 'knife', id: p.id });
      const ra = this.radiusOf(p), cosHalf = Math.cos((c.knifeArc / 2) * Math.PI / 180);
      let best = null, bestD = Infinity;
      for (const q of this.players.values()) {
        if (q.team === p.team || !q.alive || q.jump) continue;
        const rv = this.radiusOf(q), dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
        if (d > ra + c.knifeRange + rv) continue;
        const touching = d <= ra + rv;
        if (!touching && (dx * p.fx + dy * p.fy) / (d || 1) < cosHalf) continue;
        if (lineBlocked(p.x, p.y, q.x, q.y, this.walls)) continue;
        if (d < bestD) { best = q; bestD = d; }
      }
      if (best) this.damage(best, p.id, 'knife');
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
      if (aA > 0 && aB > 0) return;
      const winner = aA > 0 ? 'A' : aB > 0 ? 'B' : null;
      if (winner) this.score[winner]++;
      this.phase = 'roundEnd';
      this.phaseUntil = this.time + this.cfg.roundEndDelay;
      this.bullets = [];
      this.events.push({ type: 'round_end', winner, score: Object.assign({}, this.score), round: this.round });
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
          jz: p.jump ? Math.min(1, (t - p.jump.t0) / p.jump.dur) : -1,
          ka: t < p.knifeAnimUntil ? 1 : 0,
          fc: r1(Math.max(0, p.fireReady - t)),
          st: [p.stats.k, p.stats.d, p.stats.a]
        });
      }
      return {
        t: Math.round(t * 1000) / 1000, ph: this.phase, pu: r1(Math.max(0, this.phaseUntil - t)), rd: this.round,
        tr: this.totalRounds, sc: this.score, map: this.mapId,
        p: ps, b: this.bullets.map((b) => [b.id, r1(b.x), r1(b.y), b.hits, b.team])
      };
    }
  }

  return { Game, buildWalls, moveCircle, circleFree, circleRect, lineBlocked, spawnPos };
});
