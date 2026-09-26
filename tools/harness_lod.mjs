/* CPU-skin each LOD mesh and compare bounding boxes: catches wrong joint binding / exploded meshes. */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
globalThis.self=globalThis; globalThis.window=globalThis; globalThis.ProgressEvent=class{constructor(t,i){this.type=t;Object.assign(this,i||{});}};
globalThis.document={createElementNS:()=>({style:{},getContext:()=>null}),createElement:()=>({style:{},getContext:()=>null,width:0,height:0})};
const THREE=await import('three');const {GLTFLoader}=await import('three/examples/jsm/loaders/GLTFLoader.js');const {MeshoptDecoder}=await import('three/examples/jsm/libs/meshopt_decoder.module.js');
const {CharacterTemplate,CharacterPool}=await import('../src/characters/Character.js');
const root=path.resolve('public');const server=http.createServer((req,res)=>{fs.readFile(path.join(root,decodeURIComponent(req.url.split('?')[0])),(e,d)=>{if(e){res.writeHead(404);res.end();return;}res.writeHead(200);res.end(d);});});await new Promise(r=>server.listen(8125,r));
class KtxStub extends THREE.Loader{load(u,ok){const t=new THREE.DataTexture(new Uint8Array([128,128,128,255]),1,1);t.needsUpdate=true;ok(t);}}
const gltf=new GLTFLoader().setKTX2Loader(new KtxStub()).setMeshoptDecoder(MeshoptDecoder);const L=u=>gltf.loadAsync('http://localhost:8125/'+u);
const [g0,g1,g2]=await Promise.all([L('assets/characters/human_base.glb'),L('assets/characters/human_base_lod1.glb'),L('assets/characters/human_base_lod2.glb')]);
const asset={gltf:g0,lod1:g1,lod2:g2,clips:g0.animations,skins:{},kits:{},info:{}};
const t=new CharacterTemplate(asset,{headScale:1.65});const scene=new THREE.Scene();const pool=new CharacterPool(t,scene,1,{flashTex:null,numberGeo:new THREE.PlaneGeometry(0.5,0.56)});
const c=pool.acquire();c.spawn(5,0,7,0.3,1);c.setLower('jog',0);c.setUpper('aim',0);for(let i=0;i<20;i++)c.update(1/60,new THREE.Vector3(5,1.6,12),1);
scene.updateMatrixWorld(true);
const v=new THREE.Vector3();
function bbox(sm){sm.skeleton.update();const box=new THREE.Box3();const pos=sm.geometry.attributes.position;for(let i=0;i<pos.count;i+=7){sm.getVertexPosition(i,v);box.expandByPoint(v);}return box;}
for(const lvl of [0,1,2]){for(const sm of c.lods[lvl]){const b=bbox(sm);const s=b.getSize(new THREE.Vector3());console.log('lod'+lvl,sm.name.padEnd(10),sm.userData.cls.padEnd(5),'verts',sm.geometry.attributes.position.count,'size',s.toArray().map(x=>x.toFixed(2)).join('x'),'min y',b.min.y.toFixed(2),'bindMode',sm.bindMode,'skel bones',sm.skeleton.bones.length,'same skel',sm.skeleton===c.skeleton);}}
console.log('bone Head world',c.bones.Head.getWorldPosition(new THREE.Vector3()).toArray().map(x=>x.toFixed(2)));
server.close();
