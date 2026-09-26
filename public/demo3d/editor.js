// Editor de mapa do Point Ball 3D: mexe nos muros/caixas/paredes/árvores/dunas/pirâmides de cada mapa (visto de cima),
// nos números do tiro e do boneco, e nos efeitos. Tudo vira um "rascunho" guardado neste navegador (o jogo aberto em
// outra aba, ou a prévia 3D aqui embaixo, atualiza na hora). "Salvar" manda pro servidor (com senha), que guarda no
// GitHub numa branch separada; de lá o Claude coloca no jogo de verdade.
import { world3D, editableItems, setEditOverride, bakedEdits, MAPS3D, MAP_SCALE, MAP_SCALE_OF } from '/demo3d/world3d.js';
import { WEAPONS, WEAPON_IDS, P, NADE, TREE } from '/demo3d/sim3d.js';
import { FX_DEFAULT, FX_INFO } from '/demo3d/fx3d.js';

const $ = (id) => document.getElementById(id);
const G = window.RC_GAME, MAPS = Object.assign({}, window.RC_MAPS.MAPS, MAPS3D), CFG = window.RC_CONFIG.DEFAULT_CONFIG;
const MAP_LIST = [['deserto', 'Deserto'], ['neve', 'Neve'], ['floresta', 'Floresta'], ['nave', 'Base na Lua'], ['portal', 'Portais'], ['vulcao', 'Vulcão'], ['escuro', 'Sala escura'], ['cidade', 'Cidade à noite'], ['metro', 'Estação de metrô'], ['mar', 'Plataforma no mar'], ['obra', 'Canteiro de obras'], ['fabrica', 'Fábrica'], ['castelo', 'Castelo'], ['navio', 'Navio na tempestade']];
const STYLES = [['', 'padrão do mapa'], ['stone', 'pedra'], ['wood', 'madeira'], ['plank', 'tábuas'], ['container', 'contêiner'], ['concrete', 'concreto'], ['brick', 'tijolo'], ['sandstone', 'arenito'], ['basalt', 'pedra vulcânica'], ['tile', 'azulejo'], ['ice', 'gelo'], ['hedge', 'cerca viva'], ['grate', 'grade'], ['barrel', 'barril'], ['cannon', 'canhão']];
const SWATCH = ['#a6a6a2', '#8f897c', '#6b7280', '#4b5563', '#e5e7eb', '#9a6b3f', '#6b4a2a', '#c08a3e', '#2f6f9f', '#b03a2e', '#2f8f5b', '#d9822b', '#e2b33c', '#4e7a3a', '#7a5634', '#2d2d2d'];
const TYPE_NAME = { box: 'Muro / caixa', wall2: 'Parede diagonal', tree: 'Árvore', dune: 'Montanha de areia', pyr: 'Pirâmide' };
const clone = (o) => JSON.parse(JSON.stringify(o));
const r4 = (v) => Math.round(v * 10000) / 10000;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- rascunho ----------
const EMPTY = () => ({ v: 1, maps: {}, weapons: {}, player: {}, nade: {}, fx: {} });
let draft = (() => { try { const d = JSON.parse(localStorage.getItem('pb3d_edits') || 'null'); if (d && typeof d === 'object') return Object.assign(EMPTY(), d); } catch (e) {} return Object.assign(EMPTY(), clone(bakedEdits() || {})); })();
let saveTimer = 0;
function persist() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem('pb3d_edits', JSON.stringify(draft)); } catch (e) {} }, 180); }
function status(t, cls) { const s = $('status'); s.textContent = t; s.className = cls || ''; }

// ---------- mapa atual ----------
let mapId = localStorage.getItem('pb3d_editor_map') || 'metro', W = 1, H = 1, fixed = null, defaults = [], items = [], theme = {};
let lastState = [], sel = -1, partner = -1, partnerMode = null, tool = 'select', mirror = true, snap = true;
const undoSt = [], redoSt = [];
function buildWorld(itemsOverride) {
  const o = clone(draft); o.maps = Object.assign({}, o.maps);
  if (itemsOverride === null) delete o.maps[mapId]; else o.maps[mapId] = { items: itemsOverride };
  setEditOverride(o); const w = world3D(mapId, G, MAPS, CFG); setEditOverride(null); return w;
}
function loadMap(id) {
  mapId = id; try { localStorage.setItem('pb3d_editor_map', id); } catch (e) {}
  fixed = buildWorld([]); W = fixed.W; H = fixed.H; theme = (MAPS[id] && MAPS[id].theme) || {};
  defaults = editableItems(buildWorld(null));
  items = draft.maps[id] && Array.isArray(draft.maps[id].items) ? clone(draft.maps[id].items) : clone(defaults);
  sel = -1; partner = -1; undoSt.length = 0; redoSt.length = 0; lastState = clone(items);
  fit(); draw(); props();
  if ($('center').classList.contains('split')) $('pv').src = '/demo3d/?preview=' + id;
  $('hint').innerHTML = hintText();
}
function commit(noUndo) {
  if (!noUndo) { undoSt.push(JSON.stringify(lastState)); if (undoSt.length > 80) undoSt.shift(); redoSt.length = 0; }
  lastState = clone(items);
  if (JSON.stringify(items) === JSON.stringify(defaults)) delete draft.maps[mapId]; else draft.maps[mapId] = { items: clone(items) };
  persist(); draw();
}
function undo() { if (!undoSt.length) return; redoSt.push(JSON.stringify(items)); items = JSON.parse(undoSt.pop()); sel = Math.min(sel, items.length - 1); lastState = clone(items); commit(true); props(); }
function redo() { if (!redoSt.length) return; undoSt.push(JSON.stringify(items)); items = JSON.parse(redoSt.pop()); lastState = clone(items); commit(true); props(); }

// ---------- espelho (o mesmo item do outro lado do mapa) ----------
const near = (a, b, e) => Math.abs(a - b) < (e || 0.004);
function mirrorOf(it, mode) {
  const m = clone(it), rot = mode === 'rot';
  if (it.t === 'box') { m.x = r4(1 - it.x - it.w); if (rot) m.z = r4(1 - it.z - it.h); }
  else if (it.t === 'tree' || it.t === 'pyr') { m.x = r4(1 - it.x); if (rot) m.z = r4(1 - it.z); }
  else { m.ax = r4(1 - it.ax); m.bx = r4(1 - it.bx); if (rot) { m.az = r4(1 - it.az); m.bz = r4(1 - it.bz); } }
  return m;
}
function same(a, b) {
  if (a.t !== b.t) return false;
  if (a.t === 'box') return near(a.x, b.x) && near(a.z, b.z) && near(a.w, b.w) && near(a.h, b.h);
  if (a.t === 'tree' || a.t === 'pyr') return near(a.x, b.x) && near(a.z, b.z);
  return (near(a.ax, b.ax) && near(a.az, b.az) && near(a.bx, b.bx) && near(a.bz, b.bz)) || (near(a.ax, b.bx) && near(a.az, b.bz) && near(a.bx, b.ax) && near(a.bz, b.az));
}
function findPartner(i) {
  partner = -1; partnerMode = null; if (i < 0) return;
  for (const mode of ['x', 'rot']) {
    const m = mirrorOf(items[i], mode);
    if (same(m, items[i])) continue; // está bem no meio: não tem par
    const j = items.findIndex((q, k) => k !== i && same(q, m));
    if (j >= 0) { partner = j; partnerMode = mode; return; }
  }
}
function syncPartner() { if (mirror && sel >= 0 && partner >= 0) items[partner] = mirrorOf(items[sel], partnerMode); }

// ---------- desenho (visto de cima) ----------
const cv = $('cv'), g = cv.getContext('2d');
let view = { s: 0.3, ox: 20, oy: 20 };
function resize() { const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1; cv.width = Math.max(10, r.width * dpr); cv.height = Math.max(10, r.height * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0); draw(); }
function fit() { const r = cv.getBoundingClientRect(), m = 30; view.s = Math.min((r.width - m * 2) / W, (r.height - m * 2) / H); view.ox = (r.width - W * view.s) / 2; view.oy = (r.height - H * view.s) / 2; }
const sx = (x) => view.ox + x * view.s, sy = (z) => view.oy + z * view.s;
const wx = (px) => (px - view.ox) / view.s, wz = (py) => (py - view.oy) / view.s;
function hexA(hex, a) { const c = parseInt(String(hex || '#888888').slice(1, 7), 16); return `rgba(${c >> 16 & 255},${c >> 8 & 255},${c & 255},${a})`; }
function draw() {
  const r = cv.getBoundingClientRect(); g.clearRect(0, 0, r.width, r.height);
  if (!fixed) return;
  // chão
  g.fillStyle = theme.ground || '#445'; g.globalAlpha = 0.55;
  const outline = (fixed.deck && fixed.deck.poly) || fixed.shape;
  if (outline) { g.beginPath(); outline.forEach(([x, z], i) => (i ? g.lineTo(sx(x), sy(z)) : g.moveTo(sx(x), sy(z)))); g.closePath(); g.fill(); }
  else g.fillRect(sx(0), sy(0), W * view.s, H * view.s);
  g.globalAlpha = 1;
  // grade de 100 em 100
  g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 1; g.beginPath();
  for (let x = 0; x <= W; x += 100) { g.moveTo(sx(x), sy(0)); g.lineTo(sx(x), sy(H)); }
  for (let z = 0; z <= H; z += 100) { g.moveTo(sx(0), sy(z)); g.lineTo(sx(W), sy(z)); }
  g.stroke();
  g.strokeStyle = 'rgba(255,204,51,.25)'; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(sx(W / 2), sy(0)); g.lineTo(sx(W / 2), sy(H)); g.stroke(); g.setLineDash([]); // meio
  // onde cada time nasce
  const spx = fixed.spawnX || [60, 250];
  g.fillStyle = 'rgba(59,130,246,.13)'; g.fillRect(sx(spx[0]), sy(80), (spx[1] - spx[0]) * view.s, (H - 160) * view.s);
  g.fillStyle = 'rgba(239,68,68,.13)'; g.fillRect(sx(W - spx[1]), sy(80), (spx[1] - spx[0]) * view.s, (H - 160) * view.s);
  // peças fixas (não dá pra mexer): cinza
  for (const R of fixed.walls) {
    if (R.tree || R.crest) continue;
    g.fillStyle = R.border ? 'rgba(148,163,184,.55)' : 'rgba(148,163,184,.28)'; g.fillRect(sx(R.x), sy(R.y), R.w * view.s, R.h * view.s);
  }
  g.strokeStyle = 'rgba(148,163,184,.6)';
  for (const S of fixed.segs || []) { if (S.user) continue; g.lineWidth = Math.max(1, S.t * 2 * view.s); g.beginPath(); g.moveTo(sx(S.ax), sy(S.az)); g.lineTo(sx(S.bx), sy(S.bz)); g.stroke(); }
  g.lineWidth = 1;
  for (const D of fixed.discs || []) { g.strokeStyle = 'rgba(148,163,184,.45)'; g.beginPath(); g.arc(sx(D.cx), sy(D.cz), D.r1 * view.s, 0, 7); g.stroke(); }
  for (const S of fixed.slopes || []) { g.fillStyle = S.rail ? 'rgba(148,163,184,.5)' : 'rgba(148,163,184,.22)'; g.fillRect(sx(S.x0), sy(S.z0), (S.x1 - S.x0) * view.s, (S.z1 - S.z0) * view.s); }
  for (const q of fixed.igloos || []) { g.strokeStyle = 'rgba(200,230,255,.6)'; g.beginPath(); g.arc(sx(q.x), sy(q.z), 250 * view.s, 0, 7); g.stroke(); }
  // itens (dá pra mexer)
  items.forEach((it, i) => drawItem(it, i === sel ? 'sel' : i === partner && mirror ? 'mir' : ''));
  if (sel >= 0 && items[sel]) drawHandles(items[sel]);
  if (drag && drag.kind === 'new2') { g.strokeStyle = '#ffcc33'; g.lineWidth = 3; g.beginPath(); g.moveTo(sx(drag.ax), sy(drag.az)); g.lineTo(sx(drag.bx), sy(drag.bz)); g.stroke(); }
}
function drawItem(it, mode) {
  const hl = mode === 'sel' ? '#ffcc33' : mode === 'mir' ? '#ffcc3388' : null;
  if (it.t === 'box') {
    const top = it.top || 120, a = Math.min(0.95, 0.35 + top / 400), col = it.tint || theme.wall || '#9aa';
    g.fillStyle = hexA(col, a); g.fillRect(sx(it.x * W), sy(it.z * H), it.w * W * view.s, it.h * H * view.s);
    if (it.y0) { g.strokeStyle = 'rgba(255,255,255,.5)'; g.setLineDash([3, 3]); g.strokeRect(sx(it.x * W), sy(it.z * H), it.w * W * view.s, it.h * H * view.s); g.setLineDash([]); }
    g.strokeStyle = hl || 'rgba(0,0,0,.5)'; g.lineWidth = hl ? 2 : 1; g.setLineDash(mode === 'mir' ? [5, 4] : []); g.strokeRect(sx(it.x * W), sy(it.z * H), it.w * W * view.s, it.h * H * view.s); g.setLineDash([]);
    if (it.w * W * view.s > 26 && it.h * H * view.s > 13) { g.fillStyle = 'rgba(255,255,255,.85)'; g.font = '10px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(top), sx((it.x + it.w / 2) * W), sy((it.z + it.h / 2) * H)); }
  } else if (it.t === 'wall2') {
    g.strokeStyle = hl || hexA(theme.wall || '#9aa', 0.9); g.lineWidth = Math.max(2, (it.th || 24) * view.s); g.lineCap = 'round'; g.beginPath(); g.moveTo(sx(it.ax * W), sy(it.az * H)); g.lineTo(sx(it.bx * W), sy(it.bz * H)); g.stroke(); g.lineCap = 'butt';
  } else if (it.t === 'dune') {
    g.strokeStyle = hexA('#e6c68c', 0.35 + Math.min(0.5, it.hk / 5)); g.lineWidth = Math.max(3, it.wk * 150 * 2 * view.s * 0.6); g.lineCap = 'round'; g.beginPath(); g.moveTo(sx(it.ax * W), sy(it.az * H)); g.lineTo(sx(it.bx * W), sy(it.bz * H)); g.stroke();
    g.strokeStyle = hl || '#a4763c'; g.lineWidth = hl ? 3 : 2; g.beginPath(); g.moveTo(sx(it.ax * W), sy(it.az * H)); g.lineTo(sx(it.bx * W), sy(it.bz * H)); g.stroke(); g.lineCap = 'butt';
  } else if (it.t === 'tree') {
    g.fillStyle = 'rgba(63,125,58,.85)'; g.beginPath(); g.arc(sx(it.x * W), sy(it.z * H), Math.max(4, TREE.r * view.s * 1.6), 0, 7); g.fill();
    g.fillStyle = '#4a3220'; g.beginPath(); g.arc(sx(it.x * W), sy(it.z * H), Math.max(2, TREE.r * view.s), 0, 7); g.fill();
    if (hl) { g.strokeStyle = hl; g.lineWidth = 2; g.beginPath(); g.arc(sx(it.x * W), sy(it.z * H), Math.max(6, TREE.r * view.s * 1.8), 0, 7); g.stroke(); }
  } else if (it.t === 'pyr') {
    const x = sx(it.x * W), z = sy(it.z * H), h = it.half * view.s;
    g.fillStyle = 'rgba(214,176,112,.8)'; g.fillRect(x - h, z - h, h * 2, h * 2);
    g.strokeStyle = hl || 'rgba(90,60,20,.7)'; g.lineWidth = hl ? 2 : 1; g.strokeRect(x - h, z - h, h * 2, h * 2); g.beginPath(); g.moveTo(x - h, z - h); g.lineTo(x + h, z + h); g.moveTo(x + h, z - h); g.lineTo(x - h, z + h); g.stroke();
  }
}
// alças: pontos pra esticar (caixa: cantos e lados; parede/duna: as 2 pontas; pirâmide: canto)
function handlesOf(it) {
  if (it.t === 'box') { const x0 = it.x * W, z0 = it.z * H, x1 = (it.x + it.w) * W, z1 = (it.z + it.h) * H, xm = (x0 + x1) / 2, zm = (z0 + z1) / 2; return [['nw', x0, z0], ['ne', x1, z0], ['sw', x0, z1], ['se', x1, z1], ['n', xm, z0], ['s', xm, z1], ['w', x0, zm], ['e', x1, zm]]; }
  if (it.t === 'wall2' || it.t === 'dune') return [['a', it.ax * W, it.az * H], ['b', it.bx * W, it.bz * H]];
  if (it.t === 'pyr') return [['size', it.x * W + it.half, it.z * H + it.half]];
  return [];
}
function drawHandles(it) { g.fillStyle = '#ffcc33'; g.strokeStyle = '#1b1300'; for (const [, x, z] of handlesOf(it)) { g.beginPath(); g.rect(sx(x) - 4, sy(z) - 4, 8, 8); g.fill(); g.stroke(); } }
function hitItem(x, z) {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i], pad = 6 / view.s;
    if (it.t === 'box' && x >= it.x * W - pad && x <= (it.x + it.w) * W + pad && z >= it.z * H - pad && z <= (it.z + it.h) * H + pad) return i;
    if (it.t === 'tree' && Math.hypot(x - it.x * W, z - it.z * H) < TREE.r * 1.6 + pad) return i;
    if (it.t === 'pyr' && Math.abs(x - it.x * W) < it.half && Math.abs(z - it.z * H) < it.half) return i;
    if (it.t === 'wall2' || it.t === 'dune') {
      const ax = it.ax * W, az = it.az * H, bx = it.bx * W, bz = it.bz * H, dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, u = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
      const d = Math.hypot(x - ax - dx * u, z - az - dz * u); if (d < (it.t === 'dune' ? 40 : (it.th || 24) / 2 + 10) + pad) return i;
    }
  }
  return -1;
}

// ---------- mouse ----------
let drag = null, spaceDown = false;
const snapV = (v) => (snap ? Math.round(v / 10) * 10 : v);
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('wheel', (e) => { e.preventDefault(); const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, k = Math.exp(-e.deltaY * 0.0015), x = wx(mx), z = wz(my); view.s = Math.max(0.05, Math.min(4, view.s * k)); view.ox = mx - x * view.s; view.oy = my - z * view.s; draw(); }, { passive: false });
cv.addEventListener('pointerdown', (e) => {
  cv.setPointerCapture(e.pointerId);
  const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, x = wx(mx), z = wz(my);
  if (e.button === 1 || e.button === 2 || spaceDown) { drag = { kind: 'pan', mx, my, ox: view.ox, oy: view.oy }; return; }
  if (tool !== 'select') { addAt(tool, snapV(x), snapV(z), e); return; }
  // alça do selecionado primeiro
  if (sel >= 0) for (const [h, hx, hz] of handlesOf(items[sel])) if (Math.abs(sx(hx) - mx) < 7 && Math.abs(sy(hz) - my) < 7) { drag = { kind: 'handle', h, start: clone(items[sel]), x, z }; return; }
  const i = hitItem(x, z);
  if (i !== sel) { sel = i; findPartner(i); props(); }
  if (i >= 0) { drag = { kind: 'move', start: clone(items[i]), x, z }; draw(); }
  else drag = { kind: 'pan', mx, my, ox: view.ox, oy: view.oy };
  draw();
});
cv.addEventListener('pointermove', (e) => {
  const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, x = wx(mx), z = wz(my);
  $('coord').textContent = `x ${Math.round(x)} · z ${Math.round(z)}   (mapa ${W} x ${H})`;
  if (!drag) return;
  if (drag.kind === 'pan') { view.ox = drag.ox + mx - drag.mx; view.oy = drag.oy + my - drag.my; draw(); return; }
  if (drag.kind === 'new2') { drag.bx = snapV(x); drag.bz = snapV(z); draw(); return; }
  const it = items[sel], s0 = drag.start, dx = x - drag.x, dz = z - drag.z;
  if (drag.kind === 'move') {
    if (it.t === 'box') { it.x = r4(snapV(s0.x * W + dx) / W); it.z = r4(snapV(s0.z * H + dz) / H); }
    else if (it.t === 'tree' || it.t === 'pyr') { it.x = r4(snapV(s0.x * W + dx) / W); it.z = r4(snapV(s0.z * H + dz) / H); }
    else { const ddx = snapV(dx), ddz = snapV(dz); it.ax = r4(s0.ax + ddx / W); it.bx = r4(s0.bx + ddx / W); it.az = r4(s0.az + ddz / H); it.bz = r4(s0.bz + ddz / H); }
  } else if (drag.kind === 'handle') {
    const h = drag.h;
    if (it.t === 'box') {
      let x0 = s0.x * W, z0 = s0.z * H, x1 = (s0.x + s0.w) * W, z1 = (s0.z + s0.h) * H;
      if (h.includes('w')) x0 = Math.min(x1 - 6, snapV(x)); if (h.includes('e')) x1 = Math.max(x0 + 6, snapV(x));
      if (h.includes('n')) z0 = Math.min(z1 - 6, snapV(z)); if (h.includes('s')) z1 = Math.max(z0 + 6, snapV(z));
      it.x = r4(x0 / W); it.z = r4(z0 / H); it.w = r4((x1 - x0) / W); it.h = r4((z1 - z0) / H);
    } else if (h === 'a') { it.ax = r4(snapV(x) / W); it.az = r4(snapV(z) / H); }
    else if (h === 'b') { it.bx = r4(snapV(x) / W); it.bz = r4(snapV(z) / H); }
    else if (h === 'size') it.half = Math.max(60, Math.round(Math.max(Math.abs(x - it.x * W), Math.abs(z - it.z * H))));
  }
  syncPartner(); draw(); props(true);
});
cv.addEventListener('pointerup', () => {
  if (drag && drag.kind === 'new2') {
    const L = Math.hypot(drag.bx - drag.ax, drag.bz - drag.az);
    if (L > 20) { const it = drag.t === 'dune' ? { t: 'dune', ax: r4(drag.ax / W), az: r4(drag.az / H), bx: r4(drag.bx / W), bz: r4(drag.bz / H), hk: 1.2, wk: 2 } : { t: 'wall2', ax: r4(drag.ax / W), az: r4(drag.az / H), bx: r4(drag.bx / W), bz: r4(drag.bz / H), th: 24, top: 130 }; pushNew(it); }
    drag = null; draw(); return;
  }
  if (drag && (drag.kind === 'move' || drag.kind === 'handle') && JSON.stringify(drag.start) !== JSON.stringify(items[sel])) { commit(); props(); }
  drag = null;
});
function addAt(t, x, z) {
  if (t === 'wall2' || t === 'dune') { drag = { kind: 'new2', t, ax: x, az: z, bx: x, bz: z }; return; }
  let it;
  if (t === 'box') it = { t: 'box', x: r4((x - 40) / W), z: r4((z - 30) / H), w: r4(80 / W), h: r4(60 / H), top: 120 };
  else if (t === 'tree') it = { t: 'tree', x: r4(x / W), z: r4(z / H) };
  else if (t === 'pyr') it = { t: 'pyr', x: r4(x / W), z: r4(z / H), half: 230, top: 26, h: 270 };
  pushNew(it);
}
function pushNew(it) {
  items.push(it); sel = items.length - 1; partner = -1;
  if (mirror) { const m = mirrorOf(it, fixed.pyramids && it.t === 'pyr' && mapId === 'deserto' ? 'rot' : 'x'); if (!same(m, it)) { items.push(m); partner = items.length - 1; partnerMode = it.t === 'pyr' && mapId === 'deserto' ? 'rot' : 'x'; } }
  commit(); setTool('select'); props();
}
function delSel() { if (sel < 0) return; const kill = [sel]; if (mirror && partner >= 0) kill.push(partner); items = items.filter((q, i) => !kill.includes(i)); sel = -1; partner = -1; commit(); props(); }
function dupSel() {
  if (sel < 0) return; const it = clone(items[sel]), off = 40;
  if (it.t === 'box' || it.t === 'tree' || it.t === 'pyr') { it.x = r4(it.x + off / W); it.z = r4(it.z + off / H); } else { it.ax = r4(it.ax + off / W); it.bx = r4(it.bx + off / W); it.az = r4(it.az + off / H); it.bz = r4(it.bz + off / H); }
  pushNew(it);
}
function nudge(dx, dz) {
  if (sel < 0) return; const it = items[sel];
  if (it.t === 'wall2' || it.t === 'dune') { it.ax = r4(it.ax + dx / W); it.bx = r4(it.bx + dx / W); it.az = r4(it.az + dz / H); it.bz = r4(it.bz + dz / H); }
  else { it.x = r4(it.x + dx / W); it.z = r4(it.z + dz / H); }
  syncPartner(); commit(); props(true);
}

// ---------- painel do item selecionado ----------
function field(label, key, val, step, min, max, unit) { return `<div class="row"><label>${label}</label><span><input type="number" data-k="${key}" value="${val}" step="${step || 1}" ${min != null ? `min="${min}"` : ''} ${max != null ? `max="${max}"` : ''}> ${unit || ''}</span></div>`; }
function props(quick) {
  const el = $('props');
  if (quick && document.activeElement && el.contains(document.activeElement)) return;
  const it = items[sel];
  let h = `<h3>${esc((MAP_LIST.find((m) => m[0] === mapId) || [0, mapId])[1])}</h3><div class="muted">${items.length} itens · ${draft.maps[mapId] ? '<b style="color:var(--acc)">mexido</b>' : 'no padrão'}</div>`;
  if (!it) {
    h += `<h3>Como usar</h3><div class="muted">Clique num item pra selecionar e arraste pra mover. Os quadradinhos amarelos esticam.<br><br>
      Ferramentas na esquerda: 🧱 muro/caixa (clique), 📐 parede diagonal e ⛰️ duna (arraste de uma ponta à outra), 🌳 árvore, 🔺 pirâmide.<br><br>
      Cinza = peça fixa do mapa (não dá pra mexer aqui). Azul/vermelho = onde cada time nasce.<br><br>
      <kbd>Del</kbd> apaga · <kbd>Ctrl</kbd>+<kbd>D</kbd> duplica · setas movem (<kbd>Shift</kbd> = 10x) · <kbd>Ctrl</kbd>+<kbd>Z</kbd> desfaz · rodinha dá zoom · botão direito arrasta a tela.</div>`;
    el.innerHTML = h; return;
  }
  h += `<h3>${TYPE_NAME[it.t]}${partner >= 0 && mirror ? ' <span style="color:var(--acc)">(+ o do outro lado)</span>' : ''}</h3>`;
  if (it.t === 'box') {
    h += field('Posição x', 'px', Math.round(it.x * W), 10) + field('Posição z', 'pz', Math.round(it.z * H), 10) + field('Largura', 'pw', Math.round(it.w * W), 10, 4) + field('Profundidade', 'ph', Math.round(it.h * H), 10, 4);
    h += field('Altura (topo)', 'top', it.top || 120, 5, 4, 2000) + field('Começa em (base)', 'y0', it.y0 || 0, 5, 0, 1900);
    h += `<div class="muted">Base maior que 0 = passa por baixo (plataforma, ponte). Boneco tem 64 de altura; pula ~57.</div>`;
    h += `<h3>Cor</h3><div class="swatches">${SWATCH.map((c) => `<div class="sw" style="background:${c}" data-c="${c}" title="${c}"></div>`).join('')}<div class="sw" data-c="" title="padrão do mapa" style="background:repeating-linear-gradient(45deg,#333 0 4px,#555 4px 8px)"></div></div>
      <div class="row"><label>Outra cor</label><input type="color" data-k="tint" value="${it.tint || '#a6a6a2'}"></div>`;
    h += `<div class="row"><label>Textura</label><select data-k="style">${STYLES.map(([v, n]) => `<option value="${v}" ${(it.style || '') === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`;
  } else if (it.t === 'wall2') {
    h += field('Ponta A x', 'pax', Math.round(it.ax * W), 10) + field('Ponta A z', 'paz', Math.round(it.az * H), 10) + field('Ponta B x', 'pbx', Math.round(it.bx * W), 10) + field('Ponta B z', 'pbz', Math.round(it.bz * H), 10);
    h += field('Grossura', 'th', it.th || 24, 2, 4, 200) + field('Altura', 'top', it.top || 130, 5, 4, 2000);
  } else if (it.t === 'dune') {
    h += field('Ponta A x', 'pax', Math.round(it.ax * W), 10) + field('Ponta A z', 'paz', Math.round(it.az * H), 10) + field('Ponta B x', 'pbx', Math.round(it.bx * W), 10) + field('Ponta B z', 'pbz', Math.round(it.bz * H), 10);
    h += field('Altura (x108)', 'hk', it.hk, 0.05, 0.1, 5) + field('Largura (x150)', 'wk', it.wk, 0.05, 0.5, 6);
    h += `<div class="muted">Altura 1 = ${Math.round(108)} · a mais alta do meio está em 2,35.</div>`;
  } else if (it.t === 'tree') {
    h += field('Posição x', 'cx', Math.round(it.x * W), 10) + field('Posição z', 'cz', Math.round(it.z * H), 10);
  } else if (it.t === 'pyr') {
    h += field('Meio x', 'cx', Math.round(it.x * W), 10) + field('Meio z', 'cz', Math.round(it.z * H), 10) + field('Meia base', 'half', it.half, 10, 60, 800) + field('Altura', 'h', it.h, 10, 40, 900) + field('Topo reto (meia largura)', 'top', it.top, 2, 0, 200);
  }
  h += `<div class="row2" style="margin-top:12px"><button id="b-dup">⧉ Duplicar</button><button id="b-mir">⇋ Criar espelho</button><button id="b-del">🗑️ Apagar</button></div>`;
  el.innerHTML = h;
  el.querySelectorAll('[data-k]').forEach((inp) => inp.addEventListener(inp.type === 'color' || inp.tagName === 'SELECT' ? 'input' : 'change', () => setProp(inp.dataset.k, inp.value)));
  el.querySelectorAll('.sw').forEach((s) => s.addEventListener('click', () => setProp('tint', s.dataset.c)));
  $('b-dup').onclick = dupSel; $('b-del').onclick = delSel;
  $('b-mir').onclick = () => { const m = mirrorOf(items[sel], 'x'); if (!same(m, items[sel])) { items.push(m); partner = items.length - 1; partnerMode = 'x'; commit(); props(); } };
}
function setProp(k, v) {
  const it = items[sel]; if (!it) return;
  const n = Number(v);
  if (k === 'px') it.x = r4(n / W); else if (k === 'pz') it.z = r4(n / H); else if (k === 'pw') it.w = r4(Math.max(4, n) / W); else if (k === 'ph') it.h = r4(Math.max(4, n) / H);
  else if (k === 'pax') it.ax = r4(n / W); else if (k === 'paz') it.az = r4(n / H); else if (k === 'pbx') it.bx = r4(n / W); else if (k === 'pbz') it.bz = r4(n / H);
  else if (k === 'cx') it.x = r4(n / W); else if (k === 'cz') it.z = r4(n / H);
  else if (k === 'tint') { if (v) it.tint = v; else delete it.tint; }
  else if (k === 'style') { if (v) it.style = v; else delete it.style; }
  else if (k === 'y0') { if (n > 0) it.y0 = n; else delete it.y0; }
  else it[k] = n;
  syncPartner(); commit(); props();
}

// ---------- abas "Tiro e boneco" e "Efeitos" ----------
const WNAME = { arco: 'Besta', estilingue: 'Estilingue', mao: 'Bolinha na mão', varinha: 'Varinha' };
const WFIELDS = [['speed', 'Velocidade do tiro', 10], ['cd', 'Tempo entre tiros (s)', 0.05], ['reload', 'Tempo de recarga (s)', 0.1], ['mag', 'Tiros por pente', 1], ['mags', 'Pentes', 1], ['bounces', 'Ricochetes', 1], ['grav', 'Queda (gravidade)', 10], ['r', 'Tamanho (acerto)', 0.25], ['rest', 'Força do quique (0 a 1)', 0.05]];
const PFIELDS = [['speed', 'Velocidade andando', 5], ['jumpV', 'Força do pulo', 5], ['doubleJumpV', 'Força do pulo duplo', 5], ['doubleJumpCd', 'Recarga do pulo duplo (s)', 0.5], ['gravity', 'Gravidade', 10], ['nadeRadius', 'Área da explosão', 5], ['nadeFuse', 'Tempo da granada (s)', 0.1], ['smokeTime', 'Tempo da fumaça (s)', 0.5]];
const NFIELDS = [['max', 'Força do arremesso', 10], ['air', 'Força extra pulando (x)', 0.05], ['rest', 'Quique (0 a 1)', 0.05], ['roll', 'Rolar no chão (0 a 1)', 0.02]];
function numRow(group, key, label, step, def, cur) {
  const ch = cur != null && cur !== def;
  return `<div class="f"><label>${label}</label><input type="number" step="${step}" data-g="${group}" data-k="${key}" value="${cur != null ? cur : def}" class="${ch ? 'changed' : ''}"><span class="def">padrão ${def}</span></div>`;
}
function buildShotPane() {
  let h = '<div class="muted" style="margin-bottom:10px">Mude o número e aperte Enter (ou clique fora). Amarelo = diferente do padrão. Estes valem no jogo todo (inclusive no multiplayer, depois que o Claude colocar no jogo). A prévia 3D e o seu jogo (com "usar no meu jogo") já usam na hora.</div><div class="grid">';
  for (const id of WEAPON_IDS) {
    const cur = (draft.weapons || {})[id] || {};
    h += `<div class="card"><h4>${WNAME[id] || id} <button data-reset="weapons.${id}">padrão</button></h4>${WFIELDS.map(([k, l, s]) => numRow('weapons.' + id, k, l, s, WEAPONS[id][k], cur[k])).join('')}</div>`;
  }
  h += `<div class="card"><h4>Boneco <button data-reset="player">padrão</button></h4>${PFIELDS.map(([k, l, s]) => numRow('player', k, l, s, P[k], (draft.player || {})[k])).join('')}</div>`;
  h += `<div class="card"><h4>Granada <button data-reset="nade">padrão</button></h4>${NFIELDS.map(([k, l, s]) => numRow('nade', k, l, s, NADE[k], (draft.nade || {})[k])).join('')}</div>`;
  $('p-shot').innerHTML = h + '</div>';
  bindNums($('p-shot'), buildShotPane);
}
function buildFxPane() {
  let h = '<div class="muted" style="margin-bottom:10px">Efeitos só mudam o desenho (não mudam onde o tiro acerta). Abra a prévia 3D (ou o jogo em outra aba com "usar no meu jogo") pra ver na hora.</div><div class="grid">';
  for (const grp of Object.keys(FX_INFO)) {
    const info = FX_INFO[grp], cur = (draft.fx || {})[grp] || {};
    h += `<div class="card"><h4>${info._} <button data-reset="fx.${grp}">padrão</button></h4>`;
    for (const k of Object.keys(info)) {
      if (k === '_') continue; const [l, mn, mx, st] = info[k], def = FX_DEFAULT[grp][k], v = cur[k] != null ? cur[k] : def;
      h += `<div class="f" style="grid-template-columns:1fr 1fr 60px"><label>${l}</label><input type="range" min="${mn}" max="${mx}" step="${st}" value="${v}" data-g="fx.${grp}" data-k="${k}" data-live="1"><input type="number" min="${mn}" max="${mx}" step="${st}" value="${v}" data-g="fx.${grp}" data-k="${k}" class="${cur[k] != null && cur[k] !== def ? 'changed' : ''}"></div>`;
    }
    h += '</div>';
  }
  $('p-fx').innerHTML = h + '</div>';
  bindNums($('p-fx'), buildFxPane);
}
function groupRef(path, make) { const parts = path.split('.'); let o = draft; for (const p of parts) { if (!o[p]) { if (!make) return null; o[p] = {}; } o = o[p]; } return o; }
function defOf(path, k) { const [a, b] = path.split('.'); if (a === 'weapons') return WEAPONS[b][k]; if (a === 'player') return P[k]; if (a === 'nade') return NADE[k]; if (a === 'fx') return FX_DEFAULT[b][k]; return null; }
function cleanup() { for (const id of Object.keys(draft.weapons || {})) if (!Object.keys(draft.weapons[id]).length) delete draft.weapons[id]; for (const g2 of Object.keys(draft.fx || {})) if (!Object.keys(draft.fx[g2]).length) delete draft.fx[g2]; }
function bindNums(root, rebuild) {
  root.querySelectorAll('input[data-g]').forEach((inp) => {
    const apply = () => {
      const o = groupRef(inp.dataset.g, true), k = inp.dataset.k, v = Number(inp.value), d = defOf(inp.dataset.g, k);
      if (!Number.isFinite(v) || v === d) delete o[k]; else o[k] = v;
      cleanup(); persist();
      root.querySelectorAll(`input[data-g="${inp.dataset.g}"][data-k="${k}"]`).forEach((x) => { if (x !== inp) x.value = inp.value; if (x.type === 'number') x.classList.toggle('changed', o[k] != null); });
    };
    inp.addEventListener(inp.dataset.live ? 'input' : 'change', apply);
  });
  root.querySelectorAll('[data-reset]').forEach((b) => b.addEventListener('click', () => { const p = b.dataset.reset.split('.'); if (p.length === 1) draft[p[0]] = {}; else if (draft[p[0]]) delete draft[p[0]][p[1]]; persist(); rebuild(); }));
}

// ---------- servidor: salvar / carregar (senha) ----------
function askKey(cb) {
  const k = localStorage.getItem('pb3d_editor_key');
  if (k) return cb(k);
  modal(`<h3 style="margin-top:0">Senha do editor</h3><div class="muted">É a senha que você colocou no Render (EDITOR_KEY). Fica guardada só neste navegador.</div>
    <p><input type="password" id="m-key" style="width:100%" autocomplete="current-password"></p><div class="row2"><button class="acc" id="m-ok">Entrar</button><button id="m-no">Cancelar</button></div>`);
  $('m-ok').onclick = () => { const v = $('m-key').value.trim(); if (!v) return; localStorage.setItem('pb3d_editor_key', v); closeModal(); cb(v); };
  $('m-no').onclick = closeModal; $('m-key').focus();
  $('m-key').onkeydown = (e) => { if (e.key === 'Enter') $('m-ok').click(); };
}
async function saveServer() {
  askKey(async (key) => {
    status('salvando...');
    try {
      const r = await fetch('/api/editor/save', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-editor-key': key }, body: JSON.stringify({ edits: draft }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) localStorage.removeItem('pb3d_editor_key');
      if (!j.ok) return status('❌ ' + (j.error || 'não salvou'), 'err');
      status(j.github ? '✅ Salvo no GitHub (branch ' + j.branch + '). Avise o Claude pra colocar no jogo.' : '⚠️ ' + j.msg, j.github ? 'ok' : '');
    } catch (e) { status('❌ sem conexão com o servidor', 'err'); }
  });
}
async function loadServer() {
  askKey(async (key) => {
    status('carregando...');
    try {
      const r = await fetch('/api/editor/load', { headers: { 'x-editor-key': key } }), j = await r.json().catch(() => ({}));
      if (r.status === 401) localStorage.removeItem('pb3d_editor_key');
      if (!j.ok) return status('❌ ' + (j.error || 'não carregou'), 'err');
      if (!j.edits) return status('Ainda não tem nada salvo no servidor.');
      draft = Object.assign(EMPTY(), j.edits); persist(); loadMap(mapId); buildShotPane(); buildFxPane(); status('✅ Carregado do servidor.', 'ok');
    } catch (e) { status('❌ sem conexão com o servidor', 'err'); }
  });
}
function modal(html) { $('mbox').innerHTML = html; $('modal').style.display = 'flex'; }
function closeModal() { $('modal').style.display = 'none'; }
$('modal').addEventListener('click', (e) => { if (e.target === $('modal')) closeModal(); });

// ---------- barra de cima ----------
$('map').innerHTML = MAP_LIST.map(([v, n]) => `<option value="${v}">${n}</option>`).join('');
$('map').value = MAP_LIST.some((m) => m[0] === mapId) ? mapId : 'metro';
$('map').onchange = () => loadMap($('map').value);
$('undo').onclick = undo; $('redo').onclick = redo;
$('mirror').onclick = () => { mirror = !mirror; $('mirror').classList.toggle('on', mirror); findPartner(sel); draw(); props(); };
$('snap').onclick = () => { snap = !snap; $('snap').classList.toggle('on', snap); };
$('prev').onclick = () => { const c = $('center'), on = !c.classList.contains('split'); c.classList.toggle('split', on); $('prev').classList.toggle('on', on); $('pv').src = on ? '/demo3d/?preview=' + mapId : 'about:blank'; setTimeout(() => { resize(); fit(); draw(); }, 50); };
$('useme').checked = localStorage.getItem('pb3d_edits_on') === '1';
$('useme').onchange = () => { try { localStorage.setItem('pb3d_edits_on', $('useme').checked ? '1' : '0'); } catch (e) {} };
$('save').onclick = saveServer; $('load').onclick = loadServer;
$('copy').onclick = async () => { const txt = JSON.stringify(draft); try { await navigator.clipboard.writeText(txt); status('📋 Código copiado (' + Math.round(txt.length / 1024 * 10) / 10 + ' KB).', 'ok'); } catch (e) { modal(`<h3 style="margin-top:0">Código dos ajustes</h3><textarea readonly>${esc(txt)}</textarea><div class="row2"><button id="m-no">Fechar</button></div>`); $('m-no').onclick = closeModal; } };
$('paste').onclick = () => { modal(`<h3 style="margin-top:0">Colar código</h3><textarea id="m-txt" placeholder="cole aqui"></textarea><div class="row2"><button class="acc" id="m-ok">Usar</button><button id="m-no">Cancelar</button></div>`); $('m-no').onclick = closeModal; $('m-ok').onclick = () => { try { const d = JSON.parse($('m-txt').value); draft = Object.assign(EMPTY(), d); persist(); closeModal(); loadMap(mapId); buildShotPane(); buildFxPane(); status('✅ Código colado.', 'ok'); } catch (e) { status('❌ código inválido', 'err'); } }; };
$('dup').onclick = dupSel; $('del').onclick = delSel; $('fit').onclick = () => { fit(); draw(); };
$('reset').onclick = () => { if (!confirm('Voltar este mapa ao padrão do jogo? (dá pra desfazer)')) return; undoSt.push(JSON.stringify(items)); items = clone(defaults); sel = -1; partner = -1; commit(true); props(); };
function setTool(t) { tool = t; document.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === t)); cv.style.cursor = t === 'select' ? 'default' : 'crosshair'; $('hint').innerHTML = hintText(); }
document.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
function hintText() {
  const t = { select: 'Clique pra selecionar, arraste pra mover. Botão direito (ou espaço) arrasta a tela.', box: 'Clique no mapa pra pôr um muro/caixa.', wall2: 'Arraste de uma ponta à outra pra fazer a parede diagonal.', tree: 'Clique pra pôr uma árvore.', dune: 'Arraste pra fazer a crista da montanha de areia.', pyr: 'Clique pra pôr uma pirâmide.' }[tool];
  return t + (mirror ? ' · Espelhar ligado: o outro lado muda junto.' : '');
}
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
  const p = b.dataset.pane, onMap = p === 'map';
  $('main').classList.toggle('fullpane', !onMap);
  for (const id of ['tools', 'center', 'props']) $(id).style.display = onMap ? '' : 'none';
  $('p-shot').classList.toggle('on', p === 'shot'); $('p-fx').classList.toggle('on', p === 'fx');
  if (p === 'shot') buildShotPane(); if (p === 'fx') buildFxPane();
  if (onMap) setTimeout(() => { resize(); }, 20);
}));
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
  const k = e.key.toLowerCase(), st = e.shiftKey ? 10 : 1;
  if (e.key === ' ') { spaceDown = true; e.preventDefault(); }
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 'd') { e.preventDefault(); dupSel(); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); delSel(); return; }
  if (e.key === 'Escape') { sel = -1; partner = -1; setTool('select'); draw(); props(); return; }
  if (e.key.startsWith('Arrow')) { e.preventDefault(); nudge(e.key === 'ArrowLeft' ? -10 * st : e.key === 'ArrowRight' ? 10 * st : 0, e.key === 'ArrowUp' ? -10 * st : e.key === 'ArrowDown' ? 10 * st : 0); return; }
  const tk = { v: 'select', b: 'box', l: 'wall2', t: 'tree', d: 'dune', p: 'pyr' }[k]; if (tk) setTool(tk);
  if (k === 'f') { fit(); draw(); }
});
window.addEventListener('keyup', (e) => { if (e.key === ' ') spaceDown = false; });
window.addEventListener('resize', resize);
fetch('/api/editor/status').then((r) => r.json()).then((j) => { if (!j.enabled) status('Salvar no servidor ainda desligado (falta a senha no Render). Dá pra usar "Copiar código".'); }).catch(() => {});
resize(); loadMap($('map').value); lastState = clone(items);
void MAP_SCALE; void MAP_SCALE_OF;
