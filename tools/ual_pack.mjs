// Empacota a Universal Animation Library (Quaternius, CC0) para o jogo: só as animações úteis, comprimidas.
import { NodeIO } from '@gltf-transform/core';
import { prune, resample, quantize, dedup, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
const KEEP=['A_TPose','Idle_Loop','Idle_LookAround_Loop','Walk_Loop','Jog_Fwd_Loop','Jog_Bwd_Loop','Jog_Left_Loop','Jog_Right_Loop','Jog_Fwd_L_Loop','Jog_Fwd_R_Loop','Jog_Bwd_L_Loop','Jog_Bwd_R_Loop','Sprint_Loop','Sprint_Enter','Sprint_Exit',
 'Crouch_Idle_Loop','Crouch_Fwd_Loop','Crouch_Bwd_Loop','Crouch_Left_Loop','Crouch_Right_Loop','Crouch_Enter','Crouch_Exit',
 'Jump_Start','Jump_Loop','Jump_Land','Roll','Dodge_Left','Dodge_Right','Turn90_L','Turn90_R',
 'Pistol_Aim_Neutral','Pistol_Aim_Up','Pistol_Aim_Down','Pistol_Idle_Loop','Pistol_Reload','Pistol_Shoot',
 'Hit_Chest','Hit_Head','Hit_Shoulder_L','Hit_Shoulder_R','Hit_Stomach','Death01','Death02',
 'Climb_Up_Loop','Climb_Down_Loop','Climb_Idle_Loop','Climb_Enter','Climb_Exit','Celebration','Kick','Punch_Cross'];
const src=process.argv[2]||'/mnt/user-data/uploads/UAL1.glb', out=process.argv[3]||'assets/src/characters/ual_mannequin.glb';
await MeshoptEncoder.ready; const io=new NodeIO().registerExtensions([EXTMeshoptCompression]).registerDependencies({'meshopt.encoder':MeshoptEncoder}); const doc=await io.read(src); const root=doc.getRoot();
// altura antes de comprimir
{ let minY=1e9,maxY=-1e9; for(const m of root.listMeshes())for(const p of m.listPrimitives()){ const pos=p.getAttribute('POSITION'); const mn=pos.getMin([0,0,0]),mx=pos.getMax([0,0,0]); minY=Math.min(minY,mn[1]); maxY=Math.max(maxY,mx[1]); } console.log('altura do manequim',(maxY-minY).toFixed(2),'m, y de',minY.toFixed(2),'a',maxY.toFixed(2)); }
// retira as pistas dos dedos e dos ossos folha (não precisamos deles animados)
const FING=/^(index|middle|pinky|ring|thumb)_|_leaf_/; let dropped=0; for(const a of root.listAnimations()){ for(const ch of a.listChannels()){ const n=ch.getTargetNode(); if(n&&FING.test(n.getName())){ const smp=ch.getSampler(); ch.dispose(); if(smp)smp.dispose(); dropped++; } } }
console.log('pistas de dedos removidas',dropped);
let removed=0; for(const a of root.listAnimations()){ if(!KEEP.includes(a.getName())){ for(const ch of a.listChannels()){ const smp=ch.getSampler(); ch.dispose(); if(smp)smp.dispose(); } a.dispose(); removed++; } }
await doc.transform(dedup(), prune(), resample({tolerance:5e-4}), quantize({quantizePosition:14,quantizeNormal:10,quantizeTexcoord:12,quantizeWeight:8}), meshopt({encoder:MeshoptEncoder,level:'high'}));
const skin=root.listSkins()[0]; const joints=skin.listJoints().map(j=>j.getName());
await io.write(out,doc);
const fs=await import('fs'); console.log('mantidas',root.listAnimations().length,'removidas',removed,'| ossos',joints.length,'| bytes',fs.statSync(out).size);
