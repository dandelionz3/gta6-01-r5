// Marlin Cove — data.js
// All world data: seeded RNG, districts, vehicles, weapons, characters, missions.
// Original fiction. No Rockstar / GTA names, characters, maps or art.
(function () {
  'use strict';

  // Seeded RNG (mulberry32) so the world is deterministic.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const WORLD_SEED = 20261124;
  const rng = mulberry32(WORLD_SEED);

  const CITY = {
    name: 'Marlin Cove',
    motto: 'Where the tide never sleeps.',
    districts: [
      { id: 'harbour', name: 'Harbour Point', label: 'HARBOUR POINT', color: 0x2e6f8e, standing: 'Dockhands trust you' },
      { id: 'downtown', name: 'Neon Row', label: 'NEON ROW', color: 0x8e4a9e, standing: 'Neon Row watches you' },
      { id: 'beach', name: 'Coral Strand', label: 'CORAL STRAND', color: 0xe08a3c, standing: 'Beach crews wave you through' },
      { id: 'hills', name: 'Palma Heights', label: 'PALMA HEIGHTS', color: 0x4a8e5a, standing: 'Heights residents keep quiet' }
    ]
  };

  const CARS = [
    { id: 'gull', name: 'Gullwing GT', top: 46, accel: 22, color: 0xd43d2a },
    { id: 'marlin', name: 'Marlin S', top: 40, accel: 19, color: 0x2a7fd4 },
    { id: 'tide', name: 'Tide Runner', top: 36, accel: 17, color: 0xe8c33a },
    { id: 'cove', name: 'Cove Cruiser', top: 33, accel: 15, color: 0x7a4ad4 },
    { id: 'dock', name: 'Dock Hauler', top: 30, accel: 13, color: 0x5a6b7a },
    { id: 'sting', name: 'Stingray X', top: 48, accel: 24, color: 0x1ad4a0 }
  ];

  const WEAPONS = [
    { id: 'fists', slot: 1, name: 'FISTS', ammo: Infinity, damage: 12, rate: 320 },
    { id: 'pistol', slot: 2, name: 'PISTOL', ammo: 120, damage: 22, rate: 260 },
    { id: 'smg', slot: 3, name: 'SMG', ammo: 240, damage: 14, rate: 90 },
    { id: 'shotgun', slot: 4, name: 'SHOTGUN', ammo: 48, damage: 55, rate: 700 },
    { id: 'rifle', slot: 5, name: 'CARBINE', ammo: 90, damage: 34, rate: 150, locked: true },
    { id: 'launcher', slot: 6, name: 'LAUNCHER', ammo: 6, damage: 120, rate: 1200, locked: true },
    { id: 'molotov', slot: 7, name: 'MOLOTOV', ammo: 8, damage: 40, rate: 900, locked: true }
  ];

  const CHARACTERS = [
    { id: 'mara', name: 'MARA VOSS', role: 'Fixer — Harbour Point', color: '#e8b04a',
      line: 'The tide brings in everything, kid. Even second chances.' },
    { id: 'juno', name: 'JUNO REEF', role: 'Wheelman — Neon Row', color: '#4ad4e8',
      line: 'You drive like the harbour police are your in-laws. Loosen up.' },
    { id: 'sable', name: 'SABLE ORTIZ', role: 'Broker — Palma Heights', color: '#e84a7a',
      line: 'One last job, Marlin. Then the Cove is ours. All of it.' }
  ];

  const RADIO = [
    { station: 'WAVE 98.7 — TIDE FM', song: 'Sunset Over Marlin Bay — The Coraltones' },
    { station: 'NEON 104 — NIGHT DRIVE', song: 'Chrome Hearts — Velvet Static' },
    { station: 'HARBOUR 91 — DOCK RADIO', song: 'Crates & Cranes — The Longshoremen' }
  ];

  // Missions: 7 jobs built from 5 primitives (go / steal / deliver / eliminate / escape).
  const MISSIONS = [
    { id: 'm1', num: 'JOB 01', title: 'FIRST TIDE', giver: 'mara',
      objective: 'Meet Mara Voss at Harbour Point', next: 'Drive to the yellow marker',
      stages: 3, dialogue: 'Mara: New in town? Good. The Cove eats the slow. Prove you are not slow.' },
    { id: 'm2', num: 'JOB 02', title: 'BORROWED WHEELS', giver: 'juno',
      objective: 'Steal the Stingray X from Neon Row', next: 'Pull the driver out and take it',
      stages: 4, dialogue: 'Juno: That Stingray belongs to a man who owes me. Take it. Gently. Or not.' },
    { id: 'm3', num: 'JOB 03', title: 'HOT DELIVERY', giver: 'mara',
      objective: 'Deliver the crate to Coral Strand', next: 'Do not stop for anyone',
      stages: 4, dialogue: 'Mara: Crate goes to the Strand. What is inside is not your business. Yet.' },
    { id: 'm4', num: 'JOB 04', title: 'QUIET HARBOUR', giver: 'sable',
      objective: 'Remove the lookout at the docks', next: 'Silent is better. Loud is faster.',
      stages: 3, dialogue: 'Sable: One lookout. One bullet. Then the harbour is open for business.' },
    { id: 'm5', num: 'JOB 05', title: 'FIVE-STAR RUN', giver: 'juno',
      objective: 'Escape a 5-star wanted level', next: 'Lose the helicopter, reach the paint shop',
      stages: 4, dialogue: 'Juno: Every cop in the Cove is behind you. Beautiful. Now lose them.' },
    { id: 'm6', num: 'JOB 06', title: 'GOLDEN HOUR', giver: 'sable',
      objective: 'Collect the payment at Palma Heights', next: 'Watch the rooftops',
      stages: 4, dialogue: 'Sable: The money is waiting on the Heights. So is someone else. Be quick.' },
    { id: 'm7', num: 'JOB 07', title: 'THE LAST TIDE', giver: 'mara',
      objective: 'Take the Cove — final stand at Harbour Point', next: 'Finish it. All of it.',
      stages: 5, dialogue: 'Mara: One last tide, Marlin. Take the harbour and the city is yours.' }
  ];

  const POLICE_UNITS = [
    { id: 'MC-12', role: 'PURSIT', dist: 42 },
    { id: 'MC-07', role: 'RAMMING', dist: 61 },
    { id: 'MC-23', role: 'ROADBLOCK', dist: 88 },
    { id: 'MC-31', role: 'SPOTLIGHT', dist: 120 },
    { id: 'AIR-1', role: 'HELICOPTER', dist: 145 }
  ];

  const COLLECTIBLES = [
    { id: 'shell-1', name: 'Golden Shell', district: 'Coral Strand' },
    { id: 'shell-2', name: 'Golden Shell', district: 'Neon Row' },
    { id: 'shell-3', name: 'Golden Shell', district: 'Harbour Point' },
    { id: 'shell-4', name: 'Golden Shell', district: 'Palma Heights' },
    { id: 'shell-5', name: 'Golden Shell', district: 'Coral Strand' },
    { id: 'shell-6', name: 'Golden Shell', district: 'Neon Row' }
  ];

  window.MC_DATA = {
    mulberry32, WORLD_SEED, rng, CITY, CARS, WEAPONS, CHARACTERS, RADIO,
    MISSIONS, POLICE_UNITS, COLLECTIBLES
  };
})();
