import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
globalThis.self=globalThis; globalThis.window=globalThis; globalThis.ProgressEvent=class{constructor(t,i){this.type=t;Object.assign(this,i||{});}};
globalThis.document={createElementNS:()=>({style:{},getContext:()=>null}),createElement:()=>({style:{},getContext:()=>null,width:0,height:0})};
const THREE=await import('three');const {GLTFLoader}=await import('three/examples/jsm/loaders/GLTFLoader.js');const {MeshoptDecoder}=await import('three/examples/jsm/libs/meshopt_decoder.module.js');
const {CharacterTemplate,CharacterPool}=await import('../src/characters/Character.js');
const root=path.resolve('public');const server=http.createServer((req,res)=>{fs.readFile(path.join(root,decodeURIComponent(req.url.split('?')[0])),(e,d)=>{if(e){res.writeHead(404);res.end();return;}res.writeHead(200);res.end(d);});});await new Promise(r=>server.listen(8126,r));
class KtxStub extends THREE.Loader{load(u,ok){const t=new THREE.DataTexture(new Uint8Array([128,128,128,255]),1,1);t.needsUpdate=true;ok(t);}}
const gltf=new GLTFLoader().setKTX2Loader(new KtxStub()).setMeshoptDecoder(MeshoptDecoder);const L=u=>gltf.loadAsync('http://localhost:8126/'+u);
const [g0,g1,g2]=await Promise.all([L('assets/characters/human_base.glb'),L('assets/characters/human_base_lod1.glb'),L('assets/characters/human_base_lod2.glb')]);
const t=new CharacterTemplate({gltf:g0,lod1:g1,lod2:g2,clips:g0.animations,skins:{},kits:{},info:{}},{headScale:1.65});const scene=new THREE.Scene();const pool=new CharacterPool(t,scene,1,{flashTex:null,numberGeo:null});
const c=pool.acquire();c.spawn(0,0,0,0,1);c.setLower('idle',0);c.setUpper('aim',0);for(let i=0;i<60;i++)c.update(1/60,new THREE.Vector3(0,1.6,5),1);scene.updateMatrixWorld(true);
const rh=c.bones.RightHand,lh=c.bones.LeftHand;const rp=rh.getWorldPosition(new THREE.Vector3()),lp=lh.getWorldPosition(new THREE.Vector3());
console.log('right hand',rp.toArray().map(v=>v.toFixed(3)),'left hand',lp.toArray().map(v=>v.toFixed(3)));
// desired rifle frame: origin at right hand (grip), -Z axis toward the left hand (barrel direction), up ~ +Y
const fwd=lp.clone().sub(rp).normalize();const up=new THREE.Vector3(0,1,0);const right=new THREE.Vector3().crossVectors(fwd,up).normalize();const up2=new THREE.Vector3().crossVectors(right,fwd).normalize();
const M=new THREE.Matrix4().makeBasis(right,up2,fwd.clone().negate());M.setPosition(rp);
const local=new THREE.Matrix4().copy(rh.matrixWorld).invert().multiply(M);const pos=new THREE.Vector3(),quat=new THREE.Quaternion(),scl=new THREE.Vector3();local.decompose(pos,quat,scl);
console.log('RIFLE_POS',pos.toArray().map(v=>+v.toFixed(4)),'RIFLE_QUAT',quat.toArray().map(v=>+v.toFixed(4)),'scale',scl.toArray().map(v=>v.toFixed(2)));
console.log('fwd (should be ~ -z)',fwd.toArray().map(v=>v.toFixed(2)),'hand distance',rp.distanceTo(lp).toFixed(2));
server.close();
