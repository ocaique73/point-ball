// Desenho do jogo no canvas (usado no jogo online e na página /teste)
window.PBRenderer = (function () {
  const TEAM = { A: '#3b82f6', B: '#ef4444' };
  const TEAM_DARK = { A: '#1e3a8a', B: '#7f1d1d' };
  const TEAM_RGB = { A: '96,165,250', B: '248,113,113' };
  const TEAM_BODY = { A: '#60a5fa', B: '#f87171' };
  const TEAM_LIGHT = { A: '#dbeafe', B: '#fee2e2' };   // piscando na proteção ao renascer
  const TEAM_STRONG = { A: '#1d4ed8', B: '#b91c1c' };  // anel de carregamento do tiro

  function seeded(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.avatars = new Map();
      this.effects = [];
      this.bg = null;
      this.trails = new Map(); // rastro das balas
      window.addEventListener('resize', () => this.resize());
    }

    setup(cfg, mapId) {
      this.cfg = cfg;
      this.mapId = RC_MAPS.MAPS[mapId] ? mapId : 'deserto';
      this.map = RC_MAPS.MAPS[this.mapId];
      this.walls = RC_GAME.buildWalls(this.mapId, cfg, 0);
      // paredes que mudam de lugar (vulcão): uma lista por desenho
      this.layWalls = this.map.layouts ? this.map.layouts.map((_, i) => RC_GAME.buildWalls(this.mapId, cfg, i).filter((R) => R.mv)) : null;
      this.resize();
    }

    resize() {
      if (!this.cfg) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
      this.canvas.width = Math.max(1, Math.round(w * dpr));
      this.canvas.height = Math.max(1, Math.round(h * dpr));
      this.dpr = dpr;
      const W = this.cfg.mapWidth, H = this.cfg.mapHeight;
      // espaço reservado em cima para o HUD (placar, pulo, K/D/A e contador do mapa) não ficar sobre o mapa
      const top = Math.round((this.reserveTop || 0) * (this.cfg.hudScale || 1) * dpr);
      const availH = Math.max(1, this.canvas.height - top);
      this.scale = Math.min(this.canvas.width / W, availH / H) * this.cfg.mapScreenScale;
      this.ox = (this.canvas.width - W * this.scale) / 2;
      this.oy = top + (availH - H * this.scale) / 2;
      this.buildBackground();
      this.stars = this.map.space ? this.starCanvas(this.canvas.width, this.canvas.height, 7) : null;
    }

    // céu estrelado (fundo da nave e dentro dos buracos)
    starCanvas(w, h, seed) {
      const cv = document.createElement('canvas'); cv.width = Math.max(1, w); cv.height = Math.max(1, h);
      const g = cv.getContext('2d'), rnd = seeded(seed);
      g.fillStyle = '#03040b'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 3; i++) { // nebulosas fraquinhas
        const x = rnd() * w, y = rnd() * h, R = (0.2 + rnd() * 0.3) * Math.max(w, h);
        const grd = g.createRadialGradient(x, y, 0, x, y, R);
        grd.addColorStop(0, ['rgba(90,60,170,.18)', 'rgba(30,110,170,.16)', 'rgba(170,50,120,.12)'][i]); grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd; g.fillRect(0, 0, w, h);
      }
      const n = Math.round(w * h / 1400);
      for (let i = 0; i < n; i++) {
        const b = rnd();
        g.fillStyle = `rgba(255,255,255,${(0.25 + b * 0.75).toFixed(2)})`;
        g.fillRect(rnd() * w, rnd() * h, b > 0.93 ? 2 : 1, b > 0.93 ? 2 : 1);
      }
      return cv;
    }

    buildBackground() {
      const c = this.cfg, s = this.scale, th = this.map.theme;
      const W = Math.max(1, Math.ceil(c.mapWidth * s)), H = Math.max(1, Math.ceil(c.mapHeight * s));
      const bg = document.createElement('canvas');
      bg.width = W; bg.height = H;
      const g = bg.getContext('2d');
      g.fillStyle = th.ground; g.fillRect(0, 0, W, H);
      // textura do chão
      const rnd = seeded(this.mapId.length * 977 + 13);
      g.fillStyle = th.ground2;
      for (let i = 0; i < (th.deco === 'tiles' ? 0 : 260); i++) {
        g.beginPath();
        g.ellipse(rnd() * W, rnd() * H, (6 + rnd() * 26) * s, (3 + rnd() * 12) * s, rnd() * Math.PI, 0, Math.PI * 2);
        g.fill();
      }
      // decoração (sem colisão)
      for (let i = 0; i < 38; i++) {
        const x = rnd() * W, y = rnd() * H, k = 0.6 + rnd() * 0.8;
        if (th.deco === 'rocks') {
          g.fillStyle = 'rgba(120,85,45,.35)';
          g.beginPath(); g.ellipse(x, y, 7 * s * k, 5 * s * k, rnd() * 3, 0, Math.PI * 2); g.fill();
          g.fillStyle = 'rgba(255,240,210,.25)';
          g.beginPath(); g.ellipse(x - 2 * s, y - 2 * s, 3 * s * k, 2 * s * k, 0, 0, Math.PI * 2); g.fill();
        } else if (th.deco === 'cactus') {
          g.fillStyle = '#6a9a4a'; g.strokeStyle = '#4c7535'; g.lineWidth = 2 * s;
          g.beginPath(); g.roundRect(x - 5 * s * k, y - 16 * s * k, 10 * s * k, 26 * s * k, 5 * s * k); g.fill(); g.stroke();
          g.beginPath(); g.roundRect(x - 14 * s * k, y - 8 * s * k, 7 * s * k, 12 * s * k, 3 * s * k); g.fill();
          g.beginPath(); g.roundRect(x + 7 * s * k, y - 12 * s * k, 7 * s * k, 12 * s * k, 3 * s * k); g.fill();
        } else if (th.deco === 'tiles') {
          if (i === 0) {
            g.strokeStyle = 'rgba(255,255,255,.035)'; g.lineWidth = 1;
            const step = 50 * s;
            g.beginPath();
            for (let gx = 0; gx < W; gx += step) { g.moveTo(gx, 0); g.lineTo(gx, H); }
            for (let gy = 0; gy < H; gy += step) { g.moveTo(0, gy); g.lineTo(W, gy); }
            g.stroke();
          }
          if (i < 6) { // lâmpadas no chão
            g.fillStyle = 'rgba(255,230,160,.05)';
            g.beginPath(); g.arc(x, y, 60 * s, 0, Math.PI * 2); g.fill();
          }
        } else if (th.deco === 'city') {
          if (i === 0) { // faixas de rua
            g.strokeStyle = 'rgba(250,204,21,.18)'; g.lineWidth = 4 * s; g.setLineDash([26 * s, 22 * s]);
            g.beginPath(); g.moveTo(0, H * 0.5); g.lineTo(W, H * 0.5); g.moveTo(W * 0.5, 0); g.lineTo(W * 0.5, H); g.stroke();
            g.setLineDash([]);
            g.fillStyle = 'rgba(255,255,255,.07)'; // faixa de pedestre
            for (let k = 0; k < 6; k++) { g.fillRect(W * 0.47 + k * 16 * s, H * 0.3, 8 * s, 50 * s); g.fillRect(W * 0.47 + k * 16 * s, H * 0.66, 8 * s, 50 * s); }
          }
          g.fillStyle = 'rgba(0,0,0,.18)'; // manchas no asfalto
          g.beginPath(); g.ellipse(x, y, 16 * s * k, 7 * s * k, rnd() * 3, 0, Math.PI * 2); g.fill();
        } else if (th.deco === 'ash') {
          g.fillStyle = 'rgba(15,8,6,.35)';
          g.beginPath(); g.ellipse(x, y, 14 * s * k, 9 * s * k, rnd() * 3, 0, Math.PI * 2); g.fill();
          g.fillStyle = 'rgba(255,110,40,.35)'; // brasinhas
          g.beginPath(); g.arc(x + 10 * s, y - 6 * s, 1.8 * s, 0, Math.PI * 2); g.fill();
          if (i < 10) { // rachaduras com brilho
            g.strokeStyle = 'rgba(255,90,20,.22)'; g.lineWidth = 2 * s;
            g.beginPath(); g.moveTo(x, y); let cx = x, cy = y;
            for (let q = 0; q < 4; q++) { cx += (rnd() - 0.5) * 50 * s; cy += (rnd() - 0.5) * 50 * s; g.lineTo(cx, cy); }
            g.stroke();
          }
        } else if (th.deco === 'panels') {
          if (i === 0) { // placas de metal com rebites
            const step = 80 * s;
            g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = Math.max(1, 2 * s);
            g.beginPath();
            for (let gx = 0; gx < W; gx += step) { g.moveTo(gx, 0); g.lineTo(gx, H); }
            for (let gy = 0; gy < H; gy += step) { g.moveTo(0, gy); g.lineTo(W, gy); }
            g.stroke();
            g.fillStyle = 'rgba(255,255,255,.08)';
            for (let gx = 0; gx < W; gx += step) for (let gy = 0; gy < H; gy += step) {
              for (const [ox, oy] of [[6, 6], [step / s - 6, 6], [6, step / s - 6], [step / s - 6, step / s - 6]]) { g.beginPath(); g.arc(gx + ox * s, gy + oy * s, 1.6 * s, 0, Math.PI * 2); g.fill(); }
            }
            g.fillStyle = 'rgba(56,189,248,.06)'; // faixa luminosa no meio
            g.fillRect(W * 0.5 - 30 * s, 0, 60 * s, H);
          }
        } else if (th.deco === 'snow') {
          g.fillStyle = 'rgba(255,255,255,.9)';
          g.beginPath(); g.ellipse(x, y, 18 * s * k, 9 * s * k, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#c9d9ea';
          g.beginPath(); g.arc(x + 20 * s * k, y - 14 * s * k, 3 * s, 0, Math.PI * 2); g.fill();
        } else {
          g.fillStyle = 'rgba(30,70,30,.35)';
          g.beginPath(); g.arc(x + 3 * s, y + 4 * s, 20 * s * k, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#3f7d3a';
          g.beginPath(); g.arc(x, y, 18 * s * k, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#4f9447';
          g.beginPath(); g.arc(x - 5 * s * k, y - 5 * s * k, 9 * s * k, 0, Math.PI * 2); g.fill();
        }
      }
      const skip = (R) => R.door || R.mv || R.space || R.lamp != null; // desenhados por cima (mudam)
      // muros
      for (const R of this.walls) {
        if (skip(R)) continue;
        const x = R.x * s, y = R.y * s, w = R.w * s, h = R.h * s;
        g.fillStyle = 'rgba(0,0,0,.22)';
        g.fillRect(x + 4 * s, y + 5 * s, w, h);
      }
      for (const R of this.walls) {
        if (skip(R)) continue;
        const x = R.x * s, y = R.y * s, w = R.w * s, h = R.h * s;
        g.fillStyle = R.border ? th.border : th.wall;
        g.fillRect(x, y, w, h);
        g.strokeStyle = th.wallEdge; g.lineWidth = Math.max(1, 2 * s);
        g.strokeRect(x + 1, y + 1, w - 2, h - 2);
        g.fillStyle = 'rgba(255,255,255,.12)';
        g.fillRect(x, y, w, Math.max(1, 3 * s));
      }
      // cantos do casco da nave: espaço estrelado (por cima da borda) com a beirada do casco
      const sp = this.walls.filter((R) => R.space);
      if (sp.length) {
        const st = this.starCanvas(W, H, 11);
        for (const R of sp) g.drawImage(st, R.x * s, R.y * s, R.w * s, R.h * s, R.x * s, R.y * s, R.w * s, R.h * s);
        g.fillStyle = th.border;
        const t = c.wallThickness * s;
        for (const R of sp) {
          const x = R.x * s, y = R.y * s, w = R.w * s, h = R.h * s, right = R.x > c.mapWidth / 2, bottom = R.y > c.mapHeight / 2;
          g.fillRect(right ? x - t : x + w, bottom ? y - t : y, t, h + t); // lado de dentro
          g.fillRect(x, bottom ? y - t : y + h, w, t);
        }
        for (const R of sp) g.drawImage(st, R.x * s, R.y * s, R.w * s, R.h * s, R.x * s, R.y * s, R.w * s, R.h * s);
      }
      this.bg = bg;
    }

    avatar(url) {
      if (!url) return null;
      let img = this.avatars.get(url);
      if (!img) {
        img = new Image();
        img.referrerPolicy = 'no-referrer';
        img.src = url;
        this.avatars.set(url, img);
      }
      return img.complete && img.naturalWidth > 0 ? img : null;
    }

    effect(ev) {
      const now = performance.now();
      if (ev.type === 'bounce') this.effects.push({ k: 'spark', x: ev.x, y: ev.y, t0: now, d: 250 });
      else if (ev.type === 'hit') this.effects.push({ k: 'hit', x: ev.x, y: ev.y, t0: now, d: 700 });
      else if (ev.type === 'kill') this.effects.push({ k: 'kill', x: ev.x, y: ev.y, t0: now, d: 900 });
      else if (ev.type === 'explode') this.effects.push({ k: 'boom', x: ev.x, y: ev.y, t0: now, d: 550 });
      else if (ev.type === 'sucked') this.effects.push({ k: 'sucked', x: ev.x, y: ev.y, t0: now, d: 350 });
      else if (ev.type === 'lamp_off') this.effects.push({ k: 'lamp', x: ev.x, y: ev.y, t0: now, d: 500 });
    }

    // posição do mouse (tela) -> coordenadas do mapa
    screenToWorld(clientX, clientY) {
      const r = this.canvas.getBoundingClientRect();
      return { x: ((clientX - r.left) * this.dpr - this.ox) / this.scale, y: ((clientY - r.top) * this.dpr - this.oy) / this.scale };
    }

    updateTrails(bullets) {
      const seen = new Set();
      for (const b of bullets) {
        seen.add(b[0]);
        let t = this.trails.get(b[0]);
        if (!t) { t = []; this.trails.set(b[0], t); }
        const last = t[t.length - 1];
        t.team = b[4];
        if (last && Math.hypot(last.x - b[1], last.y - b[2]) > 150) t.length = 0; // passou pelo portal
        if (!last || last.x !== b[1] || last.y !== b[2]) t.push({ x: b[1], y: b[2] });
        if (t.length > 9) t.shift();
      }
      for (const id of this.trails.keys()) if (!seen.has(id)) this.trails.delete(id);
    }

    drawTrails(alpha) {
      const g = this.ctx, r = this.cfg.bulletRadius;
      g.lineCap = 'round';
      for (const t of this.trails.values()) {
        for (let i = 1; i < t.length; i++) {
          const k = i / t.length;
          g.strokeStyle = `rgba(${TEAM_RGB[t.team] || '255,255,255'},${(alpha * k).toFixed(3)})`; // rastro da cor do tiro
          g.lineWidth = r * 1.3 * k;
          g.beginPath(); g.moveTo(t[i - 1].x, t[i - 1].y); g.lineTo(t[i].x, t[i].y); g.stroke();
        }
      }
    }

    // view = { players: [...], bullets: [[id,x,y,hits,team]], meId, light: 0 acesa | 1 piscando | 2 apagada }
    draw(view) {
      const g = this.ctx, s = this.scale, c = this.cfg;
      if (!c) return;
      const now = performance.now();
      if (view.ffa) {
        // cada um por si: você é azul, todo mundo é vermelho
        const me = view.meId;
        view = Object.assign({}, view, {
          players: view.players.map((p) => Object.assign({}, p, { tm: p.id === me ? 'A' : 'B' })),
          bullets: view.bullets.map((b) => [b[0], b[1], b[2], b[3], b[4] === me ? 'A' : 'B']),
          bombs: (view.bombs || []).map((b) => [b[0], b[1], b[2], b[3], b[4] === me ? 'A' : 'B', b[5], b[6]])
        });
      }
      this.updateTrails(view.bullets);
      const light = view.light || 0;
      const dark = light === 2 || (light === 1 && Math.floor(now / 70) % 2 === 0);
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (this.stars && !dark) g.drawImage(this.stars, 0, 0);
      else { g.fillStyle = dark ? '#000' : '#070a10'; g.fillRect(0, 0, this.canvas.width, this.canvas.height); }

      if (dark) {
        // escuro total: só o tiro aparece, um pouco claro, com rastro de fogo
        g.setTransform(s, 0, 0, s, this.ox, this.oy);
        const a = c.bulletGlow;
        this.drawTrails(a * 0.7);
        for (const b of view.bullets) {
          const grd = g.createRadialGradient(b[1], b[2], 0, b[1], b[2], c.bulletRadius * 3);
          grd.addColorStop(0, `rgba(${TEAM_RGB[b[4]]},${(a * 0.6).toFixed(3)})`);
          grd.addColorStop(1, `rgba(${TEAM_RGB[b[4]]},0)`);
          g.fillStyle = grd;
          g.beginPath(); g.arc(b[1], b[2], c.bulletRadius * 3, 0, Math.PI * 2); g.fill();
          g.globalAlpha = a;
          this.drawBullet(b);
          g.globalAlpha = 1;
        }
        g.setTransform(1, 0, 0, 1, 0, 0);
        return;
      }

      if (this.bg) g.drawImage(this.bg, Math.round(this.ox), Math.round(this.oy));
      g.setTransform(s, 0, 0, s, this.ox, this.oy);

      // mortos primeiro, depois vivos, pulando por último (ficam por cima)
      let ps = view.players.slice().sort((a, b) => (a.al - b.al) || ((a.jz >= 0) - (b.jz >= 0)));
      const hz = view.hz;
      const meP = view.players.find((p) => p.id === view.meId);
      const night = !!this.map.lamps;
      let hidden = [];
      if (night) { // cidade: inimigo só aparece na luz, perto de você ou no clarão do tiro
        const myTm = meP ? meP.tm : null;
        const vis = (p) => p.id === view.meId || (myTm && p.tm === myTm) || this.litAt(p, hz) ||
          (meP && Math.hypot(p.x - meP.x, p.y - meP.y) < c.nightSee + 30) || (p.fc > 0 && p.fc > c.fireCooldown - 0.25);
        hidden = ps.filter((p) => !vis(p)); ps = ps.filter(vis);
      }
      if (this.map.portals) this.drawPortals(view.pt, now);
      if (hz && hz.t === 'meteor') this.drawHoles(hz, now);
      if (hz && hz.t === 'lava') this.drawLava(hz, now);
      if (this.layWalls) this.drawMovingWalls(hz, now);
      if (view.hl) this.drawHill(view.hl, now);
      if (hz && hz.t === 'storm') this.drawStorm(hz, now);
      for (const p of ps) {
        if (p.fd) continue; // caiu no buraco: não deixa marca
        if (p.fl > 0 && p.al) { // caindo no buraco: gira, encolhe e escurece até sumir no espaço
          const k = Math.max(0.02, (1 - p.fl) * (1 - p.fl * 0.4));
          g.save(); g.globalAlpha = Math.max(0, 1 - p.fl * 0.7);
          g.translate(p.x, p.y); g.rotate(p.fl * p.fl * 9); g.scale(k, k); g.translate(-p.x, -p.y);
          this.drawPlayer(p, p.id === view.meId, now); g.restore();
        } else this.drawPlayer(p, p.id === view.meId, now);
      }
      if (night) {
        this.drawNight(hz, meP, now);
        if (meP && meP.tm) { // aliados no escuro: aparecem apagadinhos
          g.globalAlpha = 0.55;
          for (const p of ps) if (p.id !== view.meId && p.tm === meP.tm && p.al && !this.litAt(p, hz)) this.drawPlayer(p, false, now);
          g.globalAlpha = 1;
        }
        if (view.hl) this.drawHill(view.hl, now);
      }
      if (hz && hz.t === 'meteor') this.drawMeteors(hz, now);
      if (view.hz && view.hz.t === 'tornado') this.drawTornado(view.hz, now);
      this.drawTrails(0.28);
      for (const b of view.bullets) this.drawBullet(b);
      for (const b of view.bombs || []) this.drawBomb(b, now);
      // fumaça por cima de todo mundo — no meio ninguém aparece, nem você (a ideia é se perder nela)
      if (view.smokes && view.smokes.length) for (const m of view.smokes) this.drawSmoke(m, now);
      if (view.bombAim) this.drawBombAim(view.bombAim);
      this.drawEffects(now);
      if (view.hz && view.hz.t === 'sand') this.drawSand(view.hz, now); // por cima de tudo
      g.setTransform(1, 0, 0, 1, 0, 0);
    }

    // furacão visto de cima: braços de vento em espiral, meio transparentes, girando
    // portais nos muros de borda: fechados = barreira apagada; abertos = redemoinho de energia (cor do par)
    drawPortals(pt, now) {
      const g = this.ctx, c = this.cfg, W = c.mapWidth, H = c.mapHeight, t = c.wallThickness;
      const open = pt && pt.o && pt.pr;
      const closingSoon = open && pt.n < 1.5 && Math.floor(now / 110) % 2 === 0;
      const COLORS = ['0,229,255', '255,64,200']; // cada par tem sua cor
      const colOf = {};
      if (open) pt.pr.forEach((pair, k) => pair.forEach((i) => (colOf[i] = COLORS[k % COLORS.length])));
      for (const q of RC_GAME.portalList(this.map)) {
        const G = RC_GAME.portalGeom(q, c), vert = q.s === 'L' || q.s === 'R';
        // retângulo da porta
        const rx = vert ? (q.s === 'L' ? 0 : W - t) : G.cx - G.half, ry = vert ? G.cy - G.half : (q.s === 'T' ? 0 : H - t);
        const rw = vert ? t : G.half * 2, rh = vert ? G.half * 2 : t;
        const col = colOf[q.i];
        if (!col) {
          g.fillStyle = '#2a2350';
          g.fillRect(rx, ry, rw, rh);
          g.strokeStyle = 'rgba(139,124,246,.35)'; g.lineWidth = 2;
          g.strokeRect(rx + 1, ry + 1, rw - 2, rh - 2);
          g.beginPath(); // grade
          if (vert) for (let yy = ry + 8; yy < ry + rh; yy += 12) { g.moveTo(rx + 3, yy); g.lineTo(rx + t - 3, yy); }
          else for (let xx = rx + 8; xx < rx + rw; xx += 12) { g.moveTo(xx, ry + 3); g.lineTo(xx, ry + t - 3); }
          g.stroke();
          continue;
        }
        const cx = G.cx + G.nx * t * 0.5, cy = G.cy + G.ny * t * 0.5;
        const grd = g.createRadialGradient(cx, cy, 2, cx, cy, G.half * 1.2);
        grd.addColorStop(0, `rgba(${col},${closingSoon ? 0.35 : 0.8})`);
        grd.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = grd;
        g.fillRect(vert ? (q.s === 'L' ? 0 : W - t * 3) : rx, vert ? ry - 10 : (q.s === 'T' ? 0 : H - t * 3), vert ? t * 3 : rw, vert ? rh + 20 : t * 3);
        g.strokeStyle = `rgba(${col},${closingSoon ? 0.4 : 0.95})`; g.lineWidth = 3;
        for (let k = 0; k < 3; k++) {
          const ph = now / 250 + k * 2.1, a1 = t * 0.55 + k * 3, a2 = G.half - k * 6;
          g.beginPath();
          g.ellipse(cx, cy, vert ? a1 : a2, vert ? a2 : a1, 0, ph, ph + Math.PI * 1.2);
          g.stroke();
        }
      }
    }

    // Rei da colina: área no chão; cor de quem domina, amarela piscando se disputada
    drawHill(H, now) {
      const g = this.ctx;
      const col = H.o === 'A' ? '59,130,246' : H.o === 'B' ? '239,68,68' : H.o === 'X' ? '250,204,21' : '255,255,255';
      const pulse = H.o === 'X' ? (Math.floor(now / 150) % 2 ? 0.28 : 0.12) : H.o ? 0.24 : 0.1;
      g.save();
      g.fillStyle = `rgba(${col},${pulse})`;
      g.beginPath(); g.arc(H.x, H.y, H.r, 0, Math.PI * 2); g.fill();
      g.setLineDash([14, 10]); g.lineDashOffset = -now / 40;
      g.strokeStyle = `rgba(${col},.9)`; g.lineWidth = 4;
      g.beginPath(); g.arc(H.x, H.y, H.r, 0, Math.PI * 2); g.stroke();
      g.setLineDash([]);
      g.font = `900 ${Math.round(H.r * 0.34)}px Segoe UI, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.globalAlpha = 0.55; g.fillText('👑', H.x, H.y); g.globalAlpha = 1;
      g.restore();
      g.textBaseline = 'alphabetic';
    }

    // ---------- Cidade à noite ----------
    lampOnC(i, hz) { return !(hz && hz.lo && hz.lo[i] > 0); }
    litAt(p, hz) {
      const c = this.cfg, L = this.map.lamps;
      for (let i = 0; i < L.length; i++) if (this.lampOnC(i, hz) && Math.hypot(L[i][0] * c.mapWidth - p.x, L[i][1] * c.mapHeight - p.y) < c.lampLight * 0.8) return true;
      return false;
    }
    drawNight(hz, meP, now) {
      const g = this.ctx, c = this.cfg, s = this.scale, L = this.map.lamps;
      if (!this.nightCv || this.nightCv.width !== this.canvas.width || this.nightCv.height !== this.canvas.height) {
        this.nightCv = document.createElement('canvas'); this.nightCv.width = this.canvas.width; this.nightCv.height = this.canvas.height;
      }
      const n = this.nightCv.getContext('2d');
      n.globalCompositeOperation = 'source-over';
      n.clearRect(0, 0, this.nightCv.width, this.nightCv.height);
      n.fillStyle = `rgba(3,5,14,${c.nightDark})`;
      n.fillRect(this.ox, this.oy, c.mapWidth * s, c.mapHeight * s);
      n.globalCompositeOperation = 'destination-out';
      const hole = (x, y, R, a) => {
        const X = this.ox + x * s, Y = this.oy + y * s, RR = R * s;
        const grd = n.createRadialGradient(X, Y, 0, X, Y, RR);
        grd.addColorStop(0, `rgba(0,0,0,${a})`); grd.addColorStop(0.55, `rgba(0,0,0,${a})`); grd.addColorStop(1, 'rgba(0,0,0,0)');
        n.fillStyle = grd; n.beginPath(); n.arc(X, Y, RR, 0, Math.PI * 2); n.fill();
      };
      L.forEach((l, i) => {
        if (!this.lampOnC(i, hz)) return;
        const flick = 0.96 + Math.sin(now / 90 + i * 7) * 0.04;
        hole(l[0] * c.mapWidth, l[1] * c.mapHeight, c.lampLight * flick, 1);
      });
      if (meP && meP.al && c.nightSee > 0) hole(meP.x, meP.y, c.nightSee, 0.75);
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(this.nightCv, 0, 0);
      g.restore();
      // postes (sempre visíveis) com a luz amarelada
      L.forEach((l, i) => {
        const x = l[0] * c.mapWidth, y = l[1] * c.mapHeight, on = this.lampOnC(i, hz);
        if (on) {
          const grd = g.createRadialGradient(x, y, 0, x, y, c.lampLight);
          grd.addColorStop(0, 'rgba(255,214,120,.16)'); grd.addColorStop(1, 'rgba(255,214,120,0)');
          g.fillStyle = grd; g.beginPath(); g.arc(x, y, c.lampLight, 0, Math.PI * 2); g.fill();
        }
        g.fillStyle = '#111318'; g.fillRect(x - 8, y - 8, 16, 16);
        g.strokeStyle = '#4b5263'; g.lineWidth = 2; g.strokeRect(x - 7, y - 7, 14, 14);
        g.fillStyle = on ? '#fde68a' : '#3a3f4b';
        g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
        if (!on && hz && hz.lo) { // tempo para acender de novo
          g.strokeStyle = 'rgba(253,230,138,.6)'; g.lineWidth = 2;
          g.beginPath(); g.arc(x, y, 12, -Math.PI / 2, -Math.PI / 2 + (1 - hz.lo[i] / c.lampOff) * Math.PI * 2); g.stroke();
        }
      });
    }

    // ---------- Vulcão ----------
    // caminho do formato irregular da poça
    lavaPath(g, q, grow) {
      g.beginPath();
      for (let i = 0; i <= 40; i++) {
        const a = i / 40 * Math.PI * 2, rr = RC_GAME.lavaR(q, a) * grow;
        const x = q.x + Math.cos(a) * rr, y = q.y + Math.sin(a) * rr;
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.closePath();
    }
    drawLava(hz, now) {
      if (!hz.p || hz.s === 0) return;
      const g = this.ctx, t = now / 1000;
      for (const P of hz.p) {
        const q = { x: P[0], y: P[1], r: P[2], seed: P[3] || 1, m: P[4] || 0 }, R = q.r;
        if (hz.s === 1) { // aviso: chão rachando com brilho por baixo, piscando
          const blink = Math.floor(now / (hz.k > 0.6 ? 90 : 170)) % 2 === 0;
          g.fillStyle = `rgba(255,90,20,${blink ? 0.25 : 0.08})`;
          this.lavaPath(g, q, 0.5 + hz.k * 0.5); g.fill();
          g.setLineDash([10, 8]); g.strokeStyle = 'rgba(255,140,40,.85)'; g.lineWidth = 3;
          this.lavaPath(g, q, 1); g.stroke(); g.setLineDash([]);
          continue;
        }
        const cool = hz.k > 0.85 ? (hz.k - 0.85) / 0.15 : 0; // no fim a lava esfria e escurece
        const rise = Math.min(1, hz.k * 12); // sobe rápido no começo
        g.save();
        // brilho quente em volta
        g.shadowColor = `rgba(255,80,0,${0.8 * (1 - cool)})`; g.shadowBlur = 28;
        g.fillStyle = '#5c1204';
        this.lavaPath(g, q, rise); g.fill();
        g.shadowBlur = 0;
        this.lavaPath(g, q, rise); g.clip();
        // base: laranja por dentro, vermelho escuro na beira
        const base = g.createRadialGradient(q.x, q.y, 0, q.x, q.y, R * 1.3);
        base.addColorStop(0, cool ? '#c2410c' : '#ff8a1f'); base.addColorStop(0.6, '#d9360b'); base.addColorStop(1, '#6b1405');
        g.fillStyle = base; g.fillRect(q.x - R * 1.8, q.y - R * 1.8, R * 3.6, R * 3.6);
        const rnd = (() => { let s = (q.seed * 7 + 3) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
        // correntes quentes (amarelo) andando devagar
        for (let i = 0; i < 7; i++) {
          const ph = rnd() * 6.28, sp = 0.25 + rnd() * 0.35, orb = R * (0.2 + rnd() * 0.55), rr = R * (0.28 + rnd() * 0.2);
          const x = q.x + Math.cos(t * sp + ph) * orb, y = q.y + Math.sin(t * sp * 1.3 + ph) * orb * 0.8;
          const hg = g.createRadialGradient(x, y, 0, x, y, rr);
          hg.addColorStop(0, `rgba(255,230,120,${0.85 * (1 - cool)})`); hg.addColorStop(0.5, `rgba(255,160,40,${0.45 * (1 - cool)})`); hg.addColorStop(1, 'rgba(255,120,20,0)');
          g.fillStyle = hg; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
        }
        // placas de crosta escura boiando (vão para o outro lado)
        for (let i = 0; i < 6; i++) {
          const ph = rnd() * 6.28, sp = 0.12 + rnd() * 0.2, orb = R * (0.3 + rnd() * 0.6), rr = R * (0.14 + rnd() * 0.16);
          const x = q.x + Math.cos(-t * sp + ph) * orb, y = q.y + Math.sin(-t * sp + ph) * orb * 0.85;
          g.fillStyle = `rgba(40,10,4,${0.45 + cool * 0.4})`;
          g.beginPath();
          for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28 + ph, w = rr * (0.7 + 0.3 * Math.sin(k * 2.3 + ph)); const px = x + Math.cos(a) * w, py = y + Math.sin(a) * w; if (k) g.lineTo(px, py); else g.moveTo(px, py); }
          g.closePath(); g.fill();
          g.strokeStyle = `rgba(255,150,40,${0.6 * (1 - cool)})`; g.lineWidth = 1.5; g.stroke(); // fresta brilhando em volta da crosta
        }
        // veios brilhando que escorrem
        g.strokeStyle = `rgba(255,214,102,${0.55 * (1 - cool)})`; g.lineWidth = 2; g.setLineDash([14, 10]); g.lineDashOffset = -t * 18;
        for (let i = 0; i < 3; i++) {
          const a = rnd() * 6.28, b2 = a + 1.5 + rnd() * 1.5;
          g.beginPath(); g.moveTo(q.x + Math.cos(a) * R * 0.8, q.y + Math.sin(a) * R * 0.8);
          g.quadraticCurveTo(q.x + (rnd() - 0.5) * R * 0.6, q.y + (rnd() - 0.5) * R * 0.6, q.x + Math.cos(b2) * R * 0.8, q.y + Math.sin(b2) * R * 0.8);
          g.stroke();
        }
        g.setLineDash([]);
        // bolhas que estouram
        for (let i = 0; i < 4; i++) {
          const ph = ((t * (0.5 + i * 0.13) + rnd()) % 1), a = rnd() * 6.28, d = R * rnd() * 0.6;
          const x = q.x + Math.cos(a) * d, y = q.y + Math.sin(a) * d;
          g.strokeStyle = `rgba(255,240,180,${(0.8 * (1 - ph) * (1 - cool)).toFixed(2)})`; g.lineWidth = 2;
          g.beginPath(); g.arc(x, y, 2 + ph * 9, 0, Math.PI * 2); g.stroke();
        }
        g.restore();
        // beira de rocha escura com fio quente por dentro
        g.strokeStyle = '#1f0c07'; g.lineWidth = 6; this.lavaPath(g, q, rise); g.stroke();
        g.strokeStyle = `rgba(255,120,20,${0.8 * (1 - cool)})`; g.lineWidth = 1.5; this.lavaPath(g, q, rise * 0.96); g.stroke();
      }
    }
    drawMovingWalls(hz, now) {
      const g = this.ctx, th = this.map.theme;
      const lay = hz && hz.lay != null ? hz.lay : 0;
      for (const R of this.layWalls[lay] || []) {
        g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(R.x + 4, R.y + 5, R.w, R.h);
        g.fillStyle = th.wall; g.fillRect(R.x, R.y, R.w, R.h);
        g.strokeStyle = th.wallEdge; g.lineWidth = 2; g.strokeRect(R.x + 1, R.y + 1, R.w - 2, R.h - 2);
        g.fillStyle = 'rgba(255,120,40,.25)'; g.fillRect(R.x, R.y, R.w, 3); // brilho de lava nas paredes que mexem
      }
      if (hz && hz.s === 1 && hz.nl != null && hz.nl !== lay) { // onde as paredes vão aparecer
        g.setLineDash([8, 6]); g.lineWidth = 2;
        g.strokeStyle = `rgba(255,140,40,${Math.floor(now / 150) % 2 ? 0.9 : 0.4})`;
        for (const R of this.layWalls[hz.nl] || []) g.strokeRect(R.x, R.y, R.w, R.h);
        g.setLineDash([]);
      }
    }

    // ---------- Nave espacial ----------
    drawHoles(hz, now) {
      const g = this.ctx;
      for (const [id, x, y, R, left] of hz.h || []) {
        if (R <= 1) continue;
        const rnd = seeded(id * 131 + 7), pts = [];
        for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; pts.push([x + Math.cos(a) * R * (0.86 + rnd() * 0.22), y + Math.sin(a) * R * (0.86 + rnd() * 0.22)]); }
        const path = () => { g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); };
        g.save(); path(); g.clip();
        g.fillStyle = '#02030a'; g.fillRect(x - R * 1.2, y - R * 1.2, R * 2.4, R * 2.4);
        const srnd = seeded(id * 17 + 3);
        for (let i = 0; i < 40; i++) {
          const b = srnd(), tw = 0.6 + 0.4 * Math.sin(now / 300 + i);
          g.fillStyle = `rgba(255,255,255,${(0.3 + b * 0.7 * tw).toFixed(2)})`;
          g.fillRect(x - R + srnd() * R * 2, y - R + srnd() * R * 2, b > 0.9 ? 2 : 1.2, b > 0.9 ? 2 : 1.2);
        }
        const grd = g.createRadialGradient(x, y, R * 0.4, x, y, R);
        grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,.7)');
        g.fillStyle = grd; g.fillRect(x - R, y - R, R * 2, R * 2);
        g.restore();
        path();
        g.strokeStyle = '#1b2230'; g.lineWidth = 7; g.stroke();
        const hot = Math.max(0, 1 - left / 3); // metal quente logo depois do impacto (left = idade do buraco)
        g.strokeStyle = `rgba(255,${120 + hot * 80},40,${(0.25 + hot * 0.6).toFixed(2)})`; g.lineWidth = 2.5; g.stroke();
      }
    }
    drawMeteors(hz, now) {
      if (hz.s !== 1 || !hz.m) return;
      const g = this.ctx, R = this.cfg.holeRadius, k = hz.k;
      for (const [x, y] of hz.m) {
        const blink = Math.floor(now / (k > 0.6 ? 80 : 160)) % 2 === 0;
        g.fillStyle = `rgba(239,68,68,${blink ? 0.22 : 0.1})`; g.strokeStyle = 'rgba(239,68,68,.9)'; g.lineWidth = 3;
        g.beginPath(); g.arc(x, y, R * (0.4 + k * 0.6), 0, Math.PI * 2); g.fill();
        g.setLineDash([12, 8]); g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
        // meteoro chegando de cima com rastro de fogo
        const dx = x < this.cfg.mapWidth / 2 ? -1 : 1;
        const mx = x + dx * 320 * (1 - k), my = y - 560 * (1 - k), mr = 16 + 10 * (1 - k);
        const tail = g.createLinearGradient(mx, my, mx + dx * 120, my - 210);
        tail.addColorStop(0, 'rgba(255,200,80,.9)'); tail.addColorStop(1, 'rgba(255,80,20,0)');
        g.strokeStyle = tail; g.lineWidth = mr * 1.4; g.lineCap = 'round';
        g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + dx * 120, my - 210); g.stroke();
        g.fillStyle = '#5b4636'; g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#ffb347'; g.lineWidth = 3; g.stroke();
      }
    }

    // cortina de fumaça: [id, x, y, k 0..1]. Miolo totalmente fechado; da metade até a borda vai clareando até sumir
    drawSmoke(m, now) {
      const g = this.ctx, c = this.cfg;
      const [id, x, y, k] = m;
      if (k <= 0) return;
      const R = c.smokeRadius * (0.35 + 0.65 * Math.min(1, k * 1.4)), core = Math.max(0.05, Math.min(0.98, c.smokeCore));
      const a = Math.min(1, k * 1.25);
      g.save();
      // nuvenzinhas girando devagar (textura), mais claras que o miolo
      for (let i = 0; i < 8; i++) {
        const ang = i / 8 * Math.PI * 2 + now / 4000 * (i % 2 ? 1 : -1) + id;
        const px = x + Math.cos(ang) * R * 0.55, py = y + Math.sin(ang) * R * 0.55, pr = R * 0.42;
        const pg = g.createRadialGradient(px, py, 0, px, py, pr);
        pg.addColorStop(0, `rgba(203,213,225,${(0.55 * a).toFixed(3)})`);
        pg.addColorStop(1, 'rgba(203,213,225,0)');
        g.fillStyle = pg; g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2); g.fill();
      }
      const grd = g.createRadialGradient(x, y, 0, x, y, R);
      grd.addColorStop(0, `rgba(186,196,210,${a})`);
      grd.addColorStop(core, `rgba(186,196,210,${a})`);
      grd.addColorStop(core + (1 - core) * 0.45, `rgba(203,213,225,${(0.55 * a).toFixed(3)})`);
      grd.addColorStop(1, 'rgba(203,213,225,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fill();
      g.restore();
    }

    // bomba: [id, x, y, progresso do voo 0..1, time, tempo até explodir, 1 = fumaça]
    drawBomb(b, now) {
      const g = this.ctx, c = this.cfg;
      const [, x, y, k, team, left, smoke] = b;
      const flying = k < 1, h = flying ? Math.sin(Math.PI * k) * 70 : 0;
      if (smoke) { // granada de fumaça: cinza, soltando fumacinha
        g.fillStyle = 'rgba(0,0,0,.3)';
        g.beginPath(); g.ellipse(x + 2, y + 4, 8, 4, 0, 0, Math.PI * 2); g.fill();
        const bx = x, by = y - h, br = 8 * (1 + h / 140);
        g.fillStyle = '#94a3b8';
        g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.fill();
        g.strokeStyle = TEAM[team]; g.lineWidth = 2; g.stroke();
        g.fillStyle = 'rgba(226,232,240,.6)';
        const w = (now / 120) % 3;
        g.beginPath(); g.arc(bx - 2, by - br - 3 - w * 2, 3 + w, 0, Math.PI * 2); g.fill();
        return;
      }
      if (!flying) { // área da explosão
        const warn = Math.floor(now / (left < 0.3 ? 60 : 120)) % 2 === 0;
        g.fillStyle = `rgba(${TEAM_RGB[team]},${warn ? 0.18 : 0.08})`;
        g.strokeStyle = `rgba(${TEAM_RGB[team]},.7)`; g.lineWidth = 2;
        g.beginPath(); g.arc(x, y, c.bombRadius, 0, Math.PI * 2); g.fill(); g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,.3)';
      g.beginPath(); g.ellipse(x + 2, y + 4, 9, 5, 0, 0, Math.PI * 2); g.fill();
      const bx = x, by = y - h, br = 9 * (1 + h / 140);
      g.fillStyle = '#1f2937';
      g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.fill();
      g.strokeStyle = TEAM[team]; g.lineWidth = 2.5; g.stroke();
      // pavio aceso
      g.fillStyle = Math.floor(now / 80) % 2 ? '#ffd166' : '#ff6b35';
      g.beginPath(); g.arc(bx + br * 0.6, by - br * 0.7, 3, 0, Math.PI * 2); g.fill();
    }

    // mira da bomba: círculo do alcance + ponto onde vai cair
    drawBombAim(A) {
      const g = this.ctx, c = this.cfg;
      g.save();
      g.setLineDash([10, 8]); g.lineWidth = 2;
      g.strokeStyle = 'rgba(255,255,255,.55)';
      g.beginPath(); g.arc(A.x, A.y, c.bombRange, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.35)';
      g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(A.tx, A.ty); g.stroke();
      g.setLineDash([]);
      g.fillStyle = 'rgba(255,200,80,.15)'; g.strokeStyle = 'rgba(255,200,80,.85)';
      g.beginPath(); g.arc(A.tx, A.ty, c.bombRadius, 0, Math.PI * 2); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(A.tx - 8, A.ty); g.lineTo(A.tx + 8, A.ty); g.moveTo(A.tx, A.ty - 8); g.lineTo(A.tx, A.ty + 8); g.stroke();
      g.restore();
    }

    drawTornado(T, now) {
      if (!T.s) return;
      const g = this.ctx, R = this.cfg.tornadoRadius;
      const active = T.s === 2;
      const grow = active ? 1 : Math.max(0.15, T.k);
      const Rg = R * grow;
      const rot = now / (active ? 180 : 420);
      g.save();
      g.translate(T.x, T.y);
      // sombra/poeira leve no chão
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, Rg);
      grd.addColorStop(0, `rgba(230,240,230,${active ? 0.22 : 0.1})`);
      grd.addColorStop(1, 'rgba(230,240,230,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(0, 0, Rg, 0, Math.PI * 2); g.fill();
      g.lineCap = 'round';
      // braços em espiral (vento)
      const arms = 6;
      for (let a = 0; a < arms; a++) {
        const base = rot + (a / arms) * Math.PI * 2;
        const steps = 22;
        for (let i = 1; i < steps; i++) {
          const t0 = (i - 1) / steps, t1 = i / steps;
          const r0 = Rg * (0.12 + t0 * 0.95), r1 = Rg * (0.12 + t1 * 0.95);
          const a0 = base + t0 * 2.6, a1 = base + t1 * 2.6; // curvatura da espiral
          const alpha = (active ? 0.55 : 0.28) * Math.sin(Math.PI * t1);
          g.strokeStyle = `rgba(245,250,245,${alpha.toFixed(3)})`;
          g.lineWidth = Math.max(1.5, R * 0.05 * (1 - t1 * 0.6));
          g.beginPath();
          g.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0);
          g.lineTo(Math.cos(a1) * r1, Math.sin(a1) * r1);
          g.stroke();
        }
      }
      // rajadas soltas em volta
      for (let i = 0; i < 10; i++) {
        const a = rot * 1.6 + i * 0.63, rr = Rg * (0.55 + ((i * 37) % 40) / 100);
        g.strokeStyle = `rgba(255,255,255,${active ? 0.35 : 0.15})`;
        g.lineWidth = 2;
        g.beginPath(); g.arc(0, 0, rr, a, a + 0.5); g.stroke();
      }
      // olho do furacão
      g.fillStyle = `rgba(255,255,255,${active ? 0.3 : 0.15})`;
      g.beginPath(); g.arc(0, 0, Rg * 0.1, 0, Math.PI * 2); g.fill();
      g.restore();
    }

    // tempestade de areia: duas paredes saindo do meio para as laterais;
    // bordas tampam um pouco a visão, o miolo tampa tudo
    drawSand(S, now) {
      if (!S.s) return;
      const g = this.ctx, c = this.cfg, W = c.mapWidth, H = c.mapHeight, cx = W / 2;
      g.save();
      if (S.s === 1) {
        const grd = g.createRadialGradient(cx, H / 2, 0, cx, H / 2, W * 0.12);
        grd.addColorStop(0, `rgba(200,160,100,${0.35 + 0.15 * Math.sin(now / 70)})`);
        grd.addColorStop(1, 'rgba(200,160,100,0)');
        g.fillStyle = grd;
        g.fillRect(cx - W * 0.12, 0, W * 0.24, H);
        g.restore();
        return;
      }
      const w = S.w;
      for (const side of [-1, 1]) {
        const x = cx + side * S.d;
        const x0 = x - w / 2, x1 = x + w / 2;
        const grd = g.createLinearGradient(x0, 0, x1, 0);
        // degradê: bordas escurecem aos poucos (ainda dá pra ver), miolo tampa tudo
        grd.addColorStop(0, 'rgba(150,108,58,0)');
        grd.addColorStop(0.08, 'rgba(150,108,58,.35)');
        grd.addColorStop(0.2, 'rgba(160,116,64,.62)');
        grd.addColorStop(0.36, 'rgba(176,132,76,1)');
        grd.addColorStop(0.64, 'rgba(176,132,76,1)');
        grd.addColorStop(0.8, 'rgba(160,116,64,.62)');
        grd.addColorStop(0.92, 'rgba(150,108,58,.35)');
        grd.addColorStop(1, 'rgba(150,108,58,0)');
        g.fillStyle = grd;
        g.fillRect(Math.max(0, x0), 0, Math.min(W, x1) - Math.max(0, x0), H);
        // grãos de areia voando
        g.fillStyle = 'rgba(235,205,150,.55)';
        for (let i = 0; i < 90; i++) {
          const px = x0 + ((i * 71.3 + now * 0.25 * side * (1 + (i % 3))) % w + w) % w;
          const py = ((i * 131.7 + now * 0.06 * (i % 5)) % H + H) % H;
          g.fillRect(px, py, 3 + (i % 4), 1.5);
        }
      }
      g.restore();
    }

    drawStorm(S, now) {
      if (!S.s) return;
      const g = this.ctx, c = this.cfg;
      const x0 = S.x0, w = S.x1 - S.x0;
      g.save();
      if (S.s === 1) {
        // aviso: faixa central piscando no topo
        g.fillStyle = `rgba(150,200,255,${0.12 + 0.1 * Math.sin(now / 60)})`;
        g.fillRect(x0, 0, w, c.mapHeight);
        g.strokeStyle = 'rgba(80,140,220,.7)'; g.setLineDash([10, 8]); g.lineWidth = 3;
        g.strokeRect(x0, 0, w, c.mapHeight); g.setLineDash([]);
      } else {
        const y0 = Math.max(0, S.y0), y1 = Math.min(c.mapHeight, S.y0 + S.h);
        const grd = g.createLinearGradient(0, S.y0, 0, S.y0 + S.h);
        grd.addColorStop(0, 'rgba(120,180,240,.18)'); grd.addColorStop(0.6, 'rgba(140,195,245,.5)'); grd.addColorStop(1, 'rgba(170,215,255,.7)');
        g.fillStyle = grd;
        g.fillRect(x0, y0, w, Math.max(0, y1 - y0));
        // flocos
        g.fillStyle = 'rgba(255,255,255,.95)';
        for (let i = 0; i < 70; i++) {
          const fx = x0 + ((i * 97.3 + now * 0.05 * (1 + (i % 3))) % w);
          const fy = S.y0 + ((i * 53.7 + now * 0.35) % S.h);
          if (fy < 0 || fy > c.mapHeight) continue;
          g.beginPath(); g.arc(fx, fy, 2 + (i % 3), 0, Math.PI * 2); g.fill();
        }
      }
      g.restore();
    }

    drawPlayer(p, isMe, now) {
      const g = this.ctx, c = this.cfg;
      const r = p.r;
      if (!p.al) {
        g.globalAlpha = 0.35;
        g.fillStyle = '#222';
        g.beginPath(); g.arc(p.x, p.y, c.playerRadius * 0.6, 0, Math.PI * 2); g.fill();
        g.strokeStyle = TEAM[p.tm]; g.lineWidth = 3;
        const k = c.playerRadius * 0.35;
        g.beginPath(); g.moveTo(p.x - k, p.y - k); g.lineTo(p.x + k, p.y + k); g.moveTo(p.x + k, p.y - k); g.lineTo(p.x - k, p.y + k); g.stroke();
        g.globalAlpha = 1;
        return;
      }
      const jumping = p.jz >= 0;
      const arc = jumping ? Math.sin(Math.PI * p.jz) : 0;
      const sc = 1 + 0.55 * arc;
      const lift = arc * c.playerRadius * 1.1;
      // sombra
      g.fillStyle = 'rgba(0,0,0,' + (0.28 - arc * 0.12) + ')';
      g.beginPath(); g.ellipse(p.x + 3, p.y + r * 0.35 + 3, r * (1 - arc * 0.25), r * 0.55 * (1 - arc * 0.25), 0, 0, Math.PI * 2); g.fill();

      const blinkOff = p.bl && Math.floor(now / 90) % 2 === 0;
      g.save();
      g.globalAlpha = blinkOff ? 0.25 : 1;
      g.translate(p.x, p.y - lift);
      g.scale(sc, sc);
      if (p.ts) g.rotate(now / 60); // girando, jogado pelo furacão
      const ang = Math.atan2(p.fy, p.fx);

      // arma / faca
      g.save();
      g.rotate(ang);
      if (p.w === 1) {
        g.fillStyle = '#2b2b2b';
        g.fillRect(r * 0.5, -r * 0.2, r * 1.05, r * 0.4);
        g.fillStyle = '#555';
        g.fillRect(r * 1.35, -r * 0.14, r * 0.25, r * 0.28);
      } else {
        const sw = p.ka ? 0.9 : 0;
        g.rotate(sw * Math.sin(now / 40));
        g.fillStyle = '#6b4a2b';
        g.fillRect(r * 0.55, -r * 0.1, r * 0.35, r * 0.2);
        g.fillStyle = '#d9dee6';
        g.beginPath(); g.moveTo(r * 0.9, -r * 0.16); g.lineTo(r * 1.75, 0); g.lineTo(r * 0.9, r * 0.16); g.closePath(); g.fill();
      }
      g.restore();
      if (p.ka) {
        // área real do golpe (mesma usada para calcular o acerto), parada na direção do golpe
        const reach = r + c.knifeRange, half = (c.knifeArc / 2) * Math.PI / 180, kd = p.kd != null ? p.kd : ang;
        g.fillStyle = 'rgba(255,255,255,.14)';
        g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, reach, kd - half, kd + half); g.closePath(); g.fill();
        g.beginPath(); g.arc(0, 0, reach, kd - half, kd + half); g.stroke();
      }

      // corpo da cor do time (pisca mais claro na proteção ao renascer)
      const prot = p.sp && Math.floor(now / 100) % 2 === 0;
      g.fillStyle = prot ? TEAM_LIGHT[p.tm] : TEAM_BODY[p.tm];
      g.beginPath(); g.arc(0, 0, r * 0.9, 0, Math.PI * 2); g.fill();
      // borda = carregamento do próximo tiro (fecha o círculo quando está pronto)
      let prog = 1;
      if (p.w === 1) {
        if (p.rl > 0) prog = 1 - p.rl / c.reloadTime;
        else if (p.fc > 0) prog = 1 - p.fc / c.fireCooldown;
      }
      prog = Math.max(0, Math.min(1, prog));
      const rw = Math.max(2, r * 0.2);
      // trilho branco com contorno preto fino: aparece bem tanto em mapa claro (deserto) quanto escuro
      g.lineWidth = rw + 2;
      g.strokeStyle = 'rgba(0,0,0,.85)';
      g.beginPath(); g.arc(0, 0, r - rw / 2, 0, Math.PI * 2); g.stroke();
      g.lineWidth = rw;
      g.strokeStyle = '#f8fafc';
      g.beginPath(); g.arc(0, 0, r - rw / 2, 0, Math.PI * 2); g.stroke();
      if (prog > 0) {
        g.strokeStyle = TEAM_STRONG[p.tm];
        g.beginPath(); g.arc(0, 0, r - rw / 2, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); g.stroke();
      }
      const img = this.avatar(p.avatar);
      if (img) {
        g.save();
        g.beginPath(); g.arc(0, 0, r * 0.66, 0, Math.PI * 2); g.clip();
        g.drawImage(img, -r * 0.66, -r * 0.66, r * 1.32, r * 1.32);
        g.restore();
      } else {
        // olhos na direção que olha
        g.fillStyle = '#111';
        const ex = p.fx * r * 0.3, ey = p.fy * r * 0.3;
        const px = -p.fy * r * 0.25, py = p.fx * r * 0.25;
        g.beginPath(); g.arc(ex + px, ey + py, r * 0.12, 0, Math.PI * 2); g.arc(ex - px, ey - py, r * 0.12, 0, Math.PI * 2); g.fill();
      }
      if (p.sk === 2) { // congelado
        g.fillStyle = 'rgba(170,220,255,.45)';
        g.beginPath(); g.arc(0, 0, r * 1.05, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(220,245,255,.95)'; g.lineWidth = 2;
        g.beginPath();
        for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.moveTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9); g.lineTo(Math.cos(a) * r * 1.25, Math.sin(a) * r * 1.25); }
        g.stroke();
      } else if (p.sk === 1) { // espinho de cacto
        g.strokeStyle = 'rgba(90,160,60,.9)'; g.lineWidth = 2;
        g.beginPath(); g.arc(0, 0, r * 1.12, now / 80, now / 80 + Math.PI * 1.2); g.stroke();
      }
      g.restore();

      // nome (o seu fica amarelo); a vida aparece só no HUD
      const fs = Math.max(11, c.playerRadius * 0.62);
      g.font = `700 ${fs}px Segoe UI, sans-serif`;
      g.textAlign = 'center';
      g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.75)';
      const ty = p.y - lift - r * sc - 8;
      g.strokeText(p.name || '', p.x, ty);
      g.fillStyle = isMe ? '#ffcc33' : p.tm === 'A' ? '#bcd4ff' : '#ffc4c4';
      g.fillText(p.name || '', p.x, ty);
    }

    // bala com N partições: as que já bateram ficam claras
    drawBullet(b) {
      const g = this.ctx, c = this.cfg;
      const x = b[1], y = b[2], hits = b[3], team = b[4];
      const n = c.maxBounces, r = c.bulletRadius;
      for (let i = 0; i < n; i++) {
        const a0 = -Math.PI / 2 + (i / n) * Math.PI * 2, a1 = -Math.PI / 2 + ((i + 1) / n) * Math.PI * 2;
        g.fillStyle = i < hits ? '#f1f5f9' : TEAM_DARK[team];
        g.beginPath(); g.moveTo(x, y); g.arc(x, y, r, a0, a1); g.closePath(); g.fill();
      }
      g.strokeStyle = TEAM[team]; g.lineWidth = Math.max(1, r * 0.25);
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
      if (n > 1) {
        g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = Math.max(0.6, r * 0.12);
        g.beginPath();
        for (let i = 0; i < n; i++) {
          const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
          g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        g.stroke();
      }
    }

    drawEffects(now) {
      const g = this.ctx;
      this.effects = this.effects.filter((e) => now - e.t0 < e.d);
      for (const e of this.effects) {
        const t = (now - e.t0) / e.d;
        g.globalAlpha = 1 - t;
        if (e.k === 'boom') {
          const R = this.cfg.bombRadius;
          const grd = this.ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, R * (0.6 + t * 0.6));
          grd.addColorStop(0, 'rgba(255,240,180,.95)'); grd.addColorStop(0.5, 'rgba(255,140,40,.7)'); grd.addColorStop(1, 'rgba(120,40,10,0)');
          g.fillStyle = grd;
          g.beginPath(); g.arc(e.x, e.y, R * (0.6 + t * 0.6), 0, Math.PI * 2); g.fill();
        } else if (e.k === 'fall') { // espiral sumindo no buraco
          g.strokeStyle = '#e2e8f0'; g.lineWidth = 3;
          g.beginPath();
          for (let a = 0; a < Math.PI * 4; a += 0.3) { const rr = (1 - t) * (30 - a * 2); g.lineTo(e.x + Math.cos(a + t * 8) * rr, e.y + Math.sin(a + t * 8) * rr); }
          g.stroke();
        } else if (e.k === 'sucked') {
          g.strokeStyle = 'rgba(147,197,253,.9)'; g.lineWidth = 2;
          g.beginPath(); g.arc(e.x, e.y, 12 * (1 - t) + 1, 0, Math.PI * 2); g.stroke();
        } else if (e.k === 'lamp') {
          g.fillStyle = '#fde68a';
          for (let q = 0; q < 6; q++) { const a = q / 6 * Math.PI * 2; g.beginPath(); g.arc(e.x + Math.cos(a) * t * 26, e.y + Math.sin(a) * t * 26, 2.5, 0, Math.PI * 2); g.fill(); }
        } else if (e.k === 'spark') {
          g.strokeStyle = '#fff'; g.lineWidth = 2;
          g.beginPath(); g.arc(e.x, e.y, 4 + t * 14, 0, Math.PI * 2); g.stroke();
        } else {
          g.fillStyle = e.k === 'kill' ? '#ffcc33' : '#ff4d6d';
          g.font = `900 ${e.k === 'kill' ? 30 : 24}px Segoe UI, sans-serif`;
          g.textAlign = 'center';
          g.fillText(e.k === 'kill' ? '✖' : '-1', e.x, e.y - 30 - t * 30);
          g.strokeStyle = g.fillStyle; g.lineWidth = 3;
          g.beginPath(); g.arc(e.x, e.y, 10 + t * 40, 0, Math.PI * 2); g.stroke();
        }
      }
      g.globalAlpha = 1;
    }
  }
  // mini visualização do mapa (criação de sala / sala de espera)
  Renderer.preview = function (canvas, cfg, mapId) {
    if (!canvas._pbr) {
      canvas._pbr = new Renderer(canvas);
      window.addEventListener('resize', () => canvas._pbr.draw({ players: [], bullets: [] }));
    }
    const r = canvas._pbr;
    r.setup(Object.assign({}, cfg, { mapScreenScale: 1 }), mapId);
    r.draw({ players: [], bullets: [] });
    return r;
  };

  return Renderer;
})();
