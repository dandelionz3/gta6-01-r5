// Marlin Cove — world.js
// Builds the seeded 3D city with three.js: sky, streets, buildings, beach,
// ocean, palms, cars, pedestrians, helicopter. All geometry is boxes/cylinders.
(function () {
  'use strict';
  const D = window.MC_DATA;
  const GRID = 9;          // 9x9 blocks
  const BLOCK = 34;        // block size in metres
  const ROAD = 10;         // road width
  const PITCH = BLOCK + ROAD;

  function makeRenderer(canvas) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    return r;
  }

  function duskSky(scene) {
    // Gradient sky dome (big sphere, vertex colours) + dusk fog.
    const geo = new THREE.SphereGeometry(900, 24, 16);
    const colors = [];
    const pos = geo.attributes.position;
    const top = new THREE.Color(0x2a1e5e);
    const mid = new THREE.Color(0xe86a3c);
    const low = new THREE.Color(0xffb36b);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 900;
      const c = y > 0.35 ? top.clone().lerp(mid, 1 - (y - 0.35) / 0.65)
        : mid.clone().lerp(low, Math.max(0, (y + 0.1) / 0.45));
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false });
    const dome = new THREE.Mesh(geo, mat);
    scene.add(dome);
    // Sun disc low on the horizon over the ocean.
    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(46, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false }));
    sun.position.set(-260, 66, -620);
    sun.lookAt(0, 60, 0);
    scene.add(sun);
    scene.fog = new THREE.Fog(0xcf7a52, 120, 620);
  }

  function districtAt(bx, bz) {
    // West = harbour, east = beach, north = downtown, south = hills.
    const fx = bx / (GRID - 1), fz = bz / (GRID - 1);
    if (fx < 0.22) return D.CITY.districts[0];
    if (fx > 0.78) return D.CITY.districts[2];
    if (fz < 0.3) return D.CITY.districts[1];
    return D.CITY.districts[3];
  }

  function buildCity(scene) {
    const rng = D.mulberry32(D.WORLD_SEED);
    const half = (GRID * PITCH) / 2;
    // Ground slab.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(GRID * PITCH + 300, GRID * PITCH + 300),
      new THREE.MeshLambertMaterial({ color: 0x3a3f4a }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    scene.add(ground);
    // Ocean to the east, beach strip in front of it.
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(320, GRID * PITCH + 300),
      new THREE.MeshLambertMaterial({ color: 0x1a6f8e, emissive: 0x0a3a55 }));
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(half + 190, 0.02, 0);
    scene.add(ocean);
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(52, GRID * PITCH + 300),
      new THREE.MeshLambertMaterial({ color: 0xe8c98a }));
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(half + 36, 0.04, 0);
    scene.add(sand);
    // Roads: dark strips along every grid line.
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x23262e });
    for (let i = 0; i <= GRID; i++) {
      const c = -half + i * PITCH - ROAD / 2;
      const h = new THREE.Mesh(new THREE.PlaneGeometry(GRID * PITCH + ROAD, ROAD), roadMat);
      h.rotation.x = -Math.PI / 2; h.position.set(0, 0.06, c + ROAD / 2);
      scene.add(h);
      const v = new THREE.Mesh(new THREE.PlaneGeometry(ROAD, GRID * PITCH + ROAD), roadMat);
      v.rotation.x = -Math.PI / 2; v.position.set(c + ROAD / 2, 0.06, 0);
      scene.add(v);
    }
    // Buildings: instanced boxes, height + colour by district.
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    boxGeo.translate(0, 0.5, 0);
    const boxMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const count = GRID * GRID * 2;
    const inst = new THREE.InstancedMesh(boxGeo, boxMat, count);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    const col = new THREE.Color();
    const palette = [0x8e6fb8, 0xd47a5a, 0x5a9ed4, 0xe8b04a, 0x7ad4a0, 0xd45a8e, 0x6a7ad4];
    let n = 0;
    const buildings = [];
    for (let bx = 0; bx < GRID; bx++) {
      for (let bz = 0; bz < GRID; bz++) {
        const cx = -half + bx * PITCH + PITCH / 2;
        const cz = -half + bz * PITCH + PITCH / 2;
        const dist = districtAt(bx, bz);
        const tall = dist.id === 'downtown' ? 26 + rng() * 34
          : dist.id === 'harbour' ? 8 + rng() * 12 : 10 + rng() * 16;
        const w = 14 + rng() * 12, d = 14 + rng() * 12;
        const ox = (rng() - 0.5) * 6, oz = (rng() - 0.5) * 6;
        m4.compose(new THREE.Vector3(cx + ox, 0, cz + oz), q, new THREE.Vector3(w, tall, d));
        inst.setMatrixAt(n, m4);
        col.setHex(palette[Math.floor(rng() * palette.length)]);
        col.lerp(new THREE.Color(dist.color), 0.25);
        inst.setColorAt(n, col);
        buildings.push({ x: cx + ox, z: cz + oz, w, d, h: tall, district: dist.id });
        n++;
        // Second smaller tower on downtown blocks.
        if (dist.id === 'downtown' && rng() > 0.5) {
          m4.compose(new THREE.Vector3(cx - ox, 0, cz - oz), q,
            new THREE.Vector3(w * 0.6, tall * 0.6, d * 0.6));
          inst.setMatrixAt(n, m4);
          col.setHex(palette[Math.floor(rng() * palette.length)]);
          inst.setColorAt(n, col);
          n++;
        }
      }
    }
    inst.count = n;
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    scene.add(inst);
    // Lit windows: emissive small planes scattered on building faces.
    const winGeo = new THREE.PlaneGeometry(1.6, 1.1);
    const winMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
    const wins = new THREE.InstancedMesh(winGeo, winMat, 900);
    let wn = 0;
    for (let i = 0; i < buildings.length && wn < 900; i++) {
      const b = buildings[i];
      const rows = Math.min(6, Math.floor(b.h / 6));
      for (let r = 0; r < rows && wn < 900; r++) {
        const wy = 4 + r * 5 + rng() * 2;
        if (wy > b.h - 2) break;
        m4.makeTranslation(b.x + b.w / 2 + 0.06, wy, b.z + (rng() - 0.5) * b.d * 0.7);
        m4.multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
        wins.setMatrixAt(wn++, m4);
      }
    }
    wins.count = wn;
    wins.instanceMatrix.needsUpdate = true;
    scene.add(wins);
    // Palm trees along the beach strip + a few downtown.
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2a8e4a, emissive: 0x0a3a1a });
    const palms = [];
    for (let i = 0; i < 46; i++) {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 6), trunkMat);
      trunk.position.y = 3.5;
      g.add(trunk);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(3.2, 3.4, 7), leafMat);
      crown.position.y = 8.2;
      g.add(crown);
      const px = half + 18 + rng() * 30;
      const pz = -half + 20 + rng() * (GRID * PITCH - 40);
      g.position.set(px, 0, pz);
      scene.add(g);
      palms.push(g);
    }
    // Streetlights: emissive globes on poles along main roads.
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (let i = 0; i < 40; i++) {
      const x = -half + Math.floor(rng() * GRID) * PITCH + PITCH / 2;
      const z = -half + Math.floor(rng() * GRID) * PITCH + PITCH / 2;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 5), poleMat);
      pole.position.set(x + 8, 3, z + 8);
      scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat);
      lamp.position.set(x + 8, 6.2, z + 8);
      scene.add(lamp);
    }
    // Safehouse + paint shop + weapon shop markers (glowing boxes).
    const shops = [
      { id: 'safehouse', name: 'SAFEHOUSE', x: -half + PITCH * 1.5, z: -half + PITCH * 6.5, color: 0x4ad47a },
      { id: 'paint', name: 'PAINT SHOP', x: -half + PITCH * 4.5, z: -half + PITCH * 2.5, color: 0x4ad4e8 },
      { id: 'ammo', name: 'WEAPON SHOP', x: -half + PITCH * 6.5, z: -half + PITCH * 5.5, color: 0xe84a7a }
    ];
    for (const s of shops) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 8),
        new THREE.MeshLambertMaterial({ color: 0x2a2d33, emissive: s.color, emissiveIntensity: 0.5 }));
      box.position.set(s.x, 2.5, s.z);
      scene.add(box);
    }
    return { half, buildings, palms, shops, ocean };
  }

  function makeCarMesh(colorHex, isPolice) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({
      color: colorHex, emissive: isPolice ? 0x222244 : 0x000000 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
    body.position.y = 0.55;
    g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1),
      new THREE.MeshLambertMaterial({ color: 0x18222e, emissive: 0x0a1420 }));
    cabin.position.set(0, 1.1, -0.2);
    g.add(cabin);
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.36, wz);
      g.add(w);
    }
    if (isPolice) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      bar.position.set(0, 1.5, -0.2);
      bar.name = 'lightbar';
      g.add(bar);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 4.42),
        new THREE.MeshBasicMaterial({ color: 0xffffff }));
      stripe.position.y = 0.62;
      g.add(stripe);
    }
    // Headlights.
    const hl = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
    hl.position.set(0, 0.6, 2.22);
    g.add(hl);
    return g;
  }

  function makePersonMesh(shirtHex) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.9, 0.34),
      new THREE.MeshLambertMaterial({ color: shirtHex }));
    body.position.y = 1.05;
    g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42),
      new THREE.MeshLambertMaterial({ color: 0xe8b98a }));
    head.position.y = 1.75;
    g.add(head);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x2a3242 }));
    legs.position.y = 0.3;
    g.add(legs);
    return g;
  }

  function makeHelicopter() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 4.6),
      new THREE.MeshLambertMaterial({ color: 0x1a2a4a, emissive: 0x0a1226 }));
    g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 5),
      new THREE.MeshLambertMaterial({ color: 0x1a2a4a }));
    tail.position.set(0, 0.3, -4.2);
    g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    rotor.position.y = 1.0;
    rotor.name = 'rotor';
    g.add(rotor);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(3.2, 26, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.28, side: THREE.DoubleSide }));
    beam.position.y = -13;
    beam.name = 'beam';
    g.add(beam);
    const spot = new THREE.Mesh(new THREE.CircleGeometry(3.0, 16),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.5 }));
    spot.rotation.x = -Math.PI / 2;
    spot.position.y = -25.8;
    spot.name = 'spot';
    g.add(spot);
    return g;
  }

  function makeMarker(colorHex) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.25, 20),
      new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.85 }));
    m.position.y = 0.15;
    return m;
  }

  window.MC_WORLD = {
    GRID, BLOCK, ROAD, PITCH, makeRenderer, duskSky, districtAt,
    buildCity, makeCarMesh, makePersonMesh, makeHelicopter, makeMarker
  };
})();
