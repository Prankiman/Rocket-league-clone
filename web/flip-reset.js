import * as THREE from 'three';

// Flip reset indicator: the physics core raises FLIP_RESET_SERIAL when the car
// gains a reset from the ball. The disc pops briefly on the car underside, then
// clears after half a second.
const CAR = 22, FLIP_RESET = 25, ON_GROUND = 19, DEMOED = 21;
const DISC_RADIUS = 140, UNDERSIDE = 36, VISIBLE_MS = 500;
function discTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  gradient.addColorStop(0, 'rgba(255,255,255,.75)');
  gradient.addColorStop(.45, 'rgba(255,255,255,.48)');
  gradient.addColorStop(.75, 'rgba(255,255,255,.2)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}
export function createFlipResetDisc(car, onAward) {
  const material = new THREE.MeshBasicMaterial({ map: discTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(DISC_RADIUS, 40), material);
  disc.rotation.x = -Math.PI / 2;
  disc.renderOrder = 4;
  disc.frustumCulled = false;
  disc.visible = false;
  car.add(disc);
  let lastTick = -1, lastSerial = 0, firstSample = true;
  let available = false, awardAt = 0;
  function hide() { available = false; if (disc.visible) disc.visible = false; }
  function update(state, options = {}) {
    const tick = state[0], serial = state[CAR + FLIP_RESET];
    const grounded = state[CAR + ON_GROUND] === 1, demoed = state[CAR + DEMOED] === 1;
    if (options.enabled === false || firstSample || tick < lastTick) {
      // Fresh arena, rewound replay or disabled toggle: re-baseline without firing.
      firstSample = false; lastTick = tick; lastSerial = serial; hide();
      return false;
    }
    lastTick = tick;
    let awarded = false;
    if (serial > lastSerial) {
      if (!grounded && !demoed && car.visible) {
        awarded = true; available = true;
        awardAt = performance.now();
      }
    } else if (serial < lastSerial) hide();
    lastSerial = serial;
    // The indicator is a short confirmation flash, not a persistent reset timer.
    if (available && (demoed || performance.now() - awardAt >= VISIBLE_MS)) hide();
    disc.visible = available;
    if (available) {
      // Hug the car's underside and breathe; the pop lands within the first .3 s.
      const age = performance.now() - awardAt;
      disc.position.set(0, -UNDERSIDE, 0);
      disc.scale.setScalar((age < 300 ? .82 + .18 * age / 300 : 1) * (1 + Math.sin(age * .004) * .03));
    }
    if (awarded) onAward?.();
    return awarded;
  }
  return { update, hide, reset() { firstSample = true; hide(); }, get visible() { return disc.visible; } };
}
