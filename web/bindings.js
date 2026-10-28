import {controlSettings,DEFAULT_CONTROLS,savePlayerSettings,restoreImportedSettings} from './player-settings.js';
import {appendKeyboardSettings,appendControllerTuning} from './control-settings-ui.js';
import {CONTROLLER_BUTTON_ACTIONS,CONTROLLER_DIRECTION_ACTIONS,OPPOSITE_DIRECTIONS,controllerButtonList,controllerDirectionList,normalizeDirectionInput,directionInputKey} from './input-bindings.js';
export const DEFAULT_BINDINGS=DEFAULT_CONTROLS;
export const loadBindings=()=>({...controlSettings});
export const bindings=controlSettings;
export function setupBindings(){
 const panel=document.querySelector('#controls-panel'),rows=document.querySelector('#binding-rows'),status=document.querySelector('#binding-status');
 const labels={throttle:'Accelerate',reverse:'Reverse / brake',jump:'Jump',boost:'Boost',handbrake:'Powerslide',camera:'Ball camera',airRoll:'Air roll modifier',airRollLeft:'Air roll left',airRollRight:'Air roll right',rearView:'Rear view',reset:'Reset training',bringBall:'Dribble setup',takePossession:'Bring ball',launchBall:'Launch ball',passBall:'Pass ball'};
 const directionLabels={steerLeft:'Steer left',steerRight:'Steer right',pitchUp:'Pitch up',pitchDown:'Pitch down',lookLeft:'Look left',lookRight:'Look right',lookUp:'Look up',lookDown:'Look down'};
 const actionLabels={...labels,...directionLabels};
 const names=['A / Cross','B / Circle','X / Square','Y / Triangle','LB / L1','RB / R1','LT / L2','RT / R2','Back / Create','Start / Options','Left stick click','Right stick click','D-pad up','D-pad down','D-pad left','D-pad right','Home'];
 const stickNames=['Left stick X','Left stick Y','Right stick X','Right stick Y'];
 const buttonName=index=>names[index]??`Button ${index}`;
 const inputName=input=>{
  if(input.kind==='button')return buttonName(input.index);
  if(input.index<4){const horizontal=input.index%2===0;return `${stickNames[input.index]} ${horizontal?(input.direction>0?'right':'left'):(input.direction>0?'down':'up')}`;}
  return `Axis ${input.index} ${input.direction>0?'+':'−'}`;
 };
 const save=()=>{status.textContent=savePlayerSettings()?'Saved on this browser.':'Applied for this session; browser storage unavailable.';};
 let capture=null,previous=[],previousAxes=[];
 function beginCapture(kind,action,index,message){
  const pad=Array.from(navigator.getGamepads?.()??[]).find(p=>p?.connected);
  capture={kind,action,index};
  previous=pad?.buttons.map(b=>b.value>.5)??[];
  previousAxes=pad?.axes.slice()??[];
  status.textContent=`${message} for ${actionLabels[action]??action}. Escape cancels.`;
 }
 function finishCapture(input){
  if(!capture)return;
  if(capture.kind==='button'){
   const values=controllerButtonList(bindings,capture.action);
   if(capture.index===null)values.push(input);else values[capture.index]=input;
   bindings[capture.action]=[...new Set(values)];
  }else{
   const values=controllerDirectionList(bindings,capture.action);
   const normalized=normalizeDirectionInput(input);
   if(!normalized)return;
   if(capture.index===null)values.push(normalized);else values[capture.index]=normalized;
   // One direction action should not respond to both directions of the same
   // physical axis: adding one side replaces the other side.
   const filtered=normalized.kind==='axis'?values.filter(value=>value===normalized||!(value.kind==='axis'&&value.index===normalized.index&&value.direction!==normalized.direction)):values;
   const seen=new Set();
   bindings[capture.action]=filtered.filter(value=>{const key=directionInputKey(value);if(seen.has(key))return false;seen.add(key);return true;});
   const opposite=OPPOSITE_DIRECTIONS[capture.action];
   if(opposite){const key=directionInputKey(normalized);bindings[opposite]=controllerDirectionList(bindings,opposite).filter(value=>directionInputKey(value)!==key);}
  }
  const label=actionLabels[capture.action]??capture.action;
  const name=capture.kind==='button'?buttonName(input):inputName(normalizeDirectionInput(input));
  capture=null;render();save();status.textContent=`Bound ${name} to ${label}.`;
 }
 function rowShell(action,label){
  const row=document.createElement('div');row.className='binding-row binding-row-multi';
  const name=document.createElement('span');name.className='binding-name';name.textContent=label;
  const values=document.createElement('div');values.className='binding-values';
  const actions=document.createElement('div');actions.className='binding-actions';
  row.append(name,values,actions);return {row,values,actions};
 }
 function bindingRow(action,label){
  const {row,values,actions}=rowShell(action,label);
  const buttons=controllerButtonList(bindings,action);
  if(!buttons.length){const empty=document.createElement('span');empty.className='binding-empty';empty.textContent='Unassigned';values.append(empty);}
  buttons.forEach((button,index)=>{
   const chip=document.createElement('span');chip.className='binding-chip';
   const value=document.createElement('button');value.type='button';value.className='binding-value';value.textContent=buttonName(button);value.setAttribute('aria-label',`Rebind ${label} from ${buttonName(button)}`);
   value.onclick=()=>beginCapture('button',action,index,'Press a controller button');
   const remove=document.createElement('button');remove.type='button';remove.className='binding-remove';remove.textContent='×';remove.setAttribute('aria-label',`Remove ${buttonName(button)} from ${label}`);
   remove.onclick=()=>{bindings[action]=buttons.filter((_,i)=>i!==index);render();save();status.textContent=`Removed ${buttonName(button)} from ${label}.`;};
   chip.append(value,remove);values.append(chip);
  });
  const add=document.createElement('button');add.type='button';add.textContent='Add';add.setAttribute('aria-label','Add another controller binding for '+label);
  add.onclick=()=>beginCapture('button',action,null,'Press a controller button');
  const clear=document.createElement('button');clear.type='button';clear.textContent='Clear';clear.setAttribute('aria-label','Clear all controller bindings for '+label);
  clear.onclick=()=>{bindings[action]=[];render();save();status.textContent=`Cleared ${label}.`;};
  actions.append(add,clear);return row;
 }
 function directionRow(action,label){
  const {row,values,actions}=rowShell(action,label);
  const inputs=controllerDirectionList(bindings,action);
  if(!inputs.length){const empty=document.createElement('span');empty.className='binding-empty';empty.textContent='Unassigned';values.append(empty);}
  inputs.forEach((input,index)=>{
   const name=inputName(input);
   const chip=document.createElement('span');chip.className='binding-chip';
   const value=document.createElement('button');value.type='button';value.className='binding-value';value.textContent=name;value.setAttribute('aria-label',`Rebind ${label} from ${name}`);
   value.onclick=()=>beginCapture('direction',action,index,'Press a controller button or move a stick/trigger');
   const remove=document.createElement('button');remove.type='button';remove.className='binding-remove';remove.textContent='×';remove.setAttribute('aria-label',`Remove ${name} from ${label}`);
   remove.onclick=()=>{bindings[action]=inputs.filter((_,i)=>i!==index);render();save();status.textContent=`Removed ${name} from ${label}.`;};
   chip.append(value,remove);values.append(chip);
  });
  const add=document.createElement('button');add.type='button';add.textContent='Add';add.setAttribute('aria-label','Add another directional binding for '+label);
  add.onclick=()=>beginCapture('direction',action,null,'Press a controller button or move a stick/trigger');
  const clear=document.createElement('button');clear.type='button';clear.textContent='Clear';clear.setAttribute('aria-label','Clear all directional bindings for '+label);
  clear.onclick=()=>{bindings[action]=[];render();save();status.textContent=`Cleared ${label}.`;};
  actions.append(add,clear);return row;
 }
 function sectionHeading(text){const heading=document.createElement('h3');heading.textContent=text;return heading;}
 function renderControllerBindings(container){
  container.append(sectionHeading('Controller'));
  const hint=document.createElement('p');hint.className='binding-hint';hint.textContent='Each action can have several controller buttons. Analog triggers still provide proportional directional air roll.';container.append(hint);
  for(const action of CONTROLLER_BUTTON_ACTIONS)container.append(bindingRow(action,labels[action]??action));
  container.append(sectionHeading('Directional inputs'));
  const directionHint=document.createElement('p');directionHint.className='binding-hint';directionHint.textContent='Bind each direction separately to any button or axis direction — for example pitch up to left stick up and pitch down to B / Circle.';container.append(directionHint);
  for(const action of CONTROLLER_DIRECTION_ACTIONS)container.append(directionRow(action,directionLabels[action]??action));
  for(const [key,label]of [['invertPitch','Invert air pitch'],['invertLookY','Invert look vertical']]){
   const row=document.createElement('label');row.className='binding-toggle';row.textContent=label;
   const input=document.createElement('input');input.type='checkbox';input.checked=bindings[key];input.onchange=()=>{bindings[key]=input.checked;save();};row.append(input);container.append(row);
  }
 }
 function render(){
  rows.replaceChildren();
  const keyboard=document.createElement('section');keyboard.className='controls-section';appendKeyboardSettings(keyboard,panel,status,save);rows.append(keyboard);
  const controller=document.createElement('section');controller.className='controls-section';renderControllerBindings(controller);appendControllerTuning(controller,save);rows.append(controller);
 }
 render();
 panel.addEventListener('keydown',e=>{if(capture&&e.code==='Escape'){e.preventDefault();e.stopPropagation();capture=null;status.textContent='Binding cancelled.';}},{capture:true});
 document.querySelector('#controls-open').onclick=()=>{panel.showModal();status.textContent='Choose a binding or use Add. Driving pauses while this panel is open.';};
 document.querySelector('#controls-close').onclick=()=>{capture=null;panel.close();};
 panel.addEventListener('cancel',()=>capture=null);
 document.querySelector('#controls-defaults').onclick=()=>{capture=null;restoreImportedSettings();render();document.querySelector('#controller-deadzone').value=bindings.deadzone;if(shape)shape.value=bindings.deadzoneShape;save();};
 const dz=document.querySelector('#controller-deadzone');dz.value=bindings.deadzone;dz.onchange=()=>{if(Number.isFinite(dz.valueAsNumber)){bindings.deadzone=Math.max(0,Math.min(.95,dz.valueAsNumber));save();}};
 const shape=document.querySelector('#deadzone-shape');
 if(shape){shape.value=['circle','cross','square'].includes(bindings.deadzoneShape)?bindings.deadzoneShape:'cross';shape.onchange=()=>{bindings.deadzoneShape=shape.value;save();};}
 panel.addEventListener('close',()=>window.dispatchEvent(new Event('player-controls-applied')));
 function tick(){
  if(!panel.open){requestAnimationFrame(tick);return;}
  const p=Array.from(navigator.getGamepads?.()??[]).find(p=>p?.connected);
  if(p){
   const pressed=p.buttons.map(b=>b.value>.5);
   const axes=p.axes.slice();
   if(capture?.kind==='button'){
    const index=pressed.findIndex((v,i)=>v&&!previous[i]);
    if(index>=0)finishCapture(index);
   }else if(capture?.kind==='direction'){
    const axisIndex=axes.findIndex((v,i)=>Math.abs(v)>.6&&Math.abs(previousAxes[i]??0)<=.6);
    if(axisIndex>=0)finishCapture({kind:'axis',index:axisIndex,direction:Math.sign(axes[axisIndex])});
    else{const buttonIndex=pressed.findIndex((v,i)=>v&&!previous[i]);if(buttonIndex>=0)finishCapture({kind:'button',index:buttonIndex});}
   }
   previous=pressed;previousAxes=axes;
   document.querySelector('#controller-live').textContent=`${p.mapping||'custom'} controller · axes ${p.axes.map(v=>v.toFixed(2)).join(' / ')} · buttons ${pressed.flatMap((v,i)=>v?[i]:[]).join(', ')||'none'}`;
  }else{document.querySelector('#controller-live').textContent='No controller detected. Connect one and press a button.';previous=[];previousAxes=[];}
  requestAnimationFrame(tick);
 }
 requestAnimationFrame(tick);
}
