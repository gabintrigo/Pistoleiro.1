// Constrói a personagem do jogo a partir da Universal Animation Library (Quaternius, CC0):
// ossos renomeados para a convenção do jogo, clips separados em pernas/tronco com os nomes que o código usa, compressão meshopt.
import { NodeIO } from '@gltf-transform/core';
import { prune, resample, quantize, dedup, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import fs from 'fs';
const src=process.argv[2]||'/mnt/user-data/uploads/UAL1.glb', out=process.argv[3]||'public/assets/characters/ual_mannequin.glb';
const RENAME={pelvis:'Hips',spine_01:'Spine',spine_02:'Spine1',spine_03:'Spine2',neck_01:'Neck',Head:'Head',clavicle_l:'LeftShoulder',upperarm_l:'LeftArm',lowerarm_l:'LeftForeArm',hand_l:'LeftHand',clavicle_r:'RightShoulder',upperarm_r:'RightArm',lowerarm_r:'RightForeArm',hand_r:'RightHand',thigh_l:'LeftUpLeg',calf_l:'LeftLeg',foot_l:'LeftFoot',ball_l:'LeftToeBase',thigh_r:'RightUpLeg',calf_r:'RightLeg',foot_r:'RightFoot',ball_r:'RightToeBase'};
const LOWER=new Set(['root','Hips','LeftUpLeg','LeftLeg','LeftFoot','LeftToeBase','RightUpLeg','RightLeg','RightFoot','RightToeBase']);
// nome no jogo → [clip de origem, parte]  parte: lower | upper | full
const MAP={idle:['Idle_Loop','lower'],idle_upper:['Idle_Loop','upper'],walk:['Walk_Loop','lower'],walk_upper:['Walk_Loop','upper'],jog:['Jog_Fwd_Loop','lower'],jog_upper:['Jog_Fwd_Loop','upper'],sprint:['Sprint_Loop','lower'],sprint_upper:['Sprint_Loop','upper'],
 strafe_left:['Jog_Left_Loop','lower'],strafe_right:['Jog_Right_Loop','lower'],back:['Jog_Bwd_Loop','lower'],crouch:['Crouch_Idle_Loop','lower'],crouch_walk:['Crouch_Fwd_Loop','lower'],
 aim:['Pistol_Aim_Neutral','upper'],aim_up:['Pistol_Aim_Up','upper'],aim_down:['Pistol_Aim_Down','upper'],pistol_idle:['Pistol_Idle_Loop','upper'],shoot:['Pistol_Shoot','upper'],reload:['Pistol_Reload','upper'],throw:['Punch_Cross','upper'],hit:['Hit_Chest','upper'],hit_head:['Hit_Head','upper'],hit_l:['Hit_Shoulder_L','upper'],hit_r:['Hit_Shoulder_R','upper'],
 death:['Death01','full'],death_back:['Death02','full'],headshot:['Death02','full'],roll:['Roll','full'],dodge_left:['Dodge_Left','full'],dodge_right:['Dodge_Right','full'],celebrate:['Celebration','full'],climb:['Climb_Up_Loop','full'],climb_idle:['Climb_Idle_Loop','full'],jump:['Jump_Loop','full'],land:['Jump_Land','full'],kick:['Kick','full'],tpose:['A_TPose','full']};
const FING=/^(index|middle|pinky|ring|thumb)_|_leaf_/;
await MeshoptEncoder.ready;
const io=new NodeIO().registerExtensions([EXTMeshoptCompression]).registerDependencies({'meshopt.encoder':MeshoptEncoder});
const doc=await io.read(src); const root=doc.getRoot();
// 1) ossos
for(const n of root.listNodes()){ const nm=n.getName(); if(RENAME[nm]) n.setName(RENAME[nm]); }
// 2) clips: retira dedos, cria clips do jogo, remove os originais
const srcAnims=new Map(root.listAnimations().map(a=>[a.getName(),a]));
const made=[];
for(const [game,[srcName,part]] of Object.entries(MAP)){
  const a=srcAnims.get(srcName); if(!a){ console.warn('falta',srcName); continue; }
  const na=doc.createAnimation(game);
  for(const ch of a.listChannels()){ const tn=ch.getTargetNode(); if(!tn) continue; const bn=tn.getName(); if(FING.test(bn)) continue;
    const isLower=LOWER.has(bn); if(part==='lower'&&!isLower) continue; if(part==='upper'&&isLower) continue;
    const s=ch.getSampler(); const ns=doc.createAnimationSampler().setInput(s.getInput()).setOutput(s.getOutput()).setInterpolation(s.getInterpolation());
    const nc=doc.createAnimationChannel().setTargetNode(tn).setTargetPath(ch.getTargetPath()).setSampler(ns); na.addSampler(ns); na.addChannel(nc); }
  made.push(game); }
for(const a of srcAnims.values()){ for(const ch of a.listChannels()){ const s=ch.getSampler(); ch.dispose(); if(s) s.dispose(); } a.dispose(); }
// 3) materiais: manequim → 'kit' (cor da equipa) e 'skin' (tom de pele)
for(const m of root.listMaterials()){ const nm=m.getName(); if(nm==='M_Main') m.setName('kit'); else if(nm==='M_Joints') m.setName('skin'); }
for(const m of root.listMeshes()) m.setName('Body');
await doc.transform(dedup(), prune(), resample({tolerance:5e-4}), quantize({quantizePosition:14,quantizeNormal:10,quantizeTexcoord:12,quantizeWeight:8}), meshopt({encoder:MeshoptEncoder,level:'high'}));
fs.mkdirSync('public/assets/characters',{recursive:true}); await io.write(out,doc);
const joints=root.listSkins()[0].listJoints().length, tris=root.listMeshes().reduce((t,m)=>t+m.listPrimitives().reduce((s,p)=>s+(p.getIndices()?p.getIndices().getCount()/3:0),0),0);
// 4) manifesto
const mp='src/assets/manifest.json'; const man=JSON.parse(fs.readFileSync(mp,'utf8'));
man.characters.ual_mannequin={path:'assets/characters/ual_mannequin.glb',lods:{},bytes:fs.statSync(out).size,tris,joints,skeleton:'mixamo-like',license:'CC0 (Quaternius Universal Animation Library)',skins:{},kits:{},animations:made,textures:[],meta:{source:'UAL1 Source',flatKit:true}};
fs.writeFileSync(mp,JSON.stringify(man,null,1));
console.log('clips',made.length,'| ossos',joints,'| tris',tris,'| bytes',fs.statSync(out).size);
