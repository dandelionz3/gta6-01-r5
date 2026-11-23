// Marlin Cove — game.js (part 1)
// Main game: state, input, player + car physics, traffic, pedestrians.
(function () {
  'use strict';
  const D = window.MC_DATA;
  const W = window.MC_WORLD;
  const HUD = window.MC_HUD;
  const AU = window.MC_AUDIO;

  const SAVE_KEY = 'marlin-cove-save-v1';
  const params = new URLSearchParams(location.search);
  const SHOT = params.get('shot') || '';

  // ---------- state ----------
  const state = {
    mode: 'menu',           // menu | play | paused | busted | wasted
    money: 1250, health: 100, armour: 50, respect: 34, wanted: 0,
    weapon: 'pistol', weapons: { fists: Infinity, pistol: 120, smg: 0, shotgun: 24 },
    unlocked: { rifle: false, launcher: false, molotov: false },
    missionIndex: 0, missionStage: 1, speaker: 'mara',
    dialogue: D.CHARACTERS[0].line,
    district: 'harbour', radio: 0, clock: '19:42',
    speedKmh: 0, inCar: false, carName: '', carDamage: 100,
    player: { x: -60, z: 120, heading: 0, speed: 0 },
    marker: { x: -40, z: 100 },
    police: [], shells: 0, time: 0, dayMinutes: 19 * 60 + 42,
    kills: 0, carsStolen: 0, missionsDone: 0
  };

  let renderer, scene, camera, clock;
  let playerMesh, playerCar = null, heli = null, markerMesh;
  let traffic = [], peds = [], policeCars = [], smokeTimers = [];
  let keys = {}, yaw = 0, pitch = -0.12, camDist = 9;
  let shotFiredAt = 0, lastShot = 0, muzzle = null;
  let cityInfo = null;

  function districtFor(x, z) {
    const half = cityInfo.half;
    const fx = (x + half) / (2 * half), fz = (z + half) / (2 * half);
    if (fx < 0.22) return 'harbour';
    if (fx > 0.78) return 'beach';
    if (fz < 0.3) return 'downtown';
    return 'hills';
  }

  function clampToCity(v) {
    const lim = cityInfo.half + 60;
    return Math.max(-lim, Math.min(lim, v));
  }

  // ---------- input ----------
  function bindInput() {
    window.addEventListener('keydown', function (e) {
      keys[e.code] = true;
      if (e.code === 'KeyM') toggleMap();
      if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
      if (e.code === 'KeyE') tryEnterExitCar();
      if (e.code === 'KeyR') reloadWeapon();
      if (e.code === 'KeyQ') cycleRadio();
      if (/^Digit[1-7]$/.test(e.code)) selectWeapon(D.WEAPONS[+e.code.slice(5) - 1].id);
      if (e.code === 'KeyF') punchOrSteal();
      if (e.code === 'Enter' && state.mode === 'menu') startGame(false);
    });
    window.addEventListener('keyup', function (e) { keys[e.code] = false; });
    const canvas = document.getElementById('game-canvas');
    canvas.addEventListener('click', function () {
      if (state.mode === 'play' && !SHOT) {
        try { canvas.requestPointerLock(); } catch (e) {}
        AU.unlock(); AU.startEngine(); AU.startRadio();
      }
    });
    document.addEventListener('mousemove', function (e) {
      if (document.pointerLockElement === canvas && state.mode === 'play') {
        yaw -= e.movementX * 0.0032;
        pitch = Math.max(-0.6, Math.min(0.5, pitch - e.movementY * 0.0022));
      }
    });
    document.addEventListener('mousedown', function (e) {
      if (document.pointerLockElement === canvas && state.mode === 'play' && e.button === 0) fireWeapon();
    });
    window.addEventListener('resize', onResize);
  }

  function onResize() {
    if (!renderer) return;
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }

  // ---------- save / load ----------
  function saveGame(silent) {
    try {
      const data = {
        money: state.money, health: state.health, armour: state.armour,
        respect: state.respect, missionIndex: state.missionIndex,
        weapons: state.weapons, unlocked: state.unlocked,
        shells: state.shells, kills: state.kills, carsStolen: state.carsStolen,
        missionsDone: state.missionsDone, x: state.player.x, z: state.player.z
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      if (!silent) HUD.toast('Game saved — autosave at safehouse.');
    } catch (e) { /* storage may be unavailable under file:// in some browsers */ }
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function applySave(s) {
    state.money = s.money; state.health = s.health; state.armour = s.armour;
    state.respect = s.respect; state.missionIndex = s.missionIndex;
    state.weapons = s.weapons; state.unlocked = s.unlocked;
    state.shells = s.shells || 0; state.kills = s.kills || 0;
    state.carsStolen = s.carsStolen || 0; state.missionsDone = s.missionsDone || 0;
    state.player.x = s.x; state.player.z = s.z;
    state.missionStage = 1;
  }

  function exportSave() {
    const raw = localStorage.getItem(SAVE_KEY) || '{}';
    const ta = document.getElementById('save-text');
    if (ta) ta.value = raw;
    HUD.toast('Save exported — copy the text below.');
  }

  function importSave() {
    const ta = document.getElementById('save-text');
    if (!ta || !ta.value) { HUD.toast('Paste a save first.'); return; }
    try {
      const s = JSON.parse(ta.value);
      localStorage.setItem(SAVE_KEY, JSON.stringify(s));
      applySave(s);
      HUD.toast('Save imported.');
    } catch (e) { HUD.toast('That save text is not valid JSON.'); }
  }

  // ---------- world population ----------
  function spawnTraffic() {
    const rng = D.mulberry32(D.WORLD_SEED + 7);
    const half = cityInfo.half;
    for (let i = 0; i < 20; i++) {
      const def = D.CARS[Math.floor(rng() * D.CARS.length)];
      const mesh = W.makeCarMesh(def.color, false);
      const lane = Math.floor(rng() * 9);
      const x = -half + lane * W.PITCH + W.PITCH / 2 + (rng() > 0.5 ? 3 : -3);
      const z = -half + rng() * (2 * half);
      mesh.position.set(x, 0, z);
      scene.add(mesh);
      traffic.push({
        mesh, def, x, z, heading: rng() > 0.5 ? 0 : Math.PI,
        speed: 8 + rng() * 8, lane, axis: rng() > 0.5 ? 'z' : 'x'
      });
    }
  }

  function spawnPeds() {
    const rng = D.mulberry32(D.WORLD_SEED + 13);
    const half = cityInfo.half;
    const shirts = [0xe84a7a, 0x4ad4e8, 0xe8b04a, 0x7ad47a, 0xd4d4d4, 0x8e6fb8];
    for (let i = 0; i < 30; i++) {
      const mesh = W.makePersonMesh(shirts[i % shirts.length]);
      const x = -half + rng() * (2 * half);
      const z = -half + rng() * (2 * half);
      mesh.position.set(x, 0, z);
      scene.add(mesh);
      peds.push({ mesh, x, z, heading: rng() * Math.PI * 2, speed: 1 + rng() * 1.2, flee: 0 });
    }
  }

  function spawnPoliceCar(x, z) {
    const mesh = W.makeCarMesh(0x111144, true);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const car = { mesh, x, z, heading: 0, speed: 0, id: 'MC-' + (10 + policeCars.length) };
    policeCars.push(car);
    return car;
  }

  function clearPolice() {
    policeCars.forEach(function (c) { scene.remove(c.mesh); });
    policeCars = [];
    if (heli) { scene.remove(heli); heli = null; }
    AU.stopSiren();
  }

  function ensureWantedEscalation() {
    const want = state.wanted;
    const needCars = want >= 2 ? Math.min(5, want) : 0;
    while (policeCars.length < needCars) {
      const a = Math.random() * Math.PI * 2;
      spawnPoliceCar(state.player.x + Math.cos(a) * 40, state.player.z + Math.sin(a) * 40);
    }
    if (want >= 4 && !heli) {
      heli = W.makeHelicopter();
      heli.position.set(state.player.x + 20, 26, state.player.z - 30);
      scene.add(heli);
      AU.startSiren();
    }
    if (want < 4 && heli) { scene.remove(heli); heli = null; }
    if (want === 0) clearPolice();
  }

  // ---------- combat / wanted ----------
  function selectWeapon(id) {
    const w = D.WEAPONS.find(function (x) { return x.id === id; });
    if (!w) return;
    if (w.locked && !state.unlocked[id]) { HUD.toast(w.name + ' is LOCKED — buy it at the weapon shop.'); return; }
    if (id !== 'fists' && !(state.weapons[id] > 0)) { HUD.toast('No ammo for ' + w.name + '.'); return; }
    state.weapon = id;
    AU.SFX.ui();
  }

  function reloadWeapon() {
    const w = D.WEAPONS.find(function (x) { return x.id === state.weapon; });
    if (!w || w.id === 'fists') return;
    state.weapons[w.id] = w.ammo;
    HUD.toast(w.name + ' reloaded — ' + w.ammo + ' rounds.');
    AU.SFX.ui();
  }

  function fireWeapon() {
    const now = performance.now();
    const w = D.WEAPONS.find(function (x) { return x.id === state.weapon; });
    if (!w || now - lastShot < w.rate) return;
    lastShot = now;
    if (w.id === 'fists') { AU.SFX.punch(); punchOrSteal(); return; }
    if (!(state.weapons[w.id] > 0)) { HUD.toast('Out of ammo — press R to reload.'); return; }
    state.weapons[w.id]--;
    if (w.id === 'shotgun') AU.SFX.shotgun(); else AU.SFX.shoot();
    // Hitscan: nearest ped / police car in front cone takes damage.
    const px = state.player.x, pz = state.player.z;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    let best = null, bestD = 40;
    peds.forEach(function (p) {
      const dx = p.x - px, dz = p.z - pz, d = Math.hypot(dx, dz);
      if (d < bestD && (dx * fx + dz * fz) / (d || 1) > 0.85) { best = p; bestD = d; }
    });
    if (best) {
      best.flee = 6;
      state.kills++;
      raiseWanted(1);
      HUD.toast('Target down. The Cove saw that.');
      scene.remove(best.mesh);
      peds.splice(peds.indexOf(best), 1);
    }
    cameraShake(0.25);
  }

  function punchOrSteal() {
    // Fists: shove nearest ped; near a car with driver, pull them out.
    const px = state.player.x, pz = state.player.z;
    let best = null, bestD = 3.2;
    peds.forEach(function (p) {
      const d = Math.hypot(p.x - px, p.z - pz);
      if (d < bestD) { best = p; bestD = d; }
    });
    if (best) {
      best.flee = 5;
      state.kills++;
      raiseWanted(1);
      HUD.toast('You decked a pedestrian. MCPD is coming.');
    }
  }

  function raiseWanted(n) {
    state.wanted = Math.min(5, state.wanted + n);
    ensureWantedEscalation();
  }

  function cameraShake(amount) {
    if (!camera) return;
    camera.position.x += (Math.random() - 0.5) * amount;
    camera.position.y += (Math.random() - 0.5) * amount;
  }

  // ---------- cars ----------
  function nearestCar(maxD) {
    let best = null, bestD = maxD;
    traffic.forEach(function (t) {
      const d = Math.hypot(t.x - state.player.x, t.z - state.player.z);
      if (d < bestD) { best = t; bestD = d; }
    });
    return best;
  }

  function tryEnterExitCar() {
    if (state.mode !== 'play') return;
    if (state.inCar) {
      // Exit: place player beside the car.
      const c = playerCar;
      state.player.x = c.x + Math.cos(c.heading) * 3;
      state.player.z = c.z - Math.sin(c.heading) * 3;
      state.player.heading = c.heading;
      state.inCar = false;
      state.carName = '';
      playerCar = null;
      playerMesh.visible = true;
      AU.setEngine(0, false);
      return;
    }
    const t = nearestCar(6);
    if (!t) { HUD.toast('No car nearby — walk to one and press E.'); return; }
    playerCar = t;
    traffic.splice(traffic.indexOf(t), 1);
    state.inCar = true;
    state.carName = t.def.name;
    state.carDamage = 100;
    state.carsStolen++;
    playerMesh.visible = false;
    raiseWanted(1);
    HUD.toast('You took the ' + t.def.name + '. That was somebody\u2019s car.');
    AU.startEngine();
  }

  function updateCar(dt) {
    const c = playerCar;
    const def = c.def;
    const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 0.55 : 0);
    const steer = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0);
    const boost = keys.ShiftLeft ? 1.25 : 1;
    c.speed += fwd * def.accel * boost * dt;
    c.speed *= Math.pow(0.4, dt); // drag
    c.speed = Math.max(-10, Math.min(def.top * boost, c.speed));
    if (Math.abs(c.speed) > 0.5) c.heading += steer * 1.5 * dt * Math.sign(c.speed);
    c.x += Math.sin(c.heading) * c.speed * dt;
    c.z += Math.cos(c.heading) * c.speed * dt;
    c.x = clampToCity(c.x); c.z = clampToCity(c.z);
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.heading;
    state.player.x = c.x; state.player.z = c.z; state.player.heading = c.heading;
    state.speedKmh = Math.abs(c.speed) * 3.6;
    AU.setEngine(Math.abs(c.speed) / def.top, true);
    // Collision with traffic: slow + damage.
    traffic.forEach(function (t) {
      if (Math.hypot(t.x - c.x, t.z - c.z) < 4) {
        c.speed *= 0.6;
        state.carDamage = Math.max(0, state.carDamage - 4);
        if (state.carDamage < 30 && !c.smoking) {
          c.smoking = true;
          HUD.toast('Your car is smoking — get to the paint shop!');
        }
        if (state.carDamage <= 0) explodeCar(c);
      }
    });
  }

  function explodeCar(c) {
    AU.SFX.explosion();
    cameraShake(1.2);
    scene.remove(c.mesh);
    if (playerCar === c) {
      state.inCar = false;
      playerCar = null;
      playerMesh.visible = true;
      state.player.x = c.x + 4; state.player.z = c.z + 4;
      damagePlayer(35);
    }
    HUD.toast('The car exploded.');
  }

  function updatePlayer(dt) {
    const walk = 7;
    let mx = 0, mz = 0;
    if (keys.KeyW || keys.ArrowUp) mz += 1;
    if (keys.KeyS || keys.ArrowDown) mz -= 1;
    if (keys.KeyA || keys.ArrowLeft) mx -= 1;
    if (keys.KeyD || keys.ArrowRight) mx += 1;
    const len = Math.hypot(mx, mz) || 1;
    mx /= len; mz /= len;
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    const vx = (mx * cos - mz * sin) * walk;
    const vz = (mx * sin + mz * cos) * walk;
    state.player.x = clampToCity(state.player.x + vx * dt);
    state.player.z = clampToCity(state.player.z + vz * dt);
    state.speedKmh = Math.hypot(vx, vz) * 3.6;
    if (mx || mz) state.player.heading = Math.atan2(vx, vz);
    playerMesh.position.set(state.player.x, 0, state.player.z);
    playerMesh.rotation.y = state.player.heading;
  }

  // ---------- traffic / peds AI ----------
  function updateTraffic(dt) {
    const half = cityInfo.half;
    traffic.forEach(function (t) {
      // Brake if a car is ahead in the same lane.
      let blocked = false;
      traffic.forEach(function (o) {
        if (o === t) return;
        const dx = o.x - t.x, dz = o.z - t.z;
        const ahead = t.axis === 'z' ? dz * Math.sign(Math.cos(t.heading)) : dx * Math.sign(Math.sin(t.heading));
        if (ahead > 0 && ahead < 8 && Math.abs(t.axis === 'z' ? dx : dz) < 3) blocked = true;
      });
      const target = blocked ? 0 : t.speed;
      t.speed += (target - t.speed) * dt * 2;
      if (t.axis === 'z') {
        t.z += Math.cos(t.heading) * t.speed * dt;
        if (Math.abs(t.z) > half) { t.z = -Math.sign(t.z) * half; }
      } else {
        t.x += Math.sin(t.heading) * t.speed * dt;
        if (Math.abs(t.x) > half) { t.x = -Math.sign(t.x) * half; }
      }
      t.mesh.position.set(t.x, 0, t.z);
      t.mesh.rotation.y = t.heading;
    });
  }

  function updatePeds(dt) {
    peds.forEach(function (p) {
      if (p.flee > 0) {
        p.flee -= dt;
        const dx = p.x - state.player.x, dz = p.z - state.player.z;
        const d = Math.hypot(dx, dz) || 1;
        p.x += (dx / d) * 6 * dt;
        p.z += (dz / d) * 6 * dt;
      } else {
        p.x += Math.sin(p.heading) * p.speed * dt;
        p.z += Math.cos(p.heading) * p.speed * dt;
        if (Math.random() < dt * 0.1) p.heading += (Math.random() - 0.5) * 1.5;
        p.x = clampToCity(p.x); p.z = clampToCity(p.z);
      }
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
    });
  }

  function updatePolice(dt) {
    policeCars.forEach(function (c) {
      const dx = state.player.x - c.x, dz = state.player.z - c.z;
      const d = Math.hypot(dx, dz) || 1;
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      c.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, dh));
      const target = state.wanted >= 3 ? 34 : 26;
      c.speed += (target - c.speed) * dt;
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      // Ram the player.
      if (d < 4.5 && state.inCar) {
        state.carDamage = Math.max(0, state.carDamage - 8 * dt * 10);
        cameraShake(0.4);
        if (state.carDamage <= 0) explodeCar(playerCar);
      }
      if (d < 2.5 && !state.inCar) damagePlayer(20 * dt);
      // Light bar flash.
      const bar = c.mesh.getObjectByName('lightbar');
      if (bar) bar.material.color.setHex(Math.floor(state.time * 6) % 2 ? 0xff2222 : 0x2244ff);
    });
    if (heli) {
      const t = state.time;
      heli.position.set(
        state.player.x + Math.cos(t * 0.25) * 26,
        26 + Math.sin(t * 0.5) * 2,
        state.player.z + Math.sin(t * 0.25) * 26);
      const rotor = heli.getObjectByName('rotor');
      if (rotor) rotor.rotation.y += dt * 22;
      heli.lookAt(state.player.x, 0, state.player.z);
      const spot = heli.getObjectByName('spot');
      if (spot) spot.position.set(0, -25.8, 0);
    }
  }

  function damagePlayer(amount) {
    if (state.armour > 0) {
      const absorbed = Math.min(state.armour, amount);
      state.armour -= absorbed;
      amount -= absorbed;
    }
    state.health -= amount;
    if (state.health <= 0) {
      state.health = 0;
      if (state.wanted > 0) busted(); else wasted();
    }
  }

  function busted() {
    state.mode = 'busted';
    state.wanted = 0;
    state.money = Math.max(0, state.money - 200);
    clearPolice();
    AU.SFX.busted();
    document.exitPointerLock && document.exitPointerLock();
    HUD.showCenter('<h1>BUSTED</h1><p>MCPD took $200. The Cove forgets — for a price.</p>');
    setTimeout(function () { respawn(); }, 2500);
  }

  function wasted() {
    state.mode = 'wasted';
    AU.SFX.busted();
    document.exitPointerLock && document.exitPointerLock();
    HUD.showCenter('<h1>WASTED</h1><p>The tide took you. The safehouse brings you back.</p>');
    setTimeout(function () { respawn(); }, 2500);
  }

  function respawn() {
    HUD.hideCenter();
    state.health = 100; state.armour = 50;
    state.player.x = -60; state.player.z = 120;
    state.inCar = false; playerCar = null;
    playerMesh.visible = true;
    state.mode = 'play';
    saveGame(true);
  }

  // ---------- missions ----------
  function currentMission() { return D.MISSIONS[state.missionIndex] || D.MISSIONS[0]; }

  function missionTargets() {
    // Each mission stages its marker at a district landmark.
    const spots = [
      { x: -40, z: 100 }, { x: 120, z: -80 }, { x: 180, z: 60 },
      { x: -140, z: -40 }, { x: 60, z: 140 }, { x: 90, z: -140 }, { x: -140, z: -40 }
    ];
    return spots[state.missionIndex % spots.length];
  }

  function advanceMission() {
    const m = currentMission();
    if (state.missionStage < m.stages) {
      state.missionStage++;
      HUD.toast('STAGE ' + state.missionStage + '/' + m.stages + ' — ' + m.next);
      AU.SFX.mission();
    } else {
      completeMission();
    }
  }

  function completeMission() {
    const m = currentMission();
    const pay = 400 + state.missionIndex * 250;
    state.money += pay;
    state.respect = Math.min(100, state.respect + 12);
    state.missionsDone++;
    AU.SFX.cash();
    HUD.toast(m.title + ' COMPLETE — +$' + pay);
    state.missionIndex = Math.min(D.MISSIONS.length - 1, state.missionIndex + 1);
    state.missionStage = 1;
    const next = currentMission();
    state.speaker = next.giver;
    state.dialogue = next.dialogue;
    const t = missionTargets();
    state.marker = { x: t.x, z: t.z };
    markerMesh.position.set(t.x, 0.15, t.z);
    saveGame(true);
    if (state.missionsDone >= D.MISSIONS.length) {
      HUD.showCenter('<h1>MARLIN COVE IS YOURS</h1><p>You finished every job. The city is yours, Marlin.</p>');
      setTimeout(hideCenterSafe, 4000);
    }
  }

  function hideCenterSafe() { if (state.mode === 'play') HUD.hideCenter(); }

  function checkMissionProgress() {
    const d = Math.hypot(state.player.x - state.marker.x, state.player.z - state.marker.z);
    if (d < 8) {
      const t = missionTargets();
      // Move marker to next stage spot (alternate between two points).
      const alt = { x: t.x + 60, z: t.z - 40 };
      state.marker = state.missionStage % 2 ? alt : t;
      markerMesh.position.set(state.marker.x, 0.15, state.marker.z);
      advanceMission();
    }
    // Paint shop clears wanted.
    const paint = cityInfo.shops.find(function (s) { return s.id === 'paint'; });
    if (paint && Math.hypot(state.player.x - paint.x, state.player.z - paint.z) < 10 && state.wanted > 0) {
      state.wanted = 0;
      state.money = Math.max(0, state.money - 100);
      clearPolice();
      HUD.toast('New paint job — $100. The cops lost you.');
      AU.SFX.cash();
    }
    // Safehouse heals + saves.
    const safe = cityInfo.shops.find(function (s) { return s.id === 'safehouse'; });
    if (safe && Math.hypot(state.player.x - safe.x, state.player.z - safe.z) < 10) {
      if (state.health < 100) { state.health = 100; state.armour = 100; saveGame(true); HUD.toast('Safehouse — healed and saved.'); }
    }
    // Weapon shop unlocks.
    const ammo = cityInfo.shops.find(function (s) { return s.id === 'ammo'; });
    if (ammo && Math.hypot(state.player.x - ammo.x, state.player.z - ammo.z) < 10) {
      if (!state.unlocked.rifle && state.money >= 500) {
        state.money -= 500;
        state.unlocked.rifle = true;
        state.weapons.rifle = 90;
        HUD.toast('CARBINE bought — $500. Press 5 to equip.');
        AU.SFX.cash();
      }
    }
    // Collectibles: golden shells.
    D.COLLECTIBLES.forEach(function (c, i) {
      if (c.found) return;
      const sx = -150 + i * 60, sz = 150 - i * 40;
      if (Math.hypot(state.player.x - sx, state.player.z - sz) < 4) {
        c.found = true;
        state.shells++;
        state.money += 150;
        HUD.toast('Golden Shell found! ' + state.shells + '/6 — +$150');
        AU.SFX.pickup();
      }
    });
  }

  // ---------- menus ----------
  function menuHTML() {
    const save = loadGame();
    return '<p><b>MARLIN COVE</b> — a sun-soaked coastal city. Seven jobs. One fixer. ' +
      'Steal cars, lose the cops, take the harbour.</p>' +
      '<p>Controls: <b>WASD</b> move/drive • <b>Mouse</b> look (click to lock) • ' +
      '<b>Click</b> shoot • <b>E</b> enter/exit car • <b>F</b> punch/steal • ' +
      '<b>1–7</b> weapons • <b>R</b> reload • <b>Q</b> radio • <b>M</b> map • <b>P</b> pause</p>' +
      (save ? '<p>Save found: $' + save.money + ' • Job ' + (save.missionIndex + 1) + ' • ' +
        save.missionsDone + ' jobs done.</p>' : '<p>No save yet — a fresh tide.</p>') +
      '<p>Save backup (copy this text to keep your save):</p>' +
      '<textarea id="save-text" rows="2" cols="60" placeholder="save text appears here"></textarea>';
  }

  function showStartMenu() {
    state.mode = 'menu';
    HUD.showMenu(menuHTML(), [
      { label: 'NEW GAME', fn: function () { startGame(false); } },
      { label: 'CONTINUE', fn: function () { startGame(true); } },
      { label: 'CONTROLS', fn: function () { showControls(); } },
      { label: 'EXPORT SAVE', fn: exportSave },
      { label: 'IMPORT SAVE', fn: importSave }
    ]);
  }

  function showControls() {
    HUD.showMenu('<p><b>WASD / Arrows</b> — walk and drive<br><b>Mouse</b> — look (click canvas to lock)<br>' +
      '<b>Left click</b> — shoot / punch<br><b>E</b> — enter or exit a car<br>' +
      '<b>F</b> — punch, pull a driver out<br><b>1–7</b> — weapons<br>' +
      '<b>R</b> — reload &nbsp; <b>Q</b> — radio station<br>' +
      '<b>M</b> — full map &nbsp; <b>P</b> — pause</p>', [
      { label: 'BACK', fn: showStartMenu }
    ]);
  }

  function togglePause() {
    if (state.mode === 'play') {
      state.mode = 'paused';
      document.exitPointerLock && document.exitPointerLock();
      HUD.showMenu('<p>Game paused. The tide waits.</p>' + menuHTML(), [
        { label: 'RESUME', fn: function () { HUD.hideMenu(); state.mode = 'play'; } },
        { label: 'SAVE GAME', fn: function () { saveGame(false); } },
        { label: 'EXPORT SAVE', fn: exportSave },
        { label: 'QUIT TO MENU', fn: showStartMenu }
      ]);
    } else if (state.mode === 'paused') {
      HUD.hideMenu();
      state.mode = 'play';
    }
  }

  let mapOpen = false;
  function toggleMap() {
    if (state.mode !== 'play') return;
    mapOpen = !mapOpen;
    if (mapOpen) {
      HUD.showCenter('<h1>MARLIN COVE — FULL MAP</h1><p>Harbour Point (west) • Neon Row (north) • ' +
        'Coral Strand (east beach) • Palma Heights (south)<br>Yellow diamond = job marker • ' +
        'Red dots = MCPD • White dot = you<br>Paint shop clears stars • Safehouse heals &amp; saves • ' +
        'Weapon shop sells the Carbine ($500)</p>');
      setTimeout(function () { if (mapOpen) { HUD.hideCenter(); mapOpen = false; } }, 6000);
    } else HUD.hideCenter();
  }

  function cycleRadio() {
    state.radio = (state.radio + 1) % D.RADIO.length;
    AU.SFX.ui();
  }

  function startGame(continued) {
    if (continued) {
      const s = loadGame();
      if (s) applySave(s);
    } else {
      try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    }
    HUD.hideMenu();
    state.mode = 'play';
    const m = currentMission();
    state.speaker = m.giver;
    state.dialogue = m.dialogue;
    const t = missionTargets();
    state.marker = { x: t.x, z: t.z };
    markerMesh.position.set(t.x, 0.15, t.z);
    AU.unlock();
    HUD.toast(continued ? 'Welcome back to Marlin Cove.' : 'JOB 01 — FIRST TIDE. Meet Mara at the harbour.');
  }

  // ---------- camera ----------
  function updateCamera(dt) {
    const px = state.player.x, pz = state.player.z;
    const back = state.inCar ? 11 : 8;
    const height = state.inCar ? 4.2 : 3.4;
    const cx = px - Math.sin(yaw) * back * Math.cos(pitch);
    const cz = pz - Math.cos(yaw) * back * Math.cos(pitch);
    const cy = height - Math.sin(pitch) * back * 0.6;
    camera.position.set(cx, Math.max(1.2, cy), cz);
    camera.lookAt(px + Math.sin(yaw) * 4, 1.6, pz + Math.cos(yaw) * 4);
  }

  // ---------- ?shot= staging ----------
  function stageShot() {
    // Deterministic action frames for screenshots. Game is frozen (mode 'shot').
    const m = D.MISSIONS[2];
    state.missionIndex = 2; state.missionStage = 3;
    state.money = 48250; state.health = 82; state.armour = 64; state.respect = 71;
    state.speaker = 'juno';
    state.dialogue = D.CHARACTERS[1].line;
    state.clock = '19:42';
    state.radio = 0;
    state.weapons = { fists: Infinity, pistol: 96, smg: 180, shotgun: 32, rifle: 90 };
    state.unlocked = { rifle: true, launcher: false, molotov: false };
    state.weapon = 'smg';
    if (SHOT === 'start') {
      state.wanted = 0;
      state.missionIndex = 0; state.missionStage = 1;
      // Intersection of two roads, looking east along the strand road
      // toward the beach and the ocean at dusk.
      state.player.x = -110; state.player.z = 22;
      yaw = Math.PI / 2; pitch = 0.10;
      playerMesh.position.set(-110, 0, 22);
      playerMesh.rotation.y = yaw;
      state.dialogue = 'Welcome to Marlin Cove. The tide never sleeps — and neither do we.';
      state.speaker = 'mara';
    } else if (SHOT === 'chase') {
      state.wanted = 4;
      state.inCar = true;
      const def = D.CARS[5];
      const mesh = W.makeCarMesh(def.color, false);
      scene.add(mesh);
      // On the north-south road at x=22, driving +z; camera chases from behind.
      const car = { mesh, def, x: 22, z: 0, heading: 0, speed: 38 };
      mesh.position.set(22, 0, 0);
      mesh.rotation.y = 0;
      playerCar = car;
      state.carName = def.name;
      state.carDamage = 76;
      state.speedKmh = 128;
      state.player.x = 22; state.player.z = 0;
      yaw = 0; pitch = -0.08;
      playerMesh.visible = false;
      // Police pursuit + helicopter on screen, ahead and alongside.
      const spots = [[22, -16, 0], [18, -24, 0.15], [26, 20, Math.PI], [16, 30, Math.PI + 0.3]];
      spots.forEach(function (s) {
        const pc = spawnPoliceCar(s[0], s[1]);
        pc.heading = s[2]; pc.mesh.rotation.y = s[2];
      });
      heli = W.makeHelicopter();
      heli.position.set(30, 26, 42);
      scene.add(heli);
      state.marker = { x: 22, z: -80 };
      markerMesh.position.set(22, 0.15, -80);
    } else if (SHOT === 'mission') {
      state.wanted = 2;
      // Road intersection at (-22, 110), on foot.
      state.player.x = -22; state.player.z = 110;
      state.player.heading = 0.6;
      yaw = 0.6; pitch = -0.05;
      playerMesh.position.set(-22, 0, 110);
      playerMesh.rotation.y = 0.6;
      state.speaker = 'sable';
      state.dialogue = D.CHARACTERS[2].line;
      state.marker = { x: -22, z: 80 };
      markerMesh.position.set(-22, 0.15, 80);
      const p1 = spawnPoliceCar(-22, 86); p1.heading = Math.PI; p1.mesh.rotation.y = Math.PI;
      const p2 = spawnPoliceCar(-34, 128); p2.heading = -0.4; p2.mesh.rotation.y = -0.4;
    } else if (SHOT === 'night') {
      state.wanted = 5;
      state.clock = '21:07';
      state.inCar = true;
      const def = D.CARS[0];
      const mesh = W.makeCarMesh(def.color, false);
      scene.add(mesh);
      const car = { mesh, def, x: 22, z: 0, heading: 0, speed: 42 };
      mesh.position.set(22, 0, 0);
      mesh.rotation.y = 0;
      playerCar = car;
      state.carName = def.name;
      state.carDamage = 41;
      state.speedKmh = 141;
      state.player.x = 22; state.player.z = 0;
      yaw = 0; pitch = -0.06;
      playerMesh.visible = false;
      const spots = [[22, -16, 0], [18, -26, 0.2], [26, 22, Math.PI], [14, 34, Math.PI - 0.3], [30, -8, 0.4]];
      spots.forEach(function (s) {
        const pc = spawnPoliceCar(s[0], s[1]);
        pc.heading = s[2]; pc.mesh.rotation.y = s[2];
      });
      heli = W.makeHelicopter();
      heli.position.set(14, 24, 44);
      scene.add(heli);
      state.marker = { x: 22, z: -80 };
      markerMesh.position.set(22, 0.15, -80);
    }
    state.district = districtFor(state.player.x, state.player.z);
    state.mode = 'shot';
    document.body.classList.add('shot');
    HUD.hideMenu();
    HUD.update(state);
    // Force a render so the staged frame is on screen immediately.
    updateCamera(0);
    renderer.render(scene, camera);
    document.title = 'Marlin Cove — shot ' + SHOT;
    window.__MC_SHOT_READY__ = true;
  }

  // ---------- main loop ----------
  function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, clock.getDelta());
    if (state.mode === 'play') {
      state.time += dt;
      state.dayMinutes += dt * 0.35;
      const hh = Math.floor(state.dayMinutes / 60) % 24;
      const mm = Math.floor(state.dayMinutes % 60);
      state.clock = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
      if (state.inCar && playerCar) updateCar(dt); else updatePlayer(dt);
      updateTraffic(dt);
      updatePeds(dt);
      updatePolice(dt);
      ensureWantedEscalation();
      // Wanted decays when out of sight (no police near).
      if (state.wanted > 0) {
        const near = policeCars.some(function (c) {
          return Math.hypot(c.x - state.player.x, c.z - state.player.z) < 60;
        });
        if (!near && Math.random() < dt * 0.05) state.wanted = Math.max(0, state.wanted - 1);
      }
      state.district = districtFor(state.player.x, state.player.z);
      checkMissionProgress();
      updateCamera(dt);
      HUD.update(state);
    } else if (state.mode === 'shot') {
      // Frozen staged frame; keep the helicopter rotor turning for life.
      if (heli) {
        const rotor = heli.getObjectByName('rotor');
        if (rotor) rotor.rotation.y += 0.05;
      }
      updateCamera(0);
      HUD.update(state);
    }
    renderer.render(scene, camera);
  }

  // ---------- init ----------
  function init() {
    const canvas = document.getElementById('game-canvas');
    renderer = W.makeRenderer(canvas);
    renderer.setSize(window.innerWidth, window.innerHeight);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e1438);
    camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 6, -14);
    scene.add(new THREE.AmbientLight(0xffd9b0, 0.75));
    const sunLight = new THREE.DirectionalLight(0xff9a5a, 1.1);
    sunLight.position.set(-120, 90, -180);
    scene.add(sunLight);
    const moonLight = new THREE.DirectionalLight(0x8aa0ff, 0.25);
    moonLight.position.set(120, 140, 100);
    scene.add(moonLight);
    W.duskSky(scene);
    cityInfo = W.buildCity(scene);
    // Player figure.
    playerMesh = W.makePersonMesh(0x2a7fd4);
    playerMesh.position.set(state.player.x, 0, state.player.z);
    scene.add(playerMesh);
    // Mission marker.
    markerMesh = W.makeMarker(0xffd94a);
    const t = missionTargets();
    state.marker = { x: t.x, z: t.z };
    markerMesh.position.set(t.x, 0.15, t.z);
    scene.add(markerMesh);
    spawnTraffic();
    spawnPeds();
    HUD.build(document.getElementById('hud-root'));
    bindInput();
    clock = new THREE.Clock();
    if (SHOT) {
      stageShot();
    } else {
      showStartMenu();
      HUD.update(state);
    }
    tick();
    window.__MC_READY__ = true;
  }

  window.addEventListener('DOMContentLoaded', init);
})();

