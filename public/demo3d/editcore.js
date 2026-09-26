// Peças em comum do Editor de mapa (visto de cima, editor.js) e do editor em 3D (edit3d.js, dentro do jogo):
// o rascunho guardado no navegador e o "espelho" (o mesmo item do outro lado do mapa).
export const clone = (o) => JSON.parse(JSON.stringify(o));
export const r4 = (v) => Math.round(v * 10000) / 10000;
export const EMPTY = () => ({ v: 1, maps: {}, weapons: {}, player: {}, nade: {}, fx: {} });
export const CHANNEL = 'pb3d-editor'; // o editor de cima e o 3D avisam um ao outro qual peça está selecionada
export function loadDraft(fallback) {
  try { const d = JSON.parse(localStorage.getItem('pb3d_edits') || 'null'); if (d && typeof d === 'object') return Object.assign(EMPTY(), d); } catch (e) {}
  return Object.assign(EMPTY(), clone(fallback || {}));
}
export function saveDraft(d) { try { localStorage.setItem('pb3d_edits', JSON.stringify(d)); } catch (e) {} }
const near = (a, b, e) => Math.abs(a - b) < (e || 0.004);
// mode 'x' = espelho esquerda/direita; 'rot' = girado (o deserto é assim)
export function mirrorOf(it, mode) {
  const m = clone(it), rot = mode === 'rot';
  if (it.t === 'box') { m.x = r4(1 - it.x - it.w); if (rot) m.z = r4(1 - it.z - it.h); }
  else if (it.t === 'tree' || it.t === 'pyr') { m.x = r4(1 - it.x); if (rot) m.z = r4(1 - it.z); }
  else { m.ax = r4(1 - it.ax); m.bx = r4(1 - it.bx); if (rot) { m.az = r4(1 - it.az); m.bz = r4(1 - it.bz); } }
  return m;
}
export function same(a, b) {
  if (a.t !== b.t) return false;
  if (a.t === 'box') return near(a.x, b.x) && near(a.z, b.z) && near(a.w, b.w) && near(a.h, b.h);
  if (a.t === 'tree' || a.t === 'pyr') return near(a.x, b.x) && near(a.z, b.z);
  return (near(a.ax, b.ax) && near(a.az, b.az) && near(a.bx, b.bx) && near(a.bz, b.bz)) || (near(a.ax, b.bx) && near(a.az, b.bz) && near(a.bx, b.ax) && near(a.bz, b.az));
}
export function findPartner(items, i) {
  if (i < 0 || !items[i]) return { partner: -1, mode: null };
  for (const mode of ['x', 'rot']) {
    const m = mirrorOf(items[i], mode);
    if (same(m, items[i])) continue; // bem no meio: não tem par
    const j = items.findIndex((q, k) => k !== i && same(q, m));
    if (j >= 0) return { partner: j, mode };
  }
  return { partner: -1, mode: null };
}
