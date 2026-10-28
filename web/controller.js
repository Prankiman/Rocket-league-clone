import {bindings} from './bindings.js';
import {controllerButtonList,controllerDirectionList} from './input-bindings.js';
export function deadzone(value,zone=.12){
 zone=Number.isFinite(zone)?Math.max(0,Math.min(.95,zone)):.12;
 if(!Number.isFinite(value)||Math.abs(value)<=zone)return 0;
 return Math.sign(value)*Math.min(1,(Math.abs(value)-zone)/(1-zone));
}
// Steam Input-style deadzone shapes. Circle scales radially; square rescales each
// axis on its own; cross (RL's native shape) zeroes the minor axis inside the arms
// and falls back to the radial curve once both axes clear the deadzone.
export function shapedDeadzone(x,y,shape,zone){
 zone=Number.isFinite(zone)?Math.max(0,Math.min(.95,zone)):.12;
 x=Number.isFinite(x)?x:0;y=Number.isFinite(y)?y:0;
 const ax=Math.abs(x),ay=Math.abs(y);
 if(shape==='circle'){const m=Math.hypot(ax,ay);if(m<=zone||m<1e-9)return[0,0];const scale=Math.min(1,(m-zone)/(1-zone))/m;return[x*scale,y*scale];}
 if(shape==='cross'){
  const engageX=ax>zone,engageY=ay>zone;
  if(!engageX&&!engageY)return[0,0];
  if(!(engageX&&engageY))return engageX?[Math.sign(x)*Math.min(1,(ax-zone)/(1-zone)),0]:[0,Math.sign(y)*Math.min(1,(ay-zone)/(1-zone))];
  const m=Math.hypot(ax,ay),scale=Math.min(1,(m-zone)/(1-zone))/m;return[x*scale,y*scale];}
 return[deadzone(x,zone),deadzone(y,zone)];
}
export function mapController(pad,config=bindings){
 const b=i=>Math.max(0,Math.min(1,pad?.buttons?.[i]?.value??0));
 const pressed=i=>b(i)>.5;
 const list=action=>controllerButtonList(config,action);
 const anyPressed=action=>list(action).some(pressed);
 const strength=action=>Math.max(0,...list(action).map(i=>clamp01(pad?.buttons?.[i]?.value)));
 const shape=['circle','cross','square'].includes(config.deadzoneShape)?config.deadzoneShape:'cross';
 // Directional actions can mix buttons and individual axis directions. Each
 // binding contributes only while pushed in its bound direction; the strongest
 // contribution wins, then both sides are combined into a signed axis value.
 const directionStrength=action=>{
  let best=0;
  for(const input of controllerDirectionList(config,action)){
   if(input.kind==='button'){if(pressed(input.index))best=1;continue;}
   const raw=Number(pad?.axes?.[input.index]);
   if(Number.isFinite(raw))best=Math.max(best,Math.max(0,raw*input.direction));
  }
  return Math.min(1,best);
 };
 const signed=(positive,negative)=>Math.max(-1,Math.min(1,directionStrength(positive)-directionStrength(negative)));
 // Directional air roll reads its bound control's raw value: analog triggers (LT/RT)
 // stay proportional, so half a trigger is half the roll speed. Digital buttons read 0/1.
 const leftRoll=strength('airRollLeft'),rightRoll=strength('airRollRight');
 // Directional roll keeps yaw available, including shared modifier bindings.
 // A flicker threshold keeps resting triggers from engaging the roll channel.
 const directional=leftRoll>.02||rightRoll>.02,modifier=anyPressed('airRoll')&&!directional;
 const scaled=(value,sensitivity)=>Math.max(-1,Math.min(1,value*(Number.isFinite(sensitivity)?sensitivity:1)));
 const [steer,pitchRaw]=shapedDeadzone(signed('steerRight','steerLeft'),signed('pitchUp','pitchDown'),shape,config.deadzone);
 const y=pitchRaw*(config.invertPitch?-1:1);
 const [lookX,lookYRaw]=shapedDeadzone(signed('lookRight','lookLeft'),signed('lookDown','lookUp'),shape,config.lookDeadzone??config.deadzone);
 return {throttle:strength('throttle')-strength('reverse'),steer:scaled(steer,config.steeringSensitivity),pitch:scaled(y,config.aerialSensitivity),yaw:modifier?0:scaled(steer,config.aerialSensitivity),roll:directional?Math.max(-1,Math.min(1,rightRoll-leftRoll)):modifier?scaled(steer,config.aerialSensitivity):0,
  jump:anyPressed('jump'),boost:anyPressed('boost'),handbrake:anyPressed('handbrake'),
  lookX:lookX,lookY:lookYRaw*(config.invertLookY?1:-1),
  camera:anyPressed('camera'),rearView:anyPressed('rearView'),reset:anyPressed('reset'),bringBall:anyPressed('bringBall'),takePossession:anyPressed('takePossession'),launchBall:anyPressed('launchBall'),passBall:anyPressed('passBall')};
}
function clamp01(value){const number=Number(value);return Number.isFinite(number)?Math.max(0,Math.min(1,number)):0;}
export function createControllerReader(){
 let previous=mapController(null),lastIndex=null,resetStarted=0;
 return function read(){
  const pads=Array.from(navigator.getGamepads?.()??[]).filter(p=>p?.connected);
  const pad=!new URLSearchParams(location.search).has('keyboardOnly')&&document.hasFocus()&&!document.querySelector('#controls-panel')?.open&&!document.querySelector('#camera-settings')?.open?pads[0]:null;
  const input=mapController(pad);
  if(pad?.index!==lastIndex)previous=mapController(null);
  const now=performance.now();if(input.reset&&!previous.reset)resetStarted=now;
  const resetPressed=bindings.resetPressType==='tap'?Boolean(pad&&!input.reset&&previous.reset&&now-resetStarted<=(bindings.tapTime??.5)*1000):input.reset&&!previous.reset;
  const result={...input,cameraPressed:input.camera&&!previous.camera,resetPressed,bringBallPressed:input.bringBall&&!previous.bringBall,takePossessionPressed:input.takePossession&&!previous.takePossession,launchBallPressed:input.launchBall&&!previous.launchBall,passBallPressed:input.passBall&&!previous.passBall,
   connected:Boolean(pad),status:pad?'Controller connected':pads.length?'Focus viewer / standard mapping required':'Connect controller, then press a button'};
  previous=input;lastIndex=pad?.index??null;return result;
 };
}
