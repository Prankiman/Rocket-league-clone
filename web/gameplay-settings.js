// Gameplay options: game speed (0–200 %) plus on-screen indicator toggles.
// Persisted separately from camera/controls so play sessions never touch saved bindings.
export const GAMEPLAY_DEFAULTS = Object.freeze({ gameSpeed: 100, flipResetIndicator: true, ballArrow: true, ballGroundIndicator: true, boostMode: 'standard' });
const BOOST_MODES = ['standard', 'unlimited'];
export function normalizeGameplay(value = {}) {
  value = value && typeof value === 'object' ? value : {};
  const speed = Number(value.gameSpeed);
  return {
    gameSpeed: Number.isFinite(speed) ? Math.round(Math.max(0, Math.min(200, speed))) : 100,
    flipResetIndicator: value.flipResetIndicator !== false,
    ballArrow: value.ballArrow !== false,
    ballGroundIndicator: value.ballGroundIndicator !== false,
    boostMode: BOOST_MODES.includes(value.boostMode) ? value.boostMode : 'standard',
  };
}
let saved = {};
try { saved = JSON.parse(localStorage.getItem('beckwith.gameplay.v1') || '{}') ?? {}; } catch {}
export const gameplaySettings = normalizeGameplay(saved);
export function saveGameplaySettings() {
  try { localStorage.setItem('beckwith.gameplay.v1', JSON.stringify(gameplaySettings)); } catch {}
  window.dispatchEvent(new Event('gameplay-settings-applied'));
}
// Rows are authored inside #quality-control in index.html; performance-settings.js
// relocates the graphics rows and the #freeplay-controls section into the Settings
// dialog at boot, so Free play options never appear in the camera panel.
// Game speed is a number box paired with a slider; both share the clamped 0–200 range.
export function setupGameplaySettings() {
  const speed = document.querySelector('#game-speed');
  const slider = document.querySelector('#game-speed-slider');
  const flip = document.querySelector('#flip-reset-indicator');
  const arrow = document.querySelector('#ball-arrow-indicator');
  const floor = document.querySelector('#ball-floor-indicator');
  const boost = document.querySelector('#boost-mode');
  if (boost) boost.value = gameplaySettings.boostMode;
  if (!speed) return;
  function applySpeed(value) {
    if (String(value ?? '').trim() === '') { speed.value = String(gameplaySettings.gameSpeed); return; } // cleared field keeps the previous speed
    const number = Number(value);
    if (Number.isFinite(number)) gameplaySettings.gameSpeed = Math.round(Math.max(0, Math.min(200, number)));
    speed.value = String(gameplaySettings.gameSpeed);
    if (slider) slider.value = String(gameplaySettings.gameSpeed);
    saveGameplaySettings(); // Game speed and indicator toggles never rebuild the car.
  }
  applySpeed(gameplaySettings.gameSpeed);
  // Live typing keeps partial values in-range; the change event clamps stragglers.
  speed.addEventListener('input', () => {
    const number = Number(speed.value);
    if (speed.value.trim() === '' || !Number.isFinite(number)) return;
    gameplaySettings.gameSpeed = Math.round(Math.max(0, Math.min(200, number)));
    if (slider) slider.value = String(gameplaySettings.gameSpeed);
    saveGameplaySettings();
  });
  speed.addEventListener('change', () => applySpeed(speed.value));
  if (slider) slider.addEventListener('input', () => applySpeed(slider.value));
  if (flip) flip.checked = gameplaySettings.flipResetIndicator;
  if (arrow) arrow.checked = gameplaySettings.ballArrow;
  if (floor) floor.checked = gameplaySettings.ballGroundIndicator;
  function save() {
    if (flip) gameplaySettings.flipResetIndicator = flip.checked;
    if (arrow) gameplaySettings.ballArrow = arrow.checked;
    if (floor) gameplaySettings.ballGroundIndicator = floor.checked;
    if (boost) gameplaySettings.boostMode = BOOST_MODES.includes(boost.value) ? boost.value : 'standard';
    saveGameplaySettings(); // Game speed and indicator toggles never rebuild the car.
  }
  for (const input of [flip, arrow, floor, boost]) if (input) input.addEventListener('change', save);
}
