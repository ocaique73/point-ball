// Página /teste: ajusta a configuração e testa localmente contra bots
(async function () {
  const $ = (id) => document.getElementById(id);
  const { DEFAULT_CONFIG, LIMITS, mergeConfig } = RC_CONFIG;

  const GROUPS = [
    ['Mapa', { mapWidth: 'Largura do mapa', mapHeight: 'Altura do mapa', wallThickness: 'Grossura do muro', mapScreenScale: 'Tamanho do mapa na tela' }],
    ['Personagem', { playerRadius: 'Tamanho do personagem (raio)', playerSpeed: 'Velocidade do personagem', lives: 'Vidas',
      hitShrink: 'Tamanho após perder 1 vida (0.5 = 50%)', blinkDuration: 'Tempo piscando (s)', invulnDuration: 'Invulnerável após acerto (s)' }],
    ['Tiro', { bulletRadius: 'Tamanho da bala (raio)', bulletSpeed: 'Velocidade da bala', maxBounces: 'Batidas na parede',
      fireCooldown: 'Intervalo entre tiros (s)', magSize: 'Balas por pente', magazines: 'Pentes extras (recargas)', reloadTime: 'Tempo de recarga (s)' }],
    ['Faca', { knifeCooldown: 'Intervalo da facada (s)', knifeRange: 'Alcance da faca', knifeArc: 'Abertura do golpe (graus)' }],
    ['Super pulo', { jumpCooldown: 'Tempo para ganhar pulo (s)', jumpDistance: 'Distância do pulo', jumpDuration: 'Tempo no ar (s)', jumpStartReady: 'Começa o round com pulo' }],
    ['Deserto: tempestade de areia', { sandInterval: 'A cada (s)', sandWarn: 'Aviso antes (s)', sandDuration: 'Tempo do meio até as laterais (s)', sandBand: 'Largura da parede de areia' }],
    ['Floresta: furacão', { tornadoInterval: 'A cada (s)', tornadoGrow: 'Tempo nascendo (s)', tornadoActive: 'Tempo andando (s)', tornadoRadius: 'Tamanho do furacão',
      tornadoSpeed: 'Velocidade do furacão', tornadoThrow: 'Distância que joga', tornadoAirTime: 'Tempo no ar ao ser jogado (s)' }],
    ['Neve: tempestade fria', { stormInterval: 'A cada (s)', stormWarn: 'Aviso antes (s)', stormDuration: 'Tempo descendo (s)', 
      stormBand: 'Altura da nevasca', freezeSlow: 'Velocidade congelado', freezeTime: 'Tempo congelado (s)' }],
    ['Bomba', { bombCount: 'Bombas por vida/round', bombRange: 'Alcance do lançamento', bombFlight: 'Tempo voando (s)', bombFuse: 'Tempo até explodir no chão (s)', bombRadius: 'Raio da explosão' }], ['Cidade à noite', { lampLight: 'Luz do poste (raio)', lampOff: 'Poste apagado (s)', nightSee: 'Você enxerga em volta', nightDark: 'Escuridão (0-1)' }], ['Vulcão', { lavaInterval: 'Lava a cada (s)', lavaWarn: 'Aviso antes (s)', lavaDuration: 'Tempo com lava (s)', lavaPairs: 'Pares de poças', lavaRadius: 'Tamanho da poça' }], ['Nave espacial', { meteorInterval: 'Meteoros a cada (s)', meteorWarn: 'Aviso antes (s)', holeRadius: 'Tamanho do buraco', holeTime: 'Buraco dura (s)', holeGrace: 'Segura na beira (s)', holePull: 'Força que puxa' }], ['Fumaça', { smokeCount: 'Fumaças por vida/round', smokeRadius: 'Raio da fumaça', smokeTime: 'Duração (s)', smokeCore: 'Miolo fechado (0-1)' }],
    ['Mata-mata', { respawnDelay: 'Tempo para renascer (s)', spawnProtect: 'Proteção ao renascer (s)' }],
    ['Rei da colina', { hillRadius: 'Tamanho da colina', hillPointsPerSec: 'Pontos por segundo', hillMoveEvery: 'Muda de lugar a cada (s)' }],
    ['Portais', { portalFirstOpen: 'Abertos no começo, cima/baixo (s)', portalFirstClosed: 'Depois fechados (s)', portalOpen: 'Tempo aberto (s)', portalClosed: 'Tempo fechado (s)' }],
    ['Sala escura', { lightsInterval: 'Luz acesa por (s)', lightsFlicker: 'Pisca antes de apagar (s)', lightsOffDuration: 'Luz apagada por (s)', bulletGlow: 'Brilho do tiro no escuro' }],
    ['HUD', { hudScale: 'Tamanho do HUD' }],
    ['Partida', { roundTime: 'Tempo do round (s)', roundStartDelay: 'Contagem antes do round (s)', roundEndDelay: 'Pausa após o round (s)' }]
  ];
  const REBUILD = ['mapWidth', 'mapHeight', 'wallThickness'];

  // base: config atual do servidor (inclui game-config.json se existir)
  let serverCfg = DEFAULT_CONFIG;
  try { serverCfg = mergeConfig(DEFAULT_CONFIG, await (await fetch('/api/config')).json()); } catch (e) {}
  // valores salvos de uma versão antiga dos padrões são descartados
  let saved = PB.store.get('pb_teste_cfg', null);
  if (saved && saved.cfgVersion !== DEFAULT_CONFIG.cfgVersion) { saved = null; PB.store.set('pb_teste_cfg', null); }
  const cfg = mergeConfig(serverCfg, saved);
  cfg.cfgVersion = DEFAULT_CONFIG.cfgVersion;

  const renderer = new PBRenderer($('game-canvas'));
  renderer.reserveTop = 84; // altura do HUD de cima (px)
  const hud = new PBHud.Hud($('hud-root'));
  let mapId = PB.store.get('pb_teste_map', 'deserto');
  $('t-map').value = mapId;
  let game;

  function newGame() {
    game = new RC_GAME.Game(cfg, { mode: 'sandbox', mapId });
    const pr = PB.getProfile();
    game.addPlayer({ id: 'me', name: pr.name, team: 'A' });
    const n = Math.max(0, Math.min(5, Number($('t-bots').value) || 0));
    const names = RC_BOTS.randomNames(n);
    for (let i = 0; i < n; i++) {
      const b = game.addPlayer({ id: 'bot' + i, name: names[i], team: 'B', bot: true });
      b.botLevel = $('t-level').value;
      b.ai = { t: 0, mx: 0, my: 0 };
    }
    renderer.setup(cfg, mapId);
  }

  // ---- painel ----
  function buildPanel() {
    const panel = $('cfg-panel');
    panel.innerHTML = '';
    for (const [title, items] of GROUPS) {
      const g = document.createElement('div');
      g.className = 'cfg-group';
      g.innerHTML = `<h4>${title}</h4>`;
      for (const key of Object.keys(items)) {
        const row = document.createElement('div');
        row.className = 'cfg-item';
        if (typeof DEFAULT_CONFIG[key] === 'boolean') {
          row.innerHTML = `<span>${items[key]}</span><input type="checkbox" data-k="${key}" ${cfg[key] ? 'checked' : ''}>`;
        } else {
          const [mn, mx, st] = LIMITS[key];
          row.innerHTML = `<span>${items[key]}</span><input type="number" data-k="${key}" min="${mn}" max="${mx}" step="${st}" value="${cfg[key]}">
            <input type="range" data-k="${key}" min="${mn}" max="${mx}" step="${st}" value="${cfg[key]}">`;
        }
        g.appendChild(row);
      }
      panel.appendChild(g);
    }
    panel.querySelectorAll('input').forEach((inp) => inp.addEventListener('input', () => {
      const k = inp.dataset.k;
      let v = inp.type === 'checkbox' ? inp.checked : Number(inp.value);
      if (typeof v === 'number') {
        if (!isFinite(v)) return;
        const [mn, mx] = LIMITS[k]; v = Math.min(mx, Math.max(mn, v));
        panel.querySelectorAll(`input[data-k="${k}"]`).forEach((o) => { if (o !== inp) o.value = v; });
      }
      apply(k, v);
    }));
  }

  function apply(k, v) {
    cfg[k] = v;
    PB.store.set('pb_teste_cfg', cfg);
    if (REBUILD.includes(k)) { game.buildMap(); renderer.setup(cfg, mapId); respawnAll(); }
    else if (k === 'mapScreenScale') renderer.resize();
    else if (k === 'lives' || k === 'magSize' || k === 'magazines') respawnAll();
    else if (k === 'jumpCooldown') {
      for (const p of game.players.values()) if (p.jumps < 1) p.jumpReadyAt = Math.min(p.jumpReadyAt, game.time + v);
    }
  }

  function respawnAll() {
    const slots = { A: 0, B: 0 };
    for (const p of game.players.values()) { const st = p.stats; game.resetPlayer(p, slots[p.team]++); p.stats = st; }
    game.bullets = [];
  }

  $('t-map').onchange = () => { mapId = $('t-map').value; PB.store.set('pb_teste_map', mapId); newGame(); };
  $('t-bots').onchange = newGame;
  $('t-level').onchange = () => { for (const p of game.players.values()) if (p.bot) p.botLevel = $('t-level').value; };
  $('btn-respawn').onclick = respawnAll;
  $('btn-reset').onclick = () => {
    if (!confirm('Restaurar todos os valores padrão?')) return;
    Object.assign(cfg, DEFAULT_CONFIG);
    PB.store.set('pb_teste_cfg', null);
    buildPanel(); newGame();
  };
  $('btn-dl').onclick = () => {
    const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'game-config.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('btn-copy').onclick = () => {
    const txt = JSON.stringify(cfg, null, 2);
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => PB.toast('JSON copiado!'), () => prompt('Copie:', txt));
  };
  $('file-in').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      Object.assign(cfg, mergeConfig(DEFAULT_CONFIG, JSON.parse(await f.text())));
      cfg.cfgVersion = DEFAULT_CONFIG.cfgVersion;
      PB.store.set('pb_teste_cfg', cfg);
      buildPanel(); newGame();
      PB.toast('Configuração importada!');
    } catch (err) { PB.toast('Arquivo inválido.'); }
    e.target.value = '';
  };

  // ---- teclado ----
  let mouse = null, bombAiming = false;
  function bombTarget() {
    const me = game.players.get('me');
    if (!mouse || !me) return null;
    const w = renderer.screenToWorld(mouse.x, mouse.y);
    let dx = w.x - me.x, dy = w.y - me.y; const d = Math.hypot(dx, dy);
    if (d > cfg.bombRange) { dx *= cfg.bombRange / d; dy *= cfg.bombRange / d; }
    return { x: me.x + dx, y: me.y + dy };
  }
  window.addEventListener('mousemove', (e) => { mouse = { x: e.clientX, y: e.clientY }; });
  PBHud.bindKeys({
    mouseEl: $('game-canvas'),
    enabled: () => true,
    onChange: (k) => game.setInput('me', k),
    onWeapon: (w) => game.setWeapon('me', w === 2 ? 'knife' : 'gun'),
    onReload: () => game.requestReload('me'),
    onJump: () => game.requestJump('me'),
    onBomb: (down) => {
      if (down) { bombAiming = true; return; }
      if (!bombAiming) return;
      bombAiming = false;
      const t = bombTarget(); if (t) game.throwBomb('me', t.x, t.y);
    },
    onSmoke: () => { const t = bombTarget(); if (t) game.throwBomb('me', t.x, t.y, 'smoke'); }
  });

  // ---- bots ----
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7], [0, 0]];
  function botThink(dt) {
    if ($('t-smart').checked) { for (const b of game.players.values()) if (b.bot) RC_BOTS.think(game, b, dt); return; }
    const me = game.players.get('me');
    for (const b of game.players.values()) {
      if (!b.bot || !b.alive) continue;
      b.ai.t -= dt;
      const inp = { up: false, down: false, left: false, right: false, fire: false };
      if (b.ai.t <= 0) {
        b.ai.t = 0.8 + Math.random() * 1.4;
        const d = DIRS[Math.floor(Math.random() * DIRS.length)];
        b.ai.mx = d[0]; b.ai.my = d[1];
        b.ai.shoot = $('t-botshoot').checked && Math.random() < 0.6;
      }
      if ($('t-botmove').checked) {
        inp.right = b.ai.mx > 0.3; inp.left = b.ai.mx < -0.3; inp.down = b.ai.my > 0.3; inp.up = b.ai.my < -0.3;
      }
      if (b.ai.shoot && me && me.alive && game.time >= b.fireReady) {
        const dx = me.x - b.x, dy = me.y - b.y, l = Math.hypot(dx, dy) || 1;
        b.fx = dx / l; b.fy = dy / l;
        inp.up = inp.down = inp.left = inp.right = false;
        inp.fire = true;
      }
      game.setInput(b.id, inp);
    }
  }

  // ---- loop ----
  buildPanel();
  newGame();
  const pr = () => PB.getProfile();
  const STEP = 1 / 60;
  let acc = 0, last = performance.now();
  function frame(now) {
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    const meP = game.players.get('me');
    if (mouse && meP) {
      const w = renderer.screenToWorld(mouse.x, mouse.y);
      game.setAim('me', w.x - meP.x, w.y - meP.y);
    }
    while (acc >= STEP) {
      botThink(STEP);
      const evs = game.step(STEP);
      for (const e of evs) {
        renderer.effect(e);
        if (e.type === 'kill') {
          const k = game.players.get(e.killer), v = game.players.get(e.victim);
          hud.addFeed(`<span class="t${k ? k.team : 'A'}">${PB.esc(k ? k.name : '?')}</span> ${e.weapon === 'knife' ? '🔪' : '🔫'} <span class="t${v ? v.team : 'B'}">${PB.esc(v ? v.name : '?')}</span>`);
        }
      }
      acc -= STEP;
    }
    const s = game.snapshot();
    const profile = pr();
    const botColors = ['#f97316', '#a855f7', '#06b6d4', '#84cc16', '#ec4899'];
    s.p.forEach((p, i) => {
      if (p.id === 'me') { p.name = profile.name; p.color = profile.color; p.avatar = profile.avatar; }
      else { p.name = game.players.get(p.id).name; p.color = botColors[i % 5]; p.avatar = ''; }
    });
    let bombAim = null;
    const meNow = game.players.get('me');
    if (bombAiming && meNow && meNow.alive && meNow.bombs > 0) { const t = bombTarget(); if (t) bombAim = { x: meNow.x, y: meNow.y, tx: t.x, ty: t.y }; }
    renderer.draw({ players: s.p, bullets: s.b, hz: s.hz, bombs: s.bm, smokes: s.sm, bombAim, meId: 'me', light: s.lg ? s.lg.s : 0, pt: s.pt });
    hud.update(s.p.find((p) => p.id === 'me'), s, cfg, { sandbox: true });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
