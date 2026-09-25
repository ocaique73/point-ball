// Roupas e personagens da versão 3D (estilo Rocket League): cada time tem seus tons (azul / vermelho),
// e cada jogador escolhe o personagem, as cores de cada peça (camisa, calça, botas, luvas, capa, capuz/chapéu,
// armadura, cabelo), se usa capa e um chapéu extra. As cores são "tons" do time: o mesmo número vira azul
// no time azul e vermelho no vermelho, então ninguém confunde de que time é.
import * as THREE from 'three';

export const CHARS = { hood: 'Ladino (capuz)', rogue: 'Ladino', knight: 'Cavaleiro', barbarian: 'Bárbaro', mage: 'Maga' };
export const TEAM_PAL = {
  A: ['#1d4ed8', '#3b82f6', '#60a5fa', '#93c5fd', '#1e3a8a', '#0891b2', '#4f46e5', '#0f172a'],
  B: ['#dc2626', '#ef4444', '#f87171', '#fca5a5', '#7f1d1d', '#ea580c', '#be123c', '#1c0a0a']
};
export const LEATHER = (team) => ['#5b3a24', '#3b2a1e', '#7a5236', '#1f2022', '#6b7280', '#d6c2a0', TEAM_PAL[team][4], TEAM_PAL[team][1]];
export const HAIR = ['#2b1d14', '#5a3a22', '#8a5a2b', '#d1a954', '#efe3c2', '#141414', '#8a2d1a', '#9ca3af'];
export const HATS = { none: 'Nenhum', cap: 'Boné', beanie: 'Gorro', top: 'Cartola', cowboy: 'Chapéu de caubói', crown: 'Coroa', band: 'Faixa na testa' };
// peças que dá pra pintar: s camisa, p calça, b botas, g luvas, c capa/capuz, h chapéu/elmo do personagem, a armadura, hr cabelo, hc chapéu extra
export const SLOTS = [['s', 'Camisa / túnica', 'team'], ['p', 'Calça', 'team'], ['c', 'Capa e capuz', 'team'], ['h', 'Chapéu / elmo do personagem', 'team'], ['a', 'Armadura (cavaleiro)', 'team'], ['b', 'Botas e cinto', 'leather'], ['g', 'Luvas', 'leather'], ['hr', 'Cabelo / barba', 'hair'], ['hc', 'Cor do chapéu extra', 'team']];
export const LOOK_DEFAULT = { m: 'hood', s: 1, p: 4, c: 0, h: 0, a: 2, b: 0, g: 1, hr: 1, hc: 0, cp: 1, o: 0, hat: 'none' };

// que célula da textura de cada pedaço do personagem vira que peça (a textura KayKit é uma grade 8x4 de degradês)
const R_ARM = { 8: 's', 21: 'g', 5: 'g', 9: 'c' }, R_LEG = { 19: 'p', 15: 'b' };
const PARTS = {
  hood: { Rogue_Body: { 8: 's', 9: 'c', 6: 'b', 5: 'b', 15: 'b' }, Rogue_ArmLeft: R_ARM, Rogue_ArmRight: R_ARM, Rogue_Head_Hooded: { 9: 'c', 1: 'hr' }, Rogue_LegLeft: R_LEG, Rogue_LegRight: R_LEG, Rogue_Cape: { 9: 'c' } },
  rogue: { Rogue_Body: { 8: 's', 9: 'c', 6: 'b', 5: 'b', 15: 'b' }, Rogue_ArmLeft: R_ARM, Rogue_ArmRight: R_ARM, Rogue_Head: { 1: 'hr' }, Rogue_LegLeft: R_LEG, Rogue_LegRight: R_LEG, Rogue_Cape: { 9: 'c' } },
  knight: { Knight_Body: { 3: 'a', 7: 'a', 10: 'a', 8: 's', 6: 'b' }, Knight_ArmLeft: { 3: 'a', 7: 'a', 6: 'g' }, Knight_ArmRight: { 3: 'a', 7: 'a', 6: 'g' }, Knight_LegLeft: { 3: 'p', 7: 'p', 6: 'b' }, Knight_LegRight: { 3: 'p', 7: 'p', 6: 'b' }, Knight_Head: { 1: 'hr' }, Knight_Helmet: { 3: 'h', 7: 'h' }, Knight_Cape: { 8: 'c' } },
  barbarian: { Barbarian_Body: { 8: 's', 6: 'b', 7: 'c', 15: 'p' }, Barbarian_ArmLeft: { 9: 's', 6: 'g' }, Barbarian_ArmRight: { 9: 's', 6: 'g' }, Barbarian_LegLeft: { 19: 'p', 15: 'b', 6: 'b' }, Barbarian_LegRight: { 19: 'p', 15: 'b', 6: 'b' }, Barbarian_Head: { 1: 'hr' }, Barbarian_Hat: { 7: 'h' }, Barbarian_Cape: { 7: 'c' } },
  mage: { Mage_Body: { 8: 's', 15: 'p', 5: 'g' }, Mage_ArmLeft: { 8: 's' }, Mage_ArmRight: { 8: 's' }, Mage_LegLeft: { 15: 'p', 19: 'b' }, Mage_LegRight: { 15: 'p', 19: 'b' }, Mage_Head: { 1: 'hr', 9: 'h' }, Mage_Hat: { 9: 'h', 5: 'g' }, Mage_Cape: { 10: 'c' } }
};
const HEADWEAR = ['Knight_Helmet', 'Barbarian_Hat', 'Mage_Hat'];
export const WEAPON_ITEMS = ['1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable', 'Knife_Offhand'];

const clampI = (v, n, d) => { v = Math.floor(Number(v)); return Number.isFinite(v) && v >= 0 && v < n ? v : d; };
export function normLook(l) {
  l = l || {}; const o = Object.assign({}, LOOK_DEFAULT);
  if (CHARS[l.m]) o.m = l.m;
  for (const k of ['s', 'p', 'c', 'h', 'a', 'b', 'g', 'hr', 'hc']) o[k] = clampI(l[k], 8, LOOK_DEFAULT[k]);
  o.cp = l.cp === 0 || l.cp === '0' ? 0 : 1; o.o = l.o === 1 || l.o === '1' ? 1 : 0;
  if (HATS[l.hat]) o.hat = l.hat;
  return o;
}
// bots: roupa sorteada, mas sempre a mesma pro mesmo bot (todo mundo vê igual no multiplayer)
export function botLook(id) {
  let h = 2166136261; for (const ch of String(id)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const r = () => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; return (h >>> 0) / 4294967296; };
  const ids = Object.keys(CHARS), hats = Object.keys(HATS), i8 = () => Math.floor(r() * 8);
  return normLook({ m: ids[Math.floor(r() * ids.length)], s: i8(), p: i8(), c: i8(), h: i8(), a: i8(), b: Math.floor(r() * 6), g: Math.floor(r() * 6), hr: i8(), hc: i8(), cp: r() < 0.7 ? 1 : 0, hat: r() < 0.3 ? hats[1 + Math.floor(r() * (hats.length - 1))] : 'none' });
}
export function slotColor(look, team, slot) {
  const tm = team === 'B' ? 'B' : 'A', k = slot === 'p' && look.o ? 's' : slot; // macacão: calça da cor da camisa
  if (slot === 'b' || slot === 'g') return LEATHER(tm)[look[slot]];
  if (slot === 'hr') return HAIR[look.hr];
  return TEAM_PAL[tm][look[k]];
}

// textura recolorida (256x256) para um pedaço do personagem
const texCache = new Map();
function recolorTex(baseTex, cells, look, team) {
  const key = baseTex.uuid + '|' + Object.entries(cells).map(([c, sl]) => c + ':' + slotColor(look, team, sl)).join(',');
  if (texCache.has(key)) return texCache.get(key);
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
  g.drawImage(baseTex.image, 0, 0, 256, 256);
  const col = new THREE.Color();
  for (const [c, sl] of Object.entries(cells)) {
    const x = (c % 8) * 32, y = Math.floor(c / 8) * 64; col.set(slotColor(look, team, sl));
    const hi = col.clone().lerp(new THREE.Color(0xffffff), 0.18), lo = col.clone().multiplyScalar(0.5);
    const grd = g.createLinearGradient(0, y, 0, y + 64); grd.addColorStop(0, '#' + hi.getHexString()); grd.addColorStop(0.55, '#' + col.getHexString()); grd.addColorStop(1, '#' + lo.getHexString());
    g.fillStyle = grd; g.fillRect(x, y, 32, 64);
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x + 27, y + 5, 5, 54); // faixa clarinha da borda (igual à original)
  }
  const t = new THREE.CanvasTexture(cv); t.flipY = baseTex.flipY; t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.LinearFilter;
  texCache.set(key, t); return t;
}

// chapéus extras (feitos aqui): tamanho em relação à largura da cabeça (w)
function makeHat(kind, color, w) {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color, roughness: 0.8 }), dark = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.55), roughness: 0.8 });
  const add = (geo, mm, x, y, z) => { const o = new THREE.Mesh(geo, mm); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  if (kind === 'cap') { add(new THREE.SphereGeometry(w * 0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 0, 0); const b = add(new THREE.CylinderGeometry(w * 0.34, w * 0.34, w * 0.04, 16, 1, false, -Math.PI / 2, Math.PI), dark, 0, w * 0.02, w * 0.28); b.scale.z = 1.3; }
  else if (kind === 'beanie') { add(new THREE.SphereGeometry(w * 0.52, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), m, 0, -w * 0.05, 0); add(new THREE.CylinderGeometry(w * 0.53, w * 0.53, w * 0.14, 18), dark, 0, 0, 0); add(new THREE.SphereGeometry(w * 0.11, 8, 6), dark, 0, w * 0.5, 0); }
  else if (kind === 'top') { add(new THREE.CylinderGeometry(w * 0.36, w * 0.34, w * 0.75, 18), m, 0, w * 0.4, 0); add(new THREE.CylinderGeometry(w * 0.6, w * 0.6, w * 0.05, 20), m, 0, w * 0.03, 0); add(new THREE.CylinderGeometry(w * 0.365, w * 0.365, w * 0.12, 18), dark, 0, w * 0.12, 0); }
  else if (kind === 'cowboy') { add(new THREE.CylinderGeometry(w * 0.32, w * 0.4, w * 0.42, 16), m, 0, w * 0.22, 0); const b = add(new THREE.TorusGeometry(w * 0.55, w * 0.07, 6, 24), m, 0, w * 0.03, 0); b.rotation.x = Math.PI / 2; b.scale.set(1, 1.25, 0.6); add(new THREE.CylinderGeometry(w * 0.405, w * 0.405, w * 0.08, 16), dark, 0, w * 0.06, 0); }
  else if (kind === 'crown') { const gold = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.3 }); add(new THREE.CylinderGeometry(w * 0.4, w * 0.38, w * 0.2, 16, 1, true), gold, 0, w * 0.1, 0); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(new THREE.ConeGeometry(w * 0.08, w * 0.2, 5), gold, Math.cos(a) * w * 0.39, w * 0.28, Math.sin(a) * w * 0.39); add(new THREE.SphereGeometry(w * 0.045, 6, 4), m, Math.cos(a) * w * 0.4, w * 0.1, Math.sin(a) * w * 0.4); } }
  else if (kind === 'band') { add(new THREE.CylinderGeometry(w * 0.53, w * 0.53, w * 0.12, 20, 1, true), m, 0, -w * 0.22, 0); const k = add(new THREE.BoxGeometry(w * 0.12, w * 0.3, w * 0.04), m, 0, -w * 0.32, -w * 0.55); k.rotation.x = 0.3; }
  return g;
}

// veste o boneco (clone do modelo): cores por time, capa, chapéu extra e as armas do ladino nas mãos
export function dressModel(model, key, look, team, BASE) {
  const parts = PARTS[key] || {};
  model.updateMatrixWorld(true);
  let headMesh = null;
  model.traverse((o) => {
    if (!o.isMesh) return;
    if (/_Head/.test(o.name)) headMesh = o;
    const cells = parts[o.name];
    if (cells && o.material.map && o.material.map.image) { o.material = o.material.clone(); o.material.map = recolorTex(o.material.map, cells, look, team); o.material.needsUpdate = true; }
    if (/_Cape$/.test(o.name)) o.visible = !!look.cp;
    if (HEADWEAR.includes(o.name) && look.hat !== 'none') o.visible = false;
    // armas próprias dos outros personagens (espada, machado, cajado...) não aparecem: o jogo usa as do ladino
    if (o.parent && /^handslot/.test(o.parent.name) && !WEAPON_ITEMS.includes(o.name)) { o.visible = false; o.userData.native = true; }
  });
  // outros personagens não têm besta/faca/bolinha: copia as do ladino pro mesmo osso da mão
  const src = BASE.hood && BASE.hood.scene;
  if (src && key !== 'hood' && key !== 'rogue') for (const n of WEAPON_ITEMS) {
    const s = src.getObjectByName(n); if (!s || !s.parent) continue;
    const bone = model.getObjectByName(s.parent.name); if (!bone || bone.getObjectByName(n)) continue;
    const c = s.clone(); c.material = s.material.clone(); bone.add(c);
  }
  // chapéu extra em cima da cabeça
  if (look.hat !== 'none' && headMesh) {
    const head = model.getObjectByName('head');
    const box = new THREE.Box3().setFromObject(headMesh, true), w = box.max.x - box.min.x;
    if (head && w > 0) {
      const hat = makeHat(look.hat, slotColor(look, team, 'hc'), w * 0.92);
      const top = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y - w * (key === 'hood' ? 0.12 : 0.2), (box.min.z + box.max.z) / 2);
      head.updateMatrixWorld(true);
      const q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(); head.matrixWorld.decompose(p, q, sc);
      hat.position.copy(head.worldToLocal(top)); hat.quaternion.copy(q).invert(); hat.scale.set(1 / sc.x, 1 / sc.y, 1 / sc.z);
      head.add(hat);
    }
  }
}
