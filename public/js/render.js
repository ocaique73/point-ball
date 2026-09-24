// Desenho do jogo no canvas (usado no jogo online e na página /teste)
window.PBRenderer = (function () {
  const TEAM = { A: '#3b82f6', B: '#ef4444' };
  const TEAM_DARK = { A: '#1e3a8a', B: '#7f1d1d' };
  const TEAM_RGB = { A: '96,165,250', B: '248,113,113' };
  const TEAM_BODY = { A: '#60a5fa', B: '#f87171' };

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
      this.walls = RC_GAME.buildWalls(this.mapId, cfg);
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
      // muros
      for (const R of this.walls) {
        const x = R.x * s, y = R.y * s, w = R.w * s, h = R.h * s;
        g.fillStyle = 'rgba(0,0,0,.22)';
        g.fillRect(x + 4 * s, y + 5 * s, w, h);
      }
      for (const R of this.walls) {
        const x = R.x * s, y = R.y * s, w = R.w * s, h = R.h * s;
        g.fillStyle = R.border ? th.border : th.wall;
        g.fillRect(x, y, w, h);
        g.strokeStyle = th.wallEdge; g.lineWidth = Math.max(1, 2 * s);
        g.strokeRect(x + 1, y + 1, w - 2, h - 2);
        g.fillStyle = 'rgba(255,255,255,.12)';
        g.fillRect(x, y, w, Math.max(1, 3 * s));
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
      this.updateTrails(view.bullets);
      const light = view.light || 0;
      const dark = light === 2 || (light === 1 && Math.floor(now / 70) % 2 === 0);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = dark ? '#000' : '#070a10';
      g.fillRect(0, 0, this.canvas.width, this.canvas.height);

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
      const ps = view.players.slice().sort((a, b) => (a.al - b.al) || ((a.jz >= 0) - (b.jz >= 0)));
      if (view.hz && view.hz.t === 'storm') this.drawStorm(view.hz, now);
      for (const p of ps) this.drawPlayer(p, p.id === view.meId, now);
      if (view.hz && view.hz.t === 'tornado') this.drawTornado(view.hz, now);
      this.drawTrails(0.28);
      for (const b of view.bullets) this.drawBullet(b);
      this.drawEffects(now);
      if (view.hz && view.hz.t === 'sand') this.drawSand(view.hz, now); // por cima de tudo
      g.setTransform(1, 0, 0, 1, 0, 0);
    }

    // furacão visto de cima: braços de vento em espiral, meio transparentes, girando
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

      // corpo: anel do time + cor do jogador + foto
      g.fillStyle = TEAM[p.tm];
      g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = TEAM_BODY[p.tm]; // boneco da cor do time
      g.beginPath(); g.arc(0, 0, r * 0.8, 0, Math.PI * 2); g.fill();
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
      if (isMe) {
        g.strokeStyle = '#fff'; g.lineWidth = Math.max(2, r * 0.1);
        g.beginPath(); g.arc(0, 0, r + 3, 0, Math.PI * 2); g.stroke();
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
        if (e.k === 'spark') {
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
