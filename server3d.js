// Point Ball 3D — servidor de multiplayer (salas) pro demo Three.js.
// Reaproveita o socket.io do server.js e o mesmo padrão de salas do jogo 2D (server.js),
// mas roda o Sim3D (public/demo3d/sim3d.js) no lugar do Game do 2D.
// sim3d.js é um módulo ES ("export class..."), então carregamos ele com import() dinâmico.
const crypto = require('crypto');
const { MAPS } = require('./shared/maps');
const G = require('./shared/game');
const Bots = require('./shared/bots');

const ROOM_EMPTY_TTL = 2 * 60 * 1000;
const MEMBER_GRACE = 2 * 60 * 1000;
const MAX_PER_TEAM = 5;
const ROOM_NAME_RE = /^[A-Za-z0-9]{1,5}$/;
const VALID_LEVELS = ['iniciante', 'amador', 'pro'];
// teto que ricocheteia tiro (mesmo valor do cliente em demo3d.js)
const CEILING_Y = { floresta: 340, nave: 360 };

function pidOf(clientId) { return crypto.createHash('sha256').update(String(clientId)).digest('hex').slice(0, 12); }

function cleanName(n) { return String(n || '').trim().slice(0, 20) || 'Jogador'; }

async function setup3D(io, CFG) {
  const { Sim3D } = await import('./public/demo3d/sim3d.js');
  const rooms = new Map();
  const key = (code) => '3d:' + code;

  function teamCount(room, team) {
    let n = 0;
    for (const m of room.members.values()) if (m.status === 'team' && (!team || m.team === team)) n++;
    if (!team || team === room.bots.team) n += room.bots.list.length;
    return n;
  }
  function humansIn(room, team) {
    let n = 0;
    for (const m of room.members.values()) if (m.status === 'team' && m.team === team) n++;
    return n;
  }
  function setBots(room, count, team) {
    team = team === 'A' ? 'A' : 'B';
    const max = MAX_PER_TEAM - humansIn(room, team);
    count = Math.max(0, Math.min(max, Math.floor(Number(count) || 0)));
    const list = team === room.bots.team ? room.bots.list.slice(0, count) : [];
    const names = Bots.randomNames(count - list.length, list.map((b) => b.name));
    for (const name of names) { let i = 1; while (list.some((b) => b.id === 'bot-' + i)) i++; list.push({ id: 'bot-' + i, name }); }
    room.bots = { team, list };
  }

  function publicState(room) {
    return {
      code: room.code, hasPassword: !!room.password, map: room.map, hostId: room.hostId, phase: room.phase,
      botLevel: room.botLevel, bots: { team: room.bots.team, list: room.bots.list.map((b) => ({ id: b.id, name: b.name, team: room.bots.team, bot: true })) },
      members: [...room.members.values()].map((m) => ({ id: m.pid, name: m.name, status: m.status, team: m.team, connected: m.connected, inMatch: m.inMatch }))
    };
  }
  function broadcastState(room) { io.to(key(room.code)).emit('3d_room_state', publicState(room)); }

  function scheduleCloseIfEmpty(room) {
    const any = [...room.members.values()].some((m) => m.connected);
    if (any) { if (room.closeTimer) { clearTimeout(room.closeTimer); room.closeTimer = null; } return; }
    if (!room.closeTimer) room.closeTimer = setTimeout(() => closeRoom(room), ROOM_EMPTY_TTL);
  }
  function closeRoom(room) {
    if (room.loop) clearInterval(room.loop);
    for (const m of room.members.values()) if (m.graceTimer) clearTimeout(m.graceTimer);
    io.to(key(room.code)).emit('3d_room_closed');
    rooms.delete(room.code);
    console.log(`[3d] sala ${room.code} fechada`);
  }
  function pickHost(room) {
    const cur = [...room.members.values()].find((m) => m.pid === room.hostId);
    if (cur) return;
    const next = [...room.members.values()].find((m) => m.connected) || [...room.members.values()][0];
    room.hostId = next ? next.pid : null;
  }
  function removeMember(room, cid) {
    const m = room.members.get(cid);
    if (!m) return;
    if (m.graceTimer) clearTimeout(m.graceTimer);
    room.members.delete(cid);
    if (room.sim && m.inMatch) {
      const p = room.sim.players.get(m.pid);
      if (p) p.input = { fwd: 0, side: 0, fire: false };
    }
    pickHost(room);
    scheduleCloseIfEmpty(room);
    broadcastState(room);
  }

  // poças de lava (vulcão) e postes (cidade), igual à lógica do cliente em demo3d.js buildMap()
  function lavaPoolsFor(mapId, walls, W, H) {
    if (mapId !== 'vulcao') return null;
    const pools = [];
    for (let i = 0; i < 3; i++) {
      for (let tries = 0; tries < 30; tries++) {
        const r = 55 + Math.random() * 25;
        const x = W * 0.16 + Math.random() * (W * 0.28), z = 70 + Math.random() * (H - 140);
        if (!G.circleFree(x, z, r + 15, walls, CFG)) continue;
        pools.push({ x, z, r }, { x: W - x, z, r });
        break;
      }
    }
    return pools;
  }
  function lampsFor(mapId, W, H) {
    if (mapId !== 'cidade') return null;
    return MAPS.cidade.lamps.map(([nx, nz]) => [nx * W, nz * H]);
  }

  function startMatch(room) {
    const map = MAPS[room.map];
    const W = CFG.mapWidth, H = CFG.mapHeight;
    let walls = G.buildWalls(room.map, CFG, 0);
    let portalPairs = null;
    if (map && map.portals) {
      const list = G.portalList(map);
      portalPairs = G.pickPortalPairs(list, null);
      walls = G.openWalls(walls, portalPairs);
    }
    const sim = new Sim3D(walls, W, H, {
      hazard: map ? map.hazard : null,
      portalMap: (map && map.portals) ? room.map : null,
      cfg: CFG, portalPairs, G,
      ceilingY: CEILING_Y[room.map] || null,
      lavaPools: lavaPoolsFor(room.map, walls, W, H),
      lamps: lampsFor(room.map, W, H)
    });
    for (const m of room.members.values()) {
      if (m.status === 'team' && m.connected) { sim.addPlayer({ id: m.pid, name: m.name, team: m.team }); m.inMatch = true; }
    }
    for (const b of room.bots.list) sim.addPlayer({ id: b.id, name: b.name, team: room.bots.team, bot: true, level: room.botLevel });
    room.sim = sim;
    room.phase = 'match';
    const dt = 1 / CFG.tickRate;
    const every = Math.max(1, Math.round(CFG.tickRate / CFG.sendRate));
    let tick = 0, pending = [];
    room.loop = setInterval(() => {
      const evs = sim.step(dt);
      if (evs.length) pending.push(...evs);
      if (++tick % every === 0) {
        io.to(key(room.code)).emit('3d_state', { s: sim.snapshot(), e: pending });
        pending = [];
      }
    }, 1000 / CFG.tickRate);
    io.to(key(room.code)).emit('3d_match_start', { map: room.map });
    broadcastState(room);
  }

  function endMatch(room) {
    if (room.loop) clearInterval(room.loop);
    room.loop = null; room.sim = null; room.phase = 'lobby';
    for (const m of room.members.values()) m.inMatch = false;
    io.to(key(room.code)).emit('3d_match_end');
    broadcastState(room);
  }

  io.on('connection', (socket) => {
    const ctx = () => {
      const room = rooms.get(socket.data.room3d);
      if (!room) return {};
      const m = room.members.get(socket.data.cid3d);
      if (!m || m.socketId !== socket.id) return { room };
      return { room, m };
    };

    socket.on('3d_list_rooms', (d, ack) => {
      if (typeof ack !== 'function') return;
      ack([...rooms.values()].map((r) => ({ code: r.code, locked: !!r.password, map: r.map, phase: r.phase, players: [...r.members.values()].filter((m) => m.status === 'team').length })));
    });

    socket.on('3d_create_room', (d, ack) => {
      if (typeof ack !== 'function') return;
      d = d || {};
      const name = String(d.name || '').trim();
      const pass = String(d.password || '');
      if (!ROOM_NAME_RE.test(name)) return ack({ ok: false, error: 'Nome da sala: 1 a 5 letras ou números.' });
      if (pass && (pass.length < 3 || pass.length > 6)) return ack({ ok: false, error: 'Senha: mínimo 3 e máximo 6 caracteres.' });
      const code = name.toUpperCase();
      if (rooms.has(code)) return ack({ ok: false, error: 'Já existe uma sala 3D com esse nome.' });
      const room = {
        code, password: pass, map: MAPS[d.map] && d.map !== 'teste' ? d.map : 'deserto',
        hostId: null, creatorPid: pidOf(d.clientId), phase: 'lobby', members: new Map(),
        sim: null, loop: null, closeTimer: null, bots: { team: 'B', list: [] }, botLevel: 'amador'
      };
      rooms.set(code, room);
      scheduleCloseIfEmpty(room);
      console.log(`[3d] sala ${code} criada`);
      ack({ ok: true, code });
    });

    socket.on('3d_join_room', (d, ack) => {
      if (typeof ack !== 'function') return;
      d = d || {};
      const code = String(d.code || '').toUpperCase();
      const room = rooms.get(code);
      if (!room) return ack({ ok: false, error: 'not_found' });
      const cid = String(d.clientId || '').slice(0, 64);
      if (cid.length < 8) return ack({ ok: false, error: 'bad_client' });
      let m = room.members.get(cid);
      if (m) {
        if (m.connected && m.socketId && m.socketId !== socket.id) {
          const old = io.sockets.sockets.get(m.socketId);
          if (old) { old.emit('3d_kicked', 'A sala foi aberta em outra aba.'); old.data.room3d = null; old.disconnect(true); }
        }
        if (m.graceTimer) { clearTimeout(m.graceTimer); m.graceTimer = null; }
        m.name = cleanName(d.name) || m.name;
      } else {
        if (room.password && String(d.password || '') !== room.password) return ack({ ok: false, error: d.password ? 'wrong_password' : 'need_password' });
        if (teamCount(room) >= MAX_PER_TEAM * 2 + 4) return ack({ ok: false, error: 'full' });
        m = { cid, pid: pidOf(cid), name: cleanName(d.name), status: 'choosing', team: null, connected: true, inMatch: false, socketId: null, graceTimer: null };
        room.members.set(cid, m);
      }
      m.socketId = socket.id; m.connected = true;
      socket.data.room3d = code; socket.data.cid3d = cid;
      socket.join(key(code));
      if (!room.hostId || (room.creatorPid === m.pid && !room.members.has(room.hostId))) pickHost(room);
      if (!room.hostId) room.hostId = m.pid;
      scheduleCloseIfEmpty(room);
      ack({ ok: true, you: m.pid, state: publicState(room), match: room.phase === 'match' ? { map: room.map } : null });
      broadcastState(room);
    });

    socket.on('3d_choose_team', (d) => {
      const { room, m } = ctx(); if (!m) return;
      const team = d && d.team === 'B' ? 'B' : 'A';
      if (m.inMatch) return socket.emit('3d_toast', 'Não dá pra trocar de time durante a partida.');
      if (teamCount(room, team) >= MAX_PER_TEAM) return socket.emit('3d_toast', 'Esse time está cheio.');
      m.status = 'team'; m.team = team;
      broadcastState(room);
    });

    socket.on('3d_update_settings', (d) => {
      const { room, m } = ctx(); if (!m || room.hostId !== m.pid || room.phase !== 'lobby') return;
      if (d && MAPS[d.map] && d.map !== 'teste') room.map = d.map;
      if (d && VALID_LEVELS.includes(d.botLevel)) room.botLevel = d.botLevel;
      if (d && (d.bots != null || d.botTeam)) setBots(room, d.bots != null ? d.bots : room.bots.list.length, d.botTeam || room.bots.team);
      broadcastState(room);
    });

    socket.on('3d_start_match', () => {
      const { room, m } = ctx(); if (!m) return;
      if (room.hostId !== m.pid) return socket.emit('3d_toast', 'Só o dono da sala pode iniciar.');
      if (room.phase !== 'lobby') return;
      const ready = (t) => [...room.members.values()].filter((x) => x.status === 'team' && x.team === t && x.connected).length + (room.bots.team === t ? room.bots.list.length : 0);
      if (ready('A') < 1 || ready('B') < 1) return socket.emit('3d_toast', 'Precisa de pelo menos 1 jogador (ou bot) em cada time.');
      startMatch(room);
    });

    socket.on('3d_leave_match', () => {
      const { room, m } = ctx(); if (!m || !m.inMatch) return;
      m.inMatch = false;
      if (room.sim) room.sim.players.delete(m.pid);
      if (room.sim && ![...room.sim.players.values()].some((p) => !p.bot)) endMatch(room);
      broadcastState(room);
    });

    // input contínuo (andar/mirar/atirar) — igual ao 2D, throttlado no próprio cliente
    socket.on('3d_input', (d) => {
      const { room, m } = ctx(); if (!m || !room.sim || !m.inMatch || !d) return;
      const p = room.sim.players.get(m.pid); if (!p || !p.alive) return;
      p.input.fwd = Math.max(-1, Math.min(1, Number(d.fwd) || 0));
      p.input.side = Math.max(-1, Math.min(1, Number(d.side) || 0));
      p.input.fire = !!d.fire;
      if (Number.isFinite(d.yaw)) p.yaw = Number(d.yaw);
      if (Number.isFinite(d.pitch)) p.pitch = Math.max(-1.5, Math.min(1.5, Number(d.pitch)));
    });
    // ações pontuais
    socket.on('3d_action', (d) => {
      const { room, m } = ctx(); if (!m || !room.sim || !m.inMatch || !d) return;
      const p = room.sim.players.get(m.pid); if (!p) return;
      if (d.t === 'jump') room.sim.jump(p);
      else if (d.t === 'reload') room.sim.reload(p);
      else if (d.t === 'weapon' && typeof d.w === 'string') room.sim.setWeapon(p, d.w);
      else if (d.t === 'cycle') room.sim.cycleWeapon(p, d.dir > 0 ? 1 : -1);
    });

    socket.on('3d_leave_room', () => {
      const { room, m } = ctx(); if (!m) return;
      socket.leave(key(room.code)); socket.data.room3d = null;
      removeMember(room, m.cid);
    });
    socket.on('disconnect', () => {
      const { room, m } = ctx(); if (!m) return;
      m.connected = false; m.socketId = null;
      if (room.sim && m.inMatch) { const p = room.sim.players.get(m.pid); if (p) p.input = { fwd: 0, side: 0, fire: false }; }
      m.graceTimer = setTimeout(() => removeMember(room, m.cid), MEMBER_GRACE);
      scheduleCloseIfEmpty(room);
      broadcastState(room);
    });
  });

  console.log('[3d] multiplayer 3D pronto');
}

module.exports = { setup3D };
