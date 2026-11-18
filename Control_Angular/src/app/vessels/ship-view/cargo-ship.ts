import * as THREE from 'three';

const LENGTH = 12.4;
const HALF = LENGTH / 2;
const BEAM = 1.9;
const STRIPE_LO = 0.32;
const STRIPE_HI = 0.5;
const WATER_Y = 0.1;

const RED_DEEP = new THREE.Color('#6a3028');
const RED = new THREE.Color('#8a3b32');
const CREAM = new THREE.Color('#d5cfc4');
const BLACK = new THREE.Color('#1c2126');

interface Station {
  x: number;
  halfBeam: number;
  keelY: number;
  deckY: number;
}

interface ProfilePoint {
  y: number;
  z: number;
  paint?: 'bottom' | 'boot' | 'top';
}

export interface AmanyQueenDiorama {
  pivot: THREE.Group;
  sea: THREE.Mesh;
  dispose: () => void;
}

export function buildAmanyQueen(): AmanyQueenDiorama {
  const ship = new THREE.Group();
  const hull = buildHull();
  ship.add(hull);

  addDeckAndBulwark(ship);
  addHatches(ship);
  addSuperstructure(ship);
  addCranes(ship);
  addMasts(ship);
  addBowName(ship);
  addPrecision(ship);

  ship.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(ship);
  const center = bounds.getCenter(new THREE.Vector3());
  ship.position.x -= center.x;
  ship.position.z -= center.z;

  const pivot = new THREE.Group();
  pivot.add(ship);

  const sea = new THREE.Mesh(
    new THREE.CircleGeometry(46, 72),
    new THREE.MeshStandardMaterial({
      color: '#3e5964',
      roughness: 0.32,
      metalness: 0.42,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2,
    }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = WATER_Y;
  sea.receiveShadow = true;

  return {
    pivot,
    sea,
    dispose: () => {
      disposeTree(pivot);
      disposeTree(sea);
    },
  };
}

function stationAt(t: number): Station {
  const x = -HALF + t * LENGTH;

  let beamK = 1;
  if (t < 0.12) {
    const u = t / 0.12;
    const s = u * u * (3 - 2 * u);
    beamK = 0.94 + 0.06 * s;
  } else if (t > 0.78) {
    const u = (t - 0.78) / 0.22;
    beamK = Math.max(0.04, 1 - Math.pow(u, 1.15));
  }

  const bowSheer = t > 0.7 ? Math.pow((t - 0.7) / 0.3, 1.2) * 0.38 : 0;
  const sternSheer = t < 0.14 ? Math.pow((0.14 - t) / 0.14, 2) * 0.05 : 0;
  const deckY = 1.06 + bowSheer + sternSheer;

  let keelY = 0;
  if (t > 0.84) {
    const u = (t - 0.84) / 0.16;
    keelY = Math.pow(u, 1.25) * deckY * 0.58;
  }

  return { x, halfBeam: (BEAM / 2) * beamK, keelY, deckY };
}

function halfProfile(station: Station): ProfilePoint[] {
  const hb = station.halfBeam;
  const keel = station.keelY;
  const deck = station.deckY;
  const flat = hb * 0.8;
  const rise = Math.min(Math.max(hb - flat, 0.012), 0.1);
  const points: ProfilePoint[] = [
    { y: keel, z: 0, paint: 'bottom' },
    { y: keel, z: flat * 0.55, paint: 'bottom' },
    { y: keel, z: flat, paint: 'bottom' },
  ];

  for (let i = 1; i <= 3; i += 1) {
    const angle = (i / 3) * Math.PI * 0.5;
    points.push({
      y: keel + (1 - Math.cos(angle)) * rise,
      z: flat + Math.sin(angle) * (hb - flat),
      paint: 'bottom',
    });
  }

  const sideBase = keel + rise;
  const sideTopZ = hb * 0.995;
  points.push(...sideRun(sideBase, hb, deck, sideTopZ).slice(1));
  return points;
}

function sideRun(y0: number, z0: number, y1: number, z1: number): ProfilePoint[] {
  const span = Math.max(y1 - y0, 0.001);
  const lo = Math.min(Math.max(STRIPE_LO, y0), y1);
  const hi = Math.min(Math.max(STRIPE_HI, lo), y1);
  const bands: Array<[number, number, ProfilePoint['paint']]> = [
    [y0, lo, 'bottom'],
    [lo, hi, 'boot'],
    [hi, y1, 'top'],
  ];
  const points: ProfilePoint[] = [];
  for (const [yA, yB, paint] of bands) {
    points.push({ y: yA, z: z0 + (z1 - z0) * ((yA - y0) / span), paint });
    points.push({ y: yB, z: z0 + (z1 - z0) * ((yB - y0) / span), paint });
  }
  return points;
}

function ringOf(station: Station): ProfilePoint[] {
  const half = halfProfile(station);
  const port = half
    .slice()
    .reverse()
    .slice(0, -1)
    .map((point) => ({ y: point.y, z: -point.z }));
  return [...half, ...port];
}

function hullColor(y: number, paint?: ProfilePoint['paint']): THREE.Color {
  if (paint === 'boot') {
    return CREAM;
  }
  if (paint === 'top') {
    return BLACK;
  }
  if (paint === 'bottom' || y < STRIPE_LO) {
    return y < 0.16 ? RED_DEEP : RED;
  }
  return y <= STRIPE_HI ? CREAM : BLACK;
}

function buildHull(): THREE.Mesh {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const stationCount = 42;
  const rings: number[][] = [];

  const addVertex = (x: number, y: number, z: number, paint?: ProfilePoint['paint']): number => {
    const index = positions.length / 3;
    positions.push(x, y, z);
    const color = hullColor(y, paint);
    colors.push(color.r, color.g, color.b);
    return index;
  };

  const addTriangle = (a: number, b: number, c: number, interiorY: number): void => {
    const ax = positions[a * 3];
    const ay = positions[a * 3 + 1];
    const az = positions[a * 3 + 2];
    const bx = positions[b * 3];
    const by = positions[b * 3 + 1];
    const bz = positions[b * 3 + 2];
    const cx = positions[c * 3];
    const cy = positions[c * 3 + 1];
    const cz = positions[c * 3 + 2];
    const abx = bx - ax;
    const aby = by - ay;
    const abz = bz - az;
    const acx = cx - ax;
    const acy = cy - ay;
    const acz = cz - az;
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    if (nx * nx + ny * ny + nz * nz < 1e-10) {
      return;
    }
    const mx = (ax + bx + cx) / 3;
    const my = (ay + by + cy) / 3;
    const mz = (az + bz + cz) / 3;
    const dot = nx * mx + ny * (my - interiorY) + nz * mz;
    if (dot >= 0) {
      indices.push(a, b, c);
    } else {
      indices.push(a, c, b);
    }
  };

  for (let i = 0; i < stationCount; i += 1) {
    const station = stationAt(i / (stationCount - 1));
    const ring = ringOf(station).map((point) => addVertex(station.x, point.y, point.z, point.paint));
    rings.push(ring);
  }

  const ringSize = rings[0].length;
  for (let i = 0; i < stationCount - 1; i += 1) {
    for (let j = 0; j < ringSize; j += 1) {
      const j2 = (j + 1) % ringSize;
      addTriangle(rings[i][j], rings[i][j2], rings[i + 1][j2], 0.45);
      addTriangle(rings[i][j], rings[i + 1][j2], rings[i + 1][j], 0.45);
    }
  }

  const sternCenter = addVertex(stationAt(0).x, 0.42, 0);
  for (let j = 0; j < ringSize; j += 1) {
    addTriangle(rings[0][j], rings[0][(j + 1) % ringSize], sternCenter, 0.45);
  }

  const bow = stationAt(1);
  const stem = addVertex(bow.x + 0.46, bow.keelY * 0.28 + bow.deckY * 0.72, 0);
  const last = rings[stationCount - 1];
  for (let j = 0; j < ringSize; j += 1) {
    addTriangle(last[j], stem, last[(j + 1) % ringSize], 0.45);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.46,
      metalness: 0.22,
    }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addDeckAndBulwark(ship: THREE.Group): void {
  const deckGeo = new THREE.BufferGeometry();
  const railGeo = new THREE.BufferGeometry();
  const deckPos: number[] = [];
  const deckIdx: number[] = [];
  const railPos: number[] = [];
  const railIdx: number[] = [];
  const count = 36;

  const push = (list: number[], x: number, y: number, z: number): number => {
    const index = list.length / 3;
    list.push(x, y, z);
    return index;
  };

  for (let i = 0; i < count; i += 1) {
    const station = stationAt(i / (count - 1));
    const edge = halfProfile(station).at(-1);
    if (!edge) {
      continue;
    }
    push(deckPos, station.x, edge.y + 0.012, edge.z * 0.98);
    push(deckPos, station.x, edge.y + 0.012, -edge.z * 0.98);

    if (station.x > -3.45 && station.halfBeam > 0.34) {
      const lip = 0.045;
      push(railPos, station.x, edge.y + 0.02, edge.z + lip);
      push(railPos, station.x, edge.y + 0.16, edge.z + lip * 1.4);
      push(railPos, station.x, edge.y + 0.02, -(edge.z + lip));
      push(railPos, station.x, edge.y + 0.16, -(edge.z + lip * 1.4));
    }
  }

  const deckStations = deckPos.length / 6;
  for (let i = 0; i < deckStations - 1; i += 1) {
    const a = i * 2;
    deckIdx.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }

  const railStations = railPos.length / 12;
  for (let i = 0; i < railStations - 1; i += 1) {
    const a = i * 4;
    railIdx.push(a, a + 4, a + 5, a, a + 5, a + 1);
    railIdx.push(a + 2, a + 3, a + 7, a + 2, a + 7, a + 6);
  }

  deckGeo.setAttribute('position', new THREE.Float32BufferAttribute(deckPos, 3));
  deckGeo.setIndex(deckIdx);
  deckGeo.computeVertexNormals();
  railGeo.setAttribute('position', new THREE.Float32BufferAttribute(railPos, 3));
  railGeo.setIndex(railIdx);
  railGeo.computeVertexNormals();

  const deck = new THREE.Mesh(
    deckGeo,
    new THREE.MeshStandardMaterial({ color: '#2a3036', roughness: 0.58, metalness: 0.22 }),
  );
  deck.castShadow = true;
  deck.receiveShadow = true;
  ship.add(deck);

  const rail = new THREE.Mesh(
    railGeo,
    new THREE.MeshStandardMaterial({ color: '#12161b', roughness: 0.7, metalness: 0.08, side: THREE.DoubleSide }),
  );
  rail.castShadow = true;
  ship.add(rail);
}

function addHatches(ship: THREE.Group): void {
  const spots = [4.55, 2.55, 0.15, -1.85];
  for (const x of spots) {
    const deck = stationAt((x + HALF) / LENGTH).deckY;
    box(ship, [1.15, 0.08, 0.92], [x, deck + 0.06, 0], '#3c444c', 0.5, 0.28);
    box(ship, [1.02, 0.05, 0.8], [x, deck + 0.12, 0], '#c5cac6', 0.46, 0.18);
    box(ship, [0.02, 0.02, 0.74], [x, deck + 0.15, 0], '#6d7578', 0.5, 0.2);
    box(ship, [0.88, 0.02, 0.02], [x, deck + 0.15, 0], '#6d7578', 0.5, 0.2);
  }

  const deck = stationAt((2.55 + HALF) / LENGTH).deckY;
  const bags: Array<[number, number, number, number]> = [
    [-0.28, 0.16, -0.22, 0.22],
    [-0.05, 0.2, 0.02, 0.26],
    [0.2, 0.14, 0.2, 0.2],
    [0.02, 0.18, -0.24, 0.18],
  ];
  for (const [dx, h, dz, w] of bags) {
    box(ship, [w, h, w * 0.85], [2.55 + dx, deck + 0.16 + h / 2, dz], '#e4e2db', 0.72, 0.04);
  }
}

function addSuperstructure(ship: THREE.Group): void {
  const x = -4.72;
  const deck = stationAt((x + HALF) / LENGTH).deckY;
  const white = '#d7dde2';
  const red = '#8d3530';

  box(ship, [2.05, 0.58, 1.32], [x, deck + 0.3, 0], white, 0.4, 0.22);
  box(ship, [2.1, 0.045, 1.38], [x, deck + 0.6, 0], red, 0.36, 0.28);
  box(ship, [1.55, 0.46, 1.12], [x + 0.08, deck + 0.86, 0], white, 0.4, 0.22);
  box(ship, [1.12, 0.36, 1.22], [x + 0.18, deck + 1.24, 0], white, 0.4, 0.22);
  box(ship, [0.045, 0.16, 0.98], [x + 0.76, deck + 1.32, 0], '#102833', 0.1, 0.62);
  for (let mullion = 0; mullion < 6; mullion += 1) {
    box(ship, [0.055, 0.17, 0.028], [x + 0.78, deck + 1.32, -0.4 + mullion * 0.16], white, 0.4, 0.04);
  }
  box(ship, [0.7, 0.12, 0.04], [x + 0.15, deck + 1.32, 0.64], '#102833', 0.1, 0.62);
  box(ship, [0.7, 0.12, 0.04], [x + 0.15, deck + 1.32, -0.64], '#102833', 0.1, 0.62);
  box(ship, [0.46, 0.08, 0.22], [x + 0.22, deck + 1.18, 0.78], white, 0.48, 0.02);
  box(ship, [0.46, 0.08, 0.22], [x + 0.22, deck + 1.18, -0.78], white, 0.48, 0.02);
  box(ship, [0.28, 0.16, 0.16], [x + 0.42, deck + 0.42, 0.67], '#24343c', 0.5, 0.1);

  box(ship, [0.32, 0.62, 0.32], [x - 0.62, deck + 1.12, 0], white, 0.4, 0.05);
  box(ship, [0.38, 0.12, 0.38], [x - 0.62, deck + 1.46, 0], red, 0.38, 0.14);

  for (const side of [1, -1]) {
    box(ship, [0.62, 0.1, 0.16], [x - 0.05, deck + 0.78, side * 0.78], '#c45a28', 0.42, 0.16);
  }

  cylinder(ship, 0.035, 0.035, 1.25, [x + 0.05, deck + 2.05, 0], '#e8eef0', 0.4, 0.2);
  box(ship, [0.05, 0.04, 0.7], [x + 0.05, deck + 2.35, 0], '#d7dee2', 0.4, 0.25);
  addFlag(ship, x + 0.22, deck + 2.55, 0);
  sphere(ship, 0.08, [x + 0.05, deck + 2.68, 0], '#f7f8f8', 0.3, 0.15);
}

function addCranes(ship: THREE.Group): void {
  addPortal(ship, 3.55);
  addPortal(ship, -2.15);
  addHeavyLift(ship, 0.85);
}

function addPortal(ship: THREE.Group, x: number): void {
  const deck = stationAt((x + HALF) / LENGTH).deckY;
  const height = 2.05;
  const span = 0.78;
  const leg: [number, number, number] = [0.09, height, 0.11];
  box(ship, leg, [x, deck + height / 2, span], '#8d3830', 0.36, 0.34);
  box(ship, leg, [x, deck + height / 2, -span], '#8d3830', 0.36, 0.34);
  box(ship, [0.12, 0.09, span * 2 + 0.16], [x, deck + height, 0], '#7a322b', 0.36, 0.34);
  box(ship, [0.07, 0.06, span * 2], [x, deck + height * 0.58, 0], '#6a2e28', 0.38, 0.3);
  box(ship, [0.28, 0.16, 0.22], [x, deck + height + 0.12, span * 0.35], '#5c2a24', 0.4, 0.32);
  brace(ship, [x, deck + 0.15, span], [x, deck + height - 0.08, -span], 0.022, '#7a322b');
  brace(ship, [x, deck + 0.15, -span], [x, deck + height - 0.08, span], 0.022, '#7a322b');
  brace(ship, [x, deck + height * 0.22, -span], [x, deck + height * 0.22, span], 0.018, '#5c2a24');
  pin(ship, 0.045, 0.08, [x, deck + height + 0.08, 0], '#2a2422');
  brace(ship, [x, deck + height - 0.02, 0], [x + 0.15, deck + 0.35, 0], 0.012, '#3a3430');
}

function addHeavyLift(ship: THREE.Group, x: number): void {
  const deck = stationAt((x + HALF) / LENGTH).deckY;
  const postH = 2.85;
  const gap = 0.2;
  cylinder(ship, 0.1, 0.15, postH, [x - gap, deck + postH / 2, 0], '#241c1c', 0.55, 0.2);
  cylinder(ship, 0.1, 0.15, postH, [x + gap, deck + postH / 2, 0], '#241c1c', 0.55, 0.2);
  box(ship, [gap * 2 + 0.16, 0.08, 0.14], [x, deck + postH, 0], '#8d3830', 0.36, 0.34);
  box(ship, [gap * 2 + 0.08, 0.08, 0.16], [x, deck + postH * 0.62, 0], '#3a2a28', 0.5, 0.18);
  box(ship, [gap * 2 + 0.08, 0.08, 0.16], [x, deck + postH * 0.38, 0], '#3a2a28', 0.5, 0.18);
  brace(ship, [x - gap, deck + 0.2, 0], [x + gap, deck + postH * 0.55, 0], 0.04, '#3a2c2a');
  brace(ship, [x + gap, deck + 0.2, 0], [x - gap, deck + postH * 0.55, 0], 0.04, '#3a2c2a');

  const pivotY = deck + postH * 0.7;
  const endY = deck + 0.72;
  brace(ship, [x, pivotY, 0], [x + 2.65, endY, 0], 0.045, '#8d3830');
  brace(ship, [x, pivotY, 0], [x - 2.35, endY, 0], 0.045, '#8d3830');
  brace(ship, [x, pivotY + 0.35, 0], [x + 2.65, endY + 0.15, 0], 0.018, '#4a403c');
  brace(ship, [x, pivotY + 0.35, 0], [x - 2.35, endY + 0.15, 0], 0.018, '#4a403c');
  brace(ship, [x - gap, deck + postH * 0.78, 0], [x + gap, deck + postH * 0.42, 0], 0.028, '#3a2c2a');
  pin(ship, 0.05, 0.08, [x + 2.55, endY, 0], '#2c2826');
  pin(ship, 0.05, 0.08, [x - 2.25, endY, 0], '#2c2826');
  brace(ship, [x + 2.55, endY, 0], [x + 2.55, deck + 0.2, 0], 0.01, '#4a403c');
  brace(ship, [x - 2.25, endY, 0], [x - 2.25, deck + 0.2, 0], 0.01, '#4a403c');
}

function addMasts(ship: THREE.Group): void {
  const x = 5.15;
  const deck = stationAt((x + HALF) / LENGTH).deckY;
  cylinder(ship, 0.03, 0.045, 1.05, [x, deck + 0.62, 0], '#d5dde1', 0.4, 0.2);
  box(ship, [0.04, 0.03, 0.46], [x, deck + 0.95, 0], '#c5ced3', 0.4, 0.2);
  box(ship, [0.03, 0.02, 0.28], [x, deck + 1.12, 0], '#c5ced3', 0.4, 0.2);
  pin(ship, 0.012, 0.42, [x + 0.08, deck + 1.2, 0], '#e8eef0');
  const dish = pin(ship, 0.07, 0.02, [x, deck + 1.18, 0.12], '#f4f7f8');
  dish.rotation.x = Math.PI / 2.4;
  for (const side of [1, -1]) {
    const station = stationAt(0.9);
    box(
      ship,
      [0.22, 0.12, 0.08],
      [station.x - 0.15, station.deckY * 0.62, side * (station.halfBeam + 0.02)],
      '#1a1e22',
      0.6,
      0.3,
    );
  }
}

function addBowName(ship: THREE.Group): void {
  const texture = nameTexture();
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.55,
    metalness: 0.02,
    transparent: true,
    alphaTest: 0.35,
    side: THREE.DoubleSide,
  });
  const station = stationAt(0.84);
  const y = STRIPE_HI + (station.deckY - STRIPE_HI) * 0.48;

  const starboard = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.24), material);
  starboard.position.set(station.x - 0.15, y, station.halfBeam + 0.03);
  ship.add(starboard);

  const port = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.24), material);
  port.position.set(station.x - 0.15, y, -(station.halfBeam + 0.03));
  port.rotation.y = Math.PI;
  ship.add(port);
}

function addPrecision(ship: THREE.Group): void {
  for (let i = 0; i < 11; i += 1) {
    const station = stationAt(0.16 + i * 0.055);
    const y = STRIPE_HI + 0.2;
    for (const side of [1, -1]) {
      const glass = pin(ship, 0.042, 0.016, [station.x, y, side * (station.halfBeam + 0.01)], '#0c1418');
      glass.rotation.x = Math.PI / 2;
      pin(ship, 0.058, 0.01, [station.x, y, side * (station.halfBeam + 0.016)], '#aeb6bb').rotation.x = Math.PI / 2;
    }
  }

  let previous: { x: number; y: number; z: number } | null = null;
  for (let i = 0; i < 18; i += 1) {
    const station = stationAt(0.06 + i * 0.042);
    if (station.x < -3.35) {
      continue;
    }
    const edge = halfProfile(station).at(-1);
    if (!edge) {
      continue;
    }
    for (const side of [1, -1]) {
      const z = side * (edge.z + 0.05);
      pin(ship, 0.018, 0.18, [station.x, edge.y + 0.11, z], '#f4f7f8');
      if (previous && side === 1) {
        brace(ship, [previous.x, previous.y, previous.z], [station.x, edge.y + 0.2, z], 0.014, '#f7fbfc');
        brace(ship, [previous.x, previous.y, -previous.z], [station.x, edge.y + 0.2, -z], 0.014, '#f7fbfc');
      }
    }
    previous = { x: station.x, y: edge.y + 0.2, z: edge.z + 0.05 };
  }

  for (const x of [-2.6, -0.4, 1.8, 4.1]) {
    const deck = stationAt((x + HALF) / LENGTH).deckY;
    for (const side of [1, -1]) {
      pin(ship, 0.035, 0.1, [x, deck + 0.08, side * 0.72], '#2a3136');
      pin(ship, 0.055, 0.03, [x, deck + 0.14, side * 0.72], '#3a4248');
    }
  }

  const bow = stationAt(0.93);
  for (const side of [1, -1]) {
    pin(ship, 0.03, 0.22, [bow.x - 0.05, bow.deckY * 0.58, side * (bow.halfBeam * 0.72)], '#1c2126', [0.5, 0, side * 0.4]);
  }

  const house = stationAt(((-4.72 + HALF) / LENGTH));
  pin(ship, 0.035, 0.035, [-4.5, house.deckY + 1.22, 0.9], '#d23b2c');
  pin(ship, 0.035, 0.035, [-4.5, house.deckY + 1.22, -0.9], '#1f8a45');
  pin(ship, 0.03, 0.03, [-4.95, house.deckY + 1.55, 0], '#f4f7f8');
}

function addFlag(ship: THREE.Group, x: number, y: number, z: number): void {
  const material = new THREE.MeshStandardMaterial({
    map: flagTexture(),
    roughness: 0.8,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.32), material);
  flag.position.set(x + 0.26, y, z);
  ship.add(flag);
}

function box(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  color: string,
  roughness: number,
  metalness: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    new THREE.MeshStandardMaterial({ color, roughness, metalness }),
  );
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(
  parent: THREE.Object3D,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  position: [number, number, number],
  color: string,
  roughness: number,
  metalness: number,
): void {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 12),
    new THREE.MeshStandardMaterial({ color, roughness, metalness }),
  );
  mesh.position.set(...position);
  mesh.castShadow = true;
  parent.add(mesh);
}

function sphere(
  parent: THREE.Object3D,
  radius: number,
  position: [number, number, number],
  color: string,
  roughness: number,
  metalness: number,
): void {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 16, 12),
    new THREE.MeshStandardMaterial({ color, roughness, metalness }),
  );
  mesh.position.set(...position);
  mesh.castShadow = true;
  parent.add(mesh);
}

function pin(
  parent: THREE.Object3D,
  radius: number,
  height: number,
  position: [number, number, number],
  color: string,
  rotation?: [number, number, number],
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 8),
    new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.28 }),
  );
  mesh.position.set(...position);
  if (rotation) {
    mesh.rotation.x = rotation[0];
    mesh.rotation.y = rotation[1];
    mesh.rotation.z = rotation[2];
  }
  parent.add(mesh);
  return mesh;
}

function brace(
  parent: THREE.Object3D,
  from: [number, number, number],
  to: [number, number, number],
  radius: number,
  color: string,
): void {
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  if (length < 0.05) {
    return;
  }
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 8),
    new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.2 }),
  );
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = true;
  parent.add(mesh);
}

function nameTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 180;
  const context = canvas.getContext('2d');
  if (!context) {
    return new THREE.CanvasTexture(canvas);
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#f4f1ea';
  context.font = '700 92px Cairo, Segoe UI, Tahoma, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('AMANY QUEEN', canvas.width / 2, canvas.height / 2 + 4);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function flagTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (!context) {
    return texture;
  }
  context.fillStyle = '#0d7a3c';
  context.fillRect(0, 0, 256, 160);
  context.fillStyle = '#f7f7f4';
  context.beginPath();
  context.arc(124, 80, 36, 0, Math.PI * 2);
  context.fill();
  context.globalCompositeOperation = 'destination-out';
  context.beginPath();
  context.arc(140, 80, 28, 0, Math.PI * 2);
  context.fill();
  context.globalCompositeOperation = 'source-over';
  context.fillStyle = '#f7f7f4';
  drawStar(context, 162, 74, 5, 11, 4.5);
  texture.needsUpdate = true;
  return texture;
}

function drawStar(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  points: number,
  outer: number,
  inner: number,
): void {
  context.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) {
      context.moveTo(px, py);
    } else {
      context.lineTo(px, py);
    }
  }
  context.closePath();
  context.fill();
}

function disposeTree(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) {
      geometries.add(mesh.geometry);
    }
    const list = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const material of list) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (isTexture(value)) {
          textures.add(value);
        }
      }
    }
  });
  for (const geometry of geometries) {
    geometry.dispose();
  }
  for (const material of materials) {
    material.dispose();
  }
  for (const texture of textures) {
    texture.dispose();
  }
}

function isTexture(value: unknown): value is THREE.Texture {
  return !!value && typeof value === 'object' && 'isTexture' in value && (value as { isTexture?: boolean }).isTexture === true;
}
