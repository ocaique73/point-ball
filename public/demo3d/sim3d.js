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
  gravity: 1400, jumpV: 330, doubleJumpV: 540, doubleJumpCd: 15, lives: 2, shrink: 0.65, invuln: 0.4,
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

export class Sim3D {
  // walls = retângulos do 2D ({x, y, w, h, border}) — y do 2D vira z aqui
  constructor(walls, mapW, mapH) {
    this.W = mapW; this.H = mapH;
    this.boxes = walls.filter((R) => !R.space).map((R) => ({ x0: R.x, z0: R.y, x1: R.x + R.w, z1: R.y + R.h, top: R.border ? P.borderH : P.wallH }));
    this.players = new Map();
    this.bullets = []; this.nades = []; this.smokes = []; this.tombs = [];
    this.time = 0; this.nextId = 1; this.events = [];
  }

  // ---------- jogadores ----------
  addPlayer(o) {
    const p = {
      id: o.id, name: o.name, team: o.team, bot: !!o.bot, level: o.level || 'amador',
      primary: o.primary || 'lancador', x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, grounded: true,
      yaw: o.team === 'A' ? 0 : Math.PI, pitch: 0, lives: P.lives, alive: true,
      weapon: 'primary', lastWeapon: 'primary', ammo: {}, mags: {}, reloadUntil: 0, fireReady: 0, charge0: 0,
      nades: 1, smokes: 1, invulnUntil: 0, protectUntil: 0, respawnAt: 0, djReadyAt: 0, djUsed: false, jumps: 0,
      k: 0, d: 0, a: 0, input: { fwd: 0, side: 0, fire: false }, ai: {}, lastHitBy: {}, deadAt: 0
    };
    for (const w of WEAPON_IDS) { p.ammo[w] = WEAPONS[w].mag; p.mags[w] = WEAPONS[w].mags; }
    this.players.set(p.id, p);
    this.spawn(p);
    return p;
  }
  radius(p) { return P.radius * (p.lives >= P.lives ? 1 : P.shrink); }
  heightOf(p) { return P.height * (p.lives >= P.lives ? 1 : P.shrink); }
  spawn(p) {
    const r = P.radius + 6;
    for (let i = 0; i < 60; i++) {
      const x = p.team === 'A' ? 60 + Math.random() * 160 : this.W - 60 - Math.random() * 160;
      const z = 80 + Math.random() * (this.H - 160);
      if (!this.boxes.some((b) => this.circleBox(x, z, r, b))) { p.x = x; p.z = z; break; }
    }
    p.y = 0; p.vx = p.vy = p.vz = 0; p.grounded = true;
    p.lives = P.lives; p.alive = true; p.weapon = 'primary';
    for (const w of WEAPON_IDS) { p.ammo[w] = WEAPONS[w].mag; p.mags[w] = WEAPONS[w].mags; }
    p.nades = 1; p.smokes = 1; p.reloadUntil = 0; p.charge0 = 0;
    p.protectUntil = this.time + P.protect; p.invulnUntil = 0;
    p.yaw = p.team === 'A' ? 0 : Math.PI;
    p.lastHitBy = {};
  }
  weaponDef(p) { return WEAPONS[p.primary]; }
  aimDir(p) { const c = Math.cos(p.pitch); return [Math.cos(p.yaw) * c, Math.sin(p.pitch), Math.sin(p.yaw) * c]; }

  setWeapon(p, w) {
    if (!p.alive) return;
    if (w === 'nade' && p.nades < 1) return;
    if (w === 'smoke' && p.smokes < 1) return;
    if (p.weapon !== w) { if (p.weapon === 'primary' || p.weapon === 'knife') p.lastWeapon = p.weapon; p.weapon = w; p.reloadUntil = 0; p.charge0 = 0; }
  }
  // rodinha do mouse: próxima/anterior arma da lista
  cycleWeapon(p, dir) {
    const list = ['primary', 'knife'].concat(p.nades ? ['nade'] : [], p.smokes ? ['smoke'] : []);
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
      p.vy = P.jumpV; p.grounded = false; p.jumps = 1;
      this.events.push({ type: 'jump', id: p.id });
    } else if (!p.djUsed && this.time >= p.djReadyAt) { // pulo duplo: precisa estar carregado
      p.vy = P.doubleJumpV; p.djUsed = true; p.djReadyAt = this.time + P.doubleJumpCd; p.jumps = 2;
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
  // segmento (a -> b) bate em algum muro? (visão dos bots, explosão)
  segBlocked(ax, ay, az, bx, by, bz) {
    for (const b of this.boxes) {
      let t0 = 0, t1 = 1;
      const d = [bx - ax, by - ay, bz - az], o = [ax, ay, az], mn = [b.x0, 0, b.z0], mx = [b.x1, b.top, b.z1];
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
      const R = P.smokeRadius * 0.55 * k;
      const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
      const u = clamp(((s.x - ax) * dx + (s.z - az) * dz) / L2, 0, 1);
      const px = ax + dx * u, pz = az + dz * u, py = ay + (by - ay) * u;
      if (Math.hypot(px - s.x, pz - s.z) < R && py < P.smokeRadius * 0.9) return true;
    }
    return false;
  }
  smokeK(s) { return clamp(Math.min((this.time - s.t0) / 0.5, (s.until - this.time) / 1.0), 0, 1); }
  canSee(p, q) {
    return !this.segBlocked(p.x, p.y + P.eye, p.z, q.x, q.y + P.chest, q.z) && !this.smokeBlocks(p.x, p.y + P.eye, p.z, q.x, q.y + P.chest, q.z);
  }
  // a mira: primeiro ponto que o raio (olho -> direção) acerta (muro, chão ou alguém)
  raycast(ox, oy, oz, dx, dy, dz, maxD, ignoreId) {
    let best = maxD;
    if (dy < -1e-6) best = Math.min(best, -oy / dy);
    for (const b of this.boxes) {
      let t0 = 0, t1 = best;
      const d = [dx, dy, dz], o = [ox, oy, oz], mn = [b.x0, 0, b.z0], mx = [b.x1, b.top, b.z1];
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
    this.smokes = this.smokes.filter((s) => this.time < s.until);
    this.tombs = this.tombs.filter((t) => this.time < t.until);
    const ev = this.events; this.events = [];
    return ev;
  }

  updatePlayer(p, dt) {
    if (p.reloadUntil && this.time >= p.reloadUntil) {
      p.reloadUntil = 0; p.ammo[p.primary] = this.weaponDef(p).mag; p.mags[p.primary]--;
    }
    if (!p.alive) { if (this.time >= p.respawnAt) { this.spawn(p); this.events.push({ type: 'respawn', id: p.id }); } return; }
    if (p.bot) this.botThink(p, dt);
    // andar relativo para onde olha
    const fx = Math.cos(p.yaw), fz = Math.sin(p.yaw), rx = -fz, rz = fx;
    let wx = fx * p.input.fwd + rx * p.input.side, wz = fz * p.input.fwd + rz * p.input.side;
    const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
    wx *= P.speed; wz *= P.speed;
    if (p.grounded) { p.vx = wx; p.vz = wz; }
    else { // no ar: mantém o impulso, com um pouco de controle
      const k = Math.min(1, P.airControl * dt * 6);
      if (wl > 0.01) { p.vx += (wx - p.vx) * k; p.vz += (wz - p.vz) * k; }
    }
    const r = this.radius(p);
    // horizontal: bate nos muros que estão na altura do corpo
    p.x += p.vx * dt; p.z += p.vz * dt;
    for (let it = 0; it < 3; it++) {
      for (const b of this.boxes) {
        if (p.y >= b.top - 2) continue; // está em cima do muro
        const o = this.pushOut(p.x, p.z, r, b);
        if (o) { p.x = o[0]; p.z = o[1]; }
      }
    }
    // vertical: gravidade, chão e topo dos muros
    const y0 = p.y;
    p.vy -= P.gravity * dt; p.y += p.vy * dt;
    let floor = 0;
    for (const b of this.boxes) if (this.circleBox(p.x, p.z, r * 0.7, b) && y0 >= b.top - 2) floor = Math.max(floor, b.top);
    if (p.y <= floor) {
      if (!p.grounded && p.vy < -200) this.events.push({ type: 'land', id: p.id });
      p.y = floor; p.vy = 0;
      if (!p.grounded) { p.grounded = true; p.djUsed = false; p.jumps = 0; }
    } else if (p.grounded && p.y > floor + 1) p.grounded = false;
    else if (p.y > floor) p.grounded = false;
    // atirar / usar
    if (p.input.fire) this.useWeapon(p, false);
    else if (p.charge0) this.useWeapon(p, true); // soltou o botão do arco
  }

  useWeapon(p, released) {
    if (!p.alive || this.time < p.protectUntil) return;
    if (this.time < p.fireReady) return;
    if (p.weapon === 'knife') return this.knife(p);
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
    const ex = p.x, ey = p.y + P.eye, ez = p.z;
    const eye = p.camPos || [ex, ey, ez]; // na 3ª pessoa a mira sai da câmera
    const t = this.raycast(eye[0], eye[1], eye[2], dx, dy, dz, 4000, p.id);
    const tx = eye[0] + dx * t, ty = eye[1] + dy * t, tz = eye[2] + dz * t;
    const rx = -Math.sin(p.yaw), rz = Math.cos(p.yaw);
    const r = this.radius(p);
    const ox = p.x + Math.cos(p.yaw) * (r + 4) + rx * 8, oy = p.y + P.chest + 4, oz = p.z + Math.sin(p.yaw) * (r + 4) + rz * 8;
    return [ox, oy, oz, tx, ty, tz];
  }
  knife(p) {
    p.fireReady = this.time + P.knifeCd;
    this.events.push({ type: 'knife', id: p.id });
    for (const q of this.players.values()) {
      if (!q.alive || q.team === p.team) continue;
      const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      if (d > this.radius(p) + P.knifeRange + this.radius(q) || Math.abs(q.y - p.y) > 50) continue;
      let da = Math.atan2(dz, dx) - p.yaw; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) < P.knifeArc && !this.segBlocked(p.x, p.y + P.chest, p.z, q.x, q.y + P.chest, q.z)) { this.damage(q, p.id, 'knife'); break; }
    }
  }
  // granada / fumaça: joga para onde a mira aponta, quica no muro e no chão
  throwNade(p, smoke) {
    if (smoke ? p.smokes < 1 : p.nades < 1) { p.weapon = p.lastWeapon; return; }
    if (smoke) p.smokes--; else p.nades--;
    p.fireReady = this.time + 0.6;
    const [dx, dy, dz] = this.aimDir(p);
    const ox = p.x + dx * 20, oy = p.y + P.eye, oz = p.z + dz * 20;
    this.nades.push({ id: this.nextId++, owner: p.id, team: p.team, smoke, x: ox, y: oy, z: oz,
      vx: dx * P.nadeSpeed + p.vx * 0.5, vy: dy * P.nadeSpeed + P.nadeUp + p.vy * 0.3, vz: dz * P.nadeSpeed + p.vz * 0.5, t0: this.time, spin: 0 });
    this.events.push({ type: smoke ? 'smoke_throw' : 'nade_throw', id: p.id });
    p.weapon = p.lastWeapon || 'primary'; // volta para a arma que estava
  }

  // move uma bolinha (bala ou granada) um pedacinho e quica: devolve true se bateu
  bounceStep(o, r, rest, dt) {
    o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt;
    let hit = false;
    if (o.y < r) { o.y = r; o.vy = Math.abs(o.vy) * rest; o.vx *= 0.98; o.vz *= 0.98; hit = 'floor'; }
    for (const b of this.boxes) {
      const cx = clamp(o.x, b.x0, b.x1), cy = clamp(o.y, 0, b.top), cz = clamp(o.z, b.z0, b.z1);
      let nx = o.x - cx, ny = o.y - cy, nz = o.z - cz; const d2 = nx * nx + ny * ny + nz * nz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-9) { const d = Math.sqrt(d2); nx /= d; ny /= d; nz /= d; }
      else { // dentro da caixa: sai pela face mais perto
        const opts = [[o.x - b.x0, -1, 0, 0], [b.x1 - o.x, 1, 0, 0], [b.top - o.y, 0, 1, 0], [o.z - b.z0, 0, 0, -1], [b.z1 - o.z, 0, 0, 1]];
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
        const hit = this.bounceStep(b, b.r, b.rest, sub);
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
      }
      if (!dead && this.time - b.t0 < 8) keep.push(b);
    }
    this.bullets = keep;
  }

  updateNades(dt) {
    const keep = [];
    for (const g of this.nades) {
      const n = 4, sub = dt / n;
      for (let i = 0; i < n; i++) { g.vy -= P.gravity * sub; this.bounceStep(g, P.nadeR, 0.45, sub); }
      if (g.y <= P.nadeR + 0.5) { g.vx *= 0.9; g.vz *= 0.9; } // rolando no chão
      g.spin += Math.hypot(g.vx, g.vz) * dt * 0.05;
      const age = this.time - g.t0;
      if (g.smoke ? age >= P.smokeFuse : age >= P.nadeFuse) {
        if (g.smoke) {
          this.smokes.push({ id: g.id, x: g.x, z: g.z, t0: this.time, until: this.time + P.smokeTime });
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
      if (d > P.nadeRadius + this.radius(q)) continue;
      if (this.segBlocked(g.x, g.y + 2, g.z, q.x, q.y + P.chest, q.z)) continue;
      this.damage(q, g.owner, 'nade');
    }
  }

  damage(v, by, weapon) {
    if (!v.alive || this.time < v.invulnUntil || this.time < v.protectUntil) return;
    v.lives--; v.invulnUntil = this.time + P.invuln;
    if (by) v.lastHitBy[by] = this.time;
    const a = this.players.get(by);
    if (v.lives <= 0) {
      v.alive = false; v.d++; v.respawnAt = this.time + P.respawn; v.deadAt = this.time; v.reloadUntil = 0; v.charge0 = 0;
      if (a) a.k++;
      for (const id in v.lastHitBy) if (id !== by && this.time - v.lastHitBy[id] < 10) { const h = this.players.get(id); if (h) h.a++; }
      // lápide com o nome no lugar da morte (o corpo some)
      this.tombs.push({ id: this.nextId++, x: v.x, y: v.y, z: v.z, name: v.name, team: v.team, until: this.time + P.tombTime, t0: this.time });
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
        const tx = target.x + target.vx * tt, tz = target.z + target.vz * tt, ty = target.y + P.chest;
        ai.yaw = Math.atan2(tz - p.z, tx - p.x) + (Math.random() - 0.5) * 2 * L.err;
        ai.pitch = Math.atan2(ty - (p.y + P.eye), Math.hypot(tx - p.x, tz - p.z)) + (Math.random() - 0.5) * L.err;
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
    if (p.weapon !== 'primary' && p.weapon !== 'knife') p.weapon = 'primary';
  }
}
