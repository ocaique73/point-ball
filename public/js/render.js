// Desenho do jogo no canvas (usado no jogo online e na página /teste)
window.PBRenderer = (function () {
  const TEAM = { A: '#3b82f6', B: '#ef4444' };
  const TEAM_DARK = { A: '#1e3a8a', B: '#7f1d1d' };

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
      this.scale = Math.min(this.canvas.width / W, this.canvas.height / H) * this.cfg.mapScreenScale;
      this.ox = (this.canvas.width - W * this.scale) / 2;
      this.oy = (this.canvas.height - H * this.scale) / 2;
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
      for (let i = 0; i < 260; i++) {
        g.beginPath();
        g.ellipse(rnd() * W, rnd() * H, (6 + rnd() * 26) * s, (3 + rnd() * 12) * s, rnd() * Math.PI, 0, Math.PI * 2);
        g.fill();
      }
      // decoração (sem colisão)
      for (let i = 0; i < 38; i++) {
        const x = rnd() * W, y = rnd() * H, k = 0.6 + rnd() * 0.8;
        if (th.deco === 'cactus') {
          g.fillStyle = '#6a9a4a'; g.strokeStyle = '#4c7535'; g.lineWidth = 2 * s;
          g.beginPath(); g.roundRect(x - 5 * s * k, y - 16 * s * k, 10 * s * k, 26 * s * k, 5 * s * k); g.fill(); g.stroke();
          g.beginPath(); g.roundRect(x - 14 * s * k, y - 8 * s * k, 7 * s * k, 12 * s * k, 3 * s * k); g.fill();
          g.beginPath(); g.roundRect(x + 7 * s * k, y - 12 * s * k, 7 * s * k, 12 * s * k, 3 * s * k); g.fill();
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

    // view = { players: [...], bullets: [[id,x,y,hits,team]], meId }
    draw(view) {
      const g = this.ctx, s = this.scale, c = this.cfg;
      if (!c) return;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = '#070a10';
      g.fillRect(0, 0, this.canvas.width, this.canvas.height);
      if (this.bg) g.drawImage(this.bg, Math.round(this.ox), Math.round(this.oy));
      g.setTransform(s, 0, 0, s, this.ox, this.oy);
      const now = performance.now();

      // mortos primeiro, depois vivos, pulando por último (ficam por cima)
      const ps = view.players.slice().sort((a, b) => (a.al - b.al) || ((a.jz >= 0) - (b.jz >= 0)));
      for (const p of ps) this.drawPlayer(p, p.id === view.meId, now);
      for (const b of view.bullets) this.drawBullet(b);
      this.drawEffects(now);
      g.setTransform(1, 0, 0, 1, 0, 0);
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
        if (p.ka) {
          g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 3;
          const reach = r + c.knifeRange;
          const half = (c.knifeArc / 2) * Math.PI / 180;
          g.beginPath(); g.arc(0, 0, reach, -half, half); g.stroke();
        }
      }
      g.restore();

      // corpo: anel do time + cor do jogador + foto
      g.fillStyle = TEAM[p.tm];
      g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = p.color || '#ffcc00';
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
      if (isMe) {
        g.strokeStyle = '#fff'; g.lineWidth = Math.max(2, r * 0.1);
        g.beginPath(); g.arc(0, 0, r + 3, 0, Math.PI * 2); g.stroke();
      }
      g.restore();

      // nome e vidas
      const fs = Math.max(11, c.playerRadius * 0.62);
      g.font = `700 ${fs}px Segoe UI, sans-serif`;
      g.textAlign = 'center';
      g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.75)';
      const ty = p.y - lift - r * sc - 8;
      g.strokeText(p.name || '', p.x, ty);
      g.fillStyle = p.tm === 'A' ? '#bcd4ff' : '#ffc4c4';
      g.fillText(p.name || '', p.x, ty);
      const total = c.lives;
      for (let i = 0; i < total; i++) {
        g.fillStyle = i < p.l ? '#ff4d6d' : 'rgba(255,255,255,.25)';
        g.beginPath(); g.arc(p.x + (i - (total - 1) / 2) * 10, ty + 8, 3.5, 0, Math.PI * 2); g.fill();
      }
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
  return Renderer;
})();
