// HUD (vida, munição, pulo, K/D/A, placar) + teclado
window.PBHud = (function () {
  const esc = (s) => PB.esc(s);

  class Hud {
    constructor(container) {
      this.el = document.createElement('div');
      this.el.className = 'hud';
      this.el.innerHTML = `
        <div class="hud-topbar">
          <div class="hud-cell-left">
            <div class="box hud-weaponbox" id="h-bl">
              <div class="hud-weapons"><span class="w" id="h-w1">1 · Arma</span><span class="w" id="h-w2">2 · Faca</span></div>
              <div class="hud-ammo-row"><span class="hud-ammo" id="h-ammo"></span><div class="bar" id="h-bar-wrap"><i id="h-bar"></i></div></div>
              <div class="hud-hearts" id="h-hearts"></div>
              <div class="hud-ammo-sub" id="h-ammo-sub"></div>
            </div>
          </div>
          <div class="hud-cell-mid">
            <div class="hud-toprow">
              <div class="box hud-kda" id="h-kda">
                <span><b>ABATES</b><span id="h-k">0</span></span>
                <span><b>MORTES</b><span id="h-d">0</span></span>
                <span><b>ASSIST.</b><span id="h-a">0</span></span>
              </div>
              <div class="box hud-scorebox">
                <div class="hud-score" id="h-teamscore"><span class="a">AZUL</span><span id="h-sa">0</span><span class="muted">x</span><span id="h-sb">0</span><span class="b">VERMELHO</span></div>
                <div class="hud-score hud-ffa" id="h-ffa" style="display:none"></div>
                <div class="hud-round" id="h-round"></div>
              </div>
              <div class="box hud-jump" id="h-jumpbox"><div id="h-jump"></div><div class="bar blue"><i id="h-jbar"></i></div></div>
            </div>
            <div class="hud-light" id="h-light"></div>
          </div>
          <div class="hud-cell-right"><div class="hud-feed" id="h-feed"></div></div>
        </div>
        <div class="hud-center" id="h-center"></div>
        <div class="hud-help">WASD/Setas: andar · Mouse: mirar · Clique esquerdo: atirar/facada · Botão direito: bomba (segure para mirar) · Rodinha: fumaça · Espaço: super pulo · 1: arma · 2: faca · R: recarregar</div>`;
      container.appendChild(this.el);
      this.$ = (id) => this.el.querySelector('#' + id);
      this.feed = [];
      this.cache = {};
    }

    setScale(v) { this.el.style.setProperty('--hud', v); }

    set(id, html) {
      if (this.cache[id] === html) return;
      this.cache[id] = html;
      this.$(id).innerHTML = html;
    }

    addFeed(html) {
      const d = document.createElement('div');
      d.innerHTML = html;
      this.$('h-feed').prepend(d);
      setTimeout(() => d.remove(), 5000);
      while (this.$('h-feed').children.length > 6) this.$('h-feed').lastChild.remove();
    }

    // me = player do snapshot (ou null se espectador), s = snapshot, cfg
    update(me, s, cfg, opts) {
      opts = opts || {};
      this.setScale(cfg.hudScale);
      this.set('h-sa', String(s.sc ? s.sc.A : 0));
      this.set('h-sb', String(s.sc ? s.sc.B : 0));
      let rt = '';
      if (s.rt != null) { const m = Math.floor(s.rt / 60), sec = Math.floor(s.rt % 60); rt = ` · <span class="${s.rt <= 10 ? 'warn' : ''}">⏱ ${m}:${String(sec).padStart(2, '0')}</span>`; }
      const md = s.md || 'rounds', dm = md === 'tdm' || md === 'ffa' || md === 'koth';
      const modeName = md === 'tdm' ? 'Mata-mata em equipe' : md === 'koth' ? 'Rei da colina' : 'Cada um por si';
      const goal = md === 'koth' ? `${s.kl} pts` : `${s.kl} abates`;
      this.set('h-round', opts.sandbox ? 'Modo teste' : dm ? `${modeName} · meta ${goal}${rt}` : `Round ${s.rd || 1} de ${s.tr || 1}${rt}`);
      // placar: times, ou líder no cada-um-por-si
      const ffa = md === 'ffa' && !opts.sandbox;
      this.$('h-teamscore').style.display = ffa ? 'none' : '';
      this.$('h-ffa').style.display = ffa ? '' : 'none';
      if (ffa) {
        const ranked = s.p.slice().sort((a, b) => b.st[0] - a.st[0] || a.st[1] - b.st[1]);
        const lead = ranked[0], pos = me ? ranked.findIndex((p) => p.id === me.id) + 1 : 0;
        const nm = (id) => PB.esc(opts.nameOf ? opts.nameOf(id) : '?');
        this.set('h-ffa', lead ? `🏆 <span class="lead">${nm(lead.id)}</span> ${lead.st[0]}${me ? ` <span class="muted">·</span> Você ${me.st[0]} <small>(${pos}º)</small>` : ''}` : '');
      }
      let center = '';
      if (s.ph === 'countdown') center = `${Math.ceil(s.pu)}<small>${dm ? modeName : 'Round ' + s.rd}</small>`;
      else if (s.ph === 'roundEnd') center = opts.roundMsg || '';
      else if (me && !me.al && !opts.sandbox) center = dm ? `<small>Renascendo em ${Math.ceil(me.rs || 0)}s...</small>` : '<small>Você foi eliminado — aguarde o próximo round</small>';
      else if (me && me.sp) center = '<small>🛡️ Protegido — já já pode atirar</small>';
      this.set('h-center', center);
      const lg = s.lg;
      let lt = '';
      if (lg) lt = lg.s === 2 ? '🌑 LUZ APAGADA' : lg.s === 1 ? '<span class="warn">⚠️ APAGANDO...</span>' : `💡 Luz apaga em <b>${Math.ceil(lg.n)}s</b>`;
      const hz = s.hz;
      if (hz && hz.t === 'tornado') lt = hz.s === 2 ? '🌪️ FURACÃO!' : hz.s === 1 ? '<span class="warn">🌪️ Furacão nascendo...</span>' : `🌪️ Furacão em <b>${Math.ceil(hz.n)}s</b>`;
      if (s.pt) lt = s.pt.o ? (s.pt.n < 1.5 ? `<span class="warn">🌀 Portais fechando...</span>` : `🌀 2 pares <b>ABERTOS</b> · fecham em <b>${Math.ceil(s.pt.n)}s</b>`) : `🌀 Portais abrem em <b>${Math.ceil(s.pt.n)}s</b>`;
      if (hz && hz.t === 'sand') lt = hz.s === 2 ? '🏜️ TEMPESTADE DE AREIA!' : hz.s === 1 ? '<span class="warn">🏜️ Areia juntando no meio...</span>' : `🏜️ Tempestade de areia em <b>${Math.ceil(hz.n)}s</b>`;
      if (hz && hz.t === 'city') { const off = (hz.lo || []).filter((x) => x > 0).length; lt = off ? `💡 <b>${off}</b> poste${off > 1 ? 's' : ''} apagado${off > 1 ? 's' : ''}` : '💡 Atire nos postes para apagar a luz'; }
      if (hz && hz.t === 'lava') lt = hz.s === 2 ? '🌋 LAVA! Paredes do meio mudaram' : hz.s === 1 ? '<span class="warn">🌋 O chão está rachando...</span>' : `🌋 Lava em <b>${Math.ceil(hz.n)}s</b>`;
      if (hz && hz.t === 'meteor') lt = hz.m ? '<span class="warn">☄️ METEOROS CHEGANDO!</span>' : hz.ml > 0 ? `☄️ Meteoros em <b>${Math.ceil(hz.n)}s</b>${hz.h && hz.h.length ? ' · 🕳️ cuidado com os buracos' : ''}` : '🕳️ Sem mais meteoros · cuidado com os buracos';
      if (hz && hz.t === 'storm') lt = hz.s === 2 ? '❄️ TEMPESTADE FRIA!' : hz.s === 1 ? '<span class="warn">❄️ Tempestade chegando no centro...</span>' : `❄️ Tempestade em <b>${Math.ceil(hz.n)}s</b>`;
      if (s.hl && s.ph === 'playing') {
        const o = s.hl.o;
        let ht = o === 'A' ? '<span class="tA">⛰️ AZUL dominando a colina</span>' : o === 'B' ? '<span class="tB">⛰️ VERMELHO dominando a colina</span>'
          : o === 'X' ? '<span class="warn">⛰️ Colina disputada!</span>' : '⛰️ Colina livre';
        let mv = s.hl.n <= 5 ? ` · <span class="warn">fecha em ${Math.ceil(s.hl.n)}s</span>` : ` · fecha em ${Math.ceil(s.hl.n)}s`;
        if (s.hl.pv) { ht = '<span class="warn">⛰️ Nova colina aparecendo...</span>'; mv = ` · vale em ${Math.ceil(s.hl.n)}s`; }
        lt = lt ? `${ht}${mv} &nbsp;|&nbsp; ${lt}` : `${ht}${mv}`;
      }
      this.set('h-light', lt);

      const show = !!me;
      for (const id of ['h-bl', 'h-kda', 'h-jumpbox']) this.$(id).style.display = show ? '' : 'none';
      if (!me) return;

      let hearts = '';
      for (let i = 0; i < cfg.lives; i++) hearts += `<span class="${i < me.l ? '' : 'lost'}">❤️</span>`;
      if (cfg.bombCount > 0) hearts += ` <span class="hud-bombs ${me.bo > 0 ? '' : 'lost'}" title="Bomba (botão direito)">💣×${me.bo || 0}</span>`;
      if (cfg.smokeCount > 0) hearts += ` <span class="hud-bombs ${me.so > 0 ? '' : 'lost'}" title="Fumaça (rodinha do mouse)">💨×${me.so || 0}</span>`;
      this.set('h-hearts', hearts);
      this.$('h-w1').classList.toggle('on', me.w === 1);
      this.$('h-w2').classList.toggle('on', me.w === 2);

      let pct = 0, sub = '';
      if (me.w === 2) {
        this.set('h-ammo', '🔪<small> faca infinita</small>');
        sub = me.am + me.mg > 0 ? `Arma: ${me.am}/${cfg.magSize} · pentes ${me.mg}` : 'Sem balas — use a faca';
      } else {
        this.set('h-ammo', `${me.am}<small>/${cfg.magSize} · pentes ${me.mg}</small>`);
        if (me.rl > 0) { sub = 'Recarregando...'; pct = 1 - me.rl / cfg.reloadTime; }
        else if (me.am === 0 && me.mg === 0) sub = 'Sem balas — aperte 2 para faca';
        else { sub = me.fc > 0 ? 'Próximo tiro...' : 'Pronto para atirar'; pct = 1 - me.fc / cfg.fireCooldown; }
      }
      this.set('h-ammo-sub', sub);
      this.$('h-bar').style.width = Math.round(Math.max(0, Math.min(1, pct)) * 100) + '%';

      if (me.j >= 1) {
        this.set('h-jump', '🦘 Pulo <span class="ready">PRONTO</span> <span class="muted small">(Espaço)</span>');
        this.$('h-jbar').style.width = '100%';
      } else {
        this.set('h-jump', `🦘 Pulo em <b>${Math.ceil(me.jc)}s</b>`);
        this.$('h-jbar').style.width = Math.round((1 - me.jc / cfg.jumpCooldown) * 100) + '%';
      }
      this.set('h-k', String(me.st[0]));
      this.set('h-d', String(me.st[1]));
      this.set('h-a', String(me.st[2]));
    }
  }

  // Teclado + mouse: callbacks onChange(input), onWeapon(1|2), onReload(), onJump()
  // h.mouseEl = elemento onde o clique esquerdo atira
  function bindKeys(h) {
    const keys = { up: false, down: false, left: false, right: false, fire: false };
    const map = {
      KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
      KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right'
    };
    if (h.mouseEl) {
      h.mouseEl.addEventListener('mousedown', (e) => {
        if (e.button === 2 && h.enabled() && h.onBomb) { e.preventDefault(); h.onBomb(true); return; }
        if (e.button !== 0 || !h.enabled()) return;
        e.preventDefault();
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        if (!keys.fire) { keys.fire = true; h.onChange(Object.assign({}, keys)); }
      });
      h.mouseEl.addEventListener('contextmenu', (e) => e.preventDefault());
      window.addEventListener('mouseup', (e) => {
        if (e.button === 0 && keys.fire) { keys.fire = false; h.onChange(Object.assign({}, keys)); }
        if (e.button === 2 && h.onBomb) h.onBomb(false);
      });
      // rodinha do mouse: joga a fumaça (uma por giro, com uma pausa para não gastar sem querer)
      let wheelT = 0;
      h.mouseEl.addEventListener('wheel', (e) => {
        if (!h.enabled() || !h.onSmoke) return;
        e.preventDefault();
        const now = performance.now();
        if (now - wheelT < 400) return;
        wheelT = now; h.onSmoke();
      }, { passive: false });
    }
    function isTyping(e) {
      const t = e.target;
      if (!t || !t.tagName) return false;
      if (t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') return true;
      if (t.tagName === 'INPUT') return !['checkbox', 'range', 'button', 'radio', 'file'].includes(t.type);
      return false;
    }
    function down(e) {
      if (isTyping(e) || !h.enabled()) return;
      const k = map[e.code];
      if (k) {
        e.preventDefault();
        if (!keys[k]) { keys[k] = true; h.onChange(Object.assign({}, keys)); }
        return;
      }
      if (e.repeat) return;
      if (e.code === 'Digit1' || e.code === 'Numpad1') h.onWeapon(1);
      else if (e.code === 'Digit2' || e.code === 'Numpad2') h.onWeapon(2);
      else if (e.code === 'KeyR') h.onReload();
      else if (e.code === 'Space') { e.preventDefault(); h.onJump(); }
    }
    function up(e) {
      const k = map[e.code];
      if (k && keys[k]) { keys[k] = false; h.onChange(Object.assign({}, keys)); }
    }
    function blur() {
      let ch = false;
      for (const k in keys) if (keys[k]) { keys[k] = false; ch = true; }
      if (ch) h.onChange(Object.assign({}, keys));
    }
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return keys;
  }

  return { Hud, bindKeys };
})();
