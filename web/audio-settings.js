import {bindAudioVolumes, getGameAudio} from './audio.js';
const CATEGORIES = [['master', 'Master volume'], ['engine', 'Engine'], ['boost', 'Boost'], ['ball', 'Ball'], ['impacts', 'Impacts'], ['goal', 'Goal & stingers'], ['ui', 'UI & countdown']];
export const AUDIO_DEFAULTS = Object.freeze({ master: 1, engine: .9, boost: .85, ball: 1, impacts: .9, goal: 1, ui: .7 });
export function normalizeAudio(value = {}) {
  value = value && typeof value === 'object' ? value : {};
  const result = {};
  for (const [key, fallback] of Object.entries(AUDIO_DEFAULTS)) {
    const number = Number(value[key]);
    result[key] = Number.isFinite(number) ? Math.round(Math.max(0, Math.min(1, number)) * 100) / 100 : fallback;
  }
  return result;
}
let saved = {};
try { saved = JSON.parse(localStorage.getItem('beckwith.audio.v1') || '{}') ?? {}; } catch {}
export const audioSettings = normalizeAudio(saved);
export function saveAudioSettings() {
  try { localStorage.setItem('beckwith.audio.v1', JSON.stringify(audioSettings)); } catch {}
}
bindAudioVolumes(() => audioSettings);
export function setupAudioSettings() {
  const panel = document.querySelector('#audio-settings'), rows = document.querySelector('#mixer-rows');
  if (!panel || !rows) return;
  const sliders = [];
  function render() {
    rows.replaceChildren();
    for (const [key, label] of CATEGORIES) {
      const row = document.createElement('div'); row.className = 'mixer-row';
      const name = document.createElement('label'); name.textContent = label; name.htmlFor = 'mixer-' + key;
      const slider = document.createElement('input');
      slider.id = 'mixer-' + key; slider.type = 'range'; slider.min = '0'; slider.max = '1'; slider.step = '.05';
      slider.value = String(audioSettings[key]); slider.setAttribute('aria-label', label);
      const value = document.createElement('output'); value.className = 'mixer-value'; value.textContent = Math.round(audioSettings[key] * 100) + '%';
      row.append(name, slider, value); rows.append(row); sliders.push({ key, slider, value });
    }
  }
  render();
  rows.addEventListener('input', event => {
    const entry = sliders.find(item => item.slider === event.target);
    if (!entry) return;
    audioSettings[entry.key] = Math.round(Math.max(0, Math.min(1, Number(event.target.value) || 0)) * 100) / 100;
    entry.value.textContent = Math.round(audioSettings[entry.key] * 100) + '%';
    saveAudioSettings();
    bindAudioVolumes(() => audioSettings); // Bridges the slider straight into the mixer.
  });
  document.querySelector('#audio-open').onclick = () => panel.showModal();
  document.querySelector('#audio-close').onclick = () => panel.close();
  document.querySelector('#audio-test').onclick = () => getGameAudio().event('ball', { gain: .9 });
  document.querySelector('#audio-reset').onclick = () => {
    Object.assign(audioSettings, AUDIO_DEFAULTS); saveAudioSettings(); render();
    bindAudioVolumes(() => audioSettings);
  };
  for (const type of ['keydown', 'pointerdown']) panel.addEventListener(type, event => event.stopPropagation());
}
