/* Integration test: real GLB modules + real skinned character through the game loop (WebGL and KTX2 stubbed). */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ctx2d=()=>new Proxy({},{get(t,k){if(k==='getImageData')return(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4).fill(128)});if(k==='createImageData')return(w,h)=>({data:new Uint8ClampedArray(w*h*4)});if(k==='createLinearGradient'||k==='createRadialGradient')return()=>({addColorStop(){}});if(k==='measureText')return()=>({width:10});return typeof t[k]!=='undefined'?t[k]:()=>{};},set(t,k,v){t[k]=v;return true;}});
const listeners=new Map();const els={};
function el(id){return {id,style:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},textContent:'',innerHTML:'',children:[],listeners:{},addEventListener(t,f){(this.listeners[t]=this.listeners[t]||[]).push(f);},querySelector(){return {textContent:''};},setPointerCapture(){},getContext(){return ctx2d();},appendChild(c){this.children.push(c);},width:0,height:0};}
globalThis.document={getElementById(id){return els[id]||(els[id]=el(id));},createElement(tag){if(tag==='canvas')return {width:0,height:0,getContext(){return ctx2d();}};return el('dyn');},createElementNS(){return el('ns');},addEventListener(t,f){(listeners.get(t)||listeners.set(t,[]).get(t)).push(f);},body:{classList:{add(){}}},documentElement:{},hidden:false,pointerLockElement:null,exitPointerLock(){}};
globalThis.window={innerWidth:390,innerHeight:844,devicePixelRatio:2,addEventListener(t,f){(listeners.get('w:'+t)||listeners.set('w:'+t,[]).get('w:'+t)).push(f);},location:{href:'http://localhost/'}};
Object.defineProperty(globalThis,'navigator',{value:{maxTouchPoints:0,vibrate(){},hardwareConcurrency:4},configurable:true});
let stored=null;globalThis.localStorage={getItem(){return stored;},setItem(k,v){stored=v;}};
let rafCb=null;globalThis.requestAnimationFrame=f=>{rafCb=f;};globalThis.screen={};globalThis.self=globalThis;globalThis.ProgressEvent=class{constructor(t,i){this.type=t;Object.assign(this,i||{});}};
const THREE=await import('three');
const {GLTFLoader}=await import('three/examples/jsm/loaders/GLTFLoader.js');const {MeshoptDecoder}=await import('three/examples/jsm/libs/meshopt_decoder.module.js');
const root=path.resolve('public');const server=http.createServer((req,res)=>{fs.readFile(path.join(root,decodeURIComponent(req.url.split('?')[0])),(e,d)=>{if(e){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':'application/octet-stream'});res.end(d);});});await new Promise(r=>server.listen(8124,r));
class KtxStub extends THREE.Loader{load(u,ok){const t=new THREE.DataTexture(new Uint8Array([128,128,128,255]),1,1);t.needsUpdate=true;ok(t);}loadAsync(){return Promise.resolve(new THREE.DataTexture(new Uint8Array([128,128,128,255]),1,1));}}
const gltf=new GLTFLoader().setKTX2Loader(new KtxStub()).setMeshoptDecoder(MeshoptDecoder);const manifest=JSON.parse(fs.readFileSync('src/assets/manifest.json','utf8'));
const {MATERIAL_SPECS}=await import('../src/assets/AssetRegistry.js');
const cache=new Map();const cached=(k,fn)=>cache.has(k)?cache.get(k):(cache.set(k,fn().catch(e=>{console.log('LOAD FAIL',k,e.message);return null;})),cache.get(k));
const registry={manifest,available:{character:false},log:[],
  texture:async()=>{const t=new THREE.DataTexture(new Uint8Array([128,128,128,255]),1,1);t.needsUpdate=true;return t;},
  materialSet:async(id)=>manifest.materials[id]?{map:await registry.texture(),normalMap:await registry.texture(),roughnessMap:await registry.texture()}:null,
  environment:async()=>null,
  module:async(id)=>{const m=manifest.modules[id];if(!m)return null;return cached('mod:'+id,async()=>{const g=await gltf.loadAsync('http://localhost:8124/'+m.path);const meshes=[];g.scene.traverse(o=>{if(o.isMesh)meshes.push(o);});return {scene:g.scene,meshes,info:m};});},
  character:async()=>cached('char',async()=>{const c=manifest.characters.human_base;const [g0,g1,g2]=await Promise.all([gltf.loadAsync('http://localhost:8124/'+c.path),gltf.loadAsync('http://localhost:8124/'+c.lods.lod1),gltf.loadAsync('http://localhost:8124/'+c.lods.lod2)]);const skins={};for(const k in c.skins)skins[k]=await registry.texture();const kits={};for(const k in c.kits)kits[k]=await registry.texture();registry.available.character=true;return {gltf:g0,lod1:g1,lod2:g2,clips:g0.animations,skins,kits,info:c};}),
  pbr:async(name,opts={})=>{const spec=MATERIAL_SPECS[name]||{color:0x9a9a9a};return new THREE.MeshStandardMaterial({color:new THREE.Color(spec.color||0xffffff),vertexColors:!!opts.vertexColors,emissive:new THREE.Color(spec.emissive||0)});}};
const renderer={domElement:(els.gl=el('gl')),shadowMap:{enabled:false,type:0},info:{render:{calls:0,triangles:0},memory:{geometries:0,textures:0},programs:[]},toneMapping:0,toneMappingExposure:1,pr:1,setPixelRatio(p){this.pr=p;},getPixelRatio(){return this.pr;},setSize(){},render(scene,cam){scene.updateMatrixWorld();cam.updateMatrixWorld();let calls=0,tris=0;scene.traverse(o=>{if(o.visible&&(o.isMesh||o.isPoints||o.isSprite)){calls++;const g=o.geometry;if(g&&g.attributes.position){const n=g.index?g.index.count:g.attributes.position.count;tris+=(n/3)*(o.isInstancedMesh?o.count:1);}}});this.info.render.calls=calls;this.info.render.triangles=tris;},setRenderTarget(){},capabilities:{isWebGL2:true}};
console.log('setup ok');
globalThis.document={createElementNS:()=>({style:{},getContext:()=>null}),createElement:(t)=>({style:{},getContext:()=>null,width:0,height:0})};
const url='http://localhost:8124/assets/characters/human_base.glb';
const tl=Date.now();gltf.load(url,g=>console.log('loaded cb ms',Date.now()-tl,g.animations.length),undefined,e=>console.log('onError',e&&e.message));
await new Promise(r=>setTimeout(r,12000));server.close();
