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
const VALID_ROUND_TIMES = [0, 60, 120, 180, 300, 600]; // tempo da partida (mata-mata / colina); 0 = sem limite
const VALID_MODES = ['tdm', 'rounds', 'ffa', 'koth'];
const VALID_ROUNDS = [1, 2, 3, 5, 7];
const VALID_KILLS = [20, 25, 30, 50];
const VALID_HILL = [50, 75, 100, 150];
const FLY_REGIONS = { gru: 'São Paulo, Brasil', gig: 'Rio de Janeiro, Brasil', eze: 'Buenos Aires, Argentina', scl: 'Santiago, Chile', bog: 'Bogotá, Colômbia', mia: 'Miami, EUA', iad: 'Virginia, EUA', ord: 'Chicago, EUA', dfw: 'Dallas, EUA', lax: 'Los Angeles, EUA', sjc: 'San Jose, EUA', sea: 'Seattle, EUA', ams: 'Amsterdã, Holanda', fra: 'Frankfurt, Alemanha', lhr: 'Londres, Inglaterra', cdg: 'Paris, França', mad: 'Madri, Espanha', nrt: 'Tóquio, Japão', sin: 'Singapura', syd: 'Sydney, Austrália' };
// onde o servidor está (pra mostrar no Tab): SERVER_LOCATION > região do Fly.io > descobre pelo IP público
let serverLocation = process.env.SERVER_LOCATION || (process.env.FLY_REGION && (FLY_REGIONS[process.env.FLY_REGION] || process.env.FLY_REGION)) || null;
async function detectLocation() {
  if (serverLocation) return;
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch('http://ip-api.com/json/?fields=status,city,regionName,country', { signal: ctl.signal });
    clearTimeout(t);
    const j = await r.json();
    if (j && j.status === 'success') serverLocation = [j.city, j.regionName, j.country].filter(Boolean).join(', ');
  } catch (e) { /* sem internet ou bloqueado: fica "desconhecido" */ }
  if (!serverLocation) serverLocation = process.env.RENDER ? 'Render (EUA)' : 'desconhecido';
  console.log('[3d] servidor em:', serverLocation);
}

function pidOf(clientId) { return crypto.createHash('sha256').update(String(clientId)).digest('hex').slice(0, 12); }

function cleanName(n) { return String(n || '').trim().slice(0, 20) || 'Jogador'; }
// roupa do personagem (a mesma estrutura de looks3d.js): só valores conhecidos
const LOOK_CHARS = ['hood', 'rogue', 'knight', 'barbarian', 'mage'], LOOK_HATS = ['none', 'cap', 'beanie', 'top', 'cowboy', 'crown', 'band'];
function cleanLook(l) {
  if (!l || typeof l !== 'object') return null;
  const o = { m: LOOK_CHARS.includes(l.m) ? l.m : 'hood', hat: LOOK_HATS.includes(l.hat) ? l.hat : 'none', cp: l.cp ? 1 : 0, o: l.o ? 1 : 0 };
  for (const k of ['s', 'p', 'c', 'h', 'a', 'b', 'g', 'hr', 'hc']) { const v = Math.floor(Number(l[k])); o[k] = v >= 0 && v < 8 ? v : 0; }
  return o;
}

async function setup3D(io, CFG) {
  const { Sim3D } = await import('./public/demo3d/sim3d.js');
  const { world3D, simOptions, MAPS3D } = await import('./public/demo3d/world3d.js');
  const ALL_MAPS = Object.assign({}, MAPS, MAPS3D); // mapas do 2D + os que só existem no 3D
  const rooms = new Map();
  const key = (code) => '3d:' + code;
  detectLocation();

  function teamCount(room, team) {
    let n = 0;
    for (const m of room.members.values()) if (m.status === 'team' && (!team || m.team === team)) n++;
    for (const t of ['A', 'B']) if (!team || team === t) n += room.bots[t].length;
    return n;
  }
  function humansIn(room, team) {
    let n = 0;
    for (const m of room.members.values()) if (m.status === 'team' && m.team === team) n++;
    return n;
  }
  // bots nos dois times (dá pra ter bot no seu time também)
  function setBots(room, count, team) {
    team = team === 'A' ? 'A' : 'B';
    const max = MAX_PER_TEAM - humansIn(room, team);
    count = Math.max(0, Math.min(max, Math.floor(Number(count) || 0)));
    const list = room.bots[team].slice(0, count), other = room.bots[team === 'A' ? 'B' : 'A'];
    const names = Bots.randomNames(count - list.length, list.concat(other).map((b) => b.name));
    for (const name of names) { let i = 1; while (list.some((b) => b.id === 'bot-' + team + i)) i++; list.push({ id: 'bot-' + team + i, name }); }
    room.bots[team] = list;
  }

  function publicState(room) {
    return {
      code: room.code, hasPassword: !!room.password, map: room.map, hostId: room.hostId, phase: room.phase,
      botLevel: room.botLevel, roundTime: room.roundTime, mode: room.mode, rounds: room.rounds, killLimit: room.killLimit, hillTarget: room.hillTarget,
      bots: { A: room.bots.A.map((b) => ({ id: b.id, name: b.name, team: 'A', bot: true })), B: room.bots.B.map((b) => ({ id: b.id, name: b.name, team: 'B', bot: true })) },
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
      if (p) p.input = { fwd: 0, side: 0, fire: false, sprint: false };
    }
    pickHost(room);
    scheduleCloseIfEmpty(room);
    broadcastState(room);
  }

  function startMatch(room) {
    // o mundo 3D (mapa 40% maior, caverna, iglus, portas, andar de cima dos portais...) é montado igual ao do navegador
    const world = world3D(room.map, G, ALL_MAPS, CFG);
    const sim = new Sim3D(world.walls, world.W, world.H, Object.assign(simOptions(world), {
      mode: room.mode, rounds: room.rounds, killLimit: room.killLimit, hillTarget: room.hillTarget,
      matchTime: room.mode === 'rounds' ? 0 : room.roundTime
    }));
    room.matchInfo = { map: room.map, roundTime: room.mode === 'rounds' ? 0 : room.roundTime, mode: room.mode };
    for (const m of room.members.values()) {
      if (m.status === 'team' && m.connected) { sim.addPlayer({ id: m.pid, name: m.name, team: m.team, look: m.look }); m.inMatch = true; }
    }
    for (const t of ['A', 'B']) for (const b of room.bots[t]) sim.addPlayer({ id: b.id, name: b.name, team: t, bot: true, level: room.botLevel });
    room.sim = sim;
    room.phase = 'match';
    const dt = 1 / CFG.tickRate;
    const every = Math.max(1, Math.round(CFG.tickRate / CFG.sendRate));
    let tick = 0, pending = [];
    room.loop = setInterval(() => {
      const evs = sim.step(dt);
      if (evs.length) pending.push(...evs);
      // acabou a partida (limite de abates / pontos / rounds / tempo): mostra o resultado uns segundos e volta pra sala
      if (sim.result && !room.endTimer) room.endTimer = setTimeout(() => { room.endTimer = null; if (room.sim === sim) endMatch(room, sim.result); }, 9000); // dá tempo da killcam final (espera 1,6 s + replay)
      if (++tick % every === 0) {
        io.to(key(room.code)).emit('3d_state', { s: sim.snapshot(), e: pending });
        pending = [];
      }
    }, 1000 / CFG.tickRate);
    io.to(key(room.code)).emit('3d_match_start', room.matchInfo);
    broadcastState(room);
  }

  function endMatch(room, result) {
    if (room.endTimer) { clearTimeout(room.endTimer); room.endTimer = null; }
    if (room.loop) clearInterval(room.loop);
    room.loop = null; room.sim = null; room.phase = 'lobby'; room.matchInfo = null;
    for (const m of room.members.values()) m.inMatch = false;
    io.to(key(room.code)).emit('3d_match_end', result || null);
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
        code, password: pass, map: ALL_MAPS[d.map] && d.map !== 'teste' ? d.map : 'deserto',
        hostId: null, creatorPid: pidOf(d.clientId), phase: 'lobby', members: new Map(),
        sim: null, loop: null, closeTimer: null, bots: { A: [], B: [] }, botLevel: 'amador',
        roundTime: 300, mode: 'tdm', rounds: 3, killLimit: 30, hillTarget: 100
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
        m.name = cleanName(d.name) || m.name; m.look = cleanLook(d.look) || m.look;
      } else {
        if (room.password && String(d.password || '') !== room.password) return ack({ ok: false, error: d.password ? 'wrong_password' : 'need_password' });
        if (teamCount(room) >= MAX_PER_TEAM * 2 + 4) return ack({ ok: false, error: 'full' });
        m = { cid, pid: pidOf(cid), name: cleanName(d.name), look: cleanLook(d.look), status: 'choosing', team: null, connected: true, inMatch: false, socketId: null, graceTimer: null };
        room.members.set(cid, m);
      }
      m.socketId = socket.id; m.connected = true;
      socket.data.room3d = code; socket.data.cid3d = cid;
      socket.join(key(code));
      if (!room.hostId || (room.creatorPid === m.pid && !room.members.has(room.hostId))) pickHost(room);
      if (!room.hostId) room.hostId = m.pid;
      scheduleCloseIfEmpty(room);
      ack({ ok: true, you: m.pid, state: publicState(room), match: room.phase === 'match' ? room.matchInfo : null });
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
      if (d && ALL_MAPS[d.map] && d.map !== 'teste') room.map = d.map;
      if (d && VALID_LEVELS.includes(d.botLevel)) room.botLevel = d.botLevel;
      if (d && d.botsA != null) setBots(room, d.botsA, 'A');
      if (d && d.botsB != null) setBots(room, d.botsB, 'B');
      if (d && VALID_ROUND_TIMES.includes(Number(d.roundTime))) room.roundTime = Number(d.roundTime);
      if (d && VALID_MODES.includes(d.mode)) room.mode = d.mode;
      if (d && VALID_ROUNDS.includes(Number(d.rounds))) room.rounds = Number(d.rounds);
      if (d && VALID_KILLS.includes(Number(d.killLimit))) room.killLimit = Number(d.killLimit);
      if (d && VALID_HILL.includes(Number(d.hillTarget))) room.hillTarget = Number(d.hillTarget);
      broadcastState(room);
    });

    socket.on('3d_start_match', () => {
      const { room, m } = ctx(); if (!m) return;
      if (room.hostId !== m.pid) return socket.emit('3d_toast', 'Só o dono da sala pode iniciar.');
      if (room.phase !== 'lobby') return;
      const ready = (t) => [...room.members.values()].filter((x) => x.status === 'team' && x.team === t && x.connected).length + room.bots[t].length;
      if (room.mode === 'ffa' ? ready('A') + ready('B') < 2 : ready('A') < 1 || ready('B') < 1) return socket.emit('3d_toast', room.mode === 'ffa' ? 'Precisa de pelo menos 2 jogadores (ou bots).' : 'Precisa de pelo menos 1 jogador (ou bot) em cada time.');
      startMatch(room);
    });

    // dono encerra a partida pra todo mundo (volta todos pra sala de espera)
    socket.on('3d_end_match', () => {
      const { room, m } = ctx(); if (!m || room.hostId !== m.pid || room.phase !== 'match') return;
      endMatch(room);
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
      p.input.fire = !!d.fire; p.input.sprint = !!d.sprint; p.input.aim = !!d.aim;
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
      else if (d.t === 'primary' && typeof d.w === 'string') room.sim.setPrimary(p, d.w);
    });
    // trocou a roupa no menu: vale na hora (e na próxima partida)
    socket.on('3d_set_look', (d) => {
      const { room, m } = ctx(); if (!m) return;
      m.look = cleanLook(d);
      if (room.sim) { const p = room.sim.players.get(m.pid); if (p) p.look = m.look; }
    });
    // ping: o navegador mede o tempo de ida e volta; aproveita pra dizer onde o servidor está
    socket.on('3d_ping', (d, ack) => { if (typeof ack === 'function') ack({ loc: serverLocation || 'descobrindo...' }); });

    socket.on('3d_leave_room', () => {
      const { room, m } = ctx(); if (!m) return;
      socket.leave(key(room.code)); socket.data.room3d = null;
      removeMember(room, m.cid);
    });
    socket.on('disconnect', () => {
      const { room, m } = ctx(); if (!m) return;
      m.connected = false; m.socketId = null;
      if (room.sim && m.inMatch) { const p = room.sim.players.get(m.pid); if (p) p.input = { fwd: 0, side: 0, fire: false, sprint: false, aim: false }; }
      m.graceTimer = setTimeout(() => removeMember(room, m.cid), MEMBER_GRACE);
      scheduleCloseIfEmpty(room);
      broadcastState(room);
    });
  });

  console.log('[3d] multiplayer 3D pronto');
}

module.exports = { setup3D };
