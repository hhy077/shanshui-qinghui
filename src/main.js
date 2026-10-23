import * as THREE from 'three';
import {Birds} from './birds.js';
import {Soundscape} from './audio.js';
import {vertexShader,waterFragment,paperFragment} from './shaders.js';

const $=s=>document.querySelector(s);
const viewport=$('#viewport'),canvas=$('#painting'),sound=new Soundscape();
const qualityNames={fine:'精细',balanced:'均衡',light:'轻盈'};
const state={ready:false,time:0,zoom:1,quality:localStorage.getItem('shanshui-quality')||'fine',ripples:[],lastInputRipple:-1,disturbed:0};
if(!qualityNames[state.quality])state.quality='fine';
let renderer,scene,camera,water,birds,maskPixels,maskWidth,maskHeight,baseWidth,baseHeight;
let lastTime=0,animationTime=0,rippleIndex=0;
const target={x:8,y:4.5},pointers=new Map();let gesture=null;
const raycaster=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,0,1),0);
const rippleUniform=Array.from({length:12},()=>new THREE.Vector4(0,0,-100,0));
let toastTimer;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2600);}
function onError(error){
  console.error('[山水清晖] 交互画面启动失败',error);
  clearTimeout(window.__shanshuiBootWatchdog);
  $('#loader').hidden=true;
  $('#load-error-detail').textContent=/WebGL/i.test(`${error?.name||''} ${error?.message||''}`)
    ?'此浏览器或设备未开放 WebGL 图形加速。完整画作仍可欣赏，请在系统浏览器中开启硬件加速后重试。'
    :'交互组件或画面素材加载失败。完整画作仍可欣赏，请检查网络后刷新，或使用最新版 Chrome、Edge、Safari。';
  $('#load-error').hidden=false;
}
async function texture(path,color=true){const t=await new THREE.TextureLoader().loadAsync(path);if(color)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;}
async function initialize(){
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  renderer.setClearColor(0xeeeade,1);renderer.outputColorSpace=THREE.SRGBColorSpace;
  scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-8,8,4.5,-4.5,.1,100);camera.position.set(8,4.5,20);
  const [art,mask,reflection]=await Promise.all([texture('./assets/landscape.webp'),texture('./assets/water-mask.png',false),texture('./assets/reflection.png')]);
  const image=mask.image;maskWidth=image.width;maskHeight=image.height;
  const sampling=document.createElement('canvas');sampling.width=maskWidth;sampling.height=maskHeight;
  const ctx=sampling.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);maskPixels=ctx.getImageData(0,0,maskWidth,maskHeight).data;
  const geometry=new THREE.PlaneGeometry(16,9);
  const paper=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:art}));paper.position.set(8,4.5,0);scene.add(paper);
  water=new THREE.Mesh(geometry,new THREE.ShaderMaterial({vertexShader,fragmentShader:waterFragment,uniforms:{uArt:{value:art},uMask:{value:mask},uReflection:{value:reflection},uTime:{value:0},uRipples:{value:rippleUniform}},transparent:true,depthWrite:false}));
  water.position.set(8,4.5,.05);scene.add(water);
  const paperVeil=new THREE.Mesh(geometry,new THREE.ShaderMaterial({vertexShader,fragmentShader:paperFragment,transparent:true,depthWrite:false}));
  paperVeil.position.set(8,4.5,.15);scene.add(paperVeil);
  birds=new Birds(scene,{ripple:addRipple,sound});
  await document.fonts.load('40px InkKai');
  createInscription();resize();bindControls();
  state.ready=true;document.documentElement.dataset.shanshuiReady='true';clearTimeout(window.__shanshuiBootWatchdog);viewport.classList.add('is-ready','is-unrolling');$('#load-error').hidden=true;$('#loader').classList.add('leaving');setTimeout(()=>{ $('#loader').hidden=true;viewport.classList.remove('is-unrolling'); },2350);
  renderer.setAnimationLoop(render);
  // Read-only inspection interface for interaction QA, coordinate probes and screenshots.
  window.__SHANSHUI={
    get state(){return {...state,ripples:state.ripples.map(r=>({...r})),birds:birds.snapshot(),skyCount:birds.sky.length,sound:sound.enabled,audioState:sound.context?.state||'uninitialized',audioCalls:sound.calls,audioRms:sound.rms(),audioPeak:sound.peak(),camera:{x:camera.position.x,y:camera.position.y,zoom:camera.zoom},renderCalls:renderer.info.render.calls};},
    project(u,v){const p=new THREE.Vector3(u*16,(1-v)*9,0).project(camera),r=canvas.getBoundingClientRect();return {x:r.left+(p.x+1)*.5*r.width,y:r.top+(1-p.y)*.5*r.height};},
    isWater
  };
}
function createInscription(){
  const c=document.createElement('canvas');c.width=660;c.height=900;const ctx=c.getContext('2d');
  ctx.fillStyle='#353b31';ctx.font='94px InkKai';ctx.textAlign='center';
  Array.from('山水清晖').forEach((s,i)=>ctx.fillText(s,490,120+i*112));
  ctx.font='28px InkKai';ctx.fillStyle='#707563';
  Array.from('一湖秋水涵清晖').forEach((s,i)=>ctx.fillText(s,322,104+i*38));
  Array.from('半卷闲云寄远山').forEach((s,i)=>ctx.fillText(s,270,152+i*38));
  ctx.font='22px InkKai';ctx.fillStyle='#8a8e7b';Array.from('丙午秋日').forEach((s,i)=>ctx.fillText(s,200,256+i*30));
  ctx.fillStyle='#9d4c37';ctx.fillRect(459,544,65,65);ctx.strokeStyle='#e8dfc9';ctx.lineWidth=2;ctx.strokeRect(465,550,53,53);ctx.fillStyle='#eee4ce';ctx.font='27px InkKai';ctx.fillText('清',491,575);ctx.fillText('晖',491,599);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2.34,3.19),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false}));mesh.position.set(13.0,6.64,.24);scene.add(mesh);
}
function isWater(u,v){
  if(!maskPixels||u<0||u>=1||v<0||v>=1)return false;
  const x=Math.min(maskWidth-1,Math.floor(u*maskWidth)),y=Math.min(maskHeight-1,Math.floor(v*maskHeight));return maskPixels[(y*maskWidth+x)*4]>220;
}
function addRipple(u,v,strength=.85){
  if(!isWater(u,v))return false;
  rippleUniform[rippleIndex].set(u,1-v,state.time,strength);rippleIndex=(rippleIndex+1)%12;
  state.ripples.push({u,v,time:state.time,strength});state.ripples=state.ripples.slice(-40);return true;
}
function disturbAt(p,strength=.85){
  if(!p||!isWater(p.u,p.v))return;
  addRipple(p.u,p.v,strength);
  const count=birds.disturb(p.u,p.v,state.time);state.disturbed+=count;
}
function screenToArt(clientX,clientY){
  const r=canvas.getBoundingClientRect();const ndc=new THREE.Vector2((clientX-r.left)/r.width*2-1,1-(clientY-r.top)/r.height*2);
  camera.updateMatrixWorld();raycaster.setFromCamera(ndc,camera);const hit=new THREE.Vector3();if(!raycaster.ray.intersectPlane(plane,hit))return null;
  const u=hit.x/16,v=1-hit.y/9;return u>=0&&u<=1&&v>=0&&v<=1?{u,v}:null;
}
function resize(){
  const w=viewport.clientWidth,h=viewport.clientHeight;
  const artScale=Math.min(w/16,h/9);
  viewport.style.setProperty('--art-left',`${(w-artScale*16)/2}px`);
  viewport.style.setProperty('--art-top',`${(h-artScale*9)/2}px`);
  viewport.style.setProperty('--art-width',`${artScale*16}px`);
  viewport.style.setProperty('--art-height',`${artScale*9}px`);
  const dpr=window.devicePixelRatio||1;
  const ratios={fine:Math.min(2,Math.max(1.5,dpr*1.5)),balanced:Math.min(1.25,dpr),light:Math.max(.7,Math.min(.8,dpr*.7))};
  renderer.setPixelRatio(ratios[state.quality]);
  renderer.setSize(w,h,false);
  const aspect=w/h;baseHeight=Math.max(9,16/aspect);baseWidth=baseHeight*aspect;
  camera.left=-baseWidth/2;camera.right=baseWidth/2;camera.top=baseHeight/2;camera.bottom=-baseHeight/2;camera.zoom=state.zoom;camera.updateProjectionMatrix();clampCamera();
}
function clampCamera(){
  const w=baseWidth/state.zoom,h=baseHeight/state.zoom;
  target.x=w>=16?8:Math.max(w/2,Math.min(16-w/2,target.x));target.y=h>=9?4.5:Math.max(h/2,Math.min(9-h/2,target.y));
  camera.position.x=target.x;camera.position.y=target.y;camera.updateMatrixWorld();
}
function setZoom(next,x,y){
  const before=screenToArt(x,y);state.zoom=Math.max(1,Math.min(5,next));camera.zoom=state.zoom;camera.updateProjectionMatrix();
  const after=screenToArt(x,y);if(before&&after){target.x+=(before.u-after.u)*16;target.y-=(before.v-after.v)*9;}clampCamera();
  $('#zoom-readout').textContent=`${state.zoom<1.01?'全卷':'细赏'} · ${Math.round(state.zoom*100)}%`;
}
function reset(){state.zoom=1;target.x=8;target.y=4.5;camera.zoom=1;camera.updateProjectionMatrix();clampCamera();$('#zoom-readout').textContent='全卷 · 100%';toast('一卷山水，尽收眼底');}
function render(ms){
  const dt=lastTime?Math.min((ms-lastTime)/1000,.05):0;lastTime=ms;
  if(document.hidden)return;
  animationTime+=dt;state.time=animationTime;
  water.material.uniforms.uTime.value=state.time;birds.update(state.time);sound.update(state.time);renderer.render(scene,camera);
}
async function toggleSound(){try{const enabled=await sound.toggle();$('#sound').setAttribute('aria-pressed',String(enabled));$('#sound-state').textContent=enabled?'开':'关';$('#sound').title=enabled?'关闭自然声音（M）':'开启自然声音（M）';toast(enabled?'风入松间，水声渐起':'收声入静');}catch(e){toast(e.message);}}
async function fullscreen(){
  try{
    if(document.fullscreenElement)await document.exitFullscreen();else if($('#app').requestFullscreen)await $('#app').requestFullscreen();else{toast('此浏览器暂不支持全屏，可横屏赏画');}
  }catch{toast('全屏暂不可用，请由浏览器打开此页');}
}
function save(){
  renderer.render(scene,camera);
  canvas.toBlob(blob=>{if(!blob){toast('画面保存失败，请重试');return;}const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`山水清晖-${new Date().toISOString().slice(0,10)}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);toast('清晖入卷，已保存此刻');},'image/png');
}
function bindControls(){
  new ResizeObserver(resize).observe(viewport);
  $('#reset').addEventListener('click',reset);$('#sound').addEventListener('click',toggleSound);$('#fullscreen').addEventListener('click',fullscreen);$('#save').addEventListener('click',save);
  document.addEventListener('fullscreenchange',()=>{const active=document.fullscreenElement===$('#app');$('#app').classList.toggle('is-fullscreen',active);$('#fullscreen').setAttribute('aria-pressed',String(active));$('#fullscreen span').textContent=active?'退出全屏':'全屏赏画';$('#fullscreen').title=active?'退出全屏（F）':'全屏赏画（F）';resize();});
  document.addEventListener('visibilitychange',()=>{lastTime=0;if(sound.context){if(document.hidden)sound.context.suspend();else if(sound.enabled)sound.context.resume();}});
  $('#quality').addEventListener('click',()=>{const open=$('#quality-menu').hidden;$('#quality-menu').hidden=!open;$('#quality').setAttribute('aria-expanded',String(open));});
  $('#quality-state').textContent=qualityNames[state.quality];
  document.querySelectorAll('[data-quality]').forEach(button=>{
    button.setAttribute('aria-pressed',String(button.dataset.quality===state.quality));
    button.addEventListener('click',()=>{state.quality=button.dataset.quality;localStorage.setItem('shanshui-quality',state.quality);$('#quality-state').textContent=qualityNames[state.quality];document.querySelectorAll('[data-quality]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));$('#quality-menu').hidden=true;$('#quality').setAttribute('aria-expanded','false');resize();});
  });
  document.addEventListener('click',e=>{if(!e.target.closest('.quality-control')){$('#quality-menu').hidden=true;$('#quality').setAttribute('aria-expanded','false');}});
  document.addEventListener('keydown',e=>{
    if(e.ctrlKey||e.altKey||e.metaKey||e.target.matches('input,textarea'))return;
    if(e.key==='0')reset();if(e.key.toLowerCase()==='m')toggleSound();if(e.key.toLowerCase()==='f')fullscreen();if(e.key.toLowerCase()==='s'){e.preventDefault();save();}
    if(e.key==='Escape'){$('#quality-menu').hidden=true;$('#quality').setAttribute('aria-expanded','false');}
  });
  viewport.addEventListener('wheel',e=>{e.preventDefault();setZoom(state.zoom*Math.exp(-e.deltaY*.0012),e.clientX,e.clientY);},{passive:false});
  viewport.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;viewport.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===2){const [a,b]=[...pointers.values()];gesture={kind:'pinch',distance:Math.hypot(a.x-b.x,a.y-b.y),zoom:state.zoom};}
    else{gesture={kind:state.zoom>1.01?'pan':'water',x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,lastRipple:state.time};if(gesture.kind==='water')disturbAt(screenToArt(e.clientX,e.clientY));}
  });
  viewport.addEventListener('pointermove',e=>{
    const art=screenToArt(e.clientX,e.clientY),wet=art&&isWater(art.u,art.v);
    const rect=viewport.getBoundingClientRect(),cursor=$('#water-cursor');cursor.style.left=`${e.clientX-rect.left}px`;cursor.style.top=`${e.clientY-rect.top}px`;cursor.style.opacity=wet&&state.zoom<1.01?'1':'0';
    viewport.style.cursor=state.zoom>1.01?(pointers.size?'grabbing':'grab'):(wet?'none':'default');
    if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(!gesture)return;
    if(gesture.kind==='pinch'&&pointers.size>=2){const [a,b]=[...pointers.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);setZoom(gesture.zoom*d/gesture.distance,(a.x+b.x)/2,(a.y+b.y)/2);return;}
    const travel=Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y);gesture.moved ||= travel>5;
    if(gesture.kind==='pan'){
      target.x-=(e.clientX-gesture.lastX)/rect.width*baseWidth/state.zoom;target.y+=(e.clientY-gesture.lastY)/rect.height*baseHeight/state.zoom;clampCamera();
    }else if(gesture.kind==='water'&&wet&&gesture.moved&&state.time-gesture.lastRipple>.105){disturbAt(art,.55);gesture.lastRipple=state.time;}
    gesture.lastX=e.clientX;gesture.lastY=e.clientY;
  });
  function finish(e){
    if(gesture?.kind==='pan'&&!gesture.moved&&e.type==='pointerup')disturbAt(screenToArt(e.clientX,e.clientY));
    pointers.delete(e.pointerId);gesture=null;
    if(viewport.hasPointerCapture(e.pointerId))viewport.releasePointerCapture(e.pointerId);
  }
  viewport.addEventListener('pointerup',finish);viewport.addEventListener('pointercancel',finish);viewport.addEventListener('lostpointercapture',e=>{pointers.delete(e.pointerId);if(!pointers.size)gesture=null;});viewport.addEventListener('pointerleave',()=>$('#water-cursor').style.opacity=0);
}
initialize().catch(onError);
