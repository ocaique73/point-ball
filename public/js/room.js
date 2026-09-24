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
  let walls = [];

  const renderer = new PBRenderer($('game-canvas'));
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
    walls = RC_GAME.buildWalls(mapId, config);
    snaps = []; latest = null; pred.init = false; roundMsg = '';
  }

  // ---------- UI da sala ----------
  const meMember = () => state && state.members.find((m) => m.id === you);
  const memberById = (id) => state && state.members.find((m) => m.id === id);

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
        const n = state.members.filter((m) => m.status === 'team' && m.team === t).length;
        $('pick-' + t + '-n').textContent = `${n}/5`;
        $('pick-' + t).disabled = n >= 5;
      }
      const total = state.members.filter((m) => m.status === 'team').length;
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
    $('set-rounds').value = String(state.rounds);
    $('set-map').disabled = $('set-rounds').disabled = !isHost || live;
    $('btn-start').classList.toggle('hidden', !isHost);
    $('btn-start').disabled = live;
    const host = memberById(state.hostId);
    $('host-note').textContent = isHost ? 'Você é o dono da sala: escolha o mapa, os rounds e inicie.' : `Dono da sala: ${host ? host.name : '-'}. Aguarde ele iniciar.`;

    for (const t of ['A', 'B']) {
      const list = state.members.filter((m) => m.status === 'team' && m.team === t);
      $('cnt-' + t).textContent = `${list.length}/5`;
      let html = list.map((m) => memberRow(m)).join('');
      for (let i = list.length; i < 5; i++) html += '<div class="slot-empty">vaga livre</div>';
      $('list-' + t).innerHTML = html;
      const canJoin = me.status !== 'queue' && !me.inMatch && !(me.status === 'team' && me.team === t) && list.length < 5;
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
  $('set-map').onchange = $('set-rounds').onchange = () =>
    socket.emit('update_settings', { map: $('set-map').value, rounds: Number($('set-rounds').value) });
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
    $('v-title').innerHTML = d.winner ? `🏆 VITÓRIA DO TIME <span class="t${d.winner}">${tn(d.winner)}</span>` : '🤝 EMPATE';
    $('v-score').innerHTML = `<span class="tA">Azul ${d.score.A}</span> x <span class="tB">${d.score.B} Vermelho</span>`;
    const winners = d.players.filter((p) => p.team === d.winner);
    $('v-winners').innerHTML = d.winner ? 'Vencedores: ' + winners.map((p) => `<b>${esc(p.name)}</b>`).join(', ') : `Ninguém fez mais da metade dos ${d.rounds} rounds.`;
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
  const teamOf = (id) => { const p = latest && latest.p.find((x) => x.id === id); return p ? p.tm : 'A'; };
  function handleEvent(e) {
    renderer.effect(e);
    if (e.type === 'kill') {
      hud.addFeed(`<span class="t${teamOf(e.killer)}">${esc(nameOf(e.killer))}</span> ${e.weapon === 'knife' ? '🔪' : '🔫'} <span class="t${teamOf(e.victim)}">${esc(nameOf(e.victim))}</span>`);
    } else if (e.type === 'round_end') {
      roundMsg = e.winner ? `<span class="t${e.winner}">Time ${e.winner === 'A' ? 'Azul' : 'Vermelho'}</span> venceu o round!<small>Azul ${e.score.A} x ${e.score.B} Vermelho</small>` : 'Round empatado!';
    } else if (e.type === 'round_start') {
      pred.init = false;
    }
  }

  // ---------- teclado ----------
  const keys = PBHud.bindKeys({
    enabled: () => !$('scr-game').classList.contains('hidden') && !victoryOpen,
    onChange: (k) => socket.emit('input', k),
    onWeapon: (w) => socket.emit('weapon', w),
    onReload: () => socket.emit('reload'),
    onJump: () => socket.emit('jump')
  });
  function sendKeys() { socket.emit('input', Object.assign({}, keys)); }

  // ---------- loop de desenho ----------
  const INTERP_MS = 100;
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
      if (!o) return x;
      return [x[0], o[1] + (x[1] - o[1]) * al, o[2] + (x[2] - o[2]) * al, x[3], x[4]];
    });
    return { players, bullets };
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    requestAnimationFrame(frame);
    if ($('scr-game').classList.contains('hidden') || !latest || !config) return;
    const view = interpolated(now);
    if (!view) return;
    const mine = latest.p.find((p) => p.id === you);
    if (mine) {
      // predição local do próprio personagem (resposta imediata ao teclado)
      const canPredict = mine.al && mine.jz < 0 && latest.ph === 'playing';
      let mx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), my = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      const moving = !!(mx || my);
      if (!canPredict || !pred.init) {
        pred.x = mine.x; pred.y = mine.y; pred.fx = mine.fx; pred.fy = mine.fy; pred.init = true;
      }
      if (canPredict) {
        if (moving) {
          const l = Math.hypot(mx, my); mx /= l; my /= l;
          pred.fx = mx; pred.fy = my;
          const m = RC_GAME.moveCircle(pred.x, pred.y, mx * config.playerSpeed * dt, my * config.playerSpeed * dt, mine.r, walls);
          pred.x = m.x; pred.y = m.y;
        }
        const err = Math.hypot(mine.x - pred.x, mine.y - pred.y);
        if (err > 90) { pred.x = mine.x; pred.y = mine.y; }
        else {
          const k = moving ? (err > 35 ? dt * 2 : 0) : Math.min(1, dt * 8);
          pred.x += (mine.x - pred.x) * k; pred.y += (mine.y - pred.y) * k;
        }
      }
      const vp = view.players.find((p) => p.id === you);
      if (vp) Object.assign(vp, mine, { x: pred.x, y: pred.y, fx: pred.fx, fy: pred.fy });
    }
    for (const p of view.players) {
      const m = memberById(p.id);
      p.name = m ? m.name : '?'; p.color = m ? m.color : '#ccc'; p.avatar = m ? m.avatar : '';
    }
    renderer.draw({ players: view.players, bullets: view.bullets, meId: you });
    hud.update(mine || null, latest, config, { roundMsg });
  }
  requestAnimationFrame(frame);

  window.__pb = { showVictory }; // usado nos testes automáticos
})();
