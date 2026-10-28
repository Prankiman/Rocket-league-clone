import * as THREE from 'three';

// The aim bay is a standalone box outside the soccar pitch. Physics uses
// Unreal units (z up); scene objects are added under the game's 0.01-scaled
// root, so their local positions stay in the same units as RocketSim state.
export const AIM_PLATFORM = { center: [0, -250, 940], size: [5200, 3500, 120] };
export const AIM_WALL = { center: [0, 1450, 1700], size: [4800, 100, 1400] };
export const AIM_CAR_SPAWN = [0, -1750, 1040];
export const AIM_WALL_FACE = 1400;
export const AIM_PLATFORM_TOP = 1000;
export const AIM_TARGET_BOUNDS = { x: 2090, zMin: 1265, zMax: 2080 };
export const AIM_GOAL = { halfWidth: 893, top: AIM_PLATFORM_TOP + 642 };
export const AIM_HIT_PLANE = AIM_WALL_FACE - 100;

const AIM_BOXES = [AIM_PLATFORM, AIM_WALL];

// CMF is the native collision format: triangle count, vertex count, uint32
// indices, then float32 vertices. Vertices are Bullet meters at 50 uu/unit.
export function collisionMeshFromBoxes(boxes) {
  const vertices = [];
  const indices = [];
  for (const { center: [cx, cy, cz], size: [sx, sy, sz] } of boxes) {
    const x0 = (cx - sx / 2) / 50, x1 = (cx + sx / 2) / 50;
    const y0 = (cy - sy / 2) / 50, y1 = (cy + sy / 2) / 50;
    const z0 = (cz - sz / 2) / 50, z1 = (cz + sz / 2) / 50;
    const base = vertices.length;
    vertices.push(
      [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
      [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
    );
    for (const triangle of [
      [0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6],
      [0, 4, 5], [0, 5, 1], [1, 5, 6], [1, 6, 2],
      [2, 6, 7], [2, 7, 3], [3, 7, 4], [3, 4, 0],
    ]) indices.push(...triangle.map(index => index + base));
  }
  const buffer = new ArrayBuffer(8 + indices.length * 4 + vertices.length * 12);
  const view = new DataView(buffer);
  view.setUint32(0, indices.length / 3, true);
  view.setUint32(4, vertices.length, true);
  indices.forEach((index, offset) => view.setUint32(8 + offset * 4, index, true));
  let offset = 8 + indices.length * 4;
  for (const vertex of vertices) for (const value of vertex) {
    view.setFloat32(offset, value, true);
    offset += 4;
  }
  return new Uint8Array(buffer);
}

export function aimCollisionMeshes() {
  return [collisionMeshFromBoxes(AIM_BOXES)];
}

// Physics (x, y, z-up) -> local Three (x, z, y). The root group supplies the
// final 0.01 scene scale.
function toLocal([x, y, z]) {
  return new THREE.Vector3(x, z, y);
}

const trainingPlatformMaterial = new THREE.MeshStandardMaterial({
  color: 0x102033,
  metalness: 0.45,
  roughness: 0.5,
  emissive: 0x08283c,
  emissiveIntensity: 0.7,
});
const trainingTrimMaterial = new THREE.MeshBasicMaterial({ color: 0x37e8ff, toneMapped: false });
const trainingGridMaterial = new THREE.LineBasicMaterial({ color: 0x1d6d8a, transparent: true, opacity: 0.38, toneMapped: false });
const goalFrameMaterial = new THREE.MeshBasicMaterial({ color: 0xaef9ff, toneMapped: false });
const goalBackMaterial = new THREE.MeshBasicMaterial({
  color: 0x020711,
  transparent: true,
  opacity: 0.88,
  side: THREE.DoubleSide,
  toneMapped: false,
});

function addTrainingPlatform(group, box) {
  const [sx, sy, sz] = box.size;
  const platform = new THREE.Mesh(new THREE.BoxGeometry(sx, sz, sy), trainingPlatformMaterial);
  platform.position.copy(toLocal(box.center));
  platform.receiveShadow = true;
  group.add(platform);
  // Neon strips along the long edges of the pad.
  for (const side of [-1, 1]) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(30, 14, sy), trainingTrimMaterial);
    trim.position.copy(toLocal([box.center[0] + side * (sx / 2 - 18), box.center[1], box.center[2] + sz / 2 + 4]));
    group.add(trim);
  }
  // Floor grid makes the pad readable against the night sky.
  const gridZ = box.center[2] + sz / 2 + 3, points = [];
  for (let x = -sx / 2 + 500; x < sx / 2; x += 500) points.push(
    ...toLocal([box.center[0] + x, box.center[1] - sy / 2, gridZ]).toArray(),
    ...toLocal([box.center[0] + x, box.center[1] + sy / 2, gridZ]).toArray(),
  );
  for (let y = -sy / 2 + 500; y < sy / 2; y += 500) points.push(
    ...toLocal([box.center[0] - sx / 2, box.center[1] + y, gridZ]).toArray(),
    ...toLocal([box.center[0] + sx / 2, box.center[1] + y, gridZ]).toArray(),
  );
  const grid = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(points, 3)), trainingGridMaterial);
  group.add(grid);
}

function addAimWall(group) {
  const [sx, sy, sz] = AIM_WALL.size;
  const [cx, , cz] = AIM_WALL.center;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(sx, sz, sy), trainingPlatformMaterial);
  wall.position.copy(toLocal(AIM_WALL.center));
  wall.receiveShadow = true;
  group.add(wall);

  const face = AIM_WALL_FACE - 6;
  const top = cz + sz / 2;
  // Neon outline around the target wall.
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(34, sz, 14), trainingTrimMaterial);
    post.position.copy(toLocal([cx + side * (sx / 2 - 17), face, cz]));
    group.add(post);
  }
  const cap = new THREE.Mesh(new THREE.BoxGeometry(sx, 34, 14), trainingTrimMaterial);
  cap.position.copy(toLocal([cx, face, top - 17]));
  group.add(cap);

  // Subtle wall grid keeps the dark target board readable against the sky.
  const wallGridMaterial = new THREE.LineBasicMaterial({ color: 0x2a7d99, transparent: true, opacity: 0.25, toneMapped: false });
  const bottom = AIM_WALL.center[2] - sz / 2, grid = [];
  for (let x = -sx / 2 + 400; x < sx / 2; x += 400) grid.push(
    ...toLocal([cx + x, AIM_WALL_FACE - 0.2, bottom]).toArray(),
    ...toLocal([cx + x, AIM_WALL_FACE - 0.2, top]).toArray(),
  );
  for (let z = bottom + 300; z < top; z += 300) grid.push(
    ...toLocal([cx - sx / 2, AIM_WALL_FACE - 0.2, z]).toArray(),
    ...toLocal([cx + sx / 2, AIM_WALL_FACE - 0.2, z]).toArray(),
  );
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(grid, 3)), wallGridMaterial));

  // The goal mouth gives the target band a meaningful reference. Most targets
  // are placed inside this opening; a few sit on the backboard above it.
  const goalTop = AIM_GOAL.top;
  const goalMid = (AIM_PLATFORM_TOP + goalTop) / 2;
  const backing = new THREE.Mesh(new THREE.PlaneGeometry(AIM_GOAL.halfWidth * 2, goalTop - AIM_PLATFORM_TOP), goalBackMaterial);
  backing.position.copy(toLocal([cx, AIM_WALL_FACE - 1, goalMid]));
  backing.rotation.y = Math.PI;
  group.add(backing);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(34, goalTop - AIM_PLATFORM_TOP, 16), goalFrameMaterial);
    post.position.copy(toLocal([cx + side * AIM_GOAL.halfWidth, face - 8, goalMid]));
    group.add(post);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(AIM_GOAL.halfWidth * 2 + 34, 34, 16), goalFrameMaterial);
  bar.position.copy(toLocal([cx, face - 8, goalTop]));
  group.add(bar);
}

export function createAimMap() {
  const group = new THREE.Group();
  group.name = 'Aim trainer bay';
  addTrainingPlatform(group, AIM_PLATFORM);
  addAimWall(group);
  return { group };
}
