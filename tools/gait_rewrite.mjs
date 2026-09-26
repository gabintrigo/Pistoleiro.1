/* Reescreve as animações de locomoção (walk/jog/sprint) do human_base.glb diretamente no ficheiro final.
 * Modo 'check': reproduz a marcha original (fórmulas de build_character.py) e mede o erro contra o ficheiro, para validar a conversão de eixos.
 * Modo 'write': gera a marcha nova (calcanhar, ponta, apoio 60/40, balanço lateral da anca) e grava. Uso: node tools/gait_rewrite.mjs check|write */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import * as THREE from 'three';
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const MODE=process.argv[2]||'check', FILE='public/assets/characters/human_base.glb';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder});
const doc=await io.read(FILE), root=doc.getRoot(), skin=root.listSkins()[0], joints=skin.listJoints(), ibm=skin.getInverseBindMatrices();
const B={hips:'Hips',lul:'LeftUpLeg',ll:'LeftLeg',lf:'LeftFoot',rul:'RightUpLeg',rl:'RightLeg',rf:'RightFoot'};
const jn=k=>joints.find(j=>j.getName().replace(/^mixamorig:?/,'')===B[k]);
const worldQ=j=>{ const i=joints.indexOf(j),m=new THREE.Matrix4().fromArray(ibm.getElement(i,[])).invert(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3(); m.decompose(p,q,s); return q; };
const D=Math.PI/180, S=(t,ph=0)=>Math.sin(2*Math.PI*t+ph), Cc=(t,ph=0)=>Math.cos(2*Math.PI*t+ph), TRI=t=>(2/Math.PI)*Math.asin(Math.sin(2*Math.PI*t)), SW=t=>0.7*TRI(t)+0.3*S(t);
function poseQ(k,rx,ry,rz,C){ const j=jn(k),w=worldQ(j),a=C.clone().invert().multiply(w),r=new THREE.Quaternion().setFromEuler(new THREE.Euler(rx*D,ry*D,rz*D,'XYZ')); const d=a.clone().invert().multiply(r).multiply(a); const rest=new THREE.Quaternion(...j.getRotation()); return rest.multiply(d); }
function origWalk(t){ const out={},thigh=26,knee=42,lean=3,hipRoll=4,hipYaw=6; out.hips=[-lean,hipRoll*S(t),hipYaw*S(t)];
  const leg=(ul,ll,ft,ph)=>{ const fwd=thigh*SW(ph),sw=Math.max(0,Cc(ph)),kn=knee*Math.pow(sw,1.3)+7*Math.pow(Math.max(0,-Cc(ph)),2),toe=14*Math.pow(Math.max(0,S(ph+0.12)),3); out[ul]=[-fwd,0,0];out[ll]=[kn,0,0];out[ft]=[(fwd-kn)*0.75-6*sw+toe,0,0]; };
  leg('lul','ll','lf',t);leg('rul','rl','rf',t+0.5); return out; }
const anim=name=>root.listAnimations().find(a=>a.getName()===name);
function channel(an,k,path){ return an.listChannels().find(c=>c.getTargetNode()===jn(k)&&c.getTargetPath()===path); }
if(MODE==='check'){
  const an=anim('walk'); const period=1.0;
  for(const [label,C] of [['Rx(-90)',new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2)],['identidade',new THREE.Quaternion()]]){
    let err=0,n=0;
    for(const k of ['hips','lul','ll','lf','rul','rl','rf']){ const ch=channel(an,k,'rotation'); if(!ch){console.log('sem canal',k);continue;} const sm=ch.getSampler(),ti=sm.getInput(),to=sm.getOutput();
      for(let i=0;i<ti.getCount();i+=Math.max(1,Math.floor(ti.getCount()/6))){ const tt=ti.getScalar(i),e=origWalk((tt/period)%1)[k],q=poseQ(k,e[0],e[1],e[2],C),v=to.getElement(i,[]),qa=new THREE.Quaternion(...v); err+=1-Math.abs(q.dot(qa));n++; } }
    console.log('conversão',label,'erro médio',(err/n).toExponential(2),'amostras',n);
  }
  process.exit(0);
}
/* ---------- marcha nova ---------- */
const C=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
const curve=(pts,x)=>{ for(let i=0;i<pts.length-1;i++){ const [x0,y0]=pts[i],[x1,y1]=pts[i+1]; if(x>=x0&&x<=x1){ const u=(x-x0)/Math.max(1e-6,x1-x0),w=0.5-0.5*Math.cos(Math.PI*u); return y0+(y1-y0)*w; } } return pts[pts.length-1][1]; };
const GAIT={walk:{period:1.0,duty:0.62,thf:26,thb:22,kl:14,kp:38,km:62,lean:3,roll:4,yaw:5,bob:0.018,sh:0.022,run:false},
            jog:{period:0.72,duty:0.42,thf:34,thb:30,kl:32,kp:55,km:92,lean:8,roll:3,yaw:7,bob:0.035,sh:0.012,run:true},
            sprint:{period:0.56,duty:0.34,thf:44,thb:34,kl:38,kp:70,km:118,lean:14,roll:3,yaw:9,bob:0.05,sh:0.008,run:true}};
function legPose(ph,P){ const b=P.duty; let th,kn,p;
  if(ph<b){ const s=ph/b; th=P.thf-(P.thf+P.thb)*s; kn=curve([[0,3],[0.15,P.kl],[0.45,3],[0.8,P.kp*0.45],[1,P.kp]],s); p=curve([[0,-12],[0.12,0],[0.6,0],[1,22]],s); }
  else { const s=(ph-b)/(1-b); th=-P.thb+(P.thf+P.thb)*(0.5-0.5*Math.cos(Math.PI*s)); kn=curve([[0,P.kp],[0.35,P.km],[0.85,4],[1,3]],s); p=curve([[0,22],[0.3,8],[0.6,-5],[1,-12]],s); }
  return {th,kn,a:th-kn+p}; }
function newGait(t,P){ const out={},phL=((t-0.25)%1+1)%1,phR=((t+0.25)%1+1)%1; out.hips=[-P.lean,P.roll*S(t),P.yaw*S(t)];
  for(const [ul,ll,ft,ph] of [['lul','ll','lf',phL],['rul','rl','rf',phR]]){ const L=legPose(ph,P); out[ul]=[-L.th,0,0];out[ll]=[L.kn,0,0];out[ft]=[L.a,0,0]; }
  const c=Math.abs(Math.cos(2*Math.PI*(t-0.25))); out.loc=[P.sh*Math.sin(2*Math.PI*(t-0.25)),0,P.run?-P.bob*(1-c):-P.bob*c]; return out; }
if(MODE==='write'){
  // escala da translação da anca: mede contra a animação original (bob 0,02 em walk)
  const hips=jn('hips'),a=C.clone().invert().multiply(worldQ(hips)),qr=new THREE.Quaternion(...hips.getRotation()),tr=new THREE.Vector3(...hips.getTranslation());
  const locQ=v=>new THREE.Vector3(...v).applyQuaternion(a.clone().invert()).applyQuaternion(qr);
  { const ch=channel(anim('walk'),'hips','translation'),sm=ch.getSampler(),ti=sm.getInput(),to=sm.getOutput();let num=0,den=0;
    for(let i=0;i<ti.getCount();i++){ const tt=ti.getScalar(i),v=[0,0,-0.02*(1-Math.abs(Cc(tt)))],pr=locQ(v),ac=new THREE.Vector3(...to.getElement(i,[])).sub(tr); num+=pr.dot(ac);den+=pr.dot(pr); }
    globalThis.LSCALE=den>1e-12?num/den:1; console.log('escala da translação da anca',LSCALE.toFixed(4)); }
  for(const name of ['walk','jog','sprint']){ const an=anim(name),P=GAIT[name],n=Math.round(P.period*24),times=new Float32Array(n+1);for(let f=0;f<=n;f++)times[f]=f*P.period/n;
    const frames=[...times].map(tt=>newGait(tt/P.period,P));
    for(const k of ['hips','lul','ll','lf','rul','rl','rf']){ const ch=channel(an,k,'rotation'); if(!ch){console.log('sem canal',name,k);continue;} const out=new Float32Array((n+1)*4);
      frames.forEach((fr,i)=>{ const e=fr[k],q=poseQ(k,e[0],e[1],e[2],C); if(i>0){ const pv=new THREE.Quaternion(out[(i-1)*4],out[(i-1)*4+1],out[(i-1)*4+2],out[(i-1)*4+3]); if(pv.dot(q)<0){q.x=-q.x;q.y=-q.y;q.z=-q.z;q.w=-q.w;} } out.set([q.x,q.y,q.z,q.w],i*4); });
      const sm=ch.getSampler(); sm.setInput(doc.createAccessor().setType('SCALAR').setArray(times.slice())).setOutput(doc.createAccessor().setType('VEC4').setArray(out)).setInterpolation('LINEAR'); }
    const cht=channel(an,'hips','translation'); if(cht){ const out=new Float32Array((n+1)*3); frames.forEach((fr,i)=>{ const d=locQ(fr.loc).multiplyScalar(LSCALE).add(tr); out.set([d.x,d.y,d.z],i*3); }); cht.getSampler().setInput(doc.createAccessor().setType('SCALAR').setArray(times.slice())).setOutput(doc.createAccessor().setType('VEC3').setArray(out)).setInterpolation('LINEAR'); }
    console.log('reescrita',name,'frames',n+1); }
  await io.write(FILE,doc); console.log('gravado',FILE);
}
