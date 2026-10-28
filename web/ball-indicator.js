import * as THREE from 'three';

// Ball ground indicator in the style of Rocket League mods: a ring pinned to the
// ball's footprint on the floor plus an inner filled circle that shrinks as the
// ball climbs away from the floor, so watching one spot reveals the cut height.
const REST_HEIGHT = 92.75, MAX_SPAN = 1951;
export function createBallIndicator(parent) {
  // Both discs face +Y and the camera stays above the floor: front faces only.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(86, 100, 44),
    new THREE.MeshBasicMaterial({ color: 0xdceeff, transparent: true, opacity: .6, depthWrite: false }));
  const inner = new THREE.Mesh(
    new THREE.CircleGeometry(1, 36),
    new THREE.MeshBasicMaterial({ color: 0x8fc3ff, transparent: true, opacity: .3, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  inner.rotation.x = -Math.PI / 2;
  ring.renderOrder = 3;
  inner.renderOrder = 4;
  const group = new THREE.Group(); group.name = 'Ball ground indicator';
  group.add(ring, inner);
  group.visible = false;
  group.position.y = 3.6;
  parent.add(group);
  function hide() { if (group.visible) group.visible = false; }
  function update(ball, options = {}) {
    if (!options.enabled || !ball.visible) return hide();
    group.position.set(ball.position.x, 3.6, ball.position.z);
    const height = Math.max(0, ball.position.y - REST_HEIGHT);
    const grown = 1 - Math.min(1, height / MAX_SPAN);
    inner.scale.setScalar(10 + 64 * grown);
    const opacity = .2 + .12 * grown;
    if (Math.abs(inner.material.opacity - opacity) > .004) inner.material.opacity = opacity;
    if (!group.visible) group.visible = true;
  }
  return { update, hide };
}
