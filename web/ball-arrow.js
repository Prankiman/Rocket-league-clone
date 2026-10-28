import * as THREE from 'three';

// Off-screen ball locator in the Rocket League style: a small white arrow with a
// dark outline. It lives on an invisible bubble sphere slightly larger than the
// car, centred on the car: the arrow takes the car -> ball direction vector, sits
// where that ray exits the sphere, and tilts along the full 3D direction. It shows
// only while the ball is outside the camera frustum and holds steady while visible.
// The shaft and head use the same materials, so both are baked into one position
// buffer per colour: two draw calls instead of four while the arrow is on screen.
const AXIS_Y = new THREE.Vector3(0, 1, 0), CAMERA_SPACE = new THREE.Vector3(), PROJECTED = new THREE.Vector3();
const AIM = new THREE.Vector3(), WORLD = new THREE.Vector3();
const SPHERE = 92;
const CORE_MATERIAL = { color: 0xf4faff, transparent: true, opacity: .95, depthTest: false, depthWrite: false };
const OUTLINE_MATERIAL = { color: 0x10233a, transparent: true, opacity: .85, depthTest: false, depthWrite: false };
function arrowGeometry(outline) {
  // Low-poly arrow (~32 uu tall): a short tapered shaft capped by a squat cone.
  const shaft = new THREE.CylinderGeometry(3.6, 5, 20, 8), head = new THREE.ConeGeometry(9.5, 12, 8);
  const parts = outline
    ? [{ geometry: shaft, offset: 10, scale: [1.6, 1.08, 1.6] }, { geometry: head, offset: 26, scale: [1.5, 1.1, 1.5] }]
    : [{ geometry: shaft, offset: 10 }, { geometry: head, offset: 26 }];
  const chunks = [];
  let total = 0;
  for (const { geometry, offset, scale } of parts) {
    const chunk = geometry.index ? geometry.toNonIndexed() : geometry;
    if (scale) chunk.scale(scale[0], scale[1], scale[2]);
    chunk.translate(0, offset, 0);
    chunks.push(chunk.attributes.position.array);
    total += chunk.attributes.position.array.length;
  }
  const positions = new Float32Array(total);
  let at = 0;
  for (const chunk of chunks) { positions.set(chunk, at); at += chunk.length; }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  shaft.dispose(); head.dispose();
  return merged;
}
const CORE_GEOMETRY = arrowGeometry(false), OUTLINE_GEOMETRY = arrowGeometry(true);
export function createBallArrow(parent) {
  const core = new THREE.Mesh(CORE_GEOMETRY, new THREE.MeshBasicMaterial(CORE_MATERIAL));
  const outline = new THREE.Mesh(OUTLINE_GEOMETRY, new THREE.MeshBasicMaterial(OUTLINE_MATERIAL));
  // The slightly inflated outline shell renders first so the white core wins the
  // depth-independent overlap test.
  outline.renderOrder = 7; core.renderOrder = 8;
  const group = new THREE.Group(); group.name = 'Off-screen ball arrow';
  group.scale.setScalar(.5);   // half size on every axis (1/8th the old volume)
  group.add(outline, core);
  group.visible = false;
  parent.add(group);
  function hide() {
    if (group.visible) group.visible = false;
  }
  function update(camera, ball, car, options = {}) {
    if (!options.enabled || !options.visible || !car.visible) return hide();
    // ball/car arrive in the parent's local units (uu); the camera lives in world
    // space (metres), so project the true world position of the ball.
    parent.updateWorldMatrix(false, false);
    WORLD.copy(ball).applyMatrix4(parent.matrixWorld);
    // Off-screen test; behind the camera the perspective divide mirrors, so flip.
    CAMERA_SPACE.copy(WORLD).applyMatrix4(camera.matrixWorldInverse);
    PROJECTED.copy(WORLD).project(camera);
    const behind = CAMERA_SPACE.z > 0;
    if (behind) { PROJECTED.x = -PROJECTED.x; PROJECTED.y = -PROJECTED.y; }
    if (!behind && Math.abs(PROJECTED.x) <= .98 && Math.abs(PROJECTED.y) <= .92) return hide();
    // Sphere placement: ray from the car through the ball, parked where it exits
    // the bubble around the car, oriented along that same 3D direction.
    AIM.copy(ball).sub(car.position);
    if (AIM.lengthSq() < 1e-6) return hide();
    AIM.normalize();
    group.position.copy(car.position).addScaledVector(AIM, SPHERE);
    group.quaternion.setFromUnitVectors(AXIS_Y, AIM);
    if (!group.visible) group.visible = true;
  }
  return { update, hide };
}
