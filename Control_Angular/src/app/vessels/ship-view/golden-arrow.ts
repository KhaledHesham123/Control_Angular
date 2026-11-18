import * as THREE from 'three';

const LENGTH = 12.6;
const HALF = LENGTH / 2;
const BEAM = 2.05;
const STRIPE_LO = 0.44;
const STRIPE_HI = 0.62;
const WATER_Y = 0.14;

const ORANGE_DEEP = new THREE.Color('#8a3a22');
const ORANGE = new THREE.Color('#b84a2c');
const BOOT = new THREE.Color('#d4cec4');
const BLACK = new THREE.Color('#1a1e23');

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

export interface ShipDiorama {
  pivot: THREE.Group;
  sea: THREE.Mesh;
  dispose: () => void;
}

export function buildGoldenArrow(): ShipDiorama {
  const ship = new THREE.Group();
  ship.add(buildHull());
  addBulb(ship);
  addDeckAndBulwark(ship);
  addHatches(ship);
  addCranes(ship);
  addSuperstructure(ship);
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
  if (t < 0.1) {
    const u = t / 0.1;
    const s = u * u * (3 - 2 * u);
    beamK = 0.96 + 0.04 * s;
  } else if (t > 0.82) {
    const u = (t - 0.82) / 0.18;
    beamK = Math.max(0.16, Math.cos(Math.min(u, 1) * Math.PI * 0.5));
  }

  const bowSheer = t > 0.78 ? Math.pow((t - 0.78) / 0.22, 1.15) * 0.22 : 0;
  const deckY = 0.98 + bowSheer;
  let keelY = 0;
  if (t > 0.9) {
    keelY = Math.pow((t - 0.9) / 0.1, 1.4) * 0.28;
  }
  return { x, halfBeam: (BEAM / 2) * beamK, keelY, deckY };
}

function hullColor(y: number, paint?: ProfilePoint['paint']): THREE.Color {
  if (paint === 'boot') {
    return BOOT;
  }
  if (paint === 'top') {
    return BLACK;
  }
  if (paint === 'bottom' || y < STRIPE_LO) {
    return y < 0.22 ? ORANGE_DEEP : ORANGE;
  }
  return y <= STRIPE_HI ? BOOT : BLACK;
}

function halfProfile(station: Station): ProfilePoint[] {
  const hb = station.halfBeam;
  const keel = station.keelY;
  const deck = station.deckY;
  const flat = hb * 0.82;
  const rise = Math.min(Math.max(hb - flat, 0.012), 0.09);
  const points: ProfilePoint[] = [
    { y: keel, z: 0, paint: 'bottom' },
    { y: keel, z: flat * 0.5, paint: 'bottom' },
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
  const deckZ = hb * 0.992;
  const span = Math.max(deck - sideBase, 0.001);
  const lo = Math.min(Math.max(STRIPE_LO, sideBase), deck);
  const hi = Math.min(Math.max(STRIPE_HI, lo), deck);
  const bands: Array<[number, number, ProfilePoint['paint']]> = [
    [sideBase, lo, 'bottom'],
    [lo, hi, 'boot'],
    [hi, deck, 'top'],
  ];
  bands.forEach(([yA, yB, paint], index) => {
    const zOf = (y: number): number => hb + (deckZ - hb) * ((y - sideBase) / span);
    if (index > 0) {
      points.push({ y: yA, z: zOf(yA), paint });
    }
    points.push({ y: yB, z: zOf(yB), paint });
  });
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

function buildHull(): THREE.Mesh {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const stationCount = 40;
  const rings: number[][] = [];

  const addVertex = (x: number, y: number, z: number, paint?: ProfilePoint['paint']): number => {
    const index = positions.length / 3;
    positions.push(x, y, z);
    const color = hullColor(y, paint);
    colors.push(color.r, color.g, color.b);
    return index;
  };

  const addTriangle = (a: number, b: number, c: number): void => {
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
    const dot = nx * mx + ny * (my - 0.42) + nz * mz;
    indices.push(...(dot >= 0 ? [a, b, c] : [a, c, b]));
  };

  for (let i = 0; i < stationCount; i += 1) {
    const station = stationAt(i / (stationCount - 1));
    rings.push(ringOf(station).map((point) => addVertex(station.x, point.y, point.z, point.paint)));
  }

  const ringSize = rings[0].length;
  for (let i = 0; i < stationCount - 1; i += 1) {
    for (let j = 0; j < ringSize; j += 1) {
      const j2 = (j + 1) % ringSize;
      addTriangle(rings[i][j], rings[i][j2], rings[i + 1][j2]);
      addTriangle(rings[i][j], rings[i + 1][j2], rings[i + 1][j]);
    }
  }

  const stern = stationAt(0);
  const sternCenter = addVertex(stern.x, 0.4, 0);
  for (let j = 0; j < ringSize; j += 1) {
    addTriangle(rings[0][j], rings[0][(j + 1) % ringSize], sternCenter);
  }

  const bow = stationAt(1);
  const stem = addVertex(bow.x + 0.22, bow.deckY * 0.62, 0);
  const last = rings[stationCount - 1];
  for (let j = 0; j < ringSize; j += 1) {
    addTriangle(last[j], stem, last[(j + 1) % ringSize]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.44, metalness: 0.24 }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addBulb(ship: THREE.Group): void {
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 18, 14),
    new THREE.MeshStandardMaterial({ color: '#b84a2c', roughness: 0.42, metalness: 0.22 }),
  );
  bulb.scale.set(1.85, 0.82, 1.2);
  bulb.position.set(HALF + 0.08, 0.3, 0);
  bulb.castShadow = true;
  ship.add(bulb);
}

function addDeckAndBulwark(ship: THREE.Group): void {
  const deckPos: number[] = [];
  const deckIdx: number[] = [];
  const railPos: number[] = [];
  const railIdx: number[] = [];
  const count = 32;
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
    if (station.x > -3.7 && station.halfBeam > 0.4) {
      push(railPos, station.x, edge.y + 0.02, edge.z + 0.04);
      push(railPos, station.x, edge.y + 0.14, edge.z + 0.05);
      push(railPos, station.x, edge.y + 0.02, -(edge.z + 0.04));
      push(railPos, station.x, edge.y + 0.14, -(edge.z + 0.05));
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

  const deckGeo = new THREE.BufferGeometry();
  deckGeo.setAttribute('position', new THREE.Float32BufferAttribute(deckPos, 3));
  deckGeo.setIndex(deckIdx);
  deckGeo.computeVertexNormals();
  const railGeo = new THREE.BufferGeometry();
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
  for (const x of [3.4, 1.35, -0.7]) {
    const deck = stationAt((x + HALF) / LENGTH).deckY;
    box(ship, [1.35, 0.06, 1.15], [x, deck + 0.05, 0], '#3c444c', 0.5, 0.28);
    box(ship, [1.2, 0.04, 1.02], [x, deck + 0.09, 0], '#c5cac6', 0.46, 0.18);
    box(ship, [0.018, 0.016, 0.96], [x, deck + 0.12, 0], '#6d7578', 0.5, 0.2);
    box(ship, [1.05, 0.016, 0.018], [x, deck + 0.12, 0], '#6d7578', 0.5, 0.2);
  }
}

function addCranes(ship: THREE.Group): void {
  addCrane(ship, 4.55, 1.05);
  addCrane(ship, 2.45, -0.95);
  addCrane(ship, 0.35, 1.05);
  addCrane(ship, -1.7, -0.9);
}

function addCrane(ship: THREE.Group, x: number, reach: number): void {
  const deck = stationAt((x + HALF) / LENGTH).deckY;
  const foot = deck + 0.05;
  cylinder(ship, 0.07, 0.1, 0.7, [x, foot + 0.35, 0], '#a6843c', 0.38, 0.36);
  box(ship, [0.22, 0.12, 0.18], [x, foot + 0.76, 0], '#8d7034', 0.36, 0.34);
  box(ship, [0.06, 0.045, 0.08], [x + 0.06, foot + 0.78, 0], '#1a242c', 0.2, 0.5);
  box(ship, [0.1, 0.06, 0.1], [x, foot + 0.86, 0], '#c5ccd0', 0.4, 0.2);
  const tipX = x + reach;
  const tipY = foot + 1.55;
  const baseY = foot + 0.84;
  const length = Math.hypot(tipX - x, tipY - baseY);
  const jib = box(
    ship,
    [length, 0.045, 0.07],
    [(x + tipX) / 2, (baseY + tipY) / 2, 0],
    '#c4a25a',
    0.36,
    0.34,
  );
  jib.rotation.z = Math.atan2(tipY - baseY, tipX - x);
  brace(ship, [x, foot + 0.92, 0], [tipX, tipY + 0.02, 0], 0.01, '#d8c48a');
  brace(ship, [x, foot + 0.86, 0], [x - Math.sign(reach) * 0.26, foot + 1.08, 0], 0.016, '#8d7034');
  pin(ship, 0.028, 0.05, [tipX, tipY - 0.02, 0], '#2c2824');
  brace(ship, [tipX, tipY - 0.02, 0], [tipX, foot + 0.16, 0], 0.008, '#3a342c');
}

function addSuperstructure(ship: THREE.Group): void {
  const x = -4.85;
  const deck = stationAt((x + HALF) / LENGTH).deckY;
  const white = '#d7dde2';
  box(ship, [1.9, 0.48, 1.4], [x, deck + 0.26, 0], white, 0.4, 0.22);
  box(ship, [1.45, 0.36, 1.18], [x + 0.08, deck + 0.66, 0], white, 0.4, 0.22);
  box(ship, [1.05, 0.3, 1.22], [x + 0.16, deck + 0.96, 0], white, 0.4, 0.22);
  box(ship, [0.04, 0.14, 0.9], [x + 0.68, deck + 1.05, 0], '#102833', 0.1, 0.62);
  for (let mullion = 0; mullion < 5; mullion += 1) {
    box(ship, [0.05, 0.15, 0.026], [x + 0.7, deck + 1.05, -0.32 + mullion * 0.16], white, 0.4, 0.04);
  }
  box(ship, [0.62, 0.1, 0.035], [x + 0.2, deck + 1.05, 0.66], '#102833', 0.1, 0.62);
  box(ship, [0.62, 0.1, 0.035], [x + 0.2, deck + 1.05, -0.66], '#102833', 0.1, 0.62);

  const funnelX = x - 0.15;
  box(ship, [0.34, 0.92, 0.34], [funnelX, deck + 1.12, 0], '#1a1c20', 0.38, 0.4);
  box(ship, [0.38, 0.07, 0.38], [funnelX, deck + 1.22, 0], '#8d3530', 0.34, 0.3);
  box(ship, [0.36, 0.06, 0.36], [funnelX, deck + 1.5, 0], '#d7dde2', 0.4, 0.18);
  cylinder(ship, 0.03, 0.04, 0.7, [x + 0.15, deck + 1.55, 0], '#e8eef0', 0.4, 0.2);
  sphere(ship, 0.07, [x + 0.15, deck + 1.92, 0], '#f7f8f8', 0.3, 0.15);

  for (const side of [1, -1]) {
    box(ship, [0.52, 0.08, 0.14], [x - 0.15, deck + 0.58, side * 0.82], '#c45a28', 0.42, 0.16);
  }
}

function addBowName(ship: THREE.Group): void {
  const material = new THREE.MeshStandardMaterial({
    map: nameTexture(),
    roughness: 0.55,
    metalness: 0.02,
    transparent: true,
    alphaTest: 0.35,
    side: THREE.DoubleSide,
  });
  const station = stationAt(0.86);
  const y = STRIPE_HI + (station.deckY - STRIPE_HI) * 0.42;
  const starboard = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.22), material);
  starboard.position.set(station.x - 0.2, y, station.halfBeam + 0.03);
  ship.add(starboard);
  const port = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.22), material);
  port.position.set(station.x - 0.2, y, -(station.halfBeam + 0.03));
  port.rotation.y = Math.PI;
  ship.add(port);
}

function addPrecision(ship: THREE.Group): void {
  for (let i = 0; i < 12; i += 1) {
    const station = stationAt(0.12 + i * 0.055);
    const y = STRIPE_HI + 0.16;
    for (const side of [1, -1]) {
      const glass = pin(ship, 0.04, 0.016, [station.x, y, side * (station.halfBeam + 0.01)], '#0c1418');
      glass.rotation.x = Math.PI / 2;
      pin(ship, 0.056, 0.01, [station.x, y, side * (station.halfBeam + 0.016)], '#aeb6bb').rotation.x = Math.PI / 2;
    }
  }

  let previous: { x: number; y: number; z: number } | null = null;
  for (let i = 0; i < 20; i += 1) {
    const station = stationAt(0.05 + i * 0.04);
    if (station.x < -3.6) {
      continue;
    }
    const edge = halfProfile(station).at(-1);
    if (!edge) {
      continue;
    }
    for (const side of [1, -1]) {
      const z = side * (edge.z + 0.045);
      pin(ship, 0.018, 0.16, [station.x, edge.y + 0.1, z], '#f4f7f8');
      if (previous && side === 1) {
        brace(ship, [previous.x, previous.y, previous.z], [station.x, edge.y + 0.18, z], 0.014, '#f7fbfc');
        brace(ship, [previous.x, previous.y, -previous.z], [station.x, edge.y + 0.18, -z], 0.014, '#f7fbfc');
      }
    }
    previous = { x: station.x, y: edge.y + 0.18, z: edge.z + 0.045 };
  }

  for (const spot of [3.4, 1.35, -0.7]) {
    const deck = stationAt((spot + HALF) / LENGTH).deckY;
    for (const sx of [-0.55, 0.55]) {
      for (const sz of [-0.48, 0.48]) {
        pin(ship, 0.02, 0.04, [spot + sx, deck + 0.16, sz], '#6d675e');
      }
    }
  }

  const bow = stationAt(0.94);
  for (const side of [1, -1]) {
    pin(ship, 0.028, 0.2, [bow.x, bow.deckY * 0.55, side * bow.halfBeam * 0.55], '#1c2126', [0.6, 0, side * 0.35]);
  }

  pin(ship, 0.02, 0.55, [-4.7, stationAt(((-4.85 + HALF) / LENGTH)).deckY + 1.7, 0.22], '#d7dee2');
  pin(ship, 0.018, 0.28, [-5.05, stationAt(((-4.85 + HALF) / LENGTH)).deckY + 1.72, -0.16], '#1a1c20');
}

function nameTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 180;
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (!context) {
    return texture;
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#f6f3ec';
  context.font = '700 78px Cairo, Segoe UI, Tahoma, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('GOLDEN ARROW', canvas.width / 2, canvas.height / 2 + 4);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
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
