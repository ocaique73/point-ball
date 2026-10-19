// Point Ball — modo Bomber multiplayer (1 a 4 jogadores, com bots opcionais).
// A simulação (public/demo3d/bomber3d.js) é a mesma do modo solo; aqui ela roda no servidor.
// Eventos do socket (todos começam com "bm_"):
//   cliente → bm_join {room,name,ch}, bm_start {bots,rounds,map}, bm_in {x,z,dx,dz,yaw}, bm_act {a}, bm_leave
//   servidor → bm_lobby {...}, bm_snap {...} (20x/s), bm_ev [...], bm_err "texto"
const ROOM_RE = /^[A-Za-z0-9]{1,5}$/;
const CHARS = ['hood', 'rogue', 'knight', 'barbarian', 'mage'];
const clean = (n) => String(n || '').trim().slice(0, 16) || 'Jogador';

async function setupBomber(io) {
  const { BomberSim } = await import('./public/demo3d/bomber3d.js');
  const rooms = new Map();

  function lobbyOf(r) {
    return { room: r.code, host: r.host, started: !!r.sim, players: [...r.members.values()].map((m) => ({ id: m.id, name: m.name })) };
  }
  function sendLobby(r) { for (const m of r.members.values()) io.to(m.id).emit('bm_lobby', Object.assign(lobbyOf(r), { you: m.id })); }
  function leave(sock) {
    const r = rooms.get(sock.data.bmRoom); if (!r) return;
    r.members.delete(sock.id); sock.leave('bm_' + r.code); sock.data.bmRoom = null;
    if (r.sim) { const p = r.sim.players.get(sock.id); if (p && p.alive) r.sim.kill(p, null); }
    if (!r.members.size) { clearInterval(r.timer); rooms.delete(r.code); return; }
    if (r.host === sock.id) r.host = r.members.keys().next().value;
    if (!r.sim) sendLobby(r);
  }
  function startGame(r, bots, rounds, map, tm) {
    const list = [...r.members.values()].map((m) => ({ id: m.id, name: m.name, ch: m.ch }));
    const nbots = Math.max(0, Math.min(4 - list.length, bots | 0));
    for (let i = 0; i < nbots; i++) list.push({ id: 'bot' + (i + 1), name: 'Bot ' + (i + 1), bot: true, ch: CHARS[(i + 1) % CHARS.length] });
    r.sim = new BomberSim({ players: list, rounds: Math.max(1, Math.min(9, rounds | 0 || 3)), map: String(map || 'classic'), throwMode: !!tm });
    sendLobby(r);
    let acc = 0, last = Date.now(), tick = 0;
    r.timer = setInterval(() => {
      const now = Date.now(); acc += Math.min(0.25, (now - last) / 1000); last = now;
      while (acc >= 1 / 30) { r.sim.step(1 / 30); acc -= 1 / 30; tick++; }
      const ev = r.sim.drainEvents();
      if (ev.length) io.to('bm_' + r.code).emit('bm_ev', ev);
      if (tick % 2 === 0) {
        const snap = r.sim.snapshot();
        for (const m of r.members.values()) {
          const p = r.sim.players.get(m.id);
          const s = p && p.corr ? Object.assign({ fix: [p.x, p.z] }, snap) : snap; // servidor recusou a posição: manda o cliente voltar
          if (p) p.corr = false;
          io.to(m.id).emit('bm_snap', s);
        }
      }
      if (r.sim.phase === 'matchEnd' && !r.endAt) r.endAt = now + 8000;
      if (r.endAt && now > r.endAt) { clearInterval(r.timer); r.sim = null; r.endAt = 0; sendLobby(r); }
    }, 1000 / 60);
  }

  io.on('connection', (sock) => {
    sock.on('bm_join', (d) => {
      d = d || {};
      const code = String(d.room || '').toUpperCase();
      if (!ROOM_RE.test(code)) return sock.emit('bm_err', 'Nome da sala: até 5 letras/números.');
      if (sock.data.bmRoom) leave(sock);
      let r = rooms.get(code);
      if (!r) { r = { code, host: sock.id, members: new Map(), sim: null, timer: null, endAt: 0 }; rooms.set(code, r); }
      if (r.sim) return sock.emit('bm_err', 'Partida em andamento nessa sala.');
      if (r.members.size >= 4) return sock.emit('bm_err', 'Sala cheia (máximo 4).');
      r.members.set(sock.id, { id: sock.id, name: clean(d.name), ch: CHARS.includes(d.ch) ? d.ch : 'hood' });
      sock.data.bmRoom = code; sock.join('bm_' + code);
      sendLobby(r);
    });
    sock.on('bm_start', (d) => {
      const r = rooms.get(sock.data.bmRoom); if (!r || r.sim || r.host !== sock.id) return;
      d = d || {}; startGame(r, d.bots, d.rounds, d.map, d.tm);
    });
    sock.on('bm_in', (d) => {
      const r = rooms.get(sock.data.bmRoom); if (!r || !r.sim || !d) return;
      const p = r.sim.players.get(sock.id); if (!p) return;
      const yaw = Number(d.yaw); if (Number.isFinite(yaw)) p.yaw = yaw;
      p.shift = !!d.sh;
      r.sim.acceptPos(p, Number(d.x), Number(d.z), Number(d.dx) || 0, Number(d.dz) || 0);
    });
    sock.on('bm_act', (d) => {
      const r = rooms.get(sock.data.bmRoom); if (!r || !r.sim) return;
      if (!d) return;
      if (['bomb', 'grab', 'throw', 'smoke', 'jump'].includes(d.a)) r.sim.act(sock.id, d.a, d.c);
      else if (d.a === 'killbots' && r.host === sock.id) r.sim.act(sock.id, 'killbots');
    });
    sock.on('bm_leave', () => leave(sock));
    sock.on('disconnect', () => leave(sock));
  });
}
module.exports = { setupBomber };
