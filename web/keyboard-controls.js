import {keyboardBindings as keys,controlSettings} from './player-settings.js';
import {keyboardCodeList} from './input-bindings.js';
export function createKeyboardReader(canvas,{active,paused,onAction}){
 const held=new Set(),axes={throttle:0,steer:0,pitch:0,yaw:0,roll:0};
 const down=name=>keyboardCodeList(keys,name).some(code=>held.has(code));
 const eligible=e=>active()&&!paused()&&!/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target?.tagName??'');
 function press(code,e){
  if(!eligible(e))return;
  const bound=Object.keys(keys).filter(name=>keyboardCodeList(keys,name).includes(code));
  if(!bound.length)return;
  e.preventDefault();if(held.has(code))return;held.add(code);
  for(const name of ['camera','reset','bringBall','takePossession','launchBall','passBall'])if(bound.includes(name))onAction(name);
 }
 window.addEventListener('keydown',e=>press(e.code,e));
 window.addEventListener('keyup',e=>held.delete(e.code));
 canvas.addEventListener('mousedown',e=>{canvas.focus();press('Mouse'+e.button,e);});
 window.addEventListener('mouseup',e=>held.delete('Mouse'+e.button));
 const clearMouse=()=>{for(const code of [...held])if(code.startsWith('Mouse'))held.delete(code);};
 window.addEventListener('blur',clearMouse);
 window.addEventListener('pointercancel',e=>held.delete('Mouse'+e.button));
 canvas.addEventListener('contextmenu',e=>{if(active())e.preventDefault();});
 function clear(){held.clear();for(const k of Object.keys(axes))axes[k]=0;}
 window.addEventListener('blur',clear);document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
 return {clear,held:down,sample(dt=0){
  const directional=down('airRollLeft')||down('airRollRight'),modifier=down('airRoll')&&!directional;
  const target={throttle:Number(down('throttle'))-Number(down('reverse')),steer:Number(down('steerRight'))-Number(down('steerLeft')),pitch:Number(down('pitchUp'))-Number(down('pitchDown')),yaw:modifier?0:Number(down('yawRight'))-Number(down('yawLeft')),roll:directional?Number(down('airRollRight'))-Number(down('airRollLeft')):modifier?Number(down('steerRight'))-Number(down('steerLeft')):0};
  const blend=Math.max(0,Math.min(.25,controlSettings.keyboardBlendTime||0));
  for(const k of Object.keys(axes)){const delta=target[k]-axes[k];axes[k]=blend?axes[k]+Math.sign(delta)*Math.min(Math.abs(delta),dt/blend):target[k];}
  return {...axes,jump:down('jump'),boost:down('boost'),handbrake:down('handbrake'),lookX:Number(down('lookRight'))-Number(down('lookLeft')),lookY:Number(down('lookUp'))-Number(down('lookDown')),camera:down('camera'),rearView:down('rearView')};
 }};
}
