// Bindings are stored as arrays so one action can be triggered by several
// keys/buttons. Older saves used a single string/number, which is upgraded here.

export const KEYBOARD_ACTIONS = [
  'throttle', 'reverse', 'steerLeft', 'steerRight',
  'pitchUp', 'pitchDown', 'yawLeft', 'yawRight',
  'jump', 'boost', 'handbrake', 'airRoll', 'airRollLeft', 'airRollRight',
  'camera', 'rearView', 'reset',
  'bringBall', 'takePossession', 'launchBall', 'passBall',
  'lookLeft', 'lookRight', 'lookUp', 'lookDown',
];

export const CONTROLLER_BUTTON_ACTIONS = [
  'throttle', 'reverse', 'jump', 'boost', 'handbrake', 'camera',
  'airRoll', 'airRollLeft', 'airRollRight', 'rearView', 'reset',
  'bringBall', 'takePossession', 'launchBall', 'passBall',
];

// Directional actions accept both buttons and individual axis directions, e.g.
// pitchUp = left-stick-Y up, pitchDown = B / Circle.
export const CONTROLLER_DIRECTION_ACTIONS = [
  'steerLeft', 'steerRight', 'pitchUp', 'pitchDown',
  'lookLeft', 'lookRight', 'lookUp', 'lookDown',
];

export const OPPOSITE_DIRECTIONS = {
  steerLeft: 'steerRight', steerRight: 'steerLeft',
  pitchUp: 'pitchDown', pitchDown: 'pitchUp',
  lookLeft: 'lookRight', lookRight: 'lookLeft',
  lookUp: 'lookDown', lookDown: 'lookUp',
};

const LEGACY_AXIS_MIGRATION = {
  steerAxis: [['steerLeft', -1], ['steerRight', 1]],
  pitchAxis: [['pitchUp', 1], ['pitchDown', -1]],
  lookXAxis: [['lookLeft', -1], ['lookRight', 1]],
  lookYAxis: [['lookUp', -1], ['lookDown', 1]],
};

export function bindingList(value) {
  return Array.isArray(value) ? value : value == null || value === '' || value === -1 ? [] : [value];
}

export function keyboardCodeList(bindings, action) {
  return bindingList(bindings?.[action]).filter(code => typeof code === 'string' && code.length > 0);
}

export function controllerButtonList(bindings, action) {
  return bindingList(bindings?.[action])
    .map(Number)
    .filter(index => Number.isInteger(index) && index >= 0);
}

export function normalizeDirectionInput(value) {
  if(value && typeof value === 'object') {
    const index = Number(value.index);
    if(!Number.isInteger(index) || index < 0) return null;
    if(value.kind === 'axis') return {kind:'axis', index, direction:Number(value.direction) < 0 ? -1 : 1};
    if(value.kind === 'button') return {kind:'button', index};
    return null;
  }
  if(typeof value === 'string') {
    const axis = /^axis:(\d+):(-?1)$/.exec(value);
    if(axis) return {kind:'axis', index:Number(axis[1]), direction:Number(axis[2]) < 0 ? -1 : 1};
    const button = /^button:(\d+)$/.exec(value);
    if(button) return {kind:'button', index:Number(button[1])};
  }
  const index = Number(value);
  return Number.isInteger(index) && index >= 0 ? {kind:'button', index} : null;
}

export function controllerDirectionList(bindings, action) {
  return bindingList(bindings?.[action]).map(normalizeDirectionInput).filter(Boolean);
}

export function directionInputKey(input) {
  return input.kind === 'axis' ? `axis:${input.index}:${input.direction}` : `button:${input.index}`;
}

function uniqueList(values) {
  return [...new Set(values)];
}

function uniqueInputs(values) {
  const seen = new Set();
  return values.filter(value => {
    const key = directionInputKey(value);
    if(seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeKeyboardBindings(source) {
  const next = {...source};
  for (const action of KEYBOARD_ACTIONS) next[action] = uniqueList(keyboardCodeList(source, action));
  return next;
}

export function normalizeControllerBindings(source) {
  const next = {...source};
  for (const action of CONTROLLER_BUTTON_ACTIONS) next[action] = uniqueList(controllerButtonList(source, action));

  const hasDirectionBindings = CONTROLLER_DIRECTION_ACTIONS.some(action => bindingList(source?.[action]).length > 0);
  if(!hasDirectionBindings) {
    for (const action of CONTROLLER_DIRECTION_ACTIONS) next[action] = [];
    for (const [legacy, groups] of Object.entries(LEGACY_AXIS_MIGRATION)) {
      for (const axis of controllerButtonList(source, legacy)) {
        for (const [action, direction] of groups) next[action].push({kind:'axis', index:axis, direction});
      }
    }
  }
  for (const action of CONTROLLER_DIRECTION_ACTIONS) next[action] = uniqueInputs(controllerDirectionList(next, action));
  for (const legacy of Object.keys(LEGACY_AXIS_MIGRATION)) delete next[legacy];
  return next;
}

export function copyBindings(target, source) {
  for (const key of Object.keys(source)) {
    const value = source[key];
    target[key] = Array.isArray(value) ? value.map(item => item && typeof item === 'object' ? {...item} : item) : value;
  }
  return target;
}
