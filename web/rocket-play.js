import * as THREE from 'three';
import {geometryLoader} from './geometry-loader.js';
import {PhysicsSimulation} from './soccer/physics/simulation.js';
import {resolvePhysicsSelection} from './soccer/physics/presets.js';
import {PhysicsClock} from './soccer/physics/clock.js';
import {createControllerReader} from './controller.js';
import {bindings} from './bindings.js';
import {createKeyboardReader} from './keyboard-controls.js';
import {setupCameraSettings} from './camera-settings-ui.js';
import {loadCameraBoundary} from './camera-obstruction.js';
import {setCameraVisibility} from './camera-visibility.js';
import {keepCameraAboveGround} from './chase-ground.js';
import {createCameraContact} from './camera-contact.js';
import {updateNetBall} from './recovered-net.js';
import {createRecoveredVehicle,prepareVehicleGeometry} from './recovered-vehicles.js';
import {loadOriginalFennec} from './original-fennec.js';
import {createOriginalBoost} from './original-boost.js';
import {createVehicleEffects} from './vehicle-effects.js';
import {createGoalExplosion} from './goal-explosion.js';
import {createGoalPhysics} from './goal-physics.js';
import {MatchDriver} from './match-driver.js';
import {getGameAudio} from './audio.js';
import {createBallArrow} from './ball-arrow.js';
import {createFlipResetDisc} from './flip-reset.js';
import {createBallIndicator} from './ball-indicator.js';import {gameplaySettings} from './gameplay-settings.js';
import {optimizeSceneUniforms} from './compact-uniforms.js';
import {setGameplayPostEffects} from './gameplay-postfx.js';
import {createAimMap,aimCollisionMeshes,AIM_CAR_SPAWN,AIM_HIT_PLANE,AIM_TARGET_BOUNDS,AIM_GOAL,AIM_PLATFORM_TOP} from './aim-map.js';
// Uses the supplied Car Soccer runtime. No custom collision/vehicle solver here.
export async function createPlay(scene,camera,canvas){
 const sim=new PhysicsSimulation(resolvePhysicsSelection('?physics=experimental&hitbox=octane','fennec'));
 let training=null;
 let loadedMap='stock';
 const loader=geometryLoader();
 const [originalCar,ballAsset,ballMaterial,,cameraBoundary]=await Promise.all([loadOriginalFennec(),loader.loadAsync('./assets/original/ball/Ball_DefaultBall00.gltf'),createRecoveredVehicle('Ball'),sim.init(),loadCameraBoundary()]);
 sim.dodgeDeadzone=bindings.dodgeDeadzone;sim.configureCars('fennec',false,0);
 // Boost pickups: unlimited or standard pads-only.
 const boostModeSelect=document.querySelector('#boost-mode');
 function applyBoostMode(){const mode=gameplaySettings.boostMode;sim.setUnlimitedBoost(training?true:mode==='unlimited');if(boostModeSelect)boostModeSelect.value=mode;}
 applyBoostMode();
 window.addEventListener('gameplay-settings-applied',applyBoostMode);
 const root=new THREE.Group();root.scale.setScalar(.01);scene.add(root);
 const car=originalCar;root.add(car);
 const wheels=car.userData.wheels??[];
 const ball=ballAsset.scene;ball.name='Rocket League ball';ball.updateMatrixWorld(true);
 let radius=0;
 ball.traverse(n=>{if(n.isMesh){n.geometry=prepareVehicleGeometry(n.geometry.clone());n.material=ballMaterial;n.castShadow=true;const a=n.geometry.attributes.position;for(let i=0;i<a.count;i++){const v=new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(n.matrixWorld);radius=Math.max(radius,v.length());}}});
 // Visual radius is 92.75 uu; RocketSim collision radius is separately 91.25 uu.
 ball.scale.multiplyScalar(92.75/radius);root.add(ball);
 canvas.dataset.ballAsset='Ball_Default.Meshes.Ball_DefaultBall00';canvas.dataset.vehicleSurfaces='body,chassis,ball';
 const padData=sim.getPads(),padMatrix=new THREE.Matrix4(),padVisibility=new Array(padData.length);
 const pads=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),new THREE.MeshBasicMaterial({color:0xffbe35}),padData.length);
 pads.name='Instanced boost pickup indicators';pads.frustumCulled=false;root.add(pads);
 const shadowMaterial=new THREE.MeshBasicMaterial({color:0x101811,transparent:true,opacity:.25,depthWrite:false});
 const shadows=[75,95].map(r=>{const s=new THREE.Mesh(new THREE.CircleGeometry(r,24),shadowMaterial);s.rotation.x=-Math.PI/2;root.add(s);return s;});
 // Aim trainer target: a flat square slightly larger than the ball, mounted on
 // the compact training wall. Coco's map uses the same simple square hitbox.
 const AIM_TARGET_SIZE=230,aimTarget=new THREE.Group();
 const aimTargetMaterial=new THREE.MeshBasicMaterial({color:0xffc93a,toneMapped:false,side:THREE.DoubleSide});
 const aimTargetGlow=new THREE.MeshBasicMaterial({color:0xffc93a,transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false});
 const aimGlow= new THREE.Mesh(new THREE.PlaneGeometry(AIM_TARGET_SIZE*1.45,AIM_TARGET_SIZE*1.45),aimTargetGlow);
 aimGlow.position.z=.6;
 const aimFace=new THREE.Mesh(new THREE.PlaneGeometry(AIM_TARGET_SIZE,AIM_TARGET_SIZE),aimTargetMaterial);
 const aimBorder=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(AIM_TARGET_SIZE,AIM_TARGET_SIZE)),new THREE.LineBasicMaterial({color:0xffffff,toneMapped:false}));
 aimBorder.position.z=.8;
 aimTarget.add(aimGlow,aimFace,aimBorder);aimTarget.rotation.y=Math.PI;aimTarget.position.set(0,1500,1398);aimTarget.visible=false;root.add(aimTarget);
 // Compact aim bay built as a standalone box away from the soccar pitch.
 const aimMap=createAimMap();aimMap.group.visible=false;root.add(aimMap.group);
 let environment={arena:[],scenery:[],ground:null};
 function applyEnvironment(){
  const hide=active&&Boolean(training);
  for(const node of environment.arena??[])node.visible=!hide;
  for(const node of environment.scenery??[])node.visible=!hide;
  if(environment.ground)environment.ground.visible=!hide;
 }
 function applyTrainingVisuals(){
  aimMap.group.visible=Boolean(active&&training?.type==='aim');
  aimTarget.visible=Boolean(active&&training?.type==='aim');
  applyEnvironment();
 }
 const boostEffect=await createOriginalBoost();car.add(boostEffect.object);
 const [vehicleEffects,goalEffect]=await Promise.all([createVehicleEffects(scene,car,camera,sim.carConfigs[0]),createGoalExplosion(scene)]);
 const goalPhysics=await createGoalPhysics(sim),goalPosition=new THREE.Vector3();
 const settings=setupCameraSettings(()=>{sim.resetView();});
 const clock=new PhysicsClock(sim,{ballOffset:4});
 // Game speed scales wall-clock time before it reaches the accumulator, so 120 Hz
 // physics, interpolation, camera and bots all share one variable-rate timeline.
 const audio=getGameAudio(),ballArrow=createBallArrow(root),ballIndicator=createBallIndicator(root),flipReset=createFlipResetDisc(car,()=>{if(gameplaySettings.flipResetIndicator)audio.flipReset();});
  let scaledNow=performance.now(),rawLast=scaledNow;
 const speedOf=()=>{const number=Number(gameplaySettings.gameSpeed);return Number.isFinite(number)?Math.max(0,Math.min(2,number/100)):1;};
 let keyboard;const hud=document.querySelector('#play-hud');
 const controllerStatus=document.querySelector('#controller-status');
 const cameraLook=new THREE.Vector3();let lastHUD='';
 const readController=createControllerReader();let gamepad=readController();
 let userPaused=false,previewGarage=false,previewAngle=0,opponent=null,opponentBoost=null,opponentEffects=null,opponentShadow=null,api;
 const opponentState=new Float32Array(sim.state.length);
 let active=false,ballCam=settings.ballCam,score=[0,0],goalUntil=0,spin=0,lastThrottle=0,lastSteer=0,steerVisual=0;
 const basis=new THREE.Matrix4(),f=new THREE.Vector3(),r=new THREE.Vector3(),u=new THREE.Vector3();
 const view=new Float64Array(32);
 function vector(s,o){return new THREE.Vector3(s[o],s[o+2],s[o+1]);}
 function syncObject(object,s,o){object.position.copy(vector(s,o));f.copy(vector(s,o+3));r.copy(vector(s,o+6));u.copy(vector(s,o+9));object.quaternion.setFromRotationMatrix(basis.makeBasis(f,u,r));}
 const match=new MatchDriver(sim,padData,{
  onKickoff(){keyboard?.clear();setCameraVisibility(camera,null);clock.sync(scaledNow);goalUntil=0;lastThrottle=0;ball.visible=true;car.visible=true;vehicleEffects.reset();goalEffect.reset();goalPhysics.reset();boostEffect.reset();opponentEffects?.reset();opponentBoost?.reset();sync();},
  onGoal(sign,flag){score[flag===1?0:1]++;goalUntil=1;const gs=sim.state;goalPosition.set(gs[4],gs[6],gs[5]).multiplyScalar(.01);goalEffect.trigger(sign,goalPosition);goalPhysics.trigger(sign,gs);audio.goal();ball.visible=false;},
  onEnd(state){api.setPaused(true);api.onMatchEnd?.(state);},
  onError(message){api.setPaused(true);api.onError?.(message);}
 });
 function reset(){
  if(training?.type==='aim')return resetAim(true);
  match.resetKickoff();
 }
 async function loadOpponent(){
  if(opponent)return;
  const model=await loadOriginalFennec(),boost=await createOriginalBoost();model.add(boost.object);
  const effects=await createVehicleEffects(scene,model,camera,sim.carConfigs[0]);
  opponent=model;opponentBoost=boost;opponentEffects=effects;opponent.visible=false;root.add(opponent);
  opponentShadow=shadows[0].clone();opponentShadow.visible=false;root.add(opponentShadow);optimizeSceneUniforms(scene);
 }
 // ---------------------------------------------------------------------------
 // Training modes
 // ---------------------------------------------------------------------------
 function placeCar(position,forward=[0,1,0],right=[-1,0,0],up=[0,0,1]){
  sim.setCarState(0,{position,forward,right,up,boost:100});
 }
 function aimPlaceTarget(){
  // Targets can land anywhere on the wall, but slightly favour the goal mouth
  // and lower backboard where most useful shots are hit.
  const inGoal=Math.random()<.6;
  const x=inGoal
   ?(Math.random()*2-1)*(AIM_GOAL.halfWidth-AIM_TARGET_SIZE/2-28)
   :(Math.random()*2-1)*AIM_TARGET_BOUNDS.x;
  const z=inGoal
   ?1275+Math.random()*(AIM_GOAL.top-AIM_TARGET_SIZE/2-1275-12)
   :AIM_TARGET_BOUNDS.zMin+Math.random()*(AIM_TARGET_BOUNDS.zMax-AIM_TARGET_BOUNDS.zMin);
  training.target={x,z,size:AIM_TARGET_SIZE};
  aimTarget.position.set(x,z,1398);
  aimTargetMaterial.color.set(0xffc93a);aimTargetGlow.color.set(0xffc93a);
  aimTarget.scale.setScalar(1);
 }
 function aimDropBall(){
  const x=(Math.random()*2-1)*1850;
  const y=-700+Math.random()*1300;
  const z=1650+Math.random()*450;
  sim.setBallState([x,y,z],[0,0,-45]);
  training.prevBall=[x,y,z];
  training.repStart=sim.state[0];
  training.waiting=true;training.resetIn=0;
 }
 function startAim(){
  training={type:'aim',hits:0,streak:0,best:0,waiting:false,resetIn:0,carResetIn:0,announce:'',announceTime:0,target:{x:0,z:1500,size:AIM_TARGET_SIZE},prevBall:[0,0,1960]};
  sim.setUnlimitedBoost(true);
  placeCar(AIM_CAR_SPAWN);
  aimPlaceTarget();aimDropBall();applyTrainingVisuals();
 }
 function resetAim(reposition=false){
  if(training?.type!=='aim')return;
  if(reposition){placeCar(AIM_CAR_SPAWN);training.streak=0;training.carResetIn=0;}
  aimPlaceTarget();aimDropBall();
 }
 function aimMiss(reason){
  if(!training?.waiting)return;
  training.waiting=false;training.streak=0;training.resetIn=.75;
  training.announce=reason;training.announceTime=.85;
 }
 function aimHit(){
  training.waiting=false;training.hits++;training.streak++;training.best=Math.max(training.best,training.streak);
  training.resetIn=.9;training.announce=`TARGET HIT · ${training.streak} STREAK`;training.announceTime=1.1;
  aimTargetMaterial.color.set(0x75ff7d);aimTargetGlow.color.set(0x75ff7d);aimTarget.scale.setScalar(1.16);
  audio.event('go',{gain:.55});
 }
 function tickAim(dt){
  if(!training||training.type!=='aim')return;
  const s=sim.state,ball=[s[4],s[5],s[6]],previous=training.prevBall;
  if(training.waiting){
   if(ball[1]>=AIM_HIT_PLANE&&previous[1]<AIM_HIT_PLANE&&ball[1]>=previous[1]){
    const t=(AIM_HIT_PLANE-previous[1])/Math.max(1e-6,ball[1]-previous[1]);
    const hitX=previous[0]+(ball[0]-previous[0])*t,hitZ=previous[2]+(ball[2]-previous[2])*t;
    // The ball's surface can touch the target even when its centre is outside
    // the painted square, so include the ball radius in the hit test.
    const reach=training.target.size/2+Math.max(0,(sim.ballRadius??91.25)-8);
    if(Math.abs(hitX-training.target.x)<=reach&&Math.abs(hitZ-training.target.z)<=reach)aimHit();
    else aimMiss('MISS');
   } else if(
    ball[2]<950||
    (ball[2]<AIM_PLATFORM_TOP+125&&Math.hypot(s[16],s[17],s[18])<80)||
    Math.abs(ball[0])>2800||ball[1]<-1900||ball[1]>1600||
    (s[0]-training.repStart)>10*120
   )aimMiss('MISS');
  }
  if(training.carResetIn>0){training.carResetIn-=dt;if(training.carResetIn<=0)placeCar(AIM_CAR_SPAWN);}
  else if(s[24]<700||Math.abs(s[22])>2800||s[23]<-2300||s[23]>1600){
   training.carResetIn=.6;training.streak=0;training.announce='RESET';training.announceTime=.8;
  }
  if(training.resetIn>0){training.resetIn-=dt;if(training.resetIn<=0){placeCar(AIM_CAR_SPAWN);aimPlaceTarget();aimDropBall();}}
  training.prevBall=ball;
  if(training.announceTime>0)training.announceTime-=dt;
 }
 function tickTraining(dt){
  if(training?.type==='aim')tickAim(dt);
 }
 function animateTraining(visDt,now){
  if(training?.type==='aim'&&aimTarget.visible){
   const idle=1+Math.sin(now*.004)*.014;
   if(training.waiting)aimTarget.scale.setScalar(idle);
   else aimTarget.scale.lerp(new THREE.Vector3(1,1,1),Math.min(1,visDt*8));
  }
 }
 // Native event serials inside the car state block; increasing values mark new events.
 const carEvents={armed:false,tick:0,flipReset:0,jump:0,dodge:0,double:0,hit:0,hitTick:-1e9,land:0,opHit:0,demo:0,opDemo:0};
 const rearmCarEvents=s=>Object.assign(carEvents,{armed:true,tick:s[0],flipReset:s[47],jump:s[63],dodge:s[64],double:s[65],hit:s[68],hitTick:s[0],land:s[66],opHit:s[119],demo:s[43],opDemo:s[94]});
 function sync(){const s=sim.state;syncObject(car,s,22);syncObject(ball,s,4);car.visible=s[43]!==1;
  for(let i=0;i<wheelHitboxes.length;i++){const {disc,wheel}=wheelHitboxes[i];disc.position.y=wheel.connectionXYZ[2]-s[wheelStateOffset+i*3];}
  if(!carEvents.armed||s[0]<carEvents.tick||s[47]<carEvents.flipReset||s[63]<carEvents.jump||s[64]<carEvents.dodge||s[65]<carEvents.double||s[68]<carEvents.hit||s[66]<carEvents.land||s[119]<carEvents.opHit)rearmCarEvents(s);
  else{
   // Ball resets only: a real flip reset arrives the same physics tick the wheels
   // touch the ball, so grant the indicator while a car-ball contact is fresh
   // (within ~6 ticks); ceiling and wall resets leave the hit serial untouched.
   flipReset.update(s,{enabled:gameplaySettings.flipResetIndicator&&active,ballReset:s[0]-carEvents.hitTick<=6});
   if(s[63]!==carEvents.jump){if(active)audio.event('jump',{gain:.75});carEvents.jump=s[63];}
   if(s[64]!==carEvents.dodge||s[65]!==carEvents.double){if(active)audio.event('dodge',{gain:.7});carEvents.dodge=s[64];carEvents.double=s[65];}
   if(s[66]!==carEvents.land&&s[41]===1){const impact=s[67];if(impact>300&&active)audio.event('land',{gain:Math.max(.3,Math.min(1,impact/2300))});carEvents.land=s[66];}
   if(s[68]!==carEvents.hit){if(active)audio.ballHit(s[69]);carEvents.hit=s[68];carEvents.hitTick=s[0];}
   if(match.mode==='offline'){
    if(s[119]!==carEvents.opHit){if(active)audio.ballHit(s[120],.5);carEvents.opHit=s[119];}
    if(s[94]!==carEvents.opDemo){if(active)audio.event(s[94]===1?'demo':'demoWhoosh',{gain:s[94]===1?.8:.5});carEvents.opDemo=s[94];}
   }else carEvents.opDemo=s[94];
   if(s[43]!==carEvents.demo){if(active)audio.event(s[43]===1?'demo':'demoWhoosh',{gain:s[43]===1?.9:.55});carEvents.demo=s[43];}
  }
  if(opponent){opponent.visible=active&&match.mode==='offline'&&s[94]!==1;opponentShadow.visible=opponent.visible;if(opponent.visible){syncObject(opponent,s,73);opponentShadow.position.set(opponent.position.x,3,opponent.position.z);}}shadows[0].position.set(car.position.x,3,car.position.z);shadows[1].position.set(ball.position.x,3,ball.position.z);shadows[1].visible=ball.visible;ballIndicator.update(ball,{enabled:gameplaySettings.ballGroundIndicator&&active});
  updateNetBall(s[4],s[5],s[6]);
  let padsChanged=false;
  for(let i=0;i<padData.length;i++){const visible=s[430+i*2]!==0;if(padVisibility[i]===visible)continue;
   const picked=Boolean(padVisibility[i]&&!visible);padVisibility[i]=visible;const p=padData[i],radius=visible?(p.isBig?24:7):0;
   padMatrix.makeScale(radius,radius,radius).setPosition(p.pos[0],p.isBig?75:14,p.pos[1]);pads.setMatrixAt(i,padMatrix);padsChanged=true;
   if(picked&&active){const audioNear=Math.min(Math.hypot(p.pos[0]-s[22],p.pos[1]-s[23]),opponent&&match.mode==='offline'?Math.hypot(p.pos[0]-s[73],p.pos[1]-s[74]):1e9);audio.pad(p.isBig,Math.max(.25,1-audioNear/2300));}
  }
  if(padsChanged)pads.instanceMatrix.needsUpdate=true;
 }
 function ballAction(action){if(!active||userPaused||match.mode!=='freeplay')return;keyboard?.clear();goalUntil=0;match.goalTicks=0;ball.visible=true;goalEffect.reset();goalPhysics.reset();vehicleEffects.reset();boostEffect.reset();sim.controlBall(0,action);clock.sync(scaledNow);sync();document.querySelector('#freeplay-status').textContent={takePossession:'Ball placed ahead of the car.',startDribble:'Dribble setup ready.',passBall:'Pass sent toward your car.',launchBall:'Ball launched.'}[action];canvas.focus();}
 for(const button of document.querySelectorAll('[data-ball-action]'))button.onclick=()=>ballAction(button.dataset.ballAction);
 document.querySelector('#freeplay-kickoff').onclick=()=>{reset();canvas.focus();};
 const paused=()=>userPaused||Boolean(document.querySelector('dialog[open]'));
 for(const panel of document.querySelectorAll('dialog'))panel.addEventListener('close',()=>{clock.sync(scaledNow);canvas.focus();});
 keyboard=createKeyboardReader(canvas,{active:()=>active,paused,onAction:action=>{
  if(action==='camera'){if(settings.toggleBallCam)ballCam=!ballCam;}
  else if(action==='reset'){if(match.mode==='freeplay'||training)reset();}
  else ballAction({bringBall:'startDribble',takePossession:'takePossession',launchBall:'launchBall',passBall:'passBall'}[action]);
 }});
 window.addEventListener('blur',()=>clock.sync(scaledNow));
 function controls(){const k=keyboard.sample(clock.dt);const input={throttle:k.throttle||gamepad.throttle,steer:k.steer||gamepad.steer,pitch:k.pitch||gamepad.pitch,yaw:k.yaw||gamepad.yaw,roll:k.roll||gamepad.roll,jump:k.jump||gamepad.jump,boost:k.boost||gamepad.boost,handbrake:k.handbrake||gamepad.handbrake};const result=effectChecks?effectChecks.controls(input):input;lastThrottle=result.throttle;lastSteer=result.steer;return result;}
 window.addEventListener('player-controls-applied',()=>{if(sim.dodgeDeadzone!==bindings.dodgeDeadzone){sim.dodgeDeadzone=bindings.dodgeDeadzone;sim.configureCars('fennec',false,0);if(match.mode==='offline')sim.addCar(1,'default');applyBoostMode();reset();}});
 const cfg=sim.carConfigs[0],hitbox=new THREE.Group();hitbox.name='Hitbox visualization';hitbox.visible=false;
 const bodyHitbox=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(cfg.fullSize[0],cfg.fullSize[2],cfg.fullSize[1])),new THREE.LineBasicMaterial({color:0x70ffff,depthTest:false}));
 bodyHitbox.position.set(cfg.offset[0],cfg.offset[2],cfg.offset[1]);bodyHitbox.renderOrder=100;hitbox.add(bodyHitbox);
 // Native wheels are 2D discs in the same plane as the wheel (normal along the
 // axle), centred on the suspension hub. Keep their height in sync with the
 // native suspension state and steer the front pair with the visual wheels.
 const wheelStateOffset=22+26;
 const wheelDiscMaterial=new THREE.MeshBasicMaterial({color:0xffd84a,transparent:true,opacity:.3,depthTest:false,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
 const wheelRimMaterial=new THREE.LineBasicMaterial({color:0xffd84a,depthTest:false,transparent:true,opacity:.95});
 const wheelHitboxes=cfg.wheels.map(wheel=>{
  const disc=new THREE.Mesh(new THREE.CircleGeometry(wheel.radius,32),wheelDiscMaterial);
  disc.renderOrder=100;disc.frustumCulled=false;
  const points=[];for(let i=0;i<32;i++){const a=i/32*Math.PI*2;points.push(new THREE.Vector3(Math.cos(a)*wheel.radius,Math.sin(a)*wheel.radius,0));}
  const rim=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),wheelRimMaterial);
  rim.renderOrder=100;rim.frustumCulled=false;disc.add(rim);
  disc.position.set(wheel.connectionXYZ[0],0,wheel.connectionXYZ[1]);hitbox.add(disc);
  return {disc,wheel};
 });
 car.add(hitbox);
 document.querySelector('#show-hitbox').onchange=e=>hitbox.visible=e.target.checked;
 const contactNormal=createCameraContact(cameraBoundary,cfg),cameraGroundNormal=new THREE.Vector3(0,1,0);let contactTick=-1;
 const cameraAnchor=new THREE.Vector3(),cameraAim=new THREE.Vector3(),cameraDirection=new THREE.Vector3(),carUp=new THREE.Vector3(),carForward=new THREE.Vector3();let lastCameraReport=0;
 canvas.dataset.physicsProfile=JSON.stringify({engine:'RocketSim',steeringSensitivity:bindings.steeringSensitivity,aerialSensitivity:bindings.aerialSensitivity,controllerDeadzone:bindings.deadzone,deadzoneShape:bindings.deadzoneShape,dodgeDeadzone:sim.dodgeDeadzone,hitbox:cfg,visualBallRadius:92.75,collisionBallRadius:sim.ballRadius});
 reset();
 const effectChecks=new URLSearchParams(location.search).has('effectsChecks')?(await import('./effect-checks.js')).createEffectChecks(sim,reset):null;
 const cameraChecks=new URLSearchParams(location.search).has('cameraChecks')?(await import('./camera-checks.js')).createCameraChecks(sim):null;
 api={get active(){return active},get boost(){return sim.state[40]},get ballCam(){return ballCam},get matchState(){return match.session.state},get celebrating(){return !!goalUntil},get unlimitedBoost(){return Boolean(training)||gameplaySettings.boostMode==='unlimited'},get trainingState(){
   if(!training)return null;
   return {type:'aim',hits:training.hits,streak:training.streak,best:training.best,announce:training.announceTime>0?training.announce:''};
  },reset,
 setEnvironment(next){environment=next??environment;applyEnvironment();},
 setPaint(paint){car.userData.bodyMaterial.userData.setPaint(paint);},
 async start(mode,botId,orangePaint){
   const map=mode==='aim'?'aim':'stock';
   if(map!==loadedMap){
    training=null;applyTrainingVisuals();
    await sim.switchMap(map==='aim'?aimCollisionMeshes():[]);
    loadedMap=map;
   }
  training=null;applyTrainingVisuals();
  await match.start(mode,botId);applyBoostMode();score=[0,0];
  if(mode==='offline')await loadOpponent();
  if(opponent&&orangePaint)opponent.userData.bodyMaterial.userData.setPaint(orangePaint);
  if(mode==='aim')startAim();
  active=true;userPaused=false;root.visible=true;pads.visible=mode==='freeplay'||mode==='offline';ball.visible=true;shadows.forEach(n=>n.visible=true);shadows[1].visible=ball.visible;audio.setActive(true);
  applyTrainingVisuals();setGameplayPostEffects(vehicleEffects,goalEffect,true);clock.sync(scaledNow);canvas.focus();sync();
 },
 setPaused(value){userPaused=value;match.setPaused(value);keyboard?.clear();clock.sync(scaledNow);if(value)audio.reset();},
 leave(){training=null;match.leave();api.setActive(false);api.preview(false);applyTrainingVisuals();audio.reset();ballArrow.hide();ballIndicator.hide();flipReset.hide();},
 mapOnly(){root.visible=false;pads.visible=false;car.visible=false;ball.visible=false;shadows.forEach(n=>n.visible=false);},
 preview(garage=false){previewGarage=garage;root.visible=true;car.visible=true;ball.visible=false;pads.visible=false;shadows[1].visible=false;if(opponent)opponent.visible=false;if(opponentShadow)opponentShadow.visible=false;aimMap.group.visible=false;aimTarget.visible=false;applyEnvironment();car.position.set(0,17,-2500);car.quaternion.identity();shadows[0].position.set(0,3,-2500);shadows[0].visible=true;api.updatePreview(0);},
 updatePreview(dt){if(active)return;previewAngle+=dt*.08;car.rotation.y=previewGarage?Math.sin(previewAngle)*.18:0;camera.up.set(0,1,0);camera.fov=42;camera.position.set(3.5,1.8,-22.5);camera.lookAt(-1,.4,-24);camera.updateProjectionMatrix();},
 setActive(value){active=value;userPaused=false;setCameraVisibility(camera,null);setGameplayPostEffects(vehicleEffects,goalEffect,value);keyboard?.clear();hud.hidden=!value;if(value){match.paused=false;reset();pads.visible=true;canvas.focus();rawLast=performance.now();audio.setActive(true);}else{training=null;applyTrainingVisuals();vehicleEffects.reset();goalEffect.reset();goalPhysics.reset();boostEffect.reset();opponentEffects?.reset();opponentBoost?.reset();audio.reset();audio.setActive(false);ballArrow.hide();ballIndicator.hide();flipReset.hide();}clock.sync(scaledNow);},
 update(dt){if(!active)return;
  // Game speed: real frame deltas stretch into the virtual clock so physics,
  // interpolation, camera smoothing and bots share one variable-rate timeline.
  const gameSpeed=speedOf(),now=performance.now();
  scaledNow+=Math.max(0,now-rawLast)*gameSpeed;rawLast=now;
  const visDt=dt*gameSpeed;
  if(paused()){keyboard?.clear();clock.sync(scaledNow);audio.reset();ballArrow.hide();ballIndicator.hide();flipReset.hide();return;}
  gamepad=readController();if(controllerStatus.textContent!==gamepad.status)controllerStatus.textContent=gamepad.status;
  if(settings.toggleBallCam){if(gamepad.cameraPressed)ballCam=!ballCam;}else ballCam=gamepad.camera||keyboard.held('camera');
  if(gamepad.resetPressed&&(match.mode==='freeplay'||training))reset();
  if(gamepad.bringBallPressed)ballAction('startDribble');
  if(gamepad.takePossessionPressed)ballAction('takePossession');if(gamepad.launchBallPressed)ballAction('launchBall');if(gamepad.passBallPressed)ballAction('passBall');
  if(!cameraChecks)clock.update(scaledNow,()=>sim.setControls(0,controls()),()=>{
   if(!match.tick())return false;
   goalPhysics.update(clock.dt);
   tickTraining(clock.dt);
   // Sample moving attachments at every 120 Hz physics tick, including turns,
   // air rolls and the celebration. Render frequency must not change trails.
   syncObject(car,sim.state,22);vehicleEffects.update(clock.dt,sim.state);
   boostEffect.update(clock.dt,sim.state[45]===1,Math.abs(lastThrottle)>.01);
   if(opponent&&match.mode==='offline'){
    syncObject(opponent,sim.state,73);opponentState.set(sim.state);opponentState.copyWithin(22,73,124);
    opponentEffects.update(clock.dt,opponentState);opponentBoost.update(clock.dt,sim.state[96]===1,Math.abs(match.bot?.controls.throttle??0)>.01);
   }
   return true;
  });
  if(cameraChecks){ballCam=cameraChecks.apply().ballCam;clock.sync(scaledNow);}
  sync();if(goalUntil)ball.position.copy(goalPosition).multiplyScalar(100);animateTraining(visDt,now);const s=sim.state;goalEffect.update(visDt);car.userData.chassisMaterial.userData.nativeScalars.BoostGlowIntensity=s[45]===1?1:0;if(opponent&&match.mode==='offline'){opponent.userData.chassisMaterial.userData.nativeScalars.BoostGlowIntensity=s[96]===1?1:0;for(const wheel of opponent.userData.wheels)wheel.rotation.z-=vector(s,85).length()*visDt/15;}const speed=vector(s,34).length();spin+=speed*visDt/15;steerVisual+=(lastSteer-steerVisual)*Math.min(1,visDt*12);const steerAngle=-steerVisual*.45;for(let i=0;i<wheels.length;i++){const wheel=wheels[i];if(wheel.userData.front)wheel.rotation.y=steerAngle;wheel.rotation.z=-spin;if(wheelHitboxes[i]&&wheel.userData.front)wheelHitboxes[i].disc.rotation.y=steerAngle;}
  if(s[41]===1&&(contactTick!==s[0]||cameraChecks)){contactNormal(car,s,cameraGroundNormal);contactTick=s[0];}
  view[0]=Math.min(visDt,.05);view[1]=ballCam?1:0;view.set(car.position.toArray(),2);view.set(car.quaternion.toArray(),5);view.set(ball.position.toArray(),9);view[12]=15;view[13]=s[41];view.set(cameraGroundNormal.toArray(),14);view.set(vector(s,34).toArray(),17);view[20]=s[42];
  const kview=keyboard.sample(0);view.set([settings.fov,settings.distance,settings.height,settings.angle,settings.stiffness,settings.transitionSpeed,camera.aspect,kview.lookX||gamepad.lookX,kview.lookY||gamepad.lookY,settings.swivelSpeed,settings.invertSwivel?1:0],21);
  const v=sim.stepView(view);camera.position.set(v[32]/100,v[33]/100,v[34]/100);camera.up.set(v[38],v[39],v[40]).normalize();
  carUp.set(0,1,0).applyQuaternion(car.quaternion);carForward.set(1,0,0).applyQuaternion(car.quaternion);
  cameraAnchor.copy(car.position).multiplyScalar(.01).addScaledVector(carUp,.22);
  cameraDirection.set(v[35],v[36],v[37]).normalize();cameraAim.copy(camera.position).addScaledVector(cameraDirection,Math.max(.2,camera.position.distanceTo(cameraAnchor)));
  if(gamepad.rearView||kview.rearView){camera.position.copy(car.position).multiplyScalar(.01).addScaledVector(carForward,settings.distance*.01).addScaledVector(carUp,settings.height*.01);cameraAim.copy(cameraAnchor);}
  if(camera.fov!==v[41]){camera.fov=v[41];camera.updateProjectionMatrix();}
  cameraDirection.subVectors(cameraAim,camera.position).normalize();
  if(Math.abs(cameraDirection.dot(camera.up))>.98)camera.up.copy(carUp);if(Math.abs(cameraDirection.dot(camera.up))>.98)camera.up.set(0,0,1);
  if(settings.shake&&s[45]===1){camera.position.addScaledVector(camera.up,Math.sin(now*.09)*.012);}
  const floorLift=keepCameraAboveGround(camera,cameraAim);camera.lookAt(cameraAim);
  if(cameraChecks)vehicleEffects.update(visDt,s);
  const exteriorPlane=cameraBoundary.exteriorPlane(cameraAnchor,camera.position);setCameraVisibility(camera,exteriorPlane);
  if(now-lastCameraReport>500){canvas.dataset.cameraState=JSON.stringify({ballCam,grounded:s[41]===1,wall:s[41]===1&&Math.abs(cameraGroundNormal.y)<.7,surfaceNormal:cameraGroundNormal.toArray(),position:camera.position.toArray(),car:car.position.clone().multiplyScalar(.01).toArray(),forward:carForward.toArray(),up:carUp.toArray(),floorLift,exteriorCut:exteriorPlane?.toArray()??null,look:[view[28],view[29]]});lastCameraReport=now;}

  // Engine and boost loops run on the scaled timeline too.
  audio.update(visDt,{speed:speed,boost:s[45]===1,throttle:lastThrottle,grounded:s[41]===1,supersonic:s[42]===1,demoed:s[43]===1,active:true});
  ballArrow.update(camera,ball.position,car,{enabled:gameplaySettings.ballArrow,visible:ball.visible});
  const hudText=`Fennec · RocketSim 120 Hz · ${score[0]}:${score[1]} · Boost ${boostModeSelect?.value==='unlimited'?'∞':Math.floor(s[40])} · ${Math.round(speed*.036)} km/h${gameSpeed!==1?` · Speed ${Math.round(gameSpeed*100)}%`:''} · ${ballCam?'Ball cam':'Car cam'}${goalUntil?' · GOAL!':''}`;
  if(hudText!==lastHUD){hud.textContent=hudText;lastHUD=hudText;}
 }};
 if(new URLSearchParams(location.search).has('debugPlay'))window.__beckwith={sim,match,clock,api,car,ball,audio,camera,scene};
 return api;
}

