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
document.pointerLockElement=els.gl;const md=listeners.get('mousedown')||[],mu=listeners.get('mouseup')||[],mm=listeners.get('mousemove')||[];
key('w',true);frames(60);key('w',false);for(let r=0;r<20;r++){md.forEach(f=>f({button:0}));frames(15);mu.forEach(f=>f({button:0}));mm.forEach(f=>f({movementX:50,movementY:3}));key('r',true);key('r',false);frames(10);}
key('g',true);key('g',false);frames(150);key(' ',true);key(' ',false);frames(30);key('q',true);key('q',false);
R.money(60000);R.gotoShop();frames(5);key('e',true);key('e',false);frames(2);console.log('shop',dbg().mode);{const tb=(els.shopTabs.children||[]).find(b=>b.textContent==='Tudo');if(tb)tb.listeners.click.forEach(f=>f());}const L=els.shopList;for(const b of L.children.slice())if(!b.disabled&&b.listeners.click)b.listeners.click.forEach(f=>f());els.shopClose.listeners.click.forEach(f=>f());frames(5);console.log('after shop',JSON.stringify(dbg()));
// new weapons: switch to GL and RPG, fire at enemies, place a mine
{const owned=R.owned();console.log('owned after buying',JSON.stringify(owned));
 for(const wk of ['gl','rpg']){R.setWeapon(wk);frames(40);const before=dbg().kills;for(let i=0;i<6;i++){document.pointerLockElement=els.gl;(listeners.get('mousedown')||[]).forEach(f=>f({button:0}));frames(3);(listeners.get('mouseup')||[]).forEach(f=>f({button:0}));frames(60);}const st=R.weaponState();console.log(wk,'fired: mag',st.mag,'reserve',st.reserve,'projectiles alive',R.projectiles(),'kills delta',dbg().kills-before);}
 key('m',true);key('m',false);frames(5);console.log('mines placed',R.projectiles().mines,'P.mines left',R.pmines());}
{ // round depth features
  for(const m of ['headshots','fog','scarce','armored','fast','double']){R.forceMod(m);frames(30);R.killAll();frames(60);}
  console.log('mods cycled, last',JSON.stringify(R.extras().mod));
  for(const o of ['hold','bombs','race']){const ok=R.forceObj(o);frames(120);console.log('objective',o,'started',ok,JSON.stringify(R.extras().obj));}
  for(const e of ['rain','blackout','reinforcements']){R.forceEvt(e);frames(10);const x=R.extras().evt;frames(200);console.log('event',e,'fired',!!(x&&x.active),'after',JSON.stringify(R.extras().evt),'dbg',JSON.stringify(dbg()).slice(0,80));}
  console.log('daily',JSON.stringify(R.extras().daily.list.map(c=>c.nome+' '+c.prog+'/'+c.goal)));
  console.log('attachments owned',JSON.stringify(R.att()));
  // new roles + killstreaks
  for(const r of ['escudo','atirador','capitao']){const st=R.spawnRole(r);frames(90);}
  const raw=R.enemiesRaw();console.log('roles alive',JSON.stringify(raw.filter(e=>e.state!=='dead').map(e=>e.role+':'+e.state+(e.perchY?'@'+e.perchY:''))));
  R.turret();frames(200);console.log('turret placed, enemies hp',JSON.stringify(raw.filter(e=>e.state!=='dead').map(e=>e.role+' '+Math.round(e.hp)+'/'+e.maxHp)));
  R.killAll();frames(60);
  // house storming: player on the deck of house 1 (x 40..48, z 12..20); enemies should enter and climb
  R.tp(44,17);R.setY(3.25);R.look(0,0);for(let i=0;i<6;i++)R.spawnRole('defesa');
  let best={inside:0,deck:0};for(let i=0;i<40;i++){frames(30);const es=R.enemiesRaw().filter(e=>e.state!=='dead');const inside=es.filter(e=>e.x>=40&&e.x<=48&&e.z>=12&&e.z<=20).length,deck=es.filter(e=>e.x>=40&&e.x<=48&&e.z>=12&&e.z<=20&&e.y>2.5).length;best.inside=Math.max(best.inside,inside);best.deck=Math.max(best.deck,deck);}
  console.log('house storming: max enemies inside',best.inside,'on the deck',best.deck,'sample',JSON.stringify(R.enemiesRaw().filter(e=>e.state!=='dead').slice(0,4).map(e=>[+e.x.toFixed(1),+e.z.toFixed(1),+(e.y||0).toFixed(2),e.state,e.nav?e.nav.i+'/'+e.nav.path.length:'-'])));
  // player leaves: enemies should exit
  R.tp(80,40);R.setY(0);let left=99;for(let i=0;i<30;i++){frames(30);const es=R.enemiesRaw().filter(e=>e.state!=='dead');left=es.filter(e=>e.x>=40&&e.x<=48&&e.z>=12&&e.z<=20).length;if(left===0)break;}
  console.log('after the player leaves, enemies still inside',left);
}
let seen=new Set();for(let i=0;i<1500;i++){R.killAll();frames(60);(els.cardBtn.listeners.click||[]).forEach(f=>f());await new Promise(r=>setTimeout(r,5));(els.cardBtn.listeners.click||[]).forEach(f=>f());const d=dbg();seen.add(d.levelIdx+':'+d.team);if(d.mode==='loading'){frames(30);}if(d.mode==='story'){for(let k=0;k<4;k++){(els.cardBtn.listeners.click||[]).forEach(f=>f());await new Promise(r=>setTimeout(r,30));}frames(5);continue;}
 if(d.mode==='menu'){if(d.champion)break;(els.mapPlay.listeners.click||[]).forEach(f=>f());await new Promise(r=>setTimeout(r,80));frames(10);continue;}
 if(d.mode!=='play'&&d.mode!=='loading'){console.log('left play',d.mode,JSON.stringify(d));break;}if(d.endless&&d.wave>=7)break;}
// let async level loads settle
await new Promise(r=>setTimeout(r,50));frames(30);
console.log('campaign',JSON.stringify(dbg()));console.log('levels',[...seen].join(' | '));console.log('roles',JSON.stringify(R.roles().slice(0,5)));
for(let i=0;i<25;i++){R.hurt(30);frames(5);}frames(200);console.log('death',dbg().mode);
els.again.listeners.click.forEach(f=>f());await new Promise(r=>setTimeout(r,50));frames(200);console.log('restart',JSON.stringify(dbg()));
for(const q of ['low','veryhigh','high']){R.setQuality(q);frames(5);}console.log('quality ok',dbg().quality);
console.log('NODE HARNESS OK');
