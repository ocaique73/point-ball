// Point Ball - servidor (Express + Socket.IO)
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');
const { DEFAULT_CONFIG, mergeConfig } = require('./shared/config');
const { Game } = require('./shared/game');
const { MAPS } = require('./shared/maps');
const Bots = require('./shared/bots');

// ---- Configuração (game-config.json na raiz sobrescreve os padrões) ----
let CONFIG = DEFAULT_CONFIG;
const cfgFile = path.join(__dirname, 'game-config.json');
if (fs.existsSync(cfgFile)) {
  try {
    CONFIG = mergeConfig(DEFAULT_CONFIG, JSON.parse(fs.readFileSync(cfgFile, 'utf8')));
    console.log('[config] game-config.json carregado');
  } catch (e) { console.error('[config] erro lendo game-config.json:', e.message); }
}

const ROOM_EMPTY_TTL = 2 * 60 * 1000; // sala vazia fecha em 2 min
const MEMBER_GRACE = 2 * 60 * 1000;   // jogador desconectado tem 2 min para voltar
const MAX_PER_TEAM = 5;
const MAX_WAITING = 10;
const MAX_QUEUE = 10;
const VALID_ROUNDS = [1, 2, 3, 5, 7];
const VALID_MODES = ['rounds', 'tdm', 'ffa', 'koth'];
const VALID_HILL = [50, 75, 100, 150];
const VALID_DM_TIME = [60, 120, 180, 300];
const VALID_KILLS = [20, 25, 30, 50];
const VALID_LEVELS = ['iniciante', 'amador', 'pro'];
const ROOM_NAME_RE = /^[A-Za-z0-9]{1,5}$/;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingInterval: 10000, pingTimeout: 8000 });

app.use('/shared', express.static(path.join(__dirname, 'shared')));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/sala/:code', (req, res) => res.sendFile(path.join(__dirname, 'public', 'room.html')));
app.get('/teste', (req, res) => res.sendFile(path.join(__dirname, 'public', 'teste.html')));
// demo 3D (Three.js): a página e a biblioteca three
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules', 'three', 'build')));
app.use('/vendor/three-addons', express.static(path.join(__dirname, 'node_modules', 'three', 'examples', 'jsm')));
app.get(['/demo3d', '/demo3d/'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'demo3d', 'index.html')));
app.get('/healthz', (req, res) => res.send('ok'));
app.get('/api/config', (req, res) => res.json(CONFIG));
app.get('/api/rooms', (req, res) => {
  const list = [];
  for (const r of rooms.values()) {
    const ms = [...r.members.values()];
    list.push({
      code: r.code, locked: !!r.password, map: r.map, rounds: r.rounds, phase: r.phase, gameMode: r.gameMode,
      players: ms.filter((m) => m.status === 'team').length, queue: r.queue.length
    });
  }
  res.json(list);
});

// ---------------- Salas ----------------
/** @type {Map<string, any>} */
const rooms = new Map();

const pidOf = (clientId) => crypto.createHash('sha256').update(String(clientId)).digest('hex').slice(0, 12);

function cleanProfile(p) {
  p = p || {};
  let name = String(p.name || '').trim().slice(0, 20) || 'Jogador';
  let avatar = String(p.avatar || '').trim();
  if (!/^https?:\/\//i.test(avatar) || avatar.length > 600) avatar = '';
  return { name, avatar };
}

// conta jogadores na sala de espera (inclui bots)
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
  for (const name of names) {
    let i = 1; while (list.some((b) => b.id === 'bot-' + i)) i++;
    list.push({ id: 'bot-' + i, name, color: Bots.COLORS[Math.floor(Math.random() * Bots.COLORS.length)] });
  }
  room.bots = { team, list };
}

function publicState(room) {
  return {
    code: room.code, hasPassword: !!room.password, map: room.map, rounds: room.rounds,
    hostId: room.hostId, phase: room.phase,
    gameMode: room.gameMode, dmTime: room.dmTime, killLimit: room.killLimit, botLevel: room.botLevel, hillTarget: room.hillTarget,
    bots: { team: room.bots.team, list: room.bots.list.map((b) => ({ id: b.id, name: b.name, color: b.color, avatar: '', team: room.bots.team, bot: true })) },
    members: [...room.members.values()].map((m) => ({
      id: m.pid, name: m.name, color: m.color, avatar: m.avatar, status: m.status, team: m.team,
      connected: m.connected, inMatch: m.inMatch
    })),
    queue: room.queue.map((cid) => room.members.get(cid)?.pid).filter(Boolean)
  };
}

function broadcastState(room) { io.to(room.code).emit('room_state', publicState(room)); }

function scheduleCloseIfEmpty(room) {
  const anyConnected = [...room.members.values()].some((m) => m.connected);
  if (anyConnected) {
    if (room.closeTimer) { clearTimeout(room.closeTimer); room.closeTimer = null; }
    return;
  }
  if (!room.closeTimer) {
    room.closeTimer = setTimeout(() => closeRoom(room), ROOM_EMPTY_TTL);
  }
}

function closeRoom(room) {
  if (room.loop) clearInterval(room.loop);
  for (const m of room.members.values()) if (m.graceTimer) clearTimeout(m.graceTimer);
  io.to(room.code).emit('room_closed');
  rooms.delete(room.code);
  console.log(`[sala] ${room.code} fechada`);
}

function pickHost(room) {
  const cur = [...room.members.values()].find((m) => m.pid === room.hostId);
  if (cur) return;
  const next = [...room.members.values()].find((m) => m.connected) || [...room.members.values()][0];
  room.hostId = next ? next.pid : null;
}

function promoteQueue(room) {
  let changed = false;
  while (room.queue.length && teamCount(room) < MAX_WAITING) {
    const cid = room.queue.shift();
    const m = room.members.get(cid);
    if (!m) continue;
    const a = teamCount(room, 'A'), b = teamCount(room, 'B');
    m.team = a <= b ? (a < MAX_PER_TEAM ? 'A' : 'B') : (b < MAX_PER_TEAM ? 'B' : 'A');
    m.status = 'team';
    changed = true;
    if (m.socketId) io.to(m.socketId).emit('toast', 'Você saiu da fila e entrou na sala de espera!');
  }
  return changed;
}

function removeMember(room, cid) {
  const m = room.members.get(cid);
  if (!m) return;
  if (m.graceTimer) clearTimeout(m.graceTimer);
  room.members.delete(cid);
  room.queue = room.queue.filter((q) => q !== cid);
  if (room.game) {
    room.game.removePlayer(m.pid);
    if (![...room.game.players.values()].some((p) => !p.bot)) endMatch(room, null); // só sobraram bots
  }
  pickHost(room);
  promoteQueue(room);
  scheduleCloseIfEmpty(room);
  broadcastState(room);
}

function startMatch(room) {
  const game = new Game(CONFIG, { mode: 'match', mapId: room.map, rounds: room.rounds,
    gameMode: room.gameMode, matchTime: room.dmTime, killLimit: room.killLimit, hillTarget: room.hillTarget });
  for (const m of room.members.values()) {
    if (m.status === 'team' && m.connected) {
      game.addPlayer({ id: m.pid, name: m.name, team: m.team, clientKnife: true });
      m.inMatch = true;
    }
  }
  for (const b of room.bots.list) game.addPlayer({ id: b.id, name: b.name, team: room.bots.team, bot: true }).botLevel = room.botLevel;
  room.game = game;
  room.phase = 'match';
  game.startMatch();
  const dt = 1 / CONFIG.tickRate;
  const every = Math.max(1, Math.round(CONFIG.tickRate / CONFIG.sendRate));
  let tick = 0, pending = [];
  room.loop = setInterval(() => {
    for (const p of game.players.values()) if (p.bot) Bots.think(game, p, dt);
    const evs = game.step(dt);
    if (evs.length) pending.push(...evs);
    if (++tick % every === 0 || evs.some((e) => e.type === 'match_end')) {
      io.to(room.code).emit('snap', { s: game.snapshot(), e: pending });
      pending = [];
    }
    const end = evs.find((e) => e.type === 'match_end');
    if (end) endMatch(room, end);
  }, 1000 / CONFIG.tickRate);
  io.to(room.code).emit('match_start', { config: CONFIG, map: room.map, rounds: room.rounds });
  broadcastState(room);
}

function endMatch(room, end) {
  if (room.loop) clearInterval(room.loop);
  room.loop = null;
  const game = room.game;
  room.game = null;
  room.phase = 'lobby';
  if (game && end) {
    const byPid = new Map([...room.members.values()].map((m) => [m.pid, m]));
    for (const b of room.bots.list) byPid.set(b.id, Object.assign({ avatar: '' }, b));
    const players = [...game.players.values()].map((p) => {
      const m = byPid.get(p.id) || {};
      return { id: p.id, name: m.name || p.name, avatar: m.avatar || '', color: m.color || '#fff', team: p.team, stats: p.stats };
    });
    io.to(room.code).emit('match_end', { winner: end.winner, score: end.score, rounds: game.totalRounds, players,
      mode: game.gameMode, killLimit: game.killLimit, hillTarget: game.hillTarget, timeUp: !!end.timeUp });
  } else {
    io.to(room.code).emit('match_aborted');
  }
  for (const m of room.members.values()) m.inMatch = false;
  promoteQueue(room);
  broadcastState(room);
}

// ---------------- Socket ----------------
io.on('connection', (socket) => {
  const ctx = () => {
    const room = rooms.get(socket.data.room);
    if (!room) return {};
    const m = room.members.get(socket.data.cid);
    if (!m || m.socketId !== socket.id) return { room };
    return { room, m };
  };

  socket.on('create_room', (d, ack) => {
    if (typeof ack !== 'function') return;
    d = d || {};
    const name = String(d.name || '').trim();
    const pass = String(d.password || '');
    if (!ROOM_NAME_RE.test(name)) return ack({ ok: false, error: 'Nome da sala: 1 a 5 letras ou números.' });
    if (pass && (pass.length < 3 || pass.length > 6)) return ack({ ok: false, error: 'Senha: mínimo 3 e máximo 6 caracteres.' });
    const code = name.toUpperCase();
    if (rooms.has(code)) return ack({ ok: false, error: 'Já existe uma sala com esse nome.' });
    const room = {
      code, password: pass, map: MAPS[d.map] ? d.map : 'deserto',
      rounds: VALID_ROUNDS.includes(Number(d.rounds)) ? Number(d.rounds) : 3,
      hostId: null, creatorPid: pidOf(d.clientId), phase: 'lobby', members: new Map(), queue: [],
      game: null, loop: null, closeTimer: null, bots: { team: 'B', list: [] },
      gameMode: VALID_MODES.includes(d.gameMode) ? d.gameMode : 'rounds',
      dmTime: VALID_DM_TIME.includes(Number(d.dmTime)) ? Number(d.dmTime) : 180,
      killLimit: VALID_KILLS.includes(Number(d.killLimit)) ? Number(d.killLimit) : 30,
      botLevel: 'amador',
      hillTarget: VALID_HILL.includes(Number(d.hillTarget)) ? Number(d.hillTarget) : 100
    };
    rooms.set(code, room);
    scheduleCloseIfEmpty(room); // se ninguém entrar em 2 min, fecha
    console.log(`[sala] ${code} criada`);
    ack({ ok: true, code });
  });

  socket.on('join_room', (d, ack) => {
    if (typeof ack !== 'function') return;
    d = d || {};
    const code = String(d.code || '').toUpperCase();
    const room = rooms.get(code);
    if (!room) return ack({ ok: false, error: 'not_found' });
    const cid = String(d.clientId || '').slice(0, 64);
    if (cid.length < 8) return ack({ ok: false, error: 'bad_client' });
    const prof = cleanProfile(d.profile);
    let m = room.members.get(cid);

    if (m) {
      // reconexão (recarregou a página / fechou e abriu o navegador)
      if (m.connected && m.socketId && m.socketId !== socket.id) {
        const old = io.sockets.sockets.get(m.socketId);
        if (old) { old.emit('kicked', 'A sala foi aberta em outra aba.'); old.data.room = null; old.disconnect(true); }
      }
      if (m.graceTimer) { clearTimeout(m.graceTimer); m.graceTimer = null; }
      Object.assign(m, prof);
    } else {
      if (room.password && String(d.password || '') !== room.password) {
        return ack({ ok: false, error: d.password ? 'wrong_password' : 'need_password' });
      }
      if (room.members.size >= MAX_WAITING + MAX_QUEUE + 5) return ack({ ok: false, error: 'full' });
      let status = 'choosing';
      if (teamCount(room) >= MAX_WAITING) {
        if (room.queue.length >= MAX_QUEUE) return ack({ ok: false, error: 'full' });
        status = 'queue';
        room.queue.push(cid);
      }
      m = { cid, pid: pidOf(cid), ...prof, status, team: null, connected: true, inMatch: false, socketId: null, graceTimer: null };
      room.members.set(cid, m);
    }
    m.socketId = socket.id;
    m.connected = true;
    socket.data.room = code;
    socket.data.cid = cid;
    socket.join(code);
    if (!room.hostId || (room.creatorPid === m.pid && !room.members.has(room.hostId))) pickHost(room);
    if (!room.hostId) room.hostId = m.pid;
    scheduleCloseIfEmpty(room);
    ack({ ok: true, you: m.pid, config: CONFIG, state: publicState(room),
      match: room.game ? { map: room.map, rounds: room.game.totalRounds } : null });
    broadcastState(room);
  });

  socket.on('choose_team', (d) => {
    const { room, m } = ctx();
    if (!m) return;
    const team = d && d.team === 'B' ? 'B' : 'A';
    if (m.status === 'queue') return socket.emit('toast', 'Você está na fila, aguarde uma vaga.');
    if (m.inMatch) return socket.emit('toast', 'Não dá para trocar de time durante a partida.');
    if (m.status === 'team' && m.team === team) return;
    if (teamCount(room, team) >= MAX_PER_TEAM) {
      if (m.status === 'choosing' && teamCount(room) >= MAX_WAITING) {
        if (room.queue.length >= MAX_QUEUE) return socket.emit('toast', 'Sala e fila lotadas.');
        m.status = 'queue'; room.queue.push(m.cid);
        broadcastState(room);
        return;
      }
      return socket.emit('toast', 'Esse time está cheio (5/5).');
    }
    if (m.status === 'choosing' && teamCount(room) >= MAX_WAITING) return;
    m.status = 'team';
    m.team = team;
    broadcastState(room);
  });

  socket.on('update_profile', (d) => {
    const { room, m } = ctx();
    if (!m) return;
    Object.assign(m, cleanProfile(d));
    broadcastState(room);
  });

  socket.on('update_settings', (d) => {
    const { room, m } = ctx();
    if (!m || room.hostId !== m.pid || room.phase !== 'lobby') return;
    if (d && MAPS[d.map]) room.map = d.map;
    if (d && VALID_ROUNDS.includes(Number(d.rounds))) room.rounds = Number(d.rounds);
    if (d && VALID_MODES.includes(d.gameMode)) room.gameMode = d.gameMode;
    if (d && VALID_DM_TIME.includes(Number(d.dmTime))) room.dmTime = Number(d.dmTime);
    if (d && VALID_KILLS.includes(Number(d.killLimit))) room.killLimit = Number(d.killLimit);
    if (d && VALID_LEVELS.includes(d.botLevel)) room.botLevel = d.botLevel;
    if (d && VALID_HILL.includes(Number(d.hillTarget))) room.hillTarget = Number(d.hillTarget);
    if (d && (d.bots != null || d.botTeam)) setBots(room, d.bots != null ? d.bots : room.bots.list.length, d.botTeam || room.bots.team);
    broadcastState(room);
  });

  socket.on('start_match', () => {
    const { room, m } = ctx();
    if (!m) return;
    if (room.hostId !== m.pid) return socket.emit('toast', 'Só o dono da sala pode iniciar.');
    if (room.phase !== 'lobby') return;
    const ready = (t) => [...room.members.values()].filter((x) => x.status === 'team' && x.team === t && x.connected).length
      + (room.bots.team === t ? room.bots.list.length : 0);
    if (room.gameMode === 'ffa') {
      if (ready('A') + ready('B') < 2) return socket.emit('toast', 'Precisa de pelo menos 2 jogadores (ou bots).');
    } else if (ready('A') < 1 || ready('B') < 1) return socket.emit('toast', 'Precisa de pelo menos 1 jogador em cada time.');
    startMatch(room);
  });

  socket.on('input', (d) => {
    const { room, m } = ctx();
    if (m && room.game && m.inMatch) room.game.setInput(m.pid, d);
  });
  socket.on('aim', (d) => {
    const { room, m } = ctx();
    if (m && room.game && m.inMatch && Array.isArray(d)) room.game.setAim(m.pid, Number(d[0]), Number(d[1]));
  });
  socket.on('knife', (d) => {
    const { room, m } = ctx();
    if (m && room.game && m.inMatch && d) room.game.knifeSwing(m.pid, typeof d.t === 'string' ? d.t : null, Number(d.ax), Number(d.ay));
  });
  socket.on('bomb', (d) => {
    const { room, m } = ctx();
    if (m && room.game && m.inMatch && d) room.game.throwBomb(m.pid, Number(d.x), Number(d.y));
  });
  socket.on('smoke', (d) => {
    const { room, m } = ctx();
    if (m && room.game && m.inMatch && d) room.game.throwBomb(m.pid, Number(d.x), Number(d.y), 'smoke');
  });
  socket.on('weapon', (w) => {
    const { room, m } = ctx();
    if (m && room.game && m.inMatch) room.game.setWeapon(m.pid, w === 2 || w === 'knife' ? 'knife' : 'gun');
  });
  socket.on('reload', () => {
    const { room, m } = ctx();
    if (m && room.game && m.inMatch) room.game.requestReload(m.pid);
  });
  socket.on('jump', () => {
    const { room, m } = ctx();
    if (m && room.game && m.inMatch) room.game.requestJump(m.pid);
  });

  socket.on('leave_room', () => {
    const { room, m } = ctx();
    if (!m) return;
    socket.leave(room.code);
    socket.data.room = null;
    removeMember(room, m.cid);
  });

  socket.on('disconnect', () => {
    const { room, m } = ctx();
    if (!m) return;
    m.connected = false;
    m.socketId = null;
    if (room.game && m.inMatch) room.game.setInput(m.pid, {});
    m.graceTimer = setTimeout(() => removeMember(room, m.cid), MEMBER_GRACE);
    scheduleCloseIfEmpty(room);
    broadcastState(room);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Point Ball rodando em http://localhost:${PORT}`));
