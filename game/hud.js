// Marlin Cove — hud.js
// Builds and updates the dense HUD: mission banner, dispatch panel, wanted
// stars, money, clock, weapon slots, minimap, health/armour, speed, dialogue,
// radio line and district label. Pure DOM, no images.
(function () {
  'use strict';
  const D = window.MC_DATA;
  let els = {};

  function el(tag, cls, parent, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }

  function build(root) {
    const hud = el('div', 'hud', root);
    // Top-left: mission banner.
    const banner = el('div', 'panel mission', hud);
    els.missionNum = el('div', 'm-num', banner, 'JOB 01');
    els.missionTitle = el('div', 'm-title', banner, 'FIRST TIDE');
    els.missionStage = el('div', 'm-stage', banner, 'STAGE 1/3');
    els.missionObj = el('div', 'm-obj', banner, 'Meet Mara Voss at Harbour Point');
    els.missionNext = el('div', 'm-next', banner, 'NEXT: Drive to the yellow marker');
    // Top-left under banner: police dispatch panel.
    const disp = el('div', 'panel dispatch', hud);
    el('div', 'd-head', disp, 'MCPD DISPATCH — <span id="d-count">5 UNITS</span>');
    els.dispatchList = el('div', 'd-list', disp);
    // Top-right: wanted stars, money, clock.
    const tr = el('div', 'top-right', hud);
    els.stars = el('div', 'stars', tr, '★★★★★');
    els.money = el('div', 'money', tr, '$ 1,250');
    els.clock = el('div', 'clock', tr, '19:42  •  TUE');
    els.rank = el('div', 'rank', tr, 'RANK: STREET KID');
    // Weapon slots 1-7, right edge.
    const wbox = el('div', 'weapons', hud);
    els.weaponSlots = [];
    D.WEAPONS.forEach(function (w) {
      const s = el('div', 'wslot' + (w.locked ? ' locked' : ''), wbox,
        '<b>' + w.slot + '</b> ' + w.name + ' <span class="ammo"></span>');
      els.weaponSlots.push(s);
    });
    // Bottom-left: minimap (canvas) + district label.
    const bl = el('div', 'bottom-left', hud);
    els.minimap = el('canvas', 'minimap', bl);
    els.minimap.width = 190; els.minimap.height = 190;
    els.district = el('div', 'district', bl, 'HARBOUR POINT');
    els.standing = el('div', 'standing', bl, 'Dockhands trust you');
    // Bottom-right: health/armour/respect + speed + car.
    const br = el('div', 'bottom-right', hud);
    els.healthBar = el('div', 'bar health', br, '<i></i><span>HEALTH 100</span>');
    els.armourBar = el('div', 'bar armour', br, '<i></i><span>ARMOUR 50</span>');
    els.respectBar = el('div', 'bar respect', br, '<i></i><span>RESPECT</span>');
    els.speed = el('div', 'speed', br, '0');
    els.speedUnit = el('div', 'speed-unit', br, 'KM/H — ON FOOT');
    els.carName = el('div', 'car-name', br, 'ON FOOT');
    els.carDmg = el('div', 'bar damage', br, '<i></i><span>CONDITION</span>');
    // Bottom-centre: dialogue box.
    const dlg = el('div', 'panel dialogue', hud);
    els.portrait = el('div', 'portrait', dlg, 'MV');
    const dtext = el('div', 'd-text', dlg);
    els.speaker = el('div', 'd-name', dtext, 'MARA VOSS');
    els.speakerRole = el('div', 'd-role', dtext, 'Fixer — Harbour Point');
    els.dialogueLine = el('div', 'd-line', dtext, 'The tide brings in everything, kid. Even second chances.');
    // Radio line above dialogue.
    els.radio = el('div', 'radio', hud, '♪ WAVE 98.7 — TIDE FM • Sunset Over Marlin Bay — The Coraltones');
    // Centre toast + big centre screens.
    els.toast = el('div', 'toast', hud, '');
    els.center = el('div', 'center-screen', hud, '');
    els.objective = el('div', 'objective-flash', hud, '');
    // Menus (start / pause / controls / busted / wasted).
    const menu = el('div', 'menu', root);
    menu.id = 'menu';
    el('div', 'game-title', menu, 'MARLIN COVE');
    el('div', 'game-sub', menu, 'An open-world crime story • Sun-soaked coastal city • Original fiction');
    els.menuBody = el('div', 'menu-body', menu);
    els.menuButtons = el('div', 'menu-buttons', menu);
    els.hudRoot = hud;
    els.menuRoot = menu;
    return els;
  }

  function fmtMoney(n) { return '$ ' + n.toLocaleString('en-US'); }

  function update(state) {
    if (!els.hudRoot) return;
    const m = D.MISSIONS[state.missionIndex] || D.MISSIONS[0];
    els.missionNum.textContent = m.num;
    els.missionTitle.textContent = m.title;
    els.missionStage.textContent = 'STAGE ' + state.missionStage + '/' + m.stages;
    els.missionObj.textContent = m.objective;
    els.missionNext.textContent = 'NEXT: ' + m.next;
    // Dispatch panel.
    const units = D.POLICE_UNITS.filter(function (u, i) { return i < state.wanted; });
    els.dispatchList.innerHTML = units.map(function (u) {
      return '<div class="unit"><b>' + u.id + '</b> ' + u.role +
        ' <span>' + u.dist + 'm</span></div>';
    }).join('');
    document.getElementById('d-count').textContent = units.length + ' UNITS';
    // Wanted stars: filled = wanted level.
    let stars = '';
    for (let i = 1; i <= 5; i++) stars += i <= state.wanted ? '★' : '☆';
    els.stars.textContent = stars;
    els.stars.style.color = state.wanted >= 3 ? '#ff4444' : '#ffd94a';
    els.money.textContent = fmtMoney(state.money);
    els.clock.textContent = state.clock + '  •  TUE';
    els.rank.textContent = 'RANK: ' + (state.respect >= 75 ? 'COVE KING'
      : state.respect >= 50 ? 'CREW BOSS' : state.respect >= 25 ? 'HUSTLER' : 'STREET KID');
    // Weapons.
    D.WEAPONS.forEach(function (w, i) {
      const s = els.weaponSlots[i];
      const owned = state.weapons[w.id];
      const ammo = owned === undefined ? 0 : owned;
      s.classList.toggle('active', state.weapon === w.id);
      s.classList.toggle('locked', !!w.locked && !state.unlocked[w.id]);
      s.querySelector('.ammo').textContent = w.id === 'fists' ? '∞'
        : (w.locked && !state.unlocked[w.id]) ? 'LOCKED' : ammo;
    });
    // Bars.
    setBar(els.healthBar, state.health);
    setBar(els.armourBar, state.armour);
    setBar(els.respectBar, state.respect);
    setBar(els.carDmg, state.carDamage);
    els.speed.textContent = Math.round(state.speedKmh);
    els.speedUnit.textContent = (state.inCar ? 'KM/H' : 'KM/H — ON FOOT');
    els.carName.textContent = state.inCar ? state.carName : 'ON FOOT';
    // Dialogue.
    const ch = D.CHARACTERS.find(function (c) { return c.id === state.speaker; }) || D.CHARACTERS[0];
    els.portrait.textContent = ch.name.split(' ').map(function (w) { return w[0]; }).join('');
    els.portrait.style.background = ch.color;
    els.speaker.textContent = ch.name;
    els.speakerRole.textContent = ch.role;
    els.dialogueLine.textContent = state.dialogue;
    // District + radio.
    const dist = D.CITY.districts.find(function (d) { return d.id === state.district; }) || D.CITY.districts[0];
    els.district.textContent = dist.label;
    els.standing.textContent = dist.standing;
    const r = D.RADIO[state.radio % D.RADIO.length];
    els.radio.textContent = '♪ ' + r.station + ' • ' + r.song;
    drawMinimap(state);
  }

  function setBar(barEl, val) {
    const i = barEl.querySelector('i');
    if (i) i.style.width = Math.max(0, Math.min(100, val)) + '%';
    const sp = barEl.querySelector('span');
    if (sp && barEl.classList.contains('health')) sp.textContent = 'HEALTH ' + Math.round(val);
    if (sp && barEl.classList.contains('armour')) sp.textContent = 'ARMOUR ' + Math.round(val);
  }

  function drawMinimap(state) {
    const c = els.minimap, ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    ctx.fillStyle = 'rgba(10,14,24,0.85)';
    ctx.fillRect(0, 0, W, H);
    // Street grid.
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    const half = 220;
    for (let i = 0; i <= 9; i++) {
      const p = 12 + i * (W - 24) / 9;
      ctx.beginPath(); ctx.moveTo(p, 12); ctx.lineTo(p, H - 12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(12, p); ctx.lineTo(W - 12, p); ctx.stroke();
    }
    // Ocean strip on the right.
    ctx.fillStyle = '#1a6f8e';
    ctx.fillRect(W - 22, 0, 22, H);
    ctx.fillStyle = '#e8c98a';
    ctx.fillRect(W - 28, 0, 6, H);
    function toMap(x, z) {
      return [W / 2 + (x / half) * (W / 2 - 14), H / 2 + (z / half) * (H / 2 - 14)];
    }
    // Mission marker (yellow diamond).
    let mp = toMap(state.marker.x, state.marker.z);
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.moveTo(mp[0], mp[1] - 7); ctx.lineTo(mp[0] + 6, mp[1]); ctx.lineTo(mp[0], mp[1] + 7); ctx.lineTo(mp[0] - 6, mp[1]);
    ctx.closePath(); ctx.fill();
    // Police blips (red).
    ctx.fillStyle = '#ff4444';
    state.police.forEach(function (p) {
      const q = toMap(p.x, p.z);
      ctx.beginPath(); ctx.arc(q[0], q[1], 3.5, 0, 7); ctx.fill();
    });
    // Player blip (white arrow).
    const pp = toMap(state.player.x, state.player.z);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(pp[0], pp[1], 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(pp[0], pp[1], 2.2, 0, 7); ctx.fill();
  }

  function showMenu(html, buttons) {
    els.menuRoot.style.display = 'flex';
    els.menuBody.innerHTML = html;
    els.menuButtons.innerHTML = '';
    buttons.forEach(function (b) {
      const btn = el('button', 'menu-btn', els.menuButtons, b.label);
      btn.addEventListener('click', b.fn);
    });
  }
  function hideMenu() { els.menuRoot.style.display = 'none'; }
  function showCenter(html) { els.center.innerHTML = html; els.center.style.display = 'flex'; }
  function hideCenter() { els.center.style.display = 'none'; els.center.innerHTML = ''; }
  function toast(text, ms) {
    els.toast.textContent = text;
    els.toast.style.opacity = '1';
    setTimeout(function () { els.toast.style.opacity = '0'; }, ms || 2600);
  }

  window.MC_HUD = { build, update, showMenu, hideMenu, showCenter, hideCenter, toast, els: function () { return els; } };
})();
