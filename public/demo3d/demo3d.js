// Demo 3D FPS do Point Ball (Three.js).
// A simulação 3D (física, armas, bots) fica em sim3d.js; aqui ficam o desenho, os controles, o menu (Esc),
// a mira editável, o placar (Tab) e os bonecos KayKit animados.
// Eixos: x e z no chão (mesmas medidas do mapa 2D), y para cima.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Sim3D, WEAPONS, WEAPON_IDS, P, PORTAL, HOLE, DuneField, CEILING_Y, LAMP, TREE, TORNADO, FROST, METEOR, PLAT, AIM, DRINK } from '/demo3d/sim3d.js';
import { world3D, simOptions, IGLOO, CAVE } from '/demo3d/world3d.js';
import { CHARS, TEAM_PAL, LEATHER, HAIR, HATS, SLOTS, LOOK_DEFAULT, normLook, botLook, dressModel } from '/demo3d/looks3d.js';

const $ = (id) => document.getElementById(id);
const G = window.RC_GAME, BOTS = window.RC_BOTS, MAPS = window.RC_MAPS.MAPS, CFG = window.RC_CONFIG.DEFAULT_CONFIG;
const TEAM = { A: 0x3b82f6, B: 0xef4444 };
const STEP = 1 / 60;
const CHAR_H = P.height;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- configurações (ficam salvas neste navegador) ----------
const DEFAULTS = {
  cam: '1', map: 'deserto', bots: '2', allies: '0', level: 'amador', shadow: '1', fov: 80, weapon: 'arco', sens: 1.6, invert: '0',
  mode: 'tdm', kills: '30', rounds: '3', hill: '100', mtime: '300', kc: '1', sfx: {}, adszoom: '1',
  die: '1', speed: P.speed, jumpv: P.jumpV, tweapon: WEAPON_IDS[0], wtune: {},
  x: { color: '#ffffff', outline: '1', len: 7, thick: 2, gap: 4, dot: '1', dotsize: 2, ring: '1', ringr: 22, ringw: 2, hit: '1', hitlen: 10, hitw: 1 }
};
let S = JSON.parse(JSON.stringify(DEFAULTS));
try { const saved = JSON.parse(localStorage.getItem('pb3d_settings') || 'null'); if (saved) { S = Object.assign(S, saved); S.x = Object.assign({}, DEFAULTS.x, saved.x || {}); S.wtune = Object.assign({}, saved.wtune || {}); } } catch (e) {}
const save = () => { try { localStorage.setItem('pb3d_settings', JSON.stringify(S)); } catch (e) {} };
if (S.mute == null) S.mute = '0';
if (!WEAPON_IDS.includes(S.weapon)) S.weapon = 'arco'; // armas antigas (lançador/disco) saíram
if (!WEAPON_IDS.includes(S.tweapon)) S.tweapon = WEAPON_IDS[0];
S.sfx = Object.assign({}, S.sfx || {});
S.look = normLook(S.look); // roupa do seu personagem
delete S.test;

// ---------- sons (sintetizados, sem arquivo de áudio) ----------
const SFX = (() => {
  let ctx = null, master = null;
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    } catch (e) { ctx = null; }
  }
  function noiseBuf(dur) {
    const n = Math.max(1, Math.floor(ctx.sampleRate * dur)), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    return buf;
  }
  function out(node, opts) {
    if (opts && opts.pan != null && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, opts.pan)); node.connect(p); return p; }
    return node;
  }
  // tom curto: onda + envelope de volume (slideTo = escorrega a nota)
  function tone(freq, dur, type, vol, opts) {
    opts = opts || {};
    const t0 = ctx.currentTime + (opts.delay || 0);
    const osc = ctx.createOscillator(); osc.type = type || 'square'; osc.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), t0 + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t0 + (opts.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    out(osc, opts).connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  // chiado filtrado (type: lowpass / highpass / bandpass; sweep = filtro escorregando)
  function noise(dur, vol, opts) {
    opts = opts || {};
    const t0 = ctx.currentTime + (opts.delay || 0);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf(dur);
    const filt = ctx.createBiquadFilter(); filt.type = opts.type || (opts.lowpass ? 'lowpass' : 'highpass'); filt.frequency.setValueAtTime(opts.freq || 1200, t0);
    if (opts.q) filt.Q.value = opts.q;
    if (opts.sweep) filt.frequency.exponentialRampToValueAtTime(opts.sweep, t0 + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t0 + (opts.attack || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt); out(filt, opts).connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }
  const O = (o, extra) => Object.assign({}, o, extra);
  const LP = (f) => ({ type: 'lowpass', freq: f }), BP = (f, q) => ({ type: 'bandpass', freq: f, q: q || 1.2 }), HP = (f) => ({ type: 'highpass', freq: f });
  // cada som tem várias opções (o Caique escolhe na aba "Sala de teste"); a primeira é a padrão
  const LIB = {
    shot: [
      ['Flecha (vuush grave)', (v, o) => { noise(0.14, 0.4 * v, O(o, BP(700, 0.9))); tone(150, 0.13, 'triangle', 0.28 * v, O(o, { slideTo: 80 })); }],
      ['Corda do arco (tum)', (v, o) => { tone(105, 0.2, 'sawtooth', 0.2 * v, O(o, { slideTo: 70 })); noise(0.08, 0.25 * v, O(o, LP(1100))); }],
      ['Bola de neve (puf)', (v, o) => { noise(0.11, 0.5 * v, O(o, LP(520))); tone(85, 0.11, 'sine', 0.4 * v, O(o, { slideTo: 48 })); }],
      ['Estilingue (tlac)', (v, o) => { tone(240, 0.05, 'square', 0.16 * v, O(o, { slideTo: 110 })); noise(0.07, 0.32 * v, O(o, LP(900))); }],
      ['Grave (bum)', (v, o) => { tone(68, 0.22, 'sine', 0.55 * v, O(o, { slideTo: 38 })); noise(0.1, 0.25 * v, O(o, LP(380))); }],
      ['Sopro (fuu)', (v, o) => noise(0.18, 0.4 * v, O(o, { type: 'bandpass', freq: 1200, sweep: 300, q: 0.8 }))],
      ['Clássico agudo (pew)', (v, o) => tone(620, 0.09, 'square', 0.4 * v, O(o, { slideTo: 160 }))]
    ],
    hit: [
      ['Toc', (v, o) => tone(180, 0.09, 'sine', 0.4 * v, o)],
      ['Tum', (v, o) => tone(120, 0.13, 'sine', 0.45 * v, O(o, { slideTo: 60 }))],
      ['Pá', (v, o) => { noise(0.06, 0.35 * v, O(o, LP(1500))); tone(220, 0.07, 'triangle', 0.25 * v, o); }],
      ['Borracha (boing)', (v, o) => tone(300, 0.12, 'triangle', 0.3 * v, O(o, { slideTo: 150 }))],
      ['Plin', (v, o) => tone(520, 0.1, 'sine', 0.3 * v, O(o, { slideTo: 260 }))]
    ],
    kill: [
      ['Tan-tan', (v, o) => { tone(500, 0.12, 'sawtooth', 0.45 * v, o); tone(760, 0.16, 'sawtooth', 0.35 * v, o); }],
      ['Ding', (v, o) => { tone(880, 0.25, 'sine', 0.35 * v, o); tone(1320, 0.3, 'sine', 0.2 * v, O(o, { delay: 0.05 })); }],
      ['Grave duplo', (v, o) => { tone(220, 0.14, 'triangle', 0.45 * v, o); tone(330, 0.18, 'triangle', 0.4 * v, O(o, { delay: 0.1 })); }],
      ['Sino', (v, o) => { tone(660, 0.5, 'sine', 0.32 * v, o); tone(990, 0.45, 'sine', 0.16 * v, o); }],
      ['Fliperama', (v, o) => tone(400, 0.2, 'square', 0.25 * v, O(o, { slideTo: 1200 }))]
    ],
    jump: [
      ['Pulinho', (v, o) => tone(340, 0.1, 'triangle', 0.28 * v, O(o, { slideTo: 560 }))],
      ['Pulo grave', (v, o) => tone(170, 0.12, 'sine', 0.35 * v, O(o, { slideTo: 290 }))],
      ['Vento', (v, o) => noise(0.13, 0.25 * v, O(o, BP(650)))],
      ['Mola', (v, o) => tone(200, 0.18, 'sine', 0.28 * v, O(o, { slideTo: 700 }))],
      ['Baixinho', (v, o) => noise(0.08, 0.1 * v, O(o, LP(800)))]
    ],
    land: [
      ['Pó', (v, o) => noise(0.06, 0.22 * v, O(o, LP(500)))],
      ['Tum', (v, o) => tone(90, 0.1, 'sine', 0.35 * v, O(o, { slideTo: 50 }))],
      ['Areia', (v, o) => noise(0.09, 0.25 * v, O(o, LP(1300)))],
      ['Pesado', (v, o) => { noise(0.12, 0.3 * v, O(o, LP(300))); tone(60, 0.12, 'sine', 0.3 * v, o); }]
    ],
    knife: [
      ['Corte', (v, o) => noise(0.07, 0.35 * v, O(o, LP(2200)))],
      ['Swish', (v, o) => noise(0.13, 0.35 * v, O(o, { type: 'bandpass', freq: 3000, sweep: 900, q: 1 }))],
      ['Lâmina', (v, o) => { noise(0.05, 0.3 * v, O(o, HP(3000))); tone(900, 0.08, 'triangle', 0.15 * v, O(o, { slideTo: 400 })); }],
      ['Sopro', (v, o) => noise(0.1, 0.3 * v, O(o, LP(900)))]
    ],
    reload: [
      ['Clique', (v, o) => noise(0.04, 0.25 * v, O(o, LP(1800)))],
      ['Clique duplo', (v, o) => { tone(1100, 0.02, 'square', 0.12 * v, o); tone(900, 0.03, 'square', 0.12 * v, O(o, { delay: 0.12 })); }],
      ['Trava', (v, o) => { noise(0.05, 0.3 * v, O(o, LP(1200))); tone(300, 0.06, 'triangle', 0.2 * v, O(o, { delay: 0.05 })); }],
      ['Corda esticando', (v, o) => tone(200, 0.16, 'triangle', 0.2 * v, O(o, { slideTo: 420 }))]
    ],
    throw: [
      ['Arremesso', (v, o) => tone(300, 0.12, 'triangle', 0.28 * v, O(o, { slideTo: 220 }))],
      ['Vuush', (v, o) => noise(0.16, 0.3 * v, O(o, { type: 'bandpass', freq: 1500, sweep: 400, q: 0.8 }))],
      ['Grave', (v, o) => tone(150, 0.15, 'sine', 0.35 * v, O(o, { slideTo: 95 }))],
      ['Ar', (v, o) => noise(0.2, 0.22 * v, O(o, BP(500)))]
    ],
    explode: [
      ['Explosão', (v, o) => noise(0.45, 0.6 * v, O(o, LP(700)))],
      ['Bum grave longo', (v, o) => { noise(0.8, 0.6 * v, O(o, LP(300))); tone(55, 0.7, 'sine', 0.5 * v, O(o, { slideTo: 30 })); }],
      ['Estalo', (v, o) => noise(0.3, 0.55 * v, O(o, LP(2000)))],
      ['Trovão', (v, o) => { noise(1.0, 0.55 * v, O(o, { type: 'lowpass', freq: 900, sweep: 150 })); tone(42, 0.9, 'sine', 0.45 * v, O(o, { slideTo: 22 })); }],
      ['Abafada', (v, o) => noise(0.5, 0.5 * v, O(o, LP(220)))]
    ],
    bounce: [
      ['Batidinha', (v, o) => noise(0.05, 0.18 * v, O(o, LP(1400)))],
      ['Toc de borracha', (v, o) => tone(250, 0.05, 'sine', 0.2 * v, O(o, { slideTo: 180 }))],
      ['Estalinho', (v, o) => noise(0.03, 0.15 * v, O(o, HP(2500)))],
      ['Baixinho', (v, o) => noise(0.04, 0.07 * v, O(o, LP(900)))],
      ['Mudo', () => {}]
    ],
    portal: [
      ['Vuuum subindo', (v, o) => { tone(220, 0.28, 'sine', 0.26 * v, O(o, { slideTo: 880 })); tone(330, 0.22, 'triangle', 0.13 * v, O(o, { slideTo: 1320 })); }],
      ['Vento', (v, o) => noise(0.35, 0.3 * v, O(o, { type: 'bandpass', freq: 300, sweep: 2500, q: 2 }))],
      ['Sci-fi descendo', (v, o) => tone(880, 0.3, 'sine', 0.22 * v, O(o, { slideTo: 220 }))],
      ['Grave', (v, o) => tone(110, 0.35, 'triangle', 0.3 * v, O(o, { slideTo: 440 }))]
    ],
    drink: [
      ['Glub-glub', (v, o) => { for (let i = 0; i < 3; i++) tone(260 - i * 30, 0.1, 'sine', 0.3 * v, O(o, { delay: 0.18 + i * 0.22, slideTo: 150 })); }],
      ['Gole grave', (v, o) => { for (let i = 0; i < 2; i++) { tone(140, 0.16, 'sine', 0.4 * v, O(o, { delay: 0.2 + i * 0.3, slideTo: 90 })); noise(0.08, 0.12 * v, O(o, Object.assign(LP(600), { delay: 0.22 + i * 0.3 }))); } }],
      ['Bolhinhas', (v, o) => { for (let i = 0; i < 6; i++) tone(500 + Math.random() * 400, 0.05, 'sine', 0.15 * v, O(o, { delay: 0.15 + i * 0.1, slideTo: 900 })); }],
      ['Cura (brilho)', (v, o) => { tone(520, 0.3, 'sine', 0.25 * v, O(o, { delay: 0.5, slideTo: 1040 })); tone(780, 0.35, 'sine', 0.15 * v, O(o, { delay: 0.6, slideTo: 1560 })); }],
      ['Rolha + gole', (v, o) => { tone(900, 0.04, 'square', 0.12 * v, o); for (let i = 0; i < 3; i++) tone(200, 0.12, 'triangle', 0.25 * v, O(o, { delay: 0.25 + i * 0.22, slideTo: 120 })); }]
    ],
    door: [
      ['Vuush de nave', (v, o) => noise(0.35, 0.3 * v, O(o, { type: 'bandpass', freq: 500, sweep: 1800, q: 1.2 }))],
      ['Pistão', (v, o) => { noise(0.25, 0.25 * v, O(o, LP(900))); tone(90, 0.2, 'sine', 0.2 * v, O(o, { slideTo: 60 })); }],
      ['Sci-fi', (v, o) => tone(300, 0.25, 'sine', 0.2 * v, O(o, { slideTo: 700 }))],
      ['Baixinho', (v, o) => noise(0.2, 0.1 * v, O(o, BP(700)))],
      ['Mudo', () => {}]
    ],
    splash: [
      ['Lava (blub)', (v, o) => { noise(0.35, 0.4 * v, O(o, LP(500))); tone(120, 0.3, 'sine', 0.3 * v, O(o, { slideTo: 40 })); }],
      ['Tsss', (v, o) => noise(0.5, 0.3 * v, O(o, HP(1500)))],
      ['Blub', (v, o) => tone(200, 0.25, 'sine', 0.35 * v, O(o, { slideTo: 60 }))],
      ['Fogo', (v, o) => noise(0.6, 0.45 * v, O(o, { type: 'lowpass', freq: 1400, sweep: 200 }))]
    ]
  };
  const NAMES = { shot: 'Tiro', hit: 'Acerto', kill: 'Abate', jump: 'Pulo', land: 'Aterrissar', knife: 'Faca', reload: 'Recarregar', throw: 'Arremesso (granada)', explode: 'Explosão', bounce: 'Ricochete na parede', portal: 'Portal', splash: 'Cair na lava', drink: 'Beber poção', door: 'Porta da nave' };
  return {
    init, LIB, NAMES,
    play(kind, vol, opts) {
      if (!ctx || S.mute === '1') return;
      const list = LIB[kind]; if (!list) return;
      const pick = list[Math.min(list.length - 1, Math.max(0, Number((S.sfx || {})[kind]) || 0))];
      pick[1](Math.max(0, Math.min(1, vol == null ? 1 : vol)), opts || {});
    }
  };
})();
// volume por distância até o "me" (jogadores/explosões longe tocam mais baixo)
function sfxAt(kind, x, z, opts) {
  const me = sim && sim.players.get('me');
  if (!me) { SFX.play(kind, 1, opts); return; }
  const dx = x - me.x, dz = z - me.z, dist = Math.hypot(dx, dz);
  const vol = dist < 40 ? 1 : Math.max(0, 1 - dist / 1400);
  if (vol <= 0.02) return;
  const pan = Math.max(-1, Math.min(1, dx / 400));
  SFX.play(kind, vol, Object.assign({ pan }, opts));
}

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
Object.assign(sun.shadow.camera, { left: -1320, right: 1320, top: 950, bottom: -950, near: 10, far: 4500 }); // mapas 40% maiores
sun.shadow.bias = -0.0006;
scene.add(sun, sun.target);

const mat = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, flatShading: true, roughness: 0.85, metalness: 0 }, extra || {}));
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ---------- mapa ----------
let mapGroup = null, mapWalls = [], baseLight = { hemi: 1.3, sun: 2.3 };
let lampLights = [], lavaFx = [], portalViews = [];
// informações da partida que o servidor sorteia (portais, buracos) + terreno do deserto
let mapInfo = { mapId: null, portalPairs: null, portals: [], holes: null, dunes: null };
// cores só da versão 3D (o 2D continua com as dele)
const THEME3D = {
  escuro: { wall: '#3a3d45', wallEdge: '#5b606b', border: '#2a2c32' },
  portal: { ground: '#3a3f47', ground2: '#343941', wall: '#dfe3e8', wallEdge: '#8a929c', border: '#c3c9d1' },
  nave: { ground: '#3b4250', ground2: '#353c49', wall: '#c7ccd4', wallEdge: '#5b6472', border: '#aeb5bf' },
  deserto: { ground: '#e6c68c', ground2: '#dcb877', border: '#b98552' }
};
const WALL_STYLE = { deserto: 'sandstone', neve: 'ice', floresta: 'wood', nave: 'corridor', portal: 'lab' };
const groundY = (x, z) => (mapInfo.dunes ? mapInfo.dunes.at(x, z) : 0);

function canvasTex(w, h, draw, repeat) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
function groundTexture(th, seed, style, opts) {
  return canvasTex(2048, 1280, (g, W, H) => {
    const rnd = seeded(seed);
    g.fillStyle = th.ground; g.fillRect(0, 0, W, H);
    if (style === 'deck') { // piso de nave: placas de metal com junta, parafuso e risco
      const s = 128;
      for (let y = 0; y < H; y += s) for (let x = 0; x < W; x += s) {
        const l = 44 + Math.floor(rnd() * 10);
        g.fillStyle = `rgb(${l},${l + 5},${l + 14})`; g.fillRect(x + 2, y + 2, s - 4, s - 4);
        g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x + 2, y + 2, s - 4, 3);
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 2, y + s - 5, s - 4, 3);
        g.fillStyle = '#20252e'; for (const [bx, by] of [[10, 10], [s - 10, 10], [10, s - 10], [s - 10, s - 10]]) { g.beginPath(); g.arc(x + bx, y + by, 3, 0, 7); g.fill(); }
        if (rnd() < 0.25) { g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; for (let k = 16; k < s - 16; k += 10) { g.beginPath(); g.moveTo(x + 20, y + k); g.lineTo(x + s - 20, y + k); g.stroke(); } } // grade de ventilação
      }
      g.strokeStyle = 'rgba(200,210,230,.05)'; g.lineWidth = 1;
      for (let i = 0; i < 300; i++) { const x = rnd() * W, y = rnd() * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 60, y + (rnd() - 0.5) * 10); g.stroke(); }
      // faixas de aviso amarelo/preto perto das bordas
      const stripe = (x, y, w, h) => { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.fillStyle = '#e0b020'; g.fillRect(x, y, w, h); g.fillStyle = '#1b1b1b'; for (let k = -h; k < w + h; k += 36) { g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + k + 18, y); g.lineTo(x + k + 18 - h, y + h); g.lineTo(x + k - h, y + h); g.fill(); } g.restore(); };
      stripe(40, 40, W - 80, 16); stripe(40, H - 56, W - 80, 16);
      return;
    }
    if (style === 'lab') { // piso de laboratório: ladrilho escuro grande
      const s = 102;
      for (let y = 0; y < H; y += s) for (let x = 0; x < W; x += s) {
        const l = 52 + Math.floor(rnd() * 8); g.fillStyle = `rgb(${l},${l + 3},${l + 8})`; g.fillRect(x + 2, y + 2, s - 4, s - 4);
      }
      g.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 0; i < 400; i++) { g.beginPath(); g.arc(rnd() * W, rnd() * H, 1 + rnd() * 5, 0, 7); g.fill(); }
      return;
    }
    if (style === 'city' && opts) { // cidade: asfalto, calçada em volta dos muros e faixas pintadas nas ruas
      const sx = W / opts.W, sz = H / opts.H;
      for (let i = 0; i < 5000; i++) { const l = 30 + Math.floor(rnd() * 22); g.fillStyle = `rgba(${l},${l + 2},${l + 6},.5)`; g.fillRect(rnd() * W, rnd() * H, 2, 2); }
      const side = opts.walls.filter((R) => !R.space).map((R) => { const m = R.border ? 36 : 30; return [(R.x - m) * sx, (R.y - m) * sz, (R.w + 2 * m) * sx, (R.h + 2 * m) * sz]; });
      for (const [x, y, w, h] of side) { g.fillStyle = '#4b4f58'; g.fillRect(x, y, w, h); g.strokeStyle = '#6b707b'; g.lineWidth = 3; g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3); }
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1;
      for (const [x, y, w, h] of side) { for (let k = x; k < x + w; k += 22) { g.beginPath(); g.moveTo(k, y); g.lineTo(k, y + h); g.stroke(); } for (let k = y; k < y + h; k += 22) { g.beginPath(); g.moveTo(x, k); g.lineTo(x + w, k); g.stroke(); } }
      const hitsSide = (x, y, w, h) => side.some(([a, b, c, d]) => x < a + c && x + w > a && y < b + d && y + h > b);
      g.fillStyle = 'rgba(235,225,170,.75)';
      for (const nz of [0.1, 0.35, 0.65, 0.9]) for (let x = 0; x < W; x += 60) { const y = nz * H - 3; if (!hitsSide(x, y, 34, 6)) g.fillRect(x, y, 34, 6); }
      for (const nx of [0.07, 0.19, 0.3, 0.7, 0.81, 0.93]) for (let y = 0; y < H; y += 60) { const x = nx * W - 3; if (!hitsSide(x, y, 6, 34)) g.fillRect(x, y, 6, 34); }
      g.fillStyle = 'rgba(240,240,240,.55)'; // faixas de pedestre
      for (const [nx, nz] of [[0.3, 0.35], [0.7, 0.35], [0.3, 0.65], [0.7, 0.65], [0.5, 0.1], [0.5, 0.9]]) for (let k = -3; k <= 3; k++) { const x = nx * W + k * 16 - 5, y = nz * H - 30; if (!hitsSide(x, y, 10, 60)) g.fillRect(x, y, 10, 60); }
      g.fillStyle = '#1f2228'; for (let i = 0; i < 14; i++) { const x = rnd() * W, y = rnd() * H; g.beginPath(); g.arc(x, y, 12, 0, 7); g.fill(); } // bueiros
      g.fillStyle = 'rgba(120,140,170,.12)'; for (let i = 0; i < 30; i++) { g.beginPath(); g.ellipse(rnd() * W, rnd() * H, 20 + rnd() * 50, 8 + rnd() * 20, rnd() * 3, 0, 7); g.fill(); } // poças
      return;
    }
    if (style === 'sand') { // areia: grãozinhos e ondinhas de vento bem fraquinhas
      for (let i = 0; i < 9000; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(255,245,220,.16)' : 'rgba(150,100,45,.12)'; g.fillRect(rnd() * W, rnd() * H, 2, 2); }
      g.strokeStyle = 'rgba(160,112,55,.09)'; g.lineWidth = 1.5;
      for (let y = 0; y < H; y += 9) { g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= W; x += 40) g.lineTo(x, y + Math.sin(x * 0.01 + y * 0.3) * 4); g.stroke(); }
      return;
    }
    g.fillStyle = th.ground2;
    for (let i = 0; i < 520; i++) { g.beginPath(); g.ellipse(rnd() * W, rnd() * H, 6 + rnd() * 30, 3 + rnd() * 12, rnd() * 3, 0, Math.PI * 2); g.fill(); }
    if (style === 'ash') { // chão de cinza vulcânica com rachaduras
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2;
      for (let i = 0; i < 140; i++) { let x = rnd() * W, y = rnd() * H; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 70; y += (rnd() - 0.5) * 70; g.lineTo(x, y); } g.stroke(); }
    }
  });
}
function wallTexture(color, style) {
  if (style === 'corridor') return canvasTex(256, 256, (g) => { // parede de corredor de nave: painel de metal claro
    const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, '#d6dbe2'); grd.addColorStop(1, '#b7bdc7');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    for (const x of [0, 128]) { // dois painéis por bloco, com chanfro
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + 6, 40, 116, 3); g.fillRect(x + 6, 40, 3, 150);
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x + 6, 188, 116, 3); g.fillRect(x + 119, 40, 3, 151);
      g.fillStyle = '#8b939e'; for (const [bx, by] of [[14, 48], [114, 48], [14, 180], [114, 180]]) { g.beginPath(); g.arc(x + bx, by, 2.5, 0, 7); g.fill(); }
    }
    g.fillStyle = '#9aa2ad'; g.fillRect(0, 0, 256, 34); // faixa de cima
    g.fillStyle = '#2d333c'; g.fillRect(0, 214, 256, 42); // rodapé escuro
    g.fillStyle = '#e0b020'; g.fillRect(0, 210, 256, 4);
    g.fillStyle = '#e8f7ff'; g.fillRect(0, 14, 256, 6); // fita de luz
    g.fillStyle = '#3b424c'; for (let k = 0; k < 7; k++) g.fillRect(150 + k * 12, 226, 7, 20); // grade de ventilação
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(128, 34); g.lineTo(128, 214); g.stroke();
  }, true);
  if (style === 'lab') return canvasTex(256, 256, (g) => { // painéis brancos de sala de teste
    g.fillStyle = color; g.fillRect(0, 0, 256, 256);
    const rnd = seeded(5);
    for (let y = 0; y < 256; y += 64) for (let x = 0; x < 256; x += 64) {
      const l = 218 + Math.floor(rnd() * 16); g.fillStyle = `rgb(${l},${l + 2},${l + 5})`; g.fillRect(x + 2, y + 2, 60, 60);
    }
    g.strokeStyle = 'rgba(40,45,55,.55)'; g.lineWidth = 3;
    for (let k = 0; k <= 256; k += 64) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 256); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(256, k); g.stroke(); }
    g.fillStyle = 'rgba(60,50,40,.035)'; for (let i = 0; i < 30; i++) { g.beginPath(); g.arc(rnd() * 256, 225 + rnd() * 31, 2 + rnd() * 6, 0, 7); g.fill(); }
  }, true);
  if (style === 'sandstone') return canvasTex(256, 256, (g) => { // paredão de arenito com camadas
    g.fillStyle = color; g.fillRect(0, 0, 256, 256);
    const rnd = seeded(21);
    for (let y = 0; y < 256; y += 6 + Math.floor(rnd() * 14)) { g.fillStyle = `rgba(${rnd() < 0.5 ? '90,55,25' : '255,230,190'},${0.08 + rnd() * 0.12})`; g.fillRect(0, y, 256, 3 + rnd() * 8); }
    g.fillStyle = 'rgba(70,40,20,.2)'; for (let i = 0; i < 90; i++) { g.beginPath(); g.ellipse(rnd() * 256, rnd() * 256, 2 + rnd() * 9, 1 + rnd() * 3, 0, 0, 7); g.fill(); }
  }, true);
  if (style === 'ice') return canvasTex(256, 256, (g) => { // gelo: veios brancos, bolhas e rachaduras
    const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, '#e9f6ff'); grd.addColorStop(0.5, '#a9d4f2'); grd.addColorStop(1, '#6fa6d0');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    const rnd = seeded(33);
    for (let i = 0; i < 28; i++) { g.fillStyle = `rgba(255,255,255,${0.08 + rnd() * 0.18})`; g.beginPath(); g.ellipse(rnd() * 256, rnd() * 256, 20 + rnd() * 60, 4 + rnd() * 12, rnd() * 3, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.2;
    for (let i = 0; i < 14; i++) { let x = rnd() * 256, y = rnd() * 256; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 60; y += (rnd() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 70; i++) { g.beginPath(); g.arc(rnd() * 256, rnd() * 256, 0.6 + rnd() * 2, 0, 7); g.fill(); }
  }, true);
  return canvasTex(128, 128, (g) => {
    g.fillStyle = color; g.fillRect(0, 0, 128, 128);
    if (style === 'wood') { // tábuas de madeira na vertical, com veio
      g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 2;
      for (let x = 0; x <= 128; x += 21) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
      const rnd = seeded(7);
      g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1;
      for (let i = 0; i < 40; i++) { const x = rnd() * 128, y = rnd() * 128, len = 6 + rnd() * 14; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + len); g.stroke(); }
    } else { // tijolo (padrão)
      g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 3;
      for (let y = 0; y <= 128; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }
      for (let y = 0; y < 128; y += 32) for (let x = (y / 32) % 2 ? 32 : 0; x <= 128; x += 64) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); }
    }
  }, true);
}
// casco da base lunar: mesmo painel do corredor, mas com uma janela grande no meio (dá pra ver a Lua lá fora)
const HULL_TEX = canvasTex(256, 256, (g) => {
  const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, '#d6dbe2'); grd.addColorStop(1, '#b7bdc7');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#9aa2ad'; g.fillRect(0, 0, 256, 34);
  g.fillStyle = '#e8f7ff'; g.fillRect(0, 14, 256, 6);
  g.fillStyle = '#2d333c'; g.fillRect(0, 214, 256, 42); g.fillStyle = '#e0b020'; g.fillRect(0, 210, 256, 4);
  g.clearRect(12, 52, 232, 140); // vidro
  g.fillStyle = 'rgba(150,200,255,.10)'; g.fillRect(12, 52, 232, 140);
  g.fillStyle = 'rgba(255,255,255,.10)'; g.beginPath(); g.moveTo(40, 52); g.lineTo(90, 52); g.lineTo(30, 192); g.lineTo(12, 192); g.lineTo(12, 110); g.fill(); // reflexo
  g.fillStyle = '#6b7280'; g.fillRect(4, 44, 248, 8); g.fillRect(4, 192, 248, 8); g.fillRect(4, 44, 8, 156); g.fillRect(244, 44, 8, 156); g.fillRect(124, 44, 8, 156); // moldura
}, true);
// fita de luz do corredor da nave (brilha sozinha)
const CORRIDOR_EMIS = canvasTex(256, 256, (g) => { g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#bfeaff'; g.fillRect(0, 14, 256, 6); g.fillStyle = '#34d399'; g.fillRect(20, 226, 6, 6); g.fillStyle = '#f87171'; g.fillRect(34, 226, 6, 6); }, true);
// mancha de luz macia (poste no chão, brilho de lava, portal)
const GLOW_TEX = canvasTex(128, 128, (g) => { const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(0, 0, 128, 128); });
let iceEnv = null;
function iceEnvMap() { // reflexo pro gelo (só nele, pra não mudar a luz do resto)
  if (iceEnv) return iceEnv;
  const pm = new THREE.PMREMGenerator(renderer);
  iceEnv = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  return iceEnv;
}

function buildTestRoom(w) {
  const W = w.W, H = w.H;
  mapGroup = new THREE.Group();
  scene.background = new THREE.Color(0x9cc7ee);
  scene.fog = new THREE.Fog(0x9cc7ee, 1800, 5200);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ color: 0x3d4a5c, roughness: 0.9 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(W / 2, 0, H / 2); ground.receiveShadow = true;
  mapGroup.add(ground);
  // só a borda, sem muros no meio: mapa aberto pra testar mira/movimento à vontade
  mapWalls = w.walls;
  mapInfo = { mapId: 'teste', world: w, holes: null, dunes: null, W, H };
  for (const R of mapWalls) {
    const hgt = P.borderH;
    const box = new THREE.Mesh(new THREE.BoxGeometry(R.w, hgt, R.h), mat(0x334155));
    box.position.set(R.x + R.w / 2, hgt / 2, R.y + R.h / 2); box.castShadow = box.receiveShadow = true;
    mapGroup.add(box);
  }
  scene.add(mapGroup);
  hemi.intensity = 1.3; sun.intensity = 2.3; hemi.color.set(0xffffff); hemi.groundColor.set(0x445566); sun.color.set(0xffffff);
  baseLight = { hemi: 1.3, sun: 2.3 };
  sun.position.set(W / 2 - 600, 1500, H / 2 + 800); sun.target.position.set(W / 2, 0, H / 2);
}

// ---------- terreno: deserto (montanhas de areia) ----------
function buildDuneGround(th, D, W, H) {
  const geo = new THREE.PlaneGeometry(W, H, Math.round(W / 8), Math.round(H / 8));
  geo.rotateX(-Math.PI / 2); geo.translate(W / 2, 0, H / 2);
  const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3);
  const lo = new THREE.Color(0xc99a5c), hi = new THREE.Color(0xf3dcaa), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = D.at(x, z);
    pos.setY(i, h);
    const [gx, gz] = D.grad(x, z), lit = Math.max(-1, Math.min(1, (-gx * 0.7 + gz * 0.4) * 1.5)); // lado virado pro sol mais claro
    c.copy(lo).lerp(hi, Math.min(1, 0.55 + h / D.maxH * 0.35 + lit * 0.2));
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: groundTexture(th, 55, 'sand'), vertexColors: true, roughness: 1 }));
  m.receiveShadow = true; m.castShadow = true;
  return m;
}
// deserto em volta da arena: areia até o horizonte, com dunas grandes lá longe (nenhuma entra no mapa) e pirâmides
function buildDesertOutside(W, H) {
  const far = new THREE.Mesh(new THREE.PlaneGeometry(18000, 18000), new THREE.MeshStandardMaterial({ color: 0xdcbc82, roughness: 1 }));
  far.rotation.x = -Math.PI / 2; far.position.set(W / 2, -0.6, H / 2); far.receiveShadow = true;
  mapGroup.add(far);
  const rnd = seeded(404), sand = new THREE.MeshStandardMaterial({ color: 0xd9b57a, roughness: 1 });
  // a duna (elipse) tem que ficar longe da arena: a areia de fora não pode invadir e cobrir ninguém
  const clear = (x, z, r) => Math.hypot(Math.max(0, Math.abs(x - W / 2) - W / 2), Math.max(0, Math.abs(z - H / 2) - H / 2)) > r + 160;
  const geo = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  for (let n = 0, tries = 0; n < 72 && tries < 900; tries++) {
    const a = rnd() * Math.PI * 2, d = 1500 + rnd() * 5200;
    const x = W / 2 + Math.cos(a) * d, z = H / 2 + Math.sin(a) * d * 0.9;
    const sx = 380 + rnd() * 900, sy = 100 + rnd() * 320, sz = 240 + rnd() * 520;
    if (!clear(x, z, Math.max(sx, sz))) continue;
    const dune = new THREE.Mesh(geo, sand);
    dune.scale.set(sx, sy, sz); dune.rotation.y = rnd() * 3;
    dune.position.set(x, -2, z); dune.receiveShadow = true;
    mapGroup.add(dune); n++;
  }
  // pirâmides estilo Egito lá no horizonte
  const stone = new THREE.MeshStandardMaterial({ color: 0xd2ad72, roughness: 1, flatShading: true });
  const capM = new THREE.MeshStandardMaterial({ color: 0xf1d9a0, roughness: 0.6, metalness: 0.2, flatShading: true });
  for (const [dx, dz, sz] of [[-3300, -3900, 950], [-2150, -4500, 640], [-4300, -3100, 520], [3900, 3000, 820], [2900, 3900, 540]]) {
    const hgt = sz * 0.95, pyr = new THREE.Mesh(new THREE.ConeGeometry(sz, hgt, 4, 1), stone);
    pyr.rotation.y = Math.PI / 4 + dx * 0.0001; pyr.position.set(W / 2 + dx, hgt / 2 - 4, H / 2 + dz); pyr.castShadow = false; mapGroup.add(pyr);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(sz * 0.12, hgt * 0.12, 4, 1), capM); cap.rotation.y = pyr.rotation.y; cap.position.set(pyr.position.x, hgt - hgt * 0.06 - 4, pyr.position.z); mapGroup.add(cap);
  }
}

// ---------- vulcão: o mapa é uma laje de pedra flutuando em cima de um vulcão gigante ----------
// a erupção fura a laje (buraco); quem cai, cai dentro do vulcão lá embaixo
function holeEdgeR(h, a) {
  const aa = h.m ? Math.PI - a : a, s = (h.seed % 1000) / 159;
  return h.r * (1.0 + 0.035 * Math.sin(3 * aa + s) + 0.025 * Math.sin(5 * aa + s * 2.3) + 0.015 * Math.sin(9 * aa + s * 4.1));
}
const LAVA_VERT = 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
// lava em coordenadas do mundo (coluna da erupção: a textura escorre de verdade)
const LAVA_VERT_W = 'varying vec2 vP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = vec2(w.x + w.z * 0.7, w.y); gl_Position = projectionMatrix * viewMatrix * w; }';
const NOISE_GLSL = `
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int k = 0; k < 5; k++) { v += a * vn(p); p = p * 2.03 + 11.7; a *= 0.5; } return v; }`;
const LAVA_FRAG = `uniform float uTime; uniform float uScale; varying vec2 vP; ${NOISE_GLSL}
void main(){
  vec2 p = vP * uScale;
  float n = fbm(p + vec2(uTime * 0.05, uTime * 0.03));
  float m = fbm(p * 2.2 - vec2(uTime * 0.08, -uTime * 0.04) + n * 1.6);
  float heat = smoothstep(0.35, 0.8, m);
  vec3 crust = vec3(0.12, 0.03, 0.01), hot = vec3(1.0, 0.36, 0.05), white = vec3(1.0, 0.85, 0.45);
  vec3 col = mix(crust, hot, heat); col = mix(col, white, smoothstep(0.72, 0.95, m));
  gl_FragColor = vec4(col * 1.7, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
let volcano = null;
// forma do chão (retângulo do mapa com os buracos); flip = vira a face pra baixo (parte de baixo da laje)
function slabShape(holes, W, H, flip) {
  const sz = flip ? 1 : -1, shape = new THREE.Shape(), N = 48;
  shape.moveTo(0, 0); shape.lineTo(W, 0); shape.lineTo(W, sz * H); shape.lineTo(0, sz * H); shape.lineTo(0, 0);
  for (const h of holes) {
    const path = new THREE.Path();
    for (let k = 0; k <= N; k++) { const a = k / N * Math.PI * 2, r = holeEdgeR(h, a), x = h.x + Math.cos(a) * r, z = h.z + Math.sin(a) * r; if (k === 0) path.moveTo(x, sz * z); else path.lineTo(x, sz * z); }
    shape.holes.push(path);
  }
  const geo = new THREE.ShapeGeometry(shape, 1); geo.rotateX(flip ? Math.PI / 2 : -Math.PI / 2);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / W, 1 - pos.getZ(i) / H);
  return geo;
}
function buildVolcanoWorld(th, W, H) {
  const T = HOLE.depth, rock = new THREE.MeshStandardMaterial({ color: 0x3a2822, roughness: 1, flatShading: true });
  volcano = { th, W, H, holeCount: -1, holeGroup: null, groundTex: groundTexture(th, 71, 'ash'), warn: [],
    lakeMat: new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uScale: { value: 0.0035 } }, vertexShader: LAVA_VERT, fragmentShader: LAVA_FRAG, fog: false }) };
  // lateral da laje
  for (const [x, z, w, d] of [[W / 2, -4, W + 16, 16], [W / 2, H + 4, W + 16, 16], [-4, H / 2, 16, H], [W + 4, H / 2, 16, H]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, T, d), rock); b.position.set(x, -T / 2, z); mapGroup.add(b);
  }
  // pedras penduradas embaixo (ilha flutuando)
  const rnd = seeded(931);
  for (let i = 0; i < 46; i++) { // só perto da beirada (no meio ficaria na frente do buraco e tamparia a lava)
    const side = i % 4, u = rnd(), e = 20 + rnd() * 90;
    const x = side === 0 ? e : side === 1 ? W - e : u * W, z = side === 2 ? e : side === 3 ? H - e : u * H;
    const h = 90 + rnd() * 380, r = 50 + rnd() * 90;
    const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), rock); c.rotation.x = Math.PI; c.position.set(x, -T - h / 2 + 4, z); mapGroup.add(c);
  }
  // o vulcão gigante lá embaixo, com o lago de lava na boca
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(2600, 9500, 3600, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0x2b1d18, roughness: 1, flatShading: true, emissive: 0x3a0e04, emissiveIntensity: 0.6 }));
  cone.position.set(W / 2, -1500 - 1800, H / 2); mapGroup.add(cone);
  const lake = new THREE.Mesh(new THREE.CircleGeometry(2600, 64), volcano.lakeMat); lake.rotation.x = -Math.PI / 2; lake.position.set(W / 2, -1460, H / 2); mapGroup.add(lake);
  // luz laranja vindo de baixo (a lava ilumina a laje e quem cai)
  const under = new THREE.DirectionalLight(0xff6a2a, 1.6); under.position.set(W / 2 + 300, -2200, H / 2 + 200); under.target.position.set(W / 2, 0, H / 2); mapGroup.add(under, under.target);
  // nuvens escuras de cinza em volta (o vulcão está em erupção); ficam na altura do mapa e acima,
  // então olhando pra baixo ainda dá pra ver o vulcão e a lava
  const clouds = new THREE.Group(); clouds.position.set(W / 2, 0, H / 2);
  for (let i = 0; i < 70; i++) {
    const a = i / 70 * Math.PI * 2 + rnd() * 0.08, ex = W / 2 + 500 + rnd() * 1500, ez = H / 2 + 500 + rnd() * 1500;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: SMOKE_TEX, color: rnd() < 0.5 ? 0x1c1412 : 0x2a1d18, transparent: true, opacity: 0.7 + rnd() * 0.25, depthWrite: false, fog: false, rotation: rnd() * 6 }));
    const sz = 700 + rnd() * 900; s.scale.set(sz, sz * 0.7, 1);
    s.position.set(Math.cos(a) * ex, -60 + rnd() * 700, Math.sin(a) * ez); clouds.add(s);
  }
  for (let i = 0; i < 18; i++) { // umas mais altas, vermelhas por baixo (luz da lava)
    const a = rnd() * Math.PI * 2, d = 1600 + rnd() * 1800;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: SMOKE_TEX, color: 0x4a2014, transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
    s.scale.set(1400, 900, 1); s.position.set(Math.cos(a) * d, 700 + rnd() * 500, Math.sin(a) * d); clouds.add(s);
  }
  mapGroup.add(clouds); volcano.clouds = clouds;
  // fumaça subindo do vulcão
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2, d = 1200 + rnd() * 2400;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: SMOKE_TEX, color: 0x2a1a16, transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
    s.scale.set(1200 + rnd() * 900, 1200 + rnd() * 900, 1); s.position.set(W / 2 + Math.cos(a) * d, -900 + rnd() * 900, H / 2 + Math.sin(a) * d); mapGroup.add(s);
  }
  rebuildVolcanoHoles([]);
}
function rebuildVolcanoHoles(holes) {
  const V = volcano; if (!V) return;
  if (V.holeGroup) { mapGroup.remove(V.holeGroup); V.holeGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  const g = new THREE.Group(), T = HOLE.depth, W = V.W, H = V.H;
  const top = new THREE.Mesh(slabShape(holes, W, H, false), new THREE.MeshStandardMaterial({ map: V.groundTex, roughness: 0.95 }));
  top.receiveShadow = true; g.add(top);
  const bottom = new THREE.Mesh(slabShape(holes, W, H, true), new THREE.MeshStandardMaterial({ color: 0x3a2822, roughness: 1 }));
  bottom.position.y = -T; g.add(bottom);
  lavaFx = [];
  const shaftEmis = canvasTex(8, 128, (c) => { const grd = c.createLinearGradient(0, 0, 0, 128); grd.addColorStop(0, '#120300'); grd.addColorStop(0.6, '#5a1400'); grd.addColorStop(1, '#ff6a18'); c.fillStyle = grd; c.fillRect(0, 0, 8, 128); });
  const N = 48;
  for (const h of holes) {
    const M = 3, verts = [], uvs = [], idx = [];
    for (let j = 0; j <= M; j++) for (let k = 0; k <= N; k++) {
      const a = k / N * Math.PI * 2, t = j / M, r = holeEdgeR(h, a) * (1 + 0.04 * Math.sin(a * 7 + j * 2.1) * t);
      verts.push(h.x + Math.cos(a) * r, -T * t, h.z + Math.sin(a) * r); uvs.push(k / N, 1 - t);
    }
    for (let j = 0; j < M; j++) for (let k = 0; k < N; k++) { const a = j * (N + 1) + k, b = a + N + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); sg.setIndex(idx); sg.computeVertexNormals();
    g.add(new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: 0x5a3a2c, roughness: 1, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: shaftEmis, emissiveIntensity: 1.4, flatShading: true })));
    // borda queimada brilhando em volta do buraco
    const glow = new THREE.Mesh(new THREE.RingGeometry(h.r * 0.98, h.r * 1.55, 40), new THREE.MeshBasicMaterial({ color: 0xff5a1f, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.rotation.x = -Math.PI / 2; glow.position.set(h.x, 0.8, h.z); g.add(glow);
    const light = new THREE.PointLight(0xff6a1f, 22000, 360, 2); light.position.set(h.x, -40, h.z); g.add(light);
    const heat = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xff5a1f, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
    heat.scale.set(h.r * 2.6, h.r * 1.3, 1); heat.position.set(h.x, 14, h.z); g.add(heat);
    const rnd = seeded((h.seed || 1) + h.m * 7 + 3), rk = mat(0x3a2a24);
    for (let i = 0; i < 9; i++) { const a = rnd() * Math.PI * 2, r = holeEdgeR(h, a) + 6 + rnd() * 16; const s = new THREE.Mesh(new THREE.DodecahedronGeometry(4 + rnd() * 7, 0), rk); s.position.set(h.x + Math.cos(a) * r, 2, h.z + Math.sin(a) * r); s.rotation.set(rnd() * 3, rnd() * 3, 0); s.castShadow = s.receiveShadow = true; g.add(s); }
    const NE = 30, ep = new Float32Array(NE * 3), eSeed = [];
    for (let i = 0; i < NE; i++) eSeed.push([rnd() * Math.PI * 2, Math.sqrt(rnd()) * h.r * 0.85, rnd(), 0.5 + rnd()]);
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(ep, 3));
    const embers = new THREE.Points(eg, new THREE.PointsMaterial({ map: GLOW_TEX, color: 0xffa040, size: 7, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
    embers.frustumCulled = false; g.add(embers);
    lavaFx.push({ h, light, glow, embers, eSeed });
  }
  mapGroup.add(g); V.holeGroup = g; V.holeCount = holes.length;
}
// aviso de erupção: o chão racha e brilha nos 2 lugares antes do fogo furar
const CRACK_TEX = canvasTex(256, 256, (g) => {
  const rnd = seeded(61); g.strokeStyle = 'rgba(255,170,60,1)'; g.lineCap = 'round';
  for (let i = 0; i < 16; i++) { let x = 128, y = 128, a = rnd() * Math.PI * 2; g.lineWidth = 5 - i * 0.2; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 7; k++) { a += (rnd() - 0.5) * 1.1; x += Math.cos(a) * 18; y += Math.sin(a) * 18; g.lineTo(x, y); } g.stroke(); }
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128); grd.addColorStop(0, 'rgba(255,120,30,.55)'); grd.addColorStop(1, 'rgba(255,60,10,0)'); g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
});
function updateEruptWarn(E, now) {
  const V = volcano; if (!V) return;
  if (!E) { for (const m of V.warn) mapGroup.remove(m); V.warn = []; return; }
  if (!V.warn.length) for (const [x, z] of E.pts) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(E.r * 1.25, 32), new THREE.MeshBasicMaterial({ map: CRACK_TEX, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 1.2, z); mapGroup.add(m); V.warn.push(m);
  }
  for (const m of V.warn) { m.material.opacity = 0.55 + Math.sin(now / 70) * 0.45; m.rotation.z += 0.01; }
}
// erupção: a lava sobe de baixo pra cima atravessando o chão (quebra a laje), espirra, cai de volta e fica o buraco
const FLAME_TEX = canvasTex(64, 256, (g) => { const grd = g.createLinearGradient(0, 256, 0, 0); grd.addColorStop(0, 'rgba(255,240,180,1)'); grd.addColorStop(0.35, 'rgba(255,140,40,.95)'); grd.addColorStop(0.75, 'rgba(255,60,10,.5)'); grd.addColorStop(1, 'rgba(120,20,0,0)'); g.fillStyle = grd; g.fillRect(0, 0, 64, 256); });
function eruptFx(x, z, r, now, dur) {
  // explosão de lava: o chão estoura de baixo pra cima numa "coroa" de lava irregular (larga e baixa, cheia de pontas),
  // com muitas gotas e pedaços do chão voando; depois tudo cai de volta e fica o buraco
  const lavaMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uScale: { value: 0.025 } }, vertexShader: LAVA_VERT_W, fragmentShader: LAVA_FRAG, fog: false, side: THREE.DoubleSide });
  const crownGeo = new THREE.CylinderGeometry(r * 1.45, r * 0.85, 1, 30, 6, true), cp = crownGeo.attributes.position, seedA = Math.random() * 10;
  for (let i = 0; i < cp.count; i++) { // borda de cima em pontas irregulares (respingo), laterais onduladas
    const px = cp.getX(i), py = cp.getY(i) + 0.5, pz = cp.getZ(i), a = Math.atan2(pz, px);
    const spike = py > 0.99 ? 0.35 + 0.65 * Math.abs(Math.sin(a * 7 + seedA)) * (0.6 + 0.4 * Math.sin(a * 3 - seedA)) : py;
    const wob = 1 + 0.12 * Math.sin(a * 5 + py * 6 + seedA);
    cp.setXYZ(i, px * wob, spike - 0.5, pz * wob);
  }
  crownGeo.computeVertexNormals();
  const crowns = [];
  for (const k of [1, 0.62]) { const c = new THREE.Mesh(crownGeo, lavaMat); c.position.set(x, 0, z); c.scale.set(k, 1, k); c.rotation.y = k * 2; c.visible = false; scene.add(c); crowns.push(c); }
  const pool = new THREE.Mesh(new THREE.CircleGeometry(r * 1.02, 32), lavaMat); pool.rotation.x = -Math.PI / 2; pool.position.set(x, -40, z); scene.add(pool);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xff6a1f, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.set(r * 6, r * 4, 1); glow.position.set(x, 60, z); scene.add(glow);
  const light = new THREE.PointLight(0xff7a2a, 0, 1000, 2); light.position.set(x, 80, z); scene.add(light);
  const chunks = [], drops = [], rk = mat(0x3a2a24);
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2, d = r * (0.3 + Math.random() * 0.7);
    const c = new THREE.Mesh(new THREE.DodecahedronGeometry(5 + Math.random() * 11, 0), rk); c.visible = false;
    c.position.set(x + Math.cos(a) * d, 2, z + Math.sin(a) * d);
    c.userData.v = [Math.cos(a) * (80 + Math.random() * 200), 300 + Math.random() * 380, Math.sin(a) * (80 + Math.random() * 200)]; c.userData.spin = Math.random() * 8;
    scene.add(c); chunks.push(c);
  }
  for (let i = 0; i < 44; i++) { // gotas de lava (bolinhas que brilham) em arco
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: FIRE_TEX, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.visible = false;
    const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 300;
    s.userData.v = [Math.cos(a) * sp, 250 + Math.random() * 450, Math.sin(a) * sp]; s.userData.d = Math.random() * 0.25; s.scale.setScalar(10 + Math.random() * 18);
    s.position.set(x + Math.cos(a) * r * 0.5 * Math.random(), 0, z + Math.sin(a) * r * 0.5 * Math.random());
    scene.add(s); drops.push(s);
  }
  const smoke = [];
  for (let i = 0; i < 8; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: SMOKE_TEX, color: 0x2a1c16, transparent: true, opacity: 0, depthWrite: false })); s.position.set(x + (Math.random() - 0.5) * r, 20, z + (Math.random() - 0.5) * r); s.scale.setScalar(r * 2); s.userData.vy = 60 + Math.random() * 80; scene.add(s); smoke.push(s); }
  effects.push({ t0: now, d: dur || 2600, objs: [...crowns, pool, glow, light, ...chunks, ...drops, ...smoke], upd: (t, dt) => {
    lavaMat.uniforms.uTime.value = now / 1000 + t * 3;
    // estoura rápido (0 -> 0,18), espirra e desaba (0,18 -> 0,6); a poça fica borbulhando e desce
    const burst = t < 0.18 ? Math.sin(t / 0.18 * Math.PI / 2) : Math.max(0, 1 - (t - 0.18) / 0.42);
    crowns.forEach((c, k) => { c.visible = burst > 0.02; const h = (k ? 190 : 120) * burst; c.scale.y = Math.max(0.5, h); c.position.y = h / 2 - 6; const w = 1 + (1 - burst) * 0.35; c.scale.x = c.scale.z = (k ? 0.62 : 1) * w; });
    pool.position.y = t < 0.15 ? -40 + t / 0.15 * 38 : -2 - Math.max(0, t - 0.5) * 120;
    glow.material.opacity = 0.85 * Math.max(0, 1 - t * 1.2); light.intensity = 80000 * Math.max(0, 1 - t * 1.4);
    if (t > 0.05) {
      for (const c of chunks) { c.visible = true; const v = c.userData.v; v[1] -= 1300 * dt; c.position.x += v[0] * dt; c.position.y += v[1] * dt; c.position.z += v[2] * dt; c.rotation.x += c.userData.spin * dt; }
      for (const s of drops) { if (t < 0.05 + s.userData.d) continue; s.visible = s.position.y > -60; const v = s.userData.v; v[1] -= 1100 * dt; s.position.x += v[0] * dt; s.position.y += v[1] * dt; s.position.z += v[2] * dt; s.material.opacity = Math.max(0, 1 - t); }
      for (const s of smoke) { s.position.y += s.userData.vy * dt; s.material.opacity = 0.6 * Math.sin(Math.min(1, t) * Math.PI); s.scale.multiplyScalar(1 + dt * 0.6); }
    }
  } });
}

// ---------- furacão da floresta: vento girando (faixas finas), largo embaixo, afina e abre lá em cima ----------
const TWIST_TEX = canvasTex(128, 256, (g) => {
  const rnd = seeded(17); g.clearRect(0, 0, 128, 256);
  for (let i = 0; i < 70; i++) { const x = rnd() * 128, w = 1 + rnd() * 4; g.fillStyle = `rgba(${200 + rnd() * 55 | 0},${205 + rnd() * 50 | 0},${200 + rnd() * 40 | 0},${0.08 + rnd() * 0.3})`; g.fillRect(x, 0, w, 256); }
}, true);
const TW_H = 640;
const twProf = (u) => TORNADO.r * (1 - 0.55 * Math.sin(Math.min(u / 0.35, 1) * Math.PI / 2)) + TORNADO.r * 1.25 * Math.pow(Math.max(0, (u - 0.25) / 0.75), 1.6);
let tornadoFx = null;
function makeTornadoFx() {
  const g = new THREE.Group(), R = TORNADO.r;
  // 2 cascas bem fraquinhas (dão o volume), girando em velocidades diferentes
  const pts = []; for (let i = 0; i <= 24; i++) { const u = i / 24; pts.push(new THREE.Vector2(twProf(u), u * TW_H)); }
  const shells = [];
  for (const [op, rep] of [[0.13, 3], [0.08, 5]]) {
    const t = TWIST_TEX.clone(); t.needsUpdate = true; t.repeat.set(rep, 1);
    const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, color: 0xdfe6dc }));
    g.add(m); shells.push(m);
  }
  // faixas de vento: linhas finas que sobem girando em espiral (o "desenho" do vento)
  const NS = 120, M = 10, arr = new Float32Array(NS * M * 2 * 3), colA = new Float32Array(NS * M * 2 * 3), seeds = [];
  for (let i = 0; i < NS; i++) seeds.push([Math.random() * Math.PI * 2, Math.random(), 0.1 + Math.random() * 0.22, 0.12 + Math.random() * 0.18, 0.85 + Math.random() * 0.3]);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(arr, 3)); lg.setAttribute('color', new THREE.BufferAttribute(colA, 3));
  const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
  lines.frustumCulled = false; g.add(lines);
  // poeira/folhas rodando baixinho no chão (mostra onde ele pega)
  const NA = 36, MA = 8, arr2 = new Float32Array(NA * MA * 2 * 3), col2 = new Float32Array(NA * MA * 2 * 3), seeds2 = [];
  for (let i = 0; i < NA; i++) seeds2.push([Math.random() * Math.PI * 2, 0.55 + Math.random() * 0.55, 3 + Math.random() * 30, 0.5 + Math.random() * 0.8]);
  const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.BufferAttribute(arr2, 3)); ag.setAttribute('color', new THREE.BufferAttribute(col2, 3));
  const arcs = new THREE.LineSegments(ag, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  arcs.frustumCulled = false; g.add(arcs);
  const NL = 70, lp = new Float32Array(NL * 3), lseed = [];
  for (let i = 0; i < NL; i++) lseed.push([Math.random() * Math.PI * 2, Math.random(), 0.6 + Math.random() * 0.8]);
  const leafG = new THREE.BufferGeometry(); leafG.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  const leaves = new THREE.Points(leafG, new THREE.PointsMaterial({ color: 0x5f7f3a, size: 5, transparent: true, opacity: 0.9, depthWrite: false }));
  leaves.frustumCulled = false; g.add(leaves);
  const ring = new THREE.Mesh(new THREE.RingGeometry(R * 0.7, R * 1.02, 48), new THREE.MeshBasicMaterial({ map: SMOKE_TEX, color: 0xb8a98c, transparent: true, opacity: 0.22, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 1.2; g.add(ring);
  scene.add(g);
  return { g, shells, lines, seeds, M, arcs, seeds2, MA, leaves, lseed, ring };
}
function updateTornadoFx(T, now, dt) {
  if (!T) { if (tornadoFx) { scene.remove(tornadoFx.g); tornadoFx = null; } return; }
  if (!tornadoFx) tornadoFx = makeTornadoFx();
  const F = tornadoFx, grow = T.s === 2 ? 1 : 0.15 + 0.85 * T.k, ts = now / 1000;
  F.g.position.set(T.x, 0, T.z); F.g.scale.set(grow, grow, grow);
  F.shells[0].rotation.y -= dt * 3.2; F.shells[1].rotation.y -= dt * 4.6;
  for (const sh of F.shells) sh.material.map.offset.y -= dt * 0.25;
  // faixas: cada uma sobe girando; a cor apaga nas pontas (parece vento, não bolinha)
  const p = F.lines.geometry.attributes.position.array, c = F.lines.geometry.attributes.color.array, M = F.M;
  let o = 0;
  for (const [a0, u0, len, rise, sp] of F.seeds) {
    const base = (u0 + ts * rise) % 1;
    for (let k = 0; k < M; k++) {
      for (let e = 0; e < 2; e++) {
        const f = (k + e) / M, u = Math.min(1, base + len * f), ang = a0 - ts * 4.2 * sp * (1.25 - u * 0.5) - f * 0.9;
        const r = twProf(u) * (0.92 + 0.08 * Math.sin(ts * 3 + a0 * 5 + u * 9));
        p[o] = Math.cos(ang) * r; p[o + 1] = u * TW_H; p[o + 2] = Math.sin(ang) * r;
        const br = Math.sin(f * Math.PI) * (1 - u * 0.45) * (base + len > 1 && u >= 1 ? 0 : 1);
        c[o] = 0.82 * br; c[o + 1] = 0.85 * br; c[o + 2] = 0.8 * br; o += 3;
      }
    }
  }
  F.lines.geometry.attributes.position.needsUpdate = true; F.lines.geometry.attributes.color.needsUpdate = true;
  const p2 = F.arcs.geometry.attributes.position.array, c2 = F.arcs.geometry.attributes.color.array, MA = F.MA, R = TORNADO.r;
  o = 0;
  for (const [a0, rk, y, sp] of F.seeds2) {
    const a = a0 - ts * 6 * sp;
    for (let k = 0; k < MA; k++) for (let e = 0; e < 2; e++) {
      const f = (k + e) / MA, ang = a + f * 0.9, r = R * rk;
      p2[o] = Math.cos(ang) * r; p2[o + 1] = y + f * 6; p2[o + 2] = Math.sin(ang) * r;
      const br = Math.sin(f * Math.PI) * 0.8; c2[o] = 0.75 * br; c2[o + 1] = 0.68 * br; c2[o + 2] = 0.52 * br; o += 3;
    }
  }
  F.arcs.geometry.attributes.position.needsUpdate = true; F.arcs.geometry.attributes.color.needsUpdate = true;
  const lp = F.leaves.geometry.attributes.position.array;
  for (let i = 0; i < F.lseed.length; i++) {
    const [a, h, sp] = F.lseed[i], u = ((h + ts * 0.18 * sp) % 1) * 0.6, ang = a - ts * 5 * sp, r = twProf(u) * 0.9;
    lp[i * 3] = Math.cos(ang) * r; lp[i * 3 + 1] = u * TW_H; lp[i * 3 + 2] = Math.sin(ang) * r;
  }
  F.leaves.geometry.attributes.position.needsUpdate = true;
  F.ring.rotation.z += dt * 3;
}

// ---------- neve: tempestade congelante (faixa de vento gelado que corta o mapa de ponta a ponta) ----------
const FROST_TEX = canvasTex(128, 512, (g) => {
  const rnd = seeded(29); g.clearRect(0, 0, 128, 512);
  for (let i = 0; i < 140; i++) { const x = rnd() * 128, y = rnd() * 512, l = 20 + rnd() * 90; g.fillStyle = `rgba(230,245,255,${0.15 + rnd() * 0.5})`; g.fillRect(x, y, 1 + rnd() * 2, l); }
  g.fillStyle = 'rgba(200,230,255,.18)'; g.fillRect(0, 0, 128, 512);
}, true);
let stormFx = null;
function makeStormFx(S) {
  const H = mapInfo.H, g = new THREE.Group(), w = S.w;
  const t = FROST_TEX.clone(); t.needsUpdate = true; t.repeat.set(1, H / 400);
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(w * 2, H), new THREE.MeshBasicMaterial({ map: t, color: 0xdff2ff, transparent: true, opacity: 0, depthWrite: false }));
  strip.rotation.x = -Math.PI / 2; strip.position.set(0, 1.6, H / 2); g.add(strip);
  const edges = [];
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.PlaneGeometry(5, H), new THREE.MeshBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0, depthWrite: false })); e.rotation.x = -Math.PI / 2; e.position.set(sx * w, 1.9, H / 2); g.add(e); edges.push(e); }
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w * 2, 300, H), new THREE.MeshBasicMaterial({ color: 0xe8f6ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  wall.position.set(0, 150, H / 2); g.add(wall);
  const N = 900, arr = new Float32Array(N * 6), seeds = [];
  for (let i = 0; i < N; i++) seeds.push([(Math.random() * 2 - 1) * w, 4 + Math.random() * 270, Math.random() * H, 40 + Math.random() * 90, 900 + Math.random() * 800]);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const streaks = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xf2fbff, transparent: true, opacity: 0, depthWrite: false }));
  streaks.frustumCulled = false; g.add(streaks);
  const NF = 700, fp = new Float32Array(NF * 3), fseed = [];
  for (let i = 0; i < NF; i++) fseed.push([(Math.random() * 2 - 1) * w, 2 + Math.random() * 280, Math.random() * H, 500 + Math.random() * 600, Math.random() * 6]);
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
  const flakes = new THREE.Points(fg, new THREE.PointsMaterial({ color: 0xffffff, size: 4, transparent: true, opacity: 0, depthWrite: false }));
  flakes.frustumCulled = false; g.add(flakes);
  g.position.x = S.x; scene.add(g);
  return { g, strip, edges, wall, streaks, seeds, flakes, fseed, x: S.x };
}
function updateStormFx(S, now, dt) {
  if (!S) { if (stormFx) { scene.remove(stormFx.g); stormFx = null; } return; }
  if (stormFx && stormFx.x !== S.x) { scene.remove(stormFx.g); stormFx = null; }
  if (!stormFx) stormFx = makeStormFx(S);
  const F = stormFx, warn = S.s === 1, ts = now / 1000, H = mapInfo.H, dir = S.dir || 1;
  F.strip.material.opacity = warn ? 0.2 + (Math.sin(now / 110) * 0.5 + 0.5) * 0.3 : 0.45;
  for (const e of F.edges) e.material.opacity = warn ? (Math.floor(now / 160) % 2 ? 0.9 : 0.3) : 0.6;
  F.strip.material.map.offset.y -= dt * dir * (warn ? 0.3 : 2.2);
  F.wall.material.opacity = warn ? 0.02 * S.k : 0.11;
  F.streaks.material.opacity = warn ? 0.15 * S.k : 0.85; F.flakes.material.opacity = warn ? 0.3 * S.k : 0.95;
  const a = F.streaks.geometry.attributes.position.array;
  for (let i = 0; i < F.seeds.length; i++) {
    const q = F.seeds[i]; q[2] = (q[2] + dir * q[4] * dt * (warn ? 0.15 : 1) + H) % H;
    a[i * 6] = q[0]; a[i * 6 + 1] = q[1]; a[i * 6 + 2] = q[2]; a[i * 6 + 3] = q[0]; a[i * 6 + 4] = q[1] - 3; a[i * 6 + 5] = q[2] - dir * q[3];
  }
  F.streaks.geometry.attributes.position.needsUpdate = true;
  const fp = F.flakes.geometry.attributes.position.array;
  for (let i = 0; i < F.fseed.length; i++) {
    const q = F.fseed[i]; q[2] = (q[2] + dir * q[3] * dt * (warn ? 0.15 : 1) + H) % H;
    fp[i * 3] = q[0] + Math.sin(ts * 3 + q[4]) * 10; fp[i * 3 + 1] = q[1] + Math.sin(ts * 2 + q[4] * 2) * 12; fp[i * 3 + 2] = q[2];
  }
  F.flakes.geometry.attributes.position.needsUpdate = true;
}

// ---------- base na Lua (mapa "nave") ----------
function buildMoonOutside(W, H) {
  const reg = canvasTex(1024, 1024, (g, w, h) => {
    const rnd = seeded(808);
    g.fillStyle = '#8d8f93'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const l = 110 + Math.floor(rnd() * 60); g.fillStyle = `rgba(${l},${l},${l + 4},.35)`; g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 4, 2 + rnd() * 4); }
    for (let i = 0; i < 70; i++) { // crateras
      const x = rnd() * w, y = rnd() * h, r = 6 + Math.pow(rnd(), 2) * 60;
      const grd = g.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.1, x, y, r);
      grd.addColorStop(0, 'rgba(60,60,64,.55)'); grd.addColorStop(0.8, 'rgba(90,90,94,.3)'); grd.addColorStop(0.92, 'rgba(200,200,205,.45)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
  }, true);
  reg.repeat.set(12, 12);
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(16000, 16000), new THREE.MeshStandardMaterial({ map: reg, roughness: 1, color: 0xb9bbc0 }));
  moon.rotation.x = -Math.PI / 2; moon.position.set(W / 2, -1.2, H / 2); moon.receiveShadow = true;
  mapGroup.add(moon);
  const rnd = seeded(515), grey = mat(0x9a9ca1), dark = mat(0x6d6f74);
  for (let i = 0; i < 60; i++) { // bordas de cratera
    const a = rnd() * Math.PI * 2, d = 1100 + rnd() * 5500, R = 60 + Math.pow(rnd(), 2) * 520;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, R * 0.16, 5, 22), grey);
    rim.rotation.x = -Math.PI / 2; rim.scale.z = 0.35; rim.position.set(W / 2 + Math.cos(a) * d, 0, H / 2 + Math.sin(a) * d);
    rim.receiveShadow = rim.castShadow = true; mapGroup.add(rim);
  }
  for (let i = 0; i < 80; i++) { // pedras
    const a = rnd() * Math.PI * 2, d = 950 + rnd() * 3000, s = 8 + Math.pow(rnd(), 3) * 90;
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rnd() < 0.5 ? grey : dark);
    r.position.set(W / 2 + Math.cos(a) * d, s * 0.3, H / 2 + Math.sin(a) * d); r.rotation.set(rnd() * 3, rnd() * 3, 0); r.castShadow = true; mapGroup.add(r);
  }
  for (let i = 0; i < 22; i++) { // serras em volta (dá pra ver pelas janelas)
    const a = i / 22 * Math.PI * 2 + rnd() * 0.3, d = 2300 + rnd() * 2600;
    const m = new THREE.Mesh(new THREE.ConeGeometry(500 + rnd() * 900, 380 + rnd() * 700, 7), rnd() < 0.5 ? grey : dark);
    m.position.set(W / 2 + Math.cos(a) * d, 100, H / 2 + Math.sin(a) * d); m.rotation.y = rnd() * 3; mapGroup.add(m);
  }
  // a Terra no céu
  const earthTex = canvasTex(512, 256, (g, w, h) => {
    const r2 = seeded(3);
    g.fillStyle = '#1f5fa8'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { g.fillStyle = r2() < 0.7 ? '#3f7d3a' : '#a58a5a'; g.beginPath(); g.ellipse(r2() * w, 40 + r2() * (h - 80), 14 + r2() * 50, 8 + r2() * 30, r2() * 3, 0, 7); g.fill(); }
    g.fillStyle = '#eef6ff'; g.fillRect(0, 0, w, 16); g.fillRect(0, h - 16, w, 16);
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(r2() * w, r2() * h, 20 + r2() * 60, 4 + r2() * 8, r2() * 0.6, 0, 7); g.fill(); }
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(420, 40, 24), new THREE.MeshStandardMaterial({ map: earthTex, emissive: 0xffffff, emissiveMap: earthTex, emissiveIntensity: 0.35, roughness: 0.8, fog: false }));
  earth.position.set(W / 2 + 2600, 2900, H / 2 - 5400); earth.rotation.set(0.3, 2.2, 0.2); mapGroup.add(earth);
  const atm = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 18), new THREE.MeshBasicMaterial({ color: 0x5aa8ff, transparent: true, opacity: 0.18, side: THREE.BackSide, fog: false }));
  atm.position.copy(earth.position); mapGroup.add(atm);
  // estrelas (bem longe, atrás das serras)
  const pts = [], rs = seeded(9);
  for (let i = 0; i < 3000; i++) { const a = rs() * Math.PI * 2, b = rs() * Math.PI * 0.5, r = 7600; pts.push(W / 2 + Math.cos(a) * Math.cos(b) * r, Math.sin(b) * r, H / 2 + Math.sin(a) * Math.cos(b) * r); }
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  mapGroup.add(new THREE.Points(gg, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false })));
  // vigas de metal segurando o teto de vidro
  const beam = mat(0x5b6472, { metalness: 0.6, roughness: 0.4 });
  for (const x of [W * 0.25, W * 0.5, W * 0.75]) { const b = new THREE.Mesh(new THREE.BoxGeometry(18, 14, H), beam); b.position.set(x, CEILING_Y.nave + 7, H / 2); b.castShadow = true; mapGroup.add(b); }
  for (const z of [H * 0.33, H * 0.66]) { const b = new THREE.Mesh(new THREE.BoxGeometry(W, 12, 14), beam); b.position.set(W / 2, CEILING_Y.nave + 6, z); b.castShadow = true; mapGroup.add(b); }
}

// ---------- floresta: árvores grandes (nas pontas das paredes e em volta do mapa) ----------
// árvore alta: tronco comprido e a copa lá em cima (não tampa a visão de quem está no chão)
function addTree(x, z, k, group) {
  const h = TREE.top + 20, trunk = new THREE.Mesh(new THREE.CylinderGeometry(7 * k, 12 * k, h * k, 9), mat(0x4a3220));
  trunk.position.set(x, h * k / 2, z);
  const leafA = mat(0x3f7d3a), leafB = mat(0x356b31), y0 = (h - 5) * k;
  const c1 = new THREE.Mesh(new THREE.IcosahedronGeometry(58 * k, 1), leafA); c1.position.set(x, y0 + 40 * k, z);
  const c2 = new THREE.Mesh(new THREE.IcosahedronGeometry(46 * k, 1), leafB); c2.position.set(x + 30 * k, y0 + 58 * k, z - 18 * k);
  const c3 = new THREE.Mesh(new THREE.IcosahedronGeometry(40 * k, 1), leafA); c3.position.set(x - 28 * k, y0 + 66 * k, z + 16 * k);
  for (const m of [trunk, c1, c2, c3]) { m.castShadow = m.receiveShadow = true; group.add(m); }
}
// mata fechada em volta do mapa: muitas árvores leves (instanciadas) tampando a visão de fora
function scatterOutside(W, H, n, near, far, seed, fn) {
  const rnd = seeded(seed);
  for (let i = 0, tries = 0; i < n && tries < n * 6; tries++) {
    const d = near + Math.pow(rnd(), 1.4) * (far - near), side = rnd() * (W + H) * 2;
    let x, z;
    if (side < W) { x = side; z = -d; } else if (side < W * 2) { x = side - W; z = H + d; } else if (side < W * 2 + H) { x = -d; z = side - W * 2; } else { x = W + d; z = side - W * 2 - H; }
    x += (rnd() - 0.5) * 80; z += (rnd() - 0.5) * 80;
    if (x > -near && x < W + near && z > -near && z < H + near) continue;
    fn(x, z, rnd, d); i++;
  }
}
function instanced(geo, material, list, shadow) {
  const m = new THREE.InstancedMesh(geo, material, list.length), o = new THREE.Object3D();
  list.forEach((t, i) => { o.position.set(t[0], t[1], t[2]); o.scale.set(t[3], t[4], t[5]); o.rotation.set(0, t[6] || 0, 0); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
  m.castShadow = !!shadow; m.receiveShadow = true; mapGroup.add(m); return m;
}
function buildForestOutside(W, H) {
  const far = new THREE.Mesh(new THREE.PlaneGeometry(18000, 18000), new THREE.MeshStandardMaterial({ color: 0x4f7f40, roughness: 1 }));
  far.rotation.x = -Math.PI / 2; far.position.set(W / 2, -0.6, H / 2); far.receiveShadow = true; mapGroup.add(far);
  const trunks = [], round = [], pine = [];
  scatterOutside(W, H, 620, 40, 1500, 612, (x, z, rnd) => {
    const k = 0.9 + rnd() * 0.9, h = 230 * k;
    trunks.push([x, h / 2, z, k, h, k]);
    if (rnd() < 0.5) round.push([x, h + 30 * k, z, 70 * k, 60 * k, 70 * k, rnd() * 3]);
    else pine.push([x, h * 0.55 + 90 * k, z, 62 * k, 260 * k, 62 * k, rnd() * 3]);
  });
  instanced(new THREE.CylinderGeometry(6, 10, 1, 6), mat(0x4a3220), trunks);
  instanced(new THREE.IcosahedronGeometry(1, 0), mat(0x3a7434), round);
  instanced(new THREE.ConeGeometry(1, 1, 7), mat(0x2f5f2c), pine);
  // arbustos na beirada de fora
  const bush = []; scatterOutside(W, H, 300, 30, 400, 77, (x, z, rnd) => { const k = 30 + rnd() * 40; bush.push([x, k * 0.4, z, k, k * 0.7, k]); });
  instanced(new THREE.IcosahedronGeometry(1, 0), mat(0x35682f), bush);
}
// neve: pinheiros cobertos de neve, pedras de gelo e montanhas brancas em volta
function buildSnowOutside(W, H) {
  const far = new THREE.Mesh(new THREE.PlaneGeometry(18000, 18000), new THREE.MeshStandardMaterial({ color: 0xeef4fa, roughness: 1 }));
  far.rotation.x = -Math.PI / 2; far.position.set(W / 2, -0.6, H / 2); far.receiveShadow = true; mapGroup.add(far);
  const trunks = [], cones = [], caps = [], ice = [];
  scatterOutside(W, H, 560, 40, 1500, 913, (x, z, rnd) => {
    const k = 0.8 + rnd() * 0.9;
    trunks.push([x, 30 * k, z, k, 60 * k, k]);
    for (let j = 0; j < 3; j++) { const y = (80 + j * 70) * k, r = (78 - j * 20) * k; cones.push([x, y, z, r, 120 * k, r, rnd() * 3]); caps.push([x, y + 32 * k, z, r * 0.72, 62 * k, r * 0.72, rnd() * 3]); }
  });
  instanced(new THREE.CylinderGeometry(6, 9, 1, 6), mat(0x5a4030), trunks);
  instanced(new THREE.ConeGeometry(1, 1, 8), mat(0x2d5a45), cones);
  instanced(new THREE.ConeGeometry(1, 1, 8), mat(0xf4f9ff, { roughness: 1 }), caps);
  scatterOutside(W, H, 160, 30, 900, 55, (x, z, rnd) => { const k = 20 + rnd() * 60; ice.push([x, k * 0.3, z, k, k * 0.8, k * 1.2, rnd() * 3]); });
  instanced(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xa9d4f2, roughness: 0.2, metalness: 0.1, flatShading: true }), ice);
  const hills = []; scatterOutside(W, H, 90, 50, 700, 31, (x, z, rnd) => { const k = 60 + rnd() * 120; hills.push([x, -k * 0.2, z, k * 1.6, k, k * 1.3]); });
  instanced(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xffffff, { roughness: 1 }), hills);
  const rnd = seeded(717), mnt = mat(0xe8eef6, { roughness: 1 });
  for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2 + rnd() * 0.2, d = 3200 + rnd() * 2200, m = new THREE.Mesh(new THREE.ConeGeometry(700 + rnd() * 900, 900 + rnd() * 900, 6), mnt); m.position.set(W / 2 + Math.cos(a) * d, 350, H / 2 + Math.sin(a) * d); mapGroup.add(m); }
}

// ---------- portais (oval brilhante, dá pra ver o outro lado) ----------
const PORTAL_COLORS = [[0x00e5ff, 0x00e5ff], [0xff40c8, 0xff40c8]]; // igual ao 2D: azul com azul, rosa com rosa
const PORTAL_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const PORTAL_FRAG = `uniform sampler2D uTex; uniform vec2 uRes; uniform vec3 uColor; uniform float uTime; uniform float uLive; uniform float uOpen; varying vec2 vUv; ${NOISE_GLSL}
void main(){
  vec2 q = vUv * 2.0 - 1.0; float e = length(q);
  if (e > 1.0) discard;
  float ang = atan(q.y, q.x);
  vec3 col;
  if (uLive > 0.5) col = texture2D(uTex, gl_FragCoord.xy / uRes).rgb;
  else { float s = fbm(vec2(ang * 1.2 + uTime * 0.9 - e * 5.0, e * 3.0 - uTime * 0.7)); col = mix(uColor * 0.15, uColor * 1.2, s * (0.4 + e * 0.8)); }
  float edge = smoothstep(0.78, 1.0, e);
  float n = fbm(vec2(ang * 3.0 + uTime * 1.5, e * 6.0 - uTime * 2.0));
  col = mix(col, uColor * (1.6 + n), edge * (0.55 + 0.35 * n));
  // fechado: tampa de metal escura (íris) com as lâminas girando
  float blades = smoothstep(0.02, 0.0, abs(fract((ang / 6.2832 + e * 0.35) * 8.0) - 0.5) - 0.46);
  vec3 shut = vec3(0.16, 0.17, 0.2) * (0.7 + 0.3 * vn(q * 6.0)) + vec3(0.05) * blades + vec3(0.25, 0.27, 0.3) * smoothstep(0.9, 1.0, e);
  col = mix(shut, col, uOpen);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const RIM_FRAG = `uniform vec3 uColor; uniform float uTime; uniform float uOpen; varying vec2 vUv; ${NOISE_GLSL}
void main(){
  vec2 q = (vUv * 2.0 - 1.0) * vec2(1.32, 1.24); float e = length(q), ang = atan(q.y, q.x);
  float n = fbm(vec2(ang * 2.5 + uTime * 1.8, uTime * 0.9)) * 0.65 + fbm(vec2(ang * 7.0 - uTime * 2.6, 3.1)) * 0.35;
  float outer = 1.04 + n * 0.2;
  float band = smoothstep(0.93, 1.0, e) * (1.0 - smoothstep(1.0, outer, e));
  float glow = exp(-abs(e - 1.0) * 7.0) * 0.45;
  float a = clamp(band * 1.6 + glow, 0.0, 1.0);
  gl_FragColor = vec4(uColor * (band * 2.4 + glow) , a * (0.25 + 0.75 * uOpen));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
function portalRTSize() { const v = new THREE.Vector2(); renderer.getDrawingBufferSize(v); return v; }
function disposePortals() {
  for (const v of portalViews) { v.rt.dispose(); v.mat.dispose(); v.rimMat.dispose(); }
  portalViews = [];
}
// todas as aberturas do mapa (em baixo e em cima) ganham moldura + superfície; abrem/fecham conforme o sim
function buildPortalViews(slots, frameTex, wallH) {
  const res = portalRTSize();
  const { rx, ry, cy } = PORTAL, UP = new THREE.Vector3(0, 1, 0);
  for (const d of slots) {
    const base = d.base || 0;
    const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(d.tx, 0, d.tz), UP, new THREE.Vector3(d.nx, 0, d.nz)).setPosition(d.cx, base, d.cz);
    const grp = new THREE.Group(); grp.matrixAutoUpdate = false; grp.matrix.copy(basis);
    // moldura: o pedaço de parede da abertura (do chão até o teto) com um furo oval na altura certa
    const shape = new THREE.Shape(); shape.moveTo(-d.half, -base); shape.lineTo(d.half, -base); shape.lineTo(d.half, wallH - base); shape.lineTo(-d.half, wallH - base); shape.lineTo(-d.half, -base);
    const hole = new THREE.Path(); hole.absellipse(0, cy, rx, ry, 0, Math.PI * 2, true); shape.holes.push(hole);
    const t = frameTex.clone(); t.needsUpdate = true; t.repeat.set(1 / 128, 1 / 128);
    const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: d.t, bevelEnabled: false, curveSegments: 48 }), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }));
    frame.position.z = -d.t; frame.castShadow = frame.receiveShadow = true; grp.add(frame);
    // tampa com a mesma textura da parede: portal fechado fica igual parede (ninguém sabe onde vai abrir)
    const coverShape = new THREE.Shape(); coverShape.absellipse(0, cy, rx + 1, ry + 1, 0, Math.PI * 2, false);
    const ct = frameTex.clone(); ct.needsUpdate = true; ct.repeat.set(1 / 128, 1 / 128);
    const cover = new THREE.Mesh(new THREE.ShapeGeometry(coverShape, 48), new THREE.MeshStandardMaterial({ map: ct, roughness: 0.8 }));
    cover.position.z = 0.05; cover.receiveShadow = true; grp.add(cover);
    const color = new THREE.Color(0x6b7280);
    const rt = new THREE.WebGLRenderTarget(Math.max(2, res.x >> 1), Math.max(2, res.y >> 1), { type: THREE.HalfFloatType });
    const m = new THREE.ShaderMaterial({ uniforms: { uTex: { value: rt.texture }, uRes: { value: res.clone() }, uColor: { value: color }, uTime: { value: 0 }, uLive: { value: 0 }, uOpen: { value: 0 } }, vertexShader: PORTAL_VERT, fragmentShader: PORTAL_FRAG });
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(rx * 2, ry * 2), m); surface.position.set(0, cy, 0.3); grp.add(surface);
    const rimMat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: color }, uTime: { value: 0 }, uOpen: { value: 0 } }, vertexShader: PORTAL_VERT, fragmentShader: RIM_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const rim = new THREE.Mesh(new THREE.PlaneGeometry(rx * 2 * 1.32, ry * 2 * 1.24), rimMat); rim.position.set(0, cy, 0.6); grp.add(rim);
    const light = new THREE.PointLight(color, 0, 380, 2); light.position.set(0, cy, 40); grp.add(light);
    mapGroup.add(grp);
    grp.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(surface);
    portalViews.push({ data: d, basis, grp, surface, rim, rt, mat: m, rimMat, bbox, light, cover, open: 0, link: -1 });
  }
}
// liga/desliga cada portal conforme os pares abertos no sim (cor do par: azul com azul, rosa com rosa)
function updatePortalViews(dt) {
  if (!portalViews.length) return;
  const open = new Map(); for (const q of sim.portals || []) if (q.i != null) open.set(q.i, q);
  for (const v of portalViews) {
    const q = open.get(v.data.i);
    v.link = q ? q.to : -1;
    if (q) v.mat.uniforms.uColor.value.set(PORTAL_COLORS[q.pair % 2][q.end]);
    v.open += ((q ? 1 : 0) - v.open) * Math.min(1, dt * 10);
    if (!q && v.open < 0.02) v.mat.uniforms.uColor.value.set(0x6b7280);
    v.mat.uniforms.uOpen.value = v.open; v.rimMat.uniforms.uOpen.value = v.open;
    v.light.intensity = 9000 * v.open; v.light.color.copy(v.mat.uniforms.uColor.value);
    v.cover.visible = v.open < 0.08; v.surface.visible = v.rim.visible = v.open >= 0.08; // fechado = parede lisa
  }
}
window.addEventListener('resize', () => {
  const res = portalRTSize();
  for (const v of portalViews) { v.rt.setSize(Math.max(2, res.x >> 1), Math.max(2, res.y >> 1)); v.mat.uniforms.uRes.value.copy(res); }
});
// desenha o que cada portal "vê" do outro lado (câmera virtual atrás do portal par)
const _vcam = new THREE.PerspectiveCamera(); _vcam.matrixAutoUpdate = false; _vcam.matrixWorldAutoUpdate = false;
const _pm1 = new THREE.Matrix4(), _pm2 = new THREE.Matrix4(), _rotY = new THREE.Matrix4().makeRotationY(Math.PI), _pvm = new THREE.Matrix4(), _frus = new THREE.Frustum();
const _clip = new THREE.Plane(), _cn = new THREE.Vector3();
const _blackTex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); _blackTex.needsUpdate = true;
function renderPortals(me, now) {
  if (!portalViews.length) return;
  const tsec = now / 1000;
  // durante os desenhos "do outro lado" nenhum portal lê textura de portal (senão o WebGL reclama de loop)
  for (const v of portalViews) { v.mat.uniforms.uLive.value = 0; v.mat.uniforms.uTex.value = _blackTex; v.mat.uniforms.uTime.value = tsec; v.rimMat.uniforms.uTime.value = tsec; }
  camera.updateMatrixWorld();
  _pvm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _frus.setFromProjectionMatrix(_pvm);
  const cp = camera.position, todo = [];
  for (const v of portalViews) {
    const d = v.data;
    if ((cp.x - d.cx) * d.nx + (cp.z - d.cz) * d.nz <= 0.5) continue; // atrás do portal
    if (Math.hypot(cp.x - d.cx, cp.z - d.cz) > 2800) continue;
    if (v.link < 0 || v.open < 0.5 || !_frus.intersectsBox(v.bbox) || !portalViews[v.link]) continue;
    todo.push(v);
  }
  if (!todo.length) return;
  const hidden = []; for (const k in VIEW) if (VIEW[k].visible) { VIEW[k].visible = false; hidden.push(VIEW[k]); }
  const meA = avatars.get('me'), meVis = meA ? meA.root.visible : false;
  if (meA) meA.root.visible = !!me.alive; // do outro lado do portal você se vê
  // lá dentro do portal desenha sem sombra (mais leve; ninguém repara)
  const shOn = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false;
  _vcam.projectionMatrix.copy(camera.projectionMatrix); _vcam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
  for (const v of todo) {
    const Q = portalViews[v.link], qd = Q.data;
    _pm1.copy(v.basis).invert();
    _pm2.multiplyMatrices(Q.basis, _rotY).multiply(_pm1).multiply(camera.matrixWorld);
    _vcam.matrixWorld.copy(_pm2); _vcam.matrixWorldInverse.copy(_pm2).invert();
    _cn.set(qd.nx, 0, qd.nz); _clip.set(_cn, -(qd.nx * qd.cx + qd.nz * qd.cz) + 0.5);
    renderer.clippingPlanes = [_clip];
    Q.surface.visible = false; Q.rim.visible = false;
    renderer.setRenderTarget(v.rt); renderer.render(scene, _vcam);
    Q.surface.visible = true; Q.rim.visible = true;
  }
  renderer.setRenderTarget(null); renderer.clippingPlanes = [];
  renderer.shadowMap.enabled = shOn;
  for (const v of todo) { v.mat.uniforms.uLive.value = 1; v.mat.uniforms.uTex.value = v.rt.texture; }
  for (const o of hidden) o.visible = true;
  if (meA) meA.root.visible = meVis;
}

// ---------- cidade à noite: poste de rua ----------
const LAMP_LIGHT = 42000;
function addLamp(x, z, dx, dz) {
  dx = dx == null ? 1 : dx; dz = dz || 0;
  const metal = mat(0x1f2430, { metalness: 0.5, roughness: 0.5 });
  const Hh = LAMP.h, O = LAMP.off, bx = x + dx * O, bz = z + dz * O;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.8, Hh + 8, 8), metal); pole.position.set(x, (Hh + 8) / 2, z);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 8, 8), metal); base.position.set(x, 4, z);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(O + 6, 3, 3), metal); arm.position.set(x + dx * O / 2, Hh + 8, z + dz * O / 2); arm.rotation.y = -Math.atan2(dz, dx);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(6, 13, 9, 10), metal); head.position.set(bx, Hh + 5, bz);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(8, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe2a0 })); bulb.position.set(bx, Hh, bz); bulb.scale.y = 0.65;
  for (const m of [pole, base, arm, head]) { m.castShadow = m.receiveShadow = true; mapGroup.add(m); }
  mapGroup.add(bulb);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xffd58a, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(75, 75, 1); halo.position.set(bx, Hh, bz); mapGroup.add(halo);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(200, 32), new THREE.MeshBasicMaterial({ map: GLOW_TEX, color: 0xffc56a, transparent: true, opacity: 0.17, depthWrite: false, blending: THREE.AdditiveBlending }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(bx, 0.7, bz); mapGroup.add(pool);
  const light = new THREE.PointLight(0xffd59a, LAMP_LIGHT, 760, 2); light.position.set(bx, Hh - 6, bz); mapGroup.add(light);
  lampLights.push({ bulb, light, halo, pool });
}

// teto das salas fechadas: placas com luminárias (na sala escura elas apagam junto com a luz)
let ceilLights = [], ceilPoints = [];
function buildCeiling(mapId, y, W, H) {
  const dark = mapId === 'escuro';
  const tex = canvasTex(256, 256, (g) => { g.fillStyle = dark ? '#1b1d22' : '#c9ced6'; g.fillRect(0, 0, 256, 256); g.strokeStyle = dark ? 'rgba(0,0,0,.5)' : 'rgba(60,65,75,.5)'; g.lineWidth = 4; for (let k = 0; k <= 256; k += 128) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 256); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(256, k); g.stroke(); } }, true);
  tex.repeat.set(W / 256, H / 256);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(W / 2, y, H / 2); ceil.receiveShadow = true;
  mapGroup.add(ceil);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: dark ? 0xfff1d0 : 0xeef4ff, emissiveIntensity: 1.6 });
  if (dark) {
    // sala escura: 3 fileiras de lâmpadas compridas no teto que clareiam a sala (piscam e apagam no evento)
    for (const z of [H * 0.2, H * 0.5, H * 0.8]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 5, 18), lampMat); strip.position.set(W / 2, y - 3, z); mapGroup.add(strip);
      for (const x of [W * 0.15, W * 0.38, W * 0.62, W * 0.85]) {
        const l = new THREE.PointLight(0xfff1d0, 30000, 650, 2); l.position.set(x, y - 30, z); mapGroup.add(l); ceilPoints.push(l);
      }
    }
  } else {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(140, 4, 34), lampMat); m.position.set(W * (i + 0.5) / 4, y - 2, H * (j + 0.5) / 3); mapGroup.add(m);
    }
  }
  ceilLights.push(lampMat);
}
// ---------- estruturas só do 3D ----------
// pedra com cantos irregulares (caverna)
function rockGeo(w, h, d, seed) {
  const g = new THREE.BoxGeometry(w, h, d, Math.max(1, Math.round(w / 40)), Math.max(1, Math.round(h / 40)), Math.max(1, Math.round(d / 40)));
  const pos = g.attributes.position, rnd = seeded(seed);
  for (let i = 0; i < pos.count; i++) { const k = 7; pos.setXYZ(i, pos.getX(i) + (rnd() - 0.5) * k, pos.getY(i) + (rnd() - 0.5) * k, pos.getZ(i) + (rnd() - 0.5) * k); }
  g.computeVertexNormals(); return g;
}
// caverna escura no meio da floresta, com 4 saídas
function buildCave(zone) {
  const rock = new THREE.MeshStandardMaterial({ color: 0x5c554c, roughness: 1, flatShading: true }), moss = mat(0x3f6b35);
  mapWalls.filter((R) => R.cave && !R.roof).forEach((R, i) => {
    const m = new THREE.Mesh(rockGeo(R.w + 10, CAVE.h + 12, R.h + 10, 90 + i), rock); m.position.set(R.x + R.w / 2, (CAVE.h + 12) / 2 - 2, R.y + R.h / 2);
    m.castShadow = m.receiveShadow = true; mapGroup.add(m);
  });
  const cx = (zone.x0 + zone.x1) / 2, cz = (zone.z0 + zone.z1) / 2, hw = (zone.x1 - zone.x0) / 2, hh = (zone.z1 - zone.z0) / 2;
  // teto: morro de pedra (dá pra subir), com musgo
  const dome = new THREE.SphereGeometry(1, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), pos = dome.attributes.position, rnd = seeded(404);
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); pos.setXYZ(i, pos.getX(i) * (1 + (rnd() - 0.5) * 0.08), y * (1 + (rnd() - 0.5) * 0.25), pos.getZ(i) * (1 + (rnd() - 0.5) * 0.08)); }
  dome.computeVertexNormals();
  const roof = new THREE.Mesh(dome, rock); roof.scale.set(hw + 30, 40, hh + 30); roof.position.set(cx, CAVE.h - 2, cz); roof.castShadow = roof.receiveShadow = true; mapGroup.add(roof);
  const under = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, hh * 2), new THREE.MeshStandardMaterial({ color: 0x2a2621, roughness: 1, side: THREE.DoubleSide }));
  under.rotation.x = Math.PI / 2; under.position.set(cx, CAVE.h - 1, cz); mapGroup.add(under);
  for (let i = 0; i < 14; i++) { const a = rnd() * Math.PI * 2, b = new THREE.Mesh(new THREE.IcosahedronGeometry(10 + rnd() * 16, 0), moss); b.position.set(cx + Math.cos(a) * hw * rnd(), CAVE.h + 20 + rnd() * 10, cz + Math.sin(a) * hh * rnd()); b.scale.y = 0.5; mapGroup.add(b); }
  // chão mais escuro lá dentro + uns cristais fraquinhos (dá pra enxergar pouco)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2 - 20, hh * 2 - 20), new THREE.MeshStandardMaterial({ color: 0x2b2a24, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0.5, cz); floor.receiveShadow = true; mapGroup.add(floor);
  const cm = new THREE.MeshStandardMaterial({ color: 0x5eead4, emissive: 0x14b8a6, emissiveIntensity: 1.2, roughness: 0.3 });
  for (const [ox, oz] of [[-0.7, -0.8], [0.7, 0.8], [-0.75, 0.55], [0.75, -0.55]]) {
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(7, 0), cm); c.scale.y = 2; c.position.set(cx + ox * hw, 12, cz + oz * hh); mapGroup.add(c);
    const l = new THREE.PointLight(0x2dd4bf, 1800, 160, 2); l.position.set(c.position.x, 30, c.position.z); mapGroup.add(l);
  }
}
// iglu redondo e opaco (blocos de neve), com 2 entradas
const SNOWBLOCK_TEX = canvasTex(256, 128, (g) => {
  g.fillStyle = '#eef6ff'; g.fillRect(0, 0, 256, 128); const rnd = seeded(12);
  g.strokeStyle = 'rgba(120,160,200,.45)'; g.lineWidth = 3;
  for (let y = 0; y <= 128; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  for (let y = 0; y < 128; y += 32) for (let x = (y / 32) % 2 ? 32 : 0; x <= 256; x += 64) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); }
  g.fillStyle = 'rgba(180,210,240,.25)'; for (let i = 0; i < 60; i++) { g.beginPath(); g.arc(rnd() * 256, rnd() * 128, 2 + rnd() * 8, 0, 7); g.fill(); }
}, true);
function buildIgloos(list) {
  const R = IGLOO.r, Hd = IGLOO.wall + IGLOO.roof, band = 88;
  const prof = (y) => R * Math.pow(Math.max(0, 1 - Math.pow(y / Hd, 2.6)), 0.5);
  const low = [], cap = [];
  for (let i = 0; i <= 10; i++) { const y = band * i / 10; low.push(new THREE.Vector2(prof(y), y)); }
  for (let i = 0; i <= 12; i++) { const y = band + (Hd - band) * i / 12; cap.push(new THREE.Vector2(Math.max(0.01, prof(y)), y)); }
  const tex = SNOWBLOCK_TEX.clone(); tex.needsUpdate = true; tex.repeat.set(4, 1.4);
  const m = new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.95, side: THREE.DoubleSide });
  const door = 28 * Math.PI / 180;
  for (const q of list) {
    const g = new THREE.Group(); g.position.set(q.x, 0, q.z);
    // a parte de baixo tem 2 vãos (entradas) virados pra direção do iglu; o topo é inteiro
    const a0 = -q.ang + Math.PI / 2; // LatheGeometry começa no +z e gira pro +x
    for (const [st, len] of [[a0 + door, Math.PI - 2 * door], [a0 + Math.PI + door, Math.PI - 2 * door]]) {
      const part = new THREE.Mesh(new THREE.LatheGeometry(low, 24, st, len), m); part.castShadow = part.receiveShadow = true; g.add(part);
    }
    const top = new THREE.Mesh(new THREE.LatheGeometry(cap, 36), m); top.castShadow = top.receiveShadow = true; g.add(top);
    // arco de gelo em volta de cada entrada
    for (const k of [0, Math.PI]) {
      const a = q.ang + k, arch = new THREE.Mesh(new THREE.TorusGeometry(36, 5, 6, 14, Math.PI), mat(0xd6ecff, { roughness: 0.4 }));
      arch.position.set(Math.cos(a) * (R - 6), 0, Math.sin(a) * (R - 6)); arch.rotation.y = -a + Math.PI / 2; arch.scale.y = band / 36; g.add(arch);
    }
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R - 8, 28), new THREE.MeshStandardMaterial({ color: 0xc9dced, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.6; floor.receiveShadow = true; g.add(floor);
    mapGroup.add(g);
  }
}
// nave: portas de correr (2 folhas que entram na parede)
let doorMeshes = [];
function buildDoors(list) {
  doorMeshes = [];
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xaab2bd, metalness: 0.6, roughness: 0.35 });
  const stripe = canvasTex(64, 64, (g) => { g.fillStyle = '#e0b020'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#1b1b1b'; for (let k = -64; k < 128; k += 20) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 10, 0); g.lineTo(k - 54, 64); g.lineTo(k - 64, 64); g.fill(); } }, true);
  for (const d of list) {
    const hgt = P.wallH - 2, lw = d.half, th = d.t - 12, leaves = [];
    for (const sgn of [-1, 1]) {
      const g = new THREE.Group();
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(th, hgt, lw), leafMat); leaf.position.y = hgt / 2; leaf.castShadow = leaf.receiveShadow = true; g.add(leaf);
      const st = stripe.clone(); st.needsUpdate = true; st.repeat.set(1, lw / 64);
      const band = new THREE.Mesh(new THREE.BoxGeometry(th + 1, 10, lw), new THREE.MeshStandardMaterial({ map: st })); band.position.y = 30; g.add(band);
      const win = new THREE.Mesh(new THREE.BoxGeometry(th + 1, 26, lw * 0.5), new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x1d6fa5, emissiveIntensity: 0.6, transparent: true, opacity: 0.7 })); win.position.y = 82; g.add(win);
      g.position.set(d.x, 0, d.z + sgn * lw / 2); mapGroup.add(g); leaves.push([g, sgn]);
    }
    const lampM = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(d.t + 4, 5, 10), lampM); lamp.position.set(d.x, P.wallH + 3, d.z); mapGroup.add(lamp);
    doorMeshes.push({ d, leaves, lampM });
  }
}
function updateDoors() {
  if (!doorMeshes.length) return;
  doorMeshes.forEach((D, i) => {
    const o = sim.doors && sim.doors[i] != null ? (typeof sim.doors[i] === 'number' ? sim.doors[i] : sim.doors[i].open) : 0, e = o * o * (3 - 2 * o);
    for (const [g, sgn] of D.leaves) g.position.z = D.d.z + sgn * (D.d.half / 2 + D.d.half * 0.96 * e);
    D.lampM.color.set(o > 0.5 ? 0x22c55e : 0xef4444);
  });
}
// portais: passarelas e pontes do andar de cima (dá pra ver de baixo)
function buildPlatforms() {
  const grate = canvasTex(128, 128, (g) => { g.fillStyle = '#9aa3ae'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#5b636e'; g.lineWidth = 3; for (let k = 0; k <= 128; k += 16) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 128); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(128, k); g.stroke(); } }, true);
  const edge = mat(0xe0b020);
  for (const R of mapWalls) {
    if (R.plat) {
      const t = grate.clone(); t.needsUpdate = true; t.repeat.set(R.w / 128, R.h / 128);
      const top = new THREE.MeshStandardMaterial({ map: t, metalness: 0.5, roughness: 0.5 }), sideM = new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.5, roughness: 0.5 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(R.w, PLAT.th, R.h), [sideM, sideM, top, sideM, sideM, sideM]);
      b.position.set(R.x + R.w / 2, R.y0 + PLAT.th / 2, R.y + R.h / 2); b.castShadow = b.receiveShadow = true; mapGroup.add(b);
      const lip = new THREE.Mesh(new THREE.BoxGeometry(R.w + 2, 3, R.h + 2), edge); lip.position.set(b.position.x, R.y0 - 1, b.position.z); mapGroup.add(lip);
    }
  }
  // ponte quebrada: pontas tortas e pedaços soltos na beira do buraco
  const G2 = mapInfo.world && mapInfo.world.bridgeGap;
  if (G2) {
    const broken = new THREE.MeshStandardMaterial({ color: 0x6b7280, metalness: 0.5, roughness: 0.6, flatShading: true }), rnd = seeded(77);
    for (const [ez, dir] of [[G2.z0, 1], [G2.z1, -1]]) for (let k = 0; k < 5; k++) {
      const w = (G2.x1 - G2.x0) / 5, b = new THREE.Mesh(new THREE.BoxGeometry(w * 0.95, PLAT.th * 0.7, 10 + rnd() * 16), broken);
      b.position.set(G2.x0 + w * (k + 0.5), PLAT.y - PLAT.th / 2 - rnd() * 6, ez + dir * (4 + rnd() * 6)); b.rotation.set(dir * (0.2 + rnd() * 0.5), 0, (rnd() - 0.5) * 0.4); mapGroup.add(b);
    }
    for (let k = 0; k < 7; k++) { const d = new THREE.Mesh(new THREE.DodecahedronGeometry(4 + rnd() * 6, 0), broken); d.position.set(G2.x0 + rnd() * (G2.x1 - G2.x0), 4, (G2.z0 + G2.z1) / 2 + (rnd() - 0.5) * 120); mapGroup.add(d); } // caiu lá embaixo
    const warn = new THREE.Mesh(new THREE.PlaneGeometry(G2.x1 - G2.x0, 8), new THREE.MeshBasicMaterial({ color: 0xe0b020 }));
    for (const ez of [G2.z0 - 6, G2.z1 + 6]) { const m2 = warn.clone(); m2.rotation.x = -Math.PI / 2; m2.position.set((G2.x0 + G2.x1) / 2, PLAT.y + 0.6, ez); mapGroup.add(m2); }
  }
  // luzes azuis embaixo das passarelas (o andar de baixo fica bonito e dá pra ver quem está em cima)
  const W = mapInfo.W, H = mapInfo.H;
  for (const [x, z] of [[W * 0.25, 90], [W * 0.75, 90], [W * 0.25, H - 90], [W * 0.75, H - 90], [90, H / 2], [W - 90, H / 2], [W / 2, H / 2]]) {
    const l = new THREE.PointLight(0x93c5fd, 9000, 520, 2); l.position.set(x, PLAT.y - 30, z); mapGroup.add(l);
  }
}
// nave: teto de vidro (com os furos dos meteoros)
let naveRoof = null;
function buildNaveRoof(holes) {
  const W = mapInfo.W, H = mapInfo.H, y = CEILING_Y.nave;
  if (naveRoof) { mapGroup.remove(naveRoof); naveRoof.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  const g = new THREE.Group(), shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.lineTo(W, 0); shape.lineTo(W, -H); shape.lineTo(0, -H); shape.lineTo(0, 0);
  for (const h of holes) {
    const path = new THREE.Path(), rnd = seeded(Math.round(h.x * 7 + h.z));
    for (let k = 0; k <= 18; k++) { const a = k / 18 * Math.PI * 2, r = h.r * (0.75 + rnd() * 0.45); const px = h.x + Math.cos(a) * r, pz = h.z + Math.sin(a) * r; if (k === 0) path.moveTo(px, -pz); else path.lineTo(px, -pz); }
    shape.holes.push(path);
    // cacos de vidro quebrado em volta do furo
    for (let i = 0; i < 10; i++) { const a = rnd() * Math.PI * 2, r = h.r * (1 + rnd() * 0.4), sh = new THREE.Mesh(new THREE.PlaneGeometry(6 + rnd() * 14, 3 + rnd() * 8), new THREE.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })); sh.position.set(h.x + Math.cos(a) * r, y - 2, h.z + Math.sin(a) * r); sh.rotation.set(-Math.PI / 2 + (rnd() - 0.5) * 0.6, 0, rnd() * 3); g.add(sh); }
  }
  const geo = new THREE.ShapeGeometry(shape, 1); geo.rotateX(-Math.PI / 2);
  const roof = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
  roof.position.y = y; g.add(roof);
  mapGroup.add(g); naveRoof = g; naveRoof.userData.n = holes.length;
}
// nave: meteoros (caindo e os que já caíram)
let meteorFx = { falling: [], rocks: new Map(), warn: [] };
const METEOR_EMIS = canvasTex(128, 128, (g) => { g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128); const rnd = seeded(8); g.strokeStyle = '#ff7a2a'; g.lineWidth = 3; for (let i = 0; i < 18; i++) { let x = rnd() * 128, y = rnd() * 128; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 30; y += (rnd() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); } });
function meteorMesh(r, seed) {
  const geo = new THREE.DodecahedronGeometry(r, 1), pos = geo.attributes.position, rnd = seeded(seed);
  for (let i = 0; i < pos.count; i++) { const k = 0.8 + rnd() * 0.35; pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.85, pos.getZ(i) * k); }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x3b3431, roughness: 1, flatShading: true, emissive: 0xffffff, emissiveMap: METEOR_EMIS, emissiveIntensity: 2 }));
  m.castShadow = m.receiveShadow = true; return m;
}
function updateMeteorFx(now, dt) {
  if (mapInfo.mapId !== 'nave') return;
  // pedras que já caíram (ficam de vez; o brilho da lava esfria)
  for (const q of sim.meteors || []) {
    const key = Math.round(q.x) + ':' + Math.round(q.z);
    if (!meteorFx.rocks.has(key)) {
      const m = meteorMesh(q.r, q.seed || 1); m.position.set(q.x, q.r * 0.55, q.z); m.rotation.set(0.3, (q.seed || 0) % 6, 0.2); mapGroup.add(m);
      const crater = new THREE.Mesh(new THREE.RingGeometry(q.r * 0.9, q.r * 1.7, 24), new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.55, depthWrite: false })); crater.rotation.x = -Math.PI / 2; crater.position.set(q.x, 0.8, q.z); mapGroup.add(crater);
      meteorFx.rocks.set(key, { m, t0: now });
    }
  }
  for (const R of meteorFx.rocks.values()) R.m.material.emissiveIntensity = 0.25 + 1.75 * Math.max(0, 1 - (now - R.t0) / 9000);
  if (naveRoof && (sim.ceilHoles || []).length !== naveRoof.userData.n) buildNaveRoof(sim.ceilHoles || []);
  // caindo: sombra no chão + a pedra pegando fogo vindo do céu
  const F = sim.meteorFall;
  if (F && !F.done) {
    if (!meteorFx.warn.length) for (const [x, z] of F.pts) {
      const sh = new THREE.Mesh(new THREE.CircleGeometry(METEOR.hitR, 32), new THREE.MeshBasicMaterial({ map: GLOW_TEX, color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.set(x, 1.5, z); scene.add(sh);
      const ring = new THREE.Mesh(new THREE.RingGeometry(METEOR.hitR - 5, METEOR.hitR, 40), new THREE.MeshBasicMaterial({ color: 0xff4d2e, transparent: true, opacity: 0.8, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.set(x, 1.7, z); scene.add(ring);
      const rock = meteorMesh(METEOR.r, Math.round(x)); scene.add(rock);
      const fire = new THREE.Sprite(new THREE.SpriteMaterial({ map: FIRE_TEX, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); fire.scale.setScalar(METEOR.r * 3.2); scene.add(fire);
      const trail = new THREE.Mesh(new THREE.CylinderGeometry(METEOR.r * 0.2, METEOR.r * 0.9, 900, 12, 1, true), new THREE.MeshBasicMaterial({ map: FLAME_TEX, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); scene.add(trail);
      meteorFx.warn.push({ x, z, sh, ring, rock, fire, trail, broke: false });
    }
    const left = (F.t1 != null ? F.t1 : sim.time + 1) - sim.time, k = Math.max(0, Math.min(1, 1 - left / (F.pre || 2.6)));
    for (const w of meteorFx.warn) {
      const sx = w.x + 1100, sy = 2800, sz = w.z - 700, ex = w.x, ey = METEOR.r * 0.55, ez = w.z, e = k * k;
      const px = sx + (ex - sx) * e, py = sy + (ey - sy) * e, pz = sz + (ez - sz) * e;
      w.rock.position.set(px, py, pz); w.rock.rotation.x += dt * 3; w.fire.position.set(px, py, pz);
      w.trail.position.set(px + 1100 / 3300 * 450, py + 2800 / 3300 * 450 * 0.95, pz - 700 / 3300 * 450); w.trail.lookAt(px + 1100, py + 2800, pz - 700); w.trail.rotateX(Math.PI / 2);
      w.sh.material.opacity = 0.2 + 0.6 * k; w.sh.scale.setScalar(0.4 + 0.6 * k); w.ring.material.opacity = Math.floor(now / 120) % 2 ? 0.9 : 0.35;
      if (!w.broke && py < CEILING_Y.nave + 40) { w.broke = true; glassShards(w.x, w.z, now); SFX.play('bounce', 1); }
    }
  } else if (meteorFx.warn.length) { for (const w of meteorFx.warn) scene.remove(w.sh, w.ring, w.rock, w.fire, w.trail); meteorFx.warn = []; }
}
function glassShards(x, z, now) {
  const objs = [];
  for (let i = 0; i < 26; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(5 + Math.random() * 12, 3 + Math.random() * 8), new THREE.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    s.position.set(x + (Math.random() - 0.5) * 80, CEILING_Y.nave, z + (Math.random() - 0.5) * 80);
    s.userData.v = [(Math.random() - 0.5) * 200, -50 - Math.random() * 150, (Math.random() - 0.5) * 200]; s.userData.r = [Math.random() * 8, Math.random() * 8];
    scene.add(s); objs.push(s);
  }
  effects.push({ t0: now, d: 1600, objs, upd: (t, dt) => { for (const s of objs) { const v = s.userData.v; v[1] -= 700 * dt; s.position.x += v[0] * dt; s.position.y = Math.max(1, s.position.y + v[1] * dt); s.position.z += v[2] * dt; s.rotation.x += s.userData.r[0] * dt; s.rotation.y += s.userData.r[1] * dt; s.material.opacity = 0.7 * (1 - t); } } });
}

function buildMap(mapId) {
  if (mapGroup) scene.remove(mapGroup);
  disposePortals(); lampLights = []; lavaFx = []; volcano = null; ceilLights = []; ceilPoints = []; doorMeshes = []; naveRoof = null;
  for (const w of meteorFx.warn) scene.remove(w.sh, w.ring, w.rock, w.fire, w.trail);
  meteorFx = { falling: [], rocks: new Map(), warn: [] };
  for (const fx of [tornadoFx, stormFx]) if (fx) scene.remove(fx.g);
  tornadoFx = null; stormFx = null;
  const world = world3D(mapId, G, MAPS, CFG);
  if (mapId === 'teste') return buildTestRoom(world);
  const map = MAPS[mapId], th = Object.assign({}, map.theme, THEME3D[mapId] || {}), W = world.W, H = world.H, T = world.t;
  mapGroup = new THREE.Group();
  const nightMap = mapId === 'cidade' || mapId === 'escuro';
  // céu/neblina de cada mapa
  const sky = map.space ? 0x020308 : nightMap ? 0x05060a : mapId === 'vulcao' ? 0x2a1712 : mapId === 'portal' ? 0x1b1f26 : mapId === 'deserto' ? 0xb9d3e8 : 0x9cc7ee;
  scene.background = new THREE.Color(sky);
  scene.fog = map.space ? null
    : mapId === 'deserto' ? new THREE.Fog(0xdcc9a2, 2000, 7600)
    : mapId === 'vulcao' ? new THREE.Fog(0x2a1712, 1800, 8000)
    : mapId === 'cidade' ? new THREE.Fog(0x05060a, 700, 2600)
    : new THREE.Fog(nightMap ? 0x05060a : sky, nightMap ? 300 : 1800, nightMap ? 1700 : 5200);
  mapWalls = world.walls;
  const holes = world.holes, dunes = mapId === 'deserto' ? new DuneField(mapWalls, W, H) : null;
  const borderH = world.borderH || P.borderH, closed = !!world.borderH;
  mapInfo = { mapId, world, holes, dunes, borderH, W, H };
  // chão
  if (dunes) mapGroup.add(buildDuneGround(th, dunes, W, H));
  else if (holes) buildVolcanoWorld(th, W, H);
  else {
    const gstyle = mapId === 'nave' ? 'deck' : mapId === 'portal' ? 'lab' : mapId === 'cidade' ? 'city' : null;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: groundTexture(th, mapId.length * 97, gstyle, { walls: mapWalls, W, H }), roughness: mapId === 'nave' ? 0.6 : 0.95, metalness: mapId === 'nave' ? 0.35 : 0 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(W / 2, 0, H / 2); ground.receiveShadow = true;
    mapGroup.add(ground);
  }
  // muros
  const style = WALL_STYLE[mapId] || 'brick';
  const wtex = wallTexture(th.wall, style), btex = wallTexture(th.border, style);
  let iceMat = null;
  for (const R of mapWalls) {
    if (R.pframe != null || R.plat || R.rail || R.igloo != null || R.cave || R.door3d != null) continue; // desenhados separados
    if (R.tree) { addTree(R.x + R.w / 2, R.y + R.h / 2, 1, mapGroup); continue; } // árvore da floresta
    if (dunes && DuneField.isDune(R)) continue; // virou montanha de areia
    if (R.space && !map.space) continue;
    const hgt = R.top != null ? R.top : R.border || R.space ? borderH : P.wallH;
    if (style === 'ice' && !R.border) {
      // gelo: dá pra ver um pouco o que está atrás de UMA parede, mas bem menos que antes
      if (!iceMat) iceMat = new THREE.MeshPhysicalMaterial({ map: wtex, color: 0x86b8df, transparent: true, opacity: 0.88, roughness: 0.14, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, envMap: iceEnvMap(), envMapIntensity: 1.2, emissive: 0x123a5c, emissiveIntensity: 0.12 });
      const t = wtex.clone(); t.needsUpdate = true; t.repeat.set(Math.max(R.w, R.h) / 140, 1);
      const m = iceMat.clone(); m.map = t;
      const box = new THREE.Mesh(new THREE.BoxGeometry(R.w, hgt, R.h), m);
      box.position.set(R.x + R.w / 2, hgt / 2, R.y + R.h / 2);
      box.castShadow = false; box.receiveShadow = true;
      mapGroup.add(box);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(R.w + 2, 6, R.h + 2), mat(0xffffff, { roughness: 1, emissive: 0x9fb8cc, emissiveIntensity: 0.25 })); // neve em cima
      cap.position.set(R.x + R.w / 2, hgt + 2.5, R.y + R.h / 2); cap.castShadow = true; cap.receiveShadow = true;
      mapGroup.add(cap);
      continue;
    }
    const y0 = R.y0 || 0, bh = hgt - y0;
    const hull = style === 'corridor' && (R.border || R.space);
    const base = hull ? HULL_TEX : R.border || R.space ? btex : wtex;
    const t = base.clone(); t.needsUpdate = true;
    if (hull) t.repeat.set(Math.max(R.w, R.h) / 150, bh / 180); // 2 fileiras de janela na parede alta
    else if (style === 'corridor') t.repeat.set(Math.max(R.w, R.h) / 150, 1);
    else if (style === 'lab' || style === 'sandstone') t.repeat.set(Math.max(R.w, R.h) / 128, bh / 128);
    else t.repeat.set(Math.max(R.w, R.h) / 64, bh / 64);
    const sideOpts = { map: t, roughness: style === 'corridor' ? 0.45 : 0.9, metalness: style === 'corridor' ? 0.35 : 0 };
    if (hull) Object.assign(sideOpts, { transparent: true, alphaTest: 0.02, emissive: 0x000000 });
    else if (style === 'corridor') { const e = CORRIDOR_EMIS.clone(); e.needsUpdate = true; e.repeat.copy(t.repeat); Object.assign(sideOpts, { emissive: 0xffffff, emissiveMap: e, emissiveIntensity: 1.2 }); }
    const side = new THREE.MeshStandardMaterial(sideOpts), top = mat(th.wallEdge, style === 'corridor' ? { metalness: 0.5, roughness: 0.45 } : {});
    const box = new THREE.Mesh(new THREE.BoxGeometry(R.w, bh, R.h), [side, side, top, top, side, side]);
    box.position.set(R.x + R.w / 2, y0 + bh / 2, R.y + R.h / 2);
    box.castShadow = !(closed && (R.border || R.space)); box.receiveShadow = true; // mapa fechado: a borda alta não faz sombra dentro
    mapGroup.add(box);
  }
  if (world.cave) buildCave(world.cave);
  if (world.igloos.length) buildIgloos(world.igloos);
  if (world.doors.length) buildDoors(world.doors);
  if (mapId === 'portal') buildPlatforms();
  // enfeites espalhados pelo chão
  const rnd = seeded(mapId.length * 31 + 5), cfg3 = world.cfg;
  for (let i = 0; i < 60; i++) {
    const x = 40 + rnd() * (W - 80), z = 40 + rnd() * (H - 80);
    if (!G.circleFree(x, z, 30, mapWalls.filter((R) => !(R.y0 > 100)), cfg3)) continue;
    if (holes && holes.some((h) => Math.hypot(h.x - x, h.z - z) < h.r + 30)) continue;
    if (world.cave && x > world.cave.x0 - 20 && x < world.cave.x1 + 20 && z > world.cave.z0 - 20 && z < world.cave.z1 + 20) continue;
    const gy = groundY(x, z);
    let obj = null;
    if (th.deco === 'rocks') { obj = new THREE.Mesh(new THREE.DodecahedronGeometry(6 + rnd() * 9, 0), mat(0xa47645)); obj.position.set(x, gy + 3, z); obj.rotation.set(rnd() * 3, rnd() * 3, 0); }
    else if (th.deco === 'snow') { obj = new THREE.Mesh(new THREE.SphereGeometry(14 + rnd() * 10, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xffffff)); obj.position.set(x, 0, z); obj.scale.y = 0.5; }
    else if (th.deco === 'tree') { // plantinhas e folhas baixinhas (não tampam nem o boneco pequeno)
      const k = 0.6 + rnd() * 0.5; obj = new THREE.Group();
      for (let j = 0; j < 3; j++) { const lf = new THREE.Mesh(new THREE.IcosahedronGeometry(6 * k, 0), mat(j % 2 ? 0x3f7d3a : 0x4f8f45)); lf.position.set((rnd() - 0.5) * 12, 3 * k, (rnd() - 0.5) * 12); lf.scale.y = 0.45; obj.add(lf); }
      obj.position.set(x, 0, z);
    }
    else if (th.deco === 'panels') { obj = new THREE.Mesh(new THREE.BoxGeometry(22, 12, 16), mat(0x6b7280, { metalness: 0.5, roughness: 0.4 })); obj.position.set(x, 6, z); } // caixote de carga
    else if (th.deco === 'ash') { obj = new THREE.Mesh(new THREE.DodecahedronGeometry(5 + rnd() * 8, 0), mat(0x3a2a24)); obj.position.set(x, 3, z); obj.rotation.set(rnd() * 3, rnd() * 3, 0); }
    if (obj) { obj.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; }); mapGroup.add(obj); }
    if (mapId === 'deserto' && rnd() < 0.35) { // alguns cactos aleatórios no deserto
      const cx = 40 + rnd() * (W - 80), cz = 40 + rnd() * (H - 80);
      if (G.circleFree(cx, cz, 20, mapWalls, cfg3)) {
        const cg = new THREE.Group(), cactusMat = mat(0x2f7d4f);
        const body = new THREE.Mesh(new THREE.CylinderGeometry(5, 6, 26 + rnd() * 14, 8), cactusMat); body.position.y = 13;
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.5, 14, 6), cactusMat); arm.position.set(6, 16, 0); arm.rotation.z = -0.9;
        cg.add(body, arm); cg.position.set(cx, groundY(cx, cz) - 1, cz);
        cg.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
        mapGroup.add(cg);
      }
    }
  }
  // teto que ricocheteia tiro (folhas da floresta / vidro da nave / teto da sala escura e dos portais)
  const ceilY = CEILING_Y[mapId];
  if (ceilY && (mapId === 'escuro' || mapId === 'portal')) buildCeiling(mapId, ceilY, W, H);
  else if (mapId === 'nave') buildNaveRoof([]);
  else if (ceilY) {
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ color: 0x2f6b34, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
    roof.rotation.x = -Math.PI / 2; roof.position.set(W / 2, ceilY, H / 2);
    mapGroup.add(roof);
  }
  // o que fica em volta de cada mapa
  if (mapId === 'deserto') buildDesertOutside(W, H);
  else if (mapId === 'floresta') buildForestOutside(W, H);
  else if (mapId === 'neve') buildSnowOutside(W, H);
  else if (map.space) buildMoonOutside(W, H);
  if (world.portalSlots.length) buildPortalViews(world.portalSlots, btex, borderH);
  // cidade à noite: postes que iluminam de verdade (atirar apaga por um tempo)
  if (world.lamps) for (const [x, z, dx, dz] of world.lamps) addLamp(x, z, dx, dz);
  // luz do ambiente de cada mapa
  hemi.color.set(0xffffff); hemi.groundColor.set(0x445566); sun.color.set(0xffffff);
  if (mapId === 'cidade') { hemi.intensity = 0.16; hemi.color.set(0x8fa6d8); sun.intensity = 0.06; }
  else if (map.space) { hemi.intensity = 0.55; hemi.color.set(0xc9d6ff); hemi.groundColor.set(0x2a2c30); sun.intensity = 3.0; }
  else if (mapId === 'vulcao') { hemi.intensity = 1.25; hemi.color.set(0xffc2a0); hemi.groundColor.set(0x4a2418); sun.intensity = 2.0; sun.color.set(0xffc8a0); }
  else if (mapId === 'portal') { hemi.intensity = 1.1; hemi.color.set(0xe8eefc); sun.intensity = 1.9; }
  else if (mapId === 'deserto') { hemi.intensity = 1.2; hemi.groundColor.set(0x8a6a44); sun.intensity = 2.6; sun.color.set(0xfff1d6); }
  else if (mapId === 'escuro') { hemi.intensity = 0.9; sun.intensity = 1.5; } // sala escura: um pouco mais escura mesmo com a luz acesa
  else { hemi.intensity = 1.3; sun.intensity = 2.3; }
  baseLight = { hemi: hemi.intensity, sun: sun.intensity };
  scene.add(mapGroup);
  sun.position.set(W / 2 - 600, 1500, H / 2 + 800); sun.target.position.set(W / 2, 0, H / 2);
}

// ---------- bonecos KayKit ----------
// personagens (KayKit Adventurers, CC0): todos usam o mesmo esqueleto e as mesmas animações
const CHAR_MODELS = { hood: ['/demo3d/models/Rogue_Hooded.glb', 'Ladino (capuz)'], rogue: ['/demo3d/models/Rogue.glb', 'Ladino'], knight: ['/demo3d/models/Knight.glb', 'Cavaleiro'], barbarian: ['/demo3d/models/Barbarian.glb', 'Bárbaro'], mage: ['/demo3d/models/Mage.glb', 'Maga'] };
const CHAR_IDS = Object.keys(CHAR_MODELS);
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
const modelLoading = {};
function loadModel(k) {
  if (!CHAR_MODELS[k]) k = 'hood';
  if (!modelLoading[k]) modelLoading[k] = new GLTFLoader().loadAsync(CHAR_MODELS[k][0]).then((g) => { BASE[k] = g; splitClips(g.animations); return g; });
  return modelLoading[k];
}
// 1ª pessoa: a besta (crossbow) igual à que o boneco segura em 3ª pessoa, no lugar do arco
function makeCrossbowView() {
  const src = BASE.hood && BASE.hood.scene.getObjectByName('2H_Crossbow'), G2 = VIEW.arco;
  if (!src || !G2 || G2.userData.cb) return;
  const geo = src.geometry; geo.computeBoundingBox();
  const bb = geo.boundingBox, size = bb.getSize(new THREE.Vector3()), ctr = bb.getCenter(new THREE.Vector3());
  const ax = [0, 1, 2].sort((a, b) => size.getComponent(b) - size.getComponent(a)); // [comprimento, largura, altura]
  const pos = geo.attributes.position, L = ax[0], Wd = ax[1], lo = bb.min.getComponent(L), hi = bb.max.getComponent(L), len = hi - lo;
  let sHi = 0, sLo = 0; // a ponta mais larga (onde ficam os braços da besta) é a frente
  for (let i = 0; i < pos.count; i++) { const u = pos.getComponent(i, L), w = Math.abs(pos.getComponent(i, Wd) - ctr.getComponent(Wd)); if (u > hi - len * 0.25) sHi = Math.max(sHi, w); if (u < lo + len * 0.25) sLo = Math.max(sLo, w); }
  const tgt = []; tgt[L] = new THREE.Vector3(0, 0, sHi >= sLo ? -1 : 1); tgt[Wd] = new THREE.Vector3(1, 0, 0); tgt[ax[2]] = new THREE.Vector3(0, 1, 0);
  const M = new THREE.Matrix4().makeBasis(tgt[0], tgt[1], tgt[2]);
  if (M.determinant() < 0) { tgt[Wd].x = -1; M.makeBasis(tgt[0], tgt[1], tgt[2]); }
  const k = 23 / len, mesh = new THREE.Mesh(geo, src.material.clone());
  mesh.position.copy(ctr).multiplyScalar(-1);
  const holder = new THREE.Group(); holder.add(mesh); holder.matrixAutoUpdate = false;
  holder.matrix.copy(M).multiply(new THREE.Matrix4().makeScale(k, k, k));
  for (const o of G2.userData.bow) o.visible = false, G2.remove(o);
  G2.add(holder); G2.rotation.z = 0; G2.userData.cb = holder;
  G2.traverse((o) => { if (o.userData.arrow) { o.position.y = size.getComponent(ax[2]) * k * 0.5 + 0.4; o.scale.set(0.7, 0.6, 0.7); } });
}
async function loadModels() {
  await loadModel('hood'); await loadModel('rogue'); // os outros carregam por trás (aparecem quando chegarem)
  makeCrossbowView();
  for (const k of CHAR_IDS) loadModel(k).catch((e) => console.warn('modelo', k, e));
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
    // roupa: a sua vem das configurações; bots sorteiam; no multiplayer vem do servidor
    const look = normLook(p.id === 'me' ? S.look : p.look || botLook(p.id + p.name));
    this.lookKey = JSON.stringify(look) + p.team;
    let key = look.m;
    if (!BASE[key]) { this.pending = key; loadModel(key); key = 'hood'; } // ainda carregando: usa o ladino por enquanto
    this.model = SkeletonUtils.clone(BASE[key].scene);
    dressModel(this.model, key, look, p.team, BASE);
    const box = new THREE.Box3().setFromObject(this.model);
    this.baseScale = CHAR_H / ((box.max.y - box.min.y) || 1);
    this.model.scale.setScalar(this.baseScale);
    this.items = {};
    this.model.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      if (['1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable', 'Knife_Offhand'].includes(o.name)) { this.items[o.name] = o; o.visible = false; }
    });
    this.root.add(this.model);
    // garrafinha de poção na mão direita (aparece só enquanto bebe)
    const hand = this.model.getObjectByName('handslotr') || this.model.getObjectByName('handr');
    if (hand) {
      const b = new THREE.Group(), s = 1 / this.baseScale;
      b.add(new THREE.Mesh(new THREE.SphereGeometry(4.2 * s, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe11d48, emissive: 0x9f1239, emissiveIntensity: 0.8, roughness: 0.2 })));
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(1.3 * s, 1.6 * s, 4.5 * s, 8), new THREE.MeshStandardMaterial({ color: 0xdbeafe, transparent: true, opacity: 0.6 })); neck.position.y = 5 * s; b.add(neck);
      b.visible = false; hand.add(b); this.bottle = b;
    }
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
    const wkey = p.weapon === 'primary' ? p.primary : p.weapon, drinking = (p.drinkUntil || 0) > sim.time;
    for (const k in this.items) this.items[k].visible = false;
    const item = this.items[HAND_ITEM[wkey]]; if (item && !drinking) item.visible = true;
    if (this.bottle) this.bottle.visible = drinking;
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
      else if (p.weapon === 'primary' && AIM_ANIM[p.primary] && !p.sprinting) this.play('upper', AIM_ANIM[p.primary], 0.15);
      else this.play('upper', this.curName.lower || 'Idle', 0.15, false, this.cur.lower ? this.cur.lower.getEffectiveTimeScale() : 1);
    }
    this.mixer.update(dt);
  }
  // congelado pela chuva da neve: fica azulado
  setFrozen(v) {
    if (this.frozen === v) return; this.frozen = v;
    this.model.traverse((o) => { if (o.isMesh && o.material.emissive) { o.material.emissive.set(v ? 0x3aa0ff : 0x000000); o.material.emissiveIntensity = v ? 0.55 : 1; } });
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
  g.position.set(s.x, groundY(s.x, s.z), s.z);
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
  const geo = new THREE.CircleGeometry(u.r, 24, 0, Math.PI * 2); geo.rotateX(-Math.PI / 2);
  // no deserto a área acompanha o morro de areia
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, groundY(u.x + pos.getX(i), u.z + pos.getZ(i)) + 0.8);
  const disc = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
  disc.position.set(u.x, 0, u.z);
  return disc;
}
const TEAM_EMIS = { A: 0x3b82f6, B: 0xef4444 }, TEAM_BALL = { A: 0x93c5fd, B: 0xfca5a5 };
// todo tiro tem a cor do seu time (qualquer arma) e um rastrinho atrás; o formato depende da arma:
// arco = flecha, estilingue = pedrinha meio quadrada, mão = bola de neve
const BULLET_GEO = {};
function bulletGeo(kind, r) {
  const key = kind + r; if (BULLET_GEO[key]) return BULLET_GEO[key];
  let g;
  if (kind === 'estilingue') {
    g = new THREE.BoxGeometry(r * 1.9, r * 1.6, r * 1.8, 2, 2, 2); const pos = g.attributes.position, rnd = seeded(5);
    for (let i = 0; i < pos.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(pos, i), l = v.length(), k = 0.78 + 0.22 * (r * 1.1 / l) + (rnd() - 0.5) * 0.12; pos.setXYZ(i, v.x * k, v.y * k, v.z * k); } // cantos arredondados, meio torto
    g.computeVertexNormals();
  } else g = new THREE.SphereGeometry(r * 1.2, 14, 10);
  return (BULLET_GEO[key] = g);
}
function makeBullet(b) {
  const team = b.team, col = TEAM_EMIS[team] || 0xffffff;
  if (b.kind === 'arco') { // flecha: haste, ponta e penas, tudo na cor do time
    const g = new THREE.Group(), body = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.9, roughness: 0.5 });
    const tipM = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.6, roughness: 0.3 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 30, 6), body); shaft.rotation.x = Math.PI / 2;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(2.6, 7, 8), tipM); tip.rotation.x = Math.PI / 2; tip.position.z = 17;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 6), tipM); ball.position.z = 14; // ponta de borracha
    g.add(shaft, tip, ball);
    for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.2, 6), body); f.position.z = -12; f.rotation.z = k * Math.PI * 2 / 3; f.position.x = Math.sin(k * Math.PI * 2 / 3) * 1.6; f.position.y = Math.cos(k * Math.PI * 2 / 3) * 1.6; g.add(f); }
    g.userData.orient = true; return g;
  }
  const snow = b.kind === 'mao';
  const m = new THREE.MeshStandardMaterial({ color: snow ? new THREE.Color(col).lerp(new THREE.Color(0xffffff), 0.35) : col, emissive: col, emissiveIntensity: snow ? 0.9 : 1.2, roughness: snow ? 0.95 : 0.55, flatShading: !snow });
  const s = new THREE.Mesh(bulletGeo(b.kind, b.r), m);
  if (!snow) s.userData.tumble = true;
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
  const sBall = new THREE.Mesh(bulletGeo('estilingue', 2.2), mat(0x93c5fd)); sBall.position.set(0, 8.6, 1.5); sBall.userData.pull = true; sBall.userData.tint = 1;
  add('estilingue', [m(new THREE.BoxGeometry(2.2, 10, 2.2), 0x8b5a2b, 0, -4, 0), f1, f2, band, sBall]);
  // bolinha na mão
  const snowB = new THREE.Mesh(new THREE.SphereGeometry(4.5, 14, 10), new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.95 })); snowB.position.set(0, 2.5, -3); snowB.userData.tint = 2;
  add('mao', [m(new THREE.BoxGeometry(7, 5, 10), 0xe0b08a, 0, -3, 2), snowB]);
  // arco
  const bowArc = new THREE.Mesh(new THREE.TorusGeometry(14, 0.9, 6, 20, Math.PI), mat(0x8b5a2b)); bowArc.rotation.z = Math.PI / 2;
  const str = m(new THREE.BoxGeometry(0.4, 28, 0.4), 0xf1f5f9, 0, 0, 0); str.userData.string = true;
  const arrow = m(new THREE.CylinderGeometry(0.6, 0.6, 30, 6), 0xe5d3a1, 0, 0, -8); arrow.rotation.x = Math.PI / 2; arrow.userData.arrow = true; arrow.userData.tint = 1;
  const bowG = add('arco', [bowArc, str, arrow]); bowG.rotation.z = 0.25; bowG.userData.bow = [bowArc, str];
  add('disco', [m(new THREE.CylinderGeometry(7, 7, 1.6, 16), 0x93c5fd, 0, 0, -2), m(new THREE.BoxGeometry(6, 4, 8), 0xe0b08a, 0, -3, 4)]);
  add('knife', [m(new THREE.BoxGeometry(1, 2.6, 16), 0xd1d5db, 0, 0, -8, { metalness: 0.8, roughness: 0.25 }), m(new THREE.BoxGeometry(2.2, 3, 6), 0x1f2937, 0, 0, 2)]);
  add('nade', [m(new THREE.IcosahedronGeometry(4.5, 1), 0x3f5f3a, 0, 0, -2), m(new THREE.TorusGeometry(1.6, 0.4, 5, 10), 0xd1d5db, 0, 4.8, -2), m(new THREE.BoxGeometry(6, 4, 8), 0xe0b08a, 0, -4, 3)]);
  add('smoke', [m(new THREE.CylinderGeometry(3.6, 3.6, 10, 10), 0x94a3b8, 0, 0, -2, { metalness: 0.4 }), m(new THREE.BoxGeometry(6, 4, 8), 0xe0b08a, 0, -5, 3)]);
  // poção: garrafinha de vidro com líquido vermelho (animação de beber em updatePotionView)
  const bottle = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.SphereGeometry(4.6, 14, 10), new THREE.MeshStandardMaterial({ color: 0xdbeafe, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1 }));
  const liquid = new THREE.Mesh(new THREE.SphereGeometry(4.1, 14, 10, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65), new THREE.MeshStandardMaterial({ color: 0xe11d48, emissive: 0x9f1239, emissiveIntensity: 0.9, roughness: 0.2 }));
  liquid.userData.liquid = true;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 5, 10), new THREE.MeshStandardMaterial({ color: 0xdbeafe, transparent: true, opacity: 0.45 })); neck.position.y = 6;
  const cork = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.3, 2.4, 8), mat(0x9a6b3f)); cork.position.y = 9.3; cork.userData.cork = true;
  bottle.add(glass, liquid, neck, cork); bottle.userData.bottle = true;
  const hand = m(new THREE.BoxGeometry(7, 5, 9), 0xe0b08a, 0, -5.5, 1.5);
  add('potion', [bottle, hand]);
}
let kick = 0, swing = 0, sprintFov = 0, adsK = 0, healFx = 0, caveK = 0, pendingKc = null;
// munição na mão da arma (1ª pessoa) na cor do seu time
let viewTeam = null;
function tintViewModels(team) {
  if (team === viewTeam) return; viewTeam = team;
  const col = new THREE.Color(TEAM_EMIS[team] || 0xffffff);
  for (const k in VIEW) VIEW[k].traverse((o) => {
    if (!o.userData.tint || !o.material) return;
    o.material.color.copy(o.userData.tint === 2 ? col.clone().lerp(new THREE.Color(0xffffff), 0.35) : col);
    if (o.material.emissive) { o.material.emissive.copy(col); o.material.emissiveIntensity = 0.35; }
  });
}

// rastro do tiro: linha fininha com as últimas posições
function updateTrail(m, team, x, y, z) {
  let tr = m.userData.trail;
  if (!tr) {
    const N = 9, arr = new Float32Array(N * 3); for (let i = 0; i < N; i++) { arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: TEAM_EMIS[team] || 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
    line.frustumCulled = false; scene.add(line);
    tr = m.userData.trail = { line, arr, N };
  }
  const a = tr.arr;
  if (Math.abs(a[0] - x) + Math.abs(a[2] - z) > 150) for (let i = 0; i < tr.N; i++) { a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z; } // passou pelo portal
  a.copyWithin(3, 0, (tr.N - 1) * 3); a[0] = x; a[1] = y; a[2] = z;
  tr.line.geometry.attributes.position.needsUpdate = true;
  tr.line.visible = m.visible;
}
function removeBulletMesh(m) { scene.remove(m); if (m.userData.trail) { scene.remove(m.userData.trail.line); m.userData.trail.line.geometry.dispose(); } }

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
  if (t.dataset.pane === 'p-look') renderLookFields();
  if (t.dataset.pane === 'p-mp' && $('mp-view-lobby').style.display === 'none') refreshRoomList();
}));

// ---------- multiplayer: menu (criar/entrar em sala, lobby, times, dono da sala) ----------
const ROUND_TIME_OPTS = [[0, 'Sem limite'], [60, '1 minuto'], [120, '2 minutos'], [180, '3 minutos'], [300, '5 minutos'], [600, '10 minutos']];
function roundTimeLabel(v) { const o = ROUND_TIME_OPTS.find((x) => x[0] === v); return o ? o[1] : (v ? v + 's' : 'Sem limite'); }
function mpStatus(msg, id) { const el = $(id || 'mp-status'); if (el) el.textContent = msg || ''; }
function switchMpView(v) {
  $('mp-view-menu').style.display = v === 'lobby' ? 'none' : 'grid';
  $('mp-view-lobby').style.display = v === 'lobby' ? 'grid' : 'none';
}
function ensureSocket() {
  if (socket) return socket;
  socket = io();
  // caiu a conexão e voltou: entra de novo na mesma sala sozinho (o servidor guarda seu lugar por 2 min)
  socket.on('connect', () => {
    if (!lastJoin || !room3d) return;
    socket.emit('3d_join_room', Object.assign({ clientId: window.PB.clientId(), look: S.look }, lastJoin), (r) => {
      if (!r || !r.ok) { mpStatus('A conexão caiu e não deu pra voltar pra sala.', 'mp-status'); leaveNetRoom(true); return; }
      myPid = r.you; room3d = r.state; renderLobby();
    });
  });
  socket.on('3d_room_state', (state) => { room3d = state; renderLobby(); });
  socket.on('3d_match_start', (d) => {
    const mine = room3d && room3d.members.find((m) => m.id === myPid);
    if (!mine || mine.status !== 'team') { mpStatus('A partida começou — escolha um time para entrar na próxima.', 'mp-status2'); return; }
    enterNetMatch(d);
    netMode = true;
    netRoundTime = d.roundTime || 0;
    $('h-clock').style.display = 'none'; // o tempo agora aparece no placar do modo (em cima, no meio)
    lockPointer();
  });
  socket.on('3d_match_end', (result) => {
    if (locked) { try { document.exitPointerLock(); } catch (e) {} }
    $('h-clock').style.display = 'none';
    showMenu(true);
    switchMpView('lobby');
    renderLobby();
    killcam.stop(); $('banner').style.display = 'none'; $('score').style.display = 'none';
    if (result) mpStatus('🏁 ' + resultText(result).replace(/<[^>]+>/g, ''), 'mp-status2');
  });
  socket.on('3d_state', (msg) => { if (netMode) applySnapshot(msg.s, msg.e); });
  socket.on('3d_toast', (msg) => mpStatus(msg, room3d ? 'mp-status2' : 'mp-status'));
  socket.on('3d_kicked', (msg) => { mpStatus(msg || 'Você foi desconectado da sala.', 'mp-status'); leaveNetRoom(true); });
  socket.on('3d_room_closed', () => { mpStatus('A sala foi fechada.', 'mp-status'); leaveNetRoom(true); });
  return socket;
}
// sai só da partida (continua na sala de espera); o jogo local volta a rodar por trás do menu
function leaveNetMatch() {
  if (socket) socket.emit('3d_leave_match');
  netMode = false; $('h-clock').style.display = 'none';
  newGame(); showMenu(true); switchMpView('lobby'); renderLobby();
}
window.__pb3dLeaveMatch = () => { if (socket && room3d && room3d.hostId === myPid) socket.emit('3d_end_match'); };
let lastJoin = null;
function leaveNetRoom(silent) {
  lastJoin = null;
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
  ensureSocket().emit('3d_join_room', { name, clientId: window.PB.clientId(), code, password: pass, look: S.look }, (r) => {
    if (!r || !r.ok) { mpStatus(MP_ERR[r && r.error] || 'Não foi possível entrar.'); return; }
    myPid = r.you; room3d = r.state; lastJoin = { name, code, password: pass };
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
  const bots = room3d.bots || { A: [], B: [] };
  $('mp-team-A').innerHTML = room3d.members.filter((m) => m.status === 'team' && m.team === 'A').map(memberRow).join('') + (bots.A || []).map(botRow).join('');
  $('mp-team-B').innerHTML = room3d.members.filter((m) => m.status === 'team' && m.team === 'B').map(memberRow).join('') + (bots.B || []).map(botRow).join('');
  const md = room3d.mode || 'tdm';
  if (isHost) {
    const F = (label, id, opts, val) => `<label class="field" style="grid-template-columns:130px 1fr"><span>${label}</span><select id="${id}">${opts.map(([v, t]) => `<option value="${v}" ${String(v) === String(val) ? 'selected' : ''}>${t}</option>`).join('')}</select><span></span></label>`;
    const nums = (arr) => arr.map((n) => [n, String(n)]);
    $('mp-host-settings').innerHTML =
      F('Mapa', 'mp-set-map', Object.keys(MAPS).map((k) => [k, esc(MAPS[k].name)]), room3d.map)
      + F('Modo', 'mp-set-mode', [['tdm', MODE_NAME.tdm], ['rounds', 'Rounds (eliminação)'], ['ffa', MODE_NAME.ffa], ['koth', MODE_NAME.koth]], md)
      + (md === 'tdm' || md === 'ffa' ? F('Abates pra vencer', 'mp-set-kills', nums([20, 25, 30, 50]), room3d.killLimit) : '')
      + (md === 'rounds' ? F('Rounds', 'mp-set-rounds', nums([1, 2, 3, 5, 7]), room3d.rounds) : '')
      + (md === 'koth' ? F('Pontos na colina', 'mp-set-hill', nums([50, 75, 100, 150]), room3d.hillTarget) : '')
      + (md !== 'rounds' ? F('Tempo da partida', 'mp-set-roundtime', ROUND_TIME_OPTS, room3d.roundTime) : '')
      + F('Bots no Azul', 'mp-set-botsA', nums([0, 1, 2, 3, 4, 5]), (bots.A || []).length)
      + F('Bots no Vermelho', 'mp-set-botsB', nums([0, 1, 2, 3, 4, 5]), (bots.B || []).length)
      + F('Nível dos bots', 'mp-set-level', [['iniciante', 'Iniciante'], ['amador', 'Amador'], ['pro', 'Profissional']], room3d.botLevel);
    const send = (extra) => socket.emit('3d_update_settings', extra);
    const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('change', () => send(fn(el.value))); };
    on('mp-set-map', (v) => ({ map: v })); on('mp-set-mode', (v) => ({ mode: v })); on('mp-set-kills', (v) => ({ killLimit: Number(v) }));
    on('mp-set-rounds', (v) => ({ rounds: Number(v) })); on('mp-set-hill', (v) => ({ hillTarget: Number(v) })); on('mp-set-roundtime', (v) => ({ roundTime: Number(v) }));
    on('mp-set-botsA', (v) => ({ botsA: Number(v) })); on('mp-set-botsB', (v) => ({ botsB: Number(v) })); on('mp-set-level', (v) => ({ botLevel: v }));
  } else {
    const lim = md === 'rounds' ? `${room3d.rounds} rounds` : md === 'koth' ? `até ${room3d.hillTarget} pontos` : `até ${room3d.killLimit} abates`;
    $('mp-host-settings').innerHTML = `<div class="wdesc">Mapa: ${esc(MAPS[room3d.map] ? MAPS[room3d.map].name : room3d.map)} · ${MODE_NAME[md]} (${lim}) · Bots: ${(bots.A || []).length} azul / ${(bots.B || []).length} vermelho (${room3d.botLevel})${md !== 'rounds' ? ' · Tempo: ' + roundTimeLabel(room3d.roundTime) : ''}</div>`;
  }
  const mine = room3d.members.find((m) => m.id === myPid);
  $('mp-start-row').innerHTML = room3d.phase === 'match'
    ? '<div class="row2"><span class="wdesc">⚔️ Partida em andamento...</span>'
      + (mine && mine.inMatch ? '<button class="btn" id="mp-leave-match-btn">Sair da partida</button>' : '')
      + (isHost ? '<button class="btn danger" id="mp-end-btn">⏹ Encerrar partida (todos)</button>' : '') + '</div>'
    : (isHost ? '<button class="btn primary" id="mp-start-btn">▶ Iniciar partida</button>' : '<div class="wdesc">Aguardando o dono da sala iniciar...</div>');
  if (isHost && room3d.phase !== 'match') $('mp-start-btn').addEventListener('click', () => socket.emit('3d_start_match'));
  if ($('mp-end-btn')) $('mp-end-btn').addEventListener('click', () => socket.emit('3d_end_match'));
  if ($('mp-leave-match-btn')) $('mp-leave-match-btn').addEventListener('click', leaveNetMatch);
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
  arco: 'Besta (crossbow): segure o clique para puxar e solte. Quanto mais puxa, mais rápida e reta a flecha. 2 ricochetes.',
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
bindSetting('o-allies', 'allies', null, () => newGame());
// modo de jogo (igual ao 2D) e o limite de cada um
function showModeFields() {
  const m = S.mode;
  $('f-kills').style.display = m === 'tdm' || m === 'ffa' ? '' : 'none';
  $('f-rounds').style.display = m === 'rounds' ? '' : 'none';
  $('f-hill').style.display = m === 'koth' ? '' : 'none';
  $('f-mtime').style.display = m === 'rounds' || m === 'livre' ? 'none' : '';
}
bindSetting('o-mode', 'mode', null, () => { showModeFields(); newGame(); });
for (const [id, k] of [['o-kills', 'kills'], ['o-rounds', 'rounds'], ['o-hill', 'hill'], ['o-mtime', 'mtime']]) bindSetting(id, k, null, () => newGame());
showModeFields();
// ---------- personagem: roupa e cores (prévia dos 2 times girando) ----------
const lookPrev = { renderer: null, scene: null, cam: null, figs: [], key: '', last: 0 };
function lookSwatches(k, kind) {
  const cols = (tm) => kind === 'leather' ? LEATHER(tm) : kind === 'hair' ? HAIR : TEAM_PAL[tm];
  const A = cols('A'), B = cols('B');
  return `<div class="swrow">${A.map((c, i) => `<button class="sw ${S.look[k] === i ? 'on' : ''}" data-lk="${k}" data-li="${i}" title="Tom ${i + 1}" style="background:linear-gradient(135deg, ${c} 50%, ${B[i]} 50%)"></button>`).join('')}</div>`;
}
function renderLookFields() {
  const L = S.look, sel = (id, opts, v) => `<select id="${id}">${Object.entries(opts).map(([k, t]) => `<option value="${k}" ${String(k) === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
  const row = (label, html) => `<label class="field" style="grid-template-columns:150px 1fr"><span>${label}</span>${html}</label>`;
  $('look-fields').innerHTML = row('Personagem', sel('lk-m', CHARS, L.m)) + row('Capa', sel('lk-cp', { 1: 'Com capa', 0: 'Sem capa' }, L.cp))
    + row('Macacão (roupa inteira)', sel('lk-o', { 0: 'Não (calça separada)', 1: 'Sim (calça da cor da camisa)' }, L.o)) + row('Chapéu extra', sel('lk-hat', HATS, L.hat))
    + SLOTS.filter(([k]) => !(k === 'p' && L.o) && !(k === 'hc' && L.hat === 'none')).map(([k, label, kind]) => row(label, lookSwatches(k, kind))).join('');
  for (const [id, k] of [['lk-m', 'm'], ['lk-cp', 'cp'], ['lk-o', 'o'], ['lk-hat', 'hat']]) $(id).addEventListener('change', (e) => { S.look[k] = k === 'm' || k === 'hat' ? e.target.value : Number(e.target.value); lookChanged(); });
  document.querySelectorAll('[data-lk]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); S.look[b.dataset.lk] = Number(b.dataset.li); lookChanged(); }));
}
function lookChanged() {
  S.look = normLook(S.look); save(); renderLookFields();
  if (socket && room3d) socket.emit('3d_set_look', S.look);
  if (S.look.m) loadModel(S.look.m).then(() => { lookPrev.key = ''; }).catch(() => {});
}
$('look-random').addEventListener('click', () => { S.look = botLook('me' + Math.random()); lookChanged(); });
$('look-reset').addEventListener('click', () => { S.look = Object.assign({}, LOOK_DEFAULT); lookChanged(); });
function drawLookPreview(now) {
  const cv = $('lookprev'); if (!cv || !BASE.hood || !$('p-look').classList.contains('on') || !menuOpen) return;
  const LP = lookPrev;
  if (!LP.renderer) {
    LP.renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); LP.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    LP.renderer.setSize(cv.width, cv.height, false); LP.renderer.outputColorSpace = THREE.SRGBColorSpace; LP.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    LP.scene = new THREE.Scene(); LP.scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6)); const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(60, 120, 90); LP.scene.add(d);
    LP.cam = new THREE.PerspectiveCamera(32, cv.width / cv.height, 1, 2000); LP.cam.position.set(0, 58, 250); LP.cam.lookAt(0, 34, 0);
  }
  const key = JSON.stringify(S.look) + !!BASE[S.look.m];
  if (key !== LP.key) {
    LP.key = key; for (const f of LP.figs) LP.scene.remove(f.g); LP.figs = [];
    const mk = BASE[S.look.m] ? S.look.m : 'hood';
    ['A', 'B'].forEach((tm, i) => {
      const model = SkeletonUtils.clone(BASE[mk].scene); dressModel(model, mk, S.look, tm, BASE);
      const box = new THREE.Box3().setFromObject(model); model.scale.setScalar(CHAR_H / ((box.max.y - box.min.y) || 1));
      model.traverse((o) => { if (['1H_Crossbow', 'Knife', 'Throwable', 'Knife_Offhand'].includes(o.name)) o.visible = false; });
      const g = new THREE.Group(); g.add(model); g.position.x = i ? 38 : -38; LP.scene.add(g);
      const mixer = new THREE.AnimationMixer(model); if (CLIPS.Idle) mixer.clipAction(CLIPS.Idle.full).play();
      LP.figs.push({ g, mixer });
    });
  }
  const dt = LP.last ? Math.min(0.1, (now - LP.last) / 1000) : 0; LP.last = now;
  for (const f of LP.figs) { f.mixer.update(dt); f.g.rotation.y += dt * 0.6; }
  LP.renderer.render(LP.scene, LP.cam);
}
bindSetting('o-kc', 'kc');
bindSetting('o-adszoom', 'adszoom');
bindSetting('o-level', 'level', null, () => { for (const p of sim.players.values()) if (p.bot) p.level = S.level; });
bindSetting('o-shadow', 'shadow', null, () => { renderer.shadowMap.enabled = S.shadow === '1'; scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)); }); });
bindSetting('o-fov', 'fov');
bindSetting('o-weapon', 'weapon', null, () => {
  if (netMode) { if (socket) socket.emit('3d_action', { t: 'primary', w: S.weapon }); }
  else { const me = sim.players.get('me'); if (me) sim.setPrimary(me, S.weapon); }
  $('w-desc').textContent = WDESC[S.weapon];
});
$('w-desc').textContent = WDESC[S.weapon];
bindSetting('o-sens', 'sens');
bindSetting('o-invert', 'invert');
bindSetting('o-mute', 'mute');
// ---------- sala de teste: velocidade / pulo / cadência / recarga ajustáveis ----------
bindSetting('o-die', 'die', null, () => { if (sim && !netMode) sim.godMode = S.die === '0'; });
// sons: várias opções pra cada coisa (toca a prévia ao trocar)
$('snd-list').innerHTML = Object.keys(SFX.LIB).map((k) => `<label class="field"><span>${SFX.NAMES[k]}</span><select data-snd="${k}">${SFX.LIB[k].map((v, i) => `<option value="${i}">${esc(v[0])}</option>`).join('')}</select><button class="btn" data-sndplay="${k}" style="padding:4px 10px">▶</button></label>`).join('');
document.querySelectorAll('[data-snd]').forEach((el) => {
  el.value = String(S.sfx[el.dataset.snd] || 0);
  el.addEventListener('change', () => { S.sfx[el.dataset.snd] = Number(el.value); save(); SFX.init(); SFX.play(el.dataset.snd, 1); });
});
document.querySelectorAll('[data-sndplay]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); SFX.init(); SFX.play(b.dataset.sndplay, 1); }));
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
$('btn-play').addEventListener('click', () => { SFX.init(); lockPointer(); });
function lockPointer() { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
canvas.addEventListener('click', () => { SFX.init(); if (!locked) lockPointer(); });
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  showMenu(!locked);
  if (!locked) { netFireHeld = false; aimHeld = false; const me = sim && sim.players.get('me'); if (me) me.input.fire = false; }
});

// ---------- controles ----------
let sim = null;
const keys = {};
// ---------- multiplayer: estado de rede ----------
let socket = null, netMode = false, myPid = null, room3d = null, netRoundTime = 0;
let netYaw = 0, netPitch = 0, netFireHeld = false, netInputT = 0, netRecvT = 0, netInterval = 130;
document.addEventListener('mousemove', (e) => {
  if (!locked || !sim) return;
  const s = S.sens * 0.0012 * (adsK > 0.5 && S.adszoom === '1' ? 0.65 : 1); // mirando com zoom: mira mais fina
  if (netMode) {
    netYaw += e.movementX * s;
    netPitch = Math.max(-1.35, Math.min(1.35, netPitch - e.movementY * s * (S.invert === '1' ? -1 : 1)));
    return;
  }
  const me = sim.players.get('me'); if (!me) return;
  me.yaw += e.movementX * s;
  me.pitch = Math.max(-1.35, Math.min(1.35, me.pitch - e.movementY * s * (S.invert === '1' ? -1 : 1)));
});
let aimHeld = false;
canvas.addEventListener('mousedown', (e) => {
  if (locked && e.button === 2) { aimHeld = true; return; }
  if (!locked || e.button !== 0) return;
  if (netMode) { netFireHeld = true; return; }
  const me = sim.players.get('me'); if (me) me.input.fire = true;
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 2) { aimHeld = false; return; }
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
  // conexão: ping até o servidor e onde ele fica
  $('board-net').innerHTML = netMode
    ? `📶 Ping: <b>${netPing != null ? netPing + ' ms' : 'medindo...'}</b> · Servidor: <b>${esc(netLoc || 'descobrindo...')}</b>` + (netPing != null ? (netPing < 60 ? ' <span style="color:#86efac">(perto)</span>' : netPing < 130 ? ' <span style="color:#facc15">(médio)</span>' : ' <span style="color:#f87171">(longe)</span>') : '')
    : '💻 Jogando offline, no seu computador (sem ping)';
  const row = (p) => `<tr class="${p.id === 'me' ? 'me' : ''} ${p.alive ? '' : 'dead'}"><td>${esc(p.name)}${p.alive ? '' : ' 💀'}</td><td>${p.k}</td><td>${p.d}</td><td>${p.a}</td><td>${(p.k / Math.max(1, p.d)).toFixed(2)}</td></tr>`;
  const head = '<table><thead><tr><th>Jogador</th><th>Abates</th><th>Mortes</th><th>Assist.</th><th>K/D</th></tr></thead><tbody>';
  if (sim.mode === 'ffa') {
    const list = [...sim.players.values()].sort((a, b) => b.k - a.k || a.d - b.d);
    $('board-body').innerHTML = `<h3>Cada um por si — até ${sim.killLimit} abates</h3>` + head + list.map(row).join('') + '</tbody></table>';
    return;
  }
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
// contador do evento do mapa no topo (igual ao 2D): "Furacão em 12s"
const HZ_TXT = { sand: ['🏜️ Tempestade de areia', 'chegando!', 'agora!'], tornado: ['🌪️ Furacão', 'nascendo!', 'solto!'], storm: ['🌬️ Tempestade congelante', 'olha a faixa!', 'soprando!'], dark: ['💡 Luz apaga', 'piscando!', 'apagou!'], lava: ['🌋 Erupção', 'o chão rachou!', 'agora!'], meteor: ['☄️ Meteoro', 'olha a sombra!', 'caiu!'] };
function hazardText() {
  const k = sim.hazard, T = HZ_TXT[k];
  if (k === 'portal') return sim.phase === 'playing' ? `🌀 Portais ${sim.portalPairs ? 'abertos' : 'fechados'} · ${sim.portalPairs ? 'fecham' : 'abrem'} em ${Math.max(0, Math.ceil(sim.portalN || 0))}s` : '';
  if (k === 'meteor' && (sim.meteors || []).length >= METEOR.max * 2) return '';
  if (!T || !sim.hz || !sim.hz[k]) return '';
  if (k === 'lava' && (sim.holes || []).length >= 4) return '';
  const cy = sim.cycle(k);
  return cy.s === 0 ? `${T[0]} em ${Math.ceil(cy.n)}s` : `${T[0]} — ${cy.s === 1 ? T[1] : T[2]}`;
}
function hud(me) {
  $('h-hz').textContent = hazardText();
  updateModeHud(me, performance.now());
  let h = ''; for (let i = 0; i < P.lives; i++) h += `<span class="${i < me.lives && me.alive ? '' : 'lost'}">❤️</span>`;
  $('h-lives').innerHTML = h;
  if (false && netMode && netRoundTime > 0) {
    const left = Math.max(0, Math.ceil(netRoundTime - sim.time));
    $('h-clock').textContent = '⏱️ ' + String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0');
  }
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
const WICON = { lancador: '🔫', estilingue: '🪃', mao: '✊', arco: '🏹', disco: '🥏', knife: '🔪', nade: '💣', lava: '🌋', meteor: '☄️' };

// ---------- jogo ----------
let prevPos = new Map(), acc = 0, last = performance.now(), fpsN = 0, fpsT = performance.now();
function newGame() {
  netMode = false;
  for (const a of avatars.values()) a.remove(); avatars.clear();
  for (const pool of [bulletMeshes, nadeMeshes, smokeMeshes, tombMeshes, pickupMeshes]) { for (const m of pool.values()) removeBulletMesh(m); pool.clear(); }
  buildMap(S.map);
  const isTestRoom = S.map === 'teste', map = MAPS[S.map];
  const wd = mapInfo.world;
  sim = new Sim3D(wd.walls, wd.W, wd.H, Object.assign(simOptions(wd), {
    godIds: S.die === '0' ? ['me'] : [], // "você pode morrer: não" = só você não morre; os bots morrem normal
    mode: isTestRoom ? 'livre' : S.mode, killLimit: Number(S.kills), rounds: Number(S.rounds), hillTarget: Number(S.hill), matchTime: Number(S.mtime),
    params: { speed: S.speed, jumpV: S.jumpv },
    weapons: S.wtune
  }));
  void map;
  sim.addPlayer({ id: 'me', name: 'Você', team: 'A', primary: S.weapon });
  const n = isTestRoom ? 0 : Number(S.bots), na = isTestRoom ? 0 : Number(S.allies), names = BOTS.randomNames(n + na);
  for (let i = 0; i < n; i++) sim.addPlayer({ id: 'bot' + i, name: names[i], team: 'B', bot: true, level: S.level });
  for (let i = 0; i < na; i++) sim.addPlayer({ id: 'ally' + i, name: names[n + i], team: 'A', bot: true, level: S.level }); // bots no seu time
  prevPos = new Map(); offlineEndAt = 0; killcam.clear(); tintViewModels('A');
}
let offlineEndAt = 0;
const lerp = (a, b, k) => a + (b - a) * k;

// ---------- multiplayer: entra numa partida em rede (dados vêm do servidor, sem física local) ----------
function enterNetMatch(info) {
  for (const a of avatars.values()) a.remove(); avatars.clear();
  for (const pool of [bulletMeshes, nadeMeshes, smokeMeshes, tombMeshes, pickupMeshes]) { for (const m of pool.values()) removeBulletMesh(m); pool.clear(); }
  buildMap(info.map); // o mundo é montado igual ao do servidor; o que muda (portais, buracos...) vem nos snapshots
  const wd = mapInfo.world;
  sim = new Sim3D(wd.walls, wd.W, wd.H, simOptions(wd));
  killcam.clear();
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
      look: sp.look || null, slowUntil: sp.slowUntil || 0, spin: sp.spin, sprinting: sp.sprinting, aiming: sp.aiming, aimT0: sp.aimT0 || 0, drinkUntil: sp.drinkUntil || 0,
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
  sim.hazard = snap.hazard; sim.sandK = snap.sandK; sim.lightOn = snap.lightOn; sim.lightS = snap.lightS || 0;
  sim.lamps = snap.lamps; sim.tornado = snap.tornado; sim.storm = snap.storm; sim.erupt = snap.erupt;
  if (snap.holes) sim.holes = snap.holes;
  // portais abertos, portas da nave e meteoros (o sim local só espelha)
  const pk = JSON.stringify(snap.portalPairs || null);
  if (pk !== sim._pk) { sim._pk = pk; sim.applyPortalPairs(snap.portalPairs || null); }
  sim.portalN = snap.portalN || 0;
  if (snap.doors) sim.doors.forEach((d, i) => { d.open = snap.doors[i] || 0; });
  sim.meteors = snap.meteors || []; sim.meteorFall = snap.meteorFall; sim.ceilHoles = snap.ceilHoles || [];
  sim.lastKill = snap.lastKill || null;
  for (const k of ['mode', 'phase', 'phaseUntil', 'hzStart', 'score', 'round', 'totalRounds', 'killLimit', 'hillTarget', 'matchTime', 'hill', 'result']) if (snap[k] !== undefined) sim[k] = snap[k];
  const prevRecvT = netRecvT; netRecvT = now;
  if (prevRecvT) netInterval = Math.max(60, Math.min(400, now - prevRecvT));
  killcam.record(sim);
  for (const e of evs || []) handleEvent(netRemapEvent(e), now);
}

// ---------- placar do modo, avisos grandes e a colina ----------
const MODE_NAME = { tdm: 'Mata-mata em equipe', rounds: 'Rounds', ffa: 'Cada um por si', koth: 'Rei da colina', livre: 'Treino livre' };
const TEAM_NAME = { A: 'Azul', B: 'Vermelho' };
const mmss = (t) => { t = Math.max(0, Math.ceil(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
let lastRoundEnd = null;
function resultText(r) {
  if (!r) return '';
  if (r.mode === 'ffa') {
    const w = r.players && r.players.find((p) => p.id === r.winner);
    return !r.winner ? 'Empate!' : netRemapId(r.winner) === 'me' ? 'Você venceu! 🏆' : `${esc(w ? w.name : '?')} venceu`;
  }
  const sc = r.score ? ` (${Math.floor(r.score.A)} x ${Math.floor(r.score.B)})` : '';
  return r.winner ? `Time ${TEAM_NAME[r.winner]} venceu!${sc}` : `Empate${sc}`;
}
function updateModeHud(me, now) {
  const m = sim.mode, el = sim.time - (sim.hzStart || 0), sc = sim.score || { A: 0, B: 0 };
  const box = $('score');
  if (!m || m === 'livre') box.style.display = 'none';
  else {
    let big = '', small = '';
    const tA = `<span class="tA">Azul ${Math.floor(sc.A)}</span>`, tB = `<span class="tB">${Math.floor(sc.B)} Vermelho</span>`;
    const tleft = sim.matchTime > 0 ? ` · ⏱ ${mmss(sim.matchTime - el)}` : '';
    if (m === 'tdm') { big = `${tA} x ${tB}`; small = `${MODE_NAME.tdm} · até ${sim.killLimit}${tleft}`; }
    else if (m === 'koth') {
      big = `${tA} x ${tB}`;
      const H = sim.hill; small = `${MODE_NAME.koth} · até ${sim.hillTarget}${tleft}` + (H ? (H.pv ? ` · nova colina em ${Math.ceil(H.n)}s` : ` · colina muda em ${Math.ceil(H.n)}s`) : '');
    } else if (m === 'rounds') { big = `Round ${sim.round}/${sim.totalRounds} · ${tA} x ${tB}`; small = sim.phase === 'playing' ? `⏱ ${mmss((sim.roundTime || 120) - el)}` : ''; }
    else if (m === 'ffa') {
      const ranked = [...sim.players.values()].sort((a, b) => b.k - a.k), lead = ranked[0];
      big = `Você: ${me.k} · Líder: ${lead ? (lead.id === 'me' ? 'você' : esc(lead.name)) + ' ' + lead.k : '-'}`; small = `${MODE_NAME.ffa} · até ${sim.killLimit}${tleft}`;
    }
    box.innerHTML = `${big}<small>${small}</small>`; box.style.display = 'block';
  }
  // aviso grande no meio da tela
  const ban = $('banner'); let txt = '';
  if (sim.result) txt = `${resultText(sim.result)}<small>fim da partida${netMode ? ' — voltando pra sala...' : ' — outra partida já vai começar'}</small>`;
  else if (sim.phase === 'countdown') txt = `Round ${sim.round}<small>começa em ${Math.max(1, Math.ceil(sim.phaseUntil - sim.time))}...</small>`;
  else if (sim.phase === 'roundEnd' && lastRoundEnd) txt = `${lastRoundEnd.winner ? 'Time ' + TEAM_NAME[lastRoundEnd.winner] + ' venceu o round' : lastRoundEnd.timeUp ? 'Acabou o tempo — empate' : 'Empate'}<small>Azul ${lastRoundEnd.score.A} x ${lastRoundEnd.score.B} Vermelho</small>`;
  ban.innerHTML = txt; ban.style.display = txt ? 'block' : 'none';
  updateHillFx(sim.hill, sim.hill ? (sim.hill.o !== undefined ? sim.hill.o : sim.hillOwner) : null, now);
}
let hillFx = null;
function updateHillFx(H, owner, now) {
  if (!H) { if (hillFx) { scene.remove(hillFx.g); hillFx = null; } return; }
  if (!hillFx) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(H.r - 7, H.r, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(H.r, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = disc.rotation.x = -Math.PI / 2; ring.position.y = 1.4; disc.position.y = 1.2;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(H.r, H.r, 160, 48, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    beam.position.y = 80;
    g.add(ring, disc, beam); scene.add(g);
    hillFx = { g, ring, disc, beam };
  }
  const col = owner === 'A' ? TEAM.A : owner === 'B' ? TEAM.B : owner === 'X' ? 0xfacc15 : 0xffffff;
  hillFx.g.position.set(H.x, groundY(H.x, H.z), H.z);
  for (const o of [hillFx.ring, hillFx.disc, hillFx.beam]) o.material.color.set(col);
  const blink = H.pv ? (Math.floor(now / 200) % 2 ? 0.25 : 0.9) : 0.8;
  hillFx.ring.material.opacity = blink; hillFx.disc.material.opacity = H.pv ? 0.05 : 0.14;
}

// ---------- killcam final: só a última kill do round/partida, pelos olhos de quem matou ----------
// grava os últimos segundos; no fim do round/partida repete a última kill, com câmera lenta e efeito de lente
// (zoom, distorção, cor separando nas bordas, vinheta e granulado) no finalzinho, perto do tiro acertar
const KC = { pre: 2.2, post: 0.45, slowFrom: 0.6, slowTo: 0.3, slow: 0.26 };
const killcam = {
  buf: [], active: null, pool: new Map(), lensK: 0,
  clear() { this.buf = []; this.stop(); },
  record(sim) {
    if (this.active) return; // durante o replay não grava (senão apaga o que está passando)
    const last = this.buf[this.buf.length - 1];
    if (last && sim.time - last.t < 1 / 70) return;
    if (last && sim.time < last.t) this.buf = [];
    const pl = new Map();
    for (const p of sim.players.values()) pl.set(p.id, [p.x, p.y, p.z, p.yaw, p.pitch, p.alive, sim.radius(p) / P.radius, p.primary]);
    this.buf.push({ t: sim.time, pl, b: sim.bullets.map((b) => [b.id, b.x, b.y, b.z, b.team, b.kind, b.vx, b.vy, b.vz, b.r]) });
    while (this.buf.length && sim.time - this.buf[0].t > 4) this.buf.shift();
  },
  // lk = { killer, victim, t } (última kill); só se a kill ainda estiver gravada
  startFinal(lk, now) {
    if (S.kc !== '1' || !lk || !lk.killer || this.buf.length < 6) return false;
    const killer = netRemapId(lk.killer), victim = netRemapId(lk.victim);
    if (!this.buf.some((f) => f.pl.has(killer)) || this.buf[0].t > lk.t - 0.2 || this.buf[this.buf.length - 1].t < lk.t - 0.05) return false;
    const kp = sim.players.get(killer), vp = sim.players.get(victim);
    this.active = { killer, victim, kt: lk.t, simT: Math.max(this.buf[0].t, lk.t - KC.pre), to: Math.min(this.buf[this.buf.length - 1].t, lk.t + KC.post), last: now };
    $('kc').style.display = 'block';
    $('kc-who').innerHTML = `${kp ? `<span class="t${kp.team}">${esc(kp.name)}</span>` : '?'} ➜ ${vp ? `<span class="t${vp.team}">${esc(vp.name)}</span>` : '?'}`;
    return true;
  },
  stop() {
    if (!this.active) return;
    this.active = null; this.lensK = 0; $('kc').style.display = 'none';
    for (const m of this.pool.values()) removeBulletMesh(m); this.pool.clear();
    for (const a of avatars.values()) a.model.scale.setScalar(a.baseScale);
  },
  // quadro no tempo t, interpolando entre 2 gravações (fica liso mesmo em câmera lenta)
  sample(t) {
    const B = this.buf; let i = 0;
    while (i < B.length - 1 && B[i + 1].t <= t) i++;
    const f0 = B[i], f1 = B[Math.min(B.length - 1, i + 1)], k = f1.t > f0.t ? Math.max(0, Math.min(1, (t - f0.t) / (f1.t - f0.t))) : 0;
    const pl = new Map();
    for (const [id, a] of f0.pl) {
      const b = f1.pl.get(id);
      if (!b || !a[5] || !b[5] || Math.abs(a[0] - b[0]) + Math.abs(a[2] - b[2]) > 150) { pl.set(id, a); continue; }
      let dy = b[3] - a[3]; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      pl.set(id, [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + dy * k, a[4] + (b[4] - a[4]) * k, a[5], a[6], a[7]]);
    }
    const nb = new Map(); for (const q of f1.b) nb.set(q[0], q);
    const bl = f0.b.map((q) => { const r = nb.get(q[0]); if (!r || Math.abs(q[1] - r[1]) + Math.abs(q[3] - r[3]) > 150) return q; return [q[0], q[1] + (r[1] - q[1]) * k, q[2] + (r[2] - q[2]) * k, q[3] + (r[3] - q[3]) * k, q[4], q[5], q[6], q[7], q[8], q[9]]; });
    return { pl, b: bl };
  },
  // aplica o replay (chamado logo antes de desenhar)
  apply(now) {
    const A = this.active; if (!A) return false;
    const dt = Math.min(0.1, (now - A.last) / 1000); A.last = now;
    const near = A.simT > A.kt - KC.slowFrom && A.simT < A.kt + KC.slowTo;
    A.simT += dt * (near ? KC.slow : 1);
    if (A.simT > A.to) { this.stop(); return false; }
    // lente: entra um pouco antes do tiro acertar, fica no ápice e sai depois
    const d = A.simT - A.kt, want = d < -0.75 ? 0 : d < -0.35 ? (d + 0.75) / 0.4 : d < 0.25 ? 1 : Math.max(0, 1 - (d - 0.25) / 0.2);
    this.lensK += (want - this.lensK) * Math.min(1, dt * 10);
    const f = this.sample(A.simT);
    for (const [id, a] of avatars) {
      const r = f.pl.get(id);
      if (!r) { a.root.visible = false; continue; }
      a.root.position.set(r[0], r[1], r[2]); a.model.rotation.y = Math.atan2(Math.cos(r[3]), Math.sin(r[3]));
      a.root.visible = r[5] && id !== A.killer; a.model.scale.setScalar(a.baseScale * r[6]);
      if (a.label) a.label.visible = false; a.ring.visible = false;
    }
    const seen = new Set();
    for (const b of f.b) {
      seen.add(b[0]);
      let m = this.pool.get(b[0]); if (!m) { m = makeBullet({ team: b[4], kind: b[5], r: b[9] }); scene.add(m); this.pool.set(b[0], m); }
      m.position.set(b[1], b[2], b[3]); if (m.userData.orient) m.lookAt(b[1] + b[6], b[2] + b[7], b[3] + b[8]);
      updateTrail(m, b[4], b[1], b[2], b[3]);
    }
    for (const [id, m] of this.pool) if (!seen.has(id)) { removeBulletMesh(m); this.pool.delete(id); }
    const k = f.pl.get(A.killer);
    if (k) {
      const dx = Math.cos(k[4]) * Math.cos(k[3]), dy = Math.sin(k[4]), dz = Math.cos(k[4]) * Math.sin(k[3]);
      camera.position.set(k[0], k[1] + P.eye * (k[6] > 0.9 ? 1 : 0.8), k[2]);
      camera.lookAt(camera.position.x + dx, camera.position.y + dy, camera.position.z + dz);
      camera.fov = S.fov * (1 - 0.38 * this.lensK); // zoom da lente
      camera.updateProjectionMatrix();
    }
    for (const k2 in VIEW) VIEW[k2].visible = false;
    for (const id of ['cross', 'banner', 'dead', 'score', 'bombwarn']) $(id).style.display = 'none';
    return true;
  }
};
// passada de "lente de câmera" (só na killcam final)
const lensRT = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType });
const lensMat = new THREE.ShaderMaterial({
  uniforms: { tDiffuse: { value: lensRT.texture }, uK: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uK; uniform float uTime; uniform float uAspect; varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime * 3.7) * 43758.5453); }
  void main(){
    vec2 c = vUv - 0.5; c.x *= uAspect; float r2 = dot(c, c);
    vec2 d = c * (1.0 + uK * 0.28 * r2); d.x /= uAspect;           // distorção de lente (barril)
    vec2 uv = 0.5 + d;
    float ca = uK * 0.012 * (0.3 + r2 * 3.0);                         // cor separando nas bordas
    vec3 col = vec3(texture2D(tDiffuse, uv + d * ca * 8.0).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d * ca * 8.0).b);
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, vec3(lum) * vec3(1.05, 1.0, 0.92), uK * 0.25);     // um pouco sem cor
    col *= 1.0 - uK * smoothstep(0.15, 0.75, length(c) * 1.1);         // vinheta
    col += (h(vUv * 800.0) - 0.5) * 0.035 * uK;                         // granulado
    float ring = smoothstep(0.012, 0.0, abs(length(c) - 0.43)) * uK * 0.35; col += vec3(ring); // borda da lente
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`,
  depthTest: false, depthWrite: false
});
const lensScene = new THREE.Scene(), lensCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
{ const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), lensMat); q.frustumCulled = false; lensScene.add(q); }
function renderWithLens(k, now) {
  const v = new THREE.Vector2(); renderer.getDrawingBufferSize(v);
  if (lensRT.width !== v.x || lensRT.height !== v.y) lensRT.setSize(v.x, v.y);
  renderer.setRenderTarget(lensRT); renderer.render(scene, camera); renderer.setRenderTarget(null);
  lensMat.uniforms.uK.value = k; lensMat.uniforms.uTime.value = now / 1000; lensMat.uniforms.uAspect.value = v.x / v.y;
  renderer.render(lensScene, lensCam);
}
// ping do multiplayer + onde fica o servidor (mostra no Tab)
let netPing = null, netLoc = null;
setInterval(() => {
  if (!socket || !socket.connected || !room3d) return;
  const t0 = performance.now();
  socket.emit('3d_ping', null, (r) => { netPing = Math.round(performance.now() - t0); if (r && r.loc) netLoc = r.loc; });
}, 2000);

// quem está debaixo da mira (pra mostrar o nome nos mapas escuros)
const _cdir = new THREE.Vector3();
function aimedPlayer() {
  camera.getWorldDirection(_cdir);
  const o = camera.position, dx = _cdir.x, dy = _cdir.y, dz = _cdir.z;
  const best = sim.raycast(o.x, o.y, o.z, dx, dy, dz, 4000, 'me');
  let id = null;
  for (const q of sim.players.values()) {
    if (q.id === 'me' || !q.alive) continue;
    const r = sim.radius(q), h = sim.heightOf(q), fx = o.x - q.x, fz = o.z - q.z;
    const a = dx * dx + dz * dz, b = 2 * (fx * dx + fz * dz), c = fx * fx + fz * fz - r * r, disc = b * b - 4 * a * c;
    if (a < 1e-9 || disc < 0) continue;
    const t = (-b - Math.sqrt(disc)) / (2 * a), y = o.y + dy * t;
    if (t > 0 && Math.abs(t - best) < 3 && y >= q.y && y <= q.y + h) id = q.id;
  }
  return id;
}
// está na luz? (sala escura com a luz acesa; cidade: perto de um poste aceso ou bem perto de você)
function litAt(p) {
  if (mapInfo.mapId === 'escuro') return sim.lightS === 0;
  const me = sim.players.get('me');
  if (me && Math.hypot(me.x - p.x, me.z - p.z) < 110) return true;
  for (const L of sim.lamps || []) if (sim.time >= L.offUntil && Math.hypot(L.x + (L.dx != null ? L.dx : 1) * LAMP.off - p.x, L.z + (L.dz || 0) * LAMP.off - p.z) < 230) return true;
  return false;
}
// barra de força do tiro mirando (embaixo da mira)
function drawPowerBar(ctx, k) {
  const w = 86, h = 7, x = 120 - w / 2, y = 120 + 40;
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#facc15'); g.addColorStop(1, '#f97316');
  ctx.fillStyle = g; ctx.fillRect(x, y, w * k, h);
  if (k >= 1) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.5; ctx.strokeRect(x - 1, y - 1, w + 2, h + 2); }
  ctx.font = '700 10px Segoe UI, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.textAlign = 'center'; ctx.fillText(k >= 1 ? 'FORÇA MÁXIMA' : 'FORÇA', 120, y + h + 12);
}
// 1ª pessoa bebendo: leva a garrafa à boca, inclina, o líquido acaba e abaixa (u = 0..1; -1 = só segurando)
function updatePotionView(vg, u, now) {
  const e = (a, b) => Math.max(0, Math.min(1, (u - a) / (b - a)));
  const raise = u < 0 ? 0 : e(0, 0.22) * (1 - e(0.82, 1)), tilt = u < 0 ? 0 : e(0.15, 0.4) * (1 - e(0.8, 0.95));
  vg.position.set(lerp(7, 1.5, raise), lerp(-8, -6.5, raise) + (u < 0 ? Math.sin(now / 400) * 0.3 : 0), lerp(-20, -17, raise));
  vg.rotation.set(tilt * 1.2, 0, lerp(0.15, -0.1, raise)); vg.scale.setScalar(0.8);
  vg.traverse((o) => {
    if (o.userData.liquid) { const left = u < 0 ? 1 : 1 - e(0.3, 0.8); o.scale.set(1, Math.max(0.05, left), 1); o.visible = left > 0.06; }
    if (o.userData.cork) o.visible = u < 0 || u < 0.12;
  });
}
function frame(now) {
  drawLookPreview(now);
  const dtR = Math.min(0.1, (now - last) / 1000);
  acc += dtR; last = now;
  const me = sim.players.get('me');
  if (!me) { requestAnimationFrame(frame); return; } // multiplayer: ainda não estou numa partida (na sala de espera)
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), sd = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  me.input.fwd = locked ? f : 0; me.input.side = locked ? sd : 0;
  me.input.sprint = locked && !!(keys.ShiftLeft || keys.ShiftRight); // Shift = correr (sem atirar)
  me.input.aim = locked && aimHeld; // botão direito = mirar
  if (!locked) me.input.fire = false;
  if (netMode) {
    me.yaw = netYaw; me.pitch = netPitch;
    if (locked && socket && now - netInputT > 50) {
      netInputT = now;
      socket.emit('3d_input', { fwd: me.input.fwd, side: me.input.side, fire: netFireHeld, sprint: me.input.sprint, aim: me.input.aim, yaw: netYaw, pitch: netPitch });
    }
  } else {
    while (acc >= STEP) {
      prevPos = new Map();
      for (const p of sim.players.values()) prevPos.set(p.id, [p.x, p.y, p.z]);
      for (const b of sim.bullets) prevPos.set('b' + b.id, [b.x, b.y, b.z]);
      for (const g of sim.nades) prevPos.set('n' + g.id, [g.x, g.y, g.z]);
      const evs = sim.step(STEP);
      killcam.record(sim);
      for (const e of evs) handleEvent(e, now);
      acc -= STEP;
    }
    if (offlineEndAt && now > offlineEndAt && !killcam.active) { newGame(); requestAnimationFrame(frame); return; } // acabou a partida: começa outra
  }
  const k = netMode ? Math.min(1, (now - netRecvT) / netInterval) : acc / STEP;
  // (passou por portal = pulo grande: não suaviza, senão risca o mapa)
  const ip = (id, o) => { const p0 = prevPos.get(id); return p0 && Math.abs(p0[0] - o.x) + Math.abs(p0[2] - o.z) < 150 ? [lerp(p0[0], o.x, k), lerp(p0[1], o.y, k), lerp(p0[2], o.z, k)] : [o.x, o.y, o.z]; };
  const firstPerson = S.cam === '1';
  // tempestade de areia (deserto): igual à versão antiga — a areia fecha a neblina no mapa todo (não deixa lento)
  if (sim.hazard === 'sand' && scene.fog) {
    const sk = sim.sandK || 0;
    scene.fog.color.set(sk > 0.01 ? 0xd8b878 : 0xdcc9a2);
    scene.fog.near = lerp(2000, 120, sk); scene.fog.far = lerp(7600, 700, sk);
  }
  // luz do ambiente: sala escura (pisca 1 s e apaga) e caverna da floresta (mais escura lá dentro)
  let lk = 1;
  if (sim.hazard === 'dark') {
    const on = sim.lightS === 1 ? Math.random() < 0.45 : sim.lightS !== 2;
    lk = on ? 1 : 0.035;
    for (const m of ceilLights) m.emissiveIntensity = on ? 1.4 : 0;
    for (const l of ceilPoints) l.intensity = on ? 24000 : 0;
  }
  const cz = mapInfo.world && mapInfo.world.cave, cp = camera.position;
  caveK += ((cz && cp.x > cz.x0 && cp.x < cz.x1 && cp.z > cz.z0 && cp.z < cz.z1 && cp.y < CAVE.h ? 1 : 0) - caveK) * Math.min(1, dtR * 4);
  lk *= 1 - 0.7 * caveK;
  hemi.intensity = baseLight.hemi * lk; sun.intensity = baseLight.sun * lk;
  // furacão (floresta), tempestade congelante (neve), portais, portas e meteoros (nave)
  updateTornadoFx(sim.tornado, now, dtR);
  updateStormFx(sim.storm, now, dtR);
  updatePortalViews(dtR); updateDoors(); updateMeteorFx(now, dtR);
  // vulcão: quando a erupção abre um buraco novo, refaz o chão
  if (volcano) {
    if (sim.holes && sim.holes.length !== volcano.holeCount) rebuildVolcanoHoles(sim.holes);
    updateEruptWarn(sim.erupt, now);
    volcano.lakeMat.uniforms.uTime.value = now / 1000;
    if (volcano.clouds) volcano.clouds.rotation.y += dtR * 0.006;
  }
  // cidade à noite: cada poste liga/desliga conforme foi atirado ou não
  if (sim.lamps && sim.lamps.length === lampLights.length) {
    for (let i = 0; i < lampLights.length; i++) {
      const on = sim.time >= sim.lamps[i].offUntil, L = lampLights[i];
      L.light.intensity = on ? LAMP_LIGHT : 0;
      L.bulb.material.color.set(on ? 0xffe2a0 : 0x33302a);
      L.halo.visible = on; L.pool.visible = on;
    }
  }
  // vulcão: lava viva lá embaixo, brasas subindo e a luz tremendo
  if (lavaFx.length) {
    const ts = now / 1000;
    for (const L of lavaFx) {
      L.light.intensity = 22000 * (0.85 + Math.sin(ts * 3.1 + L.h.x) * 0.1 + Math.sin(ts * 7.3 + L.h.z) * 0.05);
      L.glow.material.opacity = 0.3 + Math.sin(ts * 2.2 + L.h.z) * 0.06;
      const pos = L.embers.geometry.attributes.position.array;
      for (let i = 0; i < L.eSeed.length; i++) {
        const [a, d, ph, sp] = L.eSeed[i], t = (ts * 0.35 * sp + ph) % 1;
        pos[i * 3] = L.h.x + Math.cos(a + t * 2) * d; pos[i * 3 + 1] = -HOLE.depth - 160 + t * (HOLE.depth + 250); pos[i * 3 + 2] = L.h.z + Math.sin(a + t * 2) * d;
      }
      L.embers.geometry.attributes.position.needsUpdate = true;
    }
  }

  // mapas escuros: sem nome e sem círculo no chão (entregavam onde o inimigo estava);
  // o nome só aparece com a mira em cima do inimigo e se ele estiver na luz
  const darkMap = mapInfo.mapId === 'cidade' || mapInfo.mapId === 'escuro';
  const aimed = darkMap ? aimedPlayer() : null;
  const myLookKey = JSON.stringify(normLook(S.look));
  // bonecos (o corpo some quando morre; fica a lápide)
  for (const p of sim.players.values()) {
    let a = avatars.get(p.id);
    if (a && ((a.pending && BASE[a.pending]) || (p.id === 'me' && a.lookKey !== myLookKey + p.team) || (p.look && p.id !== 'me' && a.lookKey !== JSON.stringify(normLook(p.look)) + p.team))) { a.remove(); avatars.delete(p.id); a = null; }
    if (!a) { a = new Avatar(p); avatars.set(p.id, a); }
    const [x, y, z] = ip(p.id, p);
    a.root.position.set(x, y, z);
    a.model.rotation.y = Math.atan2(Math.cos(p.yaw), Math.sin(p.yaw));
    const sc = sim.radius(p) / P.radius;
    a.model.scale.setScalar(a.baseScale * sc); a.ring.scale.setScalar(sc);
    a.root.visible = p.alive && !(p.id === 'me' && firstPerson) && !(sim.time < p.protectUntil && Math.floor(now / 100) % 2 === 0);
    a.ring.visible = !darkMap;
    if (a.label) a.label.visible = !darkMap || (aimed === p.id && litAt(p));
    a.setFrozen(sim.time < (p.slowUntil || 0));
    a.update(p, sim, dtR, now);
  }
  // áreas de reabastecimento (granada/fumaça e poção)
  for (const u of sim.pickups) {
    let m = pickupMeshes.get(u.id);
    if (!m) { m = makePickup(u); scene.add(m); pickupMeshes.set(u.id, m); }
    const ready = sim.time >= u.cdUntil;
    m.material.opacity = ready ? 0.55 + Math.sin(now / 260) * 0.15 : 0.12;
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
    const [x, y, z] = ip('b' + b.id, b); m.position.set(x, y, z); m.visible = !killcam.active;
    if (m.userData.orient) m.lookAt(x + b.vx, y + b.vy, z + b.vz);
    if (m.userData.spin) m.rotation.y += dtR * 20;
    if (m.userData.tumble) { m.rotation.x += dtR * 9; m.rotation.y += dtR * 6; }
    updateTrail(m, b.team, x, y, z);
  }
  for (const [id, m] of bulletMeshes) if (!bseen.has(id)) { removeBulletMesh(m); bulletMeshes.delete(id); }
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
    const e = effects[i], t = Math.max(0, (now - e.t0) / e.d);
    if (e.upd) { if (t >= 1) { for (const o of e.objs) scene.remove(o); effects.splice(i, 1); } else e.upd(t, dtR); continue; }
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
  sprintFov += ((me.sprinting ? 7 : 0) - sprintFov) * Math.min(1, dtR * 8);
  adsK += ((me.aiming && me.alive ? 1 : 0) - adsK) * Math.min(1, dtR * 12);
  camera.fov = (S.fov + sprintFov) * (S.adszoom === '1' ? 1 - 0.4 * adsK : 1); // mirando: zoom (dá pra desligar nas configurações)
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
  // arma na tela (bebendo: a garrafinha)
  if (netMode) tintViewModels(me.team);
  const drinking = (me.drinkUntil || 0) > sim.time;
  const wkey = drinking ? 'potion' : me.weapon === 'primary' ? me.primary : me.weapon;
  for (const k2 in VIEW) VIEW[k2].visible = firstPerson && me.alive && k2 === wkey;
  const vg = VIEW[wkey];
  if (vg && wkey === 'potion') updatePotionView(vg, drinking ? 1 - (me.drinkUntil - sim.time) / DRINK : -1, now);
  else if (vg) {
    const w = sim.WEAPONS[me.primary], reloading = me.weapon === 'primary' && me.reloadUntil;
    const charge = me.charge0 ? Math.min(1, (sim.time - me.charge0) / (w.charge || 1)) : 0;
    const base = wkey === 'arco' ? [6.5, -7.5, -22] : [8, -8, -22];
    // mirando: só um movimento leve (a arma fica no mesmo lugar, quem aproxima é o zoom da tela)
    vg.position.set(base[0] - adsK * 1.2, base[1] - adsK * 0.8 - (reloading ? 7 : 0) + swing * 5, base[2] + kick * 3 - swing * 6);
    vg.rotation.x = kick * 0.25 + (reloading ? 0.7 : 0) - swing * 0.6;
    vg.traverse((o) => {
      if (o.userData.string) o.position.z = charge * 7;
      if (o.userData.arrow) { o.position.z = -3 + charge * 2; o.visible = me.ammo[me.primary] > 0 && !reloading; }
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
  if (me.aiming && me.alive) drawPowerBar(crossCtx, sim.aimCharge(me));
  // brilho vermelho de cura quando bebe a poção
  healFx = Math.max(0, healFx - dtR * 0.9);
  $('heal').style.opacity = healFx > 0 ? String(Math.min(1, healFx * 1.4) * 0.8) : '0';
  hud(me);
  if ($('board').style.display === 'block' && Math.floor(now / 250) !== Math.floor((now - dtR * 1000) / 250)) renderBoard();
  // killcam final (última kill do round/partida): começa meio segundo depois, pra gravar o fim do tiro
  if (pendingKc && now >= pendingKc.at) { const lk = pendingKc.lk; pendingKc = null; killcam.startFinal(lk, now); }
  const kcOn = killcam.apply(now);
  renderPortals(me, now); // o que aparece dentro dos portais
  if (kcOn && killcam.lensK > 0.01) renderWithLens(killcam.lensK, now);
  else renderer.render(scene, camera);
  fpsN++;
  if (now - fpsT >= 500) { $('fps').textContent = Math.round(fpsN * 1000 / (now - fpsT)); fpsN = 0; fpsT = now; }
  requestAnimationFrame(frame);
}

function handleEvent(e, now) {
  addEffect(e, now);
  const a = avatars.get(e.id), p = e.id && sim.players.get(e.id);
  const pos = p ? [p.x, p.z] : (a ? [a.root.position.x, a.root.position.z] : null);
  if (e.type === 'shot' && a) { const s = SHOOT_ANIM[e.weapon]; a.trigger(s[0], s[1], now); if (e.id === 'me') { kick = 1; if (e.weapon === 'mao' || e.weapon === 'disco') swing = 1; } if (pos) sfxAt('shot', pos[0], pos[1]); }
  if (e.type === 'knife' && a) { a.trigger('1H_Melee_Attack_Stab', 1.9, now); if (e.id === 'me') swing = 1; if (pos) sfxAt('knife', pos[0], pos[1]); }
  if ((e.type === 'nade_throw' || e.type === 'smoke_throw') && a) { a.trigger('Throw', 1.7, now); if (e.id === 'me') swing = 1; if (pos) sfxAt('throw', pos[0], pos[1]); }
  if (e.type === 'drink' && a) { a.trigger('Use_Item', 1.1, now); if (e.id === 'me') { healFx = 1.2; feed('🧪 +1 vida'); } if (pos) sfxAt('drink', pos[0], pos[1]); }
  if (e.type === 'pickup' && e.id === 'me') { feed(e.kind === 'potion' ? '🧪 Poção reabastecida' : '💣 Granada/fumaça reabastecida'); SFX.play('pickup', 1); }
  if (e.type === 'explode' && Number.isFinite(e.x)) sfxAt('explode', e.x, e.z);
  if (e.type === 'jump' && e.id === 'me') sfxAt('jump', p ? p.x : 0, p ? p.z : 0);
  if (e.type === 'land' && pos) sfxAt('land', pos[0], pos[1]);
  if (e.type === 'tornado_start') feed('🌪️ Um furacão está nascendo — foge dele!');
  if (e.type === 'caught' && e.id === 'me') feed('🌪️ O furacão te pegou!');
  if (e.type === 'storm_warn') feed('🌬️ Tempestade congelante vindo — sai da faixa azul!');
  if (e.type === 'frozen' && e.id === 'me') feed('🥶 Congelado! Você ficou devagar');
  if (e.type === 'meteor_warn') { feed('☄️ Meteoro caindo — olha a sombra no chão!'); SFX.play('splash', 0.5); }
  if (e.type === 'meteor_hit') { addEffect({ type: 'explode', x: e.x, y: 10, z: e.z }, now); sfxAt('explode', e.x, e.z); }
  if (e.type === 'door_open') sfxAt('door', e.x, e.z);
  if (e.type === 'portals_open' && sim.time - (sim.hzStart || 0) > 1) feed('🌀 Portais abertos');
  if (e.type === 'erupt_warn') { feed('🌋 O chão está rachando — o vulcão vai furar ali!'); SFX.play('splash', 0.6); }
  if (e.type === 'erupt') { eruptFx(e.x, e.z, e.r, now); sfxAt('explode', e.x, e.z); }
  if (e.type === 'light_flicker') feed('💡 A luz está piscando...');
  if (e.type === 'sand_start') feed('🏜️ Tempestade de areia — visibilidade caindo');
  if (e.type === 'sand_end') feed('🏜️ A tempestade passou');
  if (e.type === 'lava_fall') { sfxAt('splash', e.x, e.z); if (e.id === 'me' && e.saved) feed('🌋 Caiu na lava! (modo teste: voltou pro início)'); }
  if (e.type === 'lava_splash') sfxAt('splash', e.x, e.z);
  // portal: no multiplayer a mira é sua, então gira ela aqui junto com o corpo
  if (e.type === 'portal') { if (e.id === 'me' && netMode && Number.isFinite(e.dyaw)) netYaw += e.dyaw; if (pos || e.id === 'me') sfxAt('portal', e.x, e.z); }
  if (e.type === 'portal_shot') sfxAt('portal', e.x, e.z, { quiet: true });
  if (e.type === 'light_off') feed('🕯️ A luz apagou...');
  if (e.type === 'light_on') feed('💡 A luz voltou');
  if (e.type === 'lamp_off') feed('💡 Um poste apagou');
  if (e.type === 'jump' && a) a.legsOnce('Jump_Start', 1.6, now);
  if (e.type === 'djump' && a) a.legsOnce('Jump_Full_Short', 1.6, now);
  if (e.type === 'land' && a) a.legsOnce('Jump_Land', 1.8, now);
  if (e.type === 'hit') { const v = avatars.get(e.victim); if (v) v.trigger('Hit_A', 1.5, now); if (e.by === 'me') hitMark = { kind: 'hit', t: now }; const vp = sim.players.get(e.victim); if (vp) sfxAt('hit', vp.x, vp.z); }
  if (e.type === 'round_end') { lastRoundEnd = e; if (sim.lastKill) pendingKc = { lk: sim.lastKill, at: now + 500 }; }
  if (e.type === 'round_start') { feed(`⚔️ Round ${e.round} — valendo!`); killcam.stop(); pendingKc = null; }
  if (e.type === 'hill_move' && sim.mode === 'koth' && sim.time - (sim.hzStart || 0) > 1) feed('👑 A colina mudou de lugar');
  if (e.type === 'match_end') {
    if (!netMode) offlineEndAt = now + 9500;
    if (sim.lastKill && e.mode !== 'rounds') pendingKc = { lk: sim.lastKill, at: now + 500 }; // killcam final da partida
  }
  if (e.type === 'kill') {
    if (e.killer === 'me') hitMark = { kind: 'kill', t: now };
    const k = sim.players.get(e.killer), v = sim.players.get(e.victim);
    feed(`${k ? `<span class="t${k.team}">${esc(k.name)}</span>` : ''} ${WICON[e.weapon] || '💥'} <span class="t${v ? v.team : 'B'}">${esc(v ? v.name : '?')}</span>`);
    SFX.play('kill', e.killer === 'me' || e.victim === 'me' ? 1 : 0.5);
  }
  if (e.type === 'reload') SFX.play('reload', e.id === 'me' ? 1 : 0.3);
  if (e.type === 'bounce' && Number.isFinite(e.x)) sfxAt('bounce', e.x, e.z);
  void p;
}

showMenu(true);
loadModels().then(() => {
  $('loading').textContent = 'Pronto! Clique em Jogar';
  newGame();
  requestAnimationFrame(frame);
}).catch((e) => { $('loading').textContent = 'Erro ao carregar os bonecos: ' + e.message; console.error(e); });
window.__pb3d = { get sim() { return sim; }, get mapInfo() { return mapInfo; }, killcam, lock: (v) => { locked = v; showMenu(!v); }, keys,
  get BASE() { return BASE; },
  fx: { eruptFx: (x, z, d) => eruptFx(x, z, 84, performance.now(), d) },
  step: (sec) => { const now = performance.now(); for (let i = 0; i < Math.round(sec * 60); i++) { const evs = sim.step(STEP); killcam.record(sim); for (const e of evs) handleEvent(e, now); } } }; // testes
