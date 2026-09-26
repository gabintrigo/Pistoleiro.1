// partilhado pelos construtores de personagem (Quaternius UAL / Universal Base Characters, CC0)
export const RENAME={pelvis:'Hips',spine_01:'Spine',spine_02:'Spine1',spine_03:'Spine2',neck_01:'Neck',Head:'Head',clavicle_l:'LeftShoulder',upperarm_l:'LeftArm',lowerarm_l:'LeftForeArm',hand_l:'LeftHand',clavicle_r:'RightShoulder',upperarm_r:'RightArm',lowerarm_r:'RightForeArm',hand_r:'RightHand',thigh_l:'LeftUpLeg',calf_l:'LeftLeg',foot_l:'LeftFoot',ball_l:'LeftToeBase',thigh_r:'RightUpLeg',calf_r:'RightLeg',foot_r:'RightFoot',ball_r:'RightToeBase'};
export const LOWER=new Set(['root','Hips','LeftUpLeg','LeftLeg','LeftFoot','LeftToeBase','RightUpLeg','RightLeg','RightFoot','RightToeBase']);
export const MAP={idle:['Idle_Loop','lower'],idle_upper:['Idle_Loop','upper'],walk:['Walk_Loop','lower'],walk_upper:['Walk_Loop','upper'],jog:['Jog_Fwd_Loop','lower'],jog_upper:['Jog_Fwd_Loop','upper'],sprint:['Sprint_Loop','lower'],sprint_upper:['Sprint_Loop','upper'],
 strafe_left:['Jog_Left_Loop','lower'],strafe_right:['Jog_Right_Loop','lower'],back:['Jog_Bwd_Loop','lower'],crouch:['Crouch_Idle_Loop','lower'],crouch_walk:['Crouch_Fwd_Loop','lower'],
 aim:['Pistol_Aim_Neutral','upper'],aim_up:['Pistol_Aim_Up','upper'],aim_down:['Pistol_Aim_Down','upper'],pistol_idle:['Pistol_Idle_Loop','upper'],shoot:['Pistol_Shoot','upper'],reload:['Pistol_Reload','upper'],throw:['Punch_Cross','upper'],hit:['Hit_Chest','upper'],hit_head:['Hit_Head','upper'],hit_l:['Hit_Shoulder_L','upper'],hit_r:['Hit_Shoulder_R','upper'],
 death:['Death01','full'],death_back:['Death02','full'],headshot:['Death02','full'],roll:['Roll','full'],dodge_left:['Dodge_Left','full'],dodge_right:['Dodge_Right','full'],celebrate:['Celebration','full'],climb:['Climb_Up_Loop','full'],climb_idle:['Climb_Idle_Loop','full'],jump:['Jump_Loop','full'],land:['Jump_Land','full'],kick:['Kick','full'],tpose:['A_TPose','full']};
export const FING=/^(index|middle|pinky|ring|thumb)_|_leaf_/;
/** copia as animações do documento UAL (já com ossos renomeados) para um documento destino com o mesmo esqueleto, por nome de nó */
export function transferClips(srcDoc, dstDoc){
  const dstNodes=new Map(dstDoc.getRoot().listNodes().map(n=>[n.getName(),n]));
  const srcAnims=new Map(srcDoc.getRoot().listAnimations().map(a=>[a.getName(),a]));
  const accCache=new Map(); const made=[];
  const copyAcc=(a)=>{ if(accCache.has(a)) return accCache.get(a); const buf=dstDoc.getRoot().listBuffers()[0]||dstDoc.createBuffer(); const na=dstDoc.createAccessor(a.getName()).setType(a.getType()).setArray(a.getArray().slice()).setNormalized(a.getNormalized()).setBuffer(buf); accCache.set(a,na); return na; };
  for(const [game,[srcName,part]] of Object.entries(MAP)){
    const a=srcAnims.get(srcName); if(!a){ console.warn('falta',srcName); continue; }
    const na=dstDoc.createAnimation(game); let n=0;
    for(const ch of a.listChannels()){ const tn=ch.getTargetNode(); if(!tn) continue; const bn=tn.getName(); if(FING.test(bn)) continue;
      const isLower=LOWER.has(bn); if(part==='lower'&&!isLower) continue; if(part==='upper'&&isLower) continue;
      const dn=dstNodes.get(bn); if(!dn) continue; const s=ch.getSampler();
      const ns=dstDoc.createAnimationSampler().setInput(copyAcc(s.getInput())).setOutput(copyAcc(s.getOutput())).setInterpolation(s.getInterpolation());
      const nc=dstDoc.createAnimationChannel().setTargetNode(dn).setTargetPath(ch.getTargetPath()).setSampler(ns); na.addSampler(ns); na.addChannel(nc); n++; }
    if(n) made.push(game); else na.dispose(); }
  return made; }
export function renameBones(doc){ for(const n of doc.getRoot().listNodes()){ const nm=n.getName(); if(RENAME[nm]) n.setName(RENAME[nm]); } }
