import * as THREE from 'three';

/* هيكل M/V Amany Queen من الرسم العام: J.J. Sietas Typ 119، يارد 860، بتاريخ 1983.
   السفينة على الرسم باسم MS Ocean، وهو اسمها السابق. الطول 96.97 م، العرض 17.60 م،
   العمق حتى السطح الأول 8.50 م، الغاطس 5.58 / 6.89 م، عنبران، أربعة أوناش سارية. */

const DESIGN_LOA = 96.97;

export interface HullSpec {
  name: string;
  loa: number;
  beam: number;
  depth: number;
  draft: number;
  accurate: boolean;
}

export const AMANY_HULL: HullSpec = {
  name: 'AMANY QUEEN',
  loa: 96.97,
  beam: 17.6,
  depth: 8.5,
  draft: 6.89,
  accurate: true,
};

export function isAmanyQueen(name: string, imo: string): boolean {
  return imo.replace(/\s/g, '') === '8318128' || name.toUpperCase().includes('AMANY');
}

export function resolveHull(input: {
  name: string;
  imo: string;
  loa: number | null;
  beam: number | null;
  draft: number | null;
}): HullSpec {
  if (isAmanyQueen(input.name, input.imo)) {
    return { ...AMANY_HULL, name: 'AMANY QUEEN' };
  }
  const loa = input.loa && input.loa > 20 ? input.loa : 100;
  const beam = input.beam && input.beam > 5 ? input.beam : loa * 0.18;
  const draft = input.draft && input.draft > 1 ? input.draft : loa * 0.065;
  return {
    name: (input.name || 'VESSEL').replace(/^M\/V\s+/i, '').toUpperCase(),
    loa,
    beam,
    depth: Math.max(draft + 1.6, draft / 0.78),
    draft,
    accurate: false,
  };
}

interface Paint {
  hull: THREE.MeshStandardMaterial;
  deck: THREE.MeshStandardMaterial;
  white: THREE.MeshStandardMaterial;
  funnel: THREE.MeshStandardMaterial;
  navy: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
  derrick: THREE.MeshStandardMaterial;
  hatch: THREE.MeshStandardMaterial;
  coaming: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  red: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  line: THREE.LineBasicMaterial;
}

export function createShipModel(spec: HullSpec): THREE.Group {
  const root = new THREE.Group();
  root.name = 'ship';
  root.userData = { spec };
  const paint = makePaint();
  root.userData['paint'] = paint;

  root.add(buildHull(spec, paint));
  addBulb(root, spec, paint);
  addPropulsion(root, spec, paint);
  addBulwark(root, spec, paint);
  addHatches(root, spec, paint);
  addCastle(root, spec, paint);
  addDerricks(root, spec, paint);
  addForecastle(root, spec, paint);
  addDeckGear(root, spec, paint);
  addNames(root, spec, paint);
  addLabels(root, spec);
  applyWaterline(root, spec.draft);
  addWaterEffects(root, spec);

  return root;
}

export function applyWaterline(root: THREE.Object3D, draft: number): void {
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(draft - 0.22));
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    const material = mesh.material;
    const list = Array.isArray(material) ? material : material ? [material] : [];
    list.forEach((item) => {
      item.clippingPlanes = [plane];
      item.clipShadows = true;
    });
  });
}

export function disposeShip(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((item) => materials.add(item));
    else if (material) materials.add(material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => {
    const mapped = material as THREE.MeshStandardMaterial;
    mapped.map?.dispose();
    material.dispose();
  });
}

function makePaint(): Paint {
  const standard = (color: number, roughness: number, metalness: number): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  return {
    hull: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.58, metalness: 0.08 }),
    deck: standard(0x5d6458, 0.82, 0.04),
    white: standard(0xf3f0e8, 0.48, 0.02),
    funnel: standard(0x151c24, 0.46, 0.18),
    navy: standard(0x1d3556, 0.5, 0.12),
    gold: standard(0xd4a857, 0.42, 0.28),
    derrick: standard(0xd2b27a, 0.55, 0.12),
    hatch: standard(0x8a3a32, 0.62, 0.08),
    coaming: standard(0x2b3238, 0.6, 0.16),
    glass: new THREE.MeshStandardMaterial({
      color: 0x163044,
      roughness: 0.12,
      metalness: 0.45,
      emissive: 0x10283a,
      emissiveIntensity: 0.55,
    }),
    dark: standard(0x1a2128, 0.5, 0.2),
    red: standard(0x8e2d24, 0.55, 0.06),
    brass: standard(0xb08d57, 0.38, 0.62),
    rubber: standard(0x20262c, 0.7, 0.1),
    line: new THREE.LineBasicMaterial({ color: 0x2c343c }),
  };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function keelRise(t: number, spec: HullSpec): number {
  const stern = smoothstep(0.18, 0.015, t);
  const bow = smoothstep(0.9, 1, t);
  return spec.draft * (0.5 * stern * stern + 0.18 * bow);
}

function deckHeight(t: number, spec: HullSpec): number {
  let y = spec.depth;
  y += 0.45 * (spec.depth / 8.5) * smoothstep(0.07, 0, t);
  y += 2.65 * (spec.depth / 8.5) * smoothstep(0.868, 0.892, t);
  y += 0.28 * (spec.depth / 8.5) * smoothstep(0.9, 1, t);
  return y;
}

function halfBreadth(t: number, spec: HullSpec): number {
  const half = spec.beam / 2;
  if (t < 0.085) return half * (0.36 + 0.64 * smoothstep(0, 0.085, t));
  if (t > 0.8) {
    const k = Math.min(1, (t - 0.8) / 0.2);
    return Math.max(0.05, half * Math.pow(Math.cos((k * Math.PI) / 2), 0.62));
  }
  return half * 0.998;
}

function sectionPoints(t: number, spec: HullSpec, steps: number): { y: number; z: number }[] {
  const half = halfBreadth(t, spec);
  const keel = keelRise(t, spec);
  const deck = deckHeight(t, spec);
  const bow = smoothstep(0.84, 1, t);
  const stern = smoothstep(0.12, 0, t);
  let flat = half * 0.6 * (1 - bow) * (1 - 0.45 * stern);
  let bilge = Math.min(half * 0.32, spec.depth * 0.24) * (1 - 0.72 * bow);
  if (flat + bilge > half * 0.97) {
    const scale = (half * 0.97) / Math.max(0.01, flat + bilge);
    flat *= scale;
    bilge *= scale;
  }
  const rise = spec.draft * (0.025 + 0.2 * bow);
  const sideY = keel + rise + bilge;
  const points: { y: number; z: number }[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const s = i / steps;
    let y: number;
    let z: number;
    if (s <= 0.3) {
      const u = s / 0.3;
      y = keel + rise * u;
      z = flat * u;
    } else if (s <= 0.52) {
      const u = (s - 0.3) / 0.22;
      const angle = (u * Math.PI) / 2;
      y = keel + rise + bilge * (1 - Math.cos(angle));
      z = flat + bilge * Math.sin(angle);
    } else {
      const u = (s - 0.52) / 0.48;
      const z0 = Math.min(half, flat + bilge);
      y = sideY + (deck - sideY) * u;
      z = z0 + (half - z0) * Math.pow(u, 0.92);
    }
    points.push({ y, z: Math.max(0, Math.min(half, z)) });
  }
  points[points.length - 1] = { y: deck, z: half };
  return points;
}

function stationX(t: number, y: number, spec: HullSpec): number {
  let x = (t - 0.5) * spec.loa;
  const keel = keelRise(t, spec);
  const deck = deckHeight(t, spec);
  const height = (y - keel) / Math.max(0.2, deck - keel);
  if (t > 0.84) {
    const bow = (t - 0.84) / 0.16;
    x -= spec.loa * 0.036 * bow * Math.pow(Math.min(1, Math.max(0, height)), 1.1);
  }
  if (t < 0.1) {
    const stern = 1 - t / 0.1;
    x -= spec.loa * 0.014 * stern * Math.min(1, Math.max(0, height));
  }
  return x;
}

function hullColor(y: number, spec: HullSpec, out: number[]): void {
  const water = spec.draft;
  let hex = 0x1b242c;
  if (y < water - 0.35) hex = 0x8e2d24;
  else if (y < water + 0.38) hex = 0xe7e1d4;
  const color = new THREE.Color(hex);
  out.push(color.r, color.g, color.b);
}

function buildHull(spec: HullSpec, paint: Paint): THREE.Mesh {
  const along = 72;
  const upward = 16;
  const rings: THREE.Vector3[][] = [];
  for (let i = 0; i <= along; i += 1) {
    const t = i / along;
    const half = sectionPoints(t, spec, upward);
    const ring: THREE.Vector3[] = [];
    for (let p = half.length - 1; p >= 1; p -= 1) {
      ring.push(new THREE.Vector3(stationX(t, half[p].y, spec), half[p].y, -half[p].z));
    }
    for (const point of half) {
      ring.push(new THREE.Vector3(stationX(t, point.y, spec), point.y, point.z));
    }
    rings.push(ring);
  }

  const per = rings[0].length;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  rings.forEach((ring) => {
    ring.forEach((point) => {
      positions.push(point.x, point.y, point.z);
      hullColor(point.y, spec, colors);
    });
  });
  for (let i = 0; i < along; i += 1) {
    for (let j = 0; j < per - 1; j += 1) {
      const a = i * per + j;
      const b = a + 1;
      const c = a + per + 1;
      const d = a + per;
      indices.push(a, d, c, a, c, b);
    }
  }

  const hull = new THREE.BufferGeometry();
  hull.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  hull.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  hull.setIndex(indices);
  if (!sideFacesOut(hull)) reverseWinding(hull);
  hull.computeVertexNormals();

  const deck = buildDeck(rings, spec);
  const stern = buildCap(rings[0], spec, -1);
  const bow = buildCap(rings[rings.length - 1], spec, 1);
  const mesh = new THREE.Mesh(hull, paint.hull);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const deckMesh = new THREE.Mesh(deck, paint.deck);
  deckMesh.receiveShadow = true;
  const sternMesh = new THREE.Mesh(stern, paint.hull);
  const bowMesh = new THREE.Mesh(bow, paint.hull);
  sternMesh.castShadow = true;
  bowMesh.castShadow = true;
  mesh.add(deckMesh, sternMesh, bowMesh);
  return mesh;
}

function sideFacesOut(geometry: THREE.BufferGeometry): boolean {
  geometry.computeVertexNormals();
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  let best = 0;
  let bestZ = -1;
  for (let i = 0; i < position.count; i += 1) {
    if (Math.abs(position.getX(i)) > 12) continue;
    const z = Math.abs(position.getZ(i));
    if (z > bestZ) {
      bestZ = z;
      best = i;
    }
  }
  const sign = Math.sign(position.getZ(best)) || 1;
  return normal.getZ(best) * sign > 0;
}

function facesMatch(geometry: THREE.BufferGeometry, axis: 'x' | 'y', want: number): boolean {
  geometry.computeVertexNormals();
  const normal = geometry.getAttribute('normal');
  let sum = 0;
  for (let i = 0; i < normal.count; i += 1) sum += axis === 'x' ? normal.getX(i) : normal.getY(i);
  return sum * want > 0;
}

function reverseWinding(geometry: THREE.BufferGeometry): void {
  const index = geometry.getIndex();
  if (!index) return;
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    index.setX(i, index.getX(i + 2));
    index.setX(i + 2, a);
  }
  index.needsUpdate = true;
}

function buildDeck(rings: THREE.Vector3[][], spec: HullSpec): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const camber = 0.16 * (spec.beam / 17.6);
  for (let i = 0; i < rings.length; i += 1) {
    const ring = rings[i];
    const port = ring[0];
    const starboard = ring[ring.length - 1];
    positions.push(port.x, port.y, port.z, starboard.x, starboard.y, starboard.z);
    const x = (port.x + starboard.x) / 2;
    const y = (port.y + starboard.y) / 2 + camber;
    positions.push(x, y, 0);
  }
  const stride = 3;
  for (let i = 0; i < rings.length - 1; i += 1) {
    const p0 = i * stride;
    const s0 = p0 + 1;
    const c0 = p0 + 2;
    const p1 = p0 + stride;
    const s1 = s0 + stride;
    const c1 = c0 + stride;
    indices.push(p0, c0, p1, p1, c0, c1, s0, s1, c0, c0, s1, c1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  if (!facesMatch(geometry, 'y', 1)) reverseWinding(geometry);
  geometry.computeVertexNormals();
  return geometry;
}

function buildCap(ring: THREE.Vector3[], spec: HullSpec, direction: 1 | -1): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const center = new THREE.Vector3();
  ring.forEach((point) => center.add(point));
  center.multiplyScalar(1 / ring.length);
  positions.push(center.x, center.y, center.z);
  hullColor(center.y, spec, colors);
  ring.forEach((point) => {
    positions.push(point.x, point.y, point.z);
    hullColor(point.y, spec, colors);
  });
  const indices: number[] = [];
  for (let i = 1; i <= ring.length; i += 1) {
    const next = i === ring.length ? 1 : i + 1;
    if (direction > 0) indices.push(0, i, next);
    else indices.push(0, next, i);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  if (!facesMatch(geometry, 'x', direction)) reverseWinding(geometry);
  geometry.computeVertexNormals();
  return geometry;
}

function sx(spec: HullSpec, metersFromStern: number): number {
  return metersFromStern * (spec.loa / DESIGN_LOA) - spec.loa / 2;
}

function sy(spec: HullSpec, metersAboveKeel: number): number {
  return metersAboveKeel * (spec.depth / 8.5);
}

function sz(spec: HullSpec, metersFromCenter: number): number {
  return metersFromCenter * (spec.beam / 17.6);
}

function addBox(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
  shadow = true,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = shadow;
  mesh.receiveShadow = shadow;
  parent.add(mesh);
  return mesh;
}

function addBulb(parent: THREE.Object3D, spec: HullSpec, paint: Paint): void {
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), paint.red);
  const nose = spec.draft * 0.16;
  bulb.scale.set(spec.loa * 0.03, nose, spec.beam * 0.1);
  bulb.position.set(spec.loa / 2 - spec.loa * 0.02, spec.draft - nose * 0.55, 0);
  bulb.castShadow = true;
  parent.add(bulb);
}

function addPropulsion(parent: THREE.Object3D, spec: HullSpec, paint: Paint): void {
  const x = -spec.loa / 2 + spec.loa * 0.045;
  const y = spec.draft * 0.3;
  const prop = new THREE.Group();
  prop.position.set(x, y, 0);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(spec.beam * 0.012, spec.beam * 0.012, spec.loa * 0.008, 12), paint.brass);
  hub.rotation.z = Math.PI / 2;
  prop.add(hub);
  const radius = spec.draft * 0.22;
  for (let i = 0; i < 4; i += 1) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.08, radius, radius * 0.28), paint.brass);
    blade.position.y = radius * 0.48;
    const arm = new THREE.Group();
    arm.add(blade);
    arm.rotation.x = (i * Math.PI) / 2;
    prop.add(arm);
  }
  parent.add(prop);

  const rudder = addBox(
    parent,
    [spec.loa * 0.006, spec.draft * 0.62, spec.beam * 0.11],
    [-spec.loa / 2 + spec.loa * 0.012, spec.draft * 0.34, 0],
    paint.dark,
  );
  rudder.castShadow = true;
}

function addBulwark(parent: THREE.Object3D, spec: HullSpec, paint: Paint): void {
  const from = 27.6;
  const to = 83;
  const length = sx(spec, to) - sx(spec, from);
  const center = (sx(spec, from) + sx(spec, to)) / 2;
  const height = sy(spec, 1.08) - sy(spec, 0);
  const y = spec.depth + height / 2;
  const z = spec.beam / 2 - sz(spec, 0.08);
  for (const side of [1, -1]) {
    addBox(parent, [length, height, sz(spec, 0.16)], [center, y, side * z], paint.dark);
    addBox(parent, [length, height * 0.08, sz(spec, 0.2)], [center, y + height / 2, side * z], paint.white, false);
  }
}

function addHatches(parent: THREE.Object3D, spec: HullSpec, paint: Paint): void {
  addHatch(parent, spec, paint, 28.2, 25.5, 'عنبر 2');
  addHatch(parent, spec, paint, 57.4, 25.4, 'عنبر 1');
}

function addHatch(
  parent: THREE.Object3D,
  spec: HullSpec,
  paint: Paint,
  fromStern: number,
  lengthM: number,
  title: string,
): void {
  const length = sx(spec, fromStern + lengthM) - sx(spec, fromStern);
  const width = sz(spec, 10.5);
  const x = sx(spec, fromStern + lengthM / 2);
  const wall = sz(spec, 0.28);
  const coaming = sy(spec, 1.15) - sy(spec, 0);
  const y = spec.depth + coaming / 2;
  addBox(parent, [length, coaming, wall], [x, y, width / 2], paint.coaming);
  addBox(parent, [length, coaming, wall], [x, y, -width / 2], paint.coaming);
  addBox(parent, [wall, coaming, width], [x - length / 2, y, 0], paint.coaming);
  addBox(parent, [wall, coaming, width], [x + length / 2, y, 0], paint.coaming);
  const coverH = sy(spec, 0.42) - sy(spec, 0);
  addBox(parent, [length - wall * 2, coverH, width - wall * 2], [x, spec.depth + coverH / 2 + sy(spec, 0.15) - sy(spec, 0), 0], paint.hatch);
  for (let i = 1; i <= 4; i += 1) {
    const seam = x - length / 2 + (length * i) / 5;
    addBox(parent, [sz(spec, 0.12), coverH * 1.15, width - wall * 3], [seam, spec.depth + coverH, 0], paint.coaming, false);
  }
  for (const z of [-width / 6, width / 6]) {
    addBox(parent, [length - wall * 2, coverH * 1.1, sz(spec, 0.08)], [x, spec.depth + coverH, z], paint.coaming, false);
  }
  for (let i = 0; i <= 10; i += 1) {
    const cx = x - length / 2 + (length * i) / 10;
    for (const side of [1, -1]) {
      addBox(parent, [sz(spec, 0.22), coaming * 0.55, sz(spec, 0.5)], [cx, spec.depth + coaming * 0.28, side * (width / 2 + wall)], paint.coaming, false);
    }
  }
  const sprite = makeSprite(title);
  sprite.position.set(x, spec.depth + sy(spec, 4.2) - sy(spec, 0), 0);
  parent.add(sprite);
}

function addCastle(parent: THREE.Object3D, spec: HullSpec, paint: Paint): void {
  const tiers: [number, number, number, number, number][] = [
    [3.8, 23.4, 8.5, 11.15, 6.3],
    [5.0, 22.4, 11.15, 13.55, 6.0],
    [6.3, 21.5, 13.55, 15.85, 5.7],
    [7.8, 20.5, 15.85, 17.95, 5.25],
  ];
  tiers.forEach(([x0, x1, y0, y1, half], index) => {
    addBox(
      parent,
      [sx(spec, x1) - sx(spec, x0), sy(spec, y1) - sy(spec, y0), sz(spec, half * 2)],
      [(sx(spec, x0) + sx(spec, x1)) / 2, (sy(spec, y0) + sy(spec, y1)) / 2, 0],
      paint.white,
    );
    windowBand(parent, spec, paint, x0 + 0.6, x1 - 0.6, (y0 + y1) / 2, half, 'side');
    if (index > 0) windowBand(parent, spec, paint, x1, x1, (y0 + y1) / 2, half * 0.72, 'front');
  });

  const bridge: [number, number, number, number, number] = [8.6, 21.8, 17.95, 20.45, 8.15];
  const [bx0, bx1, by0, by1, bHalf] = bridge;
  addBox(
    parent,
    [sx(spec, bx1) - sx(spec, bx0), sy(spec, by1) - sy(spec, by0), sz(spec, bHalf * 2)],
    [(sx(spec, bx0) + sx(spec, bx1)) / 2, (sy(spec, by0) + sy(spec, by1)) / 2, 0],
    paint.white,
  );
  const glassH = sy(spec, 1.05) - sy(spec, 0);
  const glassY = sy(spec, by1) - glassH * 0.72;
  addBox(parent, [sz(spec, 0.12), glassH, sz(spec, bHalf * 2 - 0.8)], [sx(spec, bx1), glassY, 0], paint.glass, false);
  addBox(parent, [sx(spec, bx1) - sx(spec, bx0) - sz(spec, 1), glassH, sz(spec, 0.12)], [(sx(spec, bx0) + sx(spec, bx1)) / 2, glassY, sz(spec, bHalf)], paint.glass, false);
  addBox(parent, [sx(spec, bx1) - sx(spec, bx0) - sz(spec, 1), glassH, sz(spec, 0.12)], [(sx(spec, bx0) + sx(spec, bx1)) / 2, glassY, -sz(spec, bHalf)], paint.glass, false);
  addLight(parent, spec, sx(spec, bx1 - 0.2), glassY, sz(spec, bHalf + 0.15), 0x2f9e44);
  addLight(parent, spec, sx(spec, bx1 - 0.2), glassY, -sz(spec, bHalf + 0.15), 0xc0392b);

  const railY = sy(spec, by1) + sy(spec, 0.45) - sy(spec, 0);
  addBox(parent, [sz(spec, 0.08), sy(spec, 0.9) - sy(spec, 0), sz(spec, bHalf * 2)], [sx(spec, bx1), railY, 0], paint.white, false);
  addBox(parent, [sx(spec, bx1) - sx(spec, bx0), sy(spec, 0.9) - sy(spec, 0), sz(spec, 0.08)], [(sx(spec, bx0) + sx(spec, bx1)) / 2, railY, sz(spec, bHalf)], paint.white, false);
  addBox(parent, [sx(spec, bx1) - sx(spec, bx0), sy(spec, 0.9) - sy(spec, 0), sz(spec, 0.08)], [(sx(spec, bx0) + sx(spec, bx1)) / 2, railY, -sz(spec, bHalf)], paint.white, false);

  const ramp = poopRamp(spec);
  const rampMesh = new THREE.Mesh(ramp, paint.dark);
  rampMesh.position.set(sx(spec, 23.4), spec.depth, 0);
  rampMesh.castShadow = true;
  parent.add(rampMesh);

  for (const side of [1, -1]) {
    const boat = new THREE.Mesh(new THREE.CapsuleGeometry(sy(spec, 0.55) - sy(spec, 0), sx(spec, 17.4) - sx(spec, 14.2), 4, 8), paint.white);
    boat.rotation.z = Math.PI / 2;
    boat.position.set(sx(spec, 14.6), sy(spec, 12.35), side * sz(spec, 7.15));
    boat.castShadow = true;
    parent.add(boat);
  }

  for (let i = 0; i < 4; i += 1) {
    const x = sx(spec, 6.2 + i * 2.5);
    const y = spec.draft + (spec.depth - spec.draft) * 0.55;
    for (const side of [1, -1]) {
      const port = new THREE.Mesh(new THREE.CircleGeometry(sz(spec, 0.22), 14), paint.glass);
      port.position.set(x, y, side * (spec.beam / 2 + 0.03));
      if (side < 0) port.rotation.y = Math.PI;
      parent.add(port);
    }
  }

  addFunnel(parent, spec, paint);
  addCastleDetails(parent, spec, paint, tiers);

  addMast(parent, spec, paint, 15.4, 20.4, 10.5, 3.2, false);
}

/* المدخنة في الرسم صندوقية: الوجه الأمامي رأسي والخلفي مائل قليلا،
   غطاء أسود بارز في الأعلى، وشريط أبيض عليه حرف N. */
function addFunnel(parent: THREE.Object3D, spec: HullSpec, paint: Paint): void {
  const frontX = sx(spec, 8.4);
  const backBase = sx(spec, 3.9);
  const backTop = sx(spec, 4.5);
  const y0 = sy(spec, 15.9);
  const y1 = sy(spec, 22.9);
  const width = sz(spec, 5.4);
  const shape = new THREE.Shape();
  shape.moveTo(backBase, y0);
  shape.lineTo(frontX, y0);
  shape.lineTo(frontX, y1);
  shape.lineTo(backTop, y1);
  shape.closePath();
  const body = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false }),
    paint.navy,
  );
  body.geometry.translate(0, 0, -width / 2);
  body.castShadow = true;
  body.receiveShadow = true;
  parent.add(body);

  const capH = sy(spec, 0.55) - sy(spec, 0);
  addBox(
    parent,
    [frontX - backTop + sx(spec, 0.8) - sx(spec, 0), capH, width + sz(spec, 0.7)],
    [(frontX + backTop) / 2 - 0.05, y1 + capH / 2, 0],
    paint.funnel,
  );

  const bandH = sy(spec, 2.3) - sy(spec, 0);
  const bandY = sy(spec, 19.6);
  const midX = (frontX + (backBase + backTop) / 2) / 2 - 0.05;
  const bandLen = frontX - (backBase + backTop) / 2;
  addBox(parent, [bandLen + 0.04, bandH, width + 0.06], [midX, bandY, 0], paint.white, false);
  const logo = new THREE.MeshBasicMaterial({ map: funnelTexture(), transparent: true, depthWrite: false });
  for (const side of [1, -1]) {
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(bandH * 0.96, bandH * 0.96), logo);
    plate.position.set(midX, bandY, side * (width / 2 + 0.05));
    if (side < 0) plate.rotation.y = Math.PI;
    parent.add(plate);
  }

  const grille = addBox(
    parent,
    [sz(spec, 0.5), sy(spec, 1.1) - sy(spec, 0), sz(spec, 2.6)],
    [backTop - sz(spec, 0.3), y1 + capH + sy(spec, 0.5) - sy(spec, 0), 0],
    paint.dark,
    false,
  );
  grille.rotation.z = 0.35;
}

function funnelTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (context) {
    context.clearRect(0, 0, 256, 256);
    context.fillStyle = '#16253d';
    context.font = '800 200px "Segoe UI", Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('N', 128, 138);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/* درابزين لكل طابق، سلالم خارجية، أبواب، وفتحات تهوية كما تظهر في الرسم. */
function addCastleDetails(
  parent: THREE.Object3D,
  spec: HullSpec,
  paint: Paint,
  tiers: [number, number, number, number, number][],
): void {
  tiers.forEach(([x0, x1, , y1, half]) => {
    addRailRing(parent, spec, paint, x0, x1, y1, half + 0.05);
  });
  addRailRing(parent, spec, paint, 8.6, 21.8, 20.45, 8.15);

  for (const side of [1, -1]) {
    const flights: [number, number, number, number][] = [
      [8.6, 11.15, 12.3, 13.55],
      [9.2, 13.55, 13.8, 15.85],
      [9.8, 15.85, 14.3, 17.95],
    ];
    flights.forEach(([fromX, fromY, toX, toY], i) => {
      const half = tiers[i + 1][4];
      const z = side * sz(spec, half + 0.42);
      const x0 = sx(spec, fromX);
      const x1 = sx(spec, toX);
      const y0 = sy(spec, fromY);
      const yTop = sy(spec, toY);
      const run = x1 - x0;
      const rise = yTop - y0;
      const length = Math.hypot(run, rise);
      const stair = addBox(parent, [length, sy(spec, 0.14) - sy(spec, 0), sz(spec, 0.9)], [(x0 + x1) / 2, (y0 + yTop) / 2, z], paint.dark, false);
      stair.rotation.z = Math.atan2(rise, run);
      const rail = addBox(parent, [length, sy(spec, 0.08) - sy(spec, 0), sz(spec, 0.08)], [(x0 + x1) / 2, (y0 + yTop) / 2 + sy(spec, 0.95) - sy(spec, 0), z + side * sz(spec, 0.42)], paint.white, false);
      rail.rotation.z = Math.atan2(rise, run);
    });

    for (let i = 0; i < 3; i += 1) {
      addBox(
        parent,
        [sz(spec, 0.14), sy(spec, 1.8) - sy(spec, 0), sz(spec, 1.0)],
        [sx(spec, 4.6 + i * 6.2), sy(spec, 9.7), side * sz(spec, 6.38)],
        paint.dark,
        false,
      );
    }
  }

  for (let i = 0; i < 4; i += 1) {
    const base = tiers[i];
    const door = addBox(
      parent,
      [sz(spec, 0.1), sy(spec, 1.7) - sy(spec, 0), sz(spec, 0.95)],
      [sx(spec, base[0]) - 0.04, sy(spec, base[2] + 0.95), sz(spec, i % 2 ? 1.8 : -1.8)],
      paint.dark,
      false,
    );
    door.castShadow = false;
  }

  for (const z of [-2.2, 2.2]) {
    const vent = new THREE.Mesh(
      new THREE.CylinderGeometry(sz(spec, 0.2), sz(spec, 0.3), sy(spec, 1.5) - sy(spec, 0), 10),
      paint.red,
    );
    vent.position.set(sx(spec, 24.4), spec.depth + sy(spec, 0.8) - sy(spec, 0), sz(spec, z + (z > 0 ? 4 : -4)));
    vent.castShadow = true;
    parent.add(vent);
  }
}

function addRailRing(
  parent: THREE.Object3D,
  spec: HullSpec,
  paint: Paint,
  x0: number,
  x1: number,
  yDeck: number,
  half: number,
): void {
  const height = sy(spec, 1.0) - sy(spec, 0);
  const thin = sz(spec, 0.07);
  const xa = sx(spec, x0);
  const xb = sx(spec, x1);
  const y = sy(spec, yDeck);
  const length = xb - xa;
  const width = sz(spec, half * 2);
  const runs: [number, number, number, number][] = [
    [(xa + xb) / 2, length, sz(spec, half), 0],
    [(xa + xb) / 2, length, -sz(spec, half), 0],
    [xb, width, 0, 1],
    [xa, width, 0, 1],
  ];
  runs.forEach(([cx, size, cz, across]) => {
    const dims: [number, number, number] = across ? [thin, thin, size] : [size, thin, thin];
    addBox(parent, dims, [cx, y + height, cz], paint.white, false);
    addBox(parent, dims, [cx, y + height * 0.5, cz], paint.white, false);
  });
  const posts = Math.max(4, Math.round(length / 1.8));
  for (let i = 0; i <= posts; i += 1) {
    const x = xa + (length * i) / posts;
    for (const side of [1, -1]) {
      addBox(parent, [thin, height, thin], [x, y + height / 2, side * sz(spec, half)], paint.white, false);
    }
  }
  const across = Math.max(3, Math.round(width / 1.8));
  for (let i = 1; i < across; i += 1) {
    const z = -width / 2 + (width * i) / across;
    addBox(parent, [thin, height, thin], [xb, y + height / 2, z], paint.white, false);
    addBox(parent, [thin, height, thin], [xa, y + height / 2, z], paint.white, false);
  }
}

function windowBand(
  parent: THREE.Object3D,
  spec: HullSpec,
  paint: Paint,
  x0: number,
  x1: number,
  y: number,
  half: number,
  face: 'side' | 'front',
): void {
  const h = sy(spec, 0.7) - sy(spec, 0);
  const yy = sy(spec, y);
  if (face === 'front') {
    const count = 4;
    const span = sz(spec, half * 2);
    const w = span / (count * 1.7);
    for (let i = 0; i < count; i += 1) {
      const z = -span / 2 + ((i + 0.5) * span) / count;
      addBox(parent, [sz(spec, 0.1), h, w], [sx(spec, x0) + 0.04, yy, z], paint.glass, false);
    }
    return;
  }
  const count = 5;
  for (let i = 0; i < count; i += 1) {
    const x = sx(spec, x0 + ((i + 0.5) * (x1 - x0)) / count);
    for (const side of [1, -1]) {
      addBox(parent, [sz(spec, 0.62), h, sz(spec, 0.1)], [x, yy, side * (sz(spec, half) + 0.02)], paint.glass, false);
    }
  }
}

function poopRamp(spec: HullSpec): THREE.BufferGeometry {
  const length = sx(spec, 26.6) - sx(spec, 23.4);
  const height = sy(spec, 2.55) - sy(spec, 0);
  const width = sz(spec, 14);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(length, 0);
  shape.lineTo(0, height);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  geometry.translate(0, 0, -width / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function addLight(parent: THREE.Object3D, spec: HullSpec, x: number, y: number, z: number, color: number): void {
  const light = new THREE.Mesh(
    new THREE.SphereGeometry(sz(spec, 0.16), 10, 8),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8, roughness: 0.4 }),
  );
  light.position.set(x, y, z);
  parent.add(light);
}

function addDerricks(parent: THREE.Object3D, spec: HullSpec, paint: Paint): void {
  addDerrick(parent, spec, paint, 27.1, 0, -1);
  addDerrick(parent, spec, paint, 55.4, 1.35, -1);
  addDerrick(parent, spec, paint, 55.4, -1.35, 1);
  addDerrick(parent, spec, paint, 83.8, 0, 1);
}

function addDerrick(
  parent: THREE.Object3D,
  spec: HullSpec,
  paint: Paint,
  fromStern: number,
  zMeters: number,
  pitchSign: number,
): void {
  const postH = sy(spec, 11.2) - sy(spec, 0);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(sz(spec, 0.22), sz(spec, 0.32), postH, 10), paint.derrick);
  post.position.set(sx(spec, fromStern), spec.depth + postH / 2, sz(spec, zMeters));
  post.castShadow = true;
  parent.add(post);

  const boomL = sx(spec, 16) - sx(spec, 0);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(sz(spec, 0.1), sz(spec, 0.15), boomL, 8), paint.derrick);
  boom.geometry.translate(0, boomL / 2, 0);
  boom.rotation.z = pitchSign * 0.28;
  boom.position.set(sx(spec, fromStern), spec.depth + postH * 0.38, sz(spec, zMeters));
  boom.castShadow = true;
  parent.add(boom);

  const tip = new THREE.Vector3(0, boomL, 0).applyEuler(new THREE.Euler(0, 0, pitchSign * 0.28)).add(boom.position);
  const top = new THREE.Vector3(sx(spec, fromStern), spec.depth + postH, sz(spec, zMeters));
  parent.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([top, tip]), paint.line));
  const cap = new THREE.Mesh(new THREE.SphereGeometry(sz(spec, 0.38), 10, 8), paint.dark);
  cap.position.copy(top);
  parent.add(cap);

  addBox(
    parent,
    [sz(spec, 1.4), sy(spec, 0.7) - sy(spec, 0), sz(spec, 1.1)],
    [sx(spec, fromStern), spec.depth + sy(spec, 0.45) - sy(spec, 0), sz(spec, zMeters)],
    paint.dark,
    false,
  );
}

function addDeckGear(parent: THREE.Object3D, spec: HullSpec, paint: Paint): void {
  const bollard = (x: number, y: number, z: number): void => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(sz(spec, 0.2), sz(spec, 0.26), sy(spec, 0.7) - sy(spec, 0), 10), paint.dark);
    post.position.set(x, y + (sy(spec, 0.7) - sy(spec, 0)) / 2, z);
    post.castShadow = true;
    parent.add(post);
  };
  for (const side of [1, -1]) {
    const edge = side * (spec.beam / 2 - sz(spec, 0.9));
    bollard(sx(spec, 91.5), sy(spec, 11.2), edge * 0.82);
    bollard(sx(spec, 86.5), sy(spec, 11.2), edge * 0.93);
    bollard(sx(spec, 2.2), sy(spec, 8.95), edge * 0.78);
    bollard(sx(spec, 25.5), spec.depth, edge);
    bollard(sx(spec, 85), spec.depth, edge);
  }

  const forecastleDeck = sy(spec, 11.15);
  const from = sx(spec, 83.4);
  const to = sx(spec, 95);
  const half = sz(spec, 7.1);
  const rail = sy(spec, 1.0) - sy(spec, 0);
  for (const side of [1, -1]) {
    addBox(parent, [to - from, sz(spec, 0.07), sz(spec, 0.07)], [(from + to) / 2, forecastleDeck + rail, side * half], paint.white, false);
    addBox(parent, [to - from, sz(spec, 0.07), sz(spec, 0.07)], [(from + to) / 2, forecastleDeck + rail * 0.5, side * half], paint.white, false);
    for (let i = 0; i <= 7; i += 1) {
      addBox(parent, [sz(spec, 0.07), rail, sz(spec, 0.07)], [from + ((to - from) * i) / 7, forecastleDeck + rail / 2, side * half], paint.white, false);
    }
  }
  for (const z of [-3.2, 3.2]) {
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(sz(spec, 0.2), sz(spec, 0.3), sy(spec, 1.4) - sy(spec, 0), 10), paint.red);
    vent.position.set(sx(spec, 86), forecastleDeck + sy(spec, 0.7) - sy(spec, 0), sz(spec, z));
    vent.castShadow = true;
    parent.add(vent);
  }
}

/* حزام رغوة حول خط الماء وأثر خلف المؤخرة. */
function addWaterEffects(parent: THREE.Object3D, spec: HullSpec): void {
  const steps = 80;
  const positions: number[] = [];
  const indices: number[] = [];
  const ring: { x: number; z: number }[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = Math.min(0.999, Math.max(0.001, i / steps));
    ring.push({ x: stationX(t, spec.draft, spec), z: halfBreadth(t, spec) });
  }
  const outline: { x: number; z: number; nx: number; nz: number }[] = [];
  ring.forEach((p, i) => {
    const prev = ring[Math.max(0, i - 1)];
    const next = ring[Math.min(ring.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    outline.push({ x: p.x, z: p.z, nx: dz / len, nz: -dx / len });
  });
  const wave = (i: number): number => {
    const t = i / steps;
    return 0.35 + 0.5 * smoothstep(0.7, 1, t) + 0.25 * smoothstep(0.1, 0, t);
  };
  const vertices: [number, number][] = [];
  outline.forEach((p, i) => {
    vertices.push([p.x - p.nx * 0.05, p.z - p.nz * 0.05]);
    vertices.push([p.x + p.nx * wave(i), p.z + p.nz * wave(i)]);
  });
  for (const side of [1, -1]) {
    const base = positions.length / 3;
    vertices.forEach(([x, z], k) => {
      positions.push(x, 0, side * z);
      void k;
    });
    for (let i = 0; i < steps; i += 1) {
      const a = base + i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  const foam = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }),
  );
  foam.position.y = spec.draft + 0.04;
  foam.renderOrder = 1;
  foam.userData['water'] = true;
  parent.add(foam);

  const wakeLength = spec.loa * 0.55;
  const wake = new THREE.Mesh(
    new THREE.PlaneGeometry(wakeLength, spec.beam * 1.5),
    new THREE.MeshBasicMaterial({ map: wakeTexture(), transparent: true, depthWrite: false }),
  );
  wake.rotation.x = -Math.PI / 2;
  wake.position.set(-spec.loa / 2 - wakeLength / 2 + 3, spec.draft + 0.05, 0);
  wake.renderOrder = 1;
  wake.userData['water'] = true;
  parent.add(wake);
}

function wakeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createLinearGradient(512, 0, 0, 0);
    gradient.addColorStop(0, 'rgba(255,255,255,0.65)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.18)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(512, 40);
    context.lineTo(0, 0);
    context.lineTo(0, 128);
    context.lineTo(512, 88);
    context.closePath();
    context.fill();
    context.globalCompositeOperation = 'destination-out';
    context.fillStyle = 'rgba(0,0,0,0.5)';
    for (let i = 0; i < 90; i += 1) {
      context.fillRect(Math.random() * 512, Math.random() * 128, 20 + Math.random() * 40, 2);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/* بحر بملمس خفيف بدل اللون المسطح. */
export function createSea(draft: number): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = '#5f8ea6';
    context.fillRect(0, 0, 512, 512);
    let seed = 7;
    const rand = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 260; i += 1) {
      const x = rand() * 512;
      const y = rand() * 512;
      const w = 30 + rand() * 90;
      context.strokeStyle = rand() > 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(20,60,90,0.10)';
      context.lineWidth = 1 + rand() * 2;
      context.beginPath();
      context.moveTo(x, y);
      context.quadraticCurveTo(x + w / 2, y - 4 - rand() * 5, x + w, y);
      context.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(26, 26);
  texture.anisotropy = 8;
  texture.colorSpace = THREE.SRGBColorSpace;
  const sea = new THREE.Mesh(
    new THREE.CircleGeometry(240, 72),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.55, metalness: 0.08 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = draft;
  sea.receiveShadow = true;
  return sea;
}

function addForecastle(parent: THREE.Object3D, spec: HullSpec, paint: Paint): void {
  addMast(parent, spec, paint, 90.4, 11.35, 14.5, 4.4, true);
  const windlass = new THREE.Mesh(new THREE.CylinderGeometry(sz(spec, 0.45), sz(spec, 0.45), sz(spec, 2.4), 12), paint.dark);
  windlass.rotation.z = Math.PI / 2;
  windlass.position.set(sx(spec, 89.2), sy(spec, 11.7), 0);
  parent.add(windlass);
  for (const side of [1, -1]) {
    const anchor = new THREE.Group();
    addBox(anchor, [sz(spec, 0.28), sy(spec, 1.5) - sy(spec, 0), sz(spec, 0.22)], [0, 0, 0], paint.dark, false);
    addBox(anchor, [sz(spec, 0.9), sy(spec, 0.7) - sy(spec, 0), sz(spec, 0.16)], [0, sy(spec, -0.55) - sy(spec, 0), 0], paint.dark, false);
    anchor.position.set(sx(spec, 93.5), sy(spec, 7.4), side * sz(spec, 2.4));
    parent.add(anchor);
  }
}

function addMast(
  parent: THREE.Object3D,
  spec: HullSpec,
  paint: Paint,
  fromStern: number,
  baseY: number,
  heightM: number,
  yardM: number,
  stayed: boolean,
): void {
  const height = sy(spec, baseY + heightM) - sy(spec, baseY);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(sz(spec, 0.12), sz(spec, 0.22), height, 8), paint.dark);
  const x = sx(spec, fromStern);
  const y0 = sy(spec, baseY);
  mast.position.set(x, y0 + height / 2, 0);
  mast.castShadow = true;
  parent.add(mast);
  addBox(parent, [sz(spec, 0.1), sz(spec, 0.1), sz(spec, yardM)], [x, y0 + height * 0.62, 0], paint.dark, false);
  const radar = new THREE.Mesh(new THREE.CylinderGeometry(sz(spec, 0.55), sz(spec, 0.55), sz(spec, 0.08), 16), paint.white);
  radar.position.set(x, y0 + height * 0.86, 0);
  parent.add(radar);
  if (!stayed) return;
  const top = new THREE.Vector3(x, y0 + height * 0.92, 0);
  const feet = [
    new THREE.Vector3(sx(spec, fromStern - 6.5), sy(spec, baseY), sz(spec, 3.2)),
    new THREE.Vector3(sx(spec, fromStern - 6.5), sy(spec, baseY), -sz(spec, 3.2)),
    new THREE.Vector3(sx(spec, fromStern + 3.2), sy(spec, baseY + 0.4), 0),
  ];
  for (const foot of feet) {
    const geometry = new THREE.BufferGeometry().setFromPoints([top, foot]);
    parent.add(new THREE.Line(geometry, paint.line));
  }
}

function addNames(parent: THREE.Object3D, spec: HullSpec, paint: Paint): void {
  const material = new THREE.MeshBasicMaterial({ map: nameTexture(spec.name), transparent: true, depthWrite: false });
  const plateH = Math.min(1.15, (spec.depth - spec.draft) * 0.62);
  const plateW = plateH * 7.2;
  const y = spec.draft + (spec.depth - spec.draft) * 0.58;
  for (const side of [1, -1]) {
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(plateW, plateH), material);
    plate.position.set(sx(spec, 74), y, side * (spec.beam / 2 + 0.05));
    if (side < 0) plate.rotation.y = Math.PI;
    parent.add(plate);
  }
  const stern = new THREE.Mesh(new THREE.PlaneGeometry(plateW * 0.72, plateH * 0.85), material);
  stern.position.set(-spec.loa / 2 - 0.05, spec.draft + plateH, 0);
  stern.rotation.y = -Math.PI / 2;
  parent.add(stern);
}

function addLabels(parent: THREE.Object3D, spec: HullSpec): void {
  const engine = makeSprite('غرفة المحرك');
  engine.position.set(sx(spec, 13), sy(spec, 23.5), 0);
  parent.add(engine);
}

function nameTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 180;
  const context = canvas.getContext('2d');
  if (!context) return new THREE.CanvasTexture(canvas);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#f7f4ee';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  let size = 92;
  context.font = `700 ${size}px "Segoe UI", Tahoma, Arial, sans-serif`;
  while (context.measureText(text).width > 980 && size > 36) {
    size -= 4;
    context.font = `700 ${size}px "Segoe UI", Tahoma, Arial, sans-serif`;
  }
  context.fillText(text, 512, 92);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeSprite(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    roundRect(context, 16, 28, 480, 104, 28);
    context.fillStyle = 'rgba(14, 34, 56, 0.82)';
    context.fill();
    context.fillStyle = '#f4f1ea';
    context.font = '700 64px "Segoe UI", Tahoma, Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 256, 84);
    texture.needsUpdate = true;
  }
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }),
  );
  sprite.scale.set(11, 3.4, 1);
  sprite.renderOrder = 2;
  return sprite;
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}
