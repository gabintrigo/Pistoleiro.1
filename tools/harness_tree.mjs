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
R.god(); let errs=0; const L=[0,1,3,4]; for(const lv of L){ if(lv)await R.level(lv); frames(10); const g=R.grid(); const T=g.TREES; if(!T.length)continue; const t=T[0];
  R.tpy(t.x+0.35,t.z+0.35,0); for(let i=0;i<6;i++)R.spawnRole('medio'); frames(60); for(const e of R.enemiesRaw()){ if(e.state!=='dead'&&e.state!=='warm'){ e.x=t.x+0.1; e.z=t.z-0.1; } }
  try{ for(let i=0;i<600;i++)frames(1); }catch(e){ errs++; console.log('ERRO no nível',lv,String(e).slice(0,120)); } for(const e of R.enemiesRaw())e.hp=0; frames(20); }
console.log('troncos das árvores: erros =',errs);
process.exit(0);
