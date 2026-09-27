// Mãos em primeira pessoa recortadas do próprio corpo do jogo (Quaternius UBC, CC0), com os dedos
// já na pose de empunhar (clip da UAL). Substitui o hands.glb antigo, que eram tubos sem dedos.
// A malha sai COZIDA (sem esqueleto): o viewmodel só a posiciona nos pontos grip_r/grip_l da arma.
//
// uso: node tools/ubc_hands.mjs [clip]        (clip por omissão: Pistol_Aim_Neutral)
import { NodeIO } from '@gltf-transform/core';
import { prune, dedup, quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import fs from 'fs';
import { renameBones } from './ual_common.mjs';

const CLIP = process.argv[2] || 'Pistol_Aim_Neutral';
const BODY = 'assets/src/quaternius/ubc/Superhero_Male_FullBody.gltf';
const OUT  = 'public/assets/weapons/hands.glb';
await MeshoptEncoder.ready;

// ── matrizes ──────────────────────────────────────────────────────────────────
const mul=(a,b)=>{const o=new Float64Array(16);for(let r=0;r<4;r++)for(let c=0;c<4;c++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s;}return o;};
const fromTRS=(t,q,s)=>{const [x,y,z,w]=q,x2=x+x,y2=y+y,z2=z+z,xx=x*x2,xy=x*y2,xz=x*z2,yy=y*y2,yz=y*z2,zz=z*z2,wx=w*x2,wy=w*y2,wz=w*z2;
  return new Float64Array([(1-(yy+zz))*s[0],(xy+wz)*s[0],(xz-wy)*s[0],0, (xy-wz)*s[1],(1-(xx+zz))*s[1],(yz+wx)*s[1],0, (xz+wy)*s[2],(yz-wx)*s[2],(1-(xx+yy))*s[2],0, t[0],t[1],t[2],1]);};
const xform=(m,v)=>[m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12], m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13], m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]];
const xformDir=(m,v)=>[m[0]*v[0]+m[4]*v[1]+m[8]*v[2], m[1]*v[0]+m[5]*v[1]+m[9]*v[2], m[2]*v[0]+m[6]*v[1]+m[10]*v[2]];
const invert=(m)=>{ // suficiente para matrizes afins
  const a=m; const inv=new Float64Array(16);
  const det3=(a0,a1,a2,b0,b1,b2,c0,c1,c2)=>a0*(b1*c2-b2*c1)-a1*(b0*c2-b2*c0)+a2*(b0*c1-b1*c0);
  const d=det3(a[0],a[4],a[8],a[1],a[5],a[9],a[2],a[6],a[10])||1;
  const c=(r,cc)=>{const idx=[0,1,2].filter(i=>i!==r),jdx=[0,1,2].filter(j=>j!==cc);
    return ((r+cc)%2?-1:1)*(a[jdx[0]*4+idx[0]]*a[jdx[1]*4+idx[1]]-a[jdx[1]*4+idx[0]]*a[jdx[0]*4+idx[1]]);};
  for(let r=0;r<3;r++)for(let cc=0;cc<3;cc++) inv[cc*4+r]=c(r,cc)/d;
  const t=[a[12],a[13],a[14]]; const it=xformDir(inv,t);
  inv[12]=-it[0]; inv[13]=-it[1]; inv[14]=-it[2]; inv[15]=1; return inv;};

// ── carregar corpo e pose ─────────────────────────────────────────────────────
const io=new NodeIO().registerExtensions([EXTMeshoptCompression]).registerDependencies({'meshopt.encoder':MeshoptEncoder});
const doc=await io.read(BODY); const root=doc.getRoot(); renameBones(doc);
const ual=await new NodeIO().read(process.env.UAL1||'assets/src/quaternius/ual/UAL1.glb'); renameBones(ual);

// ATENÇÃO: o corpo traz uma armadura por malha. Os índices de JOINTS_0 referem-se ao skin
// daquela malha, não ao primeiro do ficheiro — usar o do nó que tem a malha do corpo.
const bodyNode=root.listNodes().find(n=>n.getMesh()&&n.getSkin()&&n.getMesh().listPrimitives()[0].getAttribute('JOINTS_0')
  && n.getMesh().listPrimitives()[0].getIndices().getCount()>3000);
const skin=bodyNode?bodyNode.getSkin():root.listSkins()[0];
const joints=skin.listJoints();
const jointIdx=new Map(joints.map((j,i)=>[j,i]));
const ibmArr=skin.getInverseBindMatrices().getArray();

// pose do clip: primeiro fotograma de cada canal
const anim=ual.getRoot().listAnimations().find(a=>a.getName()===CLIP);
if(!anim) { console.error('clip não encontrado:',CLIP); process.exit(1); }
const pose=new Map();   // nome do osso -> {t,r,s}
for(const ch of anim.listChannels()){
  const n=ch.getTargetNode(); if(!n) continue;
  const out=ch.getSampler().getOutput().getArray(); const path=ch.getTargetPath();
  const e=pose.get(n.getName())||{};
  if(path==='translation') e.t=[out[0],out[1],out[2]];
  else if(path==='rotation') e.r=[out[0],out[1],out[2],out[3]];
  else if(path==='scale') e.s=[out[0],out[1],out[2]];
  pose.set(n.getName(),e);
}

// matrizes mundo do esqueleto já com a pose aplicada
const parentOf=new Map(); for(const n of root.listNodes()) for(const c of n.listChildren()) parentOf.set(c,n);
const worldOf=new Map();
const world=(n)=>{ if(worldOf.has(n)) return worldOf.get(n);
  const p=pose.get(n.getName());
  const local=p&&(p.t||p.r||p.s)
    ? fromTRS(p.t||n.getTranslation(), p.r||n.getRotation(), p.s||n.getScale())
    : new Float64Array(n.getMatrix());
  const par=parentOf.get(n);
  const m=par?mul(world(par),local):local;
  worldOf.set(n,m); return m; };

const skinMats=joints.map((j,i)=>{ const ibm=new Float64Array(ibmArr.slice(i*16,i*16+16)); return mul(world(j),ibm); });

// ── que ossos pertencem a cada mão ────────────────────────────────────────────
const setFor=(lado)=>new Set(joints.map((j,i)=>[j.getName(),i])
  .filter(([n])=>new RegExp(`(Hand|index|middle|pinky|ring|thumb).*_${lado}$|${lado==='l'?'Left':'Right'}Hand`).test(n)
              || new RegExp(`^(index|middle|pinky|ring|thumb)_\\d+.*_${lado}$`).test(n)
              || n===(lado==='l'?'LeftHand':'RightHand')
              || n===(lado==='l'?'LeftForeArm':'RightForeArm'))
  .map(([,i])=>i));
const SETS={r:setFor('r'), l:setFor('l')};
console.log('ossos por mão -> direita:',SETS.r.size,'| esquerda:',SETS.l.size);

// ── recortar e cozer ──────────────────────────────────────────────────────────
const bodyMesh=bodyNode?bodyNode.getMesh():root.listMeshes().find(m=>m.listPrimitives()[0].getAttribute('JOINTS_0'));
const prim=bodyMesh.listPrimitives()[0];
const POS=prim.getAttribute('POSITION'), NRM=prim.getAttribute('NORMAL'), UV=prim.getAttribute('TEXCOORD_0');
const J=prim.getAttribute('JOINTS_0'), W=prim.getAttribute('WEIGHTS_0'); const IDX=prim.getIndices().getArray();
const nv=POS.getCount();
const dom=new Int32Array(nv); const sk=[]; const skn=[];
const v=[0,0,0],nn=[0,0,0],jj=[0,0,0,0],ww=[0,0,0,0];
for(let i=0;i<nv;i++){
  POS.getElement(i,v); if(NRM) NRM.getElement(i,nn); J.getElement(i,jj); W.getElement(i,ww);
  let px=0,py=0,pz=0,nx=0,ny=0,nz=0,best=-1,bw=0;
  for(let k=0;k<4;k++){ const w=ww[k]; if(w<=0) continue; const m=skinMats[jj[k]];
    const p=xform(m,v), d=NRM?xformDir(m,nn):[0,1,0];
    px+=p[0]*w; py+=p[1]*w; pz+=p[2]*w; nx+=d[0]*w; ny+=d[1]*w; nz+=d[2]*w;
    if(w>bw){ bw=w; best=jj[k]; } }
  const nl=Math.hypot(nx,ny,nz)||1;   // a soma ponderada não vem unitária: sem isto a luz fica lavada
  sk.push(px,py,pz); skn.push(nx/nl,ny/nl,nz/nl); dom[i]=best;
}
const mats=root.listMaterials();
const skinMat=mats.find(m=>/superhero|skin/i.test(m.getName()))||mats[0];
skinMat.setName('skin');
const buf=root.listBuffers()[0];
const scene=root.listScenes()[0];
for(const n of scene.listChildren()) n.dispose();          // fora o corpo inteiro; fica só o que construirmos

// base da arma em espaço mundo (ortonormada): z = do punho esquerdo para o direito, y = cima
const wr=world(joints[jointIdx.get(joints.find(j=>j.getName()==='RightHand'))]);
const wl=world(joints[jointIdx.get(joints.find(j=>j.getName()==='LeftHand'))]);
const norm=a=>{const L=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/L,a[1]/L,a[2]/L];};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const fwd=norm([wl[12]-wr[12], wl[13]-wr[13], wl[14]-wr[14]]);
const BZ=[-fwd[0],-fwd[1],-fwd[2]];
const BX=norm(cross([0,1,0],BZ));
const BY=norm(cross(BZ,BX));
console.log('base da arma | frente:',fwd.map(n=>+n.toFixed(2)).join(','));

for(const lado of ['r','l']){
  const set=SETS[lado];
  const keep=[]; for(let t=0;t<IDX.length;t+=3){ const a=IDX[t],b=IDX[t+1],c=IDX[t+2];
    if(set.has(dom[a])&&set.has(dom[b])&&set.has(dom[c])) keep.push(a,b,c); }
  if(!keep.length){ console.warn('mão',lado,'sem triângulos'); continue; }
  // Referencial da ARMA, deduzido das duas mãos tal como o _autoRifle faz no Character.js:
  // frente = do punho direito para o esquerdo. Cozer neste referencial em vez do da personagem,
  // senão as mãos aparecem tortas em relação ao cano.
  // Origem na PALMA (base do dedo médio), não no pulso: é aí que assenta o punho da arma.
  // Com a origem no pulso a mão ficava ~8 cm à frente da pega — pouco visível na espingarda, gritante na pistola.
  const palm=joints.find(j=>j.getName()==='middle_01_'+lado) || joints.find(j=>j.getName()===(lado==='l'?'LeftHand':'RightHand'));
  const wm=world(palm); const org=[wm[12],wm[13],wm[14]];
  const remap=new Map(); const P=[],N=[],T=[],I=[];
  for(const i of keep){ let ni=remap.get(i); if(ni===undefined){ ni=remap.size; remap.set(i,ni);
      const lp=[sk[i*3]-org[0], sk[i*3+1]-org[1], sk[i*3+2]-org[2]];
      P.push(BX[0]*lp[0]+BX[1]*lp[1]+BX[2]*lp[2], BY[0]*lp[0]+BY[1]*lp[1]+BY[2]*lp[2], BZ[0]*lp[0]+BZ[1]*lp[1]+BZ[2]*lp[2]);
      const dn=[skn[i*3],skn[i*3+1],skn[i*3+2]];
      N.push(BX[0]*dn[0]+BX[1]*dn[1]+BX[2]*dn[2], BY[0]*dn[0]+BY[1]*dn[1]+BY[2]*dn[2], BZ[0]*dn[0]+BZ[1]*dn[1]+BZ[2]*dn[2]);
      if(UV){ const uv=[0,0]; UV.getElement(i,uv); T.push(uv[0],uv[1]); } }
    I.push(ni); }
  const np=doc.createPrimitive().setMaterial(skinMat)
    .setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(new Float32Array(P)).setBuffer(buf))
    .setAttribute('NORMAL',doc.createAccessor().setType('VEC3').setArray(new Float32Array(N)).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(I)).setBuffer(buf));
  if(UV) np.setAttribute('TEXCOORD_0',doc.createAccessor().setType('VEC2').setArray(new Float32Array(T)).setBuffer(buf));
  const mesh=doc.createMesh('hand_'+lado).addPrimitive(np);
  scene.addChild(doc.createNode('hand_'+lado).setMesh(mesh));
  console.log('mão',lado,'->',I.length/3,'triângulos,',remap.size,'vértices');
}
for(const s of root.listSkins()) s.dispose();
await doc.transform(dedup(), prune(), quantize({quantizePosition:14,quantizeNormal:10,quantizeTexcoord:12}), meshopt({encoder:MeshoptEncoder,level:'high'}));
await io.write(OUT,doc);
console.log('escrito',OUT,'|',fs.statSync(OUT).size,'bytes | pose:',CLIP);
