// Demo 3D do Point Ball feita com Three.js.
// A lógica é a MESMA do jogo 2D (shared/game.js + shared/bots.js): aqui só trocamos o desenho por 3D.
// Coordenadas: x do jogo = x do 3D, y do jogo = z do 3D, altura = y.
import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const G = window.RC_GAME, BOTS = window.RC_BOTS, MAPS = window.RC_MAPS.MAPS;
// sem efeitos de mapa nesta demo (só arena, tiro, bomba, fumaça, pulo)
const cfg = Object.assign({}, window.RC_CONFIG.DEFAULT_CONFIG, {
  sandInterval: 1e6, stormInterval: 1e6, tornadoInterval: 1e6, lightsInterval: 1e6, meteorInterval: 1e6, lavaInterval: 1e6
});
const TEAM = { A: 0x3b82f6, B: 0xef4444 };
const TEAM_LIGHT = { A: 0x93c5fd, B: 0xfca5a5 };
const STEP = 1 / 60;

// ---------- renderizador ----------
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 10, 6000);
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const hemi = new THREE.HemisphereLight(0xffffff, 0x445566, 1.4);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -950, right: 950, top: 650, bottom: -650, near: 10, far: 3000 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

// ---------- materiais / formas reaproveitadas (low-poly: flatShading) ----------
const mat = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, flatShading: true, roughness: 0.85, metalness: 0 }, extra || {}));
const GEO = {
  body: new THREE.CylinderGeometry(0.8, 0.95, 1.25, 8),
  head: new THREE.IcosahedronGeometry(0.55, 0),
  eye: new THREE.BoxGeometry(0.14, 0.18, 0.08),
  gun: new THREE.BoxGeometry(1.1, 0.26, 0.26),
  knife: new THREE.BoxGeometry(0.9, 0.08, 0.2),
  ring: new THREE.RingGeometry(1.05, 1.3, 24),
  bullet: new THREE.IcosahedronGeometry(1, 1),
  bomb: new THREE.IcosahedronGeometry(9, 1),
  puff: new THREE.IcosahedronGeometry(1, 1),
  boom: new THREE.IcosahedronGeometry(1, 2)
};
const MAT = {
  eye: mat(0x111111), gun: mat(0x1f2937, { roughness: 0.4, metalness: 0.6 }), knife: mat(0xd1d5db, { roughness: 0.3, metalness: 0.8 }),
  dead: mat(0x4b5563, { transparent: true, opacity: 0.45 }), bomb: mat(0x1f2937), smokeBomb: mat(0x94a3b8),
  smoke: new THREE.MeshLambertMaterial({ color: 0xcbd5e1, transparent: true, opacity: 0.9, depthWrite: false }),
  boom: new THREE.MeshBasicMaterial({ color: 0xffa640, transparent: true, opacity: 0.8, depthWrite: false })
};

// ---------- mapa ----------
let mapGroup = null, walls = [];
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function groundTexture(th, W, H, seed) {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 640;
  const g = cv.getContext('2d'), rnd = seeded(seed);
  g.fillStyle = th.ground; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = th.ground2;
  for (let i = 0; i < 260; i++) { g.beginPath(); g.ellipse(rnd() * cv.width, rnd() * cv.height, 4 + rnd() * 18, 2 + rnd() * 8, rnd() * 3, 0, Math.PI * 2); g.fill(); }
  if (th.deco === 'panels') {
    g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 2;
    for (let x = 0; x < cv.width; x += 51) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, cv.height); g.stroke(); }
    for (let y = 0; y < cv.height; y += 51) { g.beginPath(); g.moveTo(0, y); g.lineTo(cv.width, y); g.stroke(); }
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}
function buildMap(mapId) {
  if (mapGroup) scene.remove(mapGroup);
  const map = MAPS[mapId], th = map.theme, W = cfg.mapWidth, H = cfg.mapHeight;
  mapGroup = new THREE.Group();
  scene.background = new THREE.Color(map.space ? 0x03040b : 0x0b0f17);
  // chão
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: groundTexture(th, W, H, mapId.length * 97), roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(W / 2, 0, H / 2); ground.receiveShadow = true;
  mapGroup.add(ground);
  // muros = caixas (a colisão continua sendo a do jogo 2D)
  walls = G.buildWalls(mapId, cfg, 0);
  const wallMat = mat(th.wall), borderMat = mat(th.border), topMat = mat(th.wallEdge);
  for (const R of walls) {
    if (R.space) continue;
    const hgt = R.border ? 70 : 55;
    const box = new THREE.Mesh(new THREE.BoxGeometry(R.w, hgt, R.h), [R.border ? borderMat : wallMat, R.border ? borderMat : wallMat, topMat, wallMat, R.border ? borderMat : wallMat, R.border ? borderMat : wallMat]);
    box.position.set(R.x + R.w / 2, hgt / 2, R.y + R.h / 2);
    box.castShadow = true; box.receiveShadow = true;
    mapGroup.add(box);
  }
  // decoração low-poly (sem colisão, como no 2D)
  const rnd = seeded(mapId.length * 31 + 5);
  for (let i = 0; i < 40; i++) {
    const x = 40 + rnd() * (W - 80), z = 40 + rnd() * (H - 80);
    if (!G.circleFree(x, z, 30, walls, cfg)) continue;
    let obj;
    if (th.deco === 'rocks') {
      obj = new THREE.Mesh(new THREE.DodecahedronGeometry(6 + rnd() * 8, 0), mat(0x9a6b3c));
      obj.position.set(x, 3, z); obj.rotation.set(rnd() * 3, rnd() * 3, 0);
    } else if (th.deco === 'snow') {
      obj = new THREE.Group();
      const pile = new THREE.Mesh(new THREE.SphereGeometry(14 + rnd() * 10, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xffffff));
      obj.add(pile); obj.position.set(x, 0, z); obj.scale.y = 0.5;
    } else if (th.deco === 'tree') {
      obj = new THREE.Group();
      const k = 0.7 + rnd() * 0.5;
      const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(16 * k, 0), mat(0x3f7d3a));
      bush.position.y = 10 * k; obj.add(bush); obj.position.set(x, 0, z);
    } else if (th.deco === 'panels') {
      obj = new THREE.Mesh(new THREE.BoxGeometry(16, 3, 16), mat(0x475569, { emissive: 0x0ea5e9, emissiveIntensity: 0.25 }));
      obj.position.set(x, 1.5, z);
    }
    if (obj) { obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); mapGroup.add(obj); }
  }
  if (map.space) { // estrelas em volta da nave
    const pts = [], rs = seeded(9);
    for (let i = 0; i < 1500; i++) pts.push((rs() - 0.5) * 6000 + W / 2, -200 - rs() * 800, (rs() - 0.5) * 5000 + H / 2);
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    mapGroup.add(new THREE.Points(gg, new THREE.PointsMaterial({ color: 0xffffff, size: 3, sizeAttenuation: false })));
  }
  scene.add(mapGroup);
  sun.position.set(W / 2 - 500, 1400, H / 2 + 700); sun.target.position.set(W / 2, 0, H / 2);
}

// ---------- personagens ----------
const avatars = new Map();
function nameSprite(name, isMe) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const g = cv.getContext('2d');
  g.font = '800 30px Segoe UI, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(name, 128, 32);
  g.fillStyle = isMe ? '#ffcc33' : '#ffffff'; g.fillText(name, 128, 32);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(90, 22, 1); sp.renderOrder = 10;
  return sp;
}
function makeAvatar(p, isMe) {
  const root = new THREE.Group();          // posição no mapa
  const model = new THREE.Group();         // gira para onde mira, escala com a vida
  const bodyMat = mat(TEAM[p.tm]), headMat = mat(TEAM_LIGHT[p.tm]);
  const body = new THREE.Mesh(GEO.body, bodyMat); body.position.y = 0.62;
  const head = new THREE.Mesh(GEO.head, headMat); head.position.y = 1.6;
  const e1 = new THREE.Mesh(GEO.eye, MAT.eye), e2 = new THREE.Mesh(GEO.eye, MAT.eye);
  e1.position.set(0.5, 1.65, 0.2); e2.position.set(0.5, 1.65, -0.2);
  const gun = new THREE.Mesh(GEO.gun, MAT.gun); gun.position.set(0.95, 0.85, 0.35);
  const knife = new THREE.Mesh(GEO.knife, MAT.knife); knife.position.set(0.95, 0.85, 0.35); knife.visible = false;
  for (const m of [body, head, gun, knife]) { m.castShadow = true; m.receiveShadow = true; }
  model.add(body, head, e1, e2, gun, knife);
  const ring = new THREE.Mesh(GEO.ring, new THREE.MeshBasicMaterial({ color: TEAM[p.tm], transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.6;
  const label = nameSprite(p.name || p.id, isMe); label.position.y = 78;
  root.add(model, ring, label);
  scene.add(root);
  return { root, model, body, head, gun, knife, ring, label, bodyMat, headMat, team: p.tm };
}
function removeAvatar(id) { const a = avatars.get(id); if (a) { scene.remove(a.root); avatars.delete(id); } }

// ---------- tiros, bombas, fumaça, efeitos ----------
const bulletMeshes = new Map(), bombMeshes = new Map(), smokeMeshes = new Map(), effects = [];
const bulletMat = { A: new THREE.MeshStandardMaterial({ color: 0x93c5fd, emissive: 0x3b82f6, emissiveIntensity: 2 }), B: new THREE.MeshStandardMaterial({ color: 0xfca5a5, emissive: 0xef4444, emissiveIntensity: 2 }) };
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
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Mesh(GEO.puff, MAT.smoke);
    const a = rnd() * Math.PI * 2, d = rnd() * 0.6;
    s.position.set(Math.cos(a) * d, 0.25 + rnd() * 0.35, Math.sin(a) * d);
    s.scale.setScalar(0.35 + rnd() * 0.25); s.userData.base = s.scale.x;
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

// ---------- jogo (mesma lógica do 2D) ----------
let game, mapId = 'deserto';
function newGame() {
  for (const id of [...avatars.keys()]) removeAvatar(id);
  mapId = $('o-map').value;
  buildMap(mapId);
  game = new G.Game(cfg, { mode: 'sandbox', mapId });
  game.addPlayer({ id: 'me', name: 'Você', team: 'A' });
  const n = Number($('o-bots').value), names = BOTS.randomNames(n);
  for (let i = 0; i < n; i++) {
    const b = game.addPlayer({ id: 'bot' + i, name: names[i], team: 'B', bot: true });
    b.botLevel = $('o-level').value;
  }
  prev = null; cur = null;
}
for (const id of ['o-map', 'o-bots', 'o-level']) $(id).addEventListener('change', (e) => { newGame(); e.target.blur(); });
$('o-cam').addEventListener('change', (e) => e.target.blur());
$('o-shadow').addEventListener('change', (e) => { renderer.shadowMap.enabled = e.target.value === '1'; scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); e.target.blur(); });

// mira: raio do mouse até o chão
const ray = new THREE.Raycaster(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), mouseN = new THREE.Vector2(), hitPt = new THREE.Vector3();
let mouse = null;
window.addEventListener('mousemove', (e) => { mouse = { x: e.clientX, y: e.clientY }; });
function mouseWorld() {
  if (!mouse) return null;
  mouseN.set((mouse.x / window.innerWidth) * 2 - 1, -(mouse.y / window.innerHeight) * 2 + 1);
  ray.setFromCamera(mouseN, camera);
  return ray.ray.intersectPlane(groundPlane, hitPt) ? { x: hitPt.x, y: hitPt.z } : null;
}
function throwTarget() {
  const me = game.players.get('me'), w = mouseWorld();
  if (!me || !w) return null;
  let dx = w.x - me.x, dy = w.y - me.y; const d = Math.hypot(dx, dy);
  if (d > cfg.bombRange) { dx *= cfg.bombRange / d; dy *= cfg.bombRange / d; }
  return { x: me.x + dx, y: me.y + dy };
}
PBHud.bindKeys({
  mouseEl: canvas,
  enabled: () => true,
  onChange: (k) => game.setInput('me', k),
  onWeapon: (w) => game.setWeapon('me', w === 2 ? 'knife' : 'gun'),
  onReload: () => game.requestReload('me'),
  onJump: () => game.requestJump('me'),
  onBomb: (down) => { if (!down) { const t = throwTarget(); if (t) game.throwBomb('me', t.x, t.y); } },
  onSmoke: () => { const t = throwTarget(); if (t) game.throwBomb('me', t.x, t.y, 'smoke'); }
});
const CAMS = ['tilt', 'top', 'low'];
window.addEventListener('keydown', (e) => { if (e.code === 'KeyC') { const s = $('o-cam'); s.value = CAMS[(CAMS.indexOf(s.value) + 1) % CAMS.length]; } });

// ---------- HUD ----------
function hud(me, s) {
  if (!me) return;
  let h = ''; for (let i = 0; i < cfg.lives; i++) h += `<span class="${i < me.l ? '' : 'lost'}">❤️</span>`;
  $('h-lives').innerHTML = h;
  $('h-bombs').innerHTML = `<span class="${me.bo ? '' : 'lost'}">💣×${me.bo}</span> <span class="${me.so ? '' : 'lost'}">💨×${me.so}</span>`;
  $('h-ammo').textContent = me.w === 2 ? 'FACA' : (me.rl > 0 ? 'recarregando...' : me.am + '/' + cfg.magSize);
  $('h-mags').textContent = me.w === 2 ? '' : '· pentes ' + me.mg;
  $('h-jump').innerHTML = me.j ? '🦘 Pulo <b style="color:#86efac">PRONTO</b> (Espaço)' : `🦘 Pulo em ${Math.ceil(me.jc)}s`;
  $('h-kda').textContent = `Abates ${me.st[0]} · Mortes ${me.st[1]} · Assist. ${me.st[2]}`;
}

// ---------- loop: simula a 60 por segundo e desenha na taxa do monitor (interpolando) ----------
let acc = 0, last = performance.now(), prev = null, cur = null;
let fpsN = 0, fpsT = performance.now();
const camPos = new THREE.Vector3(800, 900, 1100), camLook = new THREE.Vector3(800, 0, 500);
const lerp = (a, b, k) => a + (b - a) * k;
newGame();

function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000); last = now;
  const me0 = game.players.get('me'), w = mouseWorld();
  if (w && me0) game.setAim('me', w.x - me0.x, w.y - me0.y);
  while (acc >= STEP) {
    for (const p of game.players.values()) if (p.bot) BOTS.think(game, p, STEP);
    for (const e of game.step(STEP)) {
      addEffect(e);
      if (e.type === 'kill') {
        const k = game.players.get(e.killer), v = game.players.get(e.victim);
        $('feed').style.display = ''; clearTimeout(window.__feedT); window.__feedT = setTimeout(() => ($('feed').style.display = 'none'), 3000);
        $('feed').innerHTML = `<span class="t${k ? k.team : 'A'}">${k ? k.name : '?'}</span> ${e.weapon === 'knife' ? '🔪' : e.weapon === 'bomb' ? '💣' : '🔫'} <span class="t${v ? v.team : 'B'}">${v ? v.name : '?'}</span>`;
      }
    }
    prev = cur; cur = game.snapshot();
    acc -= STEP;
  }
  if (!cur) cur = game.snapshot();
  const k = prev ? acc / STEP : 1; // quanto do caminho entre o passo anterior e o atual
  const prevP = new Map((prev ? prev.p : []).map((p) => [p.id, p]));
  const prevB = new Map((prev ? prev.b : []).map((b) => [b[0], b]));

  // personagens
  const seen = new Set();
  for (const p of cur.p) {
    seen.add(p.id);
    const q = game.players.get(p.id);
    let a = avatars.get(p.id);
    if (!a) { a = makeAvatar(Object.assign({ name: q && q.name }, p), p.id === 'me'); avatars.set(p.id, a); }
    const o = prevP.get(p.id) || p;
    const big = Math.hypot(p.x - o.x, p.y - o.y) > 150; // renasceu / teletransportou: não desliza
    const x = big ? p.x : lerp(o.x, p.x, k), z = big ? p.y : lerp(o.y, p.y, k);
    const air = p.jz >= 0 ? Math.sin(Math.PI * p.jz) * 110 : 0;
    a.root.position.set(x, air, z);
    const sc = p.r; // raio atual (encolhe ao perder vida)
    a.model.scale.setScalar(sc * (p.jz >= 0 ? 1.12 : 1));
    a.ring.scale.setScalar(sc);
    a.model.rotation.y = -Math.atan2(p.fy, p.fx);
    a.gun.visible = p.w === 1 && p.al; a.knife.visible = p.w === 2 && p.al;
    if (p.w === 2 && p.ka) a.knife.rotation.y = Math.sin(now / 40) * 0.8; else a.knife.rotation.y = 0;
    a.model.rotation.z = p.al ? 0 : Math.PI / 2; // morto: deitado
    a.body.material = p.al ? a.bodyMat : MAT.dead; a.head.material = p.al ? a.headMat : MAT.dead;
    a.root.visible = !(p.sp && Math.floor(now / 100) % 2 === 0); // piscando na proteção
    a.ring.visible = p.al; a.label.visible = p.al;
    a.ring.material.opacity = p.w === 1 && p.fc > 0 ? 0.35 : 0.85; // anel apaga enquanto o tiro carrega
  }
  for (const id of [...avatars.keys()]) if (!seen.has(id)) removeAvatar(id);

  // balas
  syncPool(bulletMeshes, cur.b, (b) => { const m = new THREE.Mesh(GEO.bullet, bulletMat[b[4] === 'me' || b[4] === 'A' ? 'A' : 'B']); m.scale.setScalar(cfg.bulletRadius); return m; }, (m, b) => {
    const o = prevB.get(b[0]) || b, big = Math.hypot(b[1] - o[1], b[2] - o[2]) > 150;
    m.position.set(big ? b[1] : lerp(o[1], b[1], k), 22, big ? b[2] : lerp(o[2], b[2], k));
  });
  // bombas (voam em arco por cima dos muros)
  syncPool(bombMeshes, cur.bm || [], (b) => new THREE.Mesh(GEO.bomb, b[6] ? MAT.smokeBomb : MAT.bomb), (m, b) => {
    m.position.set(b[1], 10 + Math.sin(Math.PI * Math.min(1, b[3])) * 130, b[2]);
    m.rotation.x += 0.2;
  });
  // fumaça: bolas de fumaça que cobrem quem está no meio (inclusive você)
  syncPool(smokeMeshes, cur.sm || [], () => makeSmoke(), (m, s) => {
    const R = cfg.smokeRadius * (0.35 + 0.65 * Math.min(1, s[3] * 1.4));
    m.position.set(s[1], 0, s[2]); m.scale.set(R, R * 0.9, R);
    for (const c of m.children) c.material.opacity = Math.min(0.92, s[3] * 1.2);
  });
  // explosões
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i], t = (now - e.t0) / e.d;
    if (t >= 1) { scene.remove(e.m); effects.splice(i, 1); continue; }
    e.m.scale.setScalar(e.r * (0.4 + t * 0.7)); e.m.material.opacity = 0.8 * (1 - t);
  }

  // câmera segue você (suave)
  const meA = avatars.get('me');
  if (meA) {
    const px = meA.root.position.x, pz = meA.root.position.z, mode = $('o-cam').value;
    const off = mode === 'top' ? [0, 1000, 1] : mode === 'low' ? [0, 360, 470] : [0, 700, 470];
    camPos.lerp(new THREE.Vector3(px + off[0], off[1], pz + off[2]), 0.12);
    camLook.lerp(new THREE.Vector3(px, 0, pz + (mode === 'low' ? -60 : 30)), 0.15);
    camera.position.copy(camPos); camera.lookAt(camLook);
  }
  hud(cur.p.find((p) => p.id === 'me'), cur);
  renderer.render(scene, camera);

  // FPS real (quantos quadros por segundo o monitor está mostrando)
  fpsN++;
  if (now - fpsT >= 500) { $('fps').textContent = Math.round(fpsN * 1000 / (now - fpsT)); fpsN = 0; fpsT = now; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
$('hz').textContent = '(segue o Hz do monitor)';
