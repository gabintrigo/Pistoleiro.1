/* Loads the real character GLB (meshopt) through GLTFLoader in Node (textures stubbed), then exercises CharacterTemplate/Pool. */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
globalThis.self=globalThis; globalThis.window=globalThis; globalThis.ProgressEvent=class{constructor(t,i){this.type=t;Object.assign(this,i||{});}};
globalThis.document={createElementNS:()=>({style:{},getContext:()=>null}),createElement:(t)=>({style:{},getContext:()=>null,width:0,height:0})};
const THREE=await import('three');
const {GLTFLoader}=await import('three/examples/jsm/loaders/GLTFLoader.js');
const {MeshoptDecoder}=await import('three/examples/jsm/libs/meshopt_decoder.module.js');
const {CharacterTemplate,CharacterPool}=await import('../src/characters/Character.js');
const root=path.resolve('public');
const server=http.createServer((req,res)=>{const p=path.join(root,decodeURIComponent(req.url.split('?')[0]));fs.readFile(p,(e,d)=>{if(e){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':'application/octet-stream'});res.end(d);});});
await new Promise(r=>server.listen(8123,r));
class KtxStub extends THREE.Loader{load(url,onLoad){const t=new THREE.DataTexture(new Uint8Array([128,128,128,255]),1,1);t.needsUpdate=true;onLoad(t);}loadAsync(url){return Promise.resolve(new THREE.DataTexture(new Uint8Array([128,128,128,255]),1,1));}detectSupport(){return this;}setTranscoderPath(){return this;}}
const gltf=new GLTFLoader().setKTX2Loader(new KtxStub()).setMeshoptDecoder(MeshoptDecoder);
const load=u=>gltf.loadAsync('http://localhost:8123/'+u);
const t0=Date.now();
const [g0,g1,g2]=await Promise.all([load('assets/characters/human_base.glb'),load('assets/characters/human_base_lod1.glb'),load('assets/characters/human_base_lod2.glb')]);
console.log('loaded ms',Date.now()-t0,'anims',g0.animations.length,g0.animations.map(a=>a.name+':'+a.duration.toFixed(2)).join(' '));
const names=[];g0.scene.traverse(o=>{if(o.isSkinnedMesh)names.push(o.name+'('+o.geometry.attributes.position.count+'v,'+(o.skeleton?o.skeleton.bones.length:0)+'b)');});console.log('skinned meshes',names.join(' '));
const asset={gltf:g0,lod1:g1,lod2:g2,clips:g0.animations,skins:{},kits:{},info:{}};
const template=new CharacterTemplate(asset,{headScale:1.3});
const scene=new THREE.Scene();const pool=new CharacterPool(template,scene,3,{flashTex:null,numberGeo:new THREE.PlaneGeometry(0.5,0.56)});
const c=pool.acquire();c.spawn(10,0,10,0.5,1.0);c.setLower('walk');c.setUpper('aim');
const cam=new THREE.Vector3(12,1.6,20);
for(let i=0;i<60;i++)c.update(1/60,cam,1);
const head=c.headCenter(new THREE.Vector3());console.log('head world',head.toArray().map(v=>v.toFixed(2)),'radius',c.headRadius().toFixed(3),'lod',c.lod);
const hips=c.bones.Hips.getWorldPosition(new THREE.Vector3());console.log('hips',hips.toArray().map(v=>v.toFixed(2)));
// ray from camera at the head
const o=cam.clone(),d=head.clone().sub(o).normalize();const hit=c.hitTest(o,d,50);console.log('hit head?',hit);
const d2=hips.clone().sub(o).normalize();console.log('hit body?',c.hitTest(o,d2,50));
c.fireUpper('shoot');for(let i=0;i<20;i++)c.update(1/60,cam,1);c.playFull('headshot','death_back');for(let i=0;i<120;i++)c.update(1/60,cam,1);console.log('after death anim hips y',c.bones.Hips.getWorldPosition(new THREE.Vector3()).y.toFixed(2));
c.setLod(2);console.log('lod2 meshes visible',c.lods[2].filter(m=>m.visible).length,'lod0 visible',c.lods[0].filter(m=>m.visible).length);
const c2=pool.acquire();c2.spawn(0,0,0,0,1);c2.setLower('idle',0);c2.setUpper('aim',0);for(let i=0;i<30;i++)c2.update(1/60,cam,1);c2.root.updateWorldMatrix(true,true);
const dir=(a,b)=>c2.bones[b].getWorldPosition(new THREE.Vector3()).sub(c2.bones[a].getWorldPosition(new THREE.Vector3())).normalize().toArray().map(v=>v.toFixed(2));
console.log('aim (yaw 0, game forward = -Z): LeftArm->ForeArm dir',dir('LeftArm','LeftForeArm'),'RightArm',dir('RightArm','RightForeArm'));const np=c2.numberPlane.getWorldPosition(new THREE.Vector3());console.log('number plane world',np.toArray().map(v=>v.toFixed(2)),'(expect +z behind the back)');
c2.setUpper('idle_upper',0);c2.setLower('walk',0);let ys=[];for(let i=0;i<30;i++){c2.update(1/60,cam,1);c2.root.updateWorldMatrix(true,true);ys.push(dir('LeftUpLeg','LeftLeg')[2]);}console.log('walk: left thigh z-dir over 0.5s',ys.filter((_,i)=>i%6===0).join(' '));
c2.playFull('death');for(let i=0;i<90;i++)c2.update(1/60,cam,1);c2.root.updateWorldMatrix(true,true);console.log('death: hips y',c2.bones.Hips.getWorldPosition(new THREE.Vector3()).y.toFixed(2),'head y',c2.bones.Head.getWorldPosition(new THREE.Vector3()).y.toFixed(2));
c.release();c2.release();server.close();console.log('ASSET HARNESS OK');
