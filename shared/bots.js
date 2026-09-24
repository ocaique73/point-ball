// Inteligência dos bots (roda no servidor e também na página /teste)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./game'));
  else root.RC_BOTS = factory(root.RC_GAME);
})(typeof self !== 'undefined' ? self : this, function (G) {
  const NAMES = ['Tonhão', 'Bigode', 'Faísca', 'Zé Borracha', 'Marreta', 'Pipoca', 'Trovão', 'Caçapa', 'Nhoque', 'Paçoca',
    'Biscoito', 'Tampinha', 'Ricochete', 'Mosquito', 'Coxinha', 'Ventania', 'Pé de Pano', 'Jacaré', 'Chiclete', 'Farofa',
    'Tatu', 'Formiga', 'Rabanete', 'Canela', 'Sabugo', 'Boliche', 'Parafuso', 'Mandioca', 'Picolé', 'Tapioca'];
  const COLORS = ['#f97316', '#a855f7', '#06b6d4', '#84cc16', '#ec4899', '#eab308', '#14b8a6', '#f43f5e'];

  function randomNames(n, taken) {
    const pool = NAMES.filter((x) => !(taken || []).includes(x));
    const out = [];
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    while (out.length < n) out.push('Bot ' + (out.length + 1));
    return out;
  }

  // níveis: err = erro de mira (rad), react = tempo de reação da mira (s), fire = quanto do tempo atira quando vê,
  // dodge = quanto desvia de lado, lead = quanto prevê o movimento do alvo, bomb = chance/s de jogar bomba, jump = chance/s de pular
  const LEVELS = {
    facil:   { err: 0.8,  react: 0.4,  fire: 0.45, dodge: 0.3, lead: 0,   bomb: 0,    jump: 0.05 },
    media:   { err: 0.5,  react: 0.22, fire: 0.75, dodge: 0.6, lead: 0.3, bomb: 0.05, jump: 0.15 },
    semipro: { err: 0.26, react: 0.09, fire: 1,    dodge: 1,   lead: 0.6, bomb: 0.12, jump: 0.3 },
    pro:     { err: 0.08, react: 0.04, fire: 1,    dodge: 1,   lead: 1,   bomb: 0.25, jump: 0.4 }
  };
  const LEVEL_NAMES = { facil: 'Fácil', media: 'Média', semipro: 'Semi-pro', pro: 'Profissional' };

  // decide o que o bot faz neste tick
  function think(game, p, dt) {
    if (!p.alive) return;
    const L = LEVELS[p.botLevel] || LEVELS.semipro;
    const ai = p.ai || (p.ai = {});
    if (!ai.seen) Object.assign(ai, { t: 0, mx: 0, my: 0, aimT: 0, lastX: p.x, lastY: p.y, stuckT: 0, err: 0, fireOn: true, fireT: 0, seen: {} });
    const c = game.cfg;
    const inp = { up: false, down: false, left: false, right: false, fire: false };
    if (p.jump) { game.setInput(p.id, inp); return; }

    // inimigo mais perto (dando preferência para quem está à vista)
    let target = null, best = Infinity, visible = false;
    for (const q of game.players.values()) {
      if (!game.isEnemy(p, q) || !q.alive || q.jump) continue;
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      const see = !G.lineBlocked(p.x, p.y, q.x, q.y, game.walls);
      const score = d + (see ? 0 : 600);
      if (score < best) { best = score; target = q; visible = see; }
    }

    ai.t -= dt; ai.aimT -= dt;
    const dist = target ? Math.hypot(target.x - p.x, target.y - p.y) : 0;

    // escolhe direção de tempos em tempos
    if (ai.t <= 0) {
      ai.t = 0.5 + Math.random() * 0.9;
      let mx = 0, my = 0;
      if (target) {
        const dx = (target.x - p.x) / (dist || 1), dy = (target.y - p.y) / (dist || 1);
        if (p.weapon === 'knife') { mx = dx; my = dy; } // faca: vai pra cima
        else if (visible && Math.random() > L.dodge) { mx = dx * 0.5; my = dy * 0.5; } // bots fracos andam meio reto
        else if (visible && dist < 260) { const s = Math.random() < 0.5 ? 1 : -1; mx = -dy * s - dx * 0.4; my = dx * s - dy * 0.4; } // desvia de lado
        else if (visible) { const s = Math.random() < 0.5 ? 1 : -1; mx = dx * 0.6 - dy * s * 0.6; my = dy * 0.6 + dx * s * 0.6; }
        else { mx = dx; my = dy; if (Math.random() < 0.35) { const a = Math.random() * Math.PI * 2; mx = Math.cos(a); my = Math.sin(a); } }
      } else if (Math.random() < 0.6) { const a = Math.random() * Math.PI * 2; mx = Math.cos(a); my = Math.sin(a); }
      ai.mx = mx; ai.my = my;
      ai.err = (Math.random() - 0.5) * L.err; // erro de mira (pra dar pra ganhar)
    }

    // travado na parede? troca de direção
    ai.stuckT += dt;
    if (ai.stuckT > 0.4) {
      const moved = Math.hypot(p.x - ai.lastX, p.y - ai.lastY);
      if ((ai.mx || ai.my) && moved < c.playerSpeed * 0.4 * 0.25) {
        const a = Math.random() * Math.PI * 2; ai.mx = Math.cos(a); ai.my = Math.sin(a); ai.t = 0.6;
      }
      ai.lastX = p.x; ai.lastY = p.y; ai.stuckT = 0;
    }

    inp.right = ai.mx > 0.38; inp.left = ai.mx < -0.38; inp.down = ai.my > 0.38; inp.up = ai.my < -0.38;

    // velocidade do alvo (para prever onde ele vai estar)
    let tvx = 0, tvy = 0;
    if (target) {
      const last = ai.seen[target.id];
      if (last) { tvx = (target.x - last.x) / dt; tvy = (target.y - last.y) / dt; if (Math.hypot(tvx, tvy) > c.playerSpeed * 2) { tvx = 0; tvy = 0; } }
      ai.seen = { [target.id]: { x: target.x, y: target.y } };
    }
    // atira em rajadas (bots fracos param de atirar às vezes)
    ai.fireT -= dt;
    if (ai.fireT <= 0) { ai.fireT = 0.4 + Math.random() * 0.6; ai.fireOn = Math.random() < L.fire; }

    if (target && visible) {
      // mira com reação e um pouco de erro
      if (ai.aimT <= 0) {
        ai.aimT = L.react;
        const tt = dist / c.bulletSpeed * L.lead;
        const a = Math.atan2(target.y + tvy * tt - p.y, target.x + tvx * tt - p.x) + ai.err;
        game.setAim(p.id, Math.cos(a), Math.sin(a));
      }
      if (p.weapon === 'gun') inp.fire = ai.fireOn;
      else if (dist < game.radiusOf(p) + c.knifeRange + game.radiusOf(target) + 6) inp.fire = true;
    } else if (target) {
      const a = Math.atan2(ai.my || (target.y - p.y), ai.mx || (target.x - p.x));
      if (ai.aimT <= 0) { ai.aimT = 0.3; game.setAim(p.id, Math.cos(a), Math.sin(a)); }
    }

    // bomba: quando o alvo está no alcance (e não colado)
    if (target && p.bombs > 0 && dist < c.bombRange && dist > c.bombRadius * 1.2 && Math.random() < dt * L.bomb) {
      const tt = c.bombFlight * (dist / c.bombRange) + c.bombFuse * 0.5;
      game.throwBomb(p.id, target.x + tvx * tt * L.lead, target.y + tvy * tt * L.lead);
    }

    // recarrega quando está longe e com pente pela metade
    if (p.weapon === 'gun' && !visible && p.ammo < c.magSize / 2 && p.mags > 0) game.requestReload(p.id);
    // super pulo de vez em quando para fugir ou chegar perto
    if (p.jumps >= 1 && (inp.up || inp.down || inp.left || inp.right) && Math.random() < dt * L.jump) game.requestJump(p.id);

    game.setInput(p.id, inp);
  }

  return { think, randomNames, COLORS, LEVELS, LEVEL_NAMES };
});
