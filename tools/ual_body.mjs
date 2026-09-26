// Constrói uma personagem do jogo a partir de um Universal Base Character (Quaternius, CC0) + animações da UAL:
// ossos renomeados, clips do jogo, regiões de equipamento em COLOR_0 (camisola, calções, meias, pele), compressão meshopt.
import { NodeIO } from '@gltf-transform/core';
import { prune, resample, quantize, dedup, meshopt, mergeDocuments, simplify, cloneDocument } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import fs from 'fs';
import { renameBones, transferClips } from './ual_common.mjs';
const [,, bodyPath, name] = process.argv; if(!bodyPath||!name){ console.error('uso: node tools/ual_body.mjs <corpo.gltf> <nome>'); process.exit(1); }
const out=`public/assets/characters/${name}.glb`;
await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io=new NodeIO().registerExtensions([EXTMeshoptCompression]).registerDependencies({'meshopt.encoder':MeshoptEncoder});
const doc=await io.read(bodyPath); const root=doc.getRoot();
const ual=await new NodeIO().read((process.env.UAL1||'assets/src/quaternius/ual/UAL1.glb')); renameBones(ual);
renameBones(doc);
// ── um só esqueleto ───────────────────────────────────────────────────────────
// O export dos Universal Base Characters traz uma armadura POR MALHA (corpo, olhos, sobrancelhas),
// ou seja, o mesmo osso aparece várias vezes com o mesmo nome. O GLTFLoader do three.js desambigua
// nomes repetidos ('LeftArm' -> 'LeftArm_1') e as animações passam a apontar para cópias a que
// nada está preso: os braços ficam presos na pose de repouso (em T). Colapsar antes de tudo o resto.
{ const skins=root.listSkins();
  if(skins.length>1){ const keep=skins[0];
    for(const s of skins.slice(1)){ for(const n of root.listNodes()) if(n.getSkin()===s) n.setSkin(keep); s.dispose(); }
    const keepAll=new Set(keep.listJoints());
    const parentOf=new Map(); for(const n of root.listNodes()) for(const c of n.listChildren()) parentOf.set(c,n);
    for(const j of keep.listJoints()){ let p=parentOf.get(j); while(p&&!keepAll.has(p)){ keepAll.add(p); p=parentOf.get(p); } }
    const boneNames=new Set(keep.listJoints().map(j=>j.getName()));
    let dropped=0; for(const n of root.listNodes()){ if(keepAll.has(n)||n.getMesh()) continue; if(boneNames.has(n.getName())){ n.dispose(); dropped++; } }
    console.log('esqueletos colapsados:',skins.length,'->1; ossos duplicados removidos:',dropped);
  } }
// materiais/malhas por classe
for(const m of root.listMaterials()){ const nm=m.getName(); if(/hair/i.test(nm)) m.setName('hair'); else if(/eye/i.test(nm)) m.setName('eyes'); else m.setName('skin'); }
for(const mesh of root.listMeshes()){ const mat=mesh.listPrimitives()[0].getMaterial(); const mn=mat?mat.getName():''; mesh.setName(mn==='hair'?'Hair':mn==='eyes'?'Eyes':'Body'); }
for(const n of root.listNodes()){ const me=n.getMesh(); if(me) n.setName(me.getName()); }
// posições dos ossos na pose de repouso (espaço da malha)
const world=new Map(); { const mats=new Map(); const mul=(a,b)=>{const o=new Array(16).fill(0);for(let r=0;r<4;r++)for(let c=0;c<4;c++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;};
  const visit=(n,pm)=>{ const m=mul(pm,n.getMatrix()); mats.set(n,m); world.set(n.getName(),[m[12],m[13],m[14]]); for(const c of n.listChildren()) visit(c,m); };
  for(const s of root.listScenes()) for(const n of s.listChildren()) visit(n,[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]); }
const P=(k)=>world.get(k)||[0,0,0];
// regiões: [camisola, calções, meias, pele]  — cortes GEOMÉTRICOS na pose de repouso (não por identidade de osso),
// para as fronteiras caírem sempre no mesmo sítio independentemente da diluição dos pesos do skin.
const skin=root.listSkins()[0]; const joints=skin.listJoints().map(j=>j.getName());
const along=(v,a,b)=>{ const ax=b[0]-a[0],ay=b[1]-a[1],az=b[2]-a[2]; const L=ax*ax+ay*ay+az*az||1; return ((v[0]-a[0])*ax+(v[1]-a[1])*ay+(v[2]-a[2])*az)/L; };
// afinação do fato (fração ao longo do osso; HEM em metros acima da anca)
const CUT={ hem:+0.02, sleeve:0.55, shorts:0.62 };
const waistY=P('Hips')[1]+CUT.hem;           // bainha da camisola: plano horizontal -> linha reta à cintura
function regionOf(bone,v){
  switch(bone){
    // tronco e anca: o que decide é a altura, não o osso -> bainha nítida e reta
    case 'Spine': case 'Spine1': case 'Spine2': case 'LeftShoulder': case 'RightShoulder': case 'Hips': case 'Neck': case 'Head':
      return (bone==='Neck'||bone==='Head')?3:(v[1]>=waistY?0:1);
    case 'LeftArm': return along(v,P('LeftArm'),P('LeftForeArm'))<CUT.sleeve?0:3;
    case 'RightArm': return along(v,P('RightArm'),P('RightForeArm'))<CUT.sleeve?0:3;
    case 'LeftUpLeg': return along(v,P('LeftUpLeg'),P('LeftLeg'))<CUT.shorts?1:3;
    case 'RightUpLeg': return along(v,P('RightUpLeg'),P('RightLeg'))<CUT.shorts?1:3;
    case 'LeftLeg': case 'RightLeg': case 'LeftFoot': case 'RightFoot': case 'LeftToeBase': case 'RightToeBase': return 2;
    default: return 3; } }
let stats=[0,0,0,0];
for(const mesh of root.listMeshes()){ if(mesh.getName()!=='Body') continue; for(const prim of mesh.listPrimitives()){
  const pos=prim.getAttribute('POSITION'), J=prim.getAttribute('JOINTS_0'), W=prim.getAttribute('WEIGHTS_0'); const n=pos.getCount(); const col=new Float32Array(n*4); const v=[0,0,0],j=[0,0,0,0],w=[0,0,0,0];
  for(let i=0;i<n;i++){ pos.getElement(i,v); J.getElement(i,j); W.getElement(i,w); const acc=[0,0,0,0]; let tot=0; for(let k=0;k<4;k++){ if(w[k]<=0) continue; const r=regionOf(joints[j[k]],v); acc[r]+=w[k]; tot+=w[k]; } if(tot<=0) acc[3]=1,tot=1;
    // UMA região por vértice (a de maior peso): o vetor fica one-hot, logo a interpolação
    // só acontece dentro do triângulo que atravessa a fronteira -> linha nítida no shader
    let best=0; for(let r=1;r<4;r++) if(acc[r]>acc[best]) best=r; for(let r=0;r<4;r++) col[i*4+r]=(r===best)?1:0; stats[best]++; }
  const old=prim.getAttribute('COLOR_0'); if(old){ prim.setAttribute('COLOR_0',null); } const c1=prim.getAttribute('COLOR_1'); if(c1) prim.setAttribute('COLOR_1',null);
  const acc=doc.createAccessor('kitRegion').setType('VEC4').setArray(col).setBuffer(root.listBuffers()[0]); prim.setAttribute('COLOR_0',acc);
  for(const s of ['TEXCOORD_1','TEXCOORD_2','TEXCOORD_3']) if(prim.getAttribute(s)) prim.setAttribute(s,null); } }
for(const mesh of root.listMeshes()){ if(mesh.getName()==='Body') continue; for(const prim of mesh.listPrimitives()) for(const s of ['COLOR_0','COLOR_1','TEXCOORD_1','TEXCOORD_2','TEXCOORD_3']) if(prim.getAttribute(s)) prim.setAttribute(s,null); }
console.log('vértices por região (camisola, calções, meias, pele):',stats.join(', '));

// ── penteados ─────────────────────────────────────────────────────────────────
// Os glTFs dos penteados trazem o MESMO esqueleto de 65 ossos, por isso basta fundi-los
// e religar o skin aos ossos do corpo. Reaproveitam o material de cabelo que o corpo já tem
// (macho T_Hair_1, fêmea T_Hair_2, ambos já reduzidos) -> não acrescentam texturas nenhumas.
// No jogo cada malha fica escondida e o CharacterInstance mostra só a escolhida.
const HAIR={ ubc_male:['Hair_Buzzed','Hair_SimpleParted','Hair_Beard'], ubc_female:['Hair_Long','Hair_Buns'] };
const bodySkin=root.listSkins()[0];
const bodyScene=root.listScenes()[0];
const hairMat=root.listMaterials().find(m=>m.getName()==='hair');
for(const style of (HAIR[name]||[])){
  const hp=`assets/src/quaternius/ubc/hair/${style}.gltf`;
  if(!fs.existsSync(hp)){ console.warn('penteado em falta:',hp); continue; }
  const hd=await new NodeIO().read(hp); renameBones(hd);
  const srcSkin=hd.getRoot().listSkins()[0];
  const srcNode=hd.getRoot().listNodes().find(n=>n.getMesh()&&n.getSkin());
  if(!srcSkin||!srcNode){ console.warn('penteado sem malha com skin:',style); continue; }
  const srcScenes=hd.getRoot().listScenes();
  const map=mergeDocuments(doc,hd);
  const dstNode=map.get(srcNode);
  // religar ao esqueleto do corpo: mesmos nomes de osso, mesma ordem, matrizes de bind do penteado
  const byName=new Map(bodySkin.listJoints().map(j=>[j.getName(),j]));
  const newSkin=doc.createSkin(style).setInverseBindMatrices(map.get(srcSkin.getInverseBindMatrices()));
  let missing=0;
  for(const j of srcSkin.listJoints()){ const b=byName.get(j.getName()); if(b) newSkin.addJoint(b); else missing++; }
  if(missing){ console.warn(style,'- ossos sem correspondência:',missing); }
  dstNode.setSkin(newSkin).setName(style);
  const dstMesh=dstNode.getMesh(); dstMesh.setName(style);
  for(const prim of dstMesh.listPrimitives()){
    if(hairMat) prim.setMaterial(hairMat);                       // reaproveita textura+material do corpo
    for(const s of ['COLOR_0','COLOR_1','TEXCOORD_1','TEXCOORD_2','TEXCOORD_3']) if(prim.getAttribute(s)) prim.setAttribute(s,null);
  }
  bodyScene.addChild(dstNode);                                    // passa para a cena do corpo
  // Fora TUDO o que a fusão trouxe menos a malha: o penteado traz uma cópia completa da armadura
  // de 65 ossos e, com nomes repetidos, o GLTFLoader desambigua-os ('LeftArm' -> 'LeftArm_1') e as
  // animações deixam de encontrar os ossos certos — os braços ficariam presos na pose em T.
  { const skinDup=map.get(srcSkin); if(skinDup&&skinDup!==newSkin) skinDup.dispose();
    for(const sc of srcScenes){ const d=map.get(sc); if(d) d.dispose(); }
    let dropped=0;
    for(const sn of hd.getRoot().listNodes()){ const d=map.get(sn); if(d&&d!==dstNode&&!d.getMesh()){ d.dispose(); dropped++; } }
    console.log('penteado',style,'ligado ao esqueleto do corpo; ossos duplicados descartados:',dropped); }
}

// fundir traz buffers próprios de cada penteado; um GLB só admite um
{ const buf0=root.listBuffers()[0]; for(const a of root.listAccessors()) a.setBuffer(buf0); for(const b of root.listBuffers()) if(b!==buf0) b.dispose(); }

const made=transferClips(ual,doc);
await doc.transform(dedup(), prune(), resample({tolerance:5e-4}), quantize({quantizePosition:14,quantizeNormal:10,quantizeTexcoord:12,quantizeWeight:8,quantizeColor:8}), meshopt({encoder:MeshoptEncoder,level:'high'}));
fs.mkdirSync('public/assets/characters',{recursive:true});
// LOD1 (~45% dos triângulos) para os inimigos ao longe: 16 corpos a 14k triângulos aquecem o telemóvel.
// As malhas do LOD sao religadas ao esqueleto do LOD0 no Character.js, logo aqui nao sao precisas animacoes.
const lodDoc=cloneDocument(doc);
for(const a of lodDoc.getRoot().listAnimations()) a.dispose();
for(const t of lodDoc.getRoot().listTextures()) t.dispose();   // o LOD usa o material da instância (Character.js), as texturas aqui só pesavam
await lodDoc.transform(simplify({simplifier:MeshoptSimplifier,ratio:0.45,error:0.005,lockBorder:true}), dedup(), prune(),
  quantize({quantizePosition:14,quantizeNormal:10,quantizeTexcoord:12,quantizeWeight:8,quantizeColor:8}), meshopt({encoder:MeshoptEncoder,level:'high'}));
const outLod1=`public/assets/characters/${name}_lod1.glb`; await io.write(outLod1,lodDoc);
const lodTris=lodDoc.getRoot().listMeshes().reduce((t,m)=>t+m.listPrimitives().reduce((s2,p)=>s2+(p.getIndices()?p.getIndices().getCount()/3:0),0),0);
console.log('LOD1:',lodTris,'triângulos |',fs.statSync(outLod1).size,'bytes');
await io.write(out,doc);
const tris=root.listMeshes().reduce((t,m)=>t+m.listPrimitives().reduce((s,p)=>s+(p.getIndices()?p.getIndices().getCount()/3:0),0),0);
const mp='src/assets/manifest.json'; const man=JSON.parse(fs.readFileSync(mp,'utf8'));
man.characters[name]={path:out.replace('public/',''),lods:{lod1:outLod1.replace('public/','')},bytes:fs.statSync(out).size,tris,joints:joints.length,skeleton:'mixamo-like',license:'CC0 (Quaternius Universal Base Characters + UAL)',skins:{},kits:{},animations:made,textures:root.listTextures().map(t=>t.getName()||''),meta:{source:bodyPath.split('/').pop(),kitShader:true,hairStyles:(HAIR[name]||[]).filter(s=>root.listMeshes().some(m=>m.getName()===s))}};
fs.writeFileSync(mp,JSON.stringify(man,null,1));
console.log('clips',made.length,'| tris',tris,'| texturas',root.listTextures().length,'| bytes',fs.statSync(out).size);
