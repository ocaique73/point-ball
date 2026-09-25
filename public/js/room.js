// Página da sala: senha, escolha de time, sala de espera, fila, jogo e tela de vitória
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = PB.esc;
  const code = decodeURIComponent(location.pathname.split('/').pop() || '').toUpperCase();
  document.querySelectorAll('.room-code').forEach((e) => (e.textContent = code));
  document.title = `Sala ${code} · Point Ball`;

  const socket = io({ transports: ['websocket', 'polling'] });
  let you = null, config = null, state = null;
  let joined = false, fatal = false, spectating = false, victoryOpen = false;
  let snaps = [];            // buffer para interpolação
  let latest = null;          // último snapshot
  let roundMsg = '';
  let gameMap = null;
  let pred = { init: false, x: 0, y: 0, fx: 1, fy: 0 };
  let walls = [], wallsAll = [], openCache = { key: '', walls: [] }, curLay = 0;
  let lastPreview = null;

  const renderer = new PBRenderer($('game-canvas'));
  renderer.reserveTop = 84; // altura do HUD de cima (px)
  const hud = new PBHud.Hud($('hud-root'));

  // ---------- telas ----------
  const SCREENS = ['scr-msg', 'scr-password', 'scr-team', 'scr-lobby', 'scr-game'];
  function show(id) {
    for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
    if (id === 'scr-game') { renderer.resize(); if (document.activeElement) document.activeElement.blur(); }
  }
  function showMsg(title, text, retry) {
    $('msg-title').textContent = title;
    $('msg-text').textContent = text || '';
    $('msg-retry').classList.toggle('hidden', !retry);
    show('scr-msg');
  }
  $('msg-retry').onclick = () => { fatal = false; join(); };

  // ---------- entrar na sala ----------
  function savedPassword() {
    const q = new URLSearchParams(location.search).get('senha');
    if (q) return q;
    try { return sessionStorage.getItem('pb_pw_' + code) || ''; } catch (e) { return ''; }
  }
  function join(password) {
    if (fatal) return;
    const pw = password != null ? password : savedPassword();
    socket.emit('join_room', { code, password: pw, clientId: PB.clientId(), profile: PB.getProfile() }, (res) => {
      if (!res) return;
      if (!res.ok) {
        joined = false;
        if (res.error === 'not_found') { fatal = true; return showMsg('Sala não encontrada', 'Essa sala não existe ou já foi fechada.'); }
        if (res.error === 'need_password' || res.error === 'wrong_password') {
          show('scr-password');
          $('pw-err').textContent = res.error === 'wrong_password' ? 'Senha incorreta.' : '';
          $('pw-input').focus();
          return;
        }
        if (res.error === 'full') { fatal = true; return showMsg('Sala lotada', 'A sala de espera e a fila (10 pessoas) estão cheias.', true); }
        return showMsg('Erro', res.error);
      }
      joined = true;
      if (pw) { try { sessionStorage.setItem('pb_pw_' + code, pw); } catch (e) {} }
      you = res.you;
      config = res.config;
      state = res.state;
      if (res.match) setupGame(res.match.map);
      renderUI();
      sendKeys();
    });
  }
  $('pw-btn').onclick = () => join($('pw-input').value);
  $('pw-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') join($('pw-input').value); });

  socket.on('connect', () => { if (!fatal) join(); });
  socket.on('disconnect', () => { if (!fatal) PB.toast('Conexão perdida, reconectando...'); });
  socket.on('room_state', (s) => { state = s; renderUI(); });
  socket.on('toast', (m) => PB.toast(m));
  socket.on('kicked', (m) => { fatal = true; showMsg('Desconectado', m, true); });
  socket.on('room_closed', () => { fatal = true; showMsg('Sala fechada', 'Essa sala foi encerrada.'); });

  socket.on('match_start', (d) => {
    config = d.config;
    setupGame(d.map);
    closeVictory();
    renderUI();
    sendKeys();
  });
  socket.on('snap', (d) => {
    const now = performance.now();
    snaps.push({ recv: now, s: d.s });
    while (snaps.length > 2 && now - snaps[0].recv > 1000) snaps.shift();
    latest = d.s;
    for (const e of d.e) handleEvent(e);
  });
  socket.on('match_end', (d) => showVictory(d));
  socket.on('match_aborted', () => { PB.toast('Partida encerrada.'); latest = null; renderUI(); });

  function setupGame(mapId) {
    gameMap = mapId;
    renderer.setup(config, mapId);
    wallsAll = RC_GAME.buildWalls(mapId, config, 0); curLay = 0;
    openCache = { key: '', walls: wallsAll };
    walls = wallsAll;
    snaps = []; latest = null; pred.init = false; roundMsg = '';
  }

  // ---------- UI da sala ----------
  const meMember = () => state && state.members.find((m) => m.id === you);
  const botsList = () => (state && state.bots ? state.bots.list : []);
  const memberById = (id) => state && (state.members.find((m) => m.id === id) || botsList().find((b) => b.id === id));
  const teamSize = (t) => state.members.filter((m) => m.status === 'team' && m.team === t).length + (state.bots && state.bots.team === t ? botsList().length : 0);

  function renderUI() {
    if (!state || !joined || fatal) return;
    const me = meMember();
    if (!me) return;
    const live = state.phase === 'match';
    if (!live) spectating = false;
    const isHost = state.hostId === you;

    if (live && (me.inMatch || spectating) && latest !== undefined) {
      show('scr-game');
      $('spec-bar').classList.toggle('hidden', !!me.inMatch);
    } else if (me.status === 'choosing') {
      show('scr-team');
      for (const t of ['A', 'B']) {
        const n = teamSize(t);
        $('pick-' + t + '-n').textContent = `${n}/5`;
        $('pick-' + t).disabled = n >= 5;
      }
      const total = teamSize('A') + teamSize('B');
      $('team-note').textContent = total >= 10 ? 'Sala cheia — escolha um time para entrar na fila.' : 'Máximo de 5 jogadores por time.';
      if (total >= 10) { $('pick-A').disabled = false; $('pick-B').disabled = false; }
    } else {
      show('scr-lobby');
    }
    if (victoryOpen) $('victory').classList.remove('hidden');

    // lobby
    $('lock-ico').textContent = state.hasPassword ? '🔒' : '';
    $('live-banner').classList.toggle('hidden', !live || me.inMatch);
    $('set-map').value = state.map;
    if (lastPreview !== state.map && config && !$('scr-lobby').classList.contains('hidden')) {
      lastPreview = state.map;
      PBRenderer.preview($('lobby-preview'), config, state.map);
      $('lobby-note').textContent = PB.MAP_NOTE[state.map] || '';
    }
    $('set-rounds').value = String(state.rounds);
    $('set-mode').value = state.gameMode || 'rounds';
    $('set-dmtime').value = String(state.dmTime || 180);
    $('set-kills').value = String(state.killLimit || 30);
    $('set-hill').value = String(state.hillTarget || 100);
    $('set-botlevel').value = state.botLevel || 'amador';
    const dmMode = state.gameMode === 'tdm' || state.gameMode === 'ffa' || state.gameMode === 'koth';
    document.querySelectorAll('.dm-only').forEach((e) => (e.style.display = dmMode ? '' : 'none'));
    document.querySelectorAll('.kills-only').forEach((e) => (e.style.display = state.gameMode === 'tdm' || state.gameMode === 'ffa' ? '' : 'none'));
    document.querySelectorAll('.koth-only').forEach((e) => (e.style.display = state.gameMode === 'koth' ? '' : 'none'));
    document.querySelectorAll('.rounds-only').forEach((e) => (e.style.display = dmMode ? 'none' : ''));
    ['set-map', 'set-rounds', 'set-bots', 'set-botteam', 'set-mode', 'set-dmtime', 'set-kills', 'set-botlevel', 'set-hill'].forEach((id) => ($(id).disabled = !isHost || live));
    if (state.bots) {
      $('set-bots').value = String(state.bots.list.length);
      $('set-botteam').value = state.bots.team;
      const room = 5 - state.members.filter((m) => m.status === 'team' && m.team === state.bots.team).length;
      [...$('set-bots').options].forEach((o) => (o.disabled = Number(o.value) > room));
    }
    $('btn-start').classList.toggle('hidden', !isHost);
    $('btn-start').disabled = live;
    const host = memberById(state.hostId);
    $('host-note').textContent = (isHost ? 'Você é o dono da sala: escolha o mapa, o modo e inicie.' : `Dono da sala: ${host ? host.name : '-'}. Aguarde ele iniciar.`)
      + (state.gameMode === 'ffa' ? ' · No "cada um por si" o time não importa: todo mundo é inimigo.' : '');

    for (const t of ['A', 'B']) {
      const list = state.members.filter((m) => m.status === 'team' && m.team === t);
      const bots = state.bots && state.bots.team === t ? botsList() : [];
      const n = list.length + bots.length;
      $('cnt-' + t).textContent = `${n}/5`;
      let html = list.map((m) => memberRow(m)).join('') + bots.map((b) => botRow(b)).join('');
      for (let i = n; i < 5; i++) html += '<div class="slot-empty">vaga livre</div>';
      $('list-' + t).innerHTML = html;
      const canJoin = me.status !== 'queue' && !me.inMatch && !(me.status === 'team' && me.team === t) && n < 5;
      $('join-' + t).classList.toggle('hidden', !canJoin);
    }
    const q = state.queue.map((id) => memberById(id)).filter(Boolean);
    $('cnt-Q').textContent = `(${q.length}/10)`;
    $('list-Q').innerHTML = q.length ? q.map((m, i) => memberRow(m, `#${i + 1}`)).join('') : '<div class="muted small">Ninguém na fila.</div>';
    const ch = state.members.filter((m) => m.status === 'choosing');
    $('list-C').innerHTML = ch.length ? ch.map((m) => memberRow(m)).join('') : '<div class="muted small">—</div>';
    const qb = $('queue-banner');
    if (me.status === 'queue') {
      qb.hidden = false;
      qb.innerHTML = `⏳ Você está na <b>fila</b> (posição ${state.queue.indexOf(you) + 1}). Quando abrir uma vaga você entra automaticamente.`;
    } else qb.hidden = true;
  }

  function botRow(b) {
    return `<div class="member">${PB.avatarHTML(b, 34)}<span class="nm">${esc(b.name)}</span><span class="badge">🤖 bot</span></div>`;
  }

  function memberRow(m, prefix) {
    const tags = [];
    if (m.id === state.hostId) tags.push('<span class="badge">👑 dono</span>');
    if (m.id === you) tags.push('<span class="badge">você</span>');
    if (state.phase === 'match' && m.status === 'team' && !m.inMatch) tags.push('<span class="badge">próxima partida</span>');
    if (!m.connected) tags.push('<span class="badge">reconectando...</span>');
    return `<div class="member ${m.connected ? '' : 'off'}">${prefix ? `<b class="muted">${prefix}</b>` : ''}${PB.avatarHTML(m, 34)}<span class="nm">${esc(m.name)}</span>${tags.join('')}</div>`;
  }

  $('pick-A').onclick = () => socket.emit('choose_team', { team: 'A' });
  $('pick-B').onclick = () => socket.emit('choose_team', { team: 'B' });
  $('join-A').onclick = () => socket.emit('choose_team', { team: 'A' });
  $('join-B').onclick = () => socket.emit('choose_team', { team: 'B' });
  $('set-map').onchange = $('set-rounds').onchange = $('set-mode').onchange = $('set-dmtime').onchange = $('set-kills').onchange = $('set-hill').onchange = () =>
    socket.emit('update_settings', { map: $('set-map').value, rounds: Number($('set-rounds').value),
      gameMode: $('set-mode').value, dmTime: Number($('set-dmtime').value), killLimit: Number($('set-kills').value), hillTarget: Number($('set-hill').value) });
  $('set-botlevel').onchange = () => socket.emit('update_settings', { botLevel: $('set-botlevel').value });
  $('set-bots').onchange = $('set-botteam').onchange = () =>
    socket.emit('update_settings', { bots: Number($('set-bots').value), botTeam: $('set-botteam').value });
  $('btn-start').onclick = () => socket.emit('start_match');
  $('btn-watch').onclick = () => { spectating = true; renderUI(); };
  $('btn-unwatch').onclick = () => { spectating = false; renderUI(); };
  $('btn-copy').onclick = () => {
    const url = location.origin + '/sala/' + code;
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => PB.toast('Link copiado!'), () => prompt('Copie o link:', url));
  };
  document.querySelectorAll('[data-act=profile]').forEach((b) => (b.onclick = () => PB.openProfile((p) => socket.emit('update_profile', p))));
  document.querySelectorAll('[data-act=leave]').forEach((b) => (b.onclick = () => {
    fatal = true;
    socket.emit('leave_room');
    setTimeout(() => (location.href = '/'), 80);
  }));

  // ---------- vitória ----------
  function showVictory(d) {
    const tn = (t) => (t === 'A' ? 'AZUL' : 'VERMELHO');
    if (d.mode === 'ffa') {
      // cada um por si: ranking por abates
      const ranked = d.players.slice().sort((a, b) => b.stats.k - a.stats.k || a.stats.d - b.stats.d);
      const w = ranked.find((p) => p.id === d.winner);
      $('v-title').innerHTML = w ? `🏆 <span style="color:#ffcc33">${esc(w.name)}</span> VENCEU!` : '🤝 EMPATE';
      $('v-score').innerHTML = w ? `${w.stats.k} abates${d.timeUp ? ' · tempo esgotado' : ''}` : 'Empate em abates no fim do tempo';
      $('v-winners').innerHTML = 'Mata-mata cada um por si · meta ' + d.killLimit + ' abates';
      $('v-body').innerHTML = ranked.map((p, i) => `
        <tr class="${p.id === d.winner ? 'v-win-row' : ''}">
          <td><div class="who"><b class="muted">${i + 1}º</b>${PB.avatarHTML(p, 30)}${esc(p.name)}${p.id === you ? ' <span class="badge">você</span>' : ''}</div></td>
          <td class="muted">—</td>
          <td class="n">${p.stats.k}</td><td class="n">${p.stats.d}</td><td class="n">${p.stats.a}</td>
        </tr>`).join('');
      victoryOpen = true;
      $('victory').classList.remove('hidden');
      return;
    }
    $('v-title').innerHTML = d.winner ? `🏆 VITÓRIA DO TIME <span class="t${d.winner}">${tn(d.winner)}</span>` : '🤝 EMPATE';
    $('v-score').innerHTML = `<span class="tA">Azul ${d.score.A}</span> x <span class="tB">${d.score.B} Vermelho</span>`;
    const winners = d.players.filter((p) => p.team === d.winner);
    const tieMsg = d.mode === 'tdm' ? 'Os dois times fizeram a mesma quantidade de abates.' : d.mode === 'koth' ? 'Os dois times fizeram os mesmos pontos na colina.' : `Ninguém fez mais da metade dos ${d.rounds} rounds.`;
    $('v-winners').innerHTML = d.winner ? 'Vencedores: ' + winners.map((p) => `<b>${esc(p.name)}</b>`).join(', ') : tieMsg;
    if (d.mode === 'koth') $('v-score').innerHTML = `<span class="tA">Azul ${d.score.A}</span> x <span class="tB">${d.score.B} Vermelho</span> <small class="muted">pontos na colina</small>`;
    if (d.mode === 'tdm') $('v-score').innerHTML = `<span class="tA">Azul ${d.score.A}</span> x <span class="tB">${d.score.B} Vermelho</span> <small class="muted">abates</small>`;
    const sorted = d.players.slice().sort((a, b) => ((b.team === d.winner) - (a.team === d.winner)) || (b.stats.k - a.stats.k));
    $('v-body').innerHTML = sorted.map((p) => `
      <tr class="${p.team === d.winner ? 'v-win-row' : ''}">
        <td><div class="who">${PB.avatarHTML(p, 30)}${esc(p.name)}${p.id === you ? ' <span class="badge">você</span>' : ''}</div></td>
        <td class="t${p.team}">${p.team === 'A' ? 'Azul' : 'Vermelho'}</td>
        <td class="n">${p.stats.k}</td><td class="n">${p.stats.d}</td><td class="n">${p.stats.a}</td>
      </tr>`).join('');
    victoryOpen = true;
    $('victory').classList.remove('hidden');
  }
  function closeVictory() { victoryOpen = false; $('victory').classList.add('hidden'); }
  $('v-close').onclick = () => { closeVictory(); renderUI(); };

  // ---------- eventos do jogo ----------
  const nameOf = (id) => { const m = memberById(id); return m ? m.name : '?'; };
  const teamOf = (id) => {
    if (latest && latest.md === 'ffa') return id === you ? 'A' : 'B';
    const p = latest && latest.p.find((x) => x.id === id); return p ? p.tm : 'A';
  };
  function handleEvent(e) {
    renderer.effect(e);
    if (e.type === 'kill') {
      hud.addFeed(`${e.killer ? `<span class="t${teamOf(e.killer)}">${esc(nameOf(e.killer))}</span> ` : ''}${e.weapon === 'knife' ? '🔪' : e.weapon === 'bomb' ? '💣' : e.weapon === 'lava' ? '🌋' : e.weapon === 'fall' ? '🕳️' : '🔫'} <span class="t${teamOf(e.victim)}">${esc(nameOf(e.victim))}</span>`);
    } else if (e.type === 'round_end') {
      roundMsg = e.winner ? `<span class="t${e.winner}">Time ${e.winner === 'A' ? 'Azul' : 'Vermelho'}</span> venceu o round!<small>Azul ${e.score.A} x ${e.score.B} Vermelho</small>` : `${e.timeUp ? '⏱ Tempo esgotado — ' : ''}Round empatado!<small>Azul ${e.score.A} x ${e.score.B} Vermelho</small>`;
    } else if (e.type === 'round_start') {
      pred.init = false;
    }
  }

  // ---------- teclado ----------
  const keys = PBHud.bindKeys({
    mouseEl: $('game-canvas'),
    enabled: () => !$('scr-game').classList.contains('hidden') && !victoryOpen,
    onChange: (k) => socket.emit('input', k),
    onWeapon: (w) => socket.emit('weapon', w),
    onReload: () => socket.emit('reload'),
    onJump: () => socket.emit('jump'),
    onBomb: (down) => {
      if (down) { bombAiming = true; return; }
      if (!bombAiming) return;
      bombAiming = false;
      const t = bombTarget();
      if (t) socket.emit('bomb', { x: Math.round(t.x), y: Math.round(t.y) });
    },
    onSmoke: () => { const t = bombTarget(); if (t) socket.emit('smoke', { x: Math.round(t.x), y: Math.round(t.y) }); }
  });
  function sendKeys() { socket.emit('input', Object.assign({}, keys)); }

  // ---------- loop de desenho ----------
  const INTERP_MS = 100;
  let mouse = null;
  let knifeLocal = { t: -1e9, ang: 0 };
  let bombAiming = false;
  // ponto onde a bomba vai cair: onde o mouse está, ou no limite do alcance na direção dele
  function bombTarget() {
    if (!mouse || !pred.init || !config) return null;
    const w = renderer.screenToWorld(mouse.x, mouse.y);
    let dx = w.x - pred.x, dy = w.y - pred.y;
    const d = Math.hypot(dx, dy);
    if (d > config.bombRange) { dx *= config.bombRange / d; dy *= config.bombRange / d; }
    return { x: pred.x + dx, y: pred.y + dy };
  }
  const aimSent = { a: 99, t: 0 };
  window.addEventListener('mousemove', (e) => { mouse = { x: e.clientX, y: e.clientY }; });
  function interpolated(now) {
    if (!snaps.length) return null;
    const rt = now - INTERP_MS;
    let a = snaps[0], b = snaps[0];
    for (let i = snaps.length - 1; i >= 0; i--) {
      if (snaps[i].recv <= rt) { a = snaps[i]; b = snaps[i + 1] || snaps[i]; break; }
    }
    const al = b === a ? 0 : Math.max(0, Math.min(1, (rt - a.recv) / (b.recv - a.recv)));
    const pa = new Map(a.s.p.map((p) => [p.id, p]));
    const players = b.s.p.map((p) => {
      const o = pa.get(p.id);
      if (!o || Math.hypot(o.x - p.x, o.y - p.y) > 150) return Object.assign({}, p);
      return Object.assign({}, p, { x: o.x + (p.x - o.x) * al, y: o.y + (p.y - o.y) * al,
        jz: p.jz >= 0 && o.jz >= 0 ? o.jz + (p.jz - o.jz) * al : p.jz });
    });
    const ba = new Map(a.s.b.map((x) => [x[0], x]));
    const bullets = b.s.b.map((x) => {
      const o = ba.get(x[0]);
      if (!o || Math.hypot(o[1] - x[1], o[2] - x[2]) > 150) return x; // portal: não desenha atravessando o mapa
      return [x[0], o[1] + (x[1] - o[1]) * al, o[2] + (x[2] - o[2]) * al, x[3], x[4]];
    });
    let hz = b.s.hz;
    if (hz && a.s.hz && hz.x != null && a.s.hz.x != null && hz.s === a.s.hz.s) {
      hz = Object.assign({}, hz, { x: a.s.hz.x + (hz.x - a.s.hz.x) * al, y: a.s.hz.y + (hz.y - a.s.hz.y) * al });
    }
    if (hz && a.s.hz && hz.d != null && a.s.hz.d != null && hz.s === a.s.hz.s) hz = Object.assign({}, hz, { d: a.s.hz.d + (hz.d - a.s.hz.d) * al });
    if (hz && a.s.hz && hz.y0 != null && a.s.hz.y0 != null) hz = Object.assign({}, hz, { y0: a.s.hz.y0 + (hz.y0 - a.s.hz.y0) * al });
    const bma = new Map((a.s.bm || []).map((x) => [x[0], x]));
    const bombs = (b.s.bm || []).map((x) => {
      const o = bma.get(x[0]);
      if (!o) return x;
      return [x[0], o[1] + (x[1] - o[1]) * al, o[2] + (x[2] - o[2]) * al, o[3] + (x[3] - o[3]) * al, x[4], x[5], x[6]];
    });
    return { players, bullets, hz, bombs, smokes: b.s.sm || [] };
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    requestAnimationFrame(frame);
    if ($('scr-game').classList.contains('hidden') || !latest || !config) return;
    const view = interpolated(now);
    if (!view) return;
    const lay = (latest.hz && latest.hz.lay) || 0; // vulcão: paredes do meio mudaram de lugar
    if (lay !== curLay) { curLay = lay; wallsAll = RC_GAME.buildWalls(gameMap, config, lay); openCache = { key: '', walls: wallsAll }; }
    if (latest.pt && latest.pt.o && latest.pt.pr) {
      const key = JSON.stringify(latest.pt.pr);
      if (openCache.key !== key) openCache = { key, walls: RC_GAME.openWalls(wallsAll, latest.pt.pr) };
      walls = openCache.walls;
    } else walls = wallsAll;
    const mine = latest.p.find((p) => p.id === you);
    if (mine) {
      // predição local do próprio personagem (resposta imediata ao teclado)
      const canPredict = mine.al && mine.jz < 0 && !mine.fl && latest.ph === 'playing';
      let mx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), my = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      const moving = !!(mx || my);
      if (!canPredict || !pred.init) {
        pred.x = mine.x; pred.y = mine.y; pred.fx = mine.fx; pred.fy = mine.fy; pred.init = true;
      }
      if (canPredict) {
        if (moving) {
          const l = Math.hypot(mx, my); mx /= l; my /= l;
          const sp = config.playerSpeed * (mine.sl || 1);
          let ddx = mx * sp * dt, ddy = my * sp * dt;
          if (latest.hz && latest.hz.h && latest.hz.h.length) [ddx, ddy] = RC_GAME.holeSlowMove(pred.x, pred.y, ddx, ddy, mine.r, latest.hz.h.map((h) => ({ x: h[1], y: h[2], r: h[3] })), config.holeSlow);
          const m = RC_GAME.moveCircle(pred.x, pred.y, ddx, ddy, mine.r, walls);
          pred.x = m.x; pred.y = m.y;
          if (latest.pt && latest.pt.o) { const w = RC_GAME.portalWrap(gameMap, config, pred.x, pred.y, mine.r, latest.pt.pr); if (w) { pred.x = w.x; pred.y = w.y; } }
        }
        const err = Math.hypot(mine.x - pred.x, mine.y - pred.y);
        if (err > 90) { pred.x = mine.x; pred.y = mine.y; }
        else {
          const k = moving ? (err > 35 ? dt * 2 : 0) : Math.min(1, dt * 8);
          pred.x += (mine.x - pred.x) * k; pred.y += (mine.y - pred.y) * k;
        }
      }
      // mira: direção do personagem até o mouse
      if (mouse && mine.al) {
        const w = renderer.screenToWorld(mouse.x, mouse.y);
        const ax = w.x - pred.x, ay = w.y - pred.y, l = Math.hypot(ax, ay);
        if (l > 2) {
          pred.fx = ax / l; pred.fy = ay / l;
          const ang = Math.atan2(pred.fy, pred.fx);
          if ((Math.abs(ang - aimSent.a) > 0.02 && now - aimSent.t > 33) || now - aimSent.t > 500) {
            socket.emit('aim', [Math.round(pred.fx * 1000) / 1000, Math.round(pred.fy * 1000) / 1000]);
            aimSent.a = ang; aimSent.t = now;
          }
        }
      }
      // faca: o acerto é calculado com o que você vê na tela e enviado ao servidor
      if (mine.al && !mine.sp && mine.w === 2 && keys.fire && latest.ph === 'playing' && mine.jz < 0 && now - knifeLocal.t >= config.knifeCooldown * 1000) {
        const targets = view.players.filter((p) => p.id !== you && (latest.md === 'ffa' || p.tm !== mine.tm) && p.al && p.jz < 0 && !p.sp).map((p) => ({ id: p.id, x: p.x, y: p.y, r: p.r }));
        const hit = RC_GAME.knifeTarget(pred.x, pred.y, mine.r, pred.fx, pred.fy, targets, config, walls);
        socket.emit('knife', { t: hit, ax: pred.fx, ay: pred.fy });
        knifeLocal = { t: now, ang: Math.atan2(pred.fy, pred.fx) };
      }
      const vp = view.players.find((p) => p.id === you);
      if (vp) {
        Object.assign(vp, mine, { x: pred.x, y: pred.y, fx: pred.fx, fy: pred.fy });
        const k = now - knifeLocal.t < 180;
        vp.ka = k ? 1 : 0; vp.kd = knifeLocal.ang;
      }
    }
    for (const p of view.players) {
      const m = memberById(p.id);
      p.name = m ? m.name : '?'; p.color = m ? m.color : '#ccc'; p.avatar = m ? m.avatar : '';
    }
    let bombAim = null;
    if (bombAiming && mine && mine.al && mine.bo > 0) { const t = bombTarget(); if (t) bombAim = { x: pred.x, y: pred.y, tx: t.x, ty: t.y }; }
    renderer.draw({ players: view.players, bullets: view.bullets, hz: view.hz, bombs: view.bombs, smokes: view.smokes, bombAim, meId: you,
      ffa: latest.md === 'ffa', light: latest.lg ? latest.lg.s : 0, pt: latest.pt, hl: latest.hl });
    hud.update(mine || null, latest, config, { roundMsg, nameOf });
  }
  requestAnimationFrame(frame);

  window.__pb = { showVictory }; // usado nos testes automáticos
})();
