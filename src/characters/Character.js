/** Skinned character instances built from the human_base template: shared skeleton across LODs, per-instance
 *  materials (skin tone / team kit), layered animation (lower body gait + upper body action), bone hitboxes,
 *  head scaling for the headshot-centred gameplay, and a pool to avoid allocations during play. */
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fabricNormalTex } from '../world/Textures.js';
const LOWER=['idle','walk','jog','sprint','strafe_left','strafe_right'], UPPER=['idle_upper','walk_upper','jog_upper','sprint_upper','aim'], ONESHOT=['shoot','reload','hit'], FULL=['headshot','death','death_back'];
const _v=new THREE.Vector3(), _v2=new THREE.Vector3(), _q=new THREE.Quaternion(), _p=new THREE.Vector3();
const _QY=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI); // frente da personagem = -Z
const _UP=new THREE.Vector3(0,1,0);
/** rifle held in the right hand: local transform computed from the baked aim pose (tools/rifle_calc.mjs) so the barrel runs grip -> foregrip */
const RIFLE_QUAT=new THREE.Quaternion(0.4628,0.2191,-0.579,0.6345);
let _rifleGeo=null, _rifleMat=null;
function rifleGeometry(){
  if(_rifleGeo) return _rifleGeo;
  const parts=[]; const add=(w,h,d,x,y,z,col)=>{ const g=new THREE.BoxGeometry(w,h,d); g.translate(x,y,z); const n=g.attributes.position.count, c=new Float32Array(n*3); const cc=new THREE.Color(col); for(let i=0;i<n;i++){ c[i*3]=cc.r; c[i*3+1]=cc.g; c[i*3+2]=cc.b; } g.setAttribute('color',new THREE.BufferAttribute(c,3)); parts.push(g); };
  const METAL=0x1e2024, POLY=0x2c2e33, WOOD=0x5a3c22;
  add(0.05,0.07,0.22,0,0.0,-0.07,METAL);      // receiver
  add(0.045,0.05,0.28,0,0.005,-0.32,POLY);    // handguard
  add(0.024,0.024,0.30,0,0.02,-0.60,METAL);   // barrel
  add(0.04,0.09,0.24,0,-0.01,0.13,WOOD);      // stock
  add(0.04,0.06,0.05,0,-0.045,0.02,POLY);     // pistol grip
  add(0.03,0.13,0.07,0,-0.09,-0.12,METAL);    // magazine
  add(0.02,0.04,0.02,0,0.055,-0.66,METAL);    // front sight
  add(0.03,0.03,0.06,0,0.05,-0.02,METAL);     // rear sight / rail
  _rifleGeo=mergeGeometries(parts,false); _rifleMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.55,metalness:0.45});
  return _rifleGeo;
}
/** ground speed (m/s) at which each locomotion clip has no foot slide (measured by tools/harness_gait.mjs) */
const GAIT_SPEED={walk:1.5,jog:2.71,sprint:4.28,strafe_left:1.3,strafe_right:1.3};
/** GLTFLoader sanitises node names (removes ':'), so bones arrive as 'mixamorigHips' */
export const boneKey=n=>n.replace(/^mixamorig:?/,'');
/** meshes are classified by material name (exporter may rename mesh nodes) */
export function meshClass(m){ const mn=(m.material&&m.material.name)||''; if(/^(shirt|shorts|socks|kit)/i.test(mn)) return 'Kit'; if(/skin/i.test(mn)||m.name==='Body') return 'Body'; if(/hair/i.test(mn)||m.name==='Hair') return 'Hair'; return 'Eyes'; }
function raySphere(o,d,c,r){ const ox=o.x-c.x,oy=o.y-c.y,oz=o.z-c.z; const b=2*(ox*d.x+oy*d.y+oz*d.z), cc=ox*ox+oy*oy+oz*oz-r*r, disc=b*b-4*cc; if(disc<0) return -1; const s=Math.sqrt(disc); let t=(-b-s)/2; if(t<0) t=(-b+s)/2; return t; }
function rayCylinderY(o,d,cx,cz,r,y0,y1,maxT){ // exact ray vs vertical cylinder (axis through cx,cz), clipped to [y0,y1]
  const ox=o.x-cx,oz=o.z-cz,a=d.x*d.x+d.z*d.z; if(a<1e-6) return -1; const b=2*(ox*d.x+oz*d.z),c=ox*ox+oz*oz-r*r,disc=b*b-4*a*c; if(disc<0) return -1;
  const s=Math.sqrt(disc); let t=(-b-s)/(2*a); if(t<0) t=(-b+s)/(2*a); if(t<0||t>maxT) return -1; const y=o.y+d.y*t; if(y<y0||y>y1) return -1; return t; }

export class CharacterTemplate {
  constructor(asset, opts={}){
    this.asset=asset; this.name=opts.name||''; this.root=asset.gltf.scene; this.clips=new Map(asset.clips.map(c=>[c.name,c])); this.headScale=opts.headScale||1.3; this.flat=!!opts.flat; this.kitShader=!!opts.kitShader; this.gait=opts.gait||null;
    const meshes=[]; this.root.traverse(o=>{ if(o.isSkinnedMesh) meshes.push(o); }); this.meshes=meshes;
    this.lodMeshes={1:[],2:[]}; for(const [lvl,g] of [[1,asset.lod1],[2,asset.lod2]]) if(g) g.scene.traverse(o=>{ if(o.isSkinnedMesh) this.lodMeshes[lvl].push(o); });
    this.baseMaterials={}; for(const m of meshes){ const k=meshClass(m); if(!this.baseMaterials[k]) this.baseMaterials[k]=m.material; }
  }
}
export class CharacterInstance {
  constructor(template, scene, opts){
    this.t=template; this.scene=scene; this.opts=opts; this.alive=false;
    // the MakeHuman export faces +Z; the game convention is -Z, so the clone lives inside a wrapper rotated by PI
    this.root=new THREE.Group(); this.inner=SkeletonUtils.clone(template.root); this.inner.rotation.y=Math.PI; this.root.add(this.inner); this.root.visible=false; scene.add(this.root);
    this.meshList=[]; this.root.traverse(o=>{ if(o.isSkinnedMesh){ o.userData.cls=meshClass(o); this.meshList.push(o); o.frustumCulled=false; o.userData.lod=0; } });
    const anyMesh=this.meshList[0]; this.skeleton=anyMesh.skeleton;
    this.bones={}; for(const b of this.skeleton.bones) this.bones[boneKey(b.name)]=b;
    for(const k of ['Hips','Spine2','Neck','Head','RightHand']) if(!this.bones[k]) console.warn('[character] bone missing',k,this.skeleton.bones.slice(0,5).map(b=>b.name));
    // LOD levels share the instance skeleton
    this.lods={0:this.meshList.slice(),1:[],2:[]};
    // each LOD mesh must use the skeleton (inverse bind matrices) and node transform of the LOD0 mesh of the SAME part:
    // body/hair/kit/eyes were separate objects in Blender and carry different bind data
    const lod0ByClass={}; for(const m of this.meshList) if(!lod0ByClass[m.userData.cls]) lod0ByClass[m.userData.cls]=m;
    for(const lvl of [1,2]) for(const src of template.lodMeshes[lvl]){ const cls=meshClass(src), ref=lod0ByClass[cls]||anyMesh; const sm=new THREE.SkinnedMesh(src.geometry, src.material); sm.name=src.name; sm.userData.cls=cls; sm.frustumCulled=false; sm.visible=false; sm.userData.lod=lvl; sm.position.copy(ref.position); sm.quaternion.copy(ref.quaternion); sm.scale.copy(ref.scale); ref.parent.add(sm); sm.bind(ref.skeleton, ref.bindMatrix); this.lods[lvl].push(sm); }
    // penteados: o GLB traz todos os cortes (Hair_*) ligados ao mesmo esqueleto; só um fica visível de cada vez.
    // Agrupados por nome ao longo dos LODs, para o corte escolhido continuar certo ao longe.
    this.hairStyles={}; for(const lvl of [0,1,2]) for(const m of this.lods[lvl]) if(/^Hair_/.test(m.name)){ (this.hairStyles[m.name]=this.hairStyles[m.name]||[]).push(m); m.userData.hairOff=true; m.visible=false; }
    // per-instance materials
    this.mats={}; for(const name of ['Body','Hair','Kit','Eyes']){ const base=template.baseMaterials[name]; if(!base) continue; const m=base.clone(); m.emissive=new THREE.Color(0); m.emissiveIntensity=1; this.mats[name]=m; for(const lvl of [0,1,2]) for(const sm of this.lods[lvl]) if(sm.userData.cls===name) sm.material=m; }
    // less plastic: softer skin specular, cloth weave on the kit, matte hair
    if(template.kitShader&&this.mats.Body){ const m=this.mats.Body; m.vertexColors=true; m.userData.kit={uShirt:{value:new THREE.Color(0xd8202a)},uShorts:{value:new THREE.Color(0x1a2a5a)},uSocks:{value:new THREE.Color(0xf0f0f0)}};
      m.onBeforeCompile=(sh)=>{ Object.assign(sh.uniforms,m.userData.kit); sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>','#ifdef USE_COLOR_ALPHA\n vec4 kw=vColor; float kTop=max(max(kw.r,kw.g),max(kw.b,kw.a));\n kw=smoothstep(kTop-0.06,kTop,kw); kw/=max(kw.r+kw.g+kw.b+kw.a,1e-4);\n vec3 kitCol=uShirt*kw.r+uShorts*kw.g+uSocks*kw.b; float kitW=kw.r+kw.g+kw.b;\n diffuseColor.rgb=mix(diffuseColor.rgb,kitCol,kitW);\n#endif').replace('void main() {','uniform vec3 uShirt; uniform vec3 uShorts; uniform vec3 uSocks;\nvoid main() {'); }; m.customProgramCacheKey=()=>'kitshader'; m.needsUpdate=true; }
    if(this.mats.Body){ this.mats.Body.roughness=0.62; this.mats.Body.metalness=0; this.mats.Body.envMapIntensity=0.45; }
    if(this.mats.Kit){ this.mats.Kit.roughness=0.93; this.mats.Kit.metalness=0; try{ this.mats.Kit.normalMap=fabricNormalTex(); this.mats.Kit.normalScale=new THREE.Vector2(0.35,0.35); }catch(e){} this.mats.Kit.envMapIntensity=0.35; }
    if(this.mats.Hair){ this.mats.Hair.roughness=0.85; this.mats.Hair.envMapIntensity=0.3; }
    this.lookT=Math.random()*10; this.lookYaw=0; this.lookPitch=0; this.lookTgtYaw=0; this.lookTgtPitch=0; this.lookNext=0; this._lq=new THREE.Quaternion(); this._le=new THREE.Euler();
    // head scale (bigger heads = headshot game)
    if(this.bones.Head) this.bones.Head.scale.setScalar(template.headScale);
    if(!this.bones.Head){ this.bones.Head=this.skeleton.bones[0]; this.bones.Hips=this.bones.Hips||this.skeleton.bones[0]; this.bones.Neck=this.bones.Neck||this.skeleton.bones[0]; }
    // muzzle flash sprite on the right hand
    // rifle in the right hand: the real weapon model when available (origin at the receiver -> offset to the grip), else a box rifle
    this.rifle=new THREE.Group(); this.rifle.quaternion.copy(RIFLE_QUAT); (this.bones.RightHand||this.root).add(this.rifle); this._rifleAuto=!!(template.flat||template.kitShader);
    let tipHolder=this.rifle, tipPos=new THREE.Vector3(0,0.02,-0.78);
    if(opts.rifle){ const m=opts.rifle.clone(true); const gr=m.getObjectByName('grip_r'); if(gr) m.position.set(-gr.position.x*0.92,-gr.position.y*0.92+0.008,-gr.position.z*0.92+0.015); else m.position.set(0,0.10,-0.16); m.scale.setScalar(0.92); m.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.frustumCulled=false; } }); this.rifle.add(m); const tip=m.getObjectByName('tip'); if(tip){ tipHolder=tip; tipPos=new THREE.Vector3(0,0,-0.03); } }
    else { const bm=new THREE.Mesh(rifleGeometry(),_rifleMat); bm.castShadow=true; bm.frustumCulled=false; this.rifle.add(bm); }
    this.flash=new THREE.Sprite(new THREE.SpriteMaterial({map:opts.flashTex, color:0xffd070, blending:THREE.AdditiveBlending, depthWrite:false, transparent:true})); this.flash.scale.set(0.45,0.45,1); this.flash.visible=false; this.flash.position.copy(tipPos); tipHolder.add(this.flash);
    // number plane on the back (follows the upper spine)
    if(opts.numberGeo && this.bones.Spine2){ const pl=new THREE.Mesh(opts.numberGeo, new THREE.MeshStandardMaterial({roughness:0.8})); this.numberPlane=pl; this.bones.Spine2.add(pl); this.root.updateWorldMatrix(true,true);
      // tamanho e recuo medidos no esqueleto (o corpo novo é maior que o antigo): o número acompanha
      // a largura do tronco e assenta na superfície das costas em vez de flutuar atrás dela
      const by=b=>this.bones[b]?this.bones[b].matrixWorld.elements[13]:0, bz=b=>this.bones[b]?this.bones[b].matrixWorld.elements[14]:0;
      const torso=Math.max(0.2, by('Neck')-by('Spine'));
      pl.scale.set(torso*0.62/0.5, torso*0.68/0.56, 1);
      const desired=_v.set(0, by('Spine2')+torso*0.045, bz('Spine2')+torso*0.385);
      this.bones.Spine2.worldToLocal(desired); pl.position.copy(desired); this.bones.Spine2.getWorldQuaternion(_q); pl.quaternion.copy(_q.invert()); }
    this.mixer=new THREE.AnimationMixer(this.root); this.actions={};
    for(const [name,clip] of template.clips){ const a=this.mixer.clipAction(clip); a.enabled=true; a.setEffectiveWeight(0); if(FULL.includes(name)||ONESHOT.includes(name)){ a.setLoop(THREE.LoopOnce,1); a.clampWhenFinished=true; } this.actions[name]=a; }
    this.lower=null; this.upper=null; this.full=null; this.oneshot=null; this.flashT=0; this.hitFlashT=0; this.lod=0; this.animSkip=0; this._head=new THREE.Vector3(); this._headOk=false;
    this.mixer.addEventListener('finished', e=>{ if(e.action===this.oneshot){ this.oneshot.fadeOut(0.12); this.oneshot=null; if(this.upper){ this.upper.enabled=true; this.upper.setEffectiveWeight(1); this.upper.play(); this.upper.fadeIn(0.15); } } });
  }
  /** cores do equipamento (shader): camisola, calções, meias; tom de pele como multiplicador; cabelo */
  setKit(shirt, shorts, socks, tone, hair){ const k=this.mats.Body&&this.mats.Body.userData.kit; if(k){ k.uShirt.value.setHex(shirt); k.uShorts.value.setHex(shorts); k.uSocks.value.setHex(socks); }
    if(this.mats.Body){ const t=({light:[1.32,1.22,1.12],tan:[1.12,1.05,0.98],dark:[0.72,0.62,0.55]})[tone]||[1,1,1]; this.mats.Body.color.setRGB(t[0],t[1],t[2]); }
    if(this.mats.Hair&&hair!=null){ this.mats.Hair.color.setHex(hair); } }
  setColors(skinTex, kitTex, hairColor){ if(this.t.kitShader){ if(this.mats.Hair&&hairColor!=null) this.mats.Hair.color.setHex(hairColor); return; } if(this.t.flat){ const col=t=>{ try{ const im=t&&t.image; if(!im||!im.getContext) return null; const g=im.getContext('2d'); const d=g.getImageData(Math.floor(im.width*0.5),Math.floor(im.height*0.28),1,1).data; return (d[0]<<16)|(d[1]<<8)|d[2]; }catch(e){ return null; } };
      const kc=col(kitTex), sc=col(skinTex); if(this.mats.Kit){ this.mats.Kit.map=null; this.mats.Kit.color.setHex(kc!=null?kc:0xd8202a); this.mats.Kit.needsUpdate=true; } if(this.mats.Body){ this.mats.Body.map=null; this.mats.Body.color.setHex(sc!=null?sc:0xd9a47a); this.mats.Body.needsUpdate=true; } return; }
    if(this.mats.Body&&skinTex){ this.mats.Body.map=skinTex; this.mats.Body.needsUpdate=true; } if(this.mats.Kit&&kitTex){ this.mats.Kit.map=kitTex; this.mats.Kit.needsUpdate=true; } if(this.mats.Hair&&hairColor!==undefined) this.mats.Hair.color.setHex(hairColor); }
  setNumber(tex){ if(this.numberPlane){ this.numberPlane.material.map=tex; this.numberPlane.material.needsUpdate=true; } }
  _autoRifle(){ try{ const a=this.actions.aim,hr=this.bones.RightHand,hl=this.bones.LeftHand; if(!a||!hr||!hl) return; this.mixer.stopAllAction(); a.reset(); a.setEffectiveWeight(1); a.play(); this.mixer.update(0.25); this.root.updateWorldMatrix(true,true);
    const pr=hr.getWorldPosition(new THREE.Vector3()), pl=hl.getWorldPosition(new THREE.Vector3()); const inv=new THREE.Matrix4().copy(hr.matrixWorld).invert(); const fwd=pl.sub(pr).normalize().transformDirection(inv), up=new THREE.Vector3(0,1,0).transformDirection(inv);
    const z=fwd.clone().negate(), x=new THREE.Vector3().crossVectors(up,z).normalize(), y=new THREE.Vector3().crossVectors(z,x).normalize(); this.rifle.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z)); a.stop(); this.mixer.stopAllAction(); this._rifleAuto=false; }catch(e){} }
  spawn(x,y,z,yaw,scale=1){ if(this._rifleAuto)this._autoRifle(); this.alive=true; this.root.visible=true; this.root.position.set(x,y,z); this.root.rotation.set(0,yaw,0); this.root.scale.setScalar(scale); this.scale=scale; this.mixer.stopAllAction(); for(const a of Object.values(this.actions)) a.setEffectiveWeight(0); this.lower=this.upper=this.full=this.oneshot=null; this.setLower('idle',0); this.setUpper('idle_upper',0); this.setLod(0); }
  release(){ this.alive=false; this.root.visible=false; if(this.shield) this.shield.visible=false; if(this.gear) this.setGear({}); this.mixer.stopAllAction(); }
  _play(name, fade, loop=true){ const a=this.actions[name]; if(!a) return null; a.reset(); a.setEffectiveTimeScale(1); a.setEffectiveWeight(1); a.enabled=true; if(loop){ a.setLoop(THREE.LoopRepeat,Infinity); a.clampWhenFinished=false; } a.fadeIn(fade); a.play(); return a; }
  setLower(name, fade=0.18){ if(this.full) return; if(this.lower&&this.lower._clip.name===name) return; const prev=this.lower; this.lower=this._play(name,fade); if(prev&&prev!==this.lower) prev.fadeOut(fade); }
  setUpper(name, fade=0.18){ if(this.full) return; if(this.upper&&this.upper._clip.name===name) return; const prev=this.upper; this.upper=this._play(name,fade); if(this.oneshot) this.upper.setEffectiveWeight(0.15); if(prev&&prev!==this.upper) prev.fadeOut(fade); }
  /** role gear: helmet (shield bearers), tactical vest (boss), captain armband */
  setGear(g){ g=g||{}; if(!this.gear){ this.gear={};
      // Os offsets do equipamento eram fixos em espaço do OSSO, calibrados para o rig antigo. No rig da
      // Quaternius os ossos apontam noutra direcao (o colete ia parar a cara). Agora ancoram-se em pontos
      // medidos no esqueleto em repouso, o que serve qualquer um dos corpos.
      this.root.updateWorldMatrix(true,true);
      const bw=n=>{ const b=this.bones[n]; const m=b&&b.matrixWorld.elements; return new THREE.Vector3(m?m[12]:0,m?m[13]:0,m?m[14]:0); };
      const mid=(a,b,t)=>bw(a).lerp(bw(b),t);
      /** prende obj ao osso na posicao mundo dada; eixo: null = alinhado com a personagem, ou osso-filho para seguir a direcao do membro */
      const anchor=(obj,bone,pos,axisChild)=>{ const b=this.bones[bone]; if(!b) return false; b.add(obj);
        const d=pos.clone(); b.worldToLocal(d); obj.position.copy(d);
        b.getWorldQuaternion(_q); const inv=_q.clone().invert();
        if(axisChild&&this.bones[axisChild]){ const dir=bw(axisChild).sub(bw(bone)).normalize();
          obj.quaternion.copy(inv.multiply(new THREE.Quaternion().setFromUnitVectors(_UP,dir))); }
        else obj.quaternion.copy(inv.multiply(_QY));
        return true; };
      const hm=new THREE.MeshStandardMaterial({color:0x4a4f3a,roughness:0.7,metalness:0.1}),hk=new THREE.MeshStandardMaterial({color:0x1e2124,roughness:0.6,metalness:0.4});
      const helmet=new THREE.Mesh(new THREE.SphereGeometry(0.135,16,10,0,Math.PI*2,0,Math.PI*0.52),hm); helmet.scale.set(1.06,1,1.12); this.gear.helmet=helmet; anchor(helmet,'Head',bw('Head').add(new THREE.Vector3(0,0.075,0)));
      for(const sx of [-1,1]){ const rl=new THREE.Mesh(new THREE.BoxGeometry(0.018,0.03,0.12),hk); rl.position.set(sx*0.14,-0.02,0.0); helmet.add(rl); } const nvg=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.04,0.025),hk); nvg.position.set(0,0.02,0.15); helmet.add(nvg); const cover=new THREE.Mesh(new THREE.TorusGeometry(0.137,0.008,6,24),hk); cover.rotation.x=Math.PI/2; cover.position.y=0.005; helmet.add(cover);
      const vm=new THREE.MeshStandardMaterial({color:0x3f4632,roughness:0.9,metalness:0.02}),vp=new THREE.MeshStandardMaterial({color:0x2e3326,roughness:0.85,metalness:0.02});
      const vest=new THREE.Group(); this.gear.vest=vest; anchor(vest,'Spine2',mid('Spine1','Spine2',0.75));
      const front=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.3,0.055),vm); front.position.set(0,0,0.13); vest.add(front); const back=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.32,0.05),vm); back.position.set(0,0.01,-0.12); vest.add(back);
      for(const sx of [-1,1]){ const side=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.2,0.24),vm); side.position.set(sx*0.17,-0.04,0.005); vest.add(side); const strap=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.03,0.26),vp); strap.position.set(sx*0.1,0.16,0.005); vest.add(strap); }
      for(let i=0;i<3;i++){ const pch=new THREE.Mesh(new THREE.BoxGeometry(0.075,0.1,0.045),vp); pch.position.set(-0.09+i*0.09,-0.07,0.175); vest.add(pch); } const radio=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.09,0.04),vp); radio.position.set(0.1,0.08,0.17); vest.add(radio);
      const band=new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.07,0.06,10,1,true),new THREE.MeshStandardMaterial({color:0xffd000,roughness:0.6,side:THREE.DoubleSide})); this.gear.band=band; anchor(band,'LeftArm',mid('LeftArm','LeftForeArm',0.42),'LeftForeArm');
      // caneleiras-placa (defesas), grelha do capacete e ombreiras (guarda-redes blindado)
      const plate=new THREE.MeshStandardMaterial({color:0x8c939c,roughness:0.38,metalness:0.55}),dark=new THREE.MeshStandardMaterial({color:0x22262c,roughness:0.6,metalness:0.5});
      const shinGeo=new THREE.BoxGeometry(0.105,0.27,0.03);this.gear.shins=new THREE.Group();
      for(const side of ['LeftLeg','RightLeg']){ const sh=new THREE.Mesh(shinGeo,plate); const rim=new THREE.Mesh(new THREE.BoxGeometry(0.112,0.02,0.036),dark); rim.position.set(0,0.13,0); sh.add(rim); const foot=side==='LeftLeg'?'LeftFoot':'RightFoot'; if(anchor(sh,side,mid(side,foot,0.42).add(new THREE.Vector3(0,0,-0.055)),foot)) this.gear['shin_'+side]=sh; }
      const cage=new THREE.Group(); for(const y of [-0.035,0.0,0.035]){ const bar=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.009,0.009),dark); bar.position.set(0,y,0); cage.add(bar); } for(const x of [-0.05,0,0.05]){ const bar=new THREE.Mesh(new THREE.BoxGeometry(0.009,0.085,0.009),dark); bar.position.set(x,0,0.004); cage.add(bar); }
      this.gear.cage=cage; anchor(cage,'Head',bw('Head').add(new THREE.Vector3(0,0.02,-0.13)));
      const padGeo=new THREE.SphereGeometry(0.1,12,8,0,Math.PI*2,0,Math.PI*0.5);
      for(const side of ['LeftArm','RightArm']){ const pd=new THREE.Mesh(padGeo,plate); pd.scale.set(1.15,0.7,1.1); const fore=side==='LeftArm'?'LeftForeArm':'RightForeArm'; if(anchor(pd,side,mid(side,fore,0.06),fore)) this.gear['pad_'+side]=pd; }
      for(const k in this.gear){ const o=this.gear[k]; o.traverse(m=>{ m.frustumCulled=false; if(m.isMesh) m.castShadow=true; }); } }
    this.gear.helmet.visible=!!g.helmet; this.gear.vest.visible=!!g.vest; this.gear.band.visible=!!g.band; this.gear.cage.visible=!!g.cage;
    for(const k of ['shin_LeftLeg','shin_RightLeg']) if(this.gear[k]) this.gear[k].visible=!!g.shins;
    for(const k of ['pad_LeftArm','pad_RightArm']) if(this.gear[k]) this.gear[k].visible=!!g.pads;
    if(!this.bossAccs) this.bossAccs={}; for(const k in this.bossAccs) if(this.bossAccs[k]) this.bossAccs[k].visible=false;
    if(g.boss){ let a=this.bossAccs[g.boss]; if(a===undefined) a=this.bossAccs[g.boss]=this.bossAcc(g.boss); if(a) a.visible=true; } }
  /** acessório de cada capitão (na cabeça): topete, boina, boné e óculos, fita, óculos escuros, hachimaki, cartola */
  bossAcc(key){ const H=this.bones.Head; if(!H) return null; const g=new THREE.Group(); const M=(c,r=0.6,m=0.1)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
    if(key==='esp'){ const h=new THREE.Mesh(new THREE.SphereGeometry(0.13,12,8),M(0x2a1a10,0.35)); h.scale.set(1.05,0.75,1.25); h.position.set(0,0.16,0.03); g.add(h); const q=new THREE.Mesh(new THREE.SphereGeometry(0.075,10,6),M(0x2a1a10,0.35)); q.position.set(0,0.24,0.1); g.add(q); }
    else if(key==='fra'){ const b=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.15,0.045,18),M(0x1f2a5a,0.9)); b.position.set(0.02,0.2,0); b.rotation.z=-0.22; g.add(b); const n=new THREE.Mesh(new THREE.SphereGeometry(0.016,6,6),M(0x1f2a5a,0.9)); n.position.set(0.03,0.228,0); g.add(n); }
    else if(key==='ale'){ const cp=new THREE.Mesh(new THREE.CylinderGeometry(0.155,0.135,0.085,18),M(0x1a1c20,0.6)); cp.position.set(0,0.19,0); g.add(cp); const pk=new THREE.Mesh(new THREE.BoxGeometry(0.19,0.015,0.1),M(0x0e0f12,0.3,0.3)); pk.position.set(0,0.155,0.13); pk.rotation.x=0.25; g.add(pk); const gl=new THREE.Mesh(new THREE.BoxGeometry(0.17,0.035,0.02),M(0x111111,0.2,0.6)); gl.position.set(0,0.06,0.14); g.add(gl); }
    else if(key==='bra'){ const b=new THREE.Mesh(new THREE.TorusGeometry(0.13,0.02,6,22),M(0xf2c94c,0.5,0.2)); b.rotation.x=Math.PI/2; b.position.set(0,0.13,0); g.add(b); }
    else if(key==='arg'){ const gl=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.045,0.02),M(0x0a0a0a,0.1,0.8)); gl.position.set(0,0.06,0.14); g.add(gl); }
    else if(key==='jpn'){ const b=new THREE.Mesh(new THREE.TorusGeometry(0.135,0.018,6,22),M(0xf4f4f4,0.7)); b.rotation.x=Math.PI/2; b.position.set(0,0.12,0); g.add(b); const d=new THREE.Mesh(new THREE.CircleGeometry(0.026,14),M(0xd8202a,0.6)); d.position.set(0,0.12,0.153); g.add(d); }
    else if(key==='cft'){ const hat=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.11,0.2,18),M(0x111114,0.5)); hat.position.set(0,0.29,0); g.add(hat); const br=new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.17,0.015,22),M(0x111114,0.5)); br.position.set(0,0.19,0); g.add(br); const rb=new THREE.Mesh(new THREE.CylinderGeometry(0.113,0.113,0.03,18),M(0xb8943a,0.4,0.6)); rb.position.set(0,0.21,0); g.add(rb); }
    else if(key==='hb'){ const b=new THREE.Mesh(new THREE.TorusGeometry(0.132,0.016,6,22),M([0xd8202a,0xf4f4f4,0x2fb34a,0x1f5fd0][Math.floor(Math.random()*4)],0.7)); b.rotation.x=Math.PI/2; b.position.set(0,0.1,0); g.add(b); }
    else if(key==='cap'){ const cc=[0x1a1c20,0xd8202a,0x1f5fd0,0xf4f4f4][Math.floor(Math.random()*4)]; const cp=new THREE.Mesh(new THREE.SphereGeometry(0.14,14,8,0,Math.PI*2,0,Math.PI/2),M(cc,0.8)); cp.position.set(0,0.13,0); cp.scale.set(1.02,0.8,1.08); g.add(cp); const pk=new THREE.Mesh(new THREE.BoxGeometry(0.17,0.012,0.11),M(cc,0.8)); pk.position.set(0,0.135,0.15); pk.rotation.x=0.12; g.add(pk); }
    else if(key==='gl'){ const gl=new THREE.Mesh(new THREE.BoxGeometry(0.17,0.04,0.02),M(0x0a0a0a,0.1,0.8)); gl.position.set(0,0.06,0.14); g.add(gl); }
    else if(key==='bd'){ const bd=new THREE.Mesh(new THREE.CylinderGeometry(0.128,0.118,0.07,16,1,true),M([0xb8202a,0x2a2a2a,0x3a5a2a][Math.floor(Math.random()*3)],0.9)); bd.position.set(0,-0.03,0.012); g.add(bd); }
    else return null;
    g.traverse(o=>{ o.frustumCulled=false; if(o.isMesh) o.castShadow=true; }); g.visible=false; H.add(g); return g; }
  /** riot shield held in front-left (Escudeiro role) */
  setShield(on){ if(on&&!this.shield){ const g=new THREE.Group(); const body=new THREE.Mesh(new THREE.BoxGeometry(0.72,1.15,0.05),new THREE.MeshStandardMaterial({color:0x1d2a44,roughness:0.5,metalness:0.4})); g.add(body); const visor=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.22,0.06),new THREE.MeshStandardMaterial({color:0x8fd3ff,roughness:0.1,metalness:0.6,transparent:true,opacity:0.7})); visor.position.set(0,0.3,0); g.add(visor); g.position.set(-0.22,0.95,-0.5); g.rotation.y=0.25; g.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.frustumCulled=false; } }); this.root.add(g); this.shield=g; } if(this.shield) this.shield.visible=!!on; }
  /** scale the locomotion clips so the stride matches the measured ground speed */
  setGaitSpeed(v,dir=1){ if(!this.lower) return; const nat=(this.t.gait||GAIT_SPEED)[this.lower._clip.name]; if(!nat) return; const ts=Math.max(0.75,Math.min(1.3,v/nat))*(dir<0?-1:1); this.lower.setEffectiveTimeScale(ts); if(this.upper&&/_upper$/.test(this.upper._clip.name)) this.upper.setEffectiveTimeScale(ts); }
  fireUpper(name){ if(this.full) return; const a=this.actions[name]; if(!a) return; if(this.oneshot&&this.oneshot!==a){ this.oneshot.stop(); } if(this.upper){ this.upper.enabled=true; this.upper.setEffectiveWeight(0.15); } a.reset(); a.setLoop(THREE.LoopOnce,1); a.clampWhenFinished=true; a.setEffectiveWeight(1); a.fadeIn(0.05); a.play(); this.oneshot=a; }
  playFull(name, next=null){ for(const a of [this.lower,this.upper,this.oneshot]) if(a) a.fadeOut(0.1); this.lower=this.upper=this.oneshot=null; const a=this.actions[name]; if(!a) return; a.reset(); a.setLoop(THREE.LoopOnce,1); a.clampWhenFinished=true; a.setEffectiveWeight(1); a.fadeIn(0.08); a.play(); this.full=a; if(next){ const cb=e=>{ if(e.action===a){ this.mixer.removeEventListener('finished',cb); const n=this.actions[next]; if(n){ a.fadeOut(0.12); n.reset(); n.setLoop(THREE.LoopOnce,1); n.clampWhenFinished=true; n.setEffectiveWeight(1); n.fadeIn(0.12); n.play(); this.full=n; } } }; this.mixer.addEventListener('finished',cb); } }
  setLod(l){ if(l===this.lod&&this._lodInit) return; this._lodInit=true; this.lod=l; for(const lvl of [0,1,2]) for(const sm of this.lods[lvl]) sm.visible=(lvl===l)&&!sm.userData.hairOff; }
  /** corte de cabelo (nome da malha Hair_*) e barba, independentes; sem argumentos = careca */
  setHair(style, beard){ for(const n in this.hairStyles){ const on=(n===style)||(!!beard&&n==='Hair_Beard'); for(const m of this.hairStyles[n]){ m.userData.hairOff=!on; m.visible=on&&(m.userData.lod===this.lod); } } }
  setShadows(on){ for(const lvl of [0,1]) for(const sm of this.lods[lvl]) sm.castShadow=on; }
  muzzle(on){ this.flash.visible=on; if(on){ this.flash.material.rotation=Math.random()*6.28; this.flashT=0.06; } }
  hitFlash(){ this.hitFlashT=0.08; for(const m of Object.values(this.mats)) m.emissive.setHex(0xff2020); }
  update(dt, camPos, lodBias=1){
    if(!this.alive) return;
    const d=this.root.position.distanceTo(camPos); let lod=d<14*lodBias?0:(d<32*lodBias?1:2); if(window.__forceLod!=null) lod=window.__forceLod; if(lod!==this.lod) this.setLod(lod);
    // far characters animate at a lower rate
    if(d>70){ this.animSkip=(this.animSkip+1)%2; if(this.animSkip) return; dt*=2; }
    if(this._post){ for(const [bn,q] of this._post) bn.quaternion.multiply(q.invert()); this._post.length=0; } else this._post=[];
    this.mixer.update(dt);
    this.lookT+=dt; if(this.lookT>this.lookNext){ this.lookNext=this.lookT+1.5+Math.random()*3; this.lookTgtYaw=(Math.random()-0.5)*0.5; this.lookTgtPitch=(Math.random()-0.5)*0.16; }
    this.lookYaw+=(this.lookTgtYaw-this.lookYaw)*Math.min(1,dt*2.5); this.lookPitch+=(this.lookTgtPitch-this.lookPitch)*Math.min(1,dt*2.5);
    if(this.bones.Head&&!this.full){ const k=this.upper&&/aim|shoot|reload/.test(this.upper._clip.name)?0.25:1; this._le.set(this.lookPitch*k,this.lookYaw*k,0); const q=new THREE.Quaternion().setFromEuler(this._le); this.bones.Head.quaternion.multiply(q); this._post.push([this.bones.Head,q]); }
    // tronco rodado para o alvo enquanto as pernas andam na direção do movimento (evita as animações laterais)
    this._tw=(this._tw||0)+((this.twist||0)-(this._tw||0))*Math.min(1,dt*8);
    if(!this.full&&Math.abs(this._tw)>0.002){ this._le.set(0,Math.max(-0.2,Math.min(0.2,this._tw/3)),0); for(const k of ['Spine','Spine1','Spine2']){ const bn=this.bones[k]; if(bn){ const q=new THREE.Quaternion().setFromEuler(this._le); bn.quaternion.multiply(q); this._post.push([bn,q]); } } }
    if(this.bones.Spine1){ const b=1+0.012*Math.sin(this.lookT*1.9); this.bones.Spine1.scale.set(b,1,b); }
    // cache the head position (bone matrices are refreshed by the renderer each frame)
    if(this.bones.Head){ this.bones.Head.getWorldPosition(this._head); this._head.y+=0.09*this.scale*this.t.headScale; this._headOk=true; }
    if(this.flashT>0){ this.flashT-=dt; if(this.flashT<=0) this.flash.visible=false; }
    if(this.hitFlashT>0){ this.hitFlashT-=dt; if(this.hitFlashT<=0) for(const m of Object.values(this.mats)) m.emissive.setHex(0); }
  }
  /** head centre in world space (cached each update; falls back to a rest estimate) */
  headCenter(out){ if(this._headOk) return out.copy(this._head); const p=this.root.position; return out.set(p.x,p.y+1.72*this.scale,p.z); }
  headRadius(){ return 0.135*this.scale*this.t.headScale; }
  /** returns {t, head} or null. o,d in world space. Head = sphere; body = vertical cylinder (forgiving, like the original game) */
  hitTest(o,d,maxT){
    const hc=this.headCenter(_v); const th=raySphere(o,d,hc,this.headRadius()); if(th>0&&th<=maxT) return {t:th,head:true};
    const p=this.root.position, top=this._headOk?(this._head.y-0.12*this.scale*this.t.headScale):(p.y+1.6*this.scale);
    const tb=rayCylinderY(o,d,p.x,p.z,0.45*this.scale,p.y,top,maxT); if(tb>=0) return {t:tb,head:false};
    return null;
  }
}
export class CharacterPool {
  /** template pode ser um array: a pool fica com uma mistura de corpos (macho/fêmea) */
  constructor(template, scene, size, opts){ const tps=Array.isArray(template)?template:[template]; this.items=[];
    for(let i=0;i<size;i++){ const t=tps[i%tps.length]; const c=new CharacterInstance(t,scene,opts); c.assetName=t.name||''; this.items.push(c); } }
  /** sem argumento devolve um livre à sorte (para os corpos variarem); com nome, prefere esse corpo */
  acquire(prefer){ const free=this.items.filter(c=>!c.alive); if(!free.length) return null;
    const pool=prefer?free.filter(c=>c.assetName===prefer):free; const from=pool.length?pool:free;
    return from[(Math.random()*from.length)|0]; }
  update(dt,camPos,lodBias){ for(const c of this.items) c.update(dt,camPos,lodBias); }
  setShadows(on){ for(const c of this.items) c.setShadows(on); }
}
