// HUD (vida, munição, pulo, K/D/A, placar) + teclado
window.PBHud = (function () {
  const esc = (s) => PB.esc(s);

  class Hud {
    constructor(container) {
      this.el = document.createElement('div');
      this.el.className = 'hud';
      this.el.innerHTML = `
        <div class="hud-top"><div class="box">
          <div class="hud-score"><span class="a">AZUL</span><span id="h-sa">0</span><span class="muted">x</span><span id="h-sb">0</span><span class="b">VERMELHO</span></div>
          <div class="hud-round" id="h-round"></div></div></div>
        <div class="hud-feed" id="h-feed"></div>
        <div class="hud-center" id="h-center"></div>
        <div class="hud-bl" id="h-bl">
          <div class="box"><div class="hud-hearts" id="h-hearts"></div></div>
          <div class="box">
            <div class="hud-weapons"><span class="w" id="h-w1">1 · Arma</span><span class="w" id="h-w2">2 · Faca</span></div>
            <div class="hud-ammo" id="h-ammo"></div>
            <div class="bar" id="h-bar-wrap"><i id="h-bar"></i></div>
            <div class="small muted" id="h-ammo-sub"></div>
          </div>
        </div>
        <div class="hud-br" id="h-br">
          <div class="box hud-jump"><div id="h-jump"></div><div class="bar blue"><i id="h-jbar"></i></div></div>
          <div class="box hud-kda">
            <span><b>ABATES</b><span id="h-k">0</span></span>
            <span><b>MORTES</b><span id="h-d">0</span></span>
            <span><b>ASSIST.</b><span id="h-a">0</span></span>
          </div>
        </div>
        <div class="hud-help">WASD/Setas: andar · Espaço: atirar/facada · 1: arma · 2: faca · R: recarregar · Shift ou E: super pulo</div>`;
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
      this.set('h-round', opts.sandbox ? 'Modo teste' : `Round ${s.rd || 1} de ${s.tr || 1}`);
      let center = '';
      if (s.ph === 'countdown') center = `${Math.ceil(s.pu)}<small>Round ${s.rd}</small>`;
      else if (s.ph === 'roundEnd') center = opts.roundMsg || '';
      else if (me && !me.al && !opts.sandbox) center = '<small>Você foi eliminado — aguarde o próximo round</small>';
      this.set('h-center', center);

      const show = !!me;
      this.$('h-bl').style.display = show ? '' : 'none';
      this.$('h-br').style.display = show ? '' : 'none';
      if (!me) return;

      let hearts = '';
      for (let i = 0; i < cfg.lives; i++) hearts += `<span class="${i < me.l ? '' : 'lost'}">❤️</span>`;
      this.set('h-hearts', hearts);
      this.$('h-w1').classList.toggle('on', me.w === 1);
      this.$('h-w2').classList.toggle('on', me.w === 2);

      let pct = 0, sub = '';
      if (me.w === 2) {
        this.set('h-ammo', '🔪 <small>faca infinita</small>');
        sub = me.am + me.mg > 0 ? `Arma: ${me.am}/${cfg.magSize} · pentes ${me.mg}` : 'Sem balas — use a faca';
      } else {
        this.set('h-ammo', `${me.am}<small> / ${cfg.magSize}</small> &nbsp;<small>pentes: ${me.mg}</small>`);
        if (me.rl > 0) { sub = 'Recarregando...'; pct = 1 - me.rl / cfg.reloadTime; }
        else if (me.am === 0 && me.mg === 0) sub = 'Sem balas — aperte 2 para faca';
        else { sub = me.fc > 0 ? 'Próximo tiro...' : 'Pronto para atirar'; pct = 1 - me.fc / cfg.fireCooldown; }
      }
      this.set('h-ammo-sub', sub);
      this.$('h-bar').style.width = Math.round(Math.max(0, Math.min(1, pct)) * 100) + '%';

      if (me.j >= 1) {
        this.set('h-jump', '🦘 Super pulo: <span class="ready">PRONTO</span> <span class="muted small">(Shift/E)</span>');
        this.$('h-jbar').style.width = '100%';
      } else {
        this.set('h-jump', `🦘 Super pulo em <b>${Math.ceil(me.jc)}s</b>`);
        this.$('h-jbar').style.width = Math.round((1 - me.jc / cfg.jumpCooldown) * 100) + '%';
      }
      this.set('h-k', String(me.st[0]));
      this.set('h-d', String(me.st[1]));
      this.set('h-a', String(me.st[2]));
    }
  }

  // Teclado: callbacks onChange(input), onWeapon(1|2), onReload(), onJump()
  function bindKeys(h) {
    const keys = { up: false, down: false, left: false, right: false, fire: false };
    const map = {
      KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
      KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'fire'
    };
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
      else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyE') { e.preventDefault(); h.onJump(); }
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
