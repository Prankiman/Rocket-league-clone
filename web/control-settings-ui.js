import {controlSettings as config,keyboardBindings as keys} from './player-settings.js';
import {keyboardCodeList} from './input-bindings.js';
const sessions=new WeakMap();
export const KEYBOARD_LABELS={throttle:'Accelerate',reverse:'Reverse / brake',steerLeft:'Steer left',steerRight:'Steer right',pitchUp:'Pitch up',pitchDown:'Pitch down',yawLeft:'Yaw left',yawRight:'Yaw right',jump:'Jump',boost:'Boost',handbrake:'Powerslide',airRoll:'Air roll modifier',airRollLeft:'Air roll left',airRollRight:'Air roll right',camera:'Ball camera',rearView:'Rear view',reset:'Reset training',bringBall:'Dribble setup',takePossession:'Bring ball',launchBall:'Launch ball',passBall:'Pass ball',lookLeft:'Look left',lookRight:'Look right',lookUp:'Look up',lookDown:'Look down'};

function sectionHeading(text){const heading=document.createElement('h3');heading.textContent=text;return heading;}
function numberRow(label,key,min,max,step){
 const row=document.createElement('label');row.textContent=label;
 const input=document.createElement('input');input.type='number';input.min=min;input.max=max;input.step=step;input.value=config[key];input.id='control-'+key;
 return {row,input};
}

export function appendControllerTuning(container,save){
 container.append(sectionHeading('Controller tuning'));
 for(const [key,label,min,max,step]of [['dodgeDeadzone','Dodge deadzone',.01,1,.01],['steeringSensitivity','Steering sensitivity',1,10,.01],['aerialSensitivity','Aerial sensitivity',1,10,.01],['lookDeadzone','Camera stick deadzone',0,.95,.01]]){
  const {row,input}=numberRow(label,key,min,max,step);
  input.onchange=()=>{if(!Number.isFinite(input.valueAsNumber))return;config[key]=Math.max(min,Math.min(max,input.valueAsNumber));input.value=config[key];save();};
  row.append(input);container.append(row);
 }
}

export function appendKeyboardSettings(container,panel,status,save){
 sessions.get(panel)?.abort();
 const session=new AbortController();sessions.set(panel,session);
 const heading=sectionHeading('Keyboard & mouse');container.append(heading);
 const hint=document.createElement('p');hint.className='binding-hint';hint.textContent='Each action can have several keys or mouse buttons.';container.append(hint);
 const {row:blendRow,input:blend}=numberRow('Keyboard input acceleration (seconds)','keyboardBlendTime',0,.25,.01);
 blend.onchange=()=>{if(!Number.isFinite(blend.valueAsNumber))return;config.keyboardBlendTime=Math.max(0,Math.min(.25,blend.valueAsNumber));blend.value=config.keyboardBlendTime;save();};
 blendRow.append(blend);container.append(blendRow);
 const list=document.createElement('div');list.className='binding-list';container.append(list);
 let capture=null;
 function renderRows(){
  list.replaceChildren();
  for(const [action,label]of Object.entries(KEYBOARD_LABELS)){
   const row=document.createElement('div');row.className='binding-row binding-row-multi';
   const name=document.createElement('span');name.className='binding-name';name.textContent=label;
   const values=document.createElement('div');values.className='binding-values';
   const codes=keyboardCodeList(keys,action);
   if(!codes.length){const empty=document.createElement('span');empty.className='binding-empty';empty.textContent='Unassigned';values.append(empty);}
   codes.forEach((code,index)=>{
    const chip=document.createElement('span');chip.className='binding-chip';
    const value=document.createElement('button');value.type='button';value.className='binding-value';value.textContent=code;value.setAttribute('aria-label',`Rebind ${label} from ${code}`);
    value.onclick=()=>{capture={action,index};status.textContent=`Press a key or mouse button for ${label}. Escape cancels.`;};
    const remove=document.createElement('button');remove.type='button';remove.className='binding-remove';remove.textContent='×';remove.setAttribute('aria-label',`Remove ${code} from ${label}`);
    remove.onclick=()=>{keys[action]=codes.filter((_,i)=>i!==index);renderRows();save();status.textContent=`Removed ${code} from ${label}.`;};
    chip.append(value,remove);values.append(chip);
   });
   const actions=document.createElement('div');actions.className='binding-actions';
   const add=document.createElement('button');add.type='button';add.textContent='Add';add.setAttribute('aria-label','Add another keyboard binding for '+label);
   add.onclick=()=>{capture={action,index:null};status.textContent=`Press a key or mouse button for ${label}. Escape cancels.`;};
   const clear=document.createElement('button');clear.type='button';clear.textContent='Clear';clear.setAttribute('aria-label','Clear all keyboard bindings for '+label);
   clear.onclick=()=>{keys[action]=[];renderRows();save();status.textContent=`Cleared ${label}.`;};
   actions.append(add,clear);row.append(name,values,actions);list.append(row);
  }
 }
 function finish(code){
  if(!capture)return;
  const values=keyboardCodeList(keys,capture.action);
  if(capture.index===null)values.push(code);else values[capture.index]=code;
  keys[capture.action]=[...new Set(values.filter(Boolean))];
  const label=KEYBOARD_LABELS[capture.action]??capture.action;
  capture=null;renderRows();save();status.textContent=`Bound ${code} to ${label}.`;
 }
 renderRows();
 panel.addEventListener('keydown',e=>{
  if(!capture)return;
  e.preventDefault();e.stopPropagation();
  if(e.code==='Escape'){capture=null;status.textContent='Binding cancelled.';}else finish(e.code);
 },{capture:true,signal:session.signal});
 panel.addEventListener('pointerdown',e=>{
  if(!capture)return;
  e.preventDefault();e.stopPropagation();finish('Mouse'+e.button);
 },{capture:true,signal:session.signal});
 panel.addEventListener('contextmenu',e=>e.preventDefault(),{signal:session.signal});
}
