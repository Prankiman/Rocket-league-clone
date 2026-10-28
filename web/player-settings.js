import {importedProfile} from './imported-player-settings.js';
import {normalizeControllerBindings,normalizeKeyboardBindings,copyBindings} from './input-bindings.js';
const key='beckwith.playerSettings.v1';
export const DEFAULT_CAMERA={...importedProfile.camera};
export const DEFAULT_CONTROLS=normalizeControllerBindings({...importedProfile.bindings,resetPressType:'tap',tapTime:.5});
export const DEFAULT_KEYBOARD=normalizeKeyboardBindings(importedProfile.keyboard);
let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}');}catch{}
export const cameraSettings={...DEFAULT_CAMERA,...saved.camera};
export const keyboardBindings=normalizeKeyboardBindings({...DEFAULT_KEYBOARD,...saved.keyboard});
export const controlSettings=normalizeControllerBindings({...DEFAULT_CONTROLS,...saved.controls});
export function savePlayerSettings(){
 try{localStorage.setItem(key,JSON.stringify({camera:cameraSettings,keyboard:keyboardBindings,controls:controlSettings,importedFrom:'beckwith-lightweight-v1'}));return true;}catch{return false;}
}
export function restoreImportedSettings(){
 Object.assign(cameraSettings,DEFAULT_CAMERA);copyBindings(keyboardBindings,DEFAULT_KEYBOARD);copyBindings(controlSettings,DEFAULT_CONTROLS);
 savePlayerSettings();window.dispatchEvent(new Event('player-settings-imported'));
}
if(!saved.importedFrom){try{const previous=localStorage.getItem('beckwith.controls.v1');if(previous&&!localStorage.getItem('beckwith.controls.before-game-import'))localStorage.setItem('beckwith.controls.before-game-import',previous);}catch{}savePlayerSettings();}
