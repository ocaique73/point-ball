// Demo 3D FPS do Point Ball feita com Three.js.
// A lógica do jogo é a MESMA do 2D (shared/game.js + shared/bots.js); aqui mudam a câmera (1ª/3ª pessoa),
// os controles (mouse preso na tela, WASD relativo para onde você olha) e o desenho (bonecos KayKit animados).
// Coordenadas: x do jogo = x do 3D, y do jogo = z do 3D, altura = y.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const $ = (id) => document.getElementById(id);
const G = window.RC_GAME, BOTS = window.RC_BOTS, MAPS = window.RC_MAPS.MAPS;
// sem os efeitos especiais dos mapas nesta demo (só arena, tiro, bomba, fumaça, faca e pulo)
const cfg = Object.assign({}, window.RC_CONFIG.DEFAULT_CONFIG, {
  sandInterval: 1e6, stormInterval: 1e6, tornadoInterval: 1e6, lightsInterval: 1e6, meteorInterval: 1e6, lavaInterval: 1e6
});
const TEAM = { A: 0x3b82f6, B: 0xef4444 };
const STEP = 1 / 60;
const EYE = 56;             // altura dos olhos (unidades do jogo; o boneco tem ~64)
const SHOT_Y = 40;          // altura da bala (peito)
const WALL_H = 120, BORDER_H = 150;
const CHAR_H = 64;          // altura do boneco

// ---------- renderizador ----------
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 1, 2, 8000);
scene.add(camera);
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.3));
const sun = new THREE.DirectionalLight(0xffffff, 2.3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -950, right: 950, top: 700, bottom: -700, near: 10, far: 4000 });
sun.shadow.bias = -0.0006;
scene.add(sun, sun.target);

const mat = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, flatShading: true, roughness: 0.85, metalness: 0 }, extra || {}));
const GEO = { bullet: new THREE.IcosahedronGeometry(1, 1), bomb: new THREE.IcosahedronGeometry(8, 1), puff: new THREE.IcosahedronGeometry(1, 1), boom: new THREE.IcosahedronGeometry(1, 2) };
const MAT = {
  bomb: mat(0x1f2937), smokeBomb: mat(0x94a3b8),
  smoke: new THREE.MeshLambertMaterial({ color: 0xcbd5e1, transparent: true, opacity: 0.92, depthWrite: false }),
  boom: new THREE.MeshBasicMaterial({ color: 0xffa640, transparent: true, opacity: 0.8, depthWrite: false })
};
const bulletMat = {
  A: new THREE.MeshStandardMaterial({ color: 0x93c5fd, emissive: 0x3b82f6, emissiveIntensity: 2.5 }),
  B: new THREE.MeshStandardMaterial({ color: 0xfca5a5, emissive: 0xef4444, emissiveIntensity: 2.5 })
};

// ---------- mapa ----------
let mapGroup = null, mapWalls = [];
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
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
function wallTexture(color) { // tijolinhos simples para dar noção de profundidade em 1ª pessoa
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 3;
  for (let y = 0; y <= 128; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }
  for (let y = 0; y < 128; y += 32) for (let x = (y / 32) % 2 ? 32 : 0; x <= 128; x += 64) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
function buildMap(mapId) {
  if (mapGroup) scene.remove(mapGroup);
  const map = MAPS[mapId], th = map.theme, W = cfg.mapWidth, H = cfg.mapHeight;
  mapGroup = new THREE.Group();
  scene.background = new THREE.Color(map.space ? 0x03040b : 0x9cc7ee);
  scene.fog = map.space ? null : new THREE.Fog(0x9cc7ee, 1400, 4200);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: groundTexture(th, mapId.length * 97), roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(W / 2, 0, H / 2); ground.receiveShadow = true;
  mapGroup.add(ground);
  const wtex = wallTexture(th.wall), btex = wallTexture(th.border);
  mapWalls = G.buildWalls(mapId, cfg, 0);
  for (const R of mapWalls) {
    if (R.space) continue;
    const hgt = R.border ? BORDER_H : WALL_H;
    const t = (R.border ? btex : wtex).clone(); t.needsUpdate = true; t.repeat.set(Math.max(R.w, R.h) / 64, hgt / 64);
    const side = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
    const top = mat(th.wallEdge);
    const box = new THREE.Mesh(new THREE.BoxGeometry(R.w, hgt, R.h), [side, side, top, top, side, side]);
    box.position.set(R.x + R.w / 2, hgt / 2, R.y + R.h / 2);
    box.castShadow = true; box.receiveShadow = true;
    mapGroup.add(box);
  }
  const rnd = seeded(mapId.length * 31 + 5), walls = G.buildWalls(mapId, cfg, 0);
  for (let i = 0; i < 40; i++) {
    const x = 40 + rnd() * (W - 80), z = 40 + rnd() * (H - 80);
    if (!G.circleFree(x, z, 30, walls, cfg)) continue;
    let obj = null;
    if (th.deco === 'rocks') { obj = new THREE.Mesh(new THREE.DodecahedronGeometry(6 + rnd() * 9, 0), mat(0x9a6b3c)); obj.position.set(x, 3, z); obj.rotation.set(rnd() * 3, rnd() * 3, 0); }
    else if (th.deco === 'snow') { obj = new THREE.Mesh(new THREE.SphereGeometry(14 + rnd() * 10, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xffffff)); obj.position.set(x, 0, z); obj.scale.y = 0.5; }
    else if (th.deco === 'tree') { const k = 0.7 + rnd() * 0.5; obj = new THREE.Mesh(new THREE.IcosahedronGeometry(16 * k, 0), mat(0x3f7d3a)); obj.position.set(x, 10 * k, z); }
    else if (th.deco === 'panels') { obj = new THREE.Mesh(new THREE.BoxGeometry(16, 3, 16), mat(0x475569, { emissive: 0x0ea5e9, emissiveIntensity: 0.3 })); obj.position.set(x, 1.5, z); }
    if (obj) { obj.castShadow = obj.receiveShadow = true; mapGroup.add(obj); }
  }
  if (map.space) {
    const pts = [], rs = seeded(9);
    for (let i = 0; i < 2500; i++) { const a = rs() * Math.PI * 2, b = rs() * Math.PI - Math.PI / 2, r = 3500; pts.push(W / 2 + Math.cos(a) * Math.cos(b) * r, Math.sin(b) * r, H / 2 + Math.sin(a) * Math.cos(b) * r); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    mapGroup.add(new THREE.Points(gg, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false })));
  }
  scene.add(mapGroup);
  sun.position.set(W / 2 - 600, 1500, H / 2 + 800); sun.target.position.set(W / 2, 0, H / 2);
}

// ---------- bonecos KayKit (animados) ----------
// time azul = Rogue de capuz, time vermelho = Rogue sem capuz (os dois com cor do time)
const MODEL_FILES = { A: '/demo3d/models/Rogue_Hooded.glb', B: '/demo3d/models/Rogue.glb' };
const BASE = {};                       // gltf carregado de cada time
const UPPER = new Set(['spine', 'chest', 'head', 'upperarm.l', 'upperarm.r', 'lowerarm.l', 'lowerarm.r', 'wrist.l', 'wrist.r', 'hand.l', 'hand.r', 'handslot.l', 'handslot.r', 'elbowIK.l', 'elbowIK.r', 'handIK.l', 'handIK.r']);
const CLIPS = {};                      // nome -> { full, upper, lower }
function splitClips(anims) {
  for (const clip of anims) {
    if (CLIPS[clip.name]) continue;
    const bone = (t) => t.name.split('.').slice(0, -1).join('.');
    const up = clip.tracks.filter((t) => UPPER.has(bone(t))), low = clip.tracks.filter((t) => !UPPER.has(bone(t)));
    CLIPS[clip.name] = { full: clip, upper: new THREE.AnimationClip(clip.name + '_U', clip.duration, up), lower: new THREE.AnimationClip(clip.name + '_L', clip.duration, low) };
  }
}
async function loadModels() {
  const loader = new GLTFLoader();
  for (const tm of ['A', 'B']) {
    const g = await loader.loadAsync(MODEL_FILES[tm]);
    BASE[tm] = g; splitClips(g.animations);
  }
}
function nameSprite(name, team) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const g = cv.getContext('2d');
  g.font = '800 30px Segoe UI, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(name, 128, 32);
  g.fillStyle = team === 'A' ? '#93c5fd' : '#fca5a5'; g.fillText(name, 128, 32);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, sizeAttenuation: false }));
  sp.scale.set(0.16, 0.04, 1); // tamanho fixo na tela
  return sp;
}

class Avatar {
  constructor(p, name, isMe) {
    this.id = p.id; this.team = p.tm; this.isMe = isMe;
    const src = BASE[p.tm];
    this.root = new THREE.Group();
    this.model = SkeletonUtils.clone(src.scene);
    // tamanho: deixa o boneco com CHAR_H de altura
    const box = new THREE.Box3().setFromObject(this.model), h = box.max.y - box.min.y;
    this.baseScale = CHAR_H / (h || 1);
    this.model.scale.setScalar(this.baseScale);
    // cor do time por cima da textura + só as armas que usamos
    const tint = new THREE.Color(TEAM[p.tm]);
    this.slot = {};
    this.model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true;
        o.material = o.material.clone();
        o.material.color.lerp(tint, 0.62);
      }
      if (['1H_Crossbow', 'Knife', 'Throwable', '2H_Crossbow', 'Knife_Offhand'].includes(o.name)) this.slot[o.name] = o;
    });
    this.slot['2H_Crossbow'] && (this.slot['2H_Crossbow'].visible = false);
    this.slot.Knife_Offhand && (this.slot.Knife_Offhand.visible = false);
    this.root.add(this.model);
    // anel do time no chão
    this.ring = new THREE.Mesh(new THREE.RingGeometry(20, 25, 28), new THREE.MeshBasicMaterial({ color: TEAM[p.tm], transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.8;
    this.root.add(this.ring);
    if (!isMe) { this.label = nameSprite(name, p.tm); this.label.position.y = CHAR_H + 18; this.root.add(this.label); }
    scene.add(this.root);
    // animação em 2 camadas: pernas (andar/correr/pular) e braços (mirar/atirar/recarregar/jogar)
    this.mixer = new THREE.AnimationMixer(this.model);
    this.cur = { lower: null, upper: null }; this.curName = { lower: '', upper: '' };
    this.oneShot = null; // ação de braço que está tocando uma vez só
    this.dead = false; this.jumpState = '';
    this.play('lower', 'Idle'); this.play('upper', '1H_Ranged_Aiming');
  }
  play(layer, name, fade = 0.15, once = false, speed = 1) {
    if (this.curName[layer] === name && !once) return;
    const clip = CLIPS[name] && CLIPS[name][layer];
    if (!clip) return;
    const a = this.mixer.clipAction(clip);
    a.enabled = true; a.setEffectiveTimeScale(speed); a.setEffectiveWeight(1);
    if (once) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } else a.setLoop(THREE.LoopRepeat, Infinity);
    a.reset().fadeIn(fade).play();
    const old = this.cur[layer];
    if (old && old !== a) old.fadeOut(fade);
    this.cur[layer] = a; this.curName[layer] = name;
    return a;
  }
  // gatilhos de ação (vindos dos eventos do jogo)
  trigger(kind) {
    if (this.dead) return;
    const map = { shot: ['1H_Ranged_Shoot', 1.6], knife: ['1H_Melee_Attack_Stab', 1.8], throw: ['Throw', 1.5], hit: ['Hit_A', 1.4] };
    const m = map[kind]; if (!m) return;
    const a = this.play('upper', m[0], 0.06, true, m[1]);
    if (a) this.oneShot = { name: m[0], until: performance.now() + (CLIPS[m[0]].full.duration / m[1]) * 1000 - 60, kind };
    if (kind === 'throw' && this.slot.Throwable) this.slot.Throwable.visible = true;
  }
  update(p, dt, vx, vy, now) {
    // armas nas mãos
    const gun = p.w === 1;
    if (this.slot['1H_Crossbow']) this.slot['1H_Crossbow'].visible = gun;
    if (this.slot.Knife) this.slot.Knife.visible = !gun;
    const throwing = this.oneShot && this.oneShot.kind === 'throw' && now < this.oneShot.until;
    if (this.slot.Throwable) this.slot.Throwable.visible = !!throwing;
    if (!p.al) { // morreu
      if (!this.dead) { this.dead = true; this.oneShot = null; this.play('lower', 'Death_A', 0.1, true); this.play('upper', 'Death_A', 0.1, true); }
      this.ring.visible = false; if (this.label) this.label.visible = false;
      this.mixer.update(dt); return;
    }
    if (this.dead) { this.dead = false; this.curName.lower = this.curName.upper = ''; }
    this.ring.visible = true; if (this.label) this.label.visible = true;
    // pernas
    const fx = p.fx, fy = p.fy, sp = Math.hypot(vx, vy);
    if (p.jz >= 0) {
      const phase = p.jz < 0.2 ? 'Jump_Start' : p.jz > 0.85 ? 'Jump_Land' : 'Jump_Idle';
      this.play('lower', phase, 0.08, phase !== 'Jump_Idle');
    } else if (sp > 25) {
      const fwd = (vx * fx + vy * fy) / sp, side = (vx * -fy + vy * fx) / sp;
      const k = sp / cfg.playerSpeed;
      if (fwd > 0.5) this.play('lower', 'Running_A', 0.15, false, 1.1 * k);
      else if (fwd < -0.5) this.play('lower', 'Walking_Backwards', 0.15, false, 1.5 * k);
      else this.play('lower', side > 0 ? 'Running_Strafe_Right' : 'Running_Strafe_Left', 0.15, false, 1.1 * k);
    } else this.play('lower', 'Idle', 0.2);
    // braços: ação única tocando > recarregando > mirando (arma) / acompanhando o corpo (faca)
    if (this.oneShot && now >= this.oneShot.until) this.oneShot = null;
    if (!this.oneShot) {
      if (gun && p.rl > 0) this.play('upper', '1H_Ranged_Reload', 0.12, false, CLIPS['1H_Ranged_Reload'].full.duration / cfg.reloadTime);
      else if (gun) this.play('upper', p.jz >= 0 ? 'Jump_Idle' : '1H_Ranged_Aiming', 0.15);
      else this.play('upper', this.curName.lower || 'Idle', 0.15, false, this.cur.lower ? this.cur.lower.getEffectiveTimeScale() : 1);
    }
    this.mixer.update(dt);
  }
  remove() { scene.remove(this.root); }
}
const avatars = new Map();

// ---------- tiros, bombas, fumaça, efeitos ----------
const bulletMeshes = new Map(), bombMeshes = new Map(), smokeMeshes = new Map(), effects = [];
function syncPool(pool, list, create, update) {
  const seen = new Set();
  for (const it of list) {
    seen.add(it[0]);
    let m = pool.get(it[0]);
    if (!m) { m = create(it); scene.add(m); pool.set(it[0], m); }
    update(m, it);
  }
  for (const [id, m] of pool) if (!seen.has(id)) { scene.remove(m); pool.delete(id); }
}
function makeSmoke() {
  const g = new THREE.Group(), rnd = seeded(Math.floor(Math.random() * 1e6));
  for (let i = 0; i < 18; i++) {
    const s = new THREE.Mesh(GEO.puff, MAT.smoke);
    const a = rnd() * Math.PI * 2, d = rnd() * 0.65;
    s.position.set(Math.cos(a) * d, 0.2 + rnd() * 0.45, Math.sin(a) * d);
    s.scale.setScalar(0.35 + rnd() * 0.25);
    g.add(s);
  }
  return g;
}
function addEffect(e) {
  if (e.type === 'explode') {
    const m = new THREE.Mesh(GEO.boom, MAT.boom.clone());
    m.position.set(e.x, 10, e.y); scene.add(m);
    effects.push({ m, t0: performance.now(), d: 450, r: cfg.bombRadius });
  }
}

// ---------- arma na tela (1ª pessoa) ----------
const viewGun = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 22), mat(0x374151, { roughness: 0.4, metalness: 0.5 }));
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 10, 8), mat(0x111827, { metalness: 0.7, roughness: 0.3 }));
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.8, -15);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(3.2, 7, 4), mat(0x1f2937)); grip.position.set(0, -4.5, 5); grip.rotation.x = 0.3;
  const tank = new THREE.Mesh(new THREE.SphereGeometry(3.4, 10, 8), new THREE.MeshStandardMaterial({ color: 0x60a5fa, emissive: 0x1d4ed8, emissiveIntensity: 0.6, roughness: 0.3 }));
  tank.position.set(0, 3.8, 1);
  viewGun.add(body, barrel, grip, tank);
  const knife = new THREE.Mesh(new THREE.BoxGeometry(1, 3, 18), mat(0xd1d5db, { metalness: 0.8, roughness: 0.25 }));
  knife.position.set(0, 0, -6); knife.visible = false; viewGun.userData.knife = knife; viewGun.userData.gunParts = [body, barrel, grip, tank];
  viewGun.add(knife);
  viewGun.scale.setScalar(0.7);
  viewGun.position.set(8, -8, -22);
  camera.add(viewGun);
}
let recoil = 0, swing = 0;

// ---------- controles (mouse preso na tela) ----------
let yaw = 0, pitch = 0, locked = false;
const keys = { KeyW: 0, KeyS: 0, KeyA: 0, KeyD: 0, ArrowUp: 0, ArrowDown: 0, ArrowLeft: 0, ArrowRight: 0 };
let fireDown = false;
$('start').addEventListener('click', () => canvas.requestPointerLock());
canvas.addEventListener('click', () => { if (!locked) canvas.requestPointerLock(); });
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; $('start').style.display = locked ? 'none' : 'grid'; if (!locked) fireDown = false; });
document.addEventListener('mousemove', (e) => {
  if (!locked) return;
  const s = Number($('o-sens').value);
  yaw += e.movementX * s;
  pitch = Math.max(-1.2, Math.min(1.2, pitch - e.movementY * s));
});
canvas.addEventListener('mousedown', (e) => {
  if (!locked) return;
  if (e.button === 0) fireDown = true;
  if (e.button === 2) { const t = throwTarget(); if (t) game.throwBomb('me', t.x, t.y); }
});
window.addEventListener('mouseup', (e) => { if (e.button === 0) fireDown = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
let wheelT = 0;
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (!locked || performance.now() - wheelT < 400) return;
  wheelT = performance.now();
  const t = throwTarget(); if (t) game.throwBomb('me', t.x, t.y, 'smoke');
}, { passive: false });
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'SELECT') return;
  if (e.code in keys) { keys[e.code] = 1; e.preventDefault(); return; }
  if (e.repeat) return;
  if (e.code === 'Space') { e.preventDefault(); game.requestJump('me'); }
  else if (e.code === 'KeyR') game.requestReload('me');
  else if (e.code === 'Digit1') game.setWeapon('me', 'gun');
  else if (e.code === 'Digit2') game.setWeapon('me', 'knife');
  else if (e.code === 'KeyV' || e.code === 'KeyC') $('o-cam').value = $('o-cam').value === '1' ? '3' : '1';
});
window.addEventListener('keyup', (e) => { if (e.code in keys) keys[e.code] = 0; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = 0; fireDown = false; });
// onde a bomba/fumaça cai: onde a mira encosta no chão (limitado ao alcance)
function throwTarget() {
  const me = game.players.get('me'); if (!me) return null;
  const fx = Math.cos(yaw), fy = Math.sin(yaw);
  let d = cfg.bombRange;
  if (pitch < -0.02) d = Math.min(cfg.bombRange, EYE / Math.tan(-pitch));
  return { x: me.x + fx * d, y: me.y + fy * d };
}

// ---------- jogo (mesma lógica do 2D) ----------
let game;
function newGame() {
  for (const a of avatars.values()) a.remove();
  avatars.clear();
  buildMap($('o-map').value);
  game = new G.Game(cfg, { mode: 'sandbox', mapId: $('o-map').value });
  const me = game.addPlayer({ id: 'me', name: 'Você', team: 'A' });
  yaw = me.team === 'A' ? 0 : Math.PI; pitch = -0.05;
  const n = Number($('o-bots').value), names = BOTS.randomNames(n);
  for (let i = 0; i < n; i++) game.addPlayer({ id: 'bot' + i, name: names[i], team: 'B', bot: true }).botLevel = $('o-level').value;
  prev = null; cur = null;
}
for (const id of ['o-map', 'o-bots', 'o-level']) $(id).addEventListener('change', (e) => { newGame(); e.target.blur(); });
for (const id of ['o-cam', 'o-sens']) $(id).addEventListener('change', (e) => e.target.blur());
$('o-shadow').addEventListener('change', (e) => { renderer.shadowMap.enabled = e.target.value === '1'; scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)); }); e.target.blur(); });

function hud(me) {
  if (!me) return;
  let h = ''; for (let i = 0; i < cfg.lives; i++) h += `<span class="${i < me.l ? '' : 'lost'}">❤️</span>`;
  $('h-lives').innerHTML = h;
  $('h-bombs').innerHTML = `<span class="${me.bo ? '' : 'lost'}">💣×${me.bo}</span> <span class="${me.so ? '' : 'lost'}">💨×${me.so}</span>`;
  $('h-ammo').textContent = me.w === 2 ? 'FACA' : (me.rl > 0 ? 'recarregando...' : me.am + '/' + cfg.magSize);
  $('h-mags').textContent = me.w === 2 ? '' : '· pentes ' + me.mg;
  $('h-jump').innerHTML = me.j ? '🦘 Pulo <b style="color:#86efac">PRONTO</b> (Espaço)' : `🦘 Pulo em ${Math.ceil(me.jc)}s`;
  $('h-kda').textContent = `Abates ${me.st[0]} · Mortes ${me.st[1]} · Assist. ${me.st[2]}`;
  $('dead').style.display = me.al ? 'none' : 'block';
  // mira: o anel em volta mostra o tiro carregando
  const k = me.w === 1 && me.fc > 0 ? 1 - me.fc / cfg.fireCooldown : 1;
  $('ring').style.borderColor = k >= 1 ? 'rgba(255,255,255,.35)' : `rgba(255,204,51,${0.25 + k * 0.5})`;
}
let hitFlash = 0;

// ---------- loop: simula 60 vezes por segundo e desenha na taxa do monitor (interpolando) ----------
let acc = 0, last = performance.now(), prev = null, cur = null, fpsN = 0, fpsT = performance.now();
const lerp = (a, b, k) => a + (b - a) * k;
const tmpV = new THREE.Vector3();

function frame(now) {
  const dtR = Math.min(0.1, (now - last) / 1000);
  acc += dtR; last = now;
  // controles do seu boneco: anda relativo para onde a câmera olha
  const fx = Math.cos(yaw), fy = Math.sin(yaw);
  const fwd = (keys.KeyW || keys.ArrowUp) - (keys.KeyS || keys.ArrowDown), str = (keys.KeyD || keys.ArrowRight) - (keys.KeyA || keys.ArrowLeft);
  game.setInput('me', { mx: fx * fwd - fy * str, my: fy * fwd + fx * str, fire: fireDown && locked });
  game.setAim('me', fx, fy);
  while (acc >= STEP) {
    for (const p of game.players.values()) if (p.bot) BOTS.think(game, p, STEP);
    for (const e of game.step(STEP)) {
      addEffect(e);
      const a = avatars.get(e.id);
      if (a && e.type === 'shot') { a.trigger('shot'); if (e.id === 'me') recoil = 1; }
      if (a && e.type === 'knife') { a.trigger('knife'); if (e.id === 'me') swing = 1; }
      if (a && (e.type === 'bomb_throw' || e.type === 'smoke_throw')) a.trigger('throw');
      if (e.type === 'hit') { const v = avatars.get(e.victim); if (v) v.trigger('hit'); if (e.by === 'me') hitFlash = 1; }
      if (e.type === 'kill') {
        if (e.killer === 'me') hitFlash = 1;
        const k = game.players.get(e.killer), v = game.players.get(e.victim);
        $('feed').style.display = ''; clearTimeout(window.__feedT); window.__feedT = setTimeout(() => ($('feed').style.display = 'none'), 3000);
        $('feed').innerHTML = `<span class="t${k ? k.team : 'A'}">${k ? k.name : '?'}</span> ${e.weapon === 'knife' ? '🔪' : e.weapon === 'bomb' ? '💣' : '🔫'} <span class="t${v ? v.team : 'B'}">${v ? v.name : '?'}</span>`;
      }
    }
    prev = cur; cur = game.snapshot();
    acc -= STEP;
  }
  if (!cur) cur = game.snapshot();
  const k = prev ? acc / STEP : 1;
  const prevP = new Map((prev ? prev.p : []).map((p) => [p.id, p]));
  const prevB = new Map((prev ? prev.b : []).map((b) => [b[0], b]));
  const firstPerson = $('o-cam').value === '1';

  // bonecos
  const seen = new Set();
  let meX = 0, meZ = 0, meAir = 0, meP = null;
  for (const p of cur.p) {
    seen.add(p.id);
    let a = avatars.get(p.id);
    if (!a) { const q = game.players.get(p.id); a = new Avatar(p, q ? q.name : p.id, p.id === 'me'); avatars.set(p.id, a); }
    const o = prevP.get(p.id) || p;
    const big = Math.hypot(p.x - o.x, p.y - o.y) > 150;
    const x = big ? p.x : lerp(o.x, p.x, k), z = big ? p.y : lerp(o.y, p.y, k);
    const air = p.jz >= 0 ? Math.sin(Math.PI * p.jz) * 110 : 0;
    a.root.position.set(x, air, z);
    const face = p.id === 'me' ? Math.atan2(fx, fy) : Math.atan2(p.fx, p.fy);
    a.model.rotation.y = face;
    a.model.scale.setScalar(a.baseScale * (p.r / cfg.playerRadius));
    a.ring.scale.setScalar(p.r / cfg.playerRadius);
    a.root.visible = !(p.sp && Math.floor(now / 100) % 2 === 0) && !(p.id === 'me' && firstPerson);
    a.update(p, dtR, (p.x - o.x) / STEP, (p.y - o.y) / STEP, now);
    if (p.id === 'me') { meX = x; meZ = z; meAir = air; meP = p; }
  }
  for (const [id, a] of avatars) if (!seen.has(id)) { a.remove(); avatars.delete(id); }

  syncPool(bulletMeshes, cur.b, (b) => { const m = new THREE.Mesh(GEO.bullet, bulletMat[b[4] === 'A' ? 'A' : 'B']); m.scale.setScalar(cfg.bulletRadius * 1.2); return m; }, (m, b) => {
    const o = prevB.get(b[0]) || b, big = Math.hypot(b[1] - o[1], b[2] - o[2]) > 150;
    m.position.set(big ? b[1] : lerp(o[1], b[1], k), SHOT_Y, big ? b[2] : lerp(o[2], b[2], k));
  });
  syncPool(bombMeshes, cur.bm || [], (b) => new THREE.Mesh(GEO.bomb, b[6] ? MAT.smokeBomb : MAT.bomb), (m, b) => {
    m.position.set(b[1], 10 + Math.sin(Math.PI * Math.min(1, b[3])) * 140, b[2]); m.rotation.x += 0.2;
  });
  syncPool(smokeMeshes, cur.sm || [], () => makeSmoke(), (m, s) => {
    const R = cfg.smokeRadius * (0.35 + 0.65 * Math.min(1, s[3] * 1.4));
    m.position.set(s[1], 0, s[2]); m.scale.set(R, R * 0.75, R);
    for (const c of m.children) c.material.opacity = Math.min(0.94, s[3] * 1.2);
  });
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i], t = (now - e.t0) / e.d;
    if (t >= 1) { scene.remove(e.m); effects.splice(i, 1); continue; }
    e.m.scale.setScalar(e.r * (0.4 + t * 0.7)); e.m.material.opacity = 0.8 * (1 - t);
  }

  // câmera: 1ª pessoa (nos olhos) ou 3ª pessoa (atrás e um pouco acima do ombro)
  const dir = tmpV.set(Math.cos(pitch) * fx, Math.sin(pitch), Math.cos(pitch) * fy);
  const deadDrop = meP && !meP.al ? -30 : 0;
  if (firstPerson) {
    const bob = meP && meP.al && Math.hypot(meP.x - (prevP.get('me') || meP).x, meP.y - (prevP.get('me') || meP).y) > 0.5 ? Math.sin(now / 90) * 1.6 : 0;
    camera.position.set(meX, EYE + meAir + bob + deadDrop, meZ);
    camera.fov = 75;
  } else {
    const back = 150, up = 88, side = 34;
    let cx = meX - fx * back * Math.cos(pitch) + -fy * side, cz = meZ - fy * back * Math.cos(pitch) + fx * side;
    // câmera não atravessa parede: se tiver muro no caminho, chega mais perto
    for (let t = 1; t > 0.15; t -= 0.05) {
      const tx = meX + (cx - meX) * t, tz = meZ + (cz - meZ) * t;
      if (!G.lineBlocked(meX, meZ, tx, tz, mapWalls) && G.circleFree(tx, tz, 10, mapWalls, Object.assign({}, cfg, { wallThickness: 0 }))) { cx = tx; cz = tz; break; }
      if (t <= 0.2) { cx = tx; cz = tz; }
    }
    camera.position.set(cx, Math.max(12, up + meAir - Math.sin(pitch) * back * 0.9), cz);
    camera.fov = 70;
  }
  camera.updateProjectionMatrix();
  camera.lookAt(camera.position.x + dir.x * 100, camera.position.y + dir.y * 100, camera.position.z + dir.z * 100);
  // arma na tela (só 1ª pessoa): recuo ao atirar, balanço da faca
  viewGun.visible = firstPerson && meP && meP.al;
  if (meP) {
    viewGun.userData.knife.visible = meP.w === 2;
    for (const g of viewGun.userData.gunParts) g.visible = meP.w === 1;
    const reloadDip = meP.rl > 0 ? 6 : 0;
    viewGun.position.set(8, -8 - reloadDip + (meP.rl > 0 ? Math.sin(now / 120) : 0), -22 + recoil * 3);
    viewGun.rotation.set(recoil * 0.25 + (meP.rl > 0 ? 0.6 : 0), swing * -0.9, swing * 0.4);
  }
  recoil = Math.max(0, recoil - dtR * 7); swing = Math.max(0, swing - dtR * 5);
  hitFlash = Math.max(0, hitFlash - dtR * 4);
  $('cross').classList.toggle('hit', hitFlash > 0.05);
  hud(meP);
  renderer.render(scene, camera);
  fpsN++;
  if (now - fpsT >= 500) { $('fps').textContent = Math.round(fpsN * 1000 / (now - fpsT)); fpsN = 0; fpsT = now; }
  requestAnimationFrame(frame);
}

loadModels().then(() => {
  $('loading').textContent = 'Pronto!';
  newGame();
  requestAnimationFrame(frame);
}).catch((e) => { $('loading').textContent = 'Erro ao carregar os bonecos: ' + e.message; console.error(e); });
window.__pb3d = { get game() { return game; }, setView: (y, p) => { yaw = y; pitch = p; }, lock: (v) => { locked = v; $('start').style.display = v ? 'none' : 'grid'; }, fire: (v) => { fireDown = v; } };
