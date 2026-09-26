/* Measures stride length per gait clip and the foot-slide ratio when the root moves at the clip's natural speed. */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
globalThis.self=globalThis; globalThis.window=globalThis; globalThis.ProgressEvent=class{constructor(t,i){this.type=t;Object.assign(this,i||{});}};
globalThis.document={createElementNS:()=>({style:{},getContext:()=>null}),createElement:()=>({style:{},getContext:()=>null,width:0,height:0})};
const THREE=await import('three');const {GLTFLoader}=await import('three/examples/jsm/loaders/GLTFLoader.js');const {MeshoptDecoder}=await import('three/examples/jsm/libs/meshopt_decoder.module.js');
const {CharacterTemplate,CharacterPool}=await import('../src/characters/Character.js');
const root=path.resolve('public');const server=http.createServer((req,res)=>{fs.readFile(path.join(root,decodeURIComponent(req.url.split('?')[0])),(e,d)=>{if(e){res.writeHead(404);res.end();return;}res.writeHead(200);res.end(d);});});await new Promise(r=>server.listen(8127,r));
class KtxStub extends THREE.Loader{load(u,ok){const t=new THREE.DataTexture(new Uint8Array([128,128,128,255]),1,1);t.needsUpdate=true;ok(t);}}
const gltf=new GLTFLoader().setKTX2Loader(new KtxStub()).setMeshoptDecoder(MeshoptDecoder);const L=u=>gltf.loadAsync('http://localhost:8127/'+u);
const [g0,g1,g2]=await Promise.all([L('assets/characters/human_base.glb'),L('assets/characters/human_base_lod1.glb'),L('assets/characters/human_base_lod2.glb')]);
const t=new CharacterTemplate({gltf:g0,lod1:g1,lod2:g2,clips:g0.animations,skins:{},kits:{},info:{}},{headScale:1.65});const scene=new THREE.Scene();const pool=new CharacterPool(t,scene,1,{flashTex:null,numberGeo:null});
const c=pool.acquire();const cam=new THREE.Vector3(0,1.6,5);const V=()=>new THREE.Vector3();
const out={};
for(const clip of ['walk','jog','sprint']){
  c.spawn(0,0,0,0,1);c.setLower(clip,0);c.setUpper(clip+'_upper',0);c.setGaitSpeed?.(0); // timeScale 1
  const period=t.clips.get(clip).duration;const dt=1/120;
  // 1) stride: foot position relative to the root along forward (-z), over one cycle (root static)
  let minZ=1e9,maxZ=-1e9;for(let i=0;i<Math.round(period/dt);i++){c.update(dt,cam,1);scene.updateMatrixWorld(true);const f=c.bones.LeftFoot.getWorldPosition(V());minZ=Math.min(minZ,f.z);maxZ=Math.max(maxZ,f.z);}
  const stride=maxZ-minZ, natural=2*stride/period;
  // 2) slide: move the root at the natural speed; during stance the foot should be still in world space
  const v=natural;let slide=0,n=0,z=0;c.spawn(0,0,0,0,1);c.setLower(clip,0);c.setUpper(clip+'_upper',0);
  let prev=null;for(let i=0;i<Math.round(2*period/dt);i++){z-=v*dt;c.root.position.z=z;c.update(dt,cam,1);scene.updateMatrixWorld(true);const f=c.bones.LeftFoot.getWorldPosition(V());const relZ=f.z-z;
    if(prev){const footVel=(f.z-prev.z)/dt;const relVel=(relZ-prev.relZ)/dt; // stance = foot moving backward relative to body at ~-v
      if(relVel>0.5*v&&f.y<0.2){slide+=Math.abs(footVel);n++;}}
    prev={z:f.z,relZ};}
  out[clip]={period:+period.toFixed(2),stride:+stride.toFixed(2),naturalSpeed:+natural.toFixed(2),slideRatio:n?+(slide/n/v).toFixed(2):null,stanceSamples:n};
}
console.log(JSON.stringify(out,null,1));server.close();
