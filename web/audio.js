// Game audio mixer. Bundled Rocket League sound files under ./assets/audio/
// (see assets/audio/README.md) mix through per-category GainNodes so the Audio
// dialog controls feel like the classic Rocket League audio mixer.
const SOUND_FILES = {
  engineIdle: './assets/audio/engines/SFX_Motor_OctaneMK2_0005.ogg',
  engineRun: './assets/audio/engines/SFX_Motor_OctaneMK2_0008.ogg',
  boostLoop: './assets/audio/boosts/SFX_Boost_Standard_0003.ogg',
  boostStart: './assets/audio/boosts/SFX_Boost_Standard_0001.ogg',
  // The upstream SFX_Ball folder only holds one clean decaying ring; per spectral
  // screening the SFX_Impacts set supplies the weak low thuds car-ball contacts need.
  ballLight: './assets/audio/impacts/SFX_Impacts_0217.ogg',
  ball: './assets/audio/impacts/SFX_Impacts_0001.ogg',
  ballStrong: './assets/audio/impacts/SFX_Impacts_0055.ogg',
  supersonic: './assets/audio/engines/SFX_VehicleElements_0004.ogg',
  jump: './assets/audio/movements/SFX_Car_Movements_0001.ogg',
  land: './assets/audio/movements/SFX_Car_Movements_0013.ogg',
  dodge: './assets/audio/movements/SFX_Car_Movements_0015.ogg',
  demo: './assets/audio/knockouts/SFX_Knockout_0002.ogg',
  demoWhoosh: './assets/audio/knockouts/SFX_Knockout_0001.ogg',
  goalExplosion: './assets/audio/goal-explosions/SFX_GoalExplosion_NewDefault_0001.ogg',
  goalStinger: './assets/audio/goal-events/SFX_GoalEvent_0005.ogg',
  goalStingerAlt: './assets/audio/goal-events/SFX_GoalEvent_0002.ogg',
  count: './assets/audio/ui/SFX_UI_Countdown_0001.ogg',
  go: './assets/audio/ui/SFX_UI_Countdown_0002.ogg',
  uiSelect: './assets/audio/ui/SFX_UI_MainMenu_0002.ogg',
  uiMove: './assets/audio/ui/SFX_UI_MainMenu_0006.ogg',
  uiBack: './assets/audio/ui/SFX_UI_MainMenu_0003.ogg',
  uiPause: './assets/audio/ui/SFX_UI_InGame_0006.ogg',
  uiUnpause: './assets/audio/ui/SFX_UI_InGame_0016.ogg',
  uiPing: './assets/audio/ui/SFX_UI_MainMenu_0004.ogg',
  padSmall: './assets/audio/ui/SFX_UI_Boost_0002.ogg',
  padBig: './assets/audio/ui/SFX_UI_Boost_0001.ogg',
};
const CATEGORIES = ['master', 'engine', 'boost', 'ball', 'impacts', 'goal', 'ui'];
const SOUND_CATEGORY = {
  engineIdle: 'engine', engineRun: 'engine', supersonic: 'engine',
  boostLoop: 'boost', boostStart: 'boost', padSmall: 'boost', padBig: 'boost',
  ball: 'ball', ballLight: 'ball', ballStrong: 'ball', jump: 'impacts', land: 'impacts',
  dodge: 'impacts', demo: 'impacts', demoWhoosh: 'impacts', goalExplosion: 'goal', goalStinger: 'goal',
  goalStingerAlt: 'goal', count: 'ui', go: 'ui', uiSelect: 'ui', uiMove: 'ui', uiBack: 'ui',
  uiPause: 'ui', uiUnpause: 'ui', uiPing: 'ui',
};
const DEFAULT_VOLUMES = { master: 1, engine: .9, boost: .85, ball: 1, impacts: .9, goal: 1, ui: .7 };
const clamp = (value, low, high) => Math.max(low, Math.min(high, Number.isFinite(Number(value)) ? Number(value) : low));

let singleton = null;
let volumeGetter = null;

// Decoding happens once per sound; browsers without OGG support yield null buffers and the game stays silent.
async function loadBuffer(context, url) {
  try { return await context.decodeAudioData(await (await fetch(url)).arrayBuffer()); }
  catch (error) { console.warn(`Audio: ${url} not decodable (${error?.message ?? error})`); return null; }
}

function loopLayer(context, buffer, bus) {
  const source = context.createBufferSource(), gain = context.createGain();
  source.buffer = buffer; source.loop = true;
  gain.gain.value = 0;
  source.connect(gain).connect(bus);
  source.start();
  // written* tracks the last values pushed to AudioParams so idle frames skip
  // scheduling no-op automation events at 60 Hz.
  return { source, gain, smooth: 0, writtenGain: 0, writtenRate: 1 };
}

function oneShot(context, bus, buffer, { gain = 1, rate = 1, when = 0 } = {}) {
  if (!buffer || gain <= 0 || context.state === 'closed') return;
  const source = context.createBufferSource(), envelope = context.createGain();
  source.buffer = buffer;
  source.playbackRate.value = rate;
  envelope.gain.setValueAtTime(gain, context.currentTime + when);
  source.connect(envelope).connect(bus);
  const start = context.currentTime + when + .001;
  source.start(start);
  source.stop(start + buffer.duration / Math.max(.25, rate) + .05);
}

function stub() {
  const nothing = () => {};
  return Object.fromEntries(['update', 'setActive', 'setVolumes', 'ballHit', 'pad', 'event', 'goal', 'count', 'go',
    'flipReset', 'ui', 'reset'].map(name => [name, nothing]));
}

function createAudio() {
  if (typeof AudioContext !== 'function') return stub();
  const context = new AudioContext();
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -10; compressor.knee.value = 24; compressor.ratio.value = 6;
  compressor.connect(context.destination);
  const buses = {}; for (const name of CATEGORIES) buses[name] = context.createGain();
  // Category outputs sum into the master volume bus, which feeds the clip-safe compressor.
  for (const name of CATEGORIES) if (name !== 'master') buses[name].connect(buses.master);
  buses.master.connect(compressor);
  const volumes = { ...DEFAULT_VOLUMES };
  // The master bus starts closed. Nothing can reach the compressor until the
  // persisted mixer table has been supplied through setVolumes(), so a first
  // frame can never leak a default-volume engine or UI sound.
  let volumesArmed = false;
  function applyBusGains() {
    for (const name of CATEGORIES) {
      buses[name].gain.value = name === 'master' ? (volumesArmed ? volumes.master : 0) : volumes[name];
    }
  }
  applyBusGains();
  // Browsers hold a pristine AudioContext suspended until the first user gesture.
  const resume = () => context.resume();
  window.addEventListener('pointerdown', resume, { passive: true });
  window.addEventListener('keydown', resume, { passive: true });
  // One-shots decode lazily on first use (cached promise), so booting the menu no
  // longer competes with 20+ OGG decodes while the arena and car are still loading.
  const bufferPromises = {};
  function buffer(name) {
    const url = SOUND_FILES[name];
    if (!url) return Promise.resolve(null);
    return bufferPromises[name] ??= loadBuffer(context, url);
  }
  const LOOP_KEYS = ['engineIdle', 'engineRun', 'supersonic', 'boostLoop'];
  const loops = {};
  let loopsRequested = false, warmed = false;
  function warmOneShots() {
    if (warmed) return;
    warmed = true;
    const idle = typeof requestIdleCallback === 'function'
      ? (run, options) => requestIdleCallback(run, options)
      : (run) => setTimeout(run, 400);
    idle(() => {
      // Latency-sensitive gameplay sounds only; rare menu/goal cues stay fully lazy.
      for (const name of ['ballLight', 'ball', 'ballStrong', 'jump', 'land', 'dodge', 'padSmall', 'padBig']) void buffer(name);
    }, { timeout: 3000 });
  }
  function startLoops() {
    if (loopsRequested) return;
    loopsRequested = true;
    // Decode the whole engine bed first. Starting layers piecemeal makes the
    // car fade in with only part of its loop set while the rest is still loading.
    Promise.all(LOOP_KEYS.map(async key => [key, await buffer(key)])).then(entries => {
      if (context.state === 'closed') return;
      for (const [key, audio] of entries) {
        if (audio && loops[key] === undefined) loops[key] = loopLayer(context, audio, buses[SOUND_CATEGORY[key]]);
      }
    });
    warmOneShots();
  }
  let lastPad = 0, lastBall = 0;
  return {
    setActive(value) { if (value) startLoops(); },
    update(dt, snapshot = {}) {
      if (!loopsRequested) return; // Menu idle: no mixer work before play starts.
      const t = clamp((snapshot.speed ?? 0) / 2300, 0, 1), throttle = clamp(Math.abs(snapshot.throttle ?? 0), 0, 1);
      const engineOn = snapshot.active && !snapshot.demoed ? 1 : 0;
      const supersonic = Boolean(snapshot.supersonic);
      const easing = Math.max(0, Math.min(1, (dt ?? 0) * 14));
      for (const key of LOOP_KEYS) {
        const layer = loops[key]; if (!layer) continue;
        let target, rate;
        if (key === 'engineIdle') {
          target = engineOn * (.06 + .16 * throttle + .08 * t); rate = .72 + .35 * t;
        } else if (key === 'engineRun') {
          target = engineOn * Math.max(0, (t - .15) / .85) * (.35 + .45 * throttle);
          rate = .62 + 1.18 * t + (snapshot.grounded ? .16 * throttle : .02 * throttle);
        } else if (key === 'supersonic') {
          // Deafening high-speed jet loop: swells in at the supersonic crossover.
          target = engineOn && supersonic ? .8 : 0; rate = 1 + .06 * Math.max(0, t - 1) + (supersonic ? .04 : 0);
        } else {
          target = snapshot.boost ? .75 : 0; rate = 1 + (supersonic ? .12 : 0);
        }
        layer.smooth += (target - layer.smooth) * easing;
        const gain = layer.smooth < .0005 ? 0 : layer.smooth;
        if (Math.abs(gain - layer.writtenGain) > .0005) { layer.gain.gain.value = gain; layer.writtenGain = gain; }
        if (Math.abs(rate - layer.writtenRate) > .0005) { layer.source.playbackRate.value = rate; layer.writtenRate = rate; }
      }
    },
    ballHit(speed, scale = 1) {
      const now = performance.now(); if (now - lastBall < 90) return; lastBall = now;
      // Weak low thuds: a soft deep bump for faint touches, a clean short thump for
      // medium contact and a heavier boom for real impacts, each slightly detuned.
      const tier = speed < 650 ? 'ballLight' : speed < 1900 ? 'ball' : 'ballStrong';
      const rate = speed < 650 ? 1 + Math.random() * .05 : speed < 1900 ? .97 + Math.random() * .05 : .93 + Math.random() * .04;
      const strength = speed < 650 ? clamp(.4 + speed / 650 * .3, 0, .7) : speed < 1900 ? clamp(.55 + speed / 1900 * .35, 0, .95) : clamp(.65 + speed / 4600 * .35, 0, 1);
      void buffer(tier).then(data => oneShot(context, buses.ball, data, { gain: strength * clamp(scale, 0, 1), rate }));
    },
    pad(isBig, scale = 1) {
      const now = performance.now(); if (now - lastPad < 80) return; lastPad = now;
      void buffer(isBig ? 'padBig' : 'padSmall').then(data => oneShot(context, buses.boost, data, { gain: clamp(scale, 0, 1) * (isBig ? .8 : .45) }));
    },
    event(name, { gain = 1, rate = 1 } = {}) {
      void buffer(name).then(data => oneShot(context, buses[SOUND_CATEGORY[name] ?? 'impacts'], data, { gain, rate }));
    },
    goal() {
      void buffer('goalExplosion').then(data => oneShot(context, buses.goal, data, { gain: .95 }));
      const stinger = Math.random() < .5 ? 'goalStinger' : 'goalStingerAlt';
      void buffer(stinger).then(data => oneShot(context, buses.goal, data, { gain: .8, when: .12 }));
    },
    count() { void buffer('count').then(data => oneShot(context, buses.ui, data, { gain: .85 })); },
    go() { void buffer('go').then(data => oneShot(context, buses.ui, data, { gain: .95 })); },
    flipReset() { void buffer('uiPing').then(data => oneShot(context, buses.ui, data, { gain: .7, rate: 1.22 })); },
    ui(name = 'select') {
      const mapping = { select: 'uiSelect', back: 'uiBack', move: 'uiMove', pause: 'uiPause', unpause: 'uiUnpause' };
      void buffer(mapping[name] ?? 'uiSelect').then(data => oneShot(context, buses.ui, data, { gain: name === 'move' ? .55 : .8, rate: name === 'back' ? .95 : 1 }));
    },
    // The slider table stays authoritative: apply it immediately instead of polling
    // the getter every frame (the latter also restored defaults after setVolumes).
    // This is also what arms the master bus after the persisted mixer settings load.
    setVolumes(next) {
      volumesArmed = true;
      const source = next ?? DEFAULT_VOLUMES;
      for (const name of CATEGORIES) volumes[name] = clamp(source?.[name] ?? DEFAULT_VOLUMES[name], 0, 1);
      applyBusGains();
    },
    reset() {
      for (const layer of Object.values(loops)) { if (!layer) continue; layer.smooth = 0; layer.writtenGain = 0; layer.gain.gain.value = 0; }
    },
  };
}

export function getGameAudio() {
  if (singleton) return singleton;
  try { singleton = createAudio(); } catch (error) { console.warn('Audio unavailable:', error); singleton = stub(); }
  if (volumeGetter) singleton.setVolumes(volumeGetter());
  return singleton;
}

// Volume controls look at the persisted mixer table instead of owning state.
export function bindAudioVolumes(getter) {
  if (typeof getter !== 'function') return;
  volumeGetter = getter;
  singleton?.setVolumes(getter());
}
