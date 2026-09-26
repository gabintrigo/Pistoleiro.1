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
const g=R.grid(),S=g.S; let Bh=null; for(let z=1;z<g.MH-1&&!Bh;z++)for(let x=1;x<g.MW-1&&!Bh;x++) if(g.MAP[z][x]==='B') Bh={x,z};
// 1) dentro da casa
R.tpy((Bh.x+1)*S,(Bh.z+1)*S,0); for(let i=0;i<3;i++)R.spawnRole('medio'); frames(60);
for(const e of R.enemiesRaw()){ if(e.state!=='dead'&&e.state!=='warm'){ e.x=(Bh.x+1)*S+2.5; e.z=(Bh.z+1)*S+0.5; e.y=0; } }
const hp0=dbg().hp; let atk=0; for(let i=0;i<360;i++){ frames(1); for(const e of R.enemiesRaw()) if(e.state==='attack')atk++; }
console.log('dentro da casa: vida',hp0,'->',dbg().hp,'· frames em ataque',atk,(dbg().hp<hp0)?'ATACAM ✓':'NÃO ATACAM');
for(const e of R.enemiesRaw())e.hp=0; frames(30); R.god(); R.god();
// 2) atirador a 50 m com linha de vista
R.tpy(30,40,0); R.spawnRole('ponta'); frames(30); const sn=R.enemiesRaw().find(e=>e.role==='ponta'&&e.state!=='dead'); if(sn){ sn.x=80; sn.z=40; sn.y=0; }
const hp1=dbg().hp; for(let i=0;i<600;i++)frames(1); console.log('atirador a 50 m: vida',hp1,'->',dbg().hp,(dbg().hp<hp1)?'ACERTA ✓':'NÃO ACERTA');
process.exit(0);
