// Constrói uma personagem do jogo a partir de um Universal Base Character (Quaternius, CC0) + animações da UAL:
// ossos renomeados, clips do jogo, regiões de equipamento em COLOR_0 (camisola, calções, meias, pele), compressão meshopt.
import { NodeIO } from '@gltf-transform/core';
import { prune, resample, quantize, dedup, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import fs from 'fs';
import { renameBones, transferClips } from './ual_common.mjs';
const [,, bodyPath, name] = process.argv; if(!bodyPath||!name){ console.error('uso: node tools/ual_body.mjs <corpo.gltf> <nome>'); process.exit(1); }
const out=`public/assets/characters/${name}.glb`;
await MeshoptEncoder.ready;
const io=new NodeIO().registerExtensions([EXTMeshoptCompression]).registerDependencies({'meshopt.encoder':MeshoptEncoder});
const doc=await io.read(bodyPath); const root=doc.getRoot();
const ual=await new NodeIO().read((process.env.UAL1||'assets/src/quaternius/ual/UAL1.glb')); renameBones(ual);
renameBones(doc);
// materiais/malhas por classe
for(const m of root.listMaterials()){ const nm=m.getName(); if(/hair/i.test(nm)) m.setName('hair'); else if(/eye/i.test(nm)) m.setName('eyes'); else m.setName('skin'); }
for(const mesh of root.listMeshes()){ const mat=mesh.listPrimitives()[0].getMaterial(); const mn=mat?mat.getName():''; mesh.setName(mn==='hair'?'Hair':mn==='eyes'?'Eyes':'Body'); }
for(const n of root.listNodes()){ const me=n.getMesh(); if(me) n.setName(me.getName()); }
// posições dos ossos na pose de repouso (espaço da malha)
const world=new Map(); { const mats=new Map(); const mul=(a,b)=>{const o=new Array(16).fill(0);for(let r=0;r<4;r++)for(let c=0;c<4;c++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;};
  const visit=(n,pm)=>{ const m=mul(pm,n.getMatrix()); mats.set(n,m); world.set(n.getName(),[m[12],m[13],m[14]]); for(const c of n.listChildren()) visit(c,m); };
  for(const s of root.listScenes()) for(const n of s.listChildren()) visit(n,[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]); }
const P=(k)=>world.get(k)||[0,0,0];
// regiões: [camisola, calções, meias, pele]  — por peso de osso e posição ao longo do osso
const skin=root.listSkins()[0]; const joints=skin.listJoints().map(j=>j.getName());
const along=(v,a,b)=>{ const ax=b[0]-a[0],ay=b[1]-a[1],az=b[2]-a[2]; const L=ax*ax+ay*ay+az*az||1; return ((v[0]-a[0])*ax+(v[1]-a[1])*ay+(v[2]-a[2])*az)/L; };
function regionOf(bone,v){
  switch(bone){
    case 'Spine': case 'Spine1': case 'Spine2': case 'LeftShoulder': case 'RightShoulder': return 0;
    case 'LeftArm': return along(v,P('LeftArm'),P('LeftForeArm'))<0.5?0:3;
    case 'RightArm': return along(v,P('RightArm'),P('RightForeArm'))<0.5?0:3;
    case 'Hips': return 1;
    case 'LeftUpLeg': return along(v,P('LeftUpLeg'),P('LeftLeg'))<0.62?1:3;
    case 'RightUpLeg': return along(v,P('RightUpLeg'),P('RightLeg'))<0.62?1:3;
    case 'LeftLeg': case 'RightLeg': case 'LeftFoot': case 'RightFoot': case 'LeftToeBase': case 'RightToeBase': return 2;
    default: return 3; } }
let stats=[0,0,0,0];
for(const mesh of root.listMeshes()){ if(mesh.getName()!=='Body') continue; for(const prim of mesh.listPrimitives()){
  const pos=prim.getAttribute('POSITION'), J=prim.getAttribute('JOINTS_0'), W=prim.getAttribute('WEIGHTS_0'); const n=pos.getCount(); const col=new Float32Array(n*4); const v=[0,0,0],j=[0,0,0,0],w=[0,0,0,0];
  for(let i=0;i<n;i++){ pos.getElement(i,v); J.getElement(i,j); W.getElement(i,w); const acc=[0,0,0,0]; let tot=0; for(let k=0;k<4;k++){ if(w[k]<=0) continue; const r=regionOf(joints[j[k]],v); acc[r]+=w[k]; tot+=w[k]; } if(tot<=0) acc[3]=1,tot=1; for(let r=0;r<4;r++) col[i*4+r]=acc[r]/tot; let best=0; for(let r=1;r<4;r++) if(acc[r]>acc[best]) best=r; stats[best]++; }
  const old=prim.getAttribute('COLOR_0'); if(old){ prim.setAttribute('COLOR_0',null); } const c1=prim.getAttribute('COLOR_1'); if(c1) prim.setAttribute('COLOR_1',null);
  const acc=doc.createAccessor('kitRegion').setType('VEC4').setArray(col).setBuffer(root.listBuffers()[0]); prim.setAttribute('COLOR_0',acc);
  for(const s of ['TEXCOORD_1','TEXCOORD_2','TEXCOORD_3']) if(prim.getAttribute(s)) prim.setAttribute(s,null); } }
for(const mesh of root.listMeshes()){ if(mesh.getName()==='Body') continue; for(const prim of mesh.listPrimitives()) for(const s of ['COLOR_0','COLOR_1','TEXCOORD_1','TEXCOORD_2','TEXCOORD_3']) if(prim.getAttribute(s)) prim.setAttribute(s,null); }
console.log('vértices por região (camisola, calções, meias, pele):',stats.join(', '));
const made=transferClips(ual,doc);
await doc.transform(dedup(), prune(), resample({tolerance:5e-4}), quantize({quantizePosition:14,quantizeNormal:10,quantizeTexcoord:12,quantizeWeight:8,quantizeColor:8}), meshopt({encoder:MeshoptEncoder,level:'high'}));
fs.mkdirSync('public/assets/characters',{recursive:true}); await io.write(out,doc);
const tris=root.listMeshes().reduce((t,m)=>t+m.listPrimitives().reduce((s,p)=>s+(p.getIndices()?p.getIndices().getCount()/3:0),0),0);
const mp='src/assets/manifest.json'; const man=JSON.parse(fs.readFileSync(mp,'utf8'));
man.characters[name]={path:out.replace('public/',''),lods:{},bytes:fs.statSync(out).size,tris,joints:joints.length,skeleton:'mixamo-like',license:'CC0 (Quaternius Universal Base Characters + UAL)',skins:{},kits:{},animations:made,textures:root.listTextures().map(t=>t.getName()||''),meta:{source:bodyPath.split('/').pop(),kitShader:true}};
fs.writeFileSync(mp,JSON.stringify(man,null,1));
console.log('clips',made.length,'| tris',tris,'| texturas',root.listTextures().length,'| bytes',fs.statSync(out).size);
