// Utilidades compartilhadas pelas páginas (perfil, id do jogador, toasts)
window.PB = (function () {
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'x' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // id persistente do navegador (permite reconectar depois de recarregar/fechar o Chrome).
  // Para testar vários jogadores no mesmo navegador, use ?p=2, ?p=3 ... na URL da sala.
  function clientId() {
    let id = store.get('pb_cid', null);
    if (!id) { id = uid(); store.set('pb_cid', id); }
    const p = new URLSearchParams(location.search).get('p');
    return p ? id + '-p' + p.replace(/[^a-z0-9]/gi, '').slice(0, 4) : id;
  }

  const COLORS = ['#ffcc00', '#22c55e', '#a855f7', '#f97316', '#06b6d4', '#ec4899', '#84cc16', '#f43f5e'];
  function profileKey() {
    const p = new URLSearchParams(location.search).get('p');
    return p ? 'pb_profile_p' + p : 'pb_profile';
  }
  function getProfile() {
    let pr = store.get(profileKey(), null);
    if (!pr) {
      pr = { name: 'Jogador' + Math.floor(100 + Math.random() * 900), avatar: '' };
      store.set(profileKey(), pr);
    }
    return pr;
  }
  function saveProfile(pr) { store.set(profileKey(), pr); }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  function toast(msg, ms) {
    let box = document.getElementById('toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.remove(), ms || 3000);
  }

  // avatar arredondado (foto) ou círculo com a cor e a inicial do nick
  function avatarHTML(p, size) {
    size = size || 36;
    const tc = p.team === 'A' ? '#3b82f6' : p.team === 'B' ? '#ef4444' : '#8a94ad'; // cor do time
    const style = `width:${size}px;height:${size}px;background:${tc};font-size:${Math.round(size * 0.45)}px`;
    const initial = esc((p.name || '?').trim().charAt(0).toUpperCase());
    if (p.avatar) {
      return `<span class="avatar" style="${style}"><img src="${esc(p.avatar)}" alt="" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover" onerror="this.remove()"></span>`;
    }
    return `<span class="avatar" style="${style}">${initial}</span>`;
  }

  // Modal "Perfil": nick (até 20), url da foto, cor do personagem
  function openProfile(onSave) {
    const pr = getProfile();
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `
      <div class="card modal">
        <h2>Perfil</h2>
        <div class="profile-preview"><span id="pf-prev"></span><div><b id="pf-prev-name"></b><div class="muted small">Assim os outros vão te ver</div></div></div>
        <label>Nick (até 20 caracteres)</label>
        <input type="text" id="pf-name" maxlength="20">
        <label>URL da foto (opcional)</label>
        <input type="url" id="pf-avatar" placeholder="https://...">
        <div class="error" id="pf-err"></div>
        <div class="row" style="justify-content:flex-end;margin-top:8px">
          <button class="btn" id="pf-cancel">Cancelar</button>
          <button class="btn primary" id="pf-save">Salvar</button>
        </div>
      </div>`;
    document.body.appendChild(bg);
    const $ = (id) => bg.querySelector('#' + id);
    $('pf-name').value = pr.name; $('pf-avatar').value = pr.avatar || '';
    const prev = () => {
      const p = { name: $('pf-name').value || '?', avatar: $('pf-avatar').value.trim(), color: '#ffcc33' };
      $('pf-prev').innerHTML = avatarHTML(p, 64);
      $('pf-prev-name').textContent = p.name;
    };
    ['pf-name', 'pf-avatar'].forEach((id) => $(id).addEventListener('input', prev));
    prev();
    const close = () => bg.remove();
    $('pf-cancel').onclick = close;
    bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
    $('pf-save').onclick = () => {
      const name = $('pf-name').value.trim();
      const avatar = $('pf-avatar').value.trim();
      if (!name) return ($('pf-err').textContent = 'Digite um nick.');
      if (name.length > 20) return ($('pf-err').textContent = 'Nick com no máximo 20 caracteres.');
      if (avatar && !/^https?:\/\//i.test(avatar)) return ($('pf-err').textContent = 'A URL da foto precisa começar com http:// ou https://');
      const np = { name, avatar };
      saveProfile(np);
      close();
      if (onSave) onSave(np);
    };
    $('pf-name').focus();
  }

  const TEAM_NAME = { A: 'Azul', B: 'Vermelho' };
  const MAP_NAME = { deserto: 'Deserto', neve: 'Neve', floresta: 'Floresta', escuro: 'Sala escura', portal: 'Portais', cidade: 'Cidade à noite', vulcao: 'Vulcão', nave: 'Nave espacial' };

  const MAP_NOTE = {
    deserto: '🏜️ A cada 25s uma tempestade de areia sai do meio para as laterais e tampa a visão.',
    neve: '❄️ A cada 25s uma tempestade fria desce pelo mapa e congela quem pegar.',
    floresta: '🌪️ A cada 25s nasce um furacão que anda pelo mapa e joga longe quem ele tocar.',
    cidade: '🌃 Escuro o tempo todo: o inimigo só aparece na luz dos postes, bem perto de você ou quando atira. Atire num poste para apagá-lo por 8s.',
    vulcao: '🌋 A cada 25s o chão racha (2s de aviso) e sobem poças de lava por 7s — encostar tira 1 vida. As paredes do meio mudam de lugar a cada erupção.',
    nave: '☄️ A cada 25s caem 2 meteoros, um de cada lado (sempre espelhados), e abrem buracos para o espaço. Na beira do buraco você ainda consegue sair; no meio cai. Tiro que passa por cima é sugado.',
    portal: '🌀 8 portais nas bordas (2 em cada lado). A cada abertura, 2 pares sorteados abrem — entre (ou atire) em um e saia no par da mesma cor. No começo abrem 3s (cima ↔ baixo), fecham 6s, e depois abrem 10s / fecham 5s sorteados.',
    escuro: '🌑 A luz apaga a cada 25s — no escuro só o tiro aparece.'
  };

  return { MAP_NOTE, store, clientId, getProfile, saveProfile, esc, toast, avatarHTML, openProfile, TEAM_NAME, MAP_NAME };
})();
