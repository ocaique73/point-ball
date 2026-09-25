// Demo 3D FPS do Point Ball (Three.js).
// A simulação 3D (física, armas, bots) fica em sim3d.js; aqui ficam o desenho, os controles, o menu (Esc),
// a mira editável, o placar (Tab) e os bonecos KayKit animados.
// Eixos: x e z no chão (mesmas medidas do mapa 2D), y para cima.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { Sim3D, WEAPONS, WEAPON_IDS, P } from '/demo3d/sim3d.js';

const $ = (id) => document.getElementById(id);
const G = window.RC_GAME, BOTS = window.RC_BOTS, MAPS = window.RC_MAPS.MAPS, CFG = window.RC_CONFIG.DEFAULT_CONFIG;
const TEAM = { A: 0x3b82f6, B: 0xef4444 };
const STEP = 1 / 60;
const CHAR_H = P.height;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- configurações (ficam salvas neste navegador) ----------
const DEFAULTS = {
  cam: '1', map: 'deserto', bots: '2', level: 'amador', shadow: '1', fov: 80, weapon: 'lancador', sens: 1.6, invert: '0',
  test: '0', speed: P.speed, jumpv: P.jumpV, tweapon: WEAPON_IDS[0], wtune: {},
  x: { color: '#ffffff', outline: '1', len: 7, thick: 2, gap: 4, dot: '1', dotsize: 2, ring: '1', ringr: 22, ringw: 2, hit: '1', hitlen: 10, hitw: 1 }
};
let S = JSON.parse(JSON.stringify(DEFAULTS));
try { const saved = JSON.parse(localStorage.getItem('pb3d_settings') || 'null'); if (saved) { S = Object.assign(S, saved); S.x = Object.assign({}, DEFAULTS.x, saved.x || {}); S.wtune = Object.assign({}, saved.wtune || {}); } } catch (e) {}
const save = () => { try { localStorage.setItem('pb3d_settings', JSON.stringify(S)); } catch (e) {} };

// ---------- renderizador ----------
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = S.shadow === '1';
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(S.fov, 1, 1.5, 8000);
scene.add(camera);
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
const hemi = new THREE.HemisphereLight(0xffffff, 0x445566, 1.3);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -950, right: 950, top: 700, bottom: -700, near: 10, far: 4000 });
sun.shadow.bias = -0.0006;
scene.add(sun, sun.target);

const mat = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, flatShading: true, roughness: 0.85, metalness: 0 }, extra || {}));
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ---------- mapa ----------
let mapGroup = null, mapWalls = [];
let lampLights = [], lavaGlow = [];
function groundTexture(th, seed) {
  const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 1280;
  const g = cv.getContext('2d'), rnd = seeded(seed);
  g.fillStyle = th.ground; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = th.ground2;
  for (let i = 0; i < 520; i++) { g.beginPath(); g.ellipse(rnd() * cv.width, rnd() * cv.height, 6 + rnd() * 30, 3 + rnd() * 12, rnd() * 3, 0, Math.PI * 2); g.fill(); }
  if (th.deco === 'panels') {
    g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 3;
    for (let x = 0; x < cv.width; x += 102) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, cv.height); g.stroke(); }
    for (let y = 0; y < cv.height; y += 102) { g.beginPath(); g.moveTo(0, y); g.lineTo(cv.width, y); g.stroke(); }
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}
function wallTexture(color, style) {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 128, 128);
  if (style === 'wood') { // tábuas de madeira na vertical, com veio
    g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 2;
    for (let x = 0; x <= 128; x += 21) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
    const rnd = seeded(7);
    g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1;
    for (let i = 0; i < 40; i++) { const x = rnd() * 128, y = rnd() * 128, len = 6 + rnd() * 14; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + len); g.stroke(); }
  } else if (style === 'panel') { // painel/computador de nave
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 3;
    for (let x = 0; x <= 128; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
    for (let y = 0; y <= 128; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }
    const rnd = seeded(11);
    for (let i = 0; i < 10; i++) {
      const x = Math.floor(rnd() * 4) * 32 + 6, y = Math.floor(rnd() * 4) * 32 + 6;
      g.fillStyle = rnd() < 0.5 ? 'rgba(56,189,248,.85)' : 'rgba(52,211,153,.7)'; g.fillRect(x, y, 20, 6);
    }
  } else { // tijolo (padrão)
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 3;
    for (let y = 0; y <= 128; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }
    for (let y = 0; y < 128; y += 32) for (let x = (y / 32) % 2 ? 32 : 0; x <= 128; x += 64) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); }
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
const WALL_STYLE = { deserto: 'dune', neve: 'ice', floresta: 'wood', nave: 'panel' };
// teto que ricocheteia tiro (folhas da floresta / vidro da nave)
const CEILING_Y = { floresta: 340, nave: 360 };
function buildTestRoom() {
  const W = CFG.mapWidth, H = CFG.mapHeight;
  mapGroup = new THREE.Group();
  scene.background = new THREE.Color(0x9cc7ee);
  scene.fog = new THREE.Fog(0x9cc7ee, 1400, 4200);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ color: 0x3d4a5c, roughness: 0.9 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(W / 2, 0, H / 2); ground.receiveShadow = true;
  mapGroup.add(ground);
  // só a borda, sem muros no meio: mapa aberto pra testar mira/movimento à vontade
  mapWalls = [
    { x: -20, y: -20, w: 20, h: H + 40, border: true }, { x: W, y: -20, w: 20, h: H + 40, border: true },
    { x: -20, y: -20, w: W + 40, h: 20, border: true }, { x: -20, y: H, w: W + 40, h: 20, border: true }
  ];
  for (const R of mapWalls) {
    const hgt = P.borderH;
    const box = new THREE.Mesh(new THREE.BoxGeometry(R.w, hgt, R.h), mat(0x334155));
    box.position.set(R.x + R.w / 2, hgt / 2, R.y + R.h / 2); box.castShadow = box.receiveShadow = true;
    mapGroup.add(box);
  }
  scene.add(mapGroup);
  sun.position.set(W / 2 - 600, 1500, H / 2 + 800); sun.target.position.set(W / 2, 0, H / 2);
}
function buildMap(mapId) {
  if (mapGroup) scene.remove(mapGroup);
  if (mapId === 'teste') return buildTestRoom();
  const map = MAPS[mapId], th = map.theme, W = CFG.mapWidth, H = CFG.mapHeight;
  mapGroup = new THREE.Group();
  const nightMap = mapId === 'cidade' || mapId === 'escuro';
  scene.background = new THREE.Color(map.space ? 0x03040b : nightMap ? 0x05060a : 0x9cc7ee);
  scene.fog = map.space ? null : new THREE.Fog(nightMap ? 0x05060a : 0x9cc7ee, nightMap ? 250 : 1400, nightMap ? 1400 : 4200);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: groundTexture(th, mapId.length * 97), roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(W / 2, 0, H / 2); ground.receiveShadow = true;
  mapGroup.add(ground);
  const style = WALL_STYLE[mapId] || 'brick';
  const wtex = wallTexture(th.wall, style), btex = wallTexture(th.border, style);
  mapWalls = G.buildWalls(mapId, CFG, 0);
  // portais abertos (sorteados uma vez por partida — sem ciclo abre/fecha, pra simplificar)
  let openPr = null;
  if (map.portals) {
    const list = G.portalList(map);
    openPr = G.pickPortalPairs(list, null);
    mapWalls = G.openWalls(mapWalls, openPr);
  }
  window.__portalPairs = openPr;
  const treeSpots = []; // pontas das paredes de madeira (floresta) — uma árvore em cada
  for (const R of mapWalls) {
    if (R.space || R.door) continue;
    const hgt = R.border ? P.borderH : P.wallH;
    if (style === 'dune') { // deserto: montante de areia arredondado (a colisão continua sendo a caixa)
      const dune = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({ color: th.wall, roughness: 1 }));
      dune.scale.set(R.w / 2 + 8, hgt * 0.85, R.h / 2 + 8);
      dune.position.set(R.x + R.w / 2, 2, R.y + R.h / 2);
      dune.castShadow = dune.receiveShadow = true;
      mapGroup.add(dune);
    } else if (style === 'ice') { // neve: gelo quase transparente (empilhar paredes reduz a visibilidade de verdade)
      const iceMat = new THREE.MeshPhysicalMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.4, roughness: 0.15, metalness: 0, transmission: 0.15 });
      const box = new THREE.Mesh(new THREE.BoxGeometry(R.w, hgt, R.h), iceMat);
      box.position.set(R.x + R.w / 2, hgt / 2, R.y + R.h / 2);
      box.castShadow = false; box.receiveShadow = true;
      mapGroup.add(box);
    } else {
      const t = (R.border ? btex : wtex).clone(); t.needsUpdate = true; t.repeat.set(Math.max(R.w, R.h) / 64, hgt / 64);
      const side = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), top = mat(th.wallEdge);
      const box = new THREE.Mesh(new THREE.BoxGeometry(R.w, hgt, R.h), [side, side, top, top, side, side]);
      box.position.set(R.x + R.w / 2, hgt / 2, R.y + R.h / 2);
      box.castShadow = true; box.receiveShadow = true;
      mapGroup.add(box);
      if (style === 'wood' && !R.border) {
        if (R.w > R.h) { treeSpots.push([R.x, R.y + R.h / 2]); treeSpots.push([R.x + R.w, R.y + R.h / 2]); }
        else { treeSpots.push([R.x + R.w / 2, R.y]); treeSpots.push([R.x + R.w / 2, R.y + R.h]); }
      }
    }
  }
  // uma árvore na ponta de cada parede de madeira (floresta)
  for (const [x, z] of treeSpots) {
    const k = 1.1 + Math.random() * 0.3;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(4 * k, 5 * k, 40 * k, 7), mat(0x4a3220));
    trunk.position.set(x, 20 * k, z);
    const top = new THREE.Mesh(new THREE.IcosahedronGeometry(22 * k, 0), mat(0x3f7d3a));
    top.position.set(x, 52 * k, z);
    trunk.castShadow = top.castShadow = trunk.receiveShadow = top.receiveShadow = true;
    mapGroup.add(trunk, top);
  }
  const rnd = seeded(mapId.length * 31 + 5);
  for (let i = 0; i < 40; i++) {
    const x = 40 + rnd() * (W - 80), z = 40 + rnd() * (H - 80);
    if (!G.circleFree(x, z, 30, mapWalls, CFG)) continue;
    let obj = null;
    if (th.deco === 'rocks') { obj = new THREE.Mesh(new THREE.DodecahedronGeometry(6 + rnd() * 9, 0), mat(0x9a6b3c)); obj.position.set(x, 3, z); obj.rotation.set(rnd() * 3, rnd() * 3, 0); }
    else if (th.deco === 'snow') { obj = new THREE.Mesh(new THREE.SphereGeometry(14 + rnd() * 10, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xffffff)); obj.position.set(x, 0, z); obj.scale.y = 0.5; }
    else if (th.deco === 'tree') { const k = 0.7 + rnd() * 0.5; obj = new THREE.Mesh(new THREE.IcosahedronGeometry(16 * k, 0), mat(0x3f7d3a)); obj.position.set(x, 10 * k, z); }
    else if (th.deco === 'panels') { obj = new THREE.Mesh(new THREE.BoxGeometry(16, 3, 16), mat(0x475569, { emissive: 0x0ea5e9, emissiveIntensity: 0.3 })); obj.position.set(x, 1.5, z); }
    if (obj) { obj.castShadow = obj.receiveShadow = true; mapGroup.add(obj); }
    if (mapId === 'deserto' && rnd() < 0.35) { // alguns cactos aleatórios no deserto
      const cx = 40 + rnd() * (W - 80), cz = 40 + rnd() * (H - 80);
      if (G.circleFree(cx, cz, 20, mapWalls, CFG)) {
        const cg = new THREE.Group(), cactusMat = mat(0x2f7d4f);
        const body = new THREE.Mesh(new THREE.CylinderGeometry(5, 6, 26 + rnd() * 14, 8), cactusMat); body.position.y = 13;
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.5, 14, 6), cactusMat); arm.position.set(6, 16, 0); arm.rotation.z = -0.9;
        cg.add(body, arm); cg.position.set(cx, 0, cz);
        cg.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
        mapGroup.add(cg);
      }
    }
  }
  // teto que ricocheteia tiro (folhas da floresta acima das copas / vidro da nave)
  const ceilY = CEILING_Y[mapId];
  if (ceilY) {
    const roofColor = mapId === 'nave' ? 0xbfe3ff : 0x2f6b34;
    const roofOpacity = mapId === 'nave' ? 0.16 : 0.28;
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ color: roofColor, transparent: true, opacity: roofOpacity, side: THREE.DoubleSide, depthWrite: false }));
    roof.rotation.x = -Math.PI / 2; roof.position.set(W / 2, ceilY, H / 2);
    mapGroup.add(roof);
  }
  // portais: um quadro brilhante em cada abertura aberta
  if (map.portals && openPr) {
    const list = G.portalList(map), opened = new Set(); for (const [i, j] of openPr) { opened.add(i); opened.add(j); }
    for (const q of list) {
      if (!opened.has(q.i)) continue;
      const geom = G.portalGeom(q, CFG);
      const frame = new THREE.Mesh(new THREE.PlaneGeometry(geom.half * 2, P.borderH), new THREE.MeshBasicMaterial({ color: 0x8b7cf6, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
      frame.position.set(geom.cx + geom.nx * 2, P.borderH / 2, geom.cy + geom.ny * 2);
      frame.rotation.y = Math.atan2(geom.nx, geom.ny);
      mapGroup.add(frame);
    }
  }
  // vulcão: poças de lava (sorteadas uma vez por partida, sempre espelhadas)
  for (const l of lavaGlow) { mapGroup && scene.remove(l.mesh); } lavaGlow = [];
  window.__lavaPools = null;
  if (mapId === 'vulcao') {
    const pools = [], rnd2 = seeded(mapId.length * 53 + 3);
    for (let i = 0; i < 3; i++) {
      for (let tries = 0; tries < 30; tries++) {
        const r = 55 + rnd2() * 25;
        const x = W * 0.16 + rnd2() * (W * 0.28), z = 70 + rnd2() * (H - 140);
        if (!G.circleFree(x, z, r + 15, mapWalls, CFG)) continue;
        pools.push({ x, z, r }, { x: W - x, z, r });
        break;
      }
    }
    window.__lavaPools = pools;
    for (const q of pools) {
      const glow = new THREE.Mesh(new THREE.CircleGeometry(q.r, 20), new THREE.MeshBasicMaterial({ color: 0xff5a1f, transparent: true, opacity: 0.85 }));
      glow.rotation.x = -Math.PI / 2; glow.position.set(q.x, 1.2, q.z);
      mapGroup.add(glow);
      const light = new THREE.PointLight(0xff5a1f, 3, 260, 2); light.position.set(q.x, 30, q.z);
      mapGroup.add(light);
      lavaGlow.push({ mesh: glow, light });
    }
  }
  // cidade à noite: postes que iluminam (atirar apaga por um tempo) e ambiente escuro
  for (const l of lampLights) { mapGroup && scene.remove(l.bulb); } lampLights = [];
  window.__lampPositions = null;
  if (mapId === 'cidade') {
    const lampPts = MAPS.cidade.lamps.map(([nx, nz]) => [nx * W, nz * H]);
    window.__lampPositions = lampPts;
    for (const [x, z] of lampPts) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 60, 6), mat(0x1f2430)); pole.position.set(x, 30, z);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe9a8 })); bulb.position.set(x, 60, z);
      pole.castShadow = pole.receiveShadow = true;
      mapGroup.add(pole, bulb);
      const light = new THREE.PointLight(0xffe9a8, 2.4, 260, 2); light.position.set(x, 58, z);
      mapGroup.add(light);
      lampLights.push({ bulb, light });
    }
  }
  // luz do ambiente: escura em "cidade" (só os postes iluminam); "escuro" começa normal e o frame() liga/desliga
  if (mapId === 'cidade') { hemi.intensity = 0.12; sun.intensity = 0.05; }
  else { hemi.intensity = 1.3; sun.intensity = 2.3; }
  if (map.space) {
    const pts = [], rs = seeded(9);
    for (let i = 0; i < 2500; i++) { const a = rs() * Math.PI * 2, b = rs() * Math.PI - Math.PI / 2, r = 3500; pts.push(W / 2 + Math.cos(a) * Math.cos(b) * r, Math.sin(b) * r, H / 2 + Math.sin(a) * Math.cos(b) * r); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    mapGroup.add(new THREE.Points(gg, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false })));
  }
  scene.add(mapGroup);
  sun.position.set(W / 2 - 600, 1500, H / 2 + 800); sun.target.position.set(W / 2, 0, H / 2);
}

// ---------- bonecos KayKit ----------
const MODEL_FILES = { A: '/demo3d/models/Rogue_Hooded.glb', B: '/demo3d/models/Rogue.glb' };
const BASE = {};
const UPPER = new Set(['spine', 'chest', 'head', 'upperarm.l', 'upperarm.r', 'lowerarm.l', 'lowerarm.r', 'wrist.l', 'wrist.r', 'hand.l', 'hand.r', 'handslot.l', 'handslot.r', 'elbowIK.l', 'elbowIK.r', 'handIK.l', 'handIK.r']);
const CLIPS = {};
function splitClips(anims) {
  for (const clip of anims) {
    if (CLIPS[clip.name]) continue;
    const bone = (t) => t.name.split('.').slice(0, -1).join('.');
    CLIPS[clip.name] = {
      full: clip,
      upper: new THREE.AnimationClip(clip.name + '_U', clip.duration, clip.tracks.filter((t) => UPPER.has(bone(t)))),
      lower: new THREE.AnimationClip(clip.name + '_L', clip.duration, clip.tracks.filter((t) => !UPPER.has(bone(t))))
    };
  }
}
async function loadModels() {
  const loader = new GLTFLoader();
  for (const tm of ['A', 'B']) { const g = await loader.loadAsync(MODEL_FILES[tm]); BASE[tm] = g; splitClips(g.animations); }
}
function textSprite(text, color, h = 0.04) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const g = cv.getContext('2d');
  g.font = '800 30px Segoe UI, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(text, 128, 32);
  g.fillStyle = color; g.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, sizeAttenuation: false }));
  sp.scale.set(h * 4, h, 1);
  return sp;
}
// arma na mão do boneco para cada arma do jogo
const HAND_ITEM = { lancador: '1H_Crossbow', estilingue: '1H_Crossbow', arco: '2H_Crossbow', mao: 'Throwable', disco: 'Throwable', knife: 'Knife', nade: 'Throwable', smoke: 'Throwable' };
const AIM_ANIM = { lancador: '1H_Ranged_Aiming', estilingue: '1H_Ranged_Aiming', arco: '2H_Ranged_Aiming' };
const SHOOT_ANIM = { lancador: ['1H_Ranged_Shoot', 1.7], estilingue: ['1H_Ranged_Shoot', 1.7], arco: ['2H_Ranged_Shoot', 1.6], mao: ['Throw', 2.2], disco: ['Throw', 1.8] };
const RELOAD_ANIM = { lancador: '1H_Ranged_Reload', estilingue: '1H_Ranged_Reload', arco: '2H_Ranged_Reload', mao: 'PickUp', disco: 'PickUp' };

class Avatar {
  constructor(p) {
    this.id = p.id; this.team = p.team;
    this.root = new THREE.Group();
    this.model = SkeletonUtils.clone(BASE[p.team].scene);
    const box = new THREE.Box3().setFromObject(this.model);
    this.baseScale = CHAR_H / ((box.max.y - box.min.y) || 1);
    this.model.scale.setScalar(this.baseScale);
    const tint = new THREE.Color(TEAM[p.team]);
    this.items = {};
    this.model.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.material = o.material.clone(); o.material.color.lerp(tint, 0.62); }
      if (['1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable', 'Knife_Offhand'].includes(o.name)) { this.items[o.name] = o; o.visible = false; }
    });
    this.root.add(this.model);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(20, 25, 28), new THREE.MeshBasicMaterial({ color: TEAM[p.team], transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.8;
    this.root.add(this.ring);
    if (p.id !== 'me') { this.label = textSprite(p.name, p.team === 'A' ? '#93c5fd' : '#fca5a5'); this.label.position.y = CHAR_H + 18; this.root.add(this.label); }
    scene.add(this.root);
    this.mixer = new THREE.AnimationMixer(this.model);
    this.cur = { lower: null, upper: null }; this.curName = { lower: '', upper: '' };
    this.oneShot = null; this.lowerOnce = null;
    this.play('lower', 'Idle'); this.play('upper', '1H_Ranged_Aiming');
  }
  play(layer, name, fade = 0.15, once = false, speed = 1) {
    if (this.curName[layer] === name && !once) { if (this.cur[layer]) this.cur[layer].setEffectiveTimeScale(speed); return this.cur[layer]; }
    const clip = CLIPS[name] && CLIPS[name][layer];
    if (!clip) return null;
    const a = this.mixer.clipAction(clip);
    a.enabled = true; a.setEffectiveTimeScale(speed); a.setEffectiveWeight(1);
    if (once) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } else a.setLoop(THREE.LoopRepeat, Infinity);
    a.reset().fadeIn(fade).play();
    const old = this.cur[layer]; if (old && old !== a) old.fadeOut(fade);
    this.cur[layer] = a; this.curName[layer] = name;
    return a;
  }
  // ações rápidas nos braços (vindas dos eventos da simulação)
  trigger(name, speed, now) {
    if (!CLIPS[name]) return;
    this.play('upper', name, 0.06, true, speed);
    this.oneShot = { until: now + (CLIPS[name].full.duration / speed) * 1000 - 60, name };
  }
  legsOnce(name, speed, now) {
    if (!CLIPS[name]) return;
    this.play('lower', name, 0.06, true, speed);
    this.lowerOnce = { until: now + (CLIPS[name].full.duration / speed) * 1000 - 40 };
  }
  update(p, sim, dt, now) {
    const wkey = p.weapon === 'primary' ? p.primary : p.weapon;
    for (const k in this.items) this.items[k].visible = false;
    const item = this.items[HAND_ITEM[wkey]]; if (item) item.visible = true;
    // pernas
    const sp = Math.hypot(p.vx, p.vz);
    if (this.lowerOnce && now >= this.lowerOnce.until) this.lowerOnce = null;
    if (!this.lowerOnce) {
      if (!p.grounded) this.play('lower', p.vy > 120 ? 'Jump_Start' : 'Jump_Idle', 0.12, false, 1);
      else if (sp > 25) {
        const fx = Math.cos(p.yaw), fz = Math.sin(p.yaw);
        const fwd = (p.vx * fx + p.vz * fz) / sp, side = (p.vx * -fz + p.vz * fx) / sp, k = sp / P.speed;
        if (fwd > 0.5) this.play('lower', 'Running_A', 0.15, false, 1.1 * k);
        else if (fwd < -0.5) this.play('lower', 'Walking_Backwards', 0.15, false, 1.5 * k);
        else this.play('lower', side > 0 ? 'Running_Strafe_Right' : 'Running_Strafe_Left', 0.15, false, 1.1 * k);
      } else this.play('lower', 'Idle', 0.2);
    }
    // braços
    if (this.oneShot && now >= this.oneShot.until) this.oneShot = null;
    if (!this.oneShot) {
      const w = WEAPONS[p.primary];
      if (p.weapon === 'primary' && p.reloadUntil) this.play('upper', RELOAD_ANIM[p.primary], 0.12, false, CLIPS[RELOAD_ANIM[p.primary]].full.duration / w.reload);
      else if (p.weapon === 'primary' && AIM_ANIM[p.primary]) this.play('upper', AIM_ANIM[p.primary], 0.15);
      else this.play('upper', this.curName.lower || 'Idle', 0.15, false, this.cur.lower ? this.cur.lower.getEffectiveTimeScale() : 1);
    }
    this.mixer.update(dt);
  }
  remove() { scene.remove(this.root); }
}
const avatars = new Map();

// ---------- lápide (fica no lugar da morte; o corpo some) ----------
const tombMeshes = new Map();
function makeTomb(t) {
  const g = new THREE.Group();
  const stone = mat(0x8b939e), dark = mat(0x5b6370);
  const base = new THREE.Mesh(new THREE.BoxGeometry(34, 6, 18), dark); base.position.y = 3;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(26, 30, 8), stone); slab.position.y = 20;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 8, 10, 1, false, 0, Math.PI), stone);
  top.rotation.set(Math.PI / 2, 0, Math.PI / 2); top.position.y = 35;
  const cross1 = new THREE.Mesh(new THREE.BoxGeometry(3, 14, 1.5), dark); cross1.position.set(0, 24, 4.4);
  const cross2 = new THREE.Mesh(new THREE.BoxGeometry(9, 3, 1.5), dark); cross2.position.set(0, 27, 4.4);
  // cruz de madeira em cima da lápide
  const wood = mat(0x6b4a2f);
  const post = new THREE.Mesh(new THREE.BoxGeometry(2.6, 20, 2.6), wood); post.position.y = 49;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(13, 2.6, 2.6), wood); beam.position.y = 53;
  for (const m of [base, slab, top, post, beam]) { m.castShadow = true; m.receiveShadow = true; }
  g.add(base, slab, top, cross1, cross2, post, beam);
  const label = textSprite(t.name, t.team === 'A' ? '#93c5fd' : '#fca5a5', 0.035); label.position.y = 68;
  g.add(label);
  g.position.set(t.x, t.y, t.z);
  g.rotation.y = Math.random() * 0.6 - 0.3;
  return g;
}

// ---------- fumaça realista: muitas "nuvenzinhas" macias ----------
const SMOKE_TEX = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d'), rnd = seeded(77);
  for (let i = 0; i < 14; i++) { // bolinhas sobrepostas = borda irregular
    const x = 64 + (rnd() - 0.5) * 40, y = 64 + (rnd() - 0.5) * 40, r = 22 + rnd() * 26;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,.9)'); grd.addColorStop(0.5, 'rgba(255,255,255,.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
})();
function makeSmoke(s) {
  const g = new THREE.Group(), rnd = seeded(s.id * 13 + 1), R = P.smokeRadius;
  g.userData.parts = [];
  for (let i = 0; i < 150; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * R * 0.85;
    const h = Math.pow(rnd(), 1.6) * R * 0.85 + 15;
    const m = new THREE.SpriteMaterial({ map: SMOKE_TEX, color: new THREE.Color().setHSL(0.6, 0.05, 0.72 + rnd() * 0.16), transparent: true, depthWrite: false, opacity: 0, rotation: rnd() * Math.PI * 2 });
    const sp = new THREE.Sprite(m);
    const size = 70 + rnd() * 90;
    sp.userData = { a, d, h, size, spin: (rnd() - 0.5) * 0.3, drift: 0.4 + rnd() * 0.6, dens: 1 - d / R };
    g.add(sp); g.userData.parts.push(sp);
  }
  for (let i = 0; i < 12; i++) { // miolo: nuvens grandes e fechadas (quem está no meio some)
    const m = new THREE.SpriteMaterial({ map: SMOKE_TEX, color: new THREE.Color().setHSL(0.6, 0.04, 0.8), transparent: true, depthWrite: false, opacity: 0, rotation: rnd() * Math.PI * 2 });
    const sp = new THREE.Sprite(m);
    sp.userData = { a: rnd() * Math.PI * 2, d: rnd() * R * 0.3, h: 35 + rnd() * 70, size: 230 + rnd() * 90, spin: (rnd() - 0.5) * 0.2, drift: 0.2, dens: 1.2 };
    g.add(sp); g.userData.parts.push(sp);
  }
  g.position.set(s.x, 0, s.z);
  return g;
}
function updateSmoke(g, s, sim, dt) {
  const k = sim.smokeK(s), grow = Math.min(1, (sim.time - s.t0) / 0.6);
  for (const sp of g.userData.parts) {
    const u = sp.userData;
    const d = u.d * (0.35 + 0.65 * grow) + (sim.time - s.t0) * u.drift * 3;
    sp.position.set(Math.cos(u.a) * d, u.h * (0.4 + 0.6 * grow), Math.sin(u.a) * d);
    const sz = u.size * (0.6 + 0.4 * grow); sp.scale.set(sz, sz, 1);
    sp.material.rotation += u.spin * dt;
    sp.material.opacity = k * Math.min(1, 0.45 + 0.75 * u.dens); // miolo fechado, borda clareando
  }
}

// ---------- tiros, granadas, efeitos ----------
const bulletMeshes = new Map(), nadeMeshes = new Map(), smokeMeshes = new Map(), pickupMeshes = new Map(), effects = [];
function makePickup(u) {
  const color = u.type === 'nade' ? 0xfacc15 : 0x4ade80;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(u.r, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
  disc.rotation.x = -Math.PI / 2; disc.position.set(u.x, 0.6, u.z);
  return disc;
}
const TEAM_EMIS = { A: 0x3b82f6, B: 0xef4444 }, TEAM_BALL = { A: 0x93c5fd, B: 0xfca5a5 };
function makeBullet(b) {
  const team = b.team, m = new THREE.MeshStandardMaterial({ color: TEAM_BALL[team], emissive: TEAM_EMIS[team], emissiveIntensity: 1.8, roughness: 0.4 });
  if (b.kind === 'arco') { // flecha de borracha
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 38, 6), mat(0xe5d3a1)); shaft.rotation.x = Math.PI / 2;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 6), m); tip.position.z = 20;
    const fl = new THREE.Mesh(new THREE.BoxGeometry(6, 0.6, 7), mat(TEAM_EMIS[team])); fl.position.z = -16;
    g.add(shaft, tip, fl); g.userData.orient = true; return g;
  }
  if (b.kind === 'disco') { const d = new THREE.Mesh(new THREE.CylinderGeometry(b.r, b.r, 3, 16), m); d.userData.spin = true; return d; }
  const s = new THREE.Mesh(new THREE.IcosahedronGeometry(b.r * 1.15, 1), m);
  return s;
}
function makeNade(g) {
  if (g.smoke) { const c = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 14, 10), mat(0x94a3b8, { metalness: 0.4 })); return c; }
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(P.nadeR, 1), mat(0x3f5f3a)); grp.add(body);
  const led = new THREE.Mesh(new THREE.SphereGeometry(2, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff3b30 })); led.position.y = P.nadeR; grp.add(led); grp.userData.led = led;
  return grp;
}
// textura suave (gradiente radial) pro fogo da explosão — sem serrilhado de geometria de baixo poli
const FIRE_TEX = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,235,1)'); grd.addColorStop(0.22, 'rgba(255,210,90,.98)');
  grd.addColorStop(0.5, 'rgba(255,130,35,.85)'); grd.addColorStop(0.78, 'rgba(255,70,20,.35)'); grd.addColorStop(1, 'rgba(255,60,20,0)');
  g.fillStyle = grd; g.beginPath(); g.arc(64, 64, 64, 0, Math.PI * 2); g.fill();
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
})();
const RING_TEX = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.strokeStyle = 'rgba(255,220,150,.9)'; g.lineWidth = 10; g.beginPath(); g.arc(64, 64, 50, 0, Math.PI * 2); g.stroke();
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
})();
function addEffect(e, now) {
  if (e.type === 'explode') {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: FIRE_TEX, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.set(e.x, e.y + 6, e.z); m.scale.setScalar(1); scene.add(m);
    const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: RING_TEX, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
    ring.position.set(e.x, e.y + 3, e.z); ring.scale.setScalar(1); scene.add(ring);
    const light = new THREE.PointLight(0xffa640, 7, 550, 1.6); light.position.set(e.x, e.y + 30, e.z); scene.add(light);
    // faíscas voando (pontinhos que sobem e apagam)
    const sparkGeo = new THREE.BufferGeometry(); const N = 22, pos = new Float32Array(N * 3), vel = [];
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 220;
      vel.push([Math.cos(a) * s, 120 + Math.random() * 220, Math.sin(a) * s]);
      pos[i * 3] = e.x; pos[i * 3 + 1] = e.y + 6; pos[i * 3 + 2] = e.z;
    }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0xffcf7a, size: 5, sizeAttenuation: true, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(sparks);
    effects.push({ m, ring, light, sparks, sparkVel: vel, sparkPos: pos, t0: now, d: 480, r: P.nadeRadius });
  }
}

// ---------- arma na tela (1ª pessoa) ----------
const VIEW = {};
{
  const add = (name, parts) => { const g = new THREE.Group(); parts.forEach((p) => g.add(p)); g.visible = false; camera.add(g); VIEW[name] = g; return g; };
  const m = (geo, color, x, y, z, extra) => { const o = new THREE.Mesh(geo, mat(color, extra)); o.position.set(x, y, z); return o; };
  const tank = new THREE.Mesh(new THREE.SphereGeometry(3.4, 10, 8), new THREE.MeshStandardMaterial({ color: 0x60a5fa, emissive: 0x1d4ed8, emissiveIntensity: 0.6, roughness: 0.3 })); tank.position.set(0, 3.8, 1);
  const barrel = m(new THREE.CylinderGeometry(1.3, 1.3, 10, 8), 0x111827, 0, 0.8, -15, { metalness: 0.7, roughness: 0.3 }); barrel.rotation.x = Math.PI / 2;
  const grip = m(new THREE.BoxGeometry(3.2, 7, 4), 0x1f2937, 0, -4.5, 5); grip.rotation.x = 0.3;
  add('lancador', [m(new THREE.BoxGeometry(4, 4, 22), 0x374151, 0, 0, 0, { metalness: 0.5, roughness: 0.4 }), barrel, grip, tank]);
  // estilingue: cabo + forquilha + elástico
  const f1 = m(new THREE.BoxGeometry(1.6, 9, 1.6), 0x8b5a2b, -2.2, 5, -2); f1.rotation.z = 0.35;
  const f2 = m(new THREE.BoxGeometry(1.6, 9, 1.6), 0x8b5a2b, 2.2, 5, -2); f2.rotation.z = -0.35;
  const band = m(new THREE.BoxGeometry(7.5, 0.8, 0.8), 0xef4444, 0, 9, -2);
  const sBall = m(new THREE.SphereGeometry(2.4, 8, 6), 0x93c5fd, 0, 8.6, 1.5); sBall.userData.pull = true;
  add('estilingue', [m(new THREE.BoxGeometry(2.2, 10, 2.2), 0x8b5a2b, 0, -4, 0), f1, f2, band, sBall]);
  // bolinha na mão
  add('mao', [m(new THREE.BoxGeometry(7, 5, 10), 0xe0b08a, 0, -3, 2), m(new THREE.SphereGeometry(4.5, 10, 8), 0x93c5fd, 0, 2.5, -3)]);
  // arco
  const bowArc = new THREE.Mesh(new THREE.TorusGeometry(14, 0.9, 6, 20, Math.PI), mat(0x8b5a2b)); bowArc.rotation.z = Math.PI / 2;
  const str = m(new THREE.BoxGeometry(0.4, 28, 0.4), 0xf1f5f9, 0, 0, 0); str.userData.string = true;
  const arrow = m(new THREE.CylinderGeometry(0.6, 0.6, 30, 6), 0xe5d3a1, 0, 0, -8); arrow.rotation.x = Math.PI / 2; arrow.userData.arrow = true;
  const bowG = add('arco', [bowArc, str, arrow]); bowG.rotation.z = 0.25;
  add('disco', [m(new THREE.CylinderGeometry(7, 7, 1.6, 16), 0x93c5fd, 0, 0, -2), m(new THREE.BoxGeometry(6, 4, 8), 0xe0b08a, 0, -3, 4)]);
  add('knife', [m(new THREE.BoxGeometry(1, 2.6, 16), 0xd1d5db, 0, 0, -8, { metalness: 0.8, roughness: 0.25 }), m(new THREE.BoxGeometry(2.2, 3, 6), 0x1f2937, 0, 0, 2)]);
  add('nade', [m(new THREE.IcosahedronGeometry(4.5, 1), 0x3f5f3a, 0, 0, -2), m(new THREE.TorusGeometry(1.6, 0.4, 5, 10), 0xd1d5db, 0, 4.8, -2), m(new THREE.BoxGeometry(6, 4, 8), 0xe0b08a, 0, -4, 3)]);
  add('smoke', [m(new THREE.CylinderGeometry(3.6, 3.6, 10, 10), 0x94a3b8, 0, 0, -2, { metalness: 0.4 }), m(new THREE.BoxGeometry(6, 4, 8), 0xe0b08a, 0, -5, 3)]);
}
let kick = 0, swing = 0;

// ---------- mira (cruz, ponto, círculo de recarga, marcador de acerto) ----------
function drawCross(ctx, W, H, x, prog, hit) {
  ctx.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2;
  const line = (x1, y1, x2, y2, color, w) => {
    if (x.outline === '1') { ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = w + 2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  };
  ctx.lineCap = 'butt';
  if (x.ring === '1') { // círculo: fecha conforme o próximo tiro carrega
    ctx.lineWidth = x.ringw;
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(cx, cy, x.ringr, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = prog >= 1 ? hexA(x.color, 0.55) : hexA('#ffcc33', 0.9);
    ctx.beginPath(); ctx.arc(cx, cy, x.ringr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.001, prog)); ctx.stroke();
  }
  if (x.len > 0) {
    const g = +x.gap, L = +x.len, t = +x.thick;
    line(cx, cy - g, cx, cy - g - L, x.color, t); line(cx, cy + g, cx, cy + g + L, x.color, t);
    line(cx - g, cy, cx - g - L, cy, x.color, t); line(cx + g, cy, cx + g + L, cy, x.color, t);
  }
  if (x.dot === '1') {
    if (x.outline === '1') { ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.beginPath(); ctx.arc(cx, cy, +x.dotsize + 1, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = x.color; ctx.beginPath(); ctx.arc(cx, cy, +x.dotsize, 0, Math.PI * 2); ctx.fill();
  }
  if (hit && x.hit === '1') { // X na diagonal: amarelo = acerto, vermelho = abate
    const col = hit.kind === 'kill' ? '#ef4444' : '#facc15', a = hit.a;
    ctx.globalAlpha = a;
    const s = +x.gap + 6, e = s + +x.hitlen, w = +x.hitw;
    for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) line(cx + dx * s * 0.7, cy + dy * s * 0.7, cx + dx * e * 0.7, cy + dy * e * 0.7, col, w);
    ctx.globalAlpha = 1;
  }
}
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
const crossCtx = $('cross').getContext('2d');
let hitMark = null; // { kind, t }

// ---------- menu (Esc) ----------
let locked = false, menuOpen = true;
function showMenu(v) { menuOpen = v; $('menu').style.display = v ? 'grid' : 'none'; if (v) drawPreview(); }
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === t));
  document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('on', p.id === t.dataset.pane));
  drawPreview();
  if (t.dataset.pane === 'p-mp' && $('mp-view-lobby').style.display === 'none') refreshRoomList();
}));

// ---------- multiplayer: menu (criar/entrar em sala, lobby, times, dono da sala) ----------
function mpStatus(msg, id) { const el = $(id || 'mp-status'); if (el) el.textContent = msg || ''; }
function switchMpView(v) {
  $('mp-view-menu').style.display = v === 'lobby' ? 'none' : 'grid';
  $('mp-view-lobby').style.display = v === 'lobby' ? 'grid' : 'none';
}
function ensureSocket() {
  if (socket) return socket;
  socket = io();
  socket.on('3d_room_state', (state) => { room3d = state; renderLobby(); });
  socket.on('3d_match_start', (d) => {
    const mine = room3d && room3d.members.find((m) => m.id === myPid);
    if (!mine || mine.status !== 'team') { mpStatus('A partida começou — escolha um time para entrar na próxima.', 'mp-status2'); return; }
    enterNetMatch(d.map);
    netMode = true;
    lockPointer();
  });
  socket.on('3d_match_end', () => {
    if (locked) { try { document.exitPointerLock(); } catch (e) {} }
    showMenu(true);
    switchMpView('lobby');
    renderLobby();
  });
  socket.on('3d_state', (msg) => { if (netMode) applySnapshot(msg.s, msg.e); });
  socket.on('3d_toast', (msg) => mpStatus(msg, room3d ? 'mp-status2' : 'mp-status'));
  socket.on('3d_kicked', (msg) => { mpStatus(msg || 'Você foi desconectado da sala.', 'mp-status'); leaveNetRoom(true); });
  socket.on('3d_room_closed', () => { mpStatus('A sala foi fechada.', 'mp-status'); leaveNetRoom(true); });
  return socket;
}
function leaveNetRoom(silent) {
  if (!silent && socket && room3d) socket.emit('3d_leave_room');
  room3d = null; netMode = false;
  if (locked) { try { document.exitPointerLock(); } catch (e) {} }
  newGame();
  switchMpView('menu');
}
function refreshRoomList() {
  ensureSocket().emit('3d_list_rooms', null, (list) => {
    const el = $('mp-list');
    if (!el) return;
    if (!list || !list.length) { el.textContent = 'Nenhuma sala aberta agora.'; return; }
    el.innerHTML = list.map((r) => `<div class="row2" style="justify-content:space-between;padding:4px 0;border-bottom:1px solid #243044">
      <span>${r.locked ? '🔒 ' : ''}<b>${esc(r.code)}</b> · ${esc(MAPS[r.map] ? MAPS[r.map].name : r.map)} · ${r.phase === 'match' ? 'em partida' : 'na sala'} · ${r.players} jogador(es)</span>
      <button class="btn" data-code="${esc(r.code)}">Entrar</button></div>`).join('');
    el.querySelectorAll('button[data-code]').forEach((b) => b.addEventListener('click', () => { $('mp-join-code').value = b.dataset.code; joinRoom(); }));
  });
}
function createRoom() {
  const code = $('mp-create-code').value.trim();
  const pass = $('mp-create-pass').value;
  if (!code) { mpStatus('Digite um nome para a sala (1 a 5 letras/números).'); return; }
  ensureSocket().emit('3d_create_room', { name: code, clientId: window.PB.clientId(), map: S.map, password: pass }, (r) => {
    if (!r || !r.ok) { mpStatus((r && r.error) || 'Não foi possível criar a sala.'); return; }
    $('mp-join-code').value = r.code; $('mp-join-pass').value = pass;
    joinRoom();
  });
}
const MP_ERR = { not_found: 'Sala não encontrada.', wrong_password: 'Senha errada.', need_password: 'Essa sala tem senha.', full: 'Sala cheia.', bad_client: 'Erro de conexão, recarregue a página.' };
function joinRoom() {
  const name = $('mp-name').value.trim() || 'Jogador';
  const code = $('mp-join-code').value.trim();
  const pass = $('mp-join-pass').value;
  if (!code) { mpStatus('Digite o código da sala.'); return; }
  ensureSocket().emit('3d_join_room', { name, clientId: window.PB.clientId(), code, password: pass }, (r) => {
    if (!r || !r.ok) { mpStatus(MP_ERR[r && r.error] || 'Não foi possível entrar.'); return; }
    myPid = r.you; room3d = r.state;
    mpStatus('');
    switchMpView('lobby'); renderLobby();
    if (r.match) mpStatus('Partida em andamento — escolha um time para entrar na próxima.', 'mp-status2');
  });
}
function renderLobby() {
  if (!room3d || $('mp-view-lobby').style.display === 'none') return;
  $('mp-lobby-code').textContent = room3d.code;
  $('mp-lobby-lock').textContent = room3d.hasPassword ? '🔒' : '';
  const isHost = room3d.hostId === myPid;
  const memberRow = (m) => `<div class="wdesc" style="padding:2px 0">${m.id === myPid ? '<b>' + esc(m.name) + ' (você)</b>' : esc(m.name)}${m.connected ? '' : ' (desconectado)'}${m.inMatch ? ' 🎮' : ''}</div>`;
  const botRow = (b) => `<div class="wdesc">🤖 ${esc(b.name)}</div>`;
  $('mp-team-A').innerHTML = room3d.members.filter((m) => m.status === 'team' && m.team === 'A').map(memberRow).join('') + (room3d.bots.team === 'A' ? room3d.bots.list.map(botRow).join('') : '');
  $('mp-team-B').innerHTML = room3d.members.filter((m) => m.status === 'team' && m.team === 'B').map(memberRow).join('') + (room3d.bots.team === 'B' ? room3d.bots.list.map(botRow).join('') : '');
  if (isHost) {
    $('mp-host-settings').innerHTML = `
      <label class="field" style="grid-template-columns:120px 1fr"><span>Mapa</span><select id="mp-set-map">${Object.keys(MAPS).map((k) => `<option value="${k}" ${k === room3d.map ? 'selected' : ''}>${esc(MAPS[k].name)}</option>`).join('')}</select><span></span></label>
      <label class="field" style="grid-template-columns:120px 1fr"><span>Bots</span><select id="mp-set-bots">${[0, 1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${n === room3d.bots.list.length ? 'selected' : ''}>${n}</option>`).join('')}</select><span></span></label>
      <label class="field" style="grid-template-columns:120px 1fr"><span>Time dos bots</span><select id="mp-set-botteam"><option value="A" ${room3d.bots.team === 'A' ? 'selected' : ''}>Azul</option><option value="B" ${room3d.bots.team === 'B' ? 'selected' : ''}>Vermelho</option></select><span></span></label>
      <label class="field" style="grid-template-columns:120px 1fr"><span>Nível dos bots</span><select id="mp-set-level"><option value="iniciante" ${room3d.botLevel === 'iniciante' ? 'selected' : ''}>Iniciante</option><option value="amador" ${room3d.botLevel === 'amador' ? 'selected' : ''}>Amador</option><option value="pro" ${room3d.botLevel === 'pro' ? 'selected' : ''}>Profissional</option></select><span></span></label>`;
    ['mp-set-map', 'mp-set-bots', 'mp-set-botteam', 'mp-set-level'].forEach((id) => $(id).addEventListener('change', () => {
      socket.emit('3d_update_settings', { map: $('mp-set-map').value, bots: Number($('mp-set-bots').value), botTeam: $('mp-set-botteam').value, botLevel: $('mp-set-level').value });
    }));
  } else {
    $('mp-host-settings').innerHTML = `<div class="wdesc">Mapa: ${esc(MAPS[room3d.map] ? MAPS[room3d.map].name : room3d.map)} · Bots: ${room3d.bots.list.length} (${room3d.bots.team === 'A' ? 'Azul' : 'Vermelho'}, ${room3d.botLevel})</div>`;
  }
  $('mp-start-row').innerHTML = room3d.phase === 'match'
    ? '<div class="wdesc">⚔️ Partida em andamento...</div>'
    : (isHost ? '<button class="btn primary" id="mp-start-btn">▶ Iniciar partida</button>' : '<div class="wdesc">Aguardando o dono da sala iniciar...</div>');
  if (isHost && room3d.phase !== 'match') $('mp-start-btn').addEventListener('click', () => socket.emit('3d_start_match'));
}
$('mp-create-btn').addEventListener('click', createRoom);
$('mp-join-btn').addEventListener('click', joinRoom);
$('mp-refresh-btn').addEventListener('click', refreshRoomList);
$('mp-leave-btn').addEventListener('click', () => leaveNetRoom(false));
$('mp-join-A').addEventListener('click', () => ensureSocket().emit('3d_choose_team', { team: 'A' }));
$('mp-join-B').addEventListener('click', () => ensureSocket().emit('3d_choose_team', { team: 'B' }));
(() => { try { const pr = window.PB && window.PB.getProfile ? window.PB.getProfile() : null; if (pr && pr.name) $('mp-name').value = pr.name; } catch (e) {} })();
$('o-weapon').innerHTML = WEAPON_IDS.map((w) => `<option value="${w}">${WEAPONS[w].name}</option>`).join('');
const WDESC = {
  lancador: 'Rápido e reto, sem cair. 3 ricochetes. Um tiro por segundo.',
  estilingue: 'Bolinha que cai um pouco com a distância. 4 ricochetes. Atira mais rápido.',
  mao: 'Você joga a bolinha de borracha: faz curva para baixo, quica muito (5 ricochetes) e dá para jogar rápido.',
  arco: 'Segure o clique para puxar e solte. Quanto mais puxa, mais rápida e reta a flecha. 2 ricochetes.',
  disco: 'Disco de borracha que voa reto e quica até 7 vezes nas paredes. Mais lento, ótimo para acertar pela tabela.'
};
function bindSetting(id, key, obj, onChange) {
  const el = $(id), o = obj || S;
  el.value = o[key];
  const show = () => { const v = $('v-' + id); if (v) v.textContent = el.value; };
  show();
  el.addEventListener('input', () => { o[key] = el.type === 'range' ? Number(el.value) : el.value; show(); save(); if (onChange) onChange(); drawPreview(); });
}
bindSetting('o-cam', 'cam');
bindSetting('o-map', 'map', null, () => newGame());
bindSetting('o-bots', 'bots', null, () => newGame());
bindSetting('o-level', 'level', null, () => { for (const p of sim.players.values()) if (p.bot) p.level = S.level; });
bindSetting('o-shadow', 'shadow', null, () => { renderer.shadowMap.enabled = S.shadow === '1'; scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)); }); });
bindSetting('o-fov', 'fov');
bindSetting('o-weapon', 'weapon', null, () => { const me = sim.players.get('me'); if (me) { me.primary = S.weapon; me.reloadUntil = 0; me.charge0 = 0; } $('w-desc').textContent = WDESC[S.weapon]; });
$('w-desc').textContent = WDESC[S.weapon];
bindSetting('o-sens', 'sens');
bindSetting('o-invert', 'invert');
// ---------- sala de teste: velocidade / pulo / cadência / recarga ajustáveis ----------
bindSetting('o-test', 'test', null, () => { if (sim) sim.godMode = S.test === '1'; });
bindSetting('o-speed', 'speed', null, () => { if (sim) sim.setParam('speed', S.speed); });
bindSetting('o-jumpv', 'jumpv', null, () => { if (sim) sim.setParam('jumpV', S.jumpv); });
$('o-tweapon').innerHTML = WEAPON_IDS.map((w) => `<option value="${w}">${WEAPONS[w].name}</option>`).join('');
function loadTweaponSliders() {
  const base = WEAPONS[S.tweapon], ov = S.wtune[S.tweapon] || {};
  const cd = ov.cd != null ? ov.cd : base.cd, rl = ov.reload != null ? ov.reload : base.reload;
  $('o-tcd').value = cd; $('v-o-tcd').textContent = cd;
  $('o-treload').value = rl; $('v-o-treload').textContent = rl;
}
$('o-tweapon').value = S.tweapon;
loadTweaponSliders();
$('o-tweapon').addEventListener('change', () => { S.tweapon = $('o-tweapon').value; save(); loadTweaponSliders(); });
$('o-tcd').addEventListener('input', () => {
  const v = Number($('o-tcd').value); $('v-o-tcd').textContent = v;
  S.wtune[S.tweapon] = Object.assign({}, S.wtune[S.tweapon], { cd: v }); save();
  if (sim) sim.setWeaponParam(S.tweapon, 'cd', v);
});
$('o-treload').addEventListener('input', () => {
  const v = Number($('o-treload').value); $('v-o-treload').textContent = v;
  S.wtune[S.tweapon] = Object.assign({}, S.wtune[S.tweapon], { reload: v }); save();
  if (sim) sim.setWeaponParam(S.tweapon, 'reload', v);
});
$('o-treset').addEventListener('click', () => {
  S.speed = DEFAULTS.speed; S.jumpv = DEFAULTS.jumpv; S.wtune = {}; save();
  $('o-speed').value = S.speed; $('v-o-speed').textContent = S.speed;
  $('o-jumpv').value = S.jumpv; $('v-o-jumpv').textContent = S.jumpv;
  loadTweaponSliders();
  if (sim) {
    sim.setParam('speed', S.speed); sim.setParam('jumpV', S.jumpv);
    for (const k of WEAPON_IDS) { sim.setWeaponParam(k, 'cd', WEAPONS[k].cd); sim.setWeaponParam(k, 'reload', WEAPONS[k].reload); }
  }
});
for (const k of ['color', 'outline', 'len', 'thick', 'gap', 'dot', 'dotsize', 'ring', 'ringr', 'ringw', 'hit', 'hitlen', 'hitw']) bindSetting('x-' + k, k, S.x);
$('x-reset').addEventListener('click', () => {
  S.x = Object.assign({}, DEFAULTS.x); save();
  for (const k in S.x) { const el = $('x-' + k); if (el) { el.value = S.x[k]; const v = $('v-x-' + k); if (v) v.textContent = el.value; } }
  drawPreview();
});
function drawPreview() {
  const c = $('xprev'), ctx = c.getContext('2d');
  drawCross(ctx, c.width, c.height, S.x, 0.65, { kind: (Math.floor(performance.now() / 900) % 2) ? 'kill' : 'hit', a: 1 });
}
setInterval(() => { if (menuOpen) drawPreview(); }, 450);
$('btn-play').addEventListener('click', () => lockPointer());
function lockPointer() { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
canvas.addEventListener('click', () => { if (!locked) lockPointer(); });
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  showMenu(!locked);
  if (!locked) { netFireHeld = false; const me = sim && sim.players.get('me'); if (me) me.input.fire = false; }
});

// ---------- controles ----------
let sim = null;
const keys = {};
// ---------- multiplayer: estado de rede ----------
let socket = null, netMode = false, myPid = null, room3d = null;
let netYaw = 0, netPitch = 0, netFireHeld = false, netInputT = 0, netRecvT = 0, netInterval = 130;
document.addEventListener('mousemove', (e) => {
  if (!locked || !sim) return;
  const s = S.sens * 0.0012;
  if (netMode) {
    netYaw += e.movementX * s;
    netPitch = Math.max(-1.35, Math.min(1.35, netPitch - e.movementY * s * (S.invert === '1' ? -1 : 1)));
    return;
  }
  const me = sim.players.get('me'); if (!me) return;
  me.yaw += e.movementX * s;
  me.pitch = Math.max(-1.35, Math.min(1.35, me.pitch - e.movementY * s * (S.invert === '1' ? -1 : 1)));
});
canvas.addEventListener('mousedown', (e) => {
  if (!locked || e.button !== 0) return;
  if (netMode) { netFireHeld = true; return; }
  const me = sim.players.get('me'); if (me) me.input.fire = true;
});
window.addEventListener('mouseup', (e) => {
  if (e.button !== 0) return;
  if (netMode) { netFireHeld = false; return; }
  if (sim) { const me = sim.players.get('me'); if (me) me.input.fire = false; }
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
let wheelT = 0;
window.addEventListener('wheel', (e) => { // rodinha: troca de arma
  if (!locked) return;
  e.preventDefault();
  const now = performance.now(); if (now - wheelT < 110) return; wheelT = now;
  if (netMode) { if (socket) socket.emit('3d_action', { t: 'cycle', dir: e.deltaY > 0 ? 1 : -1 }); return; }
  sim.cycleWeapon(sim.players.get('me'), e.deltaY > 0 ? 1 : -1);
}, { passive: false });
window.addEventListener('keydown', (e) => {
  if (e.code === 'Tab') { e.preventDefault(); $('board').style.display = 'block'; renderBoard(); return; }
  if (!locked || !sim) return;
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  const me = sim.players.get('me'); if (!me) return;
  if (e.code === 'KeyV') { S.cam = S.cam === '1' ? '3' : '1'; $('o-cam').value = S.cam; save(); return; }
  if (netMode) {
    if (!socket) return;
    if (e.code === 'Space') socket.emit('3d_action', { t: 'jump' });
    else if (e.code === 'KeyR') socket.emit('3d_action', { t: 'reload' });
    else if (e.code === 'Digit1') socket.emit('3d_action', { t: 'weapon', w: 'primary' });
    else if (e.code === 'Digit2') socket.emit('3d_action', { t: 'weapon', w: 'potion' });
    else if (e.code === 'Digit3') socket.emit('3d_action', { t: 'weapon', w: 'knife' });
    else if (e.code === 'Digit4') socket.emit('3d_action', { t: 'weapon', w: 'nade' });
    else if (e.code === 'Digit5') socket.emit('3d_action', { t: 'weapon', w: 'smoke' });
    return;
  }
  if (e.code === 'Space') sim.jump(me);
  else if (e.code === 'KeyR') sim.reload(me);
  else if (e.code === 'Digit1') sim.setWeapon(me, 'primary');
  else if (e.code === 'Digit2') sim.setWeapon(me, 'potion');
  else if (e.code === 'Digit3') sim.setWeapon(me, 'knife');
  else if (e.code === 'Digit4') sim.setWeapon(me, 'nade');
  else if (e.code === 'Digit5') sim.setWeapon(me, 'smoke');
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'Tab') $('board').style.display = 'none'; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; $('board').style.display = 'none'; });

// ---------- placar (Tab) ----------
function renderBoard() {
  if (!sim) return;
  let html = '';
  for (const tm of ['A', 'B']) {
    const list = [...sim.players.values()].filter((p) => p.team === tm).sort((a, b) => b.k - a.k || a.d - b.d);
    const tk = list.reduce((s, p) => s + p.k, 0);
    html += `<h3 class="t${tm}">${tm === 'A' ? 'Time Azul' : 'Time Vermelho'} — ${tk} abates</h3><table><thead><tr><th>Jogador</th><th>Abates</th><th>Mortes</th><th>Assist.</th><th>K/D</th></tr></thead><tbody>`;
    for (const p of list) html += `<tr class="${p.id === 'me' ? 'me' : ''} ${p.alive ? '' : 'dead'}"><td>${esc(p.name)}${p.alive ? '' : ' 💀'}</td><td>${p.k}</td><td>${p.d}</td><td>${p.a}</td><td>${(p.k / Math.max(1, p.d)).toFixed(2)}</td></tr>`;
    html += '</tbody></table>';
  }
  $('board-body').innerHTML = html;
}

// ---------- HUD ----------
const SLOT_NAMES = { primary: '1', potion: '2', knife: '3', nade: '4', smoke: '5' };
function hud(me) {
  let h = ''; for (let i = 0; i < P.lives; i++) h += `<span class="${i < me.lives && me.alive ? '' : 'lost'}">❤️</span>`;
  $('h-lives').innerHTML = h;
  const w = sim.WEAPONS[me.primary];
  if (me.weapon === 'primary') { $('h-ammo').textContent = me.reloadUntil ? 'recarregando...' : `${me.ammo[me.primary]}/${w.mag}`; $('h-mags').textContent = `· pentes ${me.mags[me.primary]}`; }
  else if (me.weapon === 'knife') { $('h-ammo').textContent = 'FACA'; $('h-mags').textContent = ''; }
  else if (me.weapon === 'potion') { $('h-ammo').textContent = 'POÇÃO'; $('h-mags').textContent = '· clique para beber'; }
  else { $('h-ammo').textContent = me.weapon === 'nade' ? 'GRANADA' : 'FUMAÇA'; $('h-mags').textContent = '· clique para jogar'; }
  $('h-weapon').textContent = me.weapon === 'primary' ? w.name : '';
  const dj = sim.time >= me.djReadyAt;
  $('h-jump').innerHTML = dj ? '🦘 Pulo duplo <b style="color:#86efac">PRONTO</b> (Espaço 2x)' : `🦘 Pulo duplo em ${Math.ceil(me.djReadyAt - sim.time)}s`;
  const slot = (k, name, off) => `<div class="slot ${me.weapon === k ? 'on' : ''} ${off ? 'off' : ''}"><b>${SLOT_NAMES[k]}</b>${name}</div>`;
  $('slots').innerHTML = slot('primary', w.name.split(' ')[0]) + slot('potion', `Poção ×${me.potions}`, !me.potions || me.lives >= P.lives) + slot('knife', 'Faca') + slot('nade', `Granada ×${me.nades}`, !me.nades) + slot('smoke', `Fumaça ×${me.smokes}`, !me.smokes);
  if (!me.alive) {
    const killer = [...sim.players.values()].find((p) => me.lastHitBy[p.id] && Math.abs(me.lastHitBy[p.id] - me.deadAt) < 0.05);
    $('dead').style.display = 'block';
    $('dead').innerHTML = `Você foi eliminado${killer ? ' por <span class="t' + killer.team + '">' + esc(killer.name) + '</span>' : ''}<small>renascendo em ${Math.max(0, Math.ceil(me.respawnAt - sim.time))}s</small>`;
  } else $('dead').style.display = 'none';
  // indicador de granada inimiga: distância em metros e seta de direção pra correr
  let nearest = null, best = 1e9;
  for (const g of sim.nades) {
    if (g.smoke || g.team === me.team) continue;
    const d = Math.hypot(g.x - me.x, g.z - me.z);
    if (d < best) { best = d; nearest = g; }
  }
  const bw = $('bombwarn');
  if (nearest && me.alive && best < 700) {
    const ang = Math.atan2(nearest.z - me.z, nearest.x - me.x) - me.yaw;
    const arrow = ['⬆️', '↖️', '⬅️', '↙️', '⬇️', '↘️', '➡️', '↗️'][Math.round((((ang + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2)) * 8) % 8];
    bw.style.display = 'block';
    bw.innerHTML = `<span class="arrow">${arrow}</span>💣 granada a ${Math.round(best / 10)}m — corra!`;
  } else bw.style.display = 'none';
}
function feed(html) {
  const d = document.createElement('div'); d.innerHTML = html; $('feed').prepend(d);
  setTimeout(() => d.remove(), 4500);
  while ($('feed').children.length > 5) $('feed').lastChild.remove();
}
const WICON = { lancador: '🔫', estilingue: '🪃', mao: '✊', arco: '🏹', disco: '🥏', knife: '🔪', nade: '💣' };

// ---------- jogo ----------
let prevPos = new Map(), acc = 0, last = performance.now(), fpsN = 0, fpsT = performance.now();
function newGame() {
  netMode = false;
  for (const a of avatars.values()) a.remove(); avatars.clear();
  for (const pool of [bulletMeshes, nadeMeshes, smokeMeshes, tombMeshes, pickupMeshes]) { for (const m of pool.values()) scene.remove(m); pool.clear(); }
  buildMap(S.map);
  const isTestRoom = S.map === 'teste', map = MAPS[S.map];
  sim = new Sim3D(mapWalls, CFG.mapWidth, CFG.mapHeight, {
    godMode: isTestRoom || S.test === '1',
    params: { speed: S.speed, jumpV: S.jumpv },
    weapons: S.wtune,
    hazard: map ? map.hazard : null,
    portalMap: (map && map.portals) ? S.map : null,
    cfg: CFG,
    portalPairs: window.__portalPairs || null,
    ceilingY: CEILING_Y[S.map] || null,
    lavaPools: window.__lavaPools || null,
    lamps: window.__lampPositions || null
  });
  sim.addPlayer({ id: 'me', name: 'Você', team: 'A', primary: S.weapon });
  const n = isTestRoom ? 0 : Number(S.bots), names = BOTS.randomNames(n);
  for (let i = 0; i < n; i++) sim.addPlayer({ id: 'bot' + i, name: names[i], team: 'B', bot: true, level: S.level });
  prevPos = new Map();
}
const lerp = (a, b, k) => a + (b - a) * k;

// ---------- multiplayer: entra numa partida em rede (dados vêm do servidor, sem física local) ----------
function enterNetMatch(mapId) {
  for (const a of avatars.values()) a.remove(); avatars.clear();
  for (const pool of [bulletMeshes, nadeMeshes, smokeMeshes, tombMeshes, pickupMeshes]) { for (const m of pool.values()) scene.remove(m); pool.clear(); }
  buildMap(mapId);
  sim = new Sim3D(mapWalls, CFG.mapWidth, CFG.mapHeight, {});
  prevPos = new Map();
  netYaw = 0; netPitch = 0; netFireHeld = false;
  netRecvT = 0; netInterval = 130;
}
const netRemapId = (id) => (id != null && id === myPid ? 'me' : id);
function netRemapEvent(e) {
  const r = Object.assign({}, e);
  if (r.id != null) r.id = netRemapId(r.id);
  if (r.by != null) r.by = netRemapId(r.by);
  if (r.killer != null) r.killer = netRemapId(r.killer);
  if (r.victim != null) r.victim = netRemapId(r.victim);
  return r;
}
// aplica um snapshot do servidor no "sim" local (espelho de dados, sem calcular física aqui)
function applySnapshot(snap, evs) {
  if (!sim) return;
  const now = performance.now();
  const newPrev = new Map();
  for (const p of sim.players.values()) newPrev.set(p.id, [p.x, p.y, p.z]);
  for (const b of sim.bullets) newPrev.set('b' + b.id, [b.x, b.y, b.z]);
  for (const g of sim.nades) newPrev.set('n' + g.id, [g.x, g.y, g.z]);
  prevPos = newPrev;
  sim.time = snap.time;
  const newPlayers = new Map();
  for (const sp of snap.players) {
    const id = netRemapId(sp.id);
    const p = {
      id, name: sp.name, team: sp.team, bot: sp.bot,
      x: sp.x, y: sp.y, z: sp.z, vx: sp.vx, vy: sp.vy, vz: sp.vz,
      yaw: sp.yaw, pitch: sp.pitch, lives: sp.lives, alive: sp.alive,
      weapon: sp.weapon, primary: sp.primary, grounded: sp.grounded,
      ammo: { [sp.primary]: sp.ammo }, mags: { [sp.primary]: sp.mags },
      reloadUntil: sp.reloadUntil, nades: sp.nades, smokes: sp.smokes, potions: sp.potions,
      djReadyAt: sp.djReadyAt, k: sp.k, d: sp.d, a: sp.a, charge0: sp.charge0, fireReady: sp.fireReady,
      protectUntil: sp.protectUntil, respawnAt: sp.respawnAt, deadAt: sp.deadAt, lastHitBy: sp.lastHitBy || {},
      input: { fwd: 0, side: 0, fire: false }
    };
    if (id === 'me') { p.yaw = netYaw; p.pitch = netPitch; }
    newPlayers.set(id, p);
  }
  sim.players = newPlayers;
  sim.bullets = snap.bullets;
  sim.nades = snap.nades;
  sim.smokes = snap.smokes;
  sim.tombs = snap.tombs;
  sim.pickups = snap.pickups;
  sim.hazard = snap.hazard; sim.sandK = snap.sandK; sim.lavaActive = snap.lavaActive; sim.lightOn = snap.lightOn;
  sim.lamps = snap.lamps; sim.lavaPools = snap.lavaPools;
  const prevRecvT = netRecvT; netRecvT = now;
  if (prevRecvT) netInterval = Math.max(60, Math.min(400, now - prevRecvT));
  for (const e of evs || []) handleEvent(netRemapEvent(e), now);
}

function frame(now) {
  const dtR = Math.min(0.1, (now - last) / 1000);
  acc += dtR; last = now;
  const me = sim.players.get('me');
  if (!me) { requestAnimationFrame(frame); return; } // multiplayer: ainda não estou numa partida (na sala de espera)
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), sd = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  me.input.fwd = locked ? f : 0; me.input.side = locked ? sd : 0;
  if (!locked) me.input.fire = false;
  if (netMode) {
    me.yaw = netYaw; me.pitch = netPitch;
    if (locked && socket && now - netInputT > 50) {
      netInputT = now;
      socket.emit('3d_input', { fwd: me.input.fwd, side: me.input.side, fire: netFireHeld, yaw: netYaw, pitch: netPitch });
    }
  } else {
    while (acc >= STEP) {
      prevPos = new Map();
      for (const p of sim.players.values()) prevPos.set(p.id, [p.x, p.y, p.z]);
      for (const b of sim.bullets) prevPos.set('b' + b.id, [b.x, b.y, b.z]);
      for (const g of sim.nades) prevPos.set('n' + g.id, [g.x, g.y, g.z]);
      for (const e of sim.step(STEP)) handleEvent(e, now);
      acc -= STEP;
    }
  }
  const k = netMode ? Math.min(1, (now - netRecvT) / netInterval) : acc / STEP;
  const ip = (id, o) => { const p0 = prevPos.get(id); return p0 ? [lerp(p0[0], o.x, k), lerp(p0[1], o.y, k), lerp(p0[2], o.z, k)] : [o.x, o.y, o.z]; };
  const firstPerson = S.cam === '1';
  // tempestade de areia (deserto): fecha o fog pra reduzir a visibilidade de verdade
  if (sim.hazard === 'sand' && scene.fog) {
    const sk = sim.sandK || 0;
    scene.fog.color.set(0xd8b878);
    scene.fog.near = lerp(1400, 120, sk); scene.fog.far = lerp(4200, 700, sk);
  }
  // sala escura: a luz apaga e acende sozinha
  if (sim.hazard === 'dark') { hemi.intensity = sim.lightOn ? 1.3 : 0.04; sun.intensity = sim.lightOn ? 2.3 : 0.01; }
  // cidade à noite: cada poste liga/desliga conforme foi atirado ou não
  if (sim.lamps && sim.lamps.length === lampLights.length) {
    for (let i = 0; i < lampLights.length; i++) {
      const on = sim.time >= sim.lamps[i].offUntil;
      lampLights[i].light.intensity = on ? 2.4 : 0;
      lampLights[i].bulb.material.color.set(on ? 0xffe9a8 : 0x33302a);
    }
  }
  // vulcão: a lava pulsa e machuca quando está "ativa"
  if (lavaGlow.length) {
    const on = sim.lavaActive;
    for (const l of lavaGlow) {
      l.mesh.material.opacity = on ? 0.75 + Math.sin(now / 140) * 0.15 : 0.25;
      l.light.intensity = on ? 3 : 0.4;
    }
  }

  // bonecos (o corpo some quando morre; fica a lápide)
  for (const p of sim.players.values()) {
    let a = avatars.get(p.id);
    if (!a) { a = new Avatar(p); avatars.set(p.id, a); }
    const [x, y, z] = ip(p.id, p);
    a.root.position.set(x, y, z);
    a.model.rotation.y = Math.atan2(Math.cos(p.yaw), Math.sin(p.yaw));
    const sc = sim.radius(p) / P.radius;
    a.model.scale.setScalar(a.baseScale * sc); a.ring.scale.setScalar(sc);
    a.root.visible = p.alive && !(p.id === 'me' && firstPerson) && !(sim.time < p.protectUntil && Math.floor(now / 100) % 2 === 0);
    a.update(p, sim, dtR, now);
  }
  // áreas de reabastecimento (granada/fumaça e poção)
  for (const u of sim.pickups) {
    let m = pickupMeshes.get(u.id);
    if (!m) { m = makePickup(u); scene.add(m); pickupMeshes.set(u.id, m); }
    const ready = sim.time >= u.cdUntil;
    m.material.opacity = ready ? 0.55 + Math.sin(now / 260) * 0.15 : 0.12;
    m.position.y = 0.6;
  }
  // lápides
  const tseen = new Set();
  for (const t of sim.tombs) {
    tseen.add(t.id);
    let m = tombMeshes.get(t.id); if (!m) { m = makeTomb(t); scene.add(m); tombMeshes.set(t.id, m); }
    const rise = Math.min(1, (sim.time - t.t0) / 0.35), sink = Math.min(1, (t.until - sim.time) / 0.8);
    m.position.y = t.y - 40 * (1 - Math.min(rise, sink));
  }
  for (const [id, m] of tombMeshes) if (!tseen.has(id)) { scene.remove(m); tombMeshes.delete(id); }
  // balas
  const bseen = new Set();
  for (const b of sim.bullets) {
    bseen.add(b.id);
    let m = bulletMeshes.get(b.id); if (!m) { m = makeBullet(b); scene.add(m); bulletMeshes.set(b.id, m); }
    const [x, y, z] = ip('b' + b.id, b); m.position.set(x, y, z);
    if (m.userData.orient) m.lookAt(x + b.vx, y + b.vy, z + b.vz);
    if (m.userData.spin) m.rotation.y += dtR * 20;
  }
  for (const [id, m] of bulletMeshes) if (!bseen.has(id)) { scene.remove(m); bulletMeshes.delete(id); }
  // granadas
  const nseen = new Set();
  for (const g of sim.nades) {
    nseen.add(g.id);
    let m = nadeMeshes.get(g.id); if (!m) { m = makeNade(g); scene.add(m); nadeMeshes.set(g.id, m); }
    const [x, y, z] = ip('n' + g.id, g); m.position.set(x, y, z); m.rotation.x = g.spin;
    if (m.userData.led) m.userData.led.visible = Math.floor(now / (sim.time - g.t0 > P.nadeFuse - 0.6 ? 70 : 200)) % 2 === 0;
  }
  for (const [id, m] of nadeMeshes) if (!nseen.has(id)) { scene.remove(m); nadeMeshes.delete(id); }
  // fumaça
  const sseen = new Set();
  for (const s of sim.smokes) {
    sseen.add(s.id);
    let m = smokeMeshes.get(s.id); if (!m) { m = makeSmoke(s); scene.add(m); smokeMeshes.set(s.id, m); }
    updateSmoke(m, s, sim, dtR);
  }
  for (const [id, m] of smokeMeshes) if (!sseen.has(id)) { scene.remove(m); smokeMeshes.delete(id); }
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i], t = (now - e.t0) / e.d;
    if (t >= 1) {
      scene.remove(e.m); scene.remove(e.light);
      if (e.ring) scene.remove(e.ring); if (e.sparks) scene.remove(e.sparks);
      effects.splice(i, 1); continue;
    }
    e.m.scale.setScalar(e.r * 0.55 * (0.35 + t * 0.9)); e.m.material.opacity = 0.95 * (1 - t) ** 1.3; e.light.intensity = 7 * (1 - t);
    if (e.ring) { e.ring.scale.setScalar(e.r * 1.4 * (0.15 + t * 1.1)); e.ring.material.opacity = 0.85 * (1 - t); }
    if (e.sparks) {
      const dt2 = 1 / 60, pos = e.sparkPos;
      for (let k = 0; k < e.sparkVel.length; k++) {
        const v = e.sparkVel[k]; v[1] -= 500 * dt2;
        pos[k * 3] += v[0] * dt2; pos[k * 3 + 1] += v[1] * dt2; pos[k * 3 + 2] += v[2] * dt2;
      }
      e.sparks.geometry.attributes.position.needsUpdate = true;
      e.sparks.material.opacity = Math.max(0, 1 - t * 1.2);
    }
  }

  // câmera
  const meA = avatars.get('me');
  const [mx, my, mz] = ip('me', me);
  const dx = Math.cos(me.pitch) * Math.cos(me.yaw), dy = Math.sin(me.pitch), dz = Math.cos(me.pitch) * Math.sin(me.yaw);
  camera.fov = S.fov;
  if (!me.alive) { // morto: olha a própria lápide de cima
    camera.position.set(mx - dx * 160, my + 170, mz - dz * 160);
    camera.lookAt(mx, my + 20, mz);
    me.camPos = null;
  } else if (firstPerson) {
    const moving = me.grounded && Math.hypot(me.vx, me.vz) > 30;
    camera.position.set(mx, my + P.eye * (sim.radius(me) / P.radius > 0.9 ? 1 : 0.8) + (moving ? Math.sin(now / 90) * 1.4 : 0), mz);
    camera.lookAt(camera.position.x + dx, camera.position.y + dy, camera.position.z + dz);
    me.camPos = null;
  } else { // 3ª pessoa: atrás do ombro, sem atravessar muro
    const hx = mx, hy = my + 60, hz = mz, rx = -Math.sin(me.yaw), rz = Math.cos(me.yaw);
    const want = 150;
    const bx = -dx, by = -dy * 0.9 + 0.18, bz = -dz, bl = Math.hypot(bx, by, bz);
    const hit = sim.raycast(hx + rx * 30, hy, hz + rz * 30, bx / bl, by / bl, bz / bl, want, 'me');
    const d = Math.max(20, Math.min(want, hit - 12));
    camera.position.set(hx + rx * 30 + bx / bl * d, Math.max(10, hy + by / bl * d), hz + rz * 30 + bz / bl * d);
    camera.lookAt(camera.position.x + dx, camera.position.y + dy, camera.position.z + dz);
    me.camPos = [camera.position.x, camera.position.y, camera.position.z];
  }
  camera.updateProjectionMatrix();
  // arma na tela
  const wkey = me.weapon === 'primary' ? me.primary : me.weapon;
  for (const k2 in VIEW) VIEW[k2].visible = firstPerson && me.alive && k2 === wkey;
  const vg = VIEW[wkey];
  if (vg) {
    const w = sim.WEAPONS[me.primary], reloading = me.weapon === 'primary' && me.reloadUntil;
    const charge = me.charge0 ? Math.min(1, (sim.time - me.charge0) / (w.charge || 1)) : 0;
    const base = wkey === 'arco' ? [6, -6, -24] : [8, -8, -22];
    vg.position.set(base[0], base[1] - (reloading ? 7 : 0) + swing * 5, base[2] + kick * 3 - swing * 6);
    vg.rotation.x = kick * 0.25 + (reloading ? 0.7 : 0) - swing * 0.6;
    vg.traverse((o) => {
      if (o.userData.string) o.position.z = charge * 7;
      if (o.userData.arrow) { o.position.z = -8 + charge * 7; o.visible = me.ammo[me.primary] > 0 && !reloading; }
      if (o.userData.pull) o.position.z = 1.5 + (me.fireReady > sim.time ? 0 : 0);
    });
  }
  kick = Math.max(0, kick - dtR * 7); swing = Math.max(0, swing - dtR * 4);

  // mira
  const w = sim.WEAPONS[me.primary];
  let prog = 1;
  if (me.weapon === 'primary' && me.reloadUntil) prog = 1 - (me.reloadUntil - sim.time) / w.reload;
  else if (me.fireReady > sim.time) prog = 1 - (me.fireReady - sim.time) / (me.weapon === 'primary' ? w.cd : me.weapon === 'knife' ? P.knifeCd : 0.6);
  if (me.charge0) prog = Math.min(1, (sim.time - me.charge0) / w.charge);
  let hm = null;
  if (hitMark) { const a = 1 - (now - hitMark.t) / 280; if (a > 0) hm = { kind: hitMark.kind, a }; else hitMark = null; }
  $('cross').style.display = me.alive && !menuOpen ? 'block' : 'none';
  drawCross(crossCtx, 240, 240, S.x, Math.max(0, Math.min(1, prog)), hm);
  hud(me);
  if ($('board').style.display === 'block' && Math.floor(now / 250) !== Math.floor((now - dtR * 1000) / 250)) renderBoard();
  renderer.render(scene, camera);
  fpsN++;
  if (now - fpsT >= 500) { $('fps').textContent = Math.round(fpsN * 1000 / (now - fpsT)); fpsN = 0; fpsT = now; }
  requestAnimationFrame(frame);
}

function handleEvent(e, now) {
  addEffect(e, now);
  const a = avatars.get(e.id), p = e.id && sim.players.get(e.id);
  if (e.type === 'shot' && a) { const s = SHOOT_ANIM[e.weapon]; a.trigger(s[0], s[1], now); if (e.id === 'me') { kick = 1; if (e.weapon === 'mao' || e.weapon === 'disco') swing = 1; } }
  if (e.type === 'knife' && a) { a.trigger('1H_Melee_Attack_Stab', 1.9, now); if (e.id === 'me') swing = 1; }
  if ((e.type === 'nade_throw' || e.type === 'smoke_throw') && a) { a.trigger('Throw', 1.7, now); if (e.id === 'me') swing = 1; }
  if (e.type === 'drink' && a) { a.trigger('Use_Item', 1.1, now); if (e.id === 'me') swing = 1; }
  if (e.type === 'pickup' && e.id === 'me') feed(e.kind === 'potion' ? '🧪 Poção reabastecida' : '💣 Granada/fumaça reabastecida');
  if (e.type === 'tornado_start') feed('🌪️ Furacão! Segura ou foge do centro dele');
  if (e.type === 'tornado_end') feed('🌪️ O furacão jogou todo mundo longe');
  if (e.type === 'sand_start') feed('🏜️ Tempestade de areia — visibilidade caindo');
  if (e.type === 'sand_end') feed('🏜️ A tempestade passou');
  if (e.type === 'lava_on') feed('🌋 A lava subiu!');
  if (e.type === 'lava_off') feed('🌋 A lava baixou');
  if (e.type === 'light_off') feed('🕯️ A luz apagou...');
  if (e.type === 'light_on') feed('💡 A luz voltou');
  if (e.type === 'lamp_off') feed('💡 Um poste apagou');
  if (e.type === 'jump' && a) a.legsOnce('Jump_Start', 1.6, now);
  if (e.type === 'djump' && a) a.legsOnce('Jump_Full_Short', 1.6, now);
  if (e.type === 'land' && a) a.legsOnce('Jump_Land', 1.8, now);
  if (e.type === 'hit') { const v = avatars.get(e.victim); if (v) v.trigger('Hit_A', 1.5, now); if (e.by === 'me') hitMark = { kind: 'hit', t: now }; }
  if (e.type === 'kill') {
    if (e.killer === 'me') hitMark = { kind: 'kill', t: now };
    const k = sim.players.get(e.killer), v = sim.players.get(e.victim);
    feed(`${k ? `<span class="t${k.team}">${esc(k.name)}</span>` : ''} ${WICON[e.weapon] || '💥'} <span class="t${v ? v.team : 'B'}">${esc(v ? v.name : '?')}</span>`);
  }
  void p;
}

showMenu(true);
loadModels().then(() => {
  $('loading').textContent = 'Pronto! Clique em Jogar';
  newGame();
  requestAnimationFrame(frame);
}).catch((e) => { $('loading').textContent = 'Erro ao carregar os bonecos: ' + e.message; console.error(e); });
window.__pb3d = { get sim() { return sim; }, lock: (v) => { locked = v; showMenu(!v); }, keys };
