/** Builds a stadium level from external modules (instanced GLBs + PBR sets + HDRI) with procedural fallbacks. */
import * as THREE from 'three';
import { G, S, setMap } from './Grid.js';
import { TEAMS } from '../game/Data.js';
import { pitchMacro, crowdTex, adsTex, shopSignTex, cabinTex, crateTex, burlapTex, netTex, texPool, posterTex, groundTex, pitchLinesTex, blobTex } from './Textures.js';
/* identidade por país: chão e paletas das casinhas (paredes / portadas) */
const GROUND={esp:['calcada',2,0.9],fra:['lajes',3,0.88],ale:['asfalto',6,0.8],bra:['copacabana',3,0.85],arg:['empedrado',2,0.9]};
const WALLS={esp:[0xf4efe4,0xefe2c6,0xe6d2a8,0xf7f3ea,0xd8a468],fra:[0xece6da,0xdcd5c6,0xd2d9de,0xe9ddc6],ale:[0xb5563f,0x9c4a36,0xc9c2b4,0x8f8a82,0xd8cfbf],bra:[0xf2c94c,0x3fb6a8,0xe86a8a,0x7ac943,0xf5a04a,0x5aa0e0],arg:[0xd8323a,0x2f6fd0,0xf2c94c,0x3fa55a,0xe8e8e8],_:[0xe9e4d8,0xd8cdb4,0xc9d2d6,0xe0c9a0]};
const ACCENT={esp:[0x2f6f4a,0x1f4f8a,0x8a3a2a],fra:[0x3a4f6a,0x6a8aa0,0x2a2a2a],ale:[0x2a2e36,0x5a5f66,0x6a2a22],bra:[0x1f5f9a,0xd8323a,0x2f8a4a,0xf2c94c],arg:[0xf2c94c,0x2f6fd0,0xd8323a,0x3fa55a],_:[0x2f4f6a,0x6a3a2a,0x3f5a3a]};

const _m=new THREE.Matrix4(), _q=new THREE.Quaternion(), _p=new THREE.Vector3(), _s=new THREE.Vector3(1,1,1), _e=new THREE.Euler();
const CANVAS_MATS={ads:adsTex, shopsign:shopSignTex, cabin:cabinTex, crate:crateTex, burlap:burlapTex, net:netTex};
/** quantised (int/normalised) attributes cannot be transformed in place: convert to float before baking a node matrix */
function isQuantized(geo){ for(const k of ['position','normal','uv']){ const a=geo.attributes[k]; if(a&&(a.normalized||!(a.array instanceof Float32Array))) return true; } return false; }
function dequantize(src){ const geo=src.clone(); for(const k of Object.keys(geo.attributes)){ const a=geo.attributes[k]; if(a.array instanceof Float32Array&&!a.normalized) continue; if(k==='skinIndex') continue; const n=a.count, s=a.itemSize, out=new Float32Array(n*s); for(let i=0;i<n;i++) for(let c=0;c<s;c++) out[i*s+c]=a.getComponent(i,c); geo.setAttribute(k,new THREE.BufferAttribute(out,s)); } return geo; }
const FALLBACK_SIZES={casa:[4,3.4,4],lm_esp:[0.1,0.1,0.1],lm_fra:[0.1,0.1,0.1],lm_ale:[0.1,0.1,0.1],lm_bra:[0.1,0.1,0.1],lm_arg:[0.1,0.1,0.1],house:[8,3.25,8],tier:[4,0.85,1.1],seat:[0.44,0.7,0.42],railing:[4,1.05,0.06],wall:[4,1.1,0.25],walkway:[4,0.3,3],column:[1.2,26,1.2],roof:[4,0.5,18],mast:[2.2,46,2.2],goal:[0.12,2.5,7.4],goalnet:[0.1,0.1,0.1],adboard:[4,1,0.25],dugout:[4.2,2.3,2.3],container:[4,2.9,4],crate:[3.4,1.6,3.4],bigcrate:[3.4,2.6,3.4],barrier:[4,1,0.7],barrels:[2.4,1.2,2.4],sandbags:[3.6,1,0.7],shopcrate:[2.3,1.4,2.3],cabin:[4,3.2,4],tower:[3.6,9.6,3.6],lamppost:[0.2,6.5,0.2],cart:[2.6,1.7,1.5],flag:[0.1,1.5,0.1],rubble:[1.2,0.3,1.2]};
const FALLBACK_COLORS={casa:0xe9e4d8,tier:0x7d7b76,wall:0x8a8d93,container:0x9a3b2f,crate:0x8a5a2e,bigcrate:0x8a5a2e,barrier:0x9a9893,sandbags:0x9c8a5e,shopcrate:0x1f3a2a,cabin:0xd9dbd6,cart:0xf2f2f2,adboard:0xc8102e,dugout:0x2a2e36,mast:0x9a9da3,column:0x8a8a8a,roof:0x3a3d44};

export class WorldBuilder {
  constructor(scene, registry){ this.scene=scene; this.registry=registry; this.world=null; this.sun=null; this.hemi=null; this.amb=null; }
  async build(levelIdx, tier, hooks={}){
    const R=this.registry; setMap(levelIdx); const team=TEAMS[levelIdx], theme=team.theme; const W0=G.MW*S, H0=G.MH*S;
    this.dispose(); const group=new THREE.Group(); const lights=[], disposables=[], instancers={};
    this.team=team; this.theme=theme; this.levelIdx=levelIdx;
    const inst=(id,opts={})=>{ const k=id+(opts.key||''); return instancers[k]||(instancers[k]={id,opts,mats:[]}); };
    const place=(id,x,y,z,ry=0,opts={},sc=1)=>{ _p.set(x,y,z); _e.set(0,ry,0); _q.setFromEuler(_e); if(Array.isArray(sc)) _s.set(sc[0],sc[1],sc[2]); else _s.setScalar(sc); inst(id,opts).mats.push(_m.compose(_p,_q,_s).clone()); };
    /* ---------- pitch + apron ---------- */
    const grass=await R.materialSet('grass',8);
    const macro=pitchMacro(W0,H0);
    const pitchMat=new THREE.MeshStandardMaterial({map:macro, roughness:0.92, metalness:0, color:0xc9d6be}); // relva menos néon
    if(grass){ pitchMat.normalMap=grass.normalMap; pitchMat.normalMap.repeat.set(W0/2.5,H0/2.5); pitchMat.normalScale.set(0.7,0.7); if(grass.roughnessMap){ pitchMat.roughnessMap=grass.roughnessMap; pitchMat.roughnessMap.repeat.set(W0/2.5,H0/2.5); }
      pitchMat.onBeforeCompile=sh=>{ sh.uniforms.detailMap={value:grass.map}; sh.uniforms.detailRepeat={value:new THREE.Vector2(W0/2.5,H0/2.5)}; sh.fragmentShader='uniform sampler2D detailMap;uniform vec2 detailRepeat;\n'+sh.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nvec3 dcol=texture2D(detailMap,vMapUv*detailRepeat).rgb;diffuseColor.rgb*=dcol*2.1;'); }; pitchMat.customProgramCacheKey=()=>'pitch_detail'; }
    const pitch=new THREE.Mesh(new THREE.PlaneGeometry(W0,H0),pitchMat); pitch.rotation.x=-Math.PI/2; pitch.position.set(W0/2,0,H0/2); pitch.receiveShadow=true; group.add(pitch); disposables.push(pitch.geometry);
    { const gk=GROUND[theme.key]; if(gk){ // chão do país + linhas pintadas por cima
      const gt=groundTex(gk[0]); gt.repeat.set(W0/gk[1],H0/gk[1]); pitch.material=new THREE.MeshStandardMaterial({map:gt,roughness:gk[2],metalness:0});
      const ln=new THREE.Mesh(new THREE.PlaneGeometry(W0,H0),new THREE.MeshStandardMaterial({map:pitchLinesTex(W0,H0),transparent:true,depthWrite:false,roughness:0.9,polygonOffset:true,polygonOffsetFactor:-1})); ln.rotation.x=-Math.PI/2; ln.position.set(W0/2,0.01,H0/2); ln.receiveShadow=true; group.add(ln); disposables.push(ln.geometry); } }
    const apronMat=await R.pbr('rubber'); if(apronMat.map){ for(const t of [apronMat.map,apronMat.normalMap,apronMat.roughnessMap]) if(t) t.repeat.set(220,220); }
    const apron=new THREE.Mesh(new THREE.PlaneGeometry(900,900),apronMat); apron.rotation.x=-Math.PI/2; apron.position.set(W0/2,-0.03,H0/2); apron.receiveShadow=true; group.add(apron); disposables.push(apron.geometry);
    /* ---------- cells -> modules ---------- */
    let ads=0;
    for(let z=0;z<G.MH;z++) for(let x=0;x<G.MW;x++){
      const ch=G.MAP[z][x], cx=(x+0.5)*S, cz=(z+0.5)*S, B=G.BOX[x+z*G.MW];
      if(ch==='#'){ const corner=(x===0||x===G.MW-1)&&(z===0||z===G.MH-1); if(corner) continue; const k=(ads++)%8;
        if(z===0) place('adboard',cx,0,cz+S/2-0.125,0,{key:k,panel:k}); else if(z===G.MH-1) place('adboard',cx,0,cz-S/2+0.125,Math.PI,{key:k,panel:k}); else if(x===0) place('adboard',cx+S/2-0.125,0,cz,Math.PI/2,{key:k,panel:k}); else place('adboard',cx-S/2+0.125,0,cz,-Math.PI/2,{key:k,panel:k}); }
      else if(ch==='w'){ const k=(ads++)%8; place('adboard',cx,0,cz,B.vert?Math.PI/2:0,{key:k,panel:k}); }
      else if(ch==='C'){ if(theme.key==='cft') place('container',cx,0,cz,0,{color:true}); else { const roof=(G.ROOFS||[]).some(r=>r.x===x&&r.z===z); place('casa',cx,0,cz,roof?Math.PI/2:((x*3+z)%4)*Math.PI/2,{color:true}); } }
      else if(ch==='c') place('crate',cx,0,cz);
      else if(ch==='K') place('bigcrate',cx,0,cz,(x+z)%2?Math.PI/2:0);
      else if(ch==='B') place('house',x*S+4,0,z*S+4,0);
      else if(ch==='J') place('barrier',cx,0,cz,B.vert?Math.PI/2:0);
      else if(ch==='H') place('cabin',cx,0,cz);
      else if(ch==='D') place('dugout',cx,0,cz,z<G.MH/2?Math.PI:0,{color:true}); // open side faces the pitch
      else if(ch==='V') place('cart',cx,0,cz,B.rot?Math.PI/2:0);
      else if(ch==='S') place('sandbags',cx,0,cz,B.vert?Math.PI/2:0);
      else if(ch==='b') place('barrels',cx,0,cz);
      else if(ch==='T') place('tower',cx,0,cz);
      else if(ch==='L') place('lamppost',cx,0,cz);
      else if(ch==='M') place('shopcrate',cx,0,cz);
    }
    /* ---------- cartazes e grafitos nos contentores (VOTA NABO, PROCURA-SE, FORA NABO, VAR = VERGONHA) ---------- */
    { const spots=[[],[],[],[]],free=(x,z)=>x>=0&&z>=0&&x<G.MW&&z<G.MH&&!G.BOX[x+z*G.MW];let pk=0;
      for(let z=0;z<G.MH;z++) for(let x=0;x<G.MW;x++){ if(G.MAP[z][x]!=='C'||((x*7+z*13)%10)>=4) continue;
        const sides=[[1,0],[-1,0],[0,1],[0,-1]].filter(d=>free(x+d[0],z+d[1])); if(!sides.length) continue;
        const d=sides[(x+z)%sides.length],k=(pk++)%4; spots[k].push({x:(x+0.5)*S+d[0]*2.02,z:(z+0.5)*S+d[1]*2.02,ry:Math.atan2(d[0],d[1]),tilt:((x*3+z)%5-2)*0.025,y:1.35+((x+z)%3)*0.12}); }
      const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),eu=new THREE.Euler(),one=new THREE.Vector3(1,1,1);
      for(let k=0;k<4;k++){ const sp=spots[k]; if(!sp.length) continue; const geo=new THREE.PlaneGeometry(1.3,1.8); const mat=new THREE.MeshStandardMaterial({map:posterTex(k),roughness:0.85,polygonOffset:true,polygonOffsetFactor:-2});
        const im=new THREE.InstancedMesh(geo,mat,sp.length); sp.forEach((p,i)=>{ eu.set(0,p.ry,p.tilt); q.setFromEuler(eu); m4.compose(new THREE.Vector3(p.x,p.y,p.z),q,one); im.setMatrixAt(i,m4); });
        im.instanceMatrix.needsUpdate=true; im.computeBoundingSphere(); im.receiveShadow=true; im.userData.moduleId='poster'+k; group.add(im); disposables.push(geo); } }
    /* ---------- monumento do país ao longe, atrás da bancada norte (alto o suficiente para se ver por cima da cobertura) ---------- */
    { const LMK={esp:['lm_esp',0.28,165,1.6],fra:['lm_fra',-0.22,230,1.05],ale:['lm_ale',0.3,230,0.95],bra:['lm_bra',-0.3,220,1.25],arg:['lm_arg',0.25,160,1.8]}[theme.key];
      if(LMK) place(LMK[0],W0*(0.5+LMK[1]),0,-LMK[2],0,{},LMK[3]); }
    /* ---------- sombras de contacto por baixo dos objetos (sem elas, nas qualidades sem sombras os objetos pareciam flutuar) ---------- */
    { const SZ={C:5.0,c:1.9,K:2.8,b:2.2,S:3.2,J:3.0,H:4.2,V:3.4,M:2.6,T:4.6};const sp=[];
      for(let z=0;z<G.MH;z++) for(let x=0;x<G.MW;x++){ const s=SZ[G.MAP[z][x]]; if(s) sp.push([(x+0.5)*S,(z+0.5)*S,s]); }
      if(sp.length){ const geo=new THREE.PlaneGeometry(1,1);geo.rotateX(-Math.PI/2); const mat=new THREE.MeshBasicMaterial({map:blobTex(),transparent:true,depthWrite:false,opacity:0.62,color:0x000000,polygonOffset:true,polygonOffsetFactor:-2});
        const im=new THREE.InstancedMesh(geo,mat,sp.length);const m4=new THREE.Matrix4();sp.forEach((p,i)=>{m4.makeScale(p[2],1,p[2]);m4.setPosition(p[0],0.02,p[1]);im.setMatrixAt(i,m4);});im.instanceMatrix.needsUpdate=true;im.computeBoundingSphere();im.userData.moduleId='blob';group.add(im);disposables.push(geo); } }
    /* ---------- escadas de mão das casinhas com terraço (2 malhas instanciadas: montantes e degraus) ---------- */
    { const R=G.ROOFS||[]; if(R.length){ const railG=new THREE.BoxGeometry(0.05,3.55,0.05),rungG=new THREE.BoxGeometry(0.46,0.035,0.035),mat=await this.registry.pbr('metal_dark');
        const rails=new THREE.InstancedMesh(railG,mat,R.length*2),rungs=new THREE.InstancedMesh(rungG,mat,R.length*11),m4=new THREE.Matrix4();let ri=0,gi=0;
        for(const r of R){ for(const s of [-0.24,0.24]){ m4.makeTranslation(r.lx+s,1.775,r.lz+0.07); rails.setMatrixAt(ri++,m4); } for(let k=0;k<11;k++){ m4.makeTranslation(r.lx,0.3+k*0.3,r.lz+0.07); rungs.setMatrixAt(gi++,m4); } }
        for(const im of [rails,rungs]){ im.instanceMatrix.needsUpdate=true; im.computeBoundingSphere(); im.castShadow=true; im.userData.moduleId='ladder'; group.add(im); } disposables.push(railG,rungG); } }
    /* ---------- vegetação (posições e colisão definidas em Grid.js: G.TREES) ---------- */
    for(const tr of (G.TREES||[])) place(tr.sp,tr.x,0,tr.z,tr.yaw,{},tr.sc);
    /* ---------- goals, flags ---------- */
    // goals sit on the short ends: crossbar along z (parallel to the goal line), net behind (away from the pitch)
    place('goal',7.5,0,H0/2,-Math.PI/2); place('goalnet',7.5,0,H0/2,-Math.PI/2); place('goal',W0-7.5,0,H0/2,Math.PI/2); place('goalnet',W0-7.5,0,H0/2,Math.PI/2);
    for(const f of [[7.5,6],[W0-7.5,6],[7.5,H0-6],[W0-7.5,H0-6]]) place('flag',f[0],0,f[1],0);
    /* ---------- stands ---------- */
    const rows=[]; const addBlock=(startD,n,baseY)=>{ for(let i=0;i<n;i++){ const d=startD+i*1.1, y=baseY+i*0.85; rows.push({d,y,i}); } return {d:startD+n*1.1, top:baseY+n*0.85}; };
    const b1=addBlock(2.5,14,0), b2=addBlock(b1.d+3,12,b1.top);
    const perim=(d,cb)=>{ // callback(x,z,ry,len) along the 4 sides at distance d from the arena edge
      for(let x=-d-1.1;x<W0+d+1.1;x+=4){ cb(x+2,-(d+0.55),0,4); cb(x+2,H0+d+0.55,Math.PI,4); }
      for(let z=-d;z<H0+d;z+=4){ cb(-(d+0.55),z+2,Math.PI/2,4); cb(W0+d+0.55,z+2,-Math.PI/2,4); } };
    for(const r of rows) perim(r.d,(x,z,ry)=>{ place('tier',x,r.y,z,ry); place('crowdrow',x,r.y,z,ry); });
    /* adeptos em 3D na primeira fila (corpo + cabeça instanciados; a maioria com a camisola da seleção) */
    if(tier.seatsRows>0&&rows.length){ const r0=rows[0],fans=[];let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
      perim(r0.d,(x,z,ry)=>{ const c=Math.cos(ry),s=Math.sin(ry); for(const k of [-1.5,-0.5,0.5,1.5]){ if(rnd()<0.3)continue; const lx=k+ (rnd()-0.5)*0.2,lz=0.18; fans.push({x:x+lx*c+lz*s,y:r0.y+0.85,z:z-lx*s+lz*c,ry:ry+(rnd()-0.5)*0.5,h:0.92+rnd()*0.16,team:rnd()<0.62}); } });
      if(fans.length){ const bodyG=new THREE.BoxGeometry(0.42,0.95,0.24);bodyG.translate(0,0.5,0);const headG=new THREE.SphereGeometry(0.13,8,6);headG.translate(0,1.12,0);
        const bm=new THREE.InstancedMesh(bodyG,new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.9}),fans.length),hm=new THREE.InstancedMesh(headG,new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.8}),fans.length);
        const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),sc=new THREE.Vector3(),col=new THREE.Color(),SK=[0xf0c8a0,0xd9a47a,0xa8714a,0x6a4430],tc=new THREE.Color(team.shirt||0xd8202a),OTH=[0x1f5fd0,0x2fb34a,0xf2c94c,0xf4f4f4,0x3a3a3a];
        fans.forEach((f,i)=>{ q.setFromAxisAngle(new THREE.Vector3(0,1,0),f.ry); sc.set(1,f.h,1); m4.compose(new THREE.Vector3(f.x,f.y,f.z),q,sc); bm.setMatrixAt(i,m4); hm.setMatrixAt(i,m4); bm.setColorAt(i,f.team?tc:col.setHex(OTH[i%OTH.length])); hm.setColorAt(i,col.setHex(SK[i%SK.length])); });
        for(const im of [bm,hm]){ im.instanceMatrix.needsUpdate=true; if(im.instanceColor)im.instanceColor.needsUpdate=true; im.computeBoundingSphere(); im.userData.moduleId='fans'; group.add(im); } disposables.push(bodyG,headG); } }
    for(let i=0;i<Math.min(tier.seatsRows,14);i++){ const r=rows[i]; perim(r.d,(x,z,ry,len)=>{ for(let k=-1.5;k<=1.5;k+=1){ const c=Math.cos(ry), s=Math.sin(ry); place('seat',x+c*k*0.5*2,r.y+0.85,z-s*k*0.5*2,ry,{color:true}); } }); }
    const ring=(id,d,y,depth)=>{ const lx=W0+2*(d+depth), lz=H0+2*d; place(id,W0/2,y,-(d+depth/2),0,{},[lx/4,1,1]); place(id,W0/2,y,H0+d+depth/2,Math.PI,{},[lx/4,1,1]); place(id,-(d+depth/2),y,H0/2,Math.PI/2,{},[lz/4,1,1]); place(id,W0+d+depth/2,y,H0/2,-Math.PI/2,{},[lz/4,1,1]); };
    ring('wall',1.4,0,0.25); // pitch-side wall ring (one long instance per side)
    ring('walkway',b1.d,b1.top-0.3,3);
    perim(b1.d+3.0-0.55,(x,z,ry)=>place('railing',x,b1.top,z,ry));
    const rd0=b2.d-15, rd1=b2.d+3, ry_=b2.top+3.5;
    for(let x=-rd1+8;x<=W0+rd1-8;x+=22){ place('column',x,0,-(rd1-0.7)); place('column',x,0,H0+rd1-0.7); }
    for(let z=8;z<=H0-8;z+=20){ place('column',-(rd1-0.7),0,z); place('column',W0+rd1-0.7,0,z); }
    ring('roof',rd0,ry_,18);
    for(const c of [[-28,-28],[W0+28,-28],[-28,H0+28],[W0+28,H0+28]]){ const yaw=Math.atan2(W0/2-c[0],H0/2-c[1]); place('mast',c[0],0,c[1],yaw); }
    /* ---------- instantiate modules ---------- */
    for(const k in instancers){ const it=instancers[k]; if(!it.mats.length) continue; await this._instantiate(group,it,team,theme,tier,disposables); }
    /* ---------- scoreboard ---------- */
    if(hooks.scoreTex){ const board=new THREE.Mesh(new THREE.PlaneGeometry(24,7.5),new THREE.MeshBasicMaterial({map:hooks.scoreTex})); board.position.set(W0/2,36,H0+26.9); board.rotation.y=Math.PI; group.add(board); disposables.push(board.geometry);
      const box=new THREE.Mesh(new THREE.BoxGeometry(26,9,1.6),await R.pbr('metal_dark')); box.position.set(W0/2,36,H0+27.9); group.add(box); disposables.push(box.geometry); }
    /* ---------- environment + lights ---------- */
    const env=await R.environment(theme.hdri);
    if(env){ this.scene.environment=env.env; this.scene.background=env.background; this.scene.backgroundBlurriness=0.0; this.scene.environmentIntensity=(theme.night?0.6:1.0)*tier.envIntensity; this.scene.backgroundIntensity=theme.night?0.7:1.0; }
    else { this.scene.background=new THREE.Color(theme.fog[0]); }
    if(!this.sun){ this.sun=new THREE.DirectionalLight(0xffffff,1); this.sun.castShadow=true; this.scene.add(this.sun); this.scene.add(this.sun.target); this.hemi=new THREE.HemisphereLight(0xffffff,0x444444,0.5); this.scene.add(this.hemi); }
    const sd=new THREE.Vector3(...theme.sunDir).normalize(); this.sun.position.set(W0/2+sd.x*190,sd.y*190,H0/2+sd.z*190); this.sun.target.position.set(W0/2,0,H0/2);
    this.sun.color.setHex(theme.sunCol); this.sun.intensity=theme.sunInt*(env?0.85:1.4); this.hemi.color.setHex(theme.hemi[0]); this.hemi.groundColor.setHex(theme.hemi[1]); this.hemi.intensity=env?theme.hemi[2]*0.35:theme.hemi[2];
    const sc=this.sun.shadow.camera; sc.left=-84; sc.right=84; sc.top=84; sc.bottom=-84; sc.near=20; sc.far=360; sc.updateProjectionMatrix(); this.sun.shadow.bias=-0.0005; this.sun.shadow.normalBias=0.04;
    if(theme.flood>=0.9){ for(const c of [[-28,-28],[W0+28,-28],[-28,H0+28],[W0+28,H0+28]]){ const l=new THREE.PointLight(0xfff0d8, theme.night?900:400, 260, 1.6); l.position.set(c[0],44,c[1]); this.scene.add(l); lights.push(l);
        const len=Math.hypot(W0/2-c[0],44,H0/2-c[1])*0.72, cg=new THREE.ConeGeometry(15,len,18,1,true); cg.rotateX(-Math.PI/2); const cone=new THREE.Mesh(cg,new THREE.MeshBasicMaterial({color:0xfff2d8,transparent:true,opacity:theme.night?0.045:0.03,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false})); cone.position.set(c[0]+(W0/2-c[0])*0.36,44*0.64,c[1]+(H0/2-c[1])*0.36); cone.lookAt(W0/2,0,H0/2); group.add(cone); disposables.push(cg); } }
    this.scene.fog=new THREE.Fog(new THREE.Color(theme.fog[0]),theme.fog[1]*1.4,theme.fog[2]*1.6);
    this.scene.add(group); this.world={group,lights,disposables,W0,H0};
    return this.world;
  }
  async _instantiate(group,it,team,theme,tier,disposables){
    const R=this.registry; const mod=await R.module(it.id==='crowdrow'?null:it.id);
    if(it.id==='crowdrow'){ const geo=new THREE.PlaneGeometry(4,0.85); geo.translate(0,0.425,0.562); const mat=new THREE.MeshStandardMaterial({map:crowdTex(team),roughness:1}); mat.map.repeat.set(1,0.5); const im=new THREE.InstancedMesh(geo,mat,it.mats.length); it.mats.forEach((m,i)=>im.setMatrixAt(i,m)); im.instanceMatrix.needsUpdate=true; im.computeBoundingSphere(); im.userData.moduleId=it.id+':'+((typeof mesh!=='undefined'&&mesh&&mesh.material)?mesh.material.name:''); im.receiveShadow=true; group.add(im); disposables.push(geo); return; }
    if(!mod){ // fallback: box with the module's footprint (keeps the game playable without assets)
      const sz=FALLBACK_SIZES[it.id]||[2,1.5,2]; const geo=new THREE.BoxGeometry(sz[0],sz[1],sz[2]); geo.translate(0,sz[1]/2,0); const im=new THREE.InstancedMesh(geo,new THREE.MeshStandardMaterial({color:FALLBACK_COLORS[it.id]||0x8a8a8a,roughness:0.8}),it.mats.length); it.mats.forEach((m,i)=>im.setMatrixAt(i,m)); im.instanceMatrix.needsUpdate=true; im.computeBoundingSphere(); im.userData.moduleId=it.id+':'+((typeof mesh!=='undefined'&&mesh&&mesh.material)?mesh.material.name:''); im.castShadow=true; im.receiveShadow=true; group.add(im); disposables.push(geo); return; }
    for(const mesh of mod.meshes){
      const name=mesh.material.name; const hasCol=!!mesh.geometry.getAttribute('color');
      let mat; if(CANVAS_MATS[name]){ mat=(await R.pbr(name,{vertexColors:hasCol,key:name+(it.opts.panel??'')})).clone(); const t=CANVAS_MATS[name](); mat.map=t; if(name==='ads'){ mat.map=t.clone(); mat.map.repeat.set(1/8,1); mat.map.offset.set((it.opts.panel||0)/8,0); mat.map.needsUpdate=true; mat.emissiveMap=mat.map; mat.emissive.setHex(0xffffff); mat.emissiveIntensity=theme.flood>=0.9?0.5:0.1; } if(name==='net'){ mat.transparent=true; mat.alphaTest=0.3; mat.side=THREE.DoubleSide; mat.map.repeat.set(7,2.4); } mat.needsUpdate=true; }
      else mat=await R.pbr(name,{vertexColors:hasCol});
      if(name==='lamp'&&theme.flood<0.9){ mat=mat.clone(); mat.emissiveIntensity=0.15; }
      mesh.updateWorldMatrix(true,false); let geo=mesh.geometry; if(!mesh.matrixWorld.equals(new THREE.Matrix4())||isQuantized(geo)){ geo=dequantize(mesh.geometry).applyMatrix4(mesh.matrixWorld); geo.computeBoundingSphere(); disposables.push(geo); }
      if(name==='ads'){ // verso do painel: inverter o U para o texto não aparecer espelhado quando visto por trás
        if(geo===mesh.geometry){ geo=dequantize(mesh.geometry); disposables.push(geo); } const nA=geo.getAttribute('normal'),uA=geo.getAttribute('uv'); if(nA&&uA){ for(let i=0;i<uA.count;i++) if(nA.getZ(i)<-0.5) uA.setX(i,1-uA.getX(i)); uA.needsUpdate=true; } }
      const im=new THREE.InstancedMesh(geo,mat,it.mats.length); it.mats.forEach((m,i)=>im.setMatrixAt(i,m)); im.instanceMatrix.needsUpdate=true; im.computeBoundingSphere(); im.userData.moduleId=it.id+':'+((typeof mesh!=='undefined'&&mesh&&mesh.material)?mesh.material.name:'');
      if(it.opts.color&&!(it.id==='casa'&&name!=='plaster'&&name!=='shutter')){ const tk=theme.key; const cols=it.id==='casa'?(name==='plaster'?(WALLS[tk]||WALLS._):(ACCENT[tk]||ACCENT._)):it.id==='container'?[0x9a3b2f,0x2f5f9a,0x3f7a3f,0x8a7a2a,0x6a6a72,0xa25e2a]:[team.shirt,team.crowd[1]||0xffffff,team.shirt,team.crowd[0]]; const c=new THREE.Color(); it.mats.forEach((m,i)=>{ c.setHex(cols[i%cols.length]); im.setColorAt(i,c); }); im.instanceColor.needsUpdate=true; }
      const heavy=it.id==='tier'||it.id==='seat'||it.id==='roof'||it.id==='column'; im.castShadow=!heavy||it.id==='column'||it.id==='roof'; im.receiveShadow=true; im.frustumCulled=false;
      group.add(im);
    }
  }
  dispose(){ if(!this.world) return; this.scene.remove(this.world.group); for(const l of this.world.lights) this.scene.remove(l); for(const g of this.world.disposables) g.dispose(); this.world=null; }
}
