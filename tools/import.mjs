/**
 * Asset pipeline (Fase 3): assets/src (raw) -> public/assets (runtime) + src/assets/manifest.json
 *  GLB   : dedup, prune, weld, resample, LOD generation (meshoptimizer), EXT_meshopt_compression
 *  Images: resize to budget, KTX2 (ETC1S colour / UASTC normals) via toktx (KTX-Software)
 *  HDRI  : copied (RGBE)
 * Every entry records its licence. Run: node tools/import.mjs
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, resample, meshopt, quantize, cloneDocument } from '@gltf-transform/functions';
import { PropertyType } from '@gltf-transform/core';
import { MeshoptEncoder, MeshoptSimplifier, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const SRC=path.join(ROOT,'assets/src'), OUT=path.join(ROOT,'public/assets');
const KTXBIN=path.join(ROOT,'tools/bin/ktx/bin'), GLTFX=path.join(ROOT,'node_modules/.bin/gltf-transform');
const env={...process.env,PATH:KTXBIN+':'+process.env.PATH,LD_LIBRARY_PATH:path.join(ROOT,'tools/bin/ktx/lib')};
for(const d of ['characters','modules','materials','hdri','textures'])fs.mkdirSync(path.join(OUT,d),{recursive:true});
const manifest={generated:new Date().toISOString(),licenses:{
  human_base:'CC0 — MakeHuman base mesh/targets/rig (MPFB2) and eyes; textures and animations generated in Blender for this project',
  modules:'CC0 — authored procedurally in Blender for this project',
  materials:'CC0 — baked from procedural Blender materials for this project',
  hdri:'CC0 — physical sky rendered in Blender for this project',
  tools:'toktx (KTX-Software) Apache-2.0 and gltf-transform MIT are build tools only, not shipped'},
  characters:{},modules:{},weapons:{},materials:{},hdri:{},textures:{}};
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
await MeshoptEncoder.ready; await MeshoptSimplifier.ready; await MeshoptDecoder.ready;
const kb=b=>Math.round(b/1024), log=(...a)=>console.log('[import]',...a);
const gltfx=(args)=>execFileSync(GLTFX,args,{env,stdio:'pipe'});
async function toKtx2(pngPath,outPath,{normal=false,linear=false,size=null,quality=128}={}){
  let src=pngPath;
  if(size){src=outPath+'.tmp.png';await sharp(pngPath).resize(size,size,{fit:'fill'}).png().toFile(src);}
  const args=['--t2','--genmipmap'];
  if(normal)args.push('--encode','uastc','--uastc_quality','1','--zcmp','18','--assign_oetf','linear','--assign_primaries','none');
  else args.push('--encode','etc1s','--clevel','2','--qlevel',String(quality),'--assign_oetf',linear?'linear':'srgb');
  args.push(outPath,src);execFileSync(path.join(KTXBIN,'toktx'),args,{env,stdio:'pipe'});
  if(src!==pngPath)fs.unlinkSync(src);return fs.statSync(outPath).size;
}
/* toktx (KTX2) may be missing after an environment reset: keep the previously built character/material outputs and manifest entries */
const PREV=(()=>{try{return JSON.parse(fs.readFileSync(path.resolve('src/assets/manifest.json'),'utf8'));}catch(e){return null;}})();
const HAVE_TOKTX=fs.existsSync(path.resolve('tools/bin/ktx/bin/toktx'));
if(!HAVE_TOKTX&&PREV){ log('toktx missing: keeping previous character/material/texture outputs'); Object.assign(manifest,{characters:PREV.characters||{},materials:PREV.materials||{},textures:PREV.textures||{}}); }
/* ---------------- character ---------------- */
if(HAVE_TOKTX||!PREV){
{
  const src0=path.join(SRC,'character/human_base.glb'),src=path.join(OUT,'characters/_src.glb'),tmp=path.join(OUT,'characters/_tmp.glb'),out=path.join(OUT,'characters/human_base.glb');
  { // pre-pass: downsize the normal map to 1024 (mobile budget) before compression
    const d=await io.read(src0);for(const t of d.getRoot().listTextures()){ if(/normal/i.test(t.getName())){ const img=await sharp(Buffer.from(t.getImage())).resize(1024,1024).png().toBuffer(); t.setImage(new Uint8Array(img)); } }
    // layered animation: the exporter bakes every bone into every clip; keep only the layer's bones so the runtime can
    // blend a lower-body clip with an upper-body clip without each one dragging the other half toward the rest pose
    const LOWER=new Set(['Hips','LeftUpLeg','LeftLeg','LeftFoot','LeftToeBase','RightUpLeg','RightLeg','RightFoot','RightToeBase']);
    const UPPER=new Set(['Spine','Spine1','Spine2','Neck','Head','LeftShoulder','LeftArm','LeftForeArm','LeftHand','RightShoulder','RightArm','RightForeArm','RightHand']);
    const layerOf=n=>/_upper$|^(aim|shoot|reload|hit)$/.test(n)?'upper':/^(idle|walk|jog|sprint|strafe_left|strafe_right)$/.test(n)?'lower':'full';
    let dropped=0;
    for(const anim of d.getRoot().listAnimations()){ const layer=layerOf(anim.getName()); const allowed=layer==='upper'?UPPER:layer==='lower'?LOWER:new Set([...LOWER,...UPPER]);
      for(const ch of anim.listChannels()){ const node=ch.getTargetNode(); const bone=(node?node.getName():'').replace(/^mixamorig:?/,''); const path=ch.getTargetPath();
        const keep=allowed.has(bone)&&(path==='rotation'||(path==='translation'&&bone==='Hips'&&layer!=='upper'));
        if(!keep){ anim.removeChannel(ch); ch.dispose(); dropped++; } } }
    console.log('[import] animation channels dropped',dropped,'kept',d.getRoot().listAnimations().map(a=>a.getName()+':'+a.listChannels().length).join(' '));
    await d.transform(prune());
    await io.write(src,d);
  }
  gltfx(['dedup',src,tmp]);gltfx(['prune',tmp,tmp,'--keep-attributes']);gltfx(['weld',tmp,tmp]);gltfx(['resample',tmp,tmp]);
  gltfx(['resize',tmp,tmp,'--width','2048','--height','2048']);
  gltfx(['uastc',tmp,tmp,'--slots','normalTexture','--level','2','--zstd','18','--jobs','1']);
  gltfx(['etc1s',tmp,tmp,'--slots','{baseColorTexture,emissiveTexture}','--quality','180','--jobs','1']);
  gltfx(['meshopt',tmp,out,'--level','medium']);fs.unlinkSync(tmp);
  const doc=await io.read(src);fs.unlinkSync(src);
  const lods={};
  for(const [name,ratio] of [['lod1',0.45],['lod2',0.2]]){
    const d=cloneDocument(doc);
    for(const t of d.getRoot().listTextures())t.dispose();
    for(const a of d.getRoot().listAnimations())a.dispose();
    await d.transform(simplify({simplifier:MeshoptSimplifier,ratio,error:0.012,lockBorder:true}),prune({keepAttributes:true}),meshopt({encoder:MeshoptEncoder,level:'medium'}));
    const p=path.join(OUT,'characters/human_base_'+name+'.glb');await io.write(p,d);lods[name]='assets/characters/human_base_'+name+'.glb';log('lod',name,kb(fs.statSync(p).size),'KB');
  }
  const stats=await gltfStats(out);
  manifest.characters.human_base={path:'assets/characters/human_base.glb',lods,bytes:fs.statSync(out).size,...stats,skeleton:'mixamo',license:'human_base',
    skins:{},kits:{},meta:JSON.parse(fs.readFileSync(path.join(SRC,'character/human_base.meta.json'),'utf8'))};
  for(const tone of ['tan','dark']){const p=path.join(OUT,'textures/skin_'+tone+'.ktx2');const b=await toKtx2(path.join(SRC,'character/skin_'+tone+'.png'),p,{size:1024,quality:160});manifest.characters.human_base.skins[tone]='assets/textures/skin_'+tone+'.ktx2';log('skin',tone,kb(b),'KB');}
  for(const f of fs.readdirSync(path.join(SRC,'character')).filter(f=>f.startsWith('kit_')&&f.endsWith('.png'))){
    const id=f.replace('.png','');const p=path.join(OUT,'textures/'+id+'.ktx2');const b=await toKtx2(path.join(SRC,'character',f),p,{size:512,quality:150});manifest.characters.human_base.kits[id]='assets/textures/'+id+'.ktx2';}
  log('character',kb(fs.statSync(out).size),'KB',stats);
}
}
/* ---------------- modules ---------------- */
for(const f of fs.readdirSync(path.join(SRC,'modules')).filter(f=>f.endsWith('.glb'))){
  const id=f.replace('.glb','');const doc=await io.read(path.join(SRC,'modules',f));
  // baked AO arrives too dark (overlapping parts fully occlude) -> remap to a gentle tint: 0.5 + 0.5*sqrt(ao)
  for(const m of doc.getRoot().listMeshes())for(const pr of m.listPrimitives()){const c=pr.getAttribute('COLOR_0');if(!c)continue;const el=[];for(let i=0;i<c.getCount();i++){c.getElement(i,el);for(let k=0;k<3;k++)el[k]=0.5+0.5*Math.sqrt(Math.max(0,el[k]));c.setElement(i,el);}}
  // modules are instanced from their raw geometry: keep float attributes and identity node transforms (no quantisation / meshopt)
  await doc.transform(dedup({propertyTypes:[PropertyType.ACCESSOR,PropertyType.MESH]}),weld(),prune({keepAttributes:true,keepLeaves:true}));
  const p=path.join(OUT,'modules',f);await io.write(p,doc);
  const mats=doc.getRoot().listMaterials().map(m=>m.getName());
  let tris=0;for(const m of doc.getRoot().listMeshes())for(const pr of m.listPrimitives()){const idx=pr.getIndices();tris+=(idx?idx.getCount():pr.getAttribute('POSITION').getCount())/3;}
  manifest.modules[id]={path:'assets/modules/'+f,bytes:fs.statSync(p).size,tris:Math.round(tris),materials:mats,license:'modules'};
}
log('modules',Object.keys(manifest.modules).length);
/* ---------------- weapons (same treatment as modules; keep the 'tip'/'eject' empty nodes) ---------------- */
fs.mkdirSync(path.join(OUT,'weapons'),{recursive:true});
if(fs.existsSync(path.join(SRC,'weapons'))) for(const f of fs.readdirSync(path.join(SRC,'weapons')).filter(f=>f.endsWith('.glb'))){
  const id=f.replace('.glb','');const doc=await io.read(path.join(SRC,'weapons',f));
  // as cores de vértice (AO + desgaste) já vêm finais do Blender (build_weapons.py)
  await doc.transform(dedup({propertyTypes:[PropertyType.ACCESSOR,PropertyType.MESH]}),weld(),prune({keepAttributes:true,keepLeaves:true}));
  const p=path.join(OUT,'weapons',f);await io.write(p,doc);
  manifest.weapons[id]={path:'assets/weapons/'+f,bytes:fs.statSync(p).size,nodes:doc.getRoot().listNodes().map(n=>n.getName()),license:'modules'};
}
log('weapons',Object.keys(manifest.weapons).length);
/* ---------------- sound bank (already final WAVs) ---------------- */
fs.mkdirSync(path.join(OUT,'sfx'),{recursive:true});manifest.sfx={};
if(fs.existsSync(path.join(SRC,'sfx'))) for(const f of fs.readdirSync(path.join(SRC,'sfx')).filter(f=>f.endsWith('.wav'))){ fs.copyFileSync(path.join(SRC,'sfx',f),path.join(OUT,'sfx',f)); manifest.sfx[f.replace('.wav','')]={path:'assets/sfx/'+f,bytes:fs.statSync(path.join(SRC,'sfx',f)).size,license:'modules'}; }
// real recordings (CC0 or licensed by the project owner) override the synthesized ones by base name
if(fs.existsSync(path.join(SRC,'sfx_real'))) for(const f of fs.readdirSync(path.join(SRC,'sfx_real')).filter(f=>/\.(wav|mp3|ogg|m4a)$/i.test(f))){ const id=f.replace(/\.[^.]+$/,''); const old=manifest.sfx[id]; if(old&&fs.existsSync(path.join(OUT,old.path.replace('assets/','')))) fs.unlinkSync(path.join(OUT,old.path.replace('assets/',''))); fs.copyFileSync(path.join(SRC,'sfx_real',f),path.join(OUT,'sfx',f)); manifest.sfx[id]={path:'assets/sfx/'+f,bytes:fs.statSync(path.join(SRC,'sfx_real',f)).size,license:'real'}; }
log('sfx',Object.keys(manifest.sfx).length);
/* ---------------- materials ---------------- */
if(HAVE_TOKTX||!PREV){
for(const f of fs.readdirSync(path.join(SRC,'materials')).filter(f=>f.endsWith('_color.png'))){
  const id=f.replace('_color.png','');const size=id==='grass'?1024:512;const entry={license:'materials'};
  for(const kind of ['color','normal','rough']){
    const inp=path.join(SRC,'materials',id+'_'+kind+'.png');if(!fs.existsSync(inp))continue;
    const p=path.join(OUT,'materials',id+'_'+kind+'.ktx2');const b=await toKtx2(inp,p,{normal:kind==='normal',linear:kind!=='color',size,quality:kind==='color'?140:96});
    entry[kind]='assets/materials/'+id+'_'+kind+'.ktx2';entry[kind+'Bytes']=b;
  }
  manifest.materials[id]=entry;log('material',id,kb((entry.colorBytes||0)+(entry.normalBytes||0)+(entry.roughBytes||0)),'KB');
}
}
/* ---------------- hdri ---------------- */
for(const f of fs.readdirSync(path.join(SRC,'hdri')).filter(f=>f.endsWith('.hdr'))){
  const id=f.replace('.hdr','');fs.copyFileSync(path.join(SRC,'hdri',f),path.join(OUT,'hdri',f));manifest.hdri[id]={path:'assets/hdri/'+f,bytes:fs.statSync(path.join(OUT,'hdri',f)).size,license:'hdri'};
}
/* ---------------- manifest ---------------- */
fs.mkdirSync(path.join(ROOT,'src/assets'),{recursive:true});
fs.writeFileSync(path.join(ROOT,'src/assets/manifest.json'),JSON.stringify(manifest,null,1));
let total=0;const walk=d=>{for(const f of fs.readdirSync(d)){const p=path.join(d,f);const s=fs.statSync(p);if(s.isDirectory())walk(p);else total+=s.size;}};walk(OUT);
log('done, runtime assets total',kb(total),'KB');
async function gltfStats(p){const d=await io.read(p);let tris=0,verts=0;for(const m of d.getRoot().listMeshes())for(const pr of m.listPrimitives()){const idx=pr.getIndices();tris+=(idx?idx.getCount():pr.getAttribute('POSITION').getCount())/3;verts+=pr.getAttribute('POSITION').getCount();}
  return {tris:Math.round(tris),verts,textures:d.getRoot().listTextures().map(t=>t.getName()||t.getURI()),animations:d.getRoot().listAnimations().map(a=>a.getName()),joints:d.getRoot().listSkins().reduce((n,s)=>n+s.listJoints().length,0)};}
