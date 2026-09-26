/* Headless logic test: runs the game module in Node with DOM/WebGL stubs and asset registry stubs (fallback mode). */
const ctx2d=()=>new Proxy({},{get(t,k){if(k==='getImageData')return(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4).fill(128)});if(k==='createImageData')return(w,h)=>({data:new Uint8ClampedArray(w*h*4)});if(k==='createLinearGradient'||k==='createRadialGradient')return()=>({addColorStop(){}});if(k==='measureText')return()=>({width:10});return typeof t[k]!=='undefined'?t[k]:()=>{};},set(t,k,v){t[k]=v;return true;}});
const listeners=new Map();const els={};
function el(id){return {id,style:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},textContent:'',get innerHTML(){return this._ih||'';},set innerHTML(v){this._ih=v;if(v==='')this.children=[];},children:[],listeners:{},addEventListener(t,f){(this.listeners[t]=this.listeners[t]||[]).push(f);},querySelector(){return {textContent:''};},setPointerCapture(){},setAttribute(){},getAttribute(){return null;},removeAttribute(){},querySelectorAll(){return [];},getContext(){return ctx2d();},appendChild(c){this.children.push(c);},width:0,height:0,clientWidth:390,clientHeight:844};}
globalThis.document={querySelectorAll(){return [];},querySelector(){return null;},getElementById(id){return els[id]||(els[id]=el(id));},createElement(tag){if(tag==='canvas')return {width:0,height:0,getContext(){return ctx2d();},toDataURL(){return '';}};return el('dyn');},createElementNS(){return el('ns');},addEventListener(t,f){(listeners.get(t)||listeners.set(t,[]).get(t)).push(f);},body:{classList:{add(){}}},documentElement:{},hidden:false,pointerLockElement:null,exitPointerLock(){}};
globalThis.window={innerWidth:390,innerHeight:844,devicePixelRatio:2,addEventListener(t,f){(listeners.get('w:'+t)||listeners.set('w:'+t,[]).get('w:'+t)).push(f);},location:{href:'http://localhost/'},navigator:{}};
Object.defineProperty(globalThis,'navigator',{value:{maxTouchPoints:0,vibrate(){},hardwareConcurrency:4,userAgent:'node'},configurable:true});
let stored=null;globalThis.localStorage={getItem(){return stored;},setItem(k,v){stored=v;}};
let rafCb=null;globalThis.requestAnimationFrame=f=>{rafCb=f;};globalThis.performance=globalThis.performance||{now:()=>Date.now()};globalThis.screen={};
globalThis.self=globalThis;
const THREE=await import('three');
const renderer={domElement:els.gl||(els.gl=el('gl')),shadowMap:{enabled:false,type:0},info:{render:{calls:0,triangles:0},memory:{geometries:0,textures:0},programs:[],autoReset:true,reset(){}},toneMapping:0,toneMappingExposure:1,outputColorSpace:'srgb',pr:1,setPixelRatio(p){this.pr=p;},getPixelRatio(){return this.pr;},setSize(){},render(scene,cam){scene.updateMatrixWorld();cam.updateMatrixWorld();},setRenderTarget(){},capabilities:{isWebGL2:true}};
const registry={available:{character:false},log:[],character:async()=>null,module:async()=>null,materialSet:async()=>null,environment:async()=>null,pbr:async(n,o)=>new THREE.MeshStandardMaterial({color:0x888888,vertexColors:!!(o&&o.vertexColors)}),manifest:{}};
const {startGameApp}=await import('../src/game/Game.js');
const t0=Date.now();await startGameApp({renderer,registry});console.log('init ok ms',Date.now()-t0);
let t=1000;const frames=n=>{for(let i=0;i<n;i++){t+=16.7;rafCb(t);}};
const key=(k,down)=>{for(const f of (listeners.get(down?'w:keydown':'w:keyup')||[]))f({key:k,preventDefault(){}});};
const R=window.__rdp,dbg=()=>R.dbg();
frames(20);{const sp=R.start();await new Promise(r=>setTimeout(r,40));for(let i=0;i<8;i++){(els.cardBtn.listeners.click||[]).forEach(f=>f());}await sp;}frames(30);console.log('started',JSON.stringify(dbg()));
/* ---- IA tática: estados, gritos, fichas de disparo e mecânicas dos capitães (sem renderizar) ---- */
R.god();const hist={};const add=s=>{hist[s]=(hist[s]||0)+1;};let errors=0;
const aimAt=e=>{const p=R.pos();R.look(Math.atan2(-(e.x-p.x),-(e.z-p.z))+(Math.random()-0.5)*0.1,0);};
for(const r of ['defesa','medio','ponta','defesa','medio','escudo','guarda','defesa'])R.spawnRole(r);
let maxShooting=0;
for(let i=0;i<1800;i++){
  try{frames(1);}catch(e){errors++;if(errors<3)console.log('ERR',e.stack.split('\n').slice(0,3).join(' | '));}
  if(i%15===0){const es=R.enemiesRaw().filter(e=>e.state!=='dead'&&e.state!=='warm');if(es.length){aimAt(es[(i/15|0)%es.length]);R.fireOnce();}}
  for(const s of R.ai())add(s);
}
console.log('estados',JSON.stringify(hist));
const bh={};
for(const team of ['esp','fra','ale','bra','arg','cft']){
  R.spawnRole('capitao');const b=R.enemiesRaw()[R.enemiesRaw().length-1];b.team=Object.assign({},b.team,{key:team});b.hp=b.maxHp=1e6;b.mT=0.5;
  const seen={};
  for(let i=0;i<1500;i++){
    try{frames(1);}catch(e){errors++;if(errors<3)console.log('ERR',team,e.stack.split('\n').slice(0,3).join(' | '));}
    if(i%10===0&&b.state!=='warm'&&b.state!=='dead'){aimAt(b);if(i%30===0)R.fireOnce();}
    seen[b.state]=(seen[b.state]||0)+1;if(b.dashT>0)seen.dash=(seen.dash||0)+1;if(b.stunT>0)seen.stun=(seen.stun||0)+1;
  }
  seen.guards=R.enemiesRaw().filter(e=>e.guardOf===b&&e.state!=='dead').length;bh[team]=seen;b.hp=0;b.state='dead';
}
console.log('capitaes',JSON.stringify(bh));
console.log(errors?('AI HARNESS ERRORS '+errors):'AI HARNESS OK');
process.exit(0);
