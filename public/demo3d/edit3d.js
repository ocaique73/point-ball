// Editor de mapa em 3D (dentro do jogo: /demo3d/?edit3d=mapa). Câmera voando, clique numa peça pra selecionar,
// setas coloridas pra mover (e pra cima/baixo) e cubinhos pra esticar. Mexe no mesmo rascunho do editor visto de cima
// (os dois ficam iguais na hora) e dá pra "testar andando" sem sair daqui.
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { clone, r4, CHANNEL, loadDraft, saveDraft, mirrorOf, same, findPartner } from '/demo3d/editcore.js';
import { editableItems, bakedEdits } from '/demo3d/world3d.js';

const SW = ['#a6a6a2', '#8f897c', '#6b7280', '#e5e7eb', '#9a6b3f', '#6b4a2a', '#2f6f9f', '#b03a2e', '#2f8f5b', '#d9822b', '#e2b33c', '#4e7a3a'];
const TNAME = { ramp: 'Rampa', box: 'Muro / caixa', wall2: 'Parede diagonal', tree: 'Árvore', dune: 'Montanha de areia', pyr: 'Pirâmide' };

export function createEdit3D(ctx) {
  const { THREE, scene, camera, canvas } = ctx;
  const mapId = ctx.mapId;
  let draft = loadDraft(bakedEdits());
  let items = null, sel = -1, partner = -1, pmode = null, mirror = true, snap = true, mode = 'translate';
  const undoSt = [], redoSt = [];
  const E = { fly: true };
  // câmera: começa no alto olhando o mapa de lado
  const mi0 = ctx.mapInfo(), W = mi0.W, H = mi0.H;
  const cam = { x: W * 0.5, y: Math.max(W, H) * 0.42, z: H * 1.05, yaw: -Math.PI / 2, pitch: -0.62, speed: 700 };
  const keys = {};
  // itens do mapa (do rascunho, ou os do jogo se ainda não mexeu)
  function curItems() { const m = draft.maps[mapId]; return m && Array.isArray(m.items) ? clone(m.items) : editableItems(ctx.mapInfo().world); }
  items = curItems();

  // ---------- tela: barra, painel e dica ----------
  const css = document.createElement('style');
  css.textContent = `
    body.e3d #hud, body.e3d #slots, body.e3d #minimap, body.e3d #alive, body.e3d #cross, body.e3d #top, body.e3d #feed, body.e3d #score, body.e3d #dead, body.e3d #bombwarn, body.e3d .hw { display: none !important; }
    #e3d-bar { position: fixed; top: 10px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; z-index: 20; background: rgba(10,14,22,.86); border: 1px solid #243044; border-radius: 10px; padding: 6px; font: 13px "Segoe UI", system-ui, sans-serif; color: #e5e7eb; max-width: 96vw; }
    #e3d-bar button, #e3d-props button { background: #1c2636; color: #e5e7eb; border: 1px solid #2d3a52; border-radius: 7px; padding: 5px 9px; cursor: pointer; font: inherit; }
    #e3d-bar button.on { border-color: #ffcc33; color: #ffcc33; }
    #e3d-bar button:hover, #e3d-props button:hover { background: #213047; }
    #e3d-props { position: fixed; top: 64px; right: 10px; width: 240px; z-index: 20; background: rgba(10,14,22,.9); border: 1px solid #243044; border-radius: 10px; padding: 10px 12px; font: 13px "Segoe UI", system-ui, sans-serif; color: #e5e7eb; }
    #e3d-props h4 { margin: 0 0 8px; color: #ffcc33; font-size: 13px; }
    #e3d-props .r { display: grid; grid-template-columns: 1fr 86px; gap: 6px; align-items: center; margin: 4px 0; }
    #e3d-props input[type=number] { width: 86px; background: #0c121c; color: #e5e7eb; border: 1px solid #2d3a52; border-radius: 6px; padding: 4px 6px; }
    #e3d-props .sws { display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0; } #e3d-props .sw { width: 18px; height: 18px; border-radius: 4px; cursor: pointer; border: 1px solid #0006; }
    #e3d-help { position: fixed; left: 10px; bottom: 10px; z-index: 20; background: rgba(10,14,22,.8); border-radius: 8px; padding: 7px 10px; font: 12px "Segoe UI", system-ui, sans-serif; color: #94a3b8; max-width: 62vw; }
    #e3d-help b { color: #e5e7eb; } #e3d-msg { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 20; color: #86efac; font: 600 13px "Segoe UI", system-ui, sans-serif; text-shadow: 0 1px 3px #000; }
    #e3d-play { position: fixed; top: 10px; left: 50%; transform: translateX(-50%); z-index: 20; background: rgba(10,14,22,.8); color: #ffcc33; border-radius: 8px; padding: 6px 12px; font: 600 13px "Segoe UI", system-ui, sans-serif; display: none; }`;
  document.head.appendChild(css);
  document.body.classList.add('e3d');
  const bar = document.createElement('div'); bar.id = 'e3d-bar';
  bar.innerHTML = `<b style="color:#ffcc33;align-self:center;padding:0 4px">🧊 Editor 3D</b>
    <button data-m="translate" class="on" title="Mover (1): setas coloridas; a verde sobe/desce">✥ Mover</button>
    <button data-m="scale" title="Esticar (2): cubinhos nas pontas das setas">⇲ Esticar</button>
    <button id="e3d-new" title="Novo muro onde você está olhando (B)">🧱 Novo</button>
    <button id="e3d-ramp" title="Nova rampa onde você está olhando (R)">📈 Rampa</button>
    <button id="e3d-dup" title="Duplicar (Ctrl+D)">⧉</button>
    <button id="e3d-del" title="Apagar (Delete)">🗑️</button>
    <button id="e3d-undo" title="Desfazer (Ctrl+Z)">↶</button><button id="e3d-redo" title="Refazer (Ctrl+Y)">↷</button>
    <button id="e3d-mir" class="on" title="O mesmo item do outro lado do mapa muda junto">⇋ Espelhar</button>
    <button id="e3d-snap" class="on" title="Encaixa de 10 em 10">▦ Grade</button>
    <button id="e3d-top" title="Câmera lá de cima (T)">⬇ De cima</button>
    <button id="e3d-play-b" title="Anda pelo mapa como jogador (P). Esc volta pro editor">🚶 Testar andando</button>`;
  document.body.appendChild(bar);
  const props = document.createElement('div'); props.id = 'e3d-props'; document.body.appendChild(props);
  const help = document.createElement('div'); help.id = 'e3d-help';
  help.innerHTML = '<b>Botão direito</b> + mouse: olhar · <b>WASD</b>: voar · <b>Espaço/Q</b> sobe, <b>C/E</b> desce · <b>Shift</b> rápido · rodinha: velocidade<br><b>Clique</b> numa peça: seleciona · arraste as setas · <b>1</b> mover · <b>2</b> esticar · <b>F</b> chega perto · <b>Esc</b> solta a peça';
  document.body.appendChild(help);
  const msg = document.createElement('div'); msg.id = 'e3d-msg'; document.body.appendChild(msg);
  const playTip = document.createElement('div'); playTip.id = 'e3d-play'; playTip.textContent = '🚶 Testando andando — Esc volta pro editor 3D'; document.body.appendChild(playTip);
  let msgT = 0; const say = (t) => { msg.textContent = t; clearTimeout(msgT); msgT = setTimeout(() => { msg.textContent = ''; }, 2200); };

  // ---------- setas (TransformControls) presas num "fantasma" no meio da peça ----------
  const proxy = new THREE.Object3D(); scene.add(proxy);
  const tc = new TransformControls(camera, canvas); tc.setSize(0.9); tc.attach(proxy); tc.enabled = false;
  const helper = tc.getHelper ? tc.getHelper() : tc; helper.visible = false; scene.add(helper);
  const outline = new THREE.Box3Helper(new THREE.Box3(), 0xffcc33); outline.visible = false; scene.add(outline);
  const outline2 = new THREE.Box3Helper(new THREE.Box3(), 0x9a7a20); outline2.visible = false; scene.add(outline2);
  let dragStart = null, selMeshes = [];
  function applySnap() { tc.setTranslationSnap(snap ? 10 : null); tc.setScaleSnap(snap ? 0.05 : null); }
  applySnap();
  tc.addEventListener('dragging-changed', (e) => { if (e.value) startDrag(); else endDrag(); });
  tc.addEventListener('objectChange', () => { // mostra a peça mudando enquanto arrasta
    if (!dragStart) return;
    const M = new THREE.Matrix4().multiplyMatrices(proxy.matrixWorld, dragStart.inv);
    for (const s of dragStart.meshes) { s.o.matrix.multiplyMatrices(M, s.m); s.o.matrixAutoUpdate = false; s.o.matrixWorldNeedsUpdate = true; }
    updateOutline();
  });

  // ---------- geometria de cada item (no mundo) ----------
  const geo = (it) => {
    if (it.t === 'box') { const y0 = it.y0 || 0, top = it.top || 120; return { cx: (it.x + it.w / 2) * W, cz: (it.z + it.h / 2) * H, cy: (y0 + top) / 2, sx: it.w * W, sy: top - y0, sz: it.h * H, rot: 0 }; }
    if (it.t === 'ramp') { const hi = Math.max(it.h0 || 0, it.h1 || 0); return { cx: (it.x + it.w / 2) * W, cz: (it.z + it.h / 2) * H, cy: hi / 2, sx: it.w * W, sy: Math.max(10, hi), sz: it.h * H, rot: 0 }; }
    if (it.t === 'tree') return { cx: it.x * W, cz: it.z * H, cy: 240, sx: 60, sy: 480, sz: 60, rot: 0 };
    if (it.t === 'pyr') return { cx: it.x * W, cz: it.z * H, cy: it.h / 2, sx: it.half * 2, sy: it.h, sz: it.half * 2, rot: 0 };
    const ax = it.ax * W, az = it.az * H, bx = it.bx * W, bz = it.bz * H, L = Math.hypot(bx - ax, bz - az);
    if (it.t === 'wall2') return { cx: (ax + bx) / 2, cz: (az + bz) / 2, cy: (it.top || 130) / 2, sx: L, sy: it.top || 130, sz: it.th || 24, rot: -Math.atan2(bz - az, bx - ax) };
    return { cx: (ax + bx) / 2, cz: (az + bz) / 2, cy: it.hk * 54, sx: L + it.wk * 150, sy: it.hk * 108, sz: it.wk * 300, rot: -Math.atan2(bz - az, bx - ax) }; // duna
  };
  function meshesOf(i) { const out = []; const g = ctx.mapGroup(); if (!g) return out; for (const o of g.children) if (o.userData.item === i) out.push(o); return out; }
  function updateOutline() {
    outline.visible = false; outline2.visible = false;
    if (sel < 0) return;
    const b = new THREE.Box3(); let any = false;
    for (const o of dragStart ? dragStart.meshes.map((s) => s.o) : meshesOf(sel)) { o.updateMatrixWorld(true); b.expandByObject(o); any = true; }
    if (!any) { const g = geo(items[sel]); b.setFromCenterAndSize(new THREE.Vector3(g.cx, g.cy, g.cz), new THREE.Vector3(Math.max(g.sx, g.sz), g.sy, Math.max(g.sx, g.sz))); }
    outline.box.copy(b); outline.visible = true;
    if (mirror && partner >= 0) { const b2 = new THREE.Box3(); let a2 = false; for (const o of meshesOf(partner)) { b2.expandByObject(o); a2 = true; } if (a2) { outline2.box.copy(b2); outline2.visible = true; } }
  }
  function placeProxy() {
    if (sel < 0 || !items[sel]) { tc.enabled = false; helper.visible = false; return; }
    const g = geo(items[sel]); proxy.position.set(g.cx, g.cy, g.cz); proxy.rotation.set(0, g.rot, 0); proxy.scale.set(1, 1, 1); proxy.updateMatrixWorld(true);
    tc.enabled = true; helper.visible = true;
    const it = items[sel];
    tc.showY = it.t === 'box' || mode === 'scale'; // árvore/pirâmide/parede ficam no chão (só esticam pra cima)
    if (mode === 'scale' && it.t === 'tree') { tc.enabled = false; helper.visible = false; }
    updateOutline();
  }
  function startDrag() {
    if (sel < 0) return;
    proxy.updateMatrixWorld(true);
    dragStart = { item: clone(items[sel]), g: geo(items[sel]), inv: proxy.matrixWorld.clone().invert(), meshes: meshesOf(sel).map((o) => { o.updateMatrix(); return { o, m: o.matrix.clone() }; }) };
    E.dragging = true;
  }
  const snapV = (v, s) => (snap ? Math.round(v / (s || 10)) * (s || 10) : Math.round(v));
  function endDrag() {
    E.dragging = false;
    if (!dragStart || sel < 0) { dragStart = null; return; }
    const it = items[sel], g0 = dragStart.g, p = proxy.position, s = proxy.scale;
    const before = JSON.stringify(dragStart.item);
    // (move pelo tanto que arrastou, encaixado na grade; tamanho só muda se esticou)
    const dX = snapV(p.x - g0.cx), dZ = snapV(p.z - g0.cz), dY = snapV(p.y - g0.cy, 5), scaled = Math.abs(s.x - 1) + Math.abs(s.y - 1) + Math.abs(s.z - 1) > 1e-4;
    const o = dragStart.item;
    if (it.t === 'box') {
      const y00 = o.y0 || 0, h0 = (o.top || 120) - y00;
      const w = scaled ? Math.max(6, snapV(g0.sx * s.x)) : g0.sx, d = scaled ? Math.max(6, snapV(g0.sz * s.z)) : g0.sz, hgt = scaled ? Math.max(6, snapV(h0 * s.y, 5)) : h0;
      const cx = g0.cx + dX, cz = g0.cz + dZ; let y0 = scaled ? Math.round(y00 + (h0 - hgt) / 2 + dY) : y00 + dY; if (y0 < 3) y0 = 0;
      it.x = r4((cx - w / 2) / W); it.z = r4((cz - d / 2) / H); if (scaled) { it.w = r4(w / W); it.h = r4(d / H); }
      it.top = y0 + hgt; if (y0) it.y0 = y0; else delete it.y0;
    } else if (it.t === 'ramp') {
      const w = scaled ? Math.max(10, snapV(g0.sx * s.x)) : g0.sx, d = scaled ? Math.max(10, snapV(g0.sz * s.z)) : g0.sz, cx = g0.cx + dX, cz = g0.cz + dZ;
      it.x = r4((cx - w / 2) / W); it.z = r4((cz - d / 2) / H); if (scaled) { it.w = r4(w / W); it.h = r4(d / H); }
      const k = scaled ? s.y : 1, dy = scaled ? 0 : dY; it.h0 = Math.max(0, snapV((o.h0 || 0) * k + dy, 5)); it.h1 = Math.max(5, snapV((o.h1 || 0) * k + dy, 5));
    } else if (it.t === 'tree') { it.x = r4(o.x + dX / W); it.z = r4(o.z + dZ / H); }
    else if (it.t === 'pyr') { it.x = r4(o.x + dX / W); it.z = r4(o.z + dZ / H); if (scaled) { it.half = Math.max(60, snapV(o.half * Math.max(s.x, s.z))); it.h = Math.max(40, snapV(o.h * s.y)); } }
    else {
      const ax = o.ax * W, az = o.az * H, bx = o.bx * W, bz = o.bz * H;
      const L = Math.hypot(bx - ax, bz - az) || 1, ux = (bx - ax) / L, uz = (bz - az) / L, L2 = (scaled ? Math.max(20, L * s.x) : L) / 2, cx = (ax + bx) / 2 + dX, cz = (az + bz) / 2 + dZ;
      it.ax = r4((cx - ux * L2) / W); it.az = r4((cz - uz * L2) / H); it.bx = r4((cx + ux * L2) / W); it.bz = r4((cz + uz * L2) / H);
      if (scaled && it.t === 'wall2') { it.th = Math.max(4, snapV((o.th || 24) * s.z, 2)); it.top = Math.max(10, snapV((o.top || 130) * s.y, 5)); }
      else if (scaled) { it.wk = r4(Math.max(0.5, o.wk * s.z)); it.hk = r4(Math.max(0.1, o.hk * s.y)); }
    }
    dragStart = null;
    if (JSON.stringify(it) !== before) commit(); else placeProxy();
  }
  // grava: o outro lado muda junto (espelho), salva o rascunho e refaz o mapa
  function commit() {
    if (mirror && partner >= 0) items[partner] = mirrorOf(items[sel], pmode);
    undoSt.push(JSON.stringify(lastSaved)); if (undoSt.length > 80) undoSt.shift(); redoSt.length = 0; // (lastSaved = como estava antes)
    save();
  }
  let lastSaved = clone(items);
  function save(noRebuild) {
    draft = loadDraft(bakedEdits()); // (pega o que o editor de cima mudou em outra coisa)
    draft.maps[mapId] = { items: clone(items) }; saveDraft(draft); lastSaved = clone(items);
    if (!noRebuild) rebuild();
  }
  function rebuild() { const keepSel = sel; ctx.rebuild(); sel = keepSel; afterRebuild(); }
  function afterRebuild() { if (sel >= items.length) sel = -1; ({ partner, mode: pmode } = mirror ? findPartner(items, sel) : { partner: -1, mode: null }); placeProxy(); showProps(); }
  function select(i, fromOther) {
    sel = i; const r = findPartner(items, i); partner = r.partner; pmode = r.mode;
    placeProxy(); showProps();
    if (!fromOther && bc) bc.postMessage({ t: 'sel', map: mapId, i });
  }
  function undo() { if (!undoSt.length) return; redoSt.push(JSON.stringify(items)); items = JSON.parse(undoSt.pop()); save(); say('desfeito'); }
  function redo() { if (!redoSt.length) return; undoSt.push(JSON.stringify(items)); items = JSON.parse(redoSt.pop()); save(); }
  function addNew(it) {
    undoSt.push(JSON.stringify(items)); redoSt.length = 0;
    items.push(it); const i = items.length - 1;
    if (mirror) { const m = mirrorOf(it, 'x'); if (!same(m, it)) items.push(m); }
    sel = i; save(); select(i);
  }
  function del() { if (sel < 0) return; undoSt.push(JSON.stringify(items)); redoSt.length = 0; const kill = [sel]; if (mirror && partner >= 0) kill.push(partner); items = items.filter((q, k) => !kill.includes(k)); sel = -1; save(); select(-1); }
  function dup() {
    if (sel < 0) return; const it = clone(items[sel]);
    if (it.t === 'box' || it.t === 'ramp' || it.t === 'tree' || it.t === 'pyr') { it.x = r4(it.x + 40 / W); it.z = r4(it.z + 40 / H); } else { it.ax = r4(it.ax + 40 / W); it.bx = r4(it.bx + 40 / W); it.az = r4(it.az + 40 / H); it.bz = r4(it.bz + 40 / H); }
    addNew(it);
  }
  function newBox(ramp) { // onde a câmera está olhando (no chão ou em cima de alguma coisa)
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
    const hit = pick(0, 0, true); let x, z;
    if (hit && hit.point) { x = hit.point.x; z = hit.point.z; } else { x = camera.position.x + dir.x * 300; z = camera.position.z + dir.z * 300; }
    x = Math.max(60, Math.min(W - 60, snapV(x))); z = Math.max(60, Math.min(H - 60, snapV(z)));
    addNew(ramp ? { t: 'ramp', x: r4((x - 80) / W), z: r4((z - 40) / H), w: r4(160 / W), h: r4(80 / H), dir: Math.abs(Math.cos(cam.yaw)) > Math.abs(Math.sin(cam.yaw)) ? (Math.cos(cam.yaw) > 0 ? '+x' : '-x') : (Math.sin(cam.yaw) > 0 ? '+z' : '-z'), h0: 0, h1: 110 } : { t: 'box', x: r4((x - 40) / W), z: r4((z - 30) / H), w: r4(80 / W), h: r4(60 / H), top: 120 });
  }

  // ---------- painel da peça ----------
  function showProps() {
    const it = items[sel];
    if (!it) { props.innerHTML = `<h4>Nenhuma peça selecionada</h4><div style="color:#94a3b8;font-size:12px">Clique numa peça do mapa (as que dá pra mexer ficam com contorno amarelo). Cinza/fixo (iglu, torres, navio...) não mexe.<br><br>${items.length} peças neste mapa.</div>`; return; }
    const g = geo(it);
    let h = `<h4>${TNAME[it.t]}${mirror && partner >= 0 ? ' <span style="color:#9a7a20">+ o do outro lado</span>' : ''}</h4>`;
    const num = (l, k, v, st) => `<div class="r"><span>${l}</span><input type="number" data-k="${k}" value="${v}" step="${st || 10}"></div>`;
    if (it.t === 'box') h += num('Largura', 'w', Math.round(g.sx)) + num('Profundidade', 'd', Math.round(g.sz)) + num('Altura (topo)', 'top', it.top || 120, 5) + num('Base (passa por baixo)', 'y0', it.y0 || 0, 5);
    else if (it.t === 'ramp') { h += num('Largura', 'w', Math.round(g.sx)) + num('Profundidade', 'd', Math.round(g.sz)) + num('Altura embaixo', 'h0', it.h0 || 0, 5) + num('Altura em cima', 'h1', it.h1, 5); h += `<div class="r"><span>Sobe pra</span><span>${['+x', '-x', '+z', '-z'].map((d) => `<button data-dir="${d}" style="padding:2px 6px;${it.dir === d ? 'border-color:#ffcc33;color:#ffcc33' : ''}">${{ '+x': '→', '-x': '←', '+z': '↓', '-z': '↑' }[d]}</button>`).join('')}</span></div>`; }
    else if (it.t === 'wall2') h += num('Comprimento', 'len', Math.round(g.sx)) + num('Grossura', 'th', it.th || 24, 2) + num('Altura', 'top', it.top || 130, 5);
    else if (it.t === 'pyr') h += num('Meia base', 'half', it.half) + num('Altura', 'h', it.h);
    else if (it.t === 'dune') h += num('Altura (x108)', 'hk', it.hk, 0.05) + num('Largura (x150)', 'wk', it.wk, 0.05);
    if (it.t === 'box') h += `<div class="sws">${SW.map((c) => `<div class="sw" data-c="${c}" style="background:${c}"></div>`).join('')}<div class="sw" data-c="" title="padrão" style="background:repeating-linear-gradient(45deg,#333 0 3px,#555 3px 6px)"></div></div>`;
    h += `<div style="display:flex;gap:6px;margin-top:8px"><button id="e3d-pdup">⧉ Duplicar</button><button id="e3d-pdel">🗑️ Apagar</button></div>`;
    props.innerHTML = h;
    props.querySelectorAll('input[data-k]').forEach((inp) => inp.addEventListener('change', () => setNum(inp.dataset.k, Number(inp.value))));
    props.querySelectorAll('.sw').forEach((s) => s.addEventListener('click', () => { if (s.dataset.c) items[sel].tint = s.dataset.c; else delete items[sel].tint; commit(); }));
    props.querySelectorAll('[data-dir]').forEach((b) => (b.onclick = () => { items[sel].dir = b.dataset.dir; commit(); }));
    props.querySelector('#e3d-pdup').onclick = dup; props.querySelector('#e3d-pdel').onclick = del;
  }
  function setNum(k, v) {
    const it = items[sel]; if (!it || !Number.isFinite(v)) return;
    if (it.t === 'box' || it.t === 'ramp') {
      if (k === 'w') { const cx = (it.x + it.w / 2) * W; it.w = r4(Math.max(6, v) / W); it.x = r4((cx - Math.max(6, v) / 2) / W); }
      else if (k === 'd') { const cz = (it.z + it.h / 2) * H; it.h = r4(Math.max(6, v) / H); it.z = r4((cz - Math.max(6, v) / 2) / H); }
      else if (k === 'y0') { const hgt = (it.top || 120) - (it.y0 || 0); if (v > 0) it.y0 = v; else delete it.y0; it.top = (it.y0 || 0) + hgt; }
      else it[k] = v;
    } else if (k === 'len') { const g = geo(it), ux = Math.cos(-g.rot), uz = Math.sin(-g.rot), L2 = Math.max(20, v) / 2; it.ax = r4((g.cx - ux * L2) / W); it.az = r4((g.cz - uz * L2) / H); it.bx = r4((g.cx + ux * L2) / W); it.bz = r4((g.cz + uz * L2) / H); }
    else it[k] = v;
    commit();
  }

  // ---------- selecionar clicando ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(nx, ny, any) {
    const g = ctx.mapGroup(); if (!g) return null;
    ndc.set(nx, ny); ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(g.children, true), ceil = ctx.ceilingY();
    for (const h of hits) {
      const o = h.object;
      if (o.isSprite || o.isPoints || o.isLine || !o.visible) continue;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (m && m.transparent && m.opacity < 0.6 && !(m.map && m.alphaTest)) continue; // teto de folhas, vidro, neblina
      if (ceil != null && camera.position.y > ceil - 5 && h.point.y > ceil - 25) continue; // voando em cima do teto: clica através dele
      let top = o; while (top.parent && top.parent !== g) top = top.parent;
      if (top.userData.item != null) return { item: top.userData.item, point: h.point };
      if (any) return { item: -1, point: h.point };
      // deserto: clicou na areia -> a montanha mais perto
      if (items.some((q) => q.t === 'dune')) { let best = -1, bd = 1e9; items.forEach((q, i) => { if (q.t !== 'dune') return; const ax = q.ax * W, az = q.az * H, bx = q.bx * W, bz = q.bz * H, dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, u = Math.max(0, Math.min(1, ((h.point.x - ax) * dx + (h.point.z - az) * dz) / L2)), d = Math.hypot(h.point.x - ax - dx * u, h.point.z - az - dz * u); if (d < q.wk * 150 && d < bd) { bd = d; best = i; } }); if (best >= 0) return { item: best, point: h.point }; }
      return { item: -1, point: h.point };
    }
    return null;
  }
  let down = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (!E.fly) return;
    if (e.button === 2) { down = { look: true, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); return; }
    if (e.button !== 0) return;
    if (tc.enabled && tc.axis) return; // clicou na seta: quem cuida é o TransformControls
    down = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!E.fly || !down || !down.look) return;
    cam.yaw += e.movementX * 0.0035; cam.pitch = Math.max(-1.5, Math.min(1.5, cam.pitch - e.movementY * 0.0035));
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!E.fly || !down) return;
    const d = down; down = null;
    if (d.look || E.dragging || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
    const r = canvas.getBoundingClientRect(), h = pick((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    select(h && h.item >= 0 ? h.item : -1);
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => { if (!E.fly) return; cam.speed = Math.max(100, Math.min(4000, cam.speed * Math.exp(-e.deltaY * 0.001))); say('velocidade ' + Math.round(cam.speed)); }, { passive: true });
  const typing = (e) => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA');
  window.addEventListener('keydown', (e) => {
    if (!E.fly || typing(e)) return;
    keys[e.code] = true;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'd') { e.preventDefault(); dup(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); del(); return; }
    if (e.key === 'Escape') { select(-1); return; }
    if (e.code === 'Digit1') setMode('translate'); if (e.code === 'Digit2') setMode('scale');
    if (e.code === 'KeyB') newBox(); if (e.code === 'KeyR') newBox(true); if (e.code === 'KeyT') topView(); if (e.code === 'KeyP') play();
    if (e.code === 'KeyF' && sel >= 0) { const g = geo(items[sel]), d = Math.max(g.sx, g.sy, g.sz) * 1.6 + 120; cam.x = g.cx - Math.cos(cam.yaw) * Math.cos(cam.pitch) * d; cam.z = g.cz - Math.sin(cam.yaw) * Math.cos(cam.pitch) * d; cam.y = g.cy - Math.sin(cam.pitch) * d; }
    if (e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  function setMode(m) { mode = m; tc.setMode(m); tc.space = m === 'scale' ? 'local' : 'world'; bar.querySelectorAll('[data-m]').forEach((b) => b.classList.toggle('on', b.dataset.m === m)); placeProxy(); }
  function topView() { cam.x = W / 2; cam.z = H / 2 + 1; cam.y = Math.max(W, H) * 0.95; cam.yaw = -Math.PI / 2; cam.pitch = -1.5; }
  function play() { // anda pelo mapa (bota o boneco embaixo da câmera)
    E.fly = false; select(-1); document.body.classList.remove('e3d'); bar.style.display = props.style.display = help.style.display = 'none'; playTip.style.display = 'block';
    ctx.play(cam.x, cam.z, cam.yaw);
  }
  E.lockChanged = (locked) => { if (!locked && !E.fly) { E.fly = true; document.body.classList.add('e3d'); bar.style.display = props.style.display = help.style.display = ''; playTip.style.display = 'none'; const p = ctx.me(); if (p) { cam.x = p.x; cam.z = p.z; cam.y = p.y + 140; cam.yaw = p.yaw; cam.pitch = -0.35; } } };
  bar.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => setMode(b.dataset.m)));
  bar.querySelector('#e3d-new').onclick = () => newBox(); bar.querySelector('#e3d-ramp').onclick = () => newBox(true); bar.querySelector('#e3d-dup').onclick = dup; bar.querySelector('#e3d-del').onclick = del;
  bar.querySelector('#e3d-undo').onclick = undo; bar.querySelector('#e3d-redo').onclick = redo; bar.querySelector('#e3d-top').onclick = topView; bar.querySelector('#e3d-play-b').onclick = play;
  bar.querySelector('#e3d-mir').onclick = (e) => { mirror = !mirror; e.currentTarget.classList.toggle('on', mirror); select(sel); };
  bar.querySelector('#e3d-snap').onclick = (e) => { snap = !snap; e.currentTarget.classList.toggle('on', snap); applySnap(); };

  // ---------- junto com o editor de cima ----------
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL) : null;
  if (bc) bc.onmessage = (e) => { const m = e.data; if (m && m.t === 'sel' && m.map === mapId && m.i !== sel) select(m.i >= 0 && m.i < items.length ? m.i : -1, true); };
  E.externalChange = () => { // o editor de cima mudou o rascunho
    draft = loadDraft(bakedEdits()); items = curItems(); lastSaved = clone(items);
    if (sel >= items.length) sel = -1; afterRebuild();
  };

  // ---------- a cada quadro: câmera voando e esconde o que é do jogo ----------
  const fwd = new THREE.Vector3();
  E.frame = (dt) => {
    const sp = cam.speed * (keys.ShiftLeft || keys.ShiftRight ? 2.5 : 1) * dt;
    const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), u = (keys.Space || keys.KeyQ ? 1 : 0) - (keys.KeyC || keys.KeyE ? 1 : 0);
    const cp = Math.cos(cam.pitch);
    fwd.set(Math.cos(cam.yaw) * cp, Math.sin(cam.pitch), Math.sin(cam.yaw) * cp);
    cam.x += (fwd.x * f - Math.sin(cam.yaw) * s) * sp; cam.z += (fwd.z * f + Math.cos(cam.yaw) * s) * sp; cam.y += (fwd.y * f + u) * sp;
    camera.position.set(cam.x, cam.y, cam.z); camera.lookAt(cam.x + fwd.x, cam.y + fwd.y, cam.z + fwd.z);
    camera.fov = 70; camera.updateProjectionMatrix();
    for (const k in ctx.VIEW) ctx.VIEW[k].visible = false;
    // em cima do teto: esconde o teto pra ver o mapa
    const ceil = ctx.ceilingY(), g = ctx.mapGroup();
    if (g && ceil != null) { const above = camera.position.y > ceil - 5; for (const o of g.children) if (o.userData.roof == null) { o.updateMatrixWorld(); const b = new THREE.Box3().setFromObject(o); o.userData.roof = b.min.y >= ceil - 30 && o.userData.item == null; } for (const o of g.children) if (o.userData.roof) o.visible = !above; }
  };
  E.afterRebuild = afterRebuild;
  topView(); cam.y = Math.max(W, H) * 0.55; cam.z = H * 1.15; cam.pitch = -0.7;
  showProps();
  return E;
}
