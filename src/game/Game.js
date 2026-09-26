/** Regresso do Pistoleiro — gameplay module (ported from the single-file v4b and adapted to the asset pipeline).
 *  Rendering: modern three.js, HalfFloat MSAA render target, ACES + bloom post chain, quality tiers.
 *  Characters: skinned GLB instances from CharacterPool (fallback: capsule characters). World: WorldBuilder. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TEAMS, DIFF, WEAPONS, ORDER, HIP, ADSP, ROLES, QUIPS, SHOP , MODS, OBJECTIVES, EVENTS, ATTACHMENTS, WCAT, ARMOR_OF, ARMOR_MULT, ARMOR_TIP, CLASS_INFO, CHALLENGES , TEAM_RULES , MAIN } from './Data.js';
import { G, S, setMap, computeFlow, collideCircle, los, rayWorld, rayEnemies, boxAt, inArena, HIT, groundAt, ladderAt, buildingAt } from '../world/Grid.js';
import { texPuff, texFire, texHole, texJersey, numberTex, canvasTex, CROWD_TEX } from '../world/Textures.js';
import { PROLOGUE, EPILOGUE, CAPTAINS, ANNOUNCER, HEADLINES, RADIO, CHANTS, PAPER, PRESIDENT, HERO, POSTCARDS, TUNNEL, CHAPTERS, EVIDENCE, ENDINGS, SHOUTS, PHILO, fill, pickLine } from './Story.js';
import { portrait, CH } from './Portraits.js';
import { nationScene, tunnelScene } from './Scenes.js';
const _sceneCache={};const sceneURL=k=>_sceneCache[k]||(_sceneCache[k]='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(nationScene(k.split(':')[0],{won:k.endsWith(':won')})));
const _ptCache={};function portraitURL(k,m){const key=k+':'+(m||'');return _ptCache[key]||(_ptCache[key]='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(portrait(CH[k]?k:'hero',m)));}
const _tunCache={};function tunnelURL(t){const hx=v=>'#'+(v||0).toString(16).padStart(6,'0');return _tunCache[t.key]||(_tunCache[t.key]='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(tunnelScene(hx(t.shirt),hx(t.trim||t.shorts))));}
import { TIERS, TIER_ORDER, defaultTier, effectivePixelRatio } from '../core/Quality.js';
import { DebugPanel } from '../core/Debug.js';
import { CharacterTemplate, CharacterPool } from '../characters/Character.js';
import { WorldBuilder } from '../world/WorldBuilder.js';

export async function startGameApp({ renderer, registry }){
const TAU=Math.PI*2,rand=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>v<a?a:v>b?b:v,$=id=>document.getElementById(id),pick=a=>a[Math.floor(Math.random()*a.length)];
const isTouch=navigator.maxTouchPoints>0||('ontouchstart' in window);
if(isTouch)document.body.classList.add('touch');
const C=h=>new THREE.Color(h);
const SENS=[{label:'Baixa',v:0.7},{label:'Normal',v:1},{label:'Alta',v:1.4}];
/* ===================== Guardar progresso e definições ===================== */
const SAVE_KEY='rdp_fps_v5';
const save={settings:{level:0,diff:'regular',quality:defaultTier(isTouch),sens:1,auto:true,sound:true,debug:false,hud:0.85},prog:{xp:0,level:1,kills:0,head:0,games:0,best:{},unlocked:0,champion:false,money:0,owned:{},up:{dmg:0,mag:0,reload:0,hp:0,head:0,blast:0,speed:0},att:{},daily:null,name:'',seenPrologue:false,wxp:{}}};
function mergeSave(o){if(!o||typeof o!=='object')return;if(o.settings)Object.assign(save.settings,o.settings);if(o.prog&&((o.prog.level||1)*1e6+(o.prog.xp||0))>=((save.prog.level||1)*1e6+(save.prog.xp||0)))Object.assign(save.prog,o.prog);}
function loadLocal(){try{const v=localStorage.getItem(SAVE_KEY);if(v)mergeSave(JSON.parse(v));}catch(e){}sanitize();try{if(save.prog.lineBak){applyLoadout(save.prog.lineBak);delete save.prog.lineBak;}}catch(e){}}
function sanitize(){const s=save.settings,p=save.prog;if(!(p.unlocked>=0))p.unlocked=0;p.unlocked=Math.min(p.unlocked,TEAMS.length-1);if(!(s.level>=0&&s.level<=p.unlocked))s.level=0;if(!DIFF[s.diff])s.diff='regular';if(!TIERS[s.quality])s.quality=defaultTier(isTouch);if(!SENS[s.sens])s.sens=1;if(!(p.level>=1))p.level=1;if(!(p.xp>=0))p.xp=0;if(!p.best)p.best={};if(!(p.money>=0))p.money=0;if(!p.owned)p.owned={};const up=Object.assign({dmg:0,mag:0,reload:0,hp:0,head:0},p.up||{});for(const k in up)if(!(up[k]>=0))up[k]=0;p.up=up;}
function persist(){const s=JSON.stringify(save);try{localStorage.setItem(SAVE_KEY,s);}catch(e){}}
const xpFor=l=>Math.round(120*Math.pow(l,1.5));
const B=k=>(WEAPONS[k]&&WEAPONS[k].base)||k; // tipo-base (modelo, animações, som)
const unlocked=k=>k==='ar'||k==='pistol'||!!save.prog.owned[k]; // começa-se com espingarda e pistola; o resto compra-se
/* progresso em linha: armas à venda por fase da história; checkpoint de equipamento por nível; modos rápidos do zero */
const WSTAGE={shotgun:1,smg:2,sniper:3,gl:4,lmg:4,rpg:5};
const econ=()=>quickRun?1:0.33; // história: dinheiro escasso, cada compra é uma escolha
/* sugestão do armeiro: tipos de dano que resultam contra cada seleção (com base no olheiro) */
const REC={esp:['medio'],fra:['explosivo','perfurante'],ale:['perfurante','explosivo'],bra:['dispersao','ligeiro'],arg:['perfurante'],ita:['perfurante','explosivo'],eng:['dispersao','medio'],ned:['perfurante','medio'],uru:['perfurante','explosivo'],jpn:['dispersao','perfurante'],cft:['explosivo','perfurante']};
function armSuggest(){ const cur_=REC[team.key]||['medio'],nt=(!team.extra&&!quickRun&&levelIdx+1<MAIN)?TEAMS[levelIdx+1]:null,nx=nt?(REC[nt.key]||[]):[];
  const want=[...new Set([...cur_,...nx])],cand=ORDER.filter(k=>!unlocked(k)&&want.includes(WEAPONS[k].cls)&&wStage(k)<=storyStage()).map(k=>({k,it:SHOP.find(x=>x.kind==='weapon'&&x.w===k)})).filter(o=>o.it).sort((a,b)=>a.it.price-b.it.price).slice(0,2);
  const nm=c=>(CLASS_INFO[c]?CLASS_INFO[c].nome.toLowerCase():c);
  return {rec:cur_,txt:'Contra '+team.nome+': dano '+cur_.map(nm).join(' ou ')+(nt?' · Próximo jogo ('+nt.nome+'): '+nx.map(nm).join(' ou '):'')+(cand.length?' · Já à venda: '+cand.map(o=>WEAPONS[o.k].nome+' ('+o.it.price.toLocaleString('pt-PT')+' €)').join(', '):'')+(want.includes('explosivo')?' · Granadas também servem.':'')}; }
const wStage=k=>WSTAGE[k]||(WEAPONS[k]&&WEAPONS[k].stage)||1;
let quickRun=false,lastQuickId=null;
const storyStage=()=>quickRun?99:(team&&team.extra?Math.max(3,team.tier||3):(levelIdx+1));
const _clone=o=>JSON.parse(JSON.stringify(o||{}));
function snapLoadout(){ const p=save.prog; return _clone({money:p.money||0,owned:p.owned,up:p.up,wup:p.wup,attW:p.attW,att:p.att}); }
function applyLoadout(sn){ if(!sn)return; const p=save.prog; p.money=sn.money||0; p.owned=_clone(sn.owned); p.up=Object.assign(Object.fromEntries(Object.keys(p.up||{}).map(k=>[k,0])),_clone(sn.up)); p.wup=_clone(sn.wup); p.attW=_clone(sn.attW); p.att=_clone(sn.att); }
function arcadeBase(){ const p=save.prog; return {money:2000,owned:{},up:Object.fromEntries(Object.keys(p.up||{}).map(k=>[k,0])),wup:{},attW:{},att:{}}; }
function restoreLine(){ if(save.prog.lineBak){ applyLoadout(save.prog.lineBak); delete save.prog.lineBak; } }
/* armeiro: melhorias próprias de cada arma (cano +8% dano, carregador +15%, mecanismo −10% recarga), somam-se às globais */
const WUP={barrel:{nome:'Cano reforçado',ef:'+6% dano',max:5,price:[600,1100,1700,2400,3200]},mag:{nome:'Carregador alargado',ef:'+12% capacidade',max:4,price:[500,900,1400,2000]},mech:{nome:'Mecanismo afinado',ef:'−8% recarga',max:4,price:[500,900,1400,2000]}};
const wu=k=>{ const p=save.prog; p.wup=p.wup||{}; return p.wup[k]||(p.wup[k]={barrel:0,mag:0,mech:0}); };
const keyOfW=w=>{ for(const k in WEAPONS) if(WEAPONS[k]===w) return k; return null; };
const magOf=k=>Math.round(WEAPONS[k].mag*(1+0.25*save.prog.up.mag)*wMagMul(k)*(1+0.12*wu(k).mag));
const dmgOf=w=>{ const k=keyOfW(w); return w.dmg*(1+0.12*save.prog.up.dmg)*(k?(1+0.06*wu(k).barrel)*(1+0.02*Math.max(0,wlevel(k)-5)):1); };
const reloadOf=w=>{ const k=keyOfW(w); return w.reload*(1-0.15*save.prog.up.reload)*(k?(1-0.08*wu(k).mech)*(1-0.03*Math.max(0,wlevel(k)-5)):1); };
const headMult=(w)=>((w&&w.headMul)||2)+0.5*save.prog.up.head;
/* weapon XP: kills per weapon unlock small permanent bonuses (level 2: -10% recoil, 3: +8% damage, 4: +15% magazine, 5: faster ADS) */
const WXP_LEVELS=[0,15,40,80,140,220,320,450,600,800];
const wxp=k=>(save.prog.wxp&&save.prog.wxp[k])||0;
const wlevel=k=>{const x=wxp(k);let l=1;for(let i=1;i<WXP_LEVELS.length;i++)if(x>=WXP_LEVELS[i])l=i+1;return l;};
const wDmgMul=k=>wlevel(k)>=3?1.08:1;const wKickMul=k=>wlevel(k)>=2?0.9:1;const wMagMul=k=>wlevel(k)>=4?1.15:1;const wAdsMul=k=>wlevel(k)>=5?0.75:1;
/* ===================== Renderer, câmara, pós-processamento ===================== */
const glc=renderer.domElement,hud=$('hud'),hctx=hud.getContext('2d');
let W=0,H=0,DPR=1,Q=TIERS.medium,baseFov=78;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.NoToneMapping;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(78,1,0.05,900);camera.rotation.order='YXZ';scene.add(camera);
const flashLight=new THREE.PointLight(0xffb060,0,10,2);flashLight.position.set(0.25,-0.15,-1.3);camera.add(flashLight);
let dynScale=1,dynAcc=0,dynN=0,dynGood=0;
const boomLights=[];for(let i=0;i<1;i++){const l=new THREE.PointLight(0xffa040,0,20,2);scene.add(l);boomLights.push({l:l,t:0});}
const rtOpts={minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,type:THREE.HalfFloatType,samples:4};
const rt=new THREE.WebGLRenderTarget(8,8,rtOpts);renderer.info.autoReset=false;
const postMat=new THREE.ShaderMaterial({
  uniforms:{tDiffuse:{value:rt.texture},uTime:{value:0},uHurt:{value:0},uAber:{value:1},uExp:{value:1},uSat:{value:0.94},uRes:{value:new THREE.Vector2(1,1)}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
  fragmentShader:'uniform sampler2D tDiffuse;uniform sampler2D tBloom;uniform vec2 uRes;uniform float uTime,uHurt,uAber,uExp,uSat,uBloom;varying vec2 vUv;'+
  'vec3 aces(vec3 x){return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);}'+
  'float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}'+
  'void main(){vec2 uv=vUv;vec2 c=uv-0.5;float r=length(c);vec2 off=c*(uAber-1.0)*(0.0015+r*r*0.012);'+
  'vec3 col=vec3(texture2D(tDiffuse,uv+off).r,texture2D(tDiffuse,uv).g,texture2D(tDiffuse,uv-off).b);'+
  'col+=texture2D(tBloom,uv).rgb*uBloom;col=aces(col*uExp);float lum=dot(col,vec3(0.2126,0.7152,0.0722));col=mix(vec3(lum),col,uSat);'+
  'col=pow(max(col,vec3(0.0)),vec3(1.0/2.2));'+
  'float l2=dot(col,vec3(0.2126,0.7152,0.0722));col=mix(col,col*col*(3.0-2.0*col),0.22);col*=mix(vec3(0.93,0.98,1.06),vec3(1.04,1.0,0.95),smoothstep(0.15,0.75,l2));'+
  'col*=1.0-0.28*smoothstep(0.5,1.0,r);'+
  'col=mix(col,vec3(0.55,0.03,0.03),uHurt*smoothstep(0.15,0.8,r));col+=(hash(uv*uRes+fract(uTime))-0.5)*0.014;'+
  'gl_FragColor=vec4(col,1.0);}',
  depthTest:false,depthWrite:false});
const postScene=new THREE.Scene(),postCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1),quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),postMat);postScene.add(quad);
const rtB1=new THREE.WebGLRenderTarget(8,8,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,type:THREE.HalfFloatType}),rtB2=new THREE.WebGLRenderTarget(8,8,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,type:THREE.HalfFloatType});
const POSTVS='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
const brightMat=new THREE.ShaderMaterial({uniforms:{tDiffuse:{value:rt.texture},uTexel:{value:new THREE.Vector2(1/8,1/8)},uThresh:{value:0.9}},vertexShader:POSTVS,
  fragmentShader:'uniform sampler2D tDiffuse;uniform vec2 uTexel;uniform float uThresh;varying vec2 vUv;'+
  'vec3 T(vec2 o){vec3 s=texture2D(tDiffuse,vUv+o).rgb;float l=dot(s,vec3(0.2126,0.7152,0.0722));return s*(max(l-uThresh,0.0)/max(l,0.001));}'+
  'void main(){vec2 d=vec2(uTexel.x,0.0);vec3 c=T(vec2(0.0,0.0))*0.383+(T(d)+T(-d))*0.242+(T(2.0*d)+T(-2.0*d))*0.061+(T(3.0*d)+T(-3.0*d))*0.006;gl_FragColor=vec4(c,1.0);}',depthTest:false,depthWrite:false});
const blurMat=new THREE.ShaderMaterial({uniforms:{tDiffuse:{value:rtB1.texture},uTexel:{value:new THREE.Vector2(1/8,1/8)}},vertexShader:POSTVS,
  fragmentShader:'uniform sampler2D tDiffuse;uniform vec2 uTexel;varying vec2 vUv;'+
  'void main(){vec2 d=vec2(0.0,uTexel.y);vec3 c=texture2D(tDiffuse,vUv).rgb*0.383+(texture2D(tDiffuse,vUv+d).rgb+texture2D(tDiffuse,vUv-d).rgb)*0.242+(texture2D(tDiffuse,vUv+2.0*d).rgb+texture2D(tDiffuse,vUv-2.0*d).rgb)*0.061+(texture2D(tDiffuse,vUv+3.0*d).rgb+texture2D(tDiffuse,vUv-3.0*d).rgb)*0.006;gl_FragColor=vec4(c,1.0);}',depthTest:false,depthWrite:false});
postMat.uniforms.tBloom={value:rtB2.texture};postMat.uniforms.uBloom={value:0.75};

const debug=new DebugPanel(renderer);
const worldBuilder=new WorldBuilder(scene,registry);
let team=TEAMS[0],theme=team.theme,levelIdx=0;
const M=(c,r,m)=>new THREE.MeshStandardMaterial({color:C(c),roughness:r===undefined?0.85:r,metalness:m||0.05});
const geoCache={};
const boxGeo=(w,h,d)=>{const k='b'+w+','+h+','+d;return geoCache[k]||(geoCache[k]=new THREE.BoxGeometry(w,h,d));};
const cylGeo=(r,h,n)=>{const k='c'+r+','+h+','+(n||10);return geoCache[k]||(geoCache[k]=new THREE.CylinderGeometry(r,r,h,n||10));};
const flashGeo=new THREE.PlaneGeometry(0.5,0.5),flameGeo=new THREE.PlaneGeometry(0.13,0.38);
const FLASH_TEX=(()=>{try{const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');if(!g||!g.createRadialGradient)return null;const gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(255,255,240,1)');gr.addColorStop(0.16,'rgba(255,225,130,0.95)');gr.addColorStop(0.45,'rgba(255,140,40,0.35)');gr.addColorStop(1,'rgba(255,80,0,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);g.globalCompositeOperation='lighter';for(let i=0;i<7;i++){const a=i/7*Math.PI*2+Math.random()*0.3,L=38+Math.random()*24;g.fillStyle='rgba(255,205,110,0.5)';g.beginPath();g.moveTo(64+Math.cos(a-0.14)*9,64+Math.sin(a-0.14)*9);g.lineTo(64+Math.cos(a)*L,64+Math.sin(a)*L);g.lineTo(64+Math.cos(a+0.14)*9,64+Math.sin(a+0.14)*9);g.closePath();g.fill();}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}catch(e){return null;}})();
const flashMat=()=>new THREE.MeshBasicMaterial({color:FLASH_TEX?0xffffff:0xffd070,map:FLASH_TEX||null,transparent:true,opacity:0.95,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
/* pose de cada arma à anca (mais perto, maior e em ângulo, como nos FPS de telemóvel) e distância da mira */
const HIPW={ar:{x:0.14,y:-0.125,z:-0.3,yaw:0.26,roll:0.12},smg:{x:0.14,y:-0.12,z:-0.3,yaw:0.26,roll:0.12},shotgun:{x:0.14,y:-0.13,z:-0.33,yaw:0.24,roll:0.12},sniper:{x:0.15,y:-0.15,z:-0.32,yaw:0.22,roll:0.1},lmg:{x:0.16,y:-0.15,z:-0.34,yaw:0.24,roll:0.1},pistol:{x:0.11,y:-0.1,z:-0.3,yaw:0.22,roll:0.08},gl:{x:0.15,y:-0.13,z:-0.34,yaw:0.22,roll:0.1},rpg:{x:0.16,y:-0.12,z:-0.3,yaw:0.14,roll:0.06}};
const ADSZ={ar:-0.2,smg:-0.35,shotgun:-0.25,sniper:-0.3,lmg:-0.33,pistol:-0.28,gl:-0.25,rpg:-0.2};
const easeS=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
const darkMat=M(0x1e1e22,0.7),brassMat=M(0xc9a227,0.35,0.7),grenMat=M(0x2e3a2c,0.6,0.3);
/* ===================== Marcador ===================== */
const scoreCanvas=document.createElement('canvas');scoreCanvas.width=512;scoreCanvas.height=160;const scoreTex=new THREE.CanvasTexture(scoreCanvas);scoreTex.colorSpace=THREE.SRGBColorSpace;
const css=h=>'#'+h.toString(16).padStart(6,'0');
function drawScoreboard(){
  const g=scoreCanvas.getContext('2d'),w=512,h=160,inGame=mode==='play'||mode==='pause'||mode==='over';g.fillStyle='#07090d';g.fillRect(0,0,w,h);
  for(let y=0;y<h;y+=4){g.fillStyle='rgba(255,255,255,0.03)';g.fillRect(0,y,w,1);}
  g.textAlign='center';g.textBaseline='middle';
  g.font='bold 44px Impact,"Arial Black",sans-serif';g.fillStyle='#ffffff';g.fillText('PISTOLEIRO',130,40);g.fillStyle='#f2c94c';g.fillText('VS',256,40);g.fillStyle=css(team.shirt===0x111111?0xffffff:team.shirt);g.fillText(team.nome.toUpperCase(),382,40);
  g.font='bold 30px Impact,"Arial Black",sans-serif';g.fillStyle='#f2c94c';g.fillText(inGame?(endless?'PROLONGAMENTO  ·  ONDA '+wave:'JOGO '+(levelIdx+1)+' DE 5  ·  ONDA '+wave+' DE 5'):team.estadio.toUpperCase(),256,92);
  g.fillStyle='#8fe38f';g.font='bold 26px Impact,"Arial Black",sans-serif';g.fillText(inGame?score.toLocaleString('pt-PT')+' PONTOS  ·  '+kills+' ELIMINAÇÕES':'BEM-VINDO À '+team.estadio.toUpperCase(),256,132);
  scoreTex.needsUpdate=true;
}

/* ===================== Personagens (GLB skinned via pool, fallback cápsula) ===================== */
let charTemplate=null,pool=null;const numberGeo=new THREE.PlaneGeometry(0.5,0.56);
const SKINS=['light','light','tan','dark'],HAIRS=[0x111111,0x2a1a0e,0x3d2b1a,0x5a3a1e,0x8a5a2a,0xc9a36a,0x8c8c8c,0x8a3a1a,0xe0c070,0x1a1a2a];
class CapsuleCharacter{ // fallback when the GLB is unavailable
  constructor(scene){this.scene=scene;this.alive=false;this.root=new THREE.Group();this.root.visible=false;scene.add(this.root);this.body=new THREE.Mesh(new THREE.CapsuleGeometry(0.3,1.1,4,8),M(0x888888));this.body.position.y=0.95;this.root.add(this.body);this.head=new THREE.Mesh(new THREE.SphereGeometry(0.2,12,10),M(0xd9a577));this.head.position.y=1.92;this.root.add(this.head);this.flash=new THREE.Mesh(flashGeo,flashMat());this.flash.position.set(0.3,1.3,-0.7);this.flash.visible=false;this.root.add(this.flash);this.scale=1;this.hitFlashT=0;this.deadT=0;}
  setColors(skin,kit,hair){}setNumber(){}spawn(x,y,z,yaw,scale=1){this.alive=true;this.root.visible=true;this.root.position.set(x,y,z);this.root.rotation.set(0,yaw,0);this.root.scale.setScalar(scale);this.scale=scale;this.deadT=0;}
  release(){this.alive=false;this.root.visible=false;}setLower(){}setUpper(){}fireUpper(){}setGaitSpeed(){}setShield(){}setGear(){}playFull(n){this.deadT=0.001;}setLod(){}setShadows(on){this.body.castShadow=on;}
  muzzle(on){this.flash.visible=on;}hitFlash(){this.hitFlashT=0.08;this.body.material.emissive.setHex(0xff2020);}
  update(dt){if(!this.alive)return;if(this.hitFlashT>0){this.hitFlashT-=dt;if(this.hitFlashT<=0)this.body.material.emissive.setHex(0);}if(this.deadT>0){this.deadT+=dt;this.root.rotation.x=Math.min(1.5,this.deadT*3);}}
  hitTest(o,d,maxT){const c=this.head.getWorldPosition(new THREE.Vector3());const ox=o.x-c.x,oy=o.y-c.y,oz=o.z-c.z,b=2*(ox*d.x+oy*d.y+oz*d.z),cc=ox*ox+oy*oy+oz*oz-0.04*this.scale*this.scale,disc=b*b-4*cc;if(disc>=0){let t=(-b-Math.sqrt(disc))/2;if(t>0&&t<=maxT)return {t:t,head:true};}
    const e=this.root.position,r=0.46*this.scale,h=2.05*this.scale,ex=o.x-e.x,ez=o.z-e.z,a=d.x*d.x+d.z*d.z;if(a<1e-6)return null;const b2=2*(ex*d.x+ez*d.z),c2=ex*ex+ez*ez-r*r,ds=b2*b2-4*a*c2;if(ds<0)return null;let t=(-b2-Math.sqrt(ds))/(2*a);if(t<0)t=(-b2+Math.sqrt(ds))/(2*a);if(t<0||t>maxT)return null;const y=o.y+d.y*t;if(y<0||y>h)return null;return {t:t,head:false};}
}
class CapsulePool{constructor(scene,n){this.items=[];for(let i=0;i<n;i++)this.items.push(new CapsuleCharacter(scene));}acquire(){return this.items.find(c=>!c.alive)||null;}update(dt){for(const c of this.items)c.update(dt);}setShadows(on){for(const c of this.items)c.setShadows(on);}}
const CHAR_ASSET='ubc_male'; // personagem nova (Quaternius Universal Base Characters + UAL, CC0); 'ual_mannequin' = manequim; 'human_base' = antiga
async function initCharacters(){
  let asset=null; try{ asset=await registry.character(CHAR_ASSET); }catch(e){ console.warn('[char]',e); } if(!asset) asset=await registry.character('human_base');
  const ks=!!(asset&&asset.info&&asset.info.meta&&asset.info.meta.kitShader); if(asset){charTemplate=new CharacterTemplate(asset,{headScale:(asset.flat||ks)?1.0:1.1,flat:asset.flat,kitShader:ks,gait:(asset.flat||ks)?{walk:1.0,jog:3.2,sprint:5.5,strafe_left:3.2,strafe_right:3.2,back:3.2}:null});let rifleTpl=null;try{const ra=(await registry.weapon('ar_lo'))||(await registry.weapon('ar'));if(ra&&ra.body){rifleTpl=ra.scene.clone(true);applyGunMaterials(rifleTpl);rifleTpl=flattenGun(rifleTpl);}}catch(e){console.warn('[rifle]',e);}
  pool=new CharacterPool(charTemplate,scene,16,{flashTex:texPuff(),numberGeo,rifle:rifleTpl});registry.available.character=true;}
  else{pool=new CapsulePool(scene,16);}
}
function dressEnemy(m,tm,R,o){
  if(!charTemplate)return;const kitId='kit_'+(tm.kitBase||tm.key)+'_'+(R.gk?'gk':'outfield');const kit=charTemplate.asset.kits[kitId]||null;
  const tone=o.skin,skin=tone==='light'?charTemplate.baseMaterials.Body.map:charTemplate.asset.skins[tone];
  m.setColors(skin,kit,o.hair);
  if(charTemplate.kitShader){ const gk=R.gk&&tm.gk; m.setKit((gk&&gk.shirt)||tm.shirt||0xd8202a,(gk&&gk.shorts)||tm.shorts||0x1a2a5a,(gk&&gk.socks)||tm.socks||0xf0f0f0,tone,o.hair); }
  else if(charTemplate.flat){ if(m.mats&&m.mats.Kit)m.mats.Kit.color.setHex((R.gk&&tm.gk&&tm.gk.shirt)||tm.shirt||0xd8202a); if(m.mats&&m.mats.Body)m.mats.Body.color.setHex(({light:0xf0c8a0,tan:0xd9a47a,dark:0x8a5a3a})[tone]||0xd9a47a); }
  else if(m.mats&&m.mats.Kit)m.mats.Kit.color.setHex(tm.kitTint||0xffffff);
  m.setNumber(numberTex(tm,o.num,!!R.gk));
}
// player model (menu / death cam)
let pmodel=null;
function ensurePlayerModel(){ if(pmodel||!pool)return; pmodel=pool.acquire(); if(!pmodel)return; if(charTemplate){pmodel.setColors(charTemplate.baseMaterials.Body.map,charTemplate.asset.kits.kit_player||null,0x2a1c12);pmodel.setNumber(texJersey(playerName()));} }
/* ===================== Armas first-person (viewmodel procedural — pendente asset) ===================== */
const GM={dark:M(0x17171a,0.55,0.4),metal:M(0x3b3b42,0.4,0.7),wood:M(0x5a3a1e,0.7),tan:M(0x7a6a4a,0.7),sleeve:M(0xc8102e,0.85),skin:M(0xe0b08a,0.6),glass:new THREE.MeshStandardMaterial({color:C(0x3070a0),roughness:0.1,metalness:0.7}),red:new THREE.MeshBasicMaterial({color:0xff3030})};
const HANDS2=[['b',0.11,0.1,0.26,0.11,-0.15,0.32,'sleeve'],['b',0.08,0.09,0.1,0.02,-0.12,0.17,'skin'],['b',0.1,0.1,0.3,-0.12,-0.14,-0.25,'sleeve'],['b',0.08,0.07,0.1,-0.03,-0.08,-0.4,'skin']];
const GUNDEFS={
  ar:{tip:-1.1,eject:[0.06,0.03,-0.08],parts:[['b',0.09,0.14,0.5,0,0,0,'dark'],['b',0.1,0.12,0.34,0,-0.01,-0.4,'wood'],['c',0.024,0.5,0,0.03,-0.8,'metal'],['c',0.035,0.08,0,0.03,-1.06,'dark'],['b',0.05,0.03,0.2,0,0.09,-0.15,'dark'],['b',0.03,0.07,0.04,0,0.12,-0.28,'dark'],['b',0.05,0.06,0.05,0,0.11,0.12,'dark'],['b',0.055,0.2,0.09,0,-0.16,-0.02,'metal'],['b',0.07,0.12,0.12,0,-0.14,0.16,'wood'],['b',0.07,0.1,0.3,0,-0.02,0.36,'wood'],['b',0.05,0.04,0.06,0.05,0.02,0.05,'metal']].concat(HANDS2)},
  smg:{tip:-0.66,eject:[0.05,0.02,-0.02],parts:[['b',0.08,0.12,0.4,0,0,0,'dark'],['b',0.06,0.06,0.2,0,0.02,-0.3,'dark'],['c',0.02,0.18,0,0.03,-0.5,'metal'],['b',0.05,0.03,0.28,0,0.08,-0.1,'dark'],['b',0.045,0.06,0.03,0,0.12,-0.02,'dark'],['b',0.055,0.24,0.06,0,-0.18,0.0,'metal'],['b',0.06,0.12,0.06,0,-0.14,-0.28,'dark'],['b',0.07,0.11,0.11,0,-0.13,0.14,'dark'],['b',0.05,0.05,0.24,0,0.0,0.32,'metal'],['b',0.06,0.09,0.03,0,-0.02,0.45,'dark']].concat(HANDS2)},
  shotgun:{tip:-1.05,eject:[0.05,0.0,0.02],parts:[['b',0.09,0.14,0.36,0,0,0.05,'dark'],['c',0.026,0.72,0,0.03,-0.6,'metal'],['c',0.03,0.6,0,-0.05,-0.55,'metal'],['b',0.09,0.1,0.22,0,-0.02,-0.5,'wood'],['b',0.03,0.04,0.03,0,0.09,-0.94,'dark'],['b',0.07,0.12,0.12,0,-0.12,0.18,'wood'],['b',0.08,0.11,0.32,0,-0.02,0.36,'wood']].concat([['b',0.11,0.1,0.26,0.11,-0.15,0.32,'sleeve'],['b',0.08,0.09,0.1,0.02,-0.12,0.17,'skin'],['b',0.1,0.1,0.3,-0.12,-0.14,-0.35,'sleeve'],['b',0.08,0.07,0.1,-0.03,-0.08,-0.52,'skin']])},
  sniper:{tip:-1.3,eject:[0.06,0.03,0.0],parts:[['b',0.08,0.12,0.55,0,0,0.08,'dark'],['c',0.02,0.95,0,0.02,-0.78,'metal'],['c',0.03,0.1,0,0.02,-1.24,'dark'],['c',0.04,0.32,0,0.14,-0.05,'dark'],['c',0.048,0.05,0,0.14,-0.22,'glass'],['b',0.03,0.08,0.03,0,0.08,-0.05,'metal'],['b',0.06,0.14,0.08,0,-0.12,0.0,'metal'],['b',0.07,0.1,0.34,0,-0.01,0.40,'tan'],['b',0.07,0.1,0.1,0,-0.12,0.2,'tan'],['b',0.02,0.2,0.02,0.06,-0.1,-0.6,'metal'],['b',0.02,0.2,0.02,-0.06,-0.1,-0.6,'metal'],['b',0.07,0.03,0.02,0.06,0.01,0.05,'metal']].concat(HANDS2)},
  lmg:{tip:-1.15,eject:[0.07,0.0,-0.1],parts:[['b',0.1,0.16,0.6,0,0,0.0,'dark'],['c',0.026,0.6,0,0.04,-0.82,'metal'],['b',0.06,0.05,0.5,0,0.06,-0.5,'dark'],['b',0.05,0.05,0.2,0,0.14,-0.1,'dark'],['b',0.12,0.14,0.16,-0.1,-0.1,-0.05,'tan'],['b',0.07,0.12,0.12,0,-0.14,0.2,'dark'],['b',0.08,0.11,0.3,0,-0.02,0.38,'dark'],['b',0.02,0.22,0.02,0.07,-0.12,-0.75,'metal'],['b',0.02,0.22,0.02,-0.07,-0.12,-0.75,'metal']].concat(HANDS2)},
  gl:{tip:-0.72,eject:[0.06,0.02,-0.05],parts:[['c',0.048,0.55,0,0.03,-0.42,'dark'],['c',0.058,0.06,0,0.03,-0.7,'metal'],['c',0.1,0.13,0,-0.01,-0.08,'metal'],['b',0.05,0.05,0.16,0,0.12,-0.3,'dark'],['b',0.03,0.06,0.03,0,0.13,-0.62,'dark'],['b',0.06,0.15,0.08,0,-0.16,0.0,'dark'],['b',0.07,0.1,0.28,0,-0.03,0.32,'wood'],['b',0.06,0.05,0.14,0,-0.05,-0.45,'dark']].concat(HANDS2)},
  rpg:{tip:-1.25,eject:[0.0,0.0,0.0],parts:[['c',0.055,1.25,0,0.05,-0.55,'tan'],['c',0.085,0.28,0,0.05,-1.2,'dark'],['c',0.03,0.14,0,0.05,-1.4,'metal'],['c',0.075,0.12,0,0.05,0.12,'dark'],['b',0.05,0.08,0.05,0,-0.02,-0.02,'dark'],['b',0.05,0.13,0.06,0,-0.12,0.05,'dark'],['b',0.05,0.11,0.06,0,-0.11,-0.42,'dark'],['b',0.04,0.05,0.2,0,0.14,-0.3,'dark'],['b',0.05,0.07,0.05,0,0.17,-0.45,'glass']].concat(HANDS2)},
  pistol:{tip:-0.3,eject:[0.04,0.03,-0.02],parts:[['b',0.06,0.08,0.28,0,0.02,-0.06,'dark'],['b',0.055,0.06,0.2,0,-0.03,-0.02,'metal'],['b',0.05,0.15,0.08,0,-0.12,0.1,'dark'],['b',0.02,0.05,0.02,0,0.07,-0.18,'dark'],['b',0.045,0.02,0.04,0,-0.05,-0.02,'metal'],['b',0.11,0.1,0.26,0.1,-0.19,0.3,'sleeve'],['b',0.09,0.1,0.1,0.02,-0.13,0.1,'skin']]}
};
function gunTex(kind){ try{ const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');if(!g||!g.fillRect)return null;
  if(kind==='wood'){ g.fillStyle='#c98f5a';g.fillRect(0,0,256,256); for(let i=0;i<90;i++){ const y=Math.random()*256,a=0.08+Math.random()*0.22,w=0.6+Math.random()*2.2; g.strokeStyle='rgba(70,32,10,'+a.toFixed(2)+')';g.lineWidth=w;g.beginPath(); for(let x=0;x<=256;x+=16){ const yy=y+Math.sin(x*0.02+i)*3+Math.sin(x*0.07+i*1.7)*1.2; if(x===0)g.moveTo(x,yy);else g.lineTo(x,yy);} g.stroke(); } for(let k=0;k<3;k++){ const x=Math.random()*256,y=Math.random()*256; g.strokeStyle='rgba(60,28,8,0.35)';g.lineWidth=1.2; for(let r=3;r<16;r+=3){g.beginPath();g.ellipse(x,y,r*2.2,r*0.8,0,0,Math.PI*2);g.stroke();} } }
  else { g.fillStyle='#8a8a8a';g.fillRect(0,0,256,256); for(let i=0;i<2600;i++){ const v=110+Math.random()*60|0; g.fillStyle='rgb('+v+','+v+','+v+')'; g.fillRect(Math.random()*256,Math.random()*256,1.5,1.5); } g.strokeStyle='rgba(40,40,40,0.55)'; for(let i=0;i<70;i++){ g.lineWidth=0.4+Math.random()*0.8; const x=Math.random()*256,y=Math.random()*256,a=Math.random()*Math.PI,L=6+Math.random()*30; g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(a)*L,y+Math.sin(a)*L);g.stroke(); } }
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;if(kind==='wood')t.colorSpace=THREE.SRGBColorSpace;return t; }catch(e){ return null; } }
const WOOD_TEX=gunTex('wood'),SCRATCH_TEX=gunTex('metal');
const GM2=(col,r,m,extra)=>new THREE.MeshStandardMaterial(Object.assign({color:C(col),roughness:r,metalness:m,vertexColors:true},extra||{}));
const GUNMATS={skin:null,sleeve:null,
  gun_metal:GM2(0x2c2f33,0.5,0.6,Object.assign({envMapIntensity:0.7},SCRATCH_TEX?{roughnessMap:SCRATCH_TEX}:{})),gun_steel:GM2(0x8a8f96,0.34,0.9,SCRATCH_TEX?{roughnessMap:SCRATCH_TEX}:{}),gun_dark:GM2(0x0f1012,0.85,0.2),
  gun_polymer:GM2(0x232428,0.62,0.05),gun_wood:GM2(WOOD_TEX?0xb07048:0x6a4322,0.5,0.0,WOOD_TEX?{map:WOOD_TEX}:{}),gun_tan:GM2(0xa89066,0.75,0.05),gun_glass:GM2(0x1d3f5a,0.05,0.9),
  gun_rubber:GM2(0x18191b,0.92,0.0),gun_brass:GM2(0xd4a843,0.28,1.0),gun_red:GM2(0xb0241e,0.55,0.0),gun_olive:GM2(0x55603c,0.6,0.05),
  gun_glow:new THREE.MeshBasicMaterial({color:0xff2a2a}),glove:GM2(0x3d4046,0.86,0.02),armband:GM2(0xf2c94c,0.6,0.0)};
const HANDPOS={ar:{r:[0.0,-0.10,0.19],l:[0.0,-0.04,-0.38]},smg:{r:[0.0,-0.09,0.15],l:[0.0,-0.09,-0.31]},shotgun:{r:[0.0,-0.09,0.19],l:[0.0,-0.06,-0.5]},sniper:{r:[0.0,-0.09,0.21],l:[0.0,-0.04,-0.5]},lmg:{r:[0.0,-0.10,0.21],l:[0.0,-0.09,-0.5]},pistol:{r:[0.0,-0.09,0.09],l:[-0.03,-0.10,0.05]},gl:{r:[0.0,-0.11,0.02],l:[0.0,-0.06,-0.45]},rpg:{r:[0.0,-0.09,0.06],l:[0.0,-0.08,-0.42]}};
let handsAsset=null;
function addHands(kind,g,model){
  const hp=HANDPOS[B(kind)]||HANDPOS.ar;
  if(handsAsset){ const gr=model&&model.getObjectByName('grip_r'),gl=model&&model.getObjectByName('grip_l');
    const hr=handsAsset.scene.getObjectByName('hand_r').clone(true);applyGunMaterials(hr);if(gr)hr.position.copy(gr.position);else hr.position.set(hp.r[0],hp.r[1],hp.r[2]);g.add(hr);
    let hl=null;if(gl||!model){hl=handsAsset.scene.getObjectByName('hand_l').clone(true);applyGunMaterials(hl);if(gl)hl.position.copy(gl.position);else hl.position.set(hp.l[0],hp.l[1],hp.l[2]);g.add(hl);}
    return {hr,hl}; }
  for(const p of HANDS2){const m=new THREE.Mesh(boxGeo(p[1],p[2],p[3]),GM[p[7]]);m.position.set(p[4],p[5],p[6]);g.add(m);}
  return {};
}
function applyGunMaterials(root){ if(!GUNMATS.skin){GUNMATS.skin=GM.skin;GUNMATS.sleeve=new THREE.MeshStandardMaterial({color:C(0x2b2f35),roughness:0.95,metalness:0.0,vertexColors:true});} root.traverse(o=>{ if(o.isMesh){ const mats=Array.isArray(o.material)?o.material:[o.material]; const out=mats.map(m=>GUNMATS[m.name]||GUNMATS.gun_metal); o.userData.gm=mats.map(m=>m.name); o.material=Array.isArray(o.material)?out:out[0]; o.frustumCulled=false; } }); }
/** viewmodel from a weapon GLB (body + detachable mag + tip/eject markers); falls back to the box model */
function makeGunModelFromAsset(kind,asset){
  const d=GUNDEFS[B(kind)],g=new THREE.Group(); const model=asset.scene.clone(true); applyGunMaterials(model); g.add(model);
  const mag=model.getObjectByName('mag')||null; if(mag){ mag.userData.homePos=mag.position.clone(); mag.userData.homeRot=mag.rotation.clone(); }
  const tipObj=model.getObjectByName('tip')||(()=>{const t=new THREE.Object3D();t.position.set(0,0.02,d.tip);g.add(t);return t;})();
  const eject=model.getObjectByName('eject')||(()=>{const t=new THREE.Object3D();t.position.set(d.eject[0],d.eject[1],d.eject[2]);g.add(t);return t;})();
  const flash=new THREE.Mesh(flashGeo,flashMat());flash.scale.setScalar(0.7);flash.visible=false;tipObj.add(flash);flash.position.set(0,0,-0.05);
  for(const r of [[Math.PI/2,0,0],[0,Math.PI/2,0]]){const f=new THREE.Mesh(flameGeo,flashMat());f.rotation.set(r[0],r[1],r[2]);f.position.z=-0.12;flash.add(f);}
  const bolt=model.getObjectByName('bolt')||null;if(bolt){bolt.userData.homePos=bolt.position.clone();bolt.userData.homeRot=bolt.rotation.clone();}
  const sight=model.getObjectByName('sight');if(sight)ADSP[kind]={x:0,y:-sight.position.y,z:ADSZ[B(kind)]||-0.25};const sightPos=sight?sight.position.clone():null;
  const hands=addHands(kind,g,model);
  g.visible=false;camera.add(g);
  const gl0=model.getObjectByName('grip_l');return {group:g,model:model,flash:flash,eject:eject,tip:tipObj,mag:mag,bolt:bolt,hr:hands.hr||null,hl:hands.hl||null,hlHome:hands.hl?hands.hl.position.clone():null,sightPos:sightPos,gripL:gl0?gl0.position.clone():null,cycleT:9,drum:0,pendingShell:false,asset:true};
}
const weaponIcons={};
/** render each weapon model to a transparent PNG (three-quarter view) for the shop */
function renderWeaponIcons(){
  if(!renderer||!renderer.readRenderTargetPixels) return;
  const W=320,H=160,rt=new THREE.WebGLRenderTarget(W,H,{samples:0});const sc=new THREE.Scene();
  const cam=new THREE.OrthographicCamera(-0.85,0.85,0.425,-0.425,0.01,10);cam.position.set(1.1,0.5,1.4);cam.lookAt(0,0,-0.15);
  sc.add(new THREE.HemisphereLight(0xffffff,0x334455,1.6));const dl=new THREE.DirectionalLight(0xffffff,2.2);dl.position.set(1,2,1.5);sc.add(dl);const dl2=new THREE.DirectionalLight(0xfff0d0,0.8);dl2.position.set(-1,0.5,-1);sc.add(dl2);
  const prevRT=renderer.getRenderTarget(),prevClear=new THREE.Color(),prevAlpha=renderer.getClearAlpha();renderer.getClearColor(prevClear);
  const buf=new Uint8Array(W*H*4);const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
  for(const k of ORDER){ const v=views[k]; if(!v||!v.asset) continue; const m=v.group.children[0]; if(!m) continue;
    const clone=m.clone(true); clone.traverse(o=>{ if(o.isMesh&&o.userData.gm){ const nm=o.userData.gm[0]; o.material=(WEAPONS[k]&&WEAPONS[k].tint&&WEAPONS[k].tint[nm])?variantMat(k,nm):(GUNMATS[nm]||GUNMATS.gun_metal||o.material); } }); const box=new THREE.Box3().setFromObject(clone); const size=box.getSize(new THREE.Vector3()), ctr=box.getCenter(new THREE.Vector3()); const sc0=1.5/Math.max(size.x,size.y,size.z); clone.scale.setScalar(sc0); clone.position.set(-ctr.x*sc0,-ctr.y*sc0,-ctr.z*sc0); clone.rotation.y=-0.35;
    sc.add(clone); renderer.setRenderTarget(rt); renderer.setClearColor(0x000000,0); renderer.clear(); renderer.render(sc,cam); renderer.readRenderTargetPixels(rt,0,0,W,H,buf); sc.remove(clone);
    const img=g.createImageData(W,H); for(let y=0;y<H;y++){ const src=(H-1-y)*W*4, dst=y*W*4; img.data.set(buf.subarray(src,src+W*4),dst); } g.putImageData(img,0,0); weaponIcons[k]=c.toDataURL('image/png'); }
  // versão com a pintura equipada, para a imagem grande da loja
  for(const k of ORDER){ if(!unlocked(k))continue; try{ const v=views[k]; const m=v&&v.group&&v.group.children[0]; if(m&&v.asset){ const clone=m.clone(true); const box=new THREE.Box3().setFromObject(clone); const size=box.getSize(new THREE.Vector3()), ctr=box.getCenter(new THREE.Vector3()); const sc0=1.5/Math.max(size.x,size.y,size.z); clone.scale.setScalar(sc0); clone.position.set(-ctr.x*sc0,-ctr.y*sc0,-ctr.z*sc0); clone.rotation.y=Math.PI*0.5;
    sc.add(clone); renderer.setRenderTarget(rt); renderer.setClearColor(0x000000,0); renderer.clear(); renderer.render(sc,cam); renderer.readRenderTargetPixels(rt,0,0,W,H,buf); sc.remove(clone);
    const img=g.createImageData(W,H); for(let y=0;y<H;y++){ const src=(H-1-y)*W*4, dst=y*W*4; img.data.set(buf.subarray(src,src+W*4),dst); } g.putImageData(img,0,0); weaponIcons['__skin_'+k]=c.toDataURL('image/png'); } }catch(e){} }
  renderer.setRenderTarget(prevRT); renderer.setClearColor(prevClear,prevAlpha); rt.dispose();
}
async function loadWeaponModels(){
  if(typeof registry.weapon!=='function') return;
  try{ const h=await registry.weapon('hands'); handsAsset=(h&&h.scene&&h.scene.getObjectByName('hand_r'))?h:null; }catch(e){ handsAsset=null; }
  for(const k of ORDER){ try{ let a=null; if(k!==B(k)){ try{ a=await registry.weapon(k); }catch(e){ a=null; } } if(!a||!a.body) a=await registry.weapon(B(k)); if(!a||!a.body) continue; const old=views[k]; const nv=makeGunModelFromAsset(k,a); applyVariantTint(k,nv); nv.group.visible=old.group.visible; camera.remove(old.group); views[k]=nv; }catch(e){ console.warn('[weapons]',k,e); } }
}
function makeGunModel(kind){
  const d=GUNDEFS[B(kind)],g=new THREE.Group();
  for(const p of d.parts){let m;if(p[0]==='b'){m=new THREE.Mesh(boxGeo(p[1],p[2],p[3]),GM[p[7]]);m.position.set(p[4],p[5],p[6]);}else{m=new THREE.Mesh(cylGeo(p[1],p[2],12),GM[p[6]]);m.rotation.x=Math.PI/2;m.position.set(p[3],p[4],p[5]);}g.add(m);}
  const flash=new THREE.Mesh(flashGeo,flashMat());flash.position.set(0,0.02,d.tip-0.05);flash.scale.setScalar(0.7);flash.visible=false;g.add(flash);
  const eject=new THREE.Object3D();eject.position.set(d.eject[0],d.eject[1],d.eject[2]);g.add(eject);
  const tipObj=new THREE.Object3D();tipObj.position.set(0,0.02,d.tip);g.add(tipObj);
  g.visible=false;camera.add(g);
  return {group:g,flash:flash,eject:eject,tip:tipObj};
}

/* ===================== Estado ===================== */
let mode='menu',gameT=0,perfT=0,score=0,kills=0,head=0,xpGained=0,wave=0,toSpawn=0,spawnT=0,spawnInt=1.5,waveBanner=0,clearing=false,clearT=0,bossWave=false,diff=DIFF.regular,endless=false,pendingAdvance=false,banner=null,fireworksT=0,scoreT=0;
const P={x:0,z:0,y:0,vy:0,yaw:0,pitch:0,hp:100,maxHp:100,armor:0,moving:0,sprint:false,lastHit:-99,bob:0,alive:true,gren:2,mines:0,step:0,roll:0};
let nearShop=false,runCash=0;
let mod=null,modKey=null,obj=null,evt=null,evtT=0,fogBase=null,lightBase=null,weatherBase=null,explosiveKill=false,runMaxWave=0;const objMeshes=[];
let enemies=[],pickups=[],msgs=[],dmgInd=[],grenades=[],bombs=[],dmgNums=[];const _v3=new THREE.Vector3();
let worldReady=false;
function toScreen(x,y,z){_v3.set(x,y,z).project(camera);if(_v3.z>1||_v3.z<-1)return null;return [(_v3.x*0.5+0.5)*W,(-_v3.y*0.5+0.5)*H];}
let cur='ar',wst={},fireCd=0,reloading=0,reloadTotal=1,reloadAt=0,switching=0,ads=false,recoilK=0,muzzleT=0,hitT=0,hitKill=false,hurtT=0,fireHeld=false,firePrev=false,shotCount=0;
let lastSpawn=null,spawnRR=0,ambT=6,flowT=0,flowCx=-1,flowCz=-1,overT=0,menuA=0,streak=0,streakT=0,uavT=0,airReady=false,airT=0,fpsAcc=0,fpsN=0,fpsLow=0,qualDropped=false;
const views={};for(const k of ORDER)views[k]=makeGunModel(k);
let vmx=HIP.x,vmy=HIP.y,vmz=HIP.z,vmSway=0,vmSwayY=0,patIdx=0,patT=0,recoilAcc=0,sprintOutT=0;
const globalWave=()=>levelIdx*5+wave;

/* ===================== Som ===================== */
let AC=null,noiseBuf=null,ambNodes=null;
function audioInit(){try{if(!AC)AC=new (window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume();}catch(e){AC=null;}}
function ensureNoise(){if(!noiseBuf){noiseBuf=AC.createBuffer(1,AC.sampleRate|0,AC.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}}
function tone(f,e,dur,vol,type){const o=AC.createOscillator(),g=AC.createGain(),t=AC.currentTime;o.type=type||'square';o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,e),t+dur);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);o.connect(g).connect(AC.destination);o.start(t);o.stop(t+dur+0.02);}
function noise(dur,vol,freq,q,attack){ensureNoise();const s=AC.createBufferSource();s.buffer=noiseBuf;s.loop=true;const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=freq;if(q)f.Q.value=q;const g=AC.createGain(),t=AC.currentTime;if(attack){g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(vol,t+attack);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);}else{g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);}s.connect(f).connect(g).connect(AC.destination);s.start(t);s.stop(t+dur+0.02);}
/* ---- sample bank (assets/sfx/*.wav, synthesised offline with stadium reverb); the runtime synth remains the fallback ---- */
const SND_LIST=['ar','smg','shotgun','sniper','lmg','pistol','ar_b','smg_b','shotgun_b','sniper_b','lmg_b','pistol_b','eshot_near','eshot_far','gl','rpg','boom','ping','wood','crack','thud','hitmark','head','kill','reload','swap','empty','pick','step_grass0','step_grass1','step_hard0','step_hard1','crowd','whistle'];
const SND={};let sndLoaded=false;
async function loadSounds(){ if(!registry||!registry.url) return; const man=(registry.manifest&&registry.manifest.sfx)||{}; await Promise.all(SND_LIST.map(async n=>{ try{ const pth=(man[n]&&man[n].path)||('assets/sfx/'+n+'.wav'); const r=await fetch(registry.url(pth)); if(!r.ok) return; SND[n]={raw:await r.arrayBuffer(),buf:null,decoding:false}; }catch(e){} })); sndLoaded=Object.keys(SND).length>0; }
function sndBuffer(n){ const e=SND[n]; if(!e||!AC) return null; if(e.buf) return e.buf; if(!e.decoding){ e.decoding=true; AC.decodeAudioData(e.raw.slice(0)).then(b=>{ e.buf=b; }).catch(()=>{ delete SND[n]; }); } return null; }
function playSample(n,vol,rate,muffle){ const b=sndBuffer(n); if(!b) return false; try{ const src=AC.createBufferSource(); src.buffer=b; src.playbackRate.value=(rate||1)*(1+rand(-0.05,0.05)); const g=AC.createGain(); g.gain.value=Math.min(1.4,vol); let node=src; if(muffle){ const f=AC.createBiquadFilter(); f.type='lowpass'; f.frequency.value=muffle; src.connect(f); node=f; } node.connect(g); g.connect(AC.destination); src.start(); return true; }catch(e){ return false; } }
const SAMPLE_KEYS={whistle:['whistle',0.4],ar:['ar',0.6],smg:['smg',0.55],shotgun:['shotgun',0.7],sniper:['sniper',0.7],lmg:['lmg',0.65],pistol:['pistol',0.55],gl:['gl',0.65],rpg:['rpg',0.75],boom:['boom',0.85],ping:['ping',0.35],wood:['wood',0.35],crack:['crack',0.3],thud:['thud',0.3],hitmark:['hitmark',0.22],head:['head',0.5],kill:['kill',0.5],reload:['reload',0.6],swap:['swap',0.4],empty:['empty',0.35],pick:['pick',0.5]};
function sfx(k,vol){
  if(sndLoaded&&AC){ vol=(vol===undefined?1:vol); if(save.settings.sound===false) return;
    if(k==='eshot'){ if(playSample(vol<0.5?'eshot_far':'eshot_near',(vol<0.5?0.7:0.45)*vol,1,0)) return; }
    else if(k==='step'){ if(playSample((P.y>0.1||P.onLadder)?'step_hard'+(Math.random()<0.5?0:1):'step_grass'+(Math.random()<0.5?0:1),0.16*vol,rand(0.92,1.08),0)) return; }
    else if(SAMPLE_KEYS[B(k)]){ const m=SAMPLE_KEYS[B(k)]; const alt=SND[m[0]+'_b']&&Math.random()<0.5?m[0]+'_b':m[0]; if(playSample(alt,m[1]*vol,1,0)) return; } }
  return sfxSynth(k,vol);
}
function sfxSynth(k,vol){
  if(!AC||!save.settings.sound)return;vol=vol===undefined?1:vol;
  try{switch(k){
    case 'ar':noise(0.1,0.24*vol,2600);tone(180,50,0.07,0.1*vol);break;
    case 'smg':noise(0.07,0.18*vol,3000);tone(240,60,0.05,0.07*vol);break;
    case 'lmg':noise(0.11,0.26*vol,2200);tone(150,45,0.08,0.11*vol);break;
    case 'shotgun':noise(0.32,0.48*vol,1000);tone(110,35,0.24,0.17*vol);break;
    case 'sniper':noise(0.24,0.42*vol,3200);tone(420,60,0.2,0.13*vol);break;
    case 'ping':tone(2400+Math.random()*900,1600,0.12,0.08*vol);break;
    case 'thud':noise(0.09,0.12*vol,500);break;
    case 'crack':noise(0.07,0.16*vol,2200);break;
    case 'wood':noise(0.08,0.14*vol,900);tone(180,120,0.08,0.05*vol);break;
    case 'gl':noise(0.18,0.3*vol,600);tone(90,40,0.22,0.16*vol);break;
    case 'rpg':noise(0.5,0.5*vol,900);tone(70,30,0.5,0.2*vol);break;
    case 'pistol':noise(0.1,0.22*vol,2000);tone(240,70,0.06,0.08*vol);break;
    case 'eshot':noise(0.08,0.13*vol,1400);tone(150,45,0.07,0.05*vol);break;
    case 'hitmark':tone(900,600,0.04,0.05,'square');break;
    case 'head':tone(1300,900,0.09,0.07,'sine');break;
    case 'kill':tone(500,250,0.12,0.07,'triangle');break;
    case 'hurt':tone(120,40,0.25,0.18,'sawtooth');noise(0.15,0.12,500);break;
    case 'reload':tone(300,200,0.05,0.06,'square');noise(0.05,0.08,3000);break;
    case 'reload2':tone(500,700,0.05,0.06,'square');noise(0.04,0.08,4000);break;
    case 'swap':noise(0.05,0.1,2500);break;
    case 'empty':tone(700,500,0.04,0.05,'square');break;
    case 'pick':tone(520,1040,0.12,0.08,'sine');break;
    case 'step':noise(0.06,0.05*vol,700);break;
    case 'jump':noise(0.1,0.06,900);break;
    case 'pin':tone(1500,1000,0.03,0.05,'square');break;
    case 'boom':noise(0.7,0.7*vol,500,2);tone(70,25,0.6,0.35*vol,'sine');break;
    case 'bounce':tone(700,400,0.05,0.04,'sine');break;
    case 'wave':tone(220,440,0.3,0.1,'square');setTimeout(()=>{try{tone(330,660,0.35,0.1,'square');}catch(e){}},180);break;
    case 'whistle':tone(2700,2600,0.28,0.07,'sine');setTimeout(()=>{try{tone(2700,2600,0.42,0.07,'sine');}catch(e){}},330);break;
    case 'cheer':noise(2.2,0.32*vol,1400,0.8,0.35);break;
    case 'lvl':[440,554,659,880].forEach((f,i)=>setTimeout(()=>{try{tone(f,f,0.18,0.08,'triangle');}catch(e){}},i*110));break;
    case 'uav':[880,880,1100].forEach((f,i)=>setTimeout(()=>{try{tone(f,f,0.1,0.06,'square');}catch(e){}},i*140));break;
    case 'siren':tone(300,900,1.3,0.09,'sawtooth');break;
    case 'streak':tone(660,990,0.15,0.07,'triangle');break;
    case 'anthem':[392,392,440,494,523,494,440,392].forEach((f,i)=>setTimeout(()=>{try{tone(f,f,0.32,0.09,'triangle');}catch(e){}},i*300));break;
    case 'over':tone(300,60,0.9,0.15,'sawtooth');break;
  }}catch(e){}
}
function ambientOn(){if(!AC||ambNodes||!save.settings.sound)return;
  const cb=sndBuffer('crowd');if(cb){try{const src=AC.createBufferSource();src.buffer=cb;src.loop=true;const g=AC.createGain();g.gain.value=0.22;src.connect(g);g.connect(AC.destination);src.start();ambNodes=[src];ambGain=g;return;}catch(e){}}
  try{ensureNoise();const nodes=[];
  const s=AC.createBufferSource();s.buffer=noiseBuf;s.loop=true;const f=AC.createBiquadFilter();f.type='bandpass';f.frequency.value=650;f.Q.value=0.6;const g=AC.createGain();g.gain.value=0.05;const lfo=AC.createOscillator(),lg=AC.createGain();lfo.frequency.value=0.13;lg.gain.value=0.025;lfo.connect(lg).connect(g.gain);lfo.start();s.connect(f).connect(g).connect(AC.destination);s.start();nodes.push(s,lfo);
  if(theme&&theme.weather==='rain'){const r=AC.createBufferSource();r.buffer=noiseBuf;r.loop=true;const rf=AC.createBiquadFilter();rf.type='highpass';rf.frequency.value=1800;const rg=AC.createGain();rg.gain.value=0.028;r.connect(rf).connect(rg).connect(AC.destination);r.start();nodes.push(r);}
  ambNodes=nodes;}catch(e){}}
function ambientOff(){if(ambNodes){for(const n of ambNodes){try{n.stop();}catch(e){}}ambNodes=null;}}

/* ===================== Partículas, decalques, efeitos ===================== */
const PVS='attribute float aSize;attribute float aAlpha;attribute vec3 aColor;varying float vA;varying vec3 vC;uniform float uScale;void main(){vA=aAlpha;vC=aColor;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=aSize*uScale/max(0.1,-mv.z);gl_Position=projectionMatrix*mv;}';
const PFS='uniform sampler2D tex;varying float vA;varying vec3 vC;void main(){vec4 t=texture2D(tex,gl_PointCoord);gl_FragColor=vec4(vC,t.a*vA);}';
function makePoints(max,blending){
  const geo=new THREE.BufferGeometry(),pos=new Float32Array(max*3),size=new Float32Array(max),alpha=new Float32Array(max),col=new Float32Array(max*3);
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));geo.setAttribute('aSize',new THREE.BufferAttribute(size,1).setUsage(THREE.DynamicDrawUsage));geo.setAttribute('aAlpha',new THREE.BufferAttribute(alpha,1).setUsage(THREE.DynamicDrawUsage));geo.setAttribute('aColor',new THREE.BufferAttribute(col,3).setUsage(THREE.DynamicDrawUsage));
  geo.setDrawRange(0,0);
  const mat=new THREE.ShaderMaterial({uniforms:{tex:{value:texPuff()},uScale:{value:300}},vertexShader:PVS,fragmentShader:PFS,transparent:true,depthWrite:false,blending:blending});
  const pts=new THREE.Points(geo,mat);pts.frustumCulled=false;scene.add(pts);
  return {geo:geo,pos:pos,size:size,alpha:alpha,col:col,max:max,list:[],mat:mat};
}
const smokePS=makePoints(1200,THREE.NormalBlending),sparkPS=makePoints(400,THREE.AdditiveBlending);
function emit(ps,x,y,z,o){if(ps.list.length>=ps.max)return;const c=C(o.col);ps.list.push({x:x,y:y,z:z,vx:o.vx||0,vy:o.vy||0,vz:o.vz||0,life:o.life,max:o.life,size:o.size,grow:o.grow||0,r:c.r,g:c.g,b:c.b,a0:o.a===undefined?1:o.a,drag:o.drag===undefined?0.98:o.drag,grav:o.grav||0,die:!!o.die});}
function updatePoints(ps,dt){
  const L=ps.list;let n=0;
  for(let i=0;i<L.length;i++){const p=L[i];p.life-=dt;if(p.life<=0)continue;const dr=Math.pow(p.drag,dt*60);p.vx*=dr;p.vz*=dr;p.vy=p.vy*dr-p.grav*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(p.y<0.03){if(p.die)continue;p.y=0.03;p.vy=0;}p.size+=p.grow*dt;const k=p.life/p.max;ps.pos[n*3]=p.x;ps.pos[n*3+1]=p.y;ps.pos[n*3+2]=p.z;ps.size[n]=p.size;ps.alpha[n]=p.a0*Math.min(1,k*2.5);ps.col[n*3]=p.r;ps.col[n*3+1]=p.g;ps.col[n*3+2]=p.b;L[n++]=p;}
  L.length=n;ps.geo.setDrawRange(0,n);for(const a of ['position','aSize','aAlpha','aColor'])ps.geo.attributes[a].needsUpdate=true;
}
function puffSmoke(x,y,z,n,col,sz,spd,life){for(let i=0;i<n;i++){const a=Math.random()*TAU,s=rand(0,spd);emit(smokePS,x,y,z,{vx:Math.cos(a)*s,vy:rand(0.2,spd*0.8),vz:Math.sin(a)*s,life:rand(life*0.6,life),size:sz,grow:sz*0.8,col:col,a:0.5,drag:0.95});}}
function sparksAt(x,y,z,n,col,grav){for(let i=0;i<n;i++){const a=Math.random()*TAU,b=rand(-0.3,1),s=rand(2,7);emit(sparkPS,x,y,z,{vx:Math.cos(a)*s*Math.cos(b),vy:Math.sin(b)*s,vz:Math.sin(a)*s*Math.cos(b),life:rand(0.15,0.5),size:rand(0.06,0.14),col:col,a:1,drag:0.96,grav:grav===undefined?9:grav});}}
const IMPACT={grass:{puff:[0x4a6a2a,6,0.16,0.9,0.6],sparks:[0,0],sfx:'thud',decal:0x2c3a1c},sand:{puff:[0xb8a070,7,0.2,0.9,0.7],sparks:[0,0],sfx:'thud',decal:0x8a7a50},concrete:{puff:[0x9a9a90,5,0.14,0.8,0.7],sparks:[5,0xffd070],sfx:'crack',decal:0x2a2a2a},metal:{puff:[0x7a7a7a,2,0.08,0.6,0.5],sparks:[14,0xfff0a0],sfx:'ping',decal:0x3a3a3a},wood:{puff:[0x8a5a2e,6,0.13,0.9,0.6],sparks:[3,0xd9a066],sfx:'wood',decal:0x2b1a0c},plastic:{puff:[0xd0d0d0,3,0.1,0.7,0.5],sparks:[2,0xffffff],sfx:'crack',decal:0x222222}};
function hitFX(pos,onEnemy,mat){if(onEnemy){puffSmoke(pos.x,pos.y,pos.z,4,0x6a1010,0.18,1.2,0.4);sparksAt(pos.x,pos.y,pos.z,3,0xff5030);return;}
  const I=IMPACT[mat]||IMPACT.concrete;puffSmoke(pos.x,pos.y,pos.z,I.puff[1],I.puff[0],I.puff[2],I.puff[3],I.puff[4]);if(I.sparks[0])sparksAt(pos.x,pos.y,pos.z,I.sparks[0],I.sparks[1]);
  const dd=Math.hypot(pos.x-P.x,pos.z-P.z);if(dd<40)sfx(I.sfx,clamp(0.9-dd/45,0.15,0.9));}
function confetti(n){for(let i=0;i<n;i++){const a=Math.random()*TAU,r=rand(3,22);emit(smokePS,P.x+Math.cos(a)*r,rand(8,14),P.z+Math.sin(a)*r,{vx:rand(-0.6,0.6),vy:-rand(0.8,1.6),vz:rand(-0.6,0.6),life:9,size:rand(0.08,0.16),col:pick(team.crowd.concat([0xffffff,0xf2c94c])),a:0.95,drag:1,grav:0,die:true});}}
/* decalques (uma só malha instanciada) */
let decalI=0,decalCount=0;const decalMat=new THREE.MeshBasicMaterial({map:texHole(),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
const decalGeo=new THREE.PlaneGeometry(0.14,0.14);
const _dc=new THREE.Color();const DECALS=90,decalIM=new THREE.InstancedMesh(decalGeo,decalMat,DECALS),_dm=new THREE.Object3D(),zeroM=new THREE.Matrix4().makeScale(0,0,0);
decalIM.frustumCulled=false;decalIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(decalIM);
function clearDecals(){for(let i=0;i<DECALS;i++)decalIM.setMatrixAt(i,zeroM);decalIM.instanceMatrix.needsUpdate=true;decalI=0;decalCount=0;}
clearDecals();
function placeDecal(px,py,pz,nx,ny,nz,mat){const dc=(IMPACT[mat||HIT.mat]||IMPACT.concrete).decal;decalIM.setColorAt(decalI,_dc.setHex(dc));if(decalIM.instanceColor)decalIM.instanceColor.needsUpdate=true;_dm.position.set(px+nx*0.01,py+ny*0.01,pz+nz*0.01);_dm.quaternion.set(0,0,0,1);_dm.lookAt(px+nx,py+ny,pz+nz);_dm.rotateZ(Math.random()*TAU);const sc=rand(0.8,1.4);_dm.scale.set(sc,sc,1);_dm.updateMatrix();decalIM.setMatrixAt(decalI,_dm.matrix);decalIM.instanceMatrix.needsUpdate=true;decalI=(decalI+1)%DECALS;decalCount=Math.min(DECALS,decalCount+1);}
/* traçantes */
const tracers=[],tracerGeo=new THREE.BoxGeometry(0.03,0.03,1);
function tracerFX(x1,y1,z1,x2,y2,z2,col){
  let t=tracers.find(t=>!t.alive);
  if(!t){if(tracers.length>=40)return;t={mesh:new THREE.Mesh(tracerGeo,new THREE.MeshBasicMaterial({color:0xffe6a0,transparent:true,opacity:0.8})),alive:false,t:0};scene.add(t.mesh);tracers.push(t);}
  const m=t.mesh,len=Math.hypot(x2-x1,y2-y1,z2-z1);m.material.color.setHex(col||0xffe6a0);m.position.set((x1+x2)/2,(y1+y2)/2,(z1+z2)/2);m.lookAt(x2,y2,z2);m.scale.set(1,1,Math.max(0.1,len));m.visible=true;t.alive=true;t.t=0.06;
}
/* cápsulas */ const shells=[],shellGeo=new THREE.BoxGeometry(0.018,0.018,0.05);
const SHELLS=(()=>{const cy=(r,l)=>{const g=new THREE.CylinderGeometry(r,r,l,8);g.rotateX(Math.PI/2);return g;};const rifle={g:cy(0.0055,0.045),m:brassMat},pist={g:cy(0.0055,0.022),m:brassMat};return {ar:rifle,lmg:rifle,sniper:{g:cy(0.0068,0.07),m:brassMat},smg:pist,pistol:pist,shotgun:{g:cy(0.0115,0.07),m:new THREE.MeshStandardMaterial({color:0xb0241e,roughness:0.55})}};})();
function ejectShell(){
  let s=shells.find(s=>!s.alive);if(!s){if(shells.length>=24)return;s={mesh:new THREE.Mesh(shellGeo,brassMat),alive:false,t:0,vx:0,vy:0,vz:0,rx:0,ry:0};scene.add(s.mesh);shells.push(s);}
  views[cur].eject.getWorldPosition(_v1);const sg=SHELLS[B(cur)]||SHELLS.ar;s.mesh.geometry=sg.g;s.mesh.material=sg.m;s.mesh.position.copy(_v1);s.mesh.rotation.set(P.pitch,P.yaw,0);
  const rx=Math.cos(P.yaw),rz=-Math.sin(P.yaw);s.vx=rx*rand(1.5,2.5)+rand(-0.3,0.3);s.vy=rand(1.8,2.8);s.vz=rz*rand(1.5,2.5)+rand(-0.3,0.3);s.rx=rand(-10,10);s.ry=rand(-10,10);s.alive=true;s.t=1.6;s.mesh.visible=true;
}
/* explosões */
const fireSprites=[];for(let i=0;i<8;i++){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:texFire(),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity:1,color:0xffffff,fog:false}));sp.visible=false;scene.add(sp);fireSprites.push({sp:sp,t:0,max:0,size:1});}
function explosion(x,y,z,radius,dmg,byPlayer,hurtPlayer,noEnemies){
  for(let i=0;i<3;i++){const f=fireSprites.find(f=>f.t<=0);if(!f)break;f.t=f.max=rand(0.35,0.55);f.size=radius*rand(0.9,1.4);f.sp.position.set(x+rand(-0.6,0.6),y+0.6+i*0.4,z+rand(-0.6,0.6));f.sp.visible=true;f.sp.material.opacity=1;f.sp.scale.set(0.5,0.5,1);}
  for(let i=0;i<26;i++){const a=Math.random()*TAU,s=rand(1,radius*0.9);emit(smokePS,x,y+0.3,z,{vx:Math.cos(a)*s,vy:rand(1,4),vz:Math.sin(a)*s,life:rand(1.2,2.4),size:rand(0.8,1.6),grow:1.2,col:0x2a2622,a:0.75,drag:0.93});}
  sparksAt(x,y+0.4,z,40,0xffb060);
  const bl=boomLights.find(b=>b.t<=0)||boomLights[0];bl.t=0.35;bl.l.position.set(x,y+1,z);bl.l.intensity=10;
  const dpl=Math.hypot(x-P.x,z-P.z);shake=Math.max(shake,clamp(8-dpl*0.4,1,8));
  sfx('boom',clamp(1.3-dpl/40,0.2,1.3));
  explosiveKill=true;
  if(!noEnemies)for(const e of enemies){if(e.state==='dead'||e.state==='warm')continue;if((e.perchY||e.y)&&Math.abs((e.perchY||e.y)-y)>3)continue;const d=Math.hypot(e.x-x,e.z-z);if(d<radius){const k=1-d/radius;e.blastX=(e.x-x)/(d||1);e.blastZ=(e.z-z)/(d||1);e.blastK=k;hitEnemy(e,dmg*(0.35+0.65*k),false,null,byPlayer);const px=(e.x-x)/(d||1),pz=(e.z-z)/(d||1);e.x+=px*0.6;e.z+=pz*0.6;}}
  explosiveKill=false;
  if(hurtPlayer){const d=Math.hypot(P.x-x,P.z-z);if(d<radius*0.85&&P.alive){damagePlayer(dmg*0.45*(1-d/(radius*0.85)),{x:x,z:z});}}
  for(let i=0;i<5;i++)puffSmoke(x+rand(-1,1),0.05,z+rand(-1,1),1,0x5a5048,0.6,0.5,1.5);
  const B=boxAt(Math.floor(x/S),Math.floor(z/S));if(!B&&inArena(x,z))placeDecal(x,0.0,z,0,1,0);
}
let shake=0;
function updateFX(dt){
  updatePoints(smokePS,dt);updatePoints(sparkPS,dt);
  for(const t of tracers){if(!t.alive)continue;t.t-=dt;if(t.t<=0){t.alive=false;t.mesh.visible=false;}}
  for(const s of shells){if(!s.alive)continue;s.t-=dt;s.vy-=12*dt;const m=s.mesh;m.position.x+=s.vx*dt;m.position.y+=s.vy*dt;m.position.z+=s.vz*dt;m.rotation.x+=s.rx*dt;m.rotation.y+=s.ry*dt;if(m.position.y<0.01){m.position.y=0.01;if(s.vy<-0.5){s.vy*=-0.35;s.vx*=0.6;s.vz*=0.6;sfx('bounce');}else{s.vy=0;s.vx=s.vz=0;}}if(s.t<=0){s.alive=false;m.visible=false;}}
  for(const f of fireSprites){if(f.t<=0)continue;f.t-=dt;const k=1-f.t/f.max;const sz=f.size*(0.3+k*1.1);f.sp.scale.set(sz,sz,1);f.sp.material.opacity=1-k*k;f.sp.position.y+=dt*1.5;if(f.t<=0)f.sp.visible=false;}
  for(const b of boomLights){if(b.t<=0)continue;b.t-=dt;b.l.intensity=Math.max(0,b.t/0.35)*10;if(b.t<=0)b.l.intensity=0;}
  flashLight.intensity*=Math.exp(-28*dt);shake=Math.max(0,shake-dt*22);
  if(fireworksT>0){fireworksT-=dt;if(Math.random()<dt*2.5){const x=P.x+rand(-30,30),z=P.z+rand(-30,30),y=rand(22,34),c=pick([0xff4040,0xffd23a,0x40ff80,0x40a0ff,0xff60ff,0xffffff]);sparksAt(x,y,z,70,c,3);sfx('boom',0.18);}}
}

/* ===================== Granadas e bombas ===================== */
const grenGeo=new THREE.SphereGeometry(0.11,8,7);
function throwGrenade(ox,oy,oz,dx,dy,dz,speed,byPlayer){const m=new THREE.Mesh(grenGeo,grenMat);m.castShadow=true;scene.add(m);grenades.push({m:m,x:ox,y:oy,z:oz,vx:dx*speed,vy:dy*speed+2.2,vz:dz*speed,t:byPlayer?2.4:3.0,byPlayer:byPlayer});}
let rockets=[],mines=[];
const rocketGeo=(()=>{const g=new THREE.CylinderGeometry(0.05,0.05,0.5,8);g.rotateX(Math.PI/2);return g;})(),rocketMat=new THREE.MeshStandardMaterial({color:0x4a4a3a,roughness:0.6,metalness:0.4}),warheadGeo=(()=>{const g=new THREE.ConeGeometry(0.075,0.22,8);g.rotateX(Math.PI/2);g.translate(0,0,-0.35);return g;})(),warheadMat=new THREE.MeshStandardMaterial({color:0x2a2a2a,roughness:0.5,metalness:0.5});
const mineGeo=new THREE.CylinderGeometry(0.16,0.19,0.06,12),mineMat=new THREE.MeshStandardMaterial({color:0x2c3a2c,roughness:0.6,metalness:0.3}),mineLightMat=new THREE.MeshBasicMaterial({color:0xff3030});
function blastMul(){return 1+0.25*(save.prog.up.blast||0);}
function launchProjectile(w,dir){
  views[cur].tip.getWorldPosition(_v2);const sp=w.spread*(ads?0.5:1);const d=dir.clone();d.x+=rand(-sp,sp);d.y+=rand(-sp,sp);d.z+=rand(-sp,sp);d.normalize();
  const dmg=Math.round(dmgOf(w)*blastMul()),radius=w.blast*Math.sqrt(blastMul());
  if(w.projectile==='gl'){const m=new THREE.Mesh(grenGeo,grenMat);m.castShadow=true;scene.add(m);grenades.push({m,x:_v2.x,y:_v2.y,z:_v2.z,vx:d.x*w.speed,vy:d.y*w.speed+1.0,vz:d.z*w.speed,t:5,byPlayer:true,impact:true,dmg,radius,armT:0.06});}
  else{const g=new THREE.Group();g.add(new THREE.Mesh(rocketGeo,rocketMat));g.add(new THREE.Mesh(warheadGeo,warheadMat));scene.add(g);g.position.set(_v2.x,_v2.y,_v2.z);g.lookAt(_v2.x-d.x,_v2.y-d.y,_v2.z-d.z);rockets.push({m:g,x:_v2.x,y:_v2.y,z:_v2.z,dx:d.x,dy:d.y,dz:d.z,speed:w.speed,dmg,radius,life:6,age:0});}
}
let turrets=[];
const turretBaseGeo=new THREE.CylinderGeometry(0.35,0.42,0.3,12),turretHeadGeo=new THREE.BoxGeometry(0.34,0.26,0.5),turretBarrelGeo=(()=>{const g=new THREE.CylinderGeometry(0.03,0.03,0.6,8);g.rotateX(Math.PI/2);g.translate(0,0.04,-0.5);return g;})();
function placeTurret(){const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw);const p={x:P.x+fx*1.4,z:P.z+fz*1.4};collideCircle(p,0.5,P.y);const g=new THREE.Group();g.add(new THREE.Mesh(turretBaseGeo,GM.metal));const head=new THREE.Group();head.position.y=0.42;head.add(new THREE.Mesh(turretHeadGeo,GM.dark));head.add(new THREE.Mesh(turretBarrelGeo,GM.metal));g.add(head);g.position.set(p.x,P.y,p.z);scene.add(g);turrets.push({m:g,head,x:p.x,y:P.y,z:p.z,t:30,cd:0});msg('Torreta automática: 30 s','#7fd7ff');sfx('uav');}
function updateTurrets(dt){for(const t of turrets){t.t-=dt;if(t.t<=0){scene.remove(t.m);t.dead=true;continue;}t.cd-=dt;let best=null,bd=26;for(const e of enemies){if(e.state==='dead'||e.state==='warm')continue;const d=Math.hypot(e.x-t.x,e.z-t.z);if(d<bd&&los(t.x,t.z,e.x,e.z,t.y+0.6,(e.perchY||0)+1.2)){bd=d;best=e;}}
    if(best){t.head.rotation.y=Math.atan2(-(best.x-t.x),-(best.z-t.z));if(t.cd<=0){t.cd=0.24;const hy=(best.perchY||0)+1.1;tracerFX(t.x,t.y+0.5,t.z,best.x,hy,best.z,0x80e0ff);if(Math.random()<0.7)hitEnemy(best,7,false,{x:best.x,y:hy,z:best.z},true);sfx('smg',0.35);}}}
  turrets=turrets.filter(t=>!t.dead);}
function updateRockets(dt){
  for(const r of rockets){
    r.age+=dt;r.life-=dt;const len=r.speed*dt;const o=_v2.set(r.x,r.y,r.z),d=_v3.set(r.dx,r.dy,r.dz);
    const tw=rayWorld(o,d,len+0.3,HIT),he=rayEnemies(o,d,Math.min(tw,len+0.3),enemies);
    let hitT=-1;if(he)hitT=he.t;else if(tw<len+0.3)hitT=tw;
    const nx=r.x+r.dx*len,ny=r.y+r.dy*len,nz=r.z+r.dz*len;
    if(hitT<0&&ny<=0.08)hitT=len;
    if(hitT>=0&&r.age>0.05){const ex=r.x+r.dx*hitT,ey=Math.max(0.15,r.y+r.dy*hitT),ez=r.z+r.dz*hitT;scene.remove(r.m);r.dead=true;explosion(ex,ey,ez,r.radius,r.dmg,true,true);continue;}
    r.x=nx;r.y=ny;r.z=nz;r.m.position.set(nx,ny,nz);if(r.age>0.03)puffSmoke(nx-r.dx*0.3,ny-r.dy*0.3,nz-r.dz*0.3,2,'#d8d8d0',0.45,0.4,0.7);
    if(r.life<=0){scene.remove(r.m);r.dead=true;explosion(nx,Math.max(0.15,ny),nz,r.radius,r.dmg,true,true);}
  }
  rockets=rockets.filter(r=>!r.dead);
  for(const mn of mines){mn.t+=dt;if(mn.t<1.4)continue;mn.light.visible=Math.floor(mn.t*3)%2===0;for(const e of enemies){if(e.state==='dead'||e.state==='warm')continue;if(Math.hypot(e.x-mn.x,e.z-mn.z)<2.2){scene.remove(mn.m);mn.dead=true;explosion(mn.x,0.2,mn.z,4.6*Math.sqrt(blastMul()),Math.round(230*blastMul()),true,true);msg('Mina!','#ffd166');break;}}}
  mines=mines.filter(m=>!m.dead);
}
/* ===================== C4 com detonador e metralhadora montada ===================== */
const c4s=[],sentries=[];
const c4Geo=new THREE.BoxGeometry(0.2,0.14,0.07),c4Mat=new THREE.MeshStandardMaterial({color:0xd8cfa6,roughness:0.85}),c4Tape=new THREE.MeshStandardMaterial({color:0x2e3238,roughness:0.6}),c4Led=new THREE.MeshBasicMaterial({color:0xff2020});
function updateGearBtns(){ $('btnC4').classList.toggle('hidden',!((P.c4||0)>0&&c4s.length<3)); $('btnDet').classList.toggle('hidden',!c4s.length); $('btnSentry').classList.toggle('hidden',!((P.sentries||0)>0)); }
function placeC4(){
  if(mode!=='play'||(P.c4||0)<=0||c4s.length>=3)return;P.c4--;
  const d=camDir(),o=camera.position,tw=rayWorld(o,d,2.4,HIT);const g=new THREE.Group();
  const body=new THREE.Mesh(c4Geo,c4Mat);g.add(body);for(const y of [-0.035,0.035]){const tp=new THREE.Mesh(new THREE.BoxGeometry(0.205,0.016,0.075),c4Tape);tp.position.y=y;g.add(tp);}
  const box=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.05,0.03),c4Tape);box.position.set(0.04,0,0.045);g.add(box);const led=new THREE.Mesh(new THREE.SphereGeometry(0.012,6,6),c4Led);led.position.set(0.055,0.012,0.062);g.add(led);
  let x,y,z;
  if(tw<2.4){x=o.x+d.x*tw+HIT.nx*0.04;y=o.y+d.y*tw+HIT.ny*0.04;z=o.z+d.z*tw+HIT.nz*0.04;g.position.set(x,y,z);g.lookAt(x+HIT.nx,y+HIT.ny,z+HIT.nz);}
  else{const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw);x=P.x+fx*0.9;z=P.z+fz*0.9;y=groundAt(x,z,P.y)+0.04;g.position.set(x,y,z);g.rotation.set(-Math.PI/2,0,P.yaw);}
  scene.add(g);c4s.push({m:g,led,x,y,z});sfx('pin');msg('C4 colocado ('+c4s.length+'): afasta-te e carrega em Detonar','#ffd166');updateGearBtns();
}
function detonateC4(){ if(mode!=='play'||!c4s.length)return; sfx('pin'); const list=c4s.splice(0); list.forEach((c,i)=>setTimeout(()=>{scene.remove(c.m);explosion(c.x,Math.max(0.2,c.y),c.z,6.5,520,true,true);},i*120)); msg('BOOM! Detonado','#ff8a3a'); updateGearBtns(); }
function beam(a,b,r,mat){ const d=new THREE.Vector3().subVectors(b,a),L=d.length(),m=new THREE.Mesh(new THREE.CylinderGeometry(r,r*0.8,L,8),mat);m.position.copy(a).addScaledVector(d,0.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m; }
function placeSentry(){
  if(mode!=='play'||(P.sentries||0)<=0)return;if(sentries.length>=2){msg('Já tens 2 metralhadoras montadas','#bbb');return;}
  const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw);const p={x:P.x+fx*1.7,z:P.z+fz*1.7};collideCircle(p,0.6,P.y);const gy=groundAt(p.x,p.z,P.y);P.sentries--;
  const g=new THREE.Group(),pivot=new THREE.Vector3(0,0.66,0);
  for(let i=0;i<3;i++){const a=i/3*TAU+0.52;g.add(beam(pivot,new THREE.Vector3(Math.cos(a)*0.45,0,Math.sin(a)*0.45),0.018,GUNMATS.gun_metal||GM.metal));}
  const head=new THREE.Group();head.position.copy(pivot);g.add(head);
  let gun=null;try{const lm=views.lmg&&views.lmg.asset&&views.lmg.group.children[0];if(lm){gun=flattenGun(lm.clone(true));}}catch(e){gun=null;}
  if(gun){gun.position.set(0,0.05,0.12);head.add(gun);}else{const b=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.12,0.7),GM.dark);b.position.set(0,0.05,-0.1);head.add(b);}
  const shield=new THREE.Mesh(new THREE.BoxGeometry(0.62,0.44,0.025),GUNMATS.gun_olive||GM.metal);shield.position.set(0,0.08,-0.34);head.add(shield);
  const ammo=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.13,0.2),GUNMATS.gun_tan||GM.tan);ammo.position.set(-0.13,-0.06,0.02);head.add(ammo);
  const fl=new THREE.Sprite(new THREE.SpriteMaterial({map:FLASH_TEX||null,color:0xffd070,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));fl.scale.set(0.5,0.5,1);fl.position.set(0,0.05,-0.72);fl.visible=false;head.add(fl);
  head.rotation.y=P.yaw;g.position.set(p.x,gy,p.z);g.traverse(o=>{if(o.isMesh)o.castShadow=true;});scene.add(g);
  sentries.push({m:g,head,fl,x:p.x,y:gy,z:p.z,t:60,cd:0,flT:0,shots:0});sfx('reload');msg('Metralhadora montada: 60 s de fogo automático','#7fd7ff');updateGearBtns();
}
function updateSentries(dt){
  for(const c of c4s)c.led.visible=(gameT*3%1)<0.5;
  for(const t of sentries){ t.t-=dt;if(t.flT>0){t.flT-=dt;if(t.flT<=0)t.fl.visible=false;}
    if(t.t<=0){scene.remove(t.m);t.dead=true;msg('A metralhadora montada ficou sem munições','#bbb');continue;}
    t.cd-=dt;let best=null,bd=36;
    for(const e of enemies){if(e.state==='dead'||e.state==='warm')continue;const d=Math.hypot(e.x-t.x,e.z-t.z);if(d<bd&&los(t.x,t.z,e.x,e.z,t.y+0.75,(e.perchY||e.y||0)+1.2)){bd=d;best=e;}}
    if(best){const ty=Math.atan2(-(best.x-t.x),-(best.z-t.z));let dy=ty-t.head.rotation.y;dy=Math.atan2(Math.sin(dy),Math.cos(dy));t.head.rotation.y+=dy*Math.min(1,dt*7);
      if(t.cd<=0&&Math.abs(dy)<0.12){t.cd=0.1;t.shots++;const hy=(best.perchY||best.y||0)+1.15;const fx=-Math.sin(t.head.rotation.y),fz=-Math.cos(t.head.rotation.y);
        tracerFX(t.x+fx*0.8,t.y+0.72,t.z+fz*0.8,best.x,hy,best.z,0xffe0a0);if(Math.random()<clamp(0.85-bd/80,0.35,0.85))hitEnemy(best,11,Math.random()<0.08,{x:best.x,y:hy,z:best.z},true);
        t.fl.visible=true;t.fl.material.rotation=Math.random()*TAU;t.flT=0.04;if(t.shots%2===0)sfx('lmg',0.4);}}}
  for(let i=sentries.length-1;i>=0;i--)if(sentries[i].dead)sentries.splice(i,1);
}
function placeMine(){if(mode!=='play'||P.mines<=0||P.y>0.2)return;P.mines--;const g=new THREE.Group();const body=new THREE.Mesh(mineGeo,mineMat);body.position.y=0.03;g.add(body);const light=new THREE.Mesh(new THREE.SphereGeometry(0.03,6,6),mineLightMat);light.position.y=0.08;g.add(light);g.position.set(P.x,0,P.z);scene.add(g);mines.push({m:g,light,x:P.x,z:P.z,t:0});sfx('pin');msg('Mina colocada ('+P.mines+' restantes)','#ffd166');$('btnMine').classList.toggle('hidden',P.mines<=0);}
function updateGrenades(dt){
  for(const g of grenades){
    g.vy-=18*dt;const nx=g.x+g.vx*dt,ny=g.y+g.vy*dt,nz=g.z+g.vz*dt;let px=nx,pz=nz,py=ny;
    if(py<0.11){py=0.11;if(g.vy<-1){g.vy=-g.vy*0.45;g.vx*=0.7;g.vz*=0.7;sfx('bounce');}else{g.vy=0;g.vx*=0.9;g.vz*=0.9;}}
    const B=boxAt(Math.floor(px/S),Math.floor(pz/S));
    if(B&&px>=B.x0&&px<=B.x1&&pz>=B.z0&&pz<=B.z1&&py<B.h){const inX=g.x>=B.x0&&g.x<=B.x1;if(!inX){g.vx=-g.vx*0.5;px=g.x;}else{g.vz=-g.vz*0.5;pz=g.z;}sfx('bounce');}
    if(g.impact){g.armT=(g.armT||0)-dt;let boom=(py<=0.12&&g.vy<=0)||(B&&px>=B.x0&&px<=B.x1&&pz>=B.z0&&pz<=B.z1&&py<B.h);
      if(!boom)for(const e of enemies){if(e.state==='dead'||e.state==='warm')continue;if(Math.hypot(e.x-nx,e.z-nz)<0.55*e.scale+0.15&&ny<1.95*e.scale){boom=true;break;}}
      if(boom&&g.armT<=0){scene.remove(g.m);g.dead=true;explosion(nx,Math.max(0.15,ny),nz,g.radius,g.dmg,true,true);continue;}}
    g.x=px;g.y=py;g.z=pz;g.m.position.set(px,py,pz);g.m.rotation.x+=dt*6;g.t-=dt;
    if(g.t<=0){scene.remove(g.m);g.dead=true;explosion(g.x,g.y,g.z,g.radius||(g.byPlayer?5.2*Math.sqrt(blastMul()):4.2),g.dmg||(g.byPlayer?Math.round(190*blastMul()):60),g.byPlayer,!g.ally);}
  }
  grenades=grenades.filter(g=>!g.dead);
  for(const b of bombs){b.t-=dt;b.y=Math.max(0.2,40*b.t/0.7);b.m.position.set(b.x,b.y,b.z);if(b.t<=0){scene.remove(b.m);b.dead=true;explosion(b.x,0.2,b.z,6.5,420,true,false);}}
  bombs=bombs.filter(b=>!b.dead);
}
function playerThrow(){if(mode!=='play'||P.gren<=0||reloading>0)return;P.gren--;const d=camDir();throwGrenade(camera.position.x+d.x*0.4,camera.position.y-0.1,camera.position.z+d.z*0.4,d.x,d.y+0.18,d.z,15,true);sfx('pin');msg('Granada!','#ffd166');}
function callAirstrike(){if(!airReady||airT>0||mode!=='play')return;airReady=false;airT=1.6;$('btnStreak').classList.remove('on');msg('Ataque aéreo a caminho!','#f2c94c');sfx('siren');}
function dropBombs(){const alive=enemies.filter(e=>e.state!=='dead'&&e.state!=='warm');const targets=[];for(let i=0;i<6;i++){const e=alive.length?alive[Math.floor(Math.random()*alive.length)]:null;targets.push(e?{x:e.x+rand(-2,2),z:e.z+rand(-2,2)}:{x:P.x+rand(-14,14),z:P.z+rand(-14,14)});}
  targets.forEach((t,i)=>{const m=new THREE.Mesh(boxGeo(0.35,1.1,0.35),darkMat);scene.add(m);bombs.push({m:m,x:t.x,z:t.z,y:40,t:0.7+i*0.22});});}

/* ===================== Controlos ===================== */
const JOY_R=54;
const joy={active:false,id:null,ox:0,oy:0,x:0,y:0,vx:0,vy:0};
const look={active:false,id:null,lx:0,ly:0};
const keys={};
function lookSens(){return 0.0042*SENS[save.settings.sens].v*(ads?(WEAPONS[cur].scope?0.3:0.55):1);}
glc.addEventListener('touchstart',e=>{
  e.preventDefault();if(mode!=='play')return;
  for(const t of e.changedTouches){
    if(t.clientX<W*0.5&&!joy.active){joy.active=true;joy.id=t.identifier;joy.ox=joy.x=t.clientX;joy.oy=joy.y=t.clientY;joy.vx=joy.vy=0;}
    else if(!look.active){look.active=true;look.id=t.identifier;look.lx=t.clientX;look.ly=t.clientY;}
  }
},{passive:false});
glc.addEventListener('touchmove',e=>{
  e.preventDefault();
  for(const t of e.changedTouches){
    if(joy.active&&t.identifier===joy.id){let dx=t.clientX-joy.ox,dy=t.clientY-joy.oy;const d=Math.hypot(dx,dy);if(d>JOY_R){dx=dx/d*JOY_R;dy=dy/d*JOY_R;}joy.x=joy.ox+dx;joy.y=joy.oy+dy;joy.vx=dx/JOY_R;joy.vy=dy/JOY_R;}
    else if(look.active&&t.identifier===look.id){const s=lookSens()*assistFric;P.yaw-=(t.clientX-look.lx)*s;P.pitch=clamp(P.pitch-(t.clientY-look.ly)*s,-1.45,1.45);look.lx=t.clientX;look.ly=t.clientY;}
  }
},{passive:false});
const endTouch=e=>{e.preventDefault();for(const t of e.changedTouches){if(joy.active&&t.identifier===joy.id){joy.active=false;joy.vx=joy.vy=0;}if(look.active&&t.identifier===look.id)look.active=false;}};
glc.addEventListener('touchend',endTouch,{passive:false});glc.addEventListener('touchcancel',endTouch,{passive:false});
document.addEventListener('contextmenu',e=>e.preventDefault());
function holdBtn(el,on,off){el.addEventListener('pointerdown',e=>{e.preventDefault();try{el.setPointerCapture(e.pointerId);}catch(x){}on();});const rel=()=>off();el.addEventListener('pointerup',rel);el.addEventListener('pointercancel',rel);el.addEventListener('lostpointercapture',rel);}
function tapBtn(el,fn){el.addEventListener('pointerdown',e=>{e.preventDefault();if(document.body.classList.contains('editing'))return;fn();});}
/* posição dos botões: arrastar em modo de edição (Definições → Posição dos botões); guardado em save.settings.layout */
const LAYOUT_IDS=['btnFire','btnAds','btnReload','btnSwap','btnGren','btnJump','btnMine','btnC4','btnDet','btnSentry'];
function applyLayout(){ const L=save.settings.layout||{}; for(const id of LAYOUT_IDS){ const b=$(id); if(!b)continue; const p=L[id]; b.style.right=p?p.r+'px':''; b.style.bottom=p?p.b+'px':''; } }
let lyDrag=null;
document.addEventListener('pointerdown',e=>{ if(!document.body.classList.contains('editing'))return; const b=e.target&&e.target.closest?e.target.closest('.round'):null; if(!b||!LAYOUT_IDS.includes(b.id))return; e.preventDefault(); const r=b.getBoundingClientRect(); lyDrag={b,dx:r.right-e.clientX,dy:r.bottom-e.clientY}; },true);
document.addEventListener('pointermove',e=>{ if(!lyDrag)return; const W0=window.innerWidth,H0=window.innerHeight,r=Math.max(4,Math.min(W0-44,W0-(e.clientX+lyDrag.dx))),bt=Math.max(4,Math.min(H0-44,H0-(e.clientY+lyDrag.dy))); lyDrag.b.style.right=r+'px'; lyDrag.b.style.bottom=bt+'px'; save.settings.layout=save.settings.layout||{}; save.settings.layout[lyDrag.b.id]={r:Math.round(r),b:Math.round(bt)}; },true);
document.addEventListener('pointerup',()=>{ lyDrag=null; },true);
holdBtn($('btnFire'),()=>{fireHeld=true;},()=>{fireHeld=false;});
tapBtn($('btnAds'),()=>{if(mode==='play')ads=!ads;});
tapBtn($('btnReload'),()=>{if(mode==='play')reload();});
tapBtn($('btnSwap'),()=>{if(mode==='play')swap(1);});
{ const I={btnAds:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="1.2"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/></svg>',btnReload:'<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/></svg>',btnJump:'<svg viewBox="0 0 24 24"><path d="M6 13l6-6 6 6"/><path d="M6 19l6-6 6 6"/></svg>',btnGren:'<svg viewBox="0 0 24 24"><circle cx="11" cy="14" r="6"/><path d="M11 8V5h4M15 5l2.5-2.5"/></svg><span class="badge" id="grenBadge">2</span>',btnSwap:'<svg viewBox="0 0 24 24"><path d="M4 8h14l-3-3M20 16H6l3 3"/></svg>'}; for(const k in I){ const b=$(k); if(b){ b.innerHTML=I[k]; b.classList.add('ico'); } } }
tapBtn($('btnGren'),()=>{playerThrow();});tapBtn($('btnMine'),()=>{placeMine();});tapBtn($('btnC4'),()=>{placeC4();});tapBtn($('btnDet'),()=>{detonateC4();});tapBtn($('btnSentry'),()=>{placeSentry();});
tapBtn($('btnJump'),()=>{jump();});
tapBtn($('ammobox'),()=>{if(mode==='play'&&isTouch)swap(1);});
tapBtn($('btnPause'),()=>{if(mode==='play')pause();});
tapBtn($('btnStreak'),()=>{callAirstrike();});
window.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();keys[k]=true;
  if(k===' ')e.preventDefault();
  if(mode==='shop'){if(k==='escape'||k==='e')closeShop();return;}
  if(mode!=='play'){if(k==='enter'&&(mode==='menu'||mode==='over'))startGame();if(k==='escape'&&mode==='pause')resume();return;}
  if(k==='r')reload();else if(k==='e'){if(nearShop)openShop();}else if(k==='q')swap(1);else if(k==='g')playerThrow();else if(k==='m')placeMine();else if(k==='c')placeC4();else if(k==='x')detonateC4();else if(k==='t')placeSentry();else if(k===' ')jump();else if(k==='5')callAirstrike();else if(k==='p')pause();
  else if(k>='1'&&k<='6'&&k!=='5'){const map={'1':'ar','2':'smg','3':'shotgun','4':'sniper','6':'lmg'};if(map[k]&&unlocked(map[k]))setWeapon(map[k]);}
  else if(k==='0')setWeapon('pistol');
});
window.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});
document.addEventListener('mousemove',e=>{if(mode!=='play'||isTouch||document.pointerLockElement!==glc)return;const s=0.0022*SENS[save.settings.sens].v*(ads?0.5:1);P.yaw-=e.movementX*s;P.pitch=clamp(P.pitch-e.movementY*s,-1.45,1.45);});
document.addEventListener('mousedown',e=>{if(mode!=='play'||isTouch)return;if(document.pointerLockElement!==glc){lockPointer();return;}if(e.button===0)fireHeld=true;else if(e.button===2)ads=true;});
document.addEventListener('mouseup',e=>{if(e.button===0)fireHeld=false;else if(e.button===2&&!isTouch)ads=false;});
document.addEventListener('wheel',e=>{if(mode==='play'&&!isTouch)swap(e.deltaY>0?1:-1);},{passive:true});
function lockPointer(){if(isTouch)return;try{const p=glc.requestPointerLock();if(p&&p.catch)p.catch(()=>{});}catch(x){}}
document.addEventListener('pointerlockchange',()=>{if(!isTouch&&mode==='play'&&document.pointerLockElement!==glc)pause();});

/* ===================== Jogador e armas ===================== */
const _dir=new THREE.Vector3(),_v1=new THREE.Vector3(),_v2=new THREE.Vector3();
function camDir(){return camera.getWorldDirection(_dir);}
function reload(){const w=WEAPONS[cur],st=wst[cur];if(reloading>0||st.mag>=magOf(cur)||st.reserve<=0||switching>0)return;reloading=reloadOf(w);reloadTotal=reloading;ads=false;sfx('reload');}
let nextWeapon=null;
function setWeapon(k){if(k===cur||!unlocked(k))return;if(nextWeapon===k)return;if(mode==='shop'){cur=k;for(const j of ORDER)views[j].group.visible=(j===cur);reloading=0;reloadAt=0;switching=0.3;sfx('swap');return;}if(mode!=='play')return;nextWeapon=k;reloading=0;reloadAt=0;switching=0.5;ads=false;sfx('swap');}
function swap(dir){const list=ORDER.filter(unlocked);let i=list.indexOf(cur);if(i<0)i=0;setWeapon(list[(i+dir+list.length)%list.length]);}
function jump(){if(mode!=='play')return;if(tryMantle())return;if(!P.onGround)return;P.vy=5.4;P.onGround=false;sfx('jump');}
/* escalar (parkour): saltar de frente para uma estrutura até 3,6 m acima → agarra e sobe para cima dela */
function tryMantle(){ if(P.mantle||P.onLadder)return !!P.mantle; if(buildingAt(P.x,P.z))return false; // dentro da casa grande nunca escala
  if(groundAt(P.x,P.z,P.y+3.6)>P.y+0.6)return false; // há um piso por cima da cabeça: é teto, não se escala através dele
  const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw);
  for(const d of [0.7,1.0,1.3]){ const tx=P.x+fx*d,tz=P.z+fz*d,gt=groundAt(tx,tz,P.y+3.6),dh=gt-P.y;
    if(dh>=0.55&&dh<=3.6&&groundAt(tx,tz,gt+2.6)<=gt+0.05&&!buildingAt(tx,tz)){ /* destino com espaço livre por cima */ P.mantle={t:0,dur:0.2+dh*0.09,x0:P.x,z0:P.z,y0:P.y,x1:tx+fx*0.3,z1:tz+fz*0.3,y1:gt}; P.vy=0; sfx('jump'); shake=Math.max(shake,0.6); return true; } }
  return false; }
function fire(){
  const w=WEAPONS[cur],st=wst[cur];
  if(st.mag<=0){if(st.reserve>0)reload();else sfx('empty');fireCd=0.3;return;}
  if(sprintOutT>0&&!ads)return;
  st.mag--;fireCd=w.rate;shotCount++;
  const o=camera.position,base=camDir().clone();
  if(w.projectile){ launchProjectile(w,base); recoilK=Math.min(1.6,recoilK+1.4);P.pitch=Math.min(1.45,P.pitch+w.kick);muzzleT=0.06;sfx(w.projectile==='rpg'?'rpg':'gl');views[cur].flash.visible=true;views[cur].cycleT=0;if(B(cur)==='gl')views.gl.drum=(views.gl.drum||0)+1;if(B(cur)==='rpg'&&views.rpg.mag)views.rpg.mag.visible=false;if(st.mag<=0&&st.reserve>0)reloadAt=0.35; return; }
  const sp=w.spread*(ads?0.3:1)*(P.sprint?2.2:1)*(1+P.moving*0.5)*(P.onGround?1:1.6)*attSpreadMul()*((B(cur)==='sniper'&&!ads)?9:1);
  const n=w.pellets||1;views[cur].tip.getWorldPosition(_v2);const tx=_v2.x,ty=_v2.y,tz=_v2.z;
  for(let i=0;i<n;i++){
    const d=base.clone();d.x+=rand(-sp,sp);d.y+=rand(-sp,sp);d.z+=rand(-sp,sp);d.normalize();
    const tw=rayWorld(o,d,w.range,HIT),he=rayEnemies(o,d,tw,enemies);if(i===0)suppressAlong(o,d,he?he.t:tw);
    let hx,hy,hz;
    if(he){const pt=o.clone().addScaledVector(d,he.t);hx=pt.x;hy=pt.y;hz=pt.z;const fo=w.falloff||[40,90,0.6];const fm=he.t<=fo[0]?1:(he.t>=fo[1]?fo[2]:1-(he.t-fo[0])/(fo[1]-fo[0])*(1-fo[2]));hitEnemy(he.e,dmgOf(w)*fm*wDmgMul(cur)*(he.head?headMult(w):1),he.head,pt,true);}
    else{hx=o.x+d.x*tw;hy=o.y+d.y*tw;hz=o.z+d.z*tw;if(tw<w.range){const back=0.12,px=hx-d.x*back,py=hy-d.y*back,pz=hz-d.z*back;hitFX({x:px,y:py,z:pz},false,HIT.mat);if(inArena(px,pz))placeDecal(px,py,pz,HIT.nx,HIT.ny,HIT.nz,HIT.mat);}}
    if(w.tracer&&(shotCount%w.tracer===0||n>1&&i===0))tracerFX(tx,ty,tz,hx,hy,hz,0xffe0a0);
  }
  recoilK=Math.min(1.6,recoilK+attKickMul());fovPunch=Math.min(3.2,fovPunch+(B(cur)==='shotgun'||B(cur)==='sniper'?2.4:B(cur)==='lmg'?1.1:0.8)*(ads?0.6:1));{const pat=w.pattern||[[1,0]];const idx=Math.min(pat.length-1,patIdx);patIdx++;patT=0.42;const pv=pat[idx][0]*w.kick*attKickMul()*wKickMul(cur)*(ads?0.65:1),ph=pat[idx][1]*w.kick*0.6*attKickMul()*wKickMul(cur)*(ads?0.7:1);P.pitch=Math.min(1.45,P.pitch+pv);P.yaw+=ph+rand(-0.06,0.06)*w.kick;recoilAcc+=pv*0.55;}
  muzzleT=0.05;const vm=views[cur];vm.flash.visible=true;vm.flash.rotation.z=Math.random()*TAU;vm.flash.scale.setScalar(rand(0.5,0.9)*(B(cur)==='shotgun'||B(cur)==='sniper'?1.4:1));
  flashLight.intensity=B(cur)==='shotgun'||B(cur)==='sniper'?6:3.5;
  puffSmoke(tx,ty,tz,2,0xb0b0a8,0.1,0.6,0.5);const cv=views[cur];cv.cycleT=0;cv.sfxS=0;if((B(cur)==='shotgun'||B(cur)==='sniper')&&cv.bolt)cv.pendingShell=true;else ejectShell();
  sfx(B(cur));
  if(st.mag===0&&st.reserve>0)reloadAt=gameT+0.35;
}
function damagePlayer(dmg,e){
  if(!P.alive||mode!=='play'||P.inv>0)return;
  dmg*=diff.dmg;if(P.armor>0){const ab=Math.min(P.armor,dmg*0.65);P.armor-=ab;dmg-=ab;if(P.armor<=0)msg('Colete destruído','#bbb');}P.hp-=dmg;P.lastHit=gameT;hurtT=Math.min(1,hurtT+0.5);
  const dx=e.x-P.x,dz=e.z-P.z,fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw),rx=Math.cos(P.yaw),rz=-Math.sin(P.yaw);
  dmgInd.push({ang:Math.atan2(dx*rx+dz*rz,dx*fx+dz*fz),t:1});
  try{if(navigator.vibrate)navigator.vibrate(25);}catch(x){}
  sfx('hurt');shake=Math.max(shake,2);P.pitch=clamp(P.pitch+rand(-0.03,0.03),-1.45,1.45);P.yaw+=rand(-0.04,0.04);
  if(P.hp<=0){if(tdm&&!tdm.over){tdmPlayerDown();return;}P.hp=0;P.alive=false;gameOver();}
}
function updateViewmodel(dt){
  const v=views[cur],vm=v.group,hw=HIPW[B(cur)]||HIP,t=ads?(ADSP[cur]||hw):hw,k=1-Math.exp(-16*dt);
  let tx=t.x,ty=t.y,tz=t.z,rz=0;
  if(P.sprint&&!ads){tx+=0.08;ty-=0.1;tz+=0.04;rz=-0.25;}
  vmx+=(tx-vmx)*k;vmy+=(ty-vmy)*k;vmz+=(tz-vmz)*k;
  const bobK=P.moving*(ads?0.25:1)*(P.sprint?1.8:1);
  let ox=Math.sin(P.bob)*0.012*bobK,oy=Math.abs(Math.cos(P.bob))*0.012*bobK,rx=0;
  v.cycleT=(v.cycleT===undefined?9:v.cycleT)+dt;const ct=v.cycleT,b=v.bolt,mg=v.mag,hl=v.hl,hh=v.hlHome;let pump=0;
  if(b){const hp=b.userData.homePos,hr=b.userData.homeRot;b.position.copy(hp);b.rotation.copy(hr);
    if(B(cur)==='ar'&&ct<0.07){b.position.z=hp.z+0.07*(ct<0.025?ct/0.025:1-(ct-0.025)/0.045);}
    else if(B(cur)==='pistol'){let e=ct<0.07?(ct<0.02?ct/0.02:1-(ct-0.02)/0.05):0;if(wst.pistol&&wst.pistol.mag===0&&reloading<=0)e=1;b.position.z=hp.z+0.026*e;}
    else if(B(cur)==='shotgun'){pump=ct<0.12?0:ct<0.28?easeS((ct-0.12)/0.16):ct<0.44?1-easeS((ct-0.28)/0.16):0;b.position.z=hp.z+0.075*pump;if(v.pendingShell&&ct>=0.26){v.pendingShell=false;ejectShell();}}
    else if(B(cur)==='sniper'){let up=0,back=0;if(ct>0.22&&ct<0.84){up=ct<0.32?easeS((ct-0.22)/0.1):ct<0.74?1:1-easeS((ct-0.74)/0.1);back=ct<0.32?0:ct<0.5?easeS((ct-0.32)/0.18):ct<0.66?1-easeS((ct-0.5)/0.16):0;rz+=0.06*up;}b.rotation.z=hr.z+1.0*up;b.position.z=hp.z+0.085*back;if(v.pendingShell&&ct>=0.48){v.pendingShell=false;ejectShell();}}
    else if(B(cur)==='gl'){b.rotation.z=hr.z+(v.drum+(ct<0.22?easeS(ct/0.22):1)-1)*Math.PI/3;}}
  if(hl&&hh){hl.position.copy(hh);if(B(cur)==='shotgun')hl.position.z=hh.z+0.075*pump;}
  if(b&&(B(cur)==='shotgun'||B(cur)==='sniper')){const a=B(cur)==='shotgun'?[0.12,0.3]:[0.32,0.55];if((v.sfxS||0)<1&&ct>=a[0]&&ct<1){v.sfxS=1;sfx('reload',0.8);}if(v.sfxS===1&&ct>=a[1]&&ct<1){v.sfxS=2;sfx('reload2',0.8);}}
  if(reloading>0){const pr=1-reloading/reloadTotal,s=Math.sin(Math.PI*pr);ox-=0.06*s;oy+=0.075*s;rx+=0.26*s;rz+=0.35*s;
    if(mg&&cur!=='rpg'){let out=0;if(pr>=0.15&&pr<0.38)out=easeS((pr-0.15)/0.23);else if(pr>=0.38&&pr<0.48)out=1;else if(pr>=0.48&&pr<0.7)out=1-easeS((pr-0.48)/0.22);
      mg.position.set(mg.userData.homePos.x,mg.userData.homePos.y-0.3*out,mg.userData.homePos.z+0.05*out);mg.rotation.set(mg.userData.homeRot.x-0.35*out,mg.userData.homeRot.y,mg.userData.homeRot.z);mg.visible=!(pr>0.4&&pr<0.46);
      if(hl&&hh){const r=pr<0.12?easeS(pr/0.12):pr<0.72?1:pr<0.85?1-easeS((pr-0.72)/0.13):0;hl.position.set(hh.x+(mg.position.x-hh.x)*r,hh.y+(mg.position.y-0.07-hh.y)*r,hh.z+(mg.position.z+0.02-hh.z)*r);}}
    else if(B(cur)==='shotgun'&&hl&&hh){const r=pr>0.1&&pr<0.9?0.5-0.5*Math.cos((pr-0.1)/0.8*Math.PI*6):0;hl.position.set(hh.x,hh.y+(-0.07-hh.y)*r,hh.z+(-0.02-hh.z)*r);}
    else if(B(cur)==='rpg'&&mg){const e=easeS((pr-0.3)/0.45);mg.visible=pr>0.3;mg.position.set(mg.userData.homePos.x,mg.userData.homePos.y-0.12*(1-e),mg.userData.homePos.z-0.3*(1-e));}
    if(b&&(B(cur)==='ar'||B(cur)==='smg'||B(cur)==='lmg')&&pr>0.8&&pr<0.95){const e=pr<0.86?(pr-0.8)/0.06:1-(pr-0.86)/0.09;b.position.z=b.userData.homePos.z+0.07*Math.max(0,e);}
    if(B(cur)==='gl'&&b)b.rotation.z=b.userData.homeRot.z+pr*Math.PI*4;}
  else if(mg){if(mg.position.y!==mg.userData.homePos.y||mg.position.z!==mg.userData.homePos.z){mg.position.copy(mg.userData.homePos);mg.rotation.copy(mg.userData.homeRot);}mg.visible=B(cur)==='rpg'?((wst.rpg&&wst.rpg.mag>0)):true;}
  if(switching>0){const sw=switching>0.28?(0.5-switching)/0.22:switching/0.28;oy-=0.45*sw;rx-=0.9*sw;}
  const pk=Math.min(1,78/baseFov);vm.position.set((vmx+ox+vmSway)*pk,(vmy+oy+vmSwayY-P.vy*0.01)*pk,(vmz+recoilK*0.07)*(2-pk));vm.rotation.set(rx+recoilK*0.25+(P.sprint?0.35:0)*(ads?0:1),ads?0:(hw.yaw!==undefined?hw.yaw:0.03)+vmSway*2,rz+(ads?0:(hw.roll||0)));
  vm.visible=!(ads&&WEAPONS[cur].scope);
  if(muzzleT<=0)views[cur].flash.visible=false;
}


/* ===================== Inimigos: jogadores adversários ===================== */
function spawnEnemy(roleKey,tmOverride){
  const R=ROLES[roleKey],tm=tmOverride||team,gw=globalWave();
  let cands=G.SPAWNS.filter(s=>Math.hypot(s.x-P.x,s.z-P.z)>22);if(!cands.length)cands=G.SPAWNS;
  const hidden=cands.filter(s=>!los(s.x,s.z,P.x,P.z));if(hidden.length>=2)cands=hidden;
  if(cands.length>1)cands=cands.filter(s=>s!==lastSpawn);
  const s=cands[(spawnRR++)%cands.length];lastSpawn=s;
  const tr=team.traits||{},tierMul=1+0.12*((team.tier||1)-1);
  const hp=Math.round(R.hp*(1+(gw-1)*0.07)*diff.hp*(R.boss?1+Math.min(levelIdx,4)*0.35:1)*((mod&&mod.hp)||1)*(tr.hp||1)*tierMul*(R.boss?runMods.bossHp:1));
  const model=pool.acquire();if(!model)return;
  const o={skin:pick(SKINS),hair:pick(HAIRS),num:R.boss?10:(R.gk?1:2+Math.floor(Math.random()*10))};
  dressEnemy(model,tm,R,o);
  const e={role:roleKey,T:R,team:tm,nome:R.boss?tm.boss:R.nome+' de '+tm.nome,x:s.x+rand(-1.6,1.6),z:s.z+rand(-1.6,1.6),y:9,lane:rand(-1.4,1.4),spdMul:tr.speed||1,accMul:(tr.acc||1)*(1+0.08*((team.tier||1)-1)),hp:hp,maxHp:hp,scale:R.scale,state:'warm',t:0,fireCd:rand(0.6,1.5),losT:0,hasLos:false,strafeT:0,strafeDir:0,model:model,yaw:0,walk:0,flash:0,muzzleT:0,remove:false,grenT:rand(9,18),burst:0,hbT:0,gait:''};
  if(R.perch){const decks=G.FLOORS.filter(f=>Math.hypot((f.x0+f.x1)/2-P.x,(f.z0+f.z1)/2-P.z)>16);const f=decks.length?pick(decks):null;if(f){e.x=(f.x0+f.x1)/2+rand(-0.6,0.6);e.z=(f.z0+f.z1)/2+rand(-0.6,0.6);e.perchY=f.y;e.y=f.y;e.state='perch';e.aimT=0;e.model.setShadows(false);}else{e.T=ROLES.ponta;e.role='ponta';}}
  model.setShield(!!R.shield);model.setGear({helmet:!!R.shield||!!R.gk||e.role==='defesa'||e.role==='ponta',vest:!R.perch&&roleKey!=='extremo',band:!!R.boss,cage:!!R.gk,pads:!!R.gk,shins:e.role==='defesa',boss:R.boss?tm.key:((!(R.shield||R.gk||e.role==='defesa'||e.role==='ponta')&&Math.random()<0.35)?pick(['hb','cap','gl','bd']):null)});
  model.spawn(e.x,e.y,e.z,0,R.scale);model.setShadows(Q.enemyShadows);enemies.push(e);
  if(R.perch&&e.state==='perch'){model.root.position.y=e.perchY;msg('Atirador na '+(e.perchY>5?'torre':'casa')+'!','#ff8a8a');}
}
function pickRole(){ // base weights by wave, multiplied by the team's traits (each selection has its own style)
  const gw=globalWave(),tr=(team.traits&&team.traits.roles)||{};const cand=[['defesa',40],['extremo',gw>=2?12:0],['medio',gw>=2?30:0],['ponta',gw>=3?12:0],['escudo',gw>=3?10:0],['guarda',gw>=4?6+gw*0.5:0],['atirador',(gw>=3&&G.FLOORS.length&&!enemies.some(o=>o.T.perch&&o.state!=='dead'))?6:0]];
  let tot=0;for(const c of cand){c[1]*=tr[c[0]]||1;tot+=c[1];}let r=Math.random()*tot;for(const c of cand){r-=c[1];if(r<=0)return c[0];}return 'defesa';}
/* ===================== Modificadores, objetivos, eventos, desafios ===================== */
/* acessórios por arma (armeiro): save.prog.attW[arma]; compras antigas (globais) passam para todas as armas que já tinhas */
function attAllW(){ const p=save.prog; if(!p.attW){ p.attW={}; const g0=p.att||{}; for(const k of ORDER){ try{ if(unlocked(k))p.attW[k]=Object.assign({},g0); }catch(e){} } } return p.attW; }
const attOf=k=>{ const A=attAllW(); return A[k]||(A[k]={}); };
const att=()=>attOf(cur);
const ATT_BAN={sight:['rpg','sniper','pistol','gl'],grip:['pistol','rpg','gl'],stock:['pistol','rpg','gl'],laser:[]};
const attTarget=()=>(shopSelW&&WEAPONS[shopSelW]&&unlocked(shopSelW))?shopSelW:cur;
function modApply(key){
  mod=MODS[key];modKey=key;
  if(mod.fog&&scene.fog){fogBase=fogBase||{near:scene.fog.near,far:scene.fog.far};scene.fog.near=fogBase.near*mod.fog;scene.fog.far=fogBase.far*mod.fog;}
  if(mod.scarce)for(const k of ORDER)if(wst[k]&&wst[k].reserve!==Infinity)wst[k].reserve=Math.floor(wst[k].reserve/2);
  announce('mod',{m:mod.nome},true);msg('Modificador: '+mod.nome+' · '+mod.desc,'#ffd166',4);
}
function modClear(){ if(mod&&mod.fog&&scene.fog&&fogBase){scene.fog.near=fogBase.near;scene.fog.far=fogBase.far;} mod=null;modKey=null; }
function randomOpenCell(minD,maxD,avoid){
  for(let i=0;i<200;i++){const cx=1+Math.floor(Math.random()*(G.MW-2)),cz=1+Math.floor(Math.random()*(G.MH-2));if(G.BOX[cx+cz*G.MW])continue;const x=(cx+0.5)*S,z=(cz+0.5)*S;const d=Math.hypot(x-P.x,z-P.z);if(d<minD||d>maxD)continue;if(G.SPAWNS.some(sp=>Math.hypot(sp.x-x,sp.z-z)<10))continue;if(avoid&&avoid.some(a=>Math.hypot(a.x-x,a.z-z)<9))continue;return {x,z};}
  return null;
}
const ringGeo=new THREE.RingGeometry(5.5,6,48),ringMat=new THREE.MeshBasicMaterial({color:0xffd166,transparent:true,opacity:0.55,side:THREE.DoubleSide,depthWrite:false});
const beaconGeo=new THREE.CylinderGeometry(0.25,0.25,14,10,1,true),beaconMat=new THREE.MeshBasicMaterial({color:0x66ccff,transparent:true,opacity:0.35,depthWrite:false,side:THREE.DoubleSide});
const bombGeo=new THREE.BoxGeometry(0.5,0.35,0.35),bombMat=new THREE.MeshStandardMaterial({color:0x2a2a2e,roughness:0.5,metalness:0.5}),bombLightMat=new THREE.MeshBasicMaterial({color:0xff2a2a}),bombOkMat=new THREE.MeshBasicMaterial({color:0x2aff5a});
function objMesh(m){scene.add(m);objMeshes.push(m);return m;}
function objClear(){for(const m of objMeshes)scene.remove(m);objMeshes.length=0;obj=null;}
function objStart(type){
  const O=OBJECTIVES[type];
  if(type==='hold'){const c=randomOpenCell(14,34);if(!c)return false;obj={type,x:c.x,z:c.z,r:6,need:O.dur,acc:0,done:false,failed:false,inside:false};const ring=objMesh(new THREE.Mesh(ringGeo,ringMat));ring.rotation.x=-Math.PI/2;ring.position.set(c.x,0.06,c.z);toSpawn+=8;}
  else if(type==='bombs'){const list=[];for(let i=0;i<O.count;i++){const c=randomOpenCell(10,40,list);if(!c)break;const m=objMesh(new THREE.Group());const b=new THREE.Mesh(bombGeo,bombMat);b.position.y=0.18;m.add(b);const l=new THREE.Mesh(new THREE.SphereGeometry(0.06,8,8),bombLightMat);l.position.set(0.15,0.4,0);m.add(l);m.position.set(c.x,0,c.z);list.push({x:c.x,z:c.z,t:O.timer,prog:0,done:false,failed:false,m,l});}if(!list.length)return false;obj={type,bombs:list,done:false,failed:false};}
  else if(type==='race'){const floors=G.FLOORS.filter(f=>Math.hypot((f.x0+f.x1)/2-P.x,(f.z0+f.z1)/2-P.z)>12);if(!floors.length)return false;const f=pick(floors);const fx=(f.x0+f.x1)/2,fz=(f.z0+f.z1)/2;obj={type,x:fx,z:fz,y:f.y,t:O.timer,done:false,failed:false};const b=objMesh(new THREE.Mesh(beaconGeo,beaconMat));b.position.set(fx,f.y+7,fz);}
  else return false;
  announce('obj',{o:O.nome},true);msg('Objetivo: '+O.nome+' · '+O.desc,'#66ccff',4);sfx('uav');return true;
}
function objReward(){objDone++;const O=OBJECTIVES[obj.type];const cash=Math.round(O.reward*((mod&&mod.money)||1)*econ());save.prog.money+=cash;runCash+=cash;score+=O.reward;addXP(60);xpGained+=60;obj.done=true;if(obj.type==='race')P.armor=Math.max(P.armor,80);msg('Objetivo cumprido! +'+cash+' € · +'+O.reward+' pontos','#66ffaa');sfx('streak');persist();}
function objUpdate(dt){
  if(!obj||obj.done||obj.failed)return;
  if(obj.type==='hold'){const inside=Math.hypot(P.x-obj.x,P.z-obj.z)<obj.r&&P.y<1.0;if(inside!==obj.inside){obj.inside=inside;if(!inside)msg('Volta à zona!','#ff8866');}if(inside){obj.acc+=dt;if(obj.acc>=obj.need){objReward();toSpawn=Math.min(toSpawn,2);}}}
  else if(obj.type==='bombs'){for(const b of obj.bombs){if(b.done||b.failed)continue;b.t-=dt;b.l.visible=Math.floor(b.t*4)%2===0;if(Math.hypot(P.x-b.x,P.z-b.z)<2.2&&P.y<1.0){b.prog+=dt;if(b.prog>=3){b.done=true;b.l.material=bombOkMat;b.l.visible=true;msg('Bomba desativada','#66ffaa');sfx('pick');}}else b.prog=Math.max(0,b.prog-dt*0.5);if(b.t<=0&&!b.done){b.failed=true;scene.remove(b.m);explosion(b.x,0.3,b.z,5.5,90,false,true);msg('Bomba explodiu!','#ff5555');}}
    if(obj.bombs.every(b=>b.done))objReward();else if(obj.bombs.every(b=>b.done||b.failed)&&obj.bombs.some(b=>b.failed)){obj.failed=true;msg('Objetivo falhado','#ff8866');}}
  else if(obj.type==='race'){obj.t-=dt;if(Math.hypot(P.x-obj.x,P.z-obj.z)<2.6&&P.y>obj.y-0.6)objReward();else if(obj.t<=0){obj.failed=true;msg('Tempo esgotado','#ff8866');}}
}
function objHudText(){ if(!obj||obj.done||obj.failed)return null; const O=OBJECTIVES[obj.type];
  if(obj.type==='hold')return O.nome+': '+Math.max(0,Math.ceil(obj.need-obj.acc))+' s'+(obj.inside?'':' · fora da zona');
  if(obj.type==='bombs'){const left=obj.bombs.filter(b=>!b.done&&!b.failed);const near=left.find(b=>b.prog>0);return O.nome+': '+left.length+' restantes'+(near?' · '+Math.ceil(3-near.prog)+' s':'')+' · '+Math.ceil(Math.max(0,...left.map(b=>b.t)))+' s';}
  if(obj.type==='race')return O.nome+': '+Math.max(0,Math.ceil(obj.t))+' s'; return null; }
function evtSchedule(key,delay){evt={type:key,t:delay,active:false,left:0};}
function evtFire(){const E=EVENTS[evt.type];announce('evt',{e:E.nome},true);msg('Evento: '+E.nome+' · '+E.desc,'#ff9966',4);sfx('siren');evt.active=true;evt.left=E.dur||0;
  if(evt.type==='rain'){weatherBase=theme.weather;theme.weather='rain';}
  else if(evt.type==='blackout'){const sun=worldBuilder.sun,hemi=worldBuilder.hemi;lightBase={sun:sun?sun.intensity:1,hemi:hemi?hemi.intensity:1,env:scene.environmentIntensity,bg:scene.backgroundIntensity};if(sun)sun.intensity*=0.12;if(hemi)hemi.intensity*=0.3;scene.environmentIntensity*=0.25;scene.backgroundIntensity*=0.25;}
  else if(evt.type==='reinforcements'){evt.left=3;evt.spawnLeft=E.count;evt.spawnT=0;}}
function evtEnd(){if(!evt)return;if(evt.type==='rain'&&weatherBase!==null){theme.weather=weatherBase;weatherBase=null;}if(evt.type==='blackout'&&lightBase){const sun=worldBuilder.sun,hemi=worldBuilder.hemi;if(sun)sun.intensity=lightBase.sun;if(hemi)hemi.intensity=lightBase.hemi;scene.environmentIntensity=lightBase.env;scene.backgroundIntensity=lightBase.bg;lightBase=null;}evt=null;}
function evtUpdate(dt){if(!evt)return;if(!evt.active){evt.t-=dt;if(evt.t<=0)evtFire();return;}
  if(evt.type==='reinforcements'){evt.spawnT-=dt;if(evt.spawnLeft>0&&evt.spawnT<=0){evt.spawnT=0.6;spawnEnemy(pickRole(),endless?pick(TEAMS):null);evt.spawnLeft--;}if(evt.spawnLeft<=0)evt=null;return;}
  evt.left-=dt;if(evt.left<=0)evtEnd();}
function weightedPick(keys,weights){const w=keys.map(k=>1+((weights&&weights[k])||0));let t=w.reduce((a,b)=>a+b,0)*Math.random();for(let i=0;i<keys.length;i++){t-=w[i];if(t<=0)return keys[i];}return keys[keys.length-1];}
function waveExtras(){ // each stadium leans towards its own twists (TEAM_RULES)
  modClear();objClear();evtEnd();if(wave<2||bossWave)return;
  const rules=TEAM_RULES[team.key]||{};const r=Math.random();
  if(r<0.4){const keys=Object.keys(MODS).filter(k=>k!==modKey);modApply(weightedPick(keys,rules.mods));}
  else if(r<0.7){const types=Object.keys(OBJECTIVES).filter(t=>t!=='race'||G.FLOORS.length);if(!objStart(pick(types))&&Math.random()<0.5)modApply(weightedPick(Object.keys(MODS),rules.mods));}
  if(Math.random()<0.3)evtSchedule(weightedPick(Object.keys(EVENTS),rules.events),rand(6,18));
}
/* desafios diários */
function todayKey(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function ensureDaily(){const key=todayKey();if(save.prog.daily&&save.prog.daily.date===key)return;let seed=0;for(const c of key)seed=(seed*31+c.charCodeAt(0))>>>0;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};const pool=CHALLENGES.slice();const list=[];while(list.length<3&&pool.length){const i=Math.floor(rnd()*pool.length);const c=pool.splice(i,1)[0];const lvl=Math.floor(rnd()*3);list.push({id:c.id,goal:c.goals[lvl],prog:0,done:false,reward:c.reward,nome:c.nome.replace('{n}',c.goals[lvl])});}save.prog.daily={date:key,list};persist();}
function dailyProgress(id,value,absolute){ensureDaily();for(const c of save.prog.daily.list){if(c.id!==id||c.done)continue;c.prog=absolute?Math.max(c.prog,value):c.prog+value;if(c.prog>=c.goal){c.done=true;save.prog.money+=Math.round(c.reward*0.5);msg('Desafio cumprido: '+c.nome+' · +'+c.reward+' €','#66ffaa');sfx('lvl');}}}
function dailyText(){ensureDaily();return 'Desafios de hoje: '+save.prog.daily.list.map(c=>(c.done?'✓ ':'')+c.nome+' ('+Math.min(c.prog,c.goal)+'/'+c.goal+')').join(' · ');}
/* acessórios */
function attSpreadMul(){const a=att();let m=1;if(a.laser&&!ads)m*=0.75;if(a.grip&&P.moving>0.3)m*=0.8;if(a.sight&&ads)m*=0.85;return m;}
function attKickMul(){return att().stock?0.7:1;}
const ATTPARTS={sight:[['b',0.035,0.045,0.07,0,0.15,-0.02,'dark'],['b',0.028,0.028,0.006,0,0.16,-0.055,'glass']],laser:[['b',0.025,0.025,0.09,0.05,-0.005,-0.4,'dark'],['b',0.012,0.012,0.008,0.05,-0.005,-0.448,'red']],grip:[['b',0.03,0.09,0.03,0,-0.1,-0.42,'dark']],stock:[['b',0.07,0.11,0.05,0,-0.02,0.68,'dark']]};
function applyAttachments(){for(const k of ORDER){const v=views[k];if(!v)continue;const a=attOf(k);v.att=v.att||{};if(v.asset){attachModeled(k,v,a);continue;}for(const id in ATTPARTS){if(!a[id]||v.att[id])continue;if(B(k)==='pistol'&&(id==='grip'||id==='stock'))continue;if(B(k)==='rpg'&&id!=='laser')continue;const grp=new THREE.Group();for(const p of ATTPARTS[id]){const m=new THREE.Mesh(boxGeo(p[1],p[2],p[3]),GM[p[7]]);m.position.set(p[4],p[5],p[6]);grp.add(m);}v.group.add(grp);v.att[id]=grp;}}}
/* acessórios modelados, posicionados pelos marcadores de cada arma (mira, pega da mão esquerda, fim da coronha) */
const HOLO_GLASS=new THREE.MeshBasicMaterial({color:0x9fd8ff,transparent:true,opacity:0.1,depthWrite:false});
const HOLO_Y={lmg:-0.035,smg:-0.004,shotgun:-0.006,ar:0}; let holoK=0;
function attachModeled(k,v,a){ const G=GUNMATS,mk=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.frustumCulled=false;return m;};
  if(!v.bb&&v.model){ v.model.updateMatrixWorld(true); const inv=new THREE.Matrix4().copy(v.model.matrixWorld).invert(); v.bb=new THREE.Box3(); v.model.traverse(o=>{ if(o.isMesh&&o!==v.flash&&o.parent!==v.flash){ o.geometry.computeBoundingBox(); v.bb.union(o.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld))); } }); }
  const sp=v.sightPos,gl=v.gripL;
  if(a.sight&&!v.att.sight&&sp&&!['rpg','sniper','pistol','gl'].includes(k)){ const grp=new THREE.Group(),y=sp.y+(HOLO_Y[B(k)]||0),z=sp.z-0.02,D=G.gun_dark||G.gun_metal;
      grp.add(mk(new THREE.BoxGeometry(0.03,0.008,0.08),G.gun_metal,0,y+0.004,z));          // montagem no carril
      grp.add(mk(new THREE.BoxGeometry(0.036,0.016,0.07),D,0,y+0.016,z));                   // corpo (pilhas/eletrónica)
      for(const [w,h,x,yy] of [[0.046,0.004,0,y+0.071],[0.004,0.047,-0.021,y+0.0475],[0.004,0.047,0.021,y+0.0475]]) grp.add(mk(new THREE.BoxGeometry(w,h,0.03),G.gun_metal,x,yy,z-0.012)); // capuz fino
      grp.add(mk(new THREE.BoxGeometry(0.038,0.045,0.0015),HOLO_GLASS,0,y+0.047,z-0.02));
      v.group.add(grp); v.att.sight=grp; ADSP[k]={x:0,y:-(y+0.047),z:(ADSZ[B(k)]||-0.25)+0.08}; }
  if(a.laser&&!v.att.laser&&gl){ const grp=new THREE.Group(); grp.add(mk(new THREE.BoxGeometry(0.022,0.024,0.07),G.gun_polymer,0.036,gl.y+0.012,gl.z-0.06)); grp.add(mk(new THREE.CylinderGeometry(0.006,0.006,0.004,10).rotateX(Math.PI/2),G.gun_glow||G.gun_red,0.036,gl.y+0.012,gl.z-0.097)); v.group.add(grp); v.att.laser=grp; }
  if(a.grip&&!v.att.grip&&gl&&k!=='pistol'&&k!=='rpg'){ const grp=new THREE.Group(); grp.add(mk(new THREE.BoxGeometry(0.024,0.012,0.04),G.gun_polymer,0,gl.y-0.03,gl.z-0.1)); grp.add(mk(new THREE.CylinderGeometry(0.014,0.012,0.085,12),G.gun_polymer,0,gl.y-0.078,gl.z-0.1)); v.group.add(grp); v.att.grip=grp; }
  if(a.stock&&!v.att.stock&&v.bb&&k!=='pistol'&&k!=='rpg'&&k!=='gl'){ const grp=new THREE.Group(),zb=v.bb.max.z; grp.add(mk(new THREE.BoxGeometry(0.046,0.12,0.03),G.gun_rubber,0,-0.05,zb+0.012)); v.group.add(grp); v.att.stock=grp; } }
function startWave(n){wave=n;if(n===1&&!endless)tutStart();const gw=globalWave();toSpawn=Math.min(22,4+Math.round(gw*0.95));spawnInt=Math.max(0.5,1.6-gw*0.05);spawnT=1.2;waveBanner=2.6;bossWave=(n%5===0);waveBanner=2.0;if(bossWave){bossSpawnT=gameT;spawnEnemy('capitao');if(levelIdx>=2)spawnEnemy('medio');}if(gw>1){P.gren=Math.min(4,P.gren+2);persist();}sfx('whistle');drawScoreboard();waveExtras();runMaxWave=Math.max(runMaxWave,gw);dailyProgress('wave',gw,true);if(bossWave){say(captain(),pickLine(captain().intro));announce('boss',{b:captain().nome},true);}else announce('wave',{n:wave},true);}
function removeEnemy(e){e.model.release();e.remove=true;if(e.laser){scene.remove(e.laser);e.laser=null;}if(e.aura){scene.remove(e.aura);e.aura=null;}}
let hitCls='';let hitHead=false;const tipSeen={};
function armorTip(ar){ if(tipSeen[ar]||!ARMOR_TIP[ar])return; tipSeen[ar]=1; msg('DICA: '+ARMOR_TIP[ar],'#7fd7ff',3.4); }
function hitEnemy(e,dmg,isHead,pt,byPlayer){if(byPlayer)hitHead=!!isHead;
  if(e.state==='dead')return;
  if(byPlayer&&pt&&!isHead&&pt.y<0.95*e.scale+(e.y||0)){e.limpT=1.6;}
  if(byPlayer)shake=Math.max(shake,0.06);
  if(e.T.boss&&byPlayer&&dmg>e.maxHp*0.06&&sayCd<=0){sayCd=6;say(CAPTAINS[e.team.key]||captain(),pickLine((CAPTAINS[e.team.key]||captain()).hurt));}
  if(byPlayer&&mod&&mod.body&&!isHead)dmg*=mod.body;
  if(e.bodyMul&&!isHead)dmg*=e.bodyMul;
  if(byPlayer){ const cls=explosiveKill?'explosivo':((WEAPONS[cur]&&WEAPONS[cur].cls)||'medio'),ar=ARMOR_OF[e.role]||'none'; let am=1;
    if(ar!=='none'&&ar!=='escudo'){ am=(ARMOR_MULT[ar]&&ARMOR_MULT[ar][cls])||1; if(isHead&&ar==='colete')am=1; else if(isHead&&ar==='blindado')am=cls==='ligeiro'?0.6:Math.max(am,0.9); }
    dmg*=am; if(!explosiveKill){ hitCls=am<0.6?'res':(am>1.15?'weak':''); if(am<0.6)armorTip(ar); } }
  if(e.T.shield&&!isHead&&byPlayer){const fx=-Math.sin(e.yaw),fz=-Math.cos(e.yaw),tox=P.x-e.x,toz=P.z-e.z,dd=Math.hypot(tox,toz)||1;if((fx*tox+fz*toz)/dd>0.2){const sc=explosiveKill?1:(((WEAPONS[cur]&&WEAPONS[cur].cls)==='perfurante')?0.45:0.12);dmg*=sc;if(sc<0.5){hitCls='res';armorTip('escudo');}if(pt)sparksAt(pt.x,pt.y,pt.z,10,0x9fd8ff);}}
  if(e.stunT>0)dmg*=1.6;else if(e.state==='think')dmg*=2;
  e.hp-=dmg;e.flash=0.08;e.stag=0.16;e.model.hitFlash();if(e.state!=='dead'&&e.state!=='warm'&&e.state!=='perch')e.model.fireUpper('hit');
  if(e.hp>0&&byPlayer&&!e.T.boss&&!e.T.perch&&!e.T.shield&&!e.guardOf&&!e.retreated&&e.hp<e.maxHp*0.3&&Math.random()<0.55){e.retreated=true;e.state='retreat';e.rtT=2.4;shout(e,'retreat');}
  if(pt)hitFX(pt,true);
  if(byPlayer){hitT=0.14;hitKill=false;sfx(isHead?'head':'hitmark');e.hbT=3;if(pt&&dmgNums.length<30)dmgNums.push({x:pt.x+rand(-0.2,0.2),y:pt.y+0.25,z:pt.z,v:Math.round(dmg),t:0.8,head:isHead});}
  if(e.hp<=0)killEnemy(e,isHead,byPlayer);
}
function killEnemy(e,isHead,byPlayer){if(tdm){tdm.stats=tdm.stats||{pk:0,pd:0,ak:0,ad:0};if(byPlayer)tdm.stats.pk++;else if(e.lastAlly&&gameT-e.lastAlly<0.5)tdm.stats.ak++;}if(tdm&&!tdm.ball&&!tdm.bomb)tdm.sc[0]++;
  e.state='dead';e.t=0;e.model.muzzle(false);if(explosiveKill&&e.blastK!==undefined){const k=e.blastK;e.fly={vx:e.blastX*(4+7*k),vz:e.blastZ*(4+7*k),vy:3+5*k};}if(e.laser){scene.remove(e.laser);e.laser=null;}if(e.aura){scene.remove(e.aura);e.aura=null;}
  if(!explosiveKill&&byPlayer){ const dx=e.x-P.x,dz=e.z-P.z,l=Math.hypot(dx,dz)||1; e.yaw=Math.atan2(dx/l,dz/l); e.model.root.rotation.y=e.yaw; e.knock={vx:dx/l*2.8,vz:dz/l*2.8,t:0.32}; }
  if(isHead&&e.model.gear&&e.model.gear.helmet&&e.model.gear.helmet.visible)popHelmet(e);
  if(isHead)e.model.playFull('headshot','death_back');else e.model.playFull(byPlayer&&!explosiveKill?'death_back':(Math.random()<0.5?'death':'death_back'));
  const pts=Math.round((e.T.score+(isHead?50:0))*diff.score*(1+Math.min(streak,10)*0.05)*(endless?1.2:1)*runMods.score);score+=pts;kills++;if(isHead)head++;shake=Math.max(shake,isHead?0.22:0.14);
  const xp=Math.round(pts/5);xpGained+=xp;addXP(xp);const cash=Math.round((e.T.score/2+(isHead?75:0))*(endless?1.2:1)*((mod&&mod.money)||1)*runMods.money*econ());save.prog.money+=cash;runCash+=cash;
  if(byPlayer&&!explosiveKill){save.prog.wxp=save.prog.wxp||{};const before=wlevel(cur);save.prog.wxp[cur]=(save.prog.wxp[cur]||0)+1;const after=wlevel(cur);if(after>before)msg(WEAPONS[cur].nome+' subiu para o nível '+after+': '+(['','-10% recuo','+8% dano','+15% carregador','mira mais rápida'][after-1]||''),'#f2c94c',4);}
  if(byPlayer){if(isHead&&!headSaid){headSaid=true;announce('head',{},true);}dailyProgress('kills',1);if(isHead)dailyProgress('head',1);if(P.y>2.5)dailyProgress('high',1);if(explosiveKill)dailyProgress('expl',1);dailyProgress('cash',runCash,true);}
  if(byPlayer){hitKill=true;streak++;streakT=12;if(streak===4){uavT=30;msg('UAV ativo: adversários no radar','#7fd7ff');sfx('uav');}else if(streak===6){placeTurret();announce('streak',{n:6},true);}else if(streak===10){uavT=25;for(const o of enemies)o.hbT=25;msg('Drone: adversários marcados 25 s','#7fd7ff');sfx('uav');}else if(streak===8){airReady=true;$('btnStreak').classList.add('on');msg('Ataque aéreo pronto! (botão ou tecla 5)','#f2c94c');sfx('streak');}else if(streak===12){P.hp=P.maxHp;P.armor=Math.max(P.armor,100);P.gren=4;for(const k of ORDER)if(k!=='pistol')wst[k].reserve=Math.min(WEAPONS[k].reserve*2,wst[k].reserve+WEAPONS[k].mag*2);msg('Pacote de apoio: vida, munições e granadas','#5fd35f');sfx('streak');}}
  msg((isHead?'HEADSHOT! ':'')+e.nome+' eliminado  +'+pts+'  +'+cash+' €',isHead?'#ffd166':'#fff');
  if(e.T.boss){bossKillT=gameT;say(CAPTAINS[e.team.key]||captain(),(CAPTAINS[e.team.key]||captain()).death);msg(e.nome.toUpperCase()+' ABATIDO! A '+e.team.nome+' está sem capitão','#f2c94c');spawnPickup('health',e.x+0.8,e.z);spawnPickup('ammo',e.x-0.8,e.z);sfx('cheer',1);}
  else{const r=Math.random();if(r<0.26)spawnPickup('ammo',e.x,e.z);else if(r<0.38)spawnPickup('health',e.x,e.z);}
  sfx('kill');
}
/** arma dos inimigos: todas as peças numa só malha e num só material (cor do material x AO nas cores de vértice) -> 1 chamada de desenho */
function flattenGun(src){
  src.updateMatrixWorld(true);const parts=[];const wood=C(0x6e4020);
  const toF=a=>{ if(!a)return a; if(a.array instanceof Float32Array&&!a.normalized&&!a.isInterleavedBufferAttribute)return a; const n=a.count,k=a.itemSize,f=new Float32Array(n*k); for(let i=0;i<n;i++){ f[i*k]=a.getX(i); if(k>1)f[i*k+1]=a.getY(i); if(k>2)f[i*k+2]=a.getZ(i); if(k>3)f[i*k+3]=a.getW(i); } return new THREE.BufferAttribute(f,k); };
  src.traverse(o=>{ if(!o.isMesh)return; const m=Array.isArray(o.material)?o.material[0]:o.material; const g=o.geometry.clone(); for(const nm of ['position','normal','color'])if(g.attributes[nm])g.setAttribute(nm,toF(g.attributes[nm])); if(!g.attributes.normal)g.computeVertexNormals(); g.applyMatrix4(o.matrixWorld); const n=g.attributes.position.count,vc=g.attributes.color,col=new Float32Array(n*3),base=(m&&m.map)?wood:((m&&m.color)||new THREE.Color(0.3,0.3,0.3));
    for(let i=0;i<n;i++){ const a=vc?vc.getX(i):1,b=vc?vc.getY(i):1,cc=vc?vc.getZ(i):1; col[i*3]=base.r*a;col[i*3+1]=base.g*b;col[i*3+2]=base.b*cc; }
    for(const k of Object.keys(g.attributes)) if(k!=='position'&&k!=='normal') g.deleteAttribute(k);
    g.setAttribute('color',new THREE.BufferAttribute(col,3)); if(!g.index){ const idx=[];for(let i=0;i<n;i++)idx.push(i);g.setIndex(idx); } parts.push(g); });
  const merged=mergeGeometries(parts,false);if(!merged)return src;
  const out=new THREE.Group();out.add(new THREE.Mesh(merged,new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.55,metalness:0.35,envMapIntensity:0.6})));
  for(const nm of ['tip','eject','grip_r']){ const e=src.getObjectByName(nm); if(e){ const c=new THREE.Object3D();c.name=nm;e.getWorldPosition(c.position);out.add(c);} }
  return out;
}
/* ===================== IA tática: abrigo, flanco, fichas de disparo, supressão, gritos, capitães ===================== */
const COVER_ROLES={defesa:1,medio:1,ponta:1},FLANK_ROLES={medio:0.45,defesa:0.25};
let fireTok=[];
function maxShooters(){const k=(diff&&diff.dmg)||1;return k>1.15?4:(k<0.85?2:3);}
function canShoot(e){ // no máximo 2-4 adversários a disparar ao mesmo tempo; os outros abrigam-se ou flanqueiam
  if(e.T.boss||e.T.perch)return true;const now=gameT;
  for(let i=fireTok.length-1;i>=0;i--){const t=fireTok[i];if(t.e.state==='dead'||!enemies.includes(t.e)||t.until<=now){if(t.until<=now)t.e.tokCd=now+rand(0.8,1.6);fireTok.splice(i,1);}}
  if(fireTok.some(t=>t.e===e))return true;
  if(fireTok.length<maxShooters()&&!(e.tokCd>now)){fireTok.push({e,until:now+rand(2.2,3.4)});return true;}
  return false;
}
function flowStep(e){ // direção do campo de fluxo (caminho mais curto até ao jogador)
  const cx=Math.floor(e.x/S),cz=Math.floor(e.z/S);let bestV=G.flow[cx+cz*G.MW],bx=cx,bz=cz;
  for(let ddz=-1;ddz<=1;ddz++)for(let ddx=-1;ddx<=1;ddx++){if(!ddx&&!ddz)continue;const nx=cx+ddx,nz=cz+ddz;if(nx<0||nz<0||nx>=G.MW||nz>=G.MH||G.BOX[nx+nz*G.MW])continue;if(ddx&&ddz&&(G.BOX[cx+ddx+cz*G.MW]||G.BOX[cx+(cz+ddz)*G.MW]))continue;const v=G.flow[nx+nz*G.MW];if(v>=0&&(bestV<0||v<bestV)){bestV=v;bx=nx;bz=nz;}}
  let tx=(bx+0.5)*S,tz=(bz+0.5)*S;if(bx===cx&&bz===cz){tx=P.x;tz=P.z;}const ux=tx-e.x,uz=tz-e.z,ul=Math.hypot(ux,uz)||1;return {x:ux/ul,z:uz/ul};
}
const freeCell=(x,z)=>{const qx=Math.floor(x/S),qz=Math.floor(z/S);return qx>=0&&qz>=0&&qx<G.MW&&qz<G.MH&&!G.BOX[qx+qz*G.MW]&&inArena(x,z);};
function findCover(e){ // ponto atrás de um obstáculo (em relação ao jogador) que o esconda, e um ponto lateral para espreitar
  const ecx=Math.floor(e.x/S),ecz=Math.floor(e.z/S),R=4,pref=e.T.keep?e.T.keep*0.8:15;let best=null,bs=1e9;
  for(let cz=ecz-R;cz<=ecz+R;cz++)for(let cx=ecx-R;cx<=ecx+R;cx++){
    if(cx<0||cz<0||cx>=G.MW||cz>=G.MH||!G.BOX[cx+cz*G.MW])continue;
    const bx=(cx+0.5)*S,bz=(cz+0.5)*S;let ux=bx-P.x,uz=bz-P.z;const ul=Math.hypot(ux,uz)||1;ux/=ul;uz/=ul;
    const x=bx+ux*(S*0.5+0.9),z=bz+uz*(S*0.5+0.9);if(!freeCell(x,z))continue;
    const pd=Math.hypot(x-P.x,z-P.z);if(pd<6||pd>e.T.range)continue;
    if(los(x,z,P.x,P.z,1.4,P.y+1.5))continue;
    if(enemies.some(o=>o!==e&&o.state==='cover'&&o.cv&&Math.hypot(o.cv.x-x,o.cv.z-z)<2))continue;
    const sc=Math.hypot(x-e.x,z-e.z)+Math.abs(pd-pref)*0.4;if(sc<bs){bs=sc;best={x,z,ux,uz};}
  }
  if(!best||bs>22)return null;
  const px=-best.uz,pz=best.ux;let peek=null;
  for(const off of [2.2,3.4,4.6]){for(const sd of [1,-1]){const x=best.x+px*off*sd,z=best.z+pz*off*sd;if(freeCell(x,z)&&los(x,z,P.x,P.z,1.4,P.y+1.5)){peek={x,z};break;}}if(peek)break;}
  return {x:best.x,z:best.z,px:peek?peek.x:null,pz:peek?peek.z:null,ph:'go',t:0,n:0};
}
function tactics(e,d){
  if(e.T.boss||e.guardOf||e.T.perch)return false;const r=e.role;
  if(FLANK_ROLES[r]&&!e.flankDone&&d>11){e.flankDone=true;if(Math.random()<FLANK_ROLES[r]){e.state='flank';e.flT=rand(3.5,5.5);e.flSide=Math.random()<0.5?-1:1;shout(e,'flank');return true;}}
  if(COVER_ROLES[r]&&gameT>(e.coverCd||0)&&(e.supT>0||e.hp<e.maxHp*0.7||(e.fireCd<=0&&!e.hasTok))){const c=findCover(e);e.coverCd=gameT+(c?6:2.5);if(c){e.cv=c;e.state='cover';if(Math.random()<0.5)shout(e,'cover');return true;}}
  return false;
}
function suppressAlong(o,d,maxT){ // balas a passar a menos de 2,4 m assustam: pior pontaria e vontade de abrigo
  for(const e of enemies){if(e.state==='dead'||e.state==='warm')continue;const ex=e.x-o.x,ey=(e.y||0)+1.3-o.y,ez=e.z-o.z,t=ex*d.x+ey*d.y+ez*d.z;if(t<1||t>maxT+2)continue;const qx=ex-d.x*t,qy=ey-d.y*t,qz=ez-d.z*t;if(qx*qx+qy*qy+qz*qz<5.8){if(!(e.supT>0)&&Math.random()<0.3)shout(e,'sup');e.supT=1.6;}}
}
/* balões de fala */
const bubbles=[];let shoutCd=0;
function shout(e,kind){
  if(shoutCd>0||!e||e.state==='dead'||e.shCd>gameT)return;const pool=SHOUTS[kind];if(!pool)return;
  let b=bubbles.find(b=>b.t<=0);
  if(!b){if(bubbles.length>=5)return;const c=document.createElement('canvas');c.width=320;c.height=72;const g=c.getContext('2d');if(!g||!g.measureText)return;const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false,depthTest:false,sizeAttenuation:false,fog:false}));sp.scale.set(0.62,0.14,1);sp.center.set(0.5,0.0);sp.renderOrder=20;sp.visible=false;scene.add(sp);b={c,g,tex,sp,t:0,e:null};bubbles.push(b);}
  const g=b.g,txt=pickLine(pool);g.clearRect(0,0,320,72);g.font='700 24px Oswald, "Arial Black", sans-serif';const w=Math.min(308,g.measureText(txt).width+30),x0=160-w/2;
  g.fillStyle='rgba(255,255,255,0.96)';g.strokeStyle='#1b1b1b';g.lineWidth=3;g.beginPath();g.moveTo(x0+12,6);g.lineTo(x0+w-12,6);g.quadraticCurveTo(x0+w,6,x0+w,18);g.lineTo(x0+w,46);g.quadraticCurveTo(x0+w,58,x0+w-12,58);g.lineTo(172,58);g.lineTo(160,70);g.lineTo(150,58);g.lineTo(x0+12,58);g.quadraticCurveTo(x0,58,x0,46);g.lineTo(x0,18);g.quadraticCurveTo(x0,6,x0+12,6);g.closePath();g.fill();g.stroke();
  g.fillStyle='#161616';g.textAlign='center';g.textBaseline='middle';g.fillText(txt,160,33,w-20);b.tex.needsUpdate=true;
  b.t=1.9;b.e=e;b.sp.visible=true;shoutCd=1.0;e.shCd=gameT+6;
}
function updateBubbles(dt){ if(shoutCd>0)shoutCd-=dt; for(const b of bubbles){if(b.t<=0)continue;b.t-=dt;const e=b.e;if(!e||e.state==='dead'||b.t<=0){b.t=0;b.sp.visible=false;continue;}b.sp.position.set(e.x,(e.y||0)+2.15*(e.scale||1),e.z);b.sp.material.opacity=Math.min(1,b.t*3);} }
/* petardos de El Cóndor: marca no chão e explosão 1,6 s depois */
const blasts=[];
function markBlast(x,z,delay){ if(!inArena(x,z))return; const m=new THREE.Mesh(new THREE.RingGeometry(1.75,2.1,32),new THREE.MeshBasicMaterial({color:0xff1e12,transparent:true,opacity:0.9,side:THREE.DoubleSide,depthWrite:false,fog:false}));const disk=new THREE.Mesh(new THREE.CircleGeometry(1.75,32),new THREE.MeshBasicMaterial({color:0xff2a1a,transparent:true,opacity:0.28,side:THREE.DoubleSide,depthWrite:false,fog:false}));m.add(disk);m.rotation.x=-Math.PI/2;m.position.set(x,0.07,z);m.renderOrder=5;scene.add(m);blasts.push({m,disk,x,z,t:delay}); }
function updateBlasts(dt){ for(let i=blasts.length-1;i>=0;i--){const b=blasts[i];b.t-=dt;b.m.material.opacity=0.7+0.3*Math.sin(gameT*18);b.disk.material.opacity=0.18+0.14*Math.sin(gameT*18);b.m.scale.setScalar(1+Math.max(0,b.t)*0.25);if(b.t<=0){explosion(b.x,0.2,b.z,3.2,55,false,true,true);scene.remove(b.m);b.m.geometry.dispose();b.disk.geometry.dispose();blasts.splice(i,1);}} }
const MECH={esp:'charge',fra:'think',ale:'whistle',bra:'dribble',arg:'flares',cft:'guards'};
function bossMech(e,dt,d,dx,dz){
  const k=e.team.key,cap=CAPTAINS[k]||captain();let mk=MECH[B(k)];if(!mk){let h=0;for(const ch of String(k))h=(h*31+ch.charCodeAt(0))|0;mk=['charge','whistle','dribble','flares'][Math.abs(h)%4];}
  e.mT=(e.mT===undefined?rand(6,9):e.mT)-dt;
  if(mk==='charge'){if(e.mT<=0&&e.state==='attack'&&e.hasLos&&d>5&&d<26){e.mT=rand(9,13);e.state='charge';e.chPhase=0;e.chT=0.9;e.chHit=false;e.chBump=false;msg(cap.nome+' raspa o chão... vai investir!','#ff8a8a');sfx('siren');}}
  else if(mk==='think'){if(e.mT<=0&&e.state==='attack'){e.mT=rand(14,18);e.state='think';e.thT=3.2;say(cap,pickLine(PHILO));msg(cap.nome+' parou para filosofar: dano a dobrar!','#f2c94c');}}
  else if(mk==='whistle'){if(e.mT<=0){e.mT=rand(15,19);if(enemies.filter(o=>o.state!=='dead').length<12){msg(cap.nome+' apita: reforços em campo!','#ff8a8a');sfx('pin');for(let i=0;i<2;i++)spawnEnemy('defesa');}}}
  else if(mk==='dribble'){e.dodgeCd=(e.dodgeCd||0)-dt;if(e.dashT>0)e.dashT-=dt;else if(e.dodgeCd<=0&&d<34&&e.hasLos){const cd=camDir(),cx=e.x-camera.position.x,cy=(e.y||0)+1.3-camera.position.y,cz=e.z-camera.position.z,cl=Math.hypot(cx,cy,cz)||1;if((cd.x*cx+cd.y*cy+cd.z*cz)/cl>0.992){e.dodgeCd=rand(2.2,3.6);e.dashT=0.38;const sd=Math.random()<0.5?-1:1;e.dashX=-dz/d*sd;e.dashZ=dx/d*sd;shout(e,'dribble');}}}
  else if(mk==='flares'){if(e.mT<=0&&e.hasLos){e.mT=rand(9,12);msg(cap.nome+', do camarote: petardos da claque!','#ff8a8a');for(let i=0;i<3;i++){const a=Math.random()*TAU,r=i===0?0:rand(1.8,3.6);markBlast(P.x+Math.cos(a)*r,P.z+Math.sin(a)*r,1.6);}}}
  else if(mk==='guards'){const want=(e.phase||1)>=2?4:2;e.guards=(e.guards||[]).filter(g=>g.state!=='dead'&&enemies.includes(g));if(!e.guardT||gameT>e.guardT){e.guardT=gameT+8;let n=0;while(e.guards.length<want&&n<2){spawnEnemy('escudo');const g=enemies[enemies.length-1];g.guardOf=e;g.gSide=e.guards.length%2?1:-1;g.x=e.x+g.gSide*1.6;g.z=e.z+1.2;e.guards.push(g);n++;}if(n)msg(n>1?'O Presidente chegou com seguranças!':'Mais um segurança para o Presidente!','#ff8a8a');}}
}
/* ===================== ajuda de pontaria (telemóvel): travagem num cone, acompanhamento suave, encaixe ao apontar ===================== */
let assistFric=1,adsPrev=false,snapT=0,snapE=null,fovPunch=0;
function assistTarget(maxLat,maxAng){ const cd=camDir(),o=camera.position;let best=null,bs=1e9;
  for(const e of enemies){ if(e.state==='dead'||e.state==='warm')continue; const ex=e.x-o.x,ey=(e.perchY||e.y||0)+1.2*(e.scale||1)-o.y,ez=e.z-o.z,dist=Math.hypot(ex,ey,ez)||1; if(dist>WEAPONS[cur].range)continue;
    const dot=(cd.x*ex+cd.y*ey+cd.z*ez)/dist; if(dot<Math.cos(maxAng))continue; const lat=Math.sqrt(Math.max(0,1-dot*dot))*dist; if(lat>maxLat)continue;
    if(!los(o.x,o.z,e.x,e.z,o.y,(e.perchY||e.y||0)+1.2))continue; const sc=lat+dist*0.02; if(sc<bs){bs=sc;best={e,ex,ey,ez,dist};} }
  return best; }
function assistUpdate(dt){
  const lvl=isTouch?(save.settings.assist??1):0;assistFric=1;if(!lvl||mode!=='play'||!P.alive){adsPrev=ads;return;}
  const strong=lvl===2,t=assistTarget(strong?1.3:0.9,strong?0.14:0.1);
  if(t){ assistFric=strong?0.5:0.62; const ty=Math.atan2(-t.ex,-t.ez),tp=Math.atan2(t.ey,Math.hypot(t.ex,t.ez)); let dyw=ty-P.yaw;dyw=Math.atan2(Math.sin(dyw),Math.cos(dyw)); const moving=joy.active||P.moving>0.3||(t.e.spd||0)>0.6; if(moving){ const r=(strong?1.6:0.9)*dt; P.yaw+=clamp(dyw,-r,r); P.pitch+=clamp(tp-P.pitch,-r*0.6,r*0.6); } }
  if(ads&&!adsPrev){ const sn=assistTarget(strong?3.2:2.2,strong?0.25:0.18); if(sn){snapE=sn.e;snapT=0.16;} }
  adsPrev=ads;
  if(snapT>0&&snapE&&snapE.state!=='dead'){ snapT-=dt; const o=camera.position,ex=snapE.x-o.x,ey=(snapE.perchY||snapE.y||0)+1.25*(snapE.scale||1)-o.y,ez=snapE.z-o.z; const ty=Math.atan2(-ex,-ez),tp=Math.atan2(ey,Math.hypot(ex,ez)); let dyw=ty-P.yaw;dyw=Math.atan2(Math.sin(dyw),Math.cos(dyw)); const k=Math.min(1,dt*14); P.yaw+=dyw*k; P.pitch+=(tp-P.pitch)*k; } else snapT=0;
}
/* ===================== ambiente por país: pó ao sol (ESP), confetes (BRA), papelinhos (ARG) ===================== */
let ambPts=null,ambKey=null;
const AMB={esp:{n:70,cols:[0xf2dcae,0xe8c98a],size:0.06,fall:0.05,drift:0.25},bra:{n:90,cols:[0x2fb34a,0xf2c94c,0x1f5fd0],size:0.09,fall:0.9,drift:0.5},arg:{n:90,cols:[0x9ecbff,0xffffff],size:0.09,fall:0.8,drift:0.45}};
function ambientSetup(){ const k=theme&&theme.key;if(ambKey===k)return;ambKey=k;if(ambPts){scene.remove(ambPts);ambPts.geometry.dispose();ambPts=null;} const A=AMB[k];if(!A)return;
  const pos=new Float32Array(A.n*3),col=new Float32Array(A.n*3),c=new THREE.Color();for(let i=0;i<A.n;i++){pos[i*3]=rand(-18,18);pos[i*3+1]=rand(0.5,14);pos[i*3+2]=rand(-18,18);c.setHex(A.cols[i%A.cols.length]);col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('color',new THREE.BufferAttribute(col,3));
  ambPts=new THREE.Points(geo,new THREE.PointsMaterial({size:A.size,vertexColors:true,transparent:true,opacity:0.85,depthWrite:false,sizeAttenuation:true}));ambPts.frustumCulled=false;ambPts.userData.A=A;scene.add(ambPts); }
function ambientUpdate(dt){ ambientSetup(); if(!ambPts)return; const A=ambPts.userData.A,p=ambPts.geometry.attributes.position,a=p.array,cx=camera.position.x,cz=camera.position.z;
  for(let i=0;i<a.length;i+=3){ a[i]+=Math.sin(gameT*0.7+i)*A.drift*dt; a[i+1]-=A.fall*dt*(0.6+((i*7)%5)/5); a[i+2]+=Math.cos(gameT*0.6+i*1.3)*A.drift*dt;
    if(a[i+1]<0.2)a[i+1]=rand(10,15); if(a[i]-cx>18)a[i]-=36; else if(a[i]-cx<-18)a[i]+=36; if(a[i+2]-cz>18)a[i+2]-=36; else if(a[i+2]-cz<-18)a[i+2]+=36; }
  p.needsUpdate=true; }
/* capacete a saltar num tiro na cabeça */
const flying=[];
function popHelmet(e){ const h=e.model.gear.helmet,wp=new THREE.Vector3(),wq=new THREE.Quaternion(),ws=new THREE.Vector3(); h.getWorldPosition(wp);h.getWorldQuaternion(wq);h.getWorldScale(ws);
  const c=h.clone(true);c.position.copy(wp);c.quaternion.copy(wq);c.scale.copy(ws);scene.add(c);h.visible=false;
  const dx=e.x-P.x,dz=e.z-P.z,l=Math.hypot(dx,dz)||1;flying.push({m:c,vx:dx/l*2.6+rand(-0.6,0.6),vy:rand(3.6,5.2),vz:dz/l*2.6+rand(-0.6,0.6),sx:rand(-9,9),sz:rand(-9,9),t:4});sfx('bounce'); }
function updateFlying(dt){ for(let i=flying.length-1;i>=0;i--){ const f=flying[i],m=f.m;f.t-=dt;f.vy-=14*dt;m.position.x+=f.vx*dt;m.position.y+=f.vy*dt;m.position.z+=f.vz*dt;m.rotation.x+=f.sx*dt;m.rotation.z+=f.sz*dt;
    if(m.position.y<0.12){m.position.y=0.12;if(f.vy<-1.2){f.vy=-f.vy*0.35;f.vx*=0.6;f.vz*=0.6;f.sx*=0.5;f.sz*=0.5;sfx('bounce',0.4);}else{f.vy=0;f.vx*=0.9;f.vz*=0.9;f.sx*=0.8;f.sz*=0.8;}}
    if(f.t<=0){scene.remove(m);flying.splice(i,1);} } }
/* pinturas das armas (todas as armas): muda o aço e o polímero; a madeira fica madeira */
const SKIN_PARTS=['gun_metal','gun_steel','gun_polymer','gun_tan','gun_dark'];let SKINMATS={};
function skinTex(kind){ try{ const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');if(!g||!g.fillRect)return null;
  if(kind==='camo'){ g.fillStyle='#4a5236';g.fillRect(0,0,256,256);for(const col of ['#2f3524','#6b6a44','#1e2218','#56603a'])for(let i=0;i<14;i++){g.fillStyle=col;g.beginPath();const x=Math.random()*256,y=Math.random()*256;g.ellipse(x,y,rand(14,40),rand(8,22),Math.random()*3,0,Math.PI*2);g.fill();} }
  else if(kind==='tiger'){ g.fillStyle='#d8761e';g.fillRect(0,0,256,256);g.fillStyle='#161210';for(let i=0;i<16;i++){const y=i*16+rand(-4,4);g.beginPath();g.moveTo(0,y);for(let x=0;x<=256;x+=16)g.lineTo(x,y+Math.sin(x*0.05+i)*6+rand(-2,2));for(let x=256;x>=0;x-=16)g.lineTo(x,y+4+Math.sin(x*0.05+i)*6);g.fill();} }
  else { g.fillStyle='#f06aa8';g.fillRect(0,0,256,256);g.fillStyle='#141214';for(let i=0;i<12;i++){const y=i*22+rand(-4,4);g.beginPath();g.moveTo(0,y);for(let x=0;x<=256;x+=16)g.lineTo(x,y+Math.sin(x*0.04+i*1.3)*9);for(let x=256;x>=0;x-=16)g.lineTo(x,y+7+Math.sin(x*0.04+i*1.3)*9+Math.sin(x*0.13)*2);g.fill();} }
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;return t; }catch(e){ return null; } }
function skinMat(s,name){ SKINMATS[s]=SKINMATS[s]||{}; if(SKINMATS[s][name])return SKINMATS[s][name]; const base=GUNMATS[name]||GUNMATS.gun_metal; const m=base.clone();
  if(s==='gold'){ m.color.setHex(name==='gun_dark'?0x5a4418:0xd4a93a);m.metalness=1;m.roughness=name==='gun_polymer'?0.35:0.22;m.map=null;m.roughnessMap=null; }
  else { const tx=SKINMATS[s].__tex||(SKINMATS[s].__tex=skinTex(s)); if(name!=='gun_dark'&&tx){ m.map=tx;m.color.setHex(0xffffff);m.metalness=0.15;m.roughness=0.62;m.roughnessMap=null; } }
  m.needsUpdate=true; return SKINMATS[s][name]=m; }
const VMATS={};
function variantMat(k,name){ const w=WEAPONS[k],tn=w&&w.tint&&w.tint[name]; if(!tn)return GUNMATS[name]||GUNMATS.gun_metal; const key=k+'|'+name; if(VMATS[key])return VMATS[key]; const m=(GUNMATS[name]||GUNMATS.gun_metal).clone(); m.color.setHex(tn); return VMATS[key]=m; }
function applyVariantTint(k,v){ if(!v||!v.group||!WEAPONS[k]||!WEAPONS[k].tint)return; v.group.traverse(o=>{ if(!o.isMesh||!o.userData.gm)return; const nm=o.userData.gm[0]; if(WEAPONS[k].tint[nm])o.material=variantMat(k,nm); }); }
function applySkin(){ const s=save.prog.skin||null; for(const k of ORDER){ const v=views[k]; if(!v||!v.group)continue; v.group.traverse(o=>{ if(!o.isMesh||!o.userData.gm)return; const nm=o.userData.gm[0]; if(!SKIN_PARTS.includes(nm))return; o.material=s?skinMat(s,nm):variantMat(k,nm); }); } }
/* dificuldade adaptativa + contra-relógio */
let timeAttack=0,taRun=false;
function adaptAcc(){ if(endless||taRun)return 1; const f=((save.prog.fails||{})[team.key])||0; return 1-0.08*Math.min(4,f); }
/* tutorial leve no primeiro jogo: 5 dicas do Treinador em legenda, sem parar o jogo */
let tutQ=null,tutT=0;
function tutStart(){ if(save.prog.tutDone||tutQ)return; tutQ=[isTouch?'Arrasta o polegar esquerdo para andar.':'WASD para andar, Shift para correr.',isTouch?'Arrasta à direita para olhar. O botão da mira aponta com precisão.':'Rato para olhar, botão direito para apontar.',isTouch?'O botão amarelo dispara. A seta circular recarrega.':'Clique para disparar, R para recarregar.','Salta de frente para caixotes e casinhas: sobes para cima deles.','Entre ondas, procura a banca LOJA para comprar armas e melhorias.']; tutT=2; }
function tutUpdate(dt){ if(!tutQ)return; tutT-=dt; if(tutT<=0&&tutQ.length){ msg('TREINADOR: '+tutQ.shift(),'#8fe38f',3.4); tutT=4.6; } if(!tutQ.length&&tutT<=0){ tutQ=null; save.prog.tutDone=true; persist(); } }
function taUpdate(dt){ if(!taRun||timeAttack<=0)return; timeAttack-=dt; if(timeAttack<=10&&timeAttack+dt>10)msg('CONTRA-RELÓGIO: 10 segundos!','#ff6a5a',2.4); if(timeAttack<=0){ timeAttack=0; save.prog.bestTA=Math.max(save.prog.bestTA||0,kills); persist(); msg('TEMPO! '+kills+' abates','#f2c94c',3); gameOver(); } }
/* ===================== Equipa contra Equipa (5 contra 5): colegas com IA, placar, reaparecer ===================== */
let tdm=null;const allies=[];
const LEO_TM={key:'leo',nome:'Leões da Capital',shirt:0xd8202a,shorts:0xffffff,socks:0xd8202a,trim:0xf2c94c,numCol:0xffffff,kitTint:0xffffff};
function flowStepTo(a,tg){ const dx=tg.x-a.x,dz=tg.z-a.z,dl=Math.hypot(dx,dz)||1; let ux=dx/dl,uz=dz/dl; const nx=a.x+ux*1.2,nz=a.z+uz*1.2; if(boxAt(Math.floor(nx/S),Math.floor(nz/S))){ const tx=-uz,tz=ux; const l1=!boxAt(Math.floor((a.x+tx*1.2)/S),Math.floor((a.z+tz*1.2)/S)); if(l1){ux=tx;uz=tz;} else {ux=-tx;uz=-tz;} } return {x:ux,z:uz}; }
function tdmClear(){ if(ballObj&&ballObj.parent)ballObj.parent.remove(ballObj); if(bombFx){scene.remove(bombFx);bombFx=null;} for(const a of allies){ try{a.model.muzzle&&a.model.muzzle(false);a.model.release();}catch(e){} } allies.length=0; tdm=null; P.inv=0; }
function tdmStart(kind){ tdmClear(); const ball=kind==='ball',bomb=kind==='bomb'; tdm={sc:[0,0],t:bomb?9999:300,goal:ball?3:(bomb?3:25),spT:0.5,aT:0,home:(ball||bomb)?{x:3*S+2,z:G.MH*S/2}:{x:G.START.x,z:G.START.z},ball:ball?{st:'center',x:G.START.x,z:G.START.z,t:0,holder:null}:null,bomb:bomb?{round:1,sites:bombSites()}:null}; if(bomb)bombRoundReset(tdm.bomb);
  endless=true; toSpawn=0; waveBanner=0; if(ball||bomb){ P.x=tdm.home.x; P.z=tdm.home.z; P.y=0; P.yaw=-Math.PI/2; }
  for(let i=0;i<4;i++)spawnAlly(); msg(bomb?'PETARDO NO CAMAROTE: leva o petardo ao camarote A ou B, fica 3 s parado para o armar e defende-o 35 s · à melhor de 5':ball?'ROUBAR A BOLA: apanha a bola ao centro e leva-a à baliza adversária · 3 golos':'5 CONTRA 5: primeiro a 25 abates ou mais abates aos 5 minutos','#f2c94c',3.4); }
/* Roubar a Bola */
let ballObj=null;
function ballMesh(){ if(ballObj)return ballObj; let tex=null; try{ const c=document.createElement('canvas');c.width=128;c.height=64;const g=c.getContext('2d'); if(g&&g.fillRect){ g.fillStyle='#ffffff';g.fillRect(0,0,128,64);g.fillStyle='#1a1a1a';for(const [x,y] of [[16,16],[48,40],[80,16],[112,40],[32,52],[96,8],[64,28]]){g.beginPath();g.arc(x,y,7,0,Math.PI*2);g.fill();} tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace; } }catch(e){}
  const m=new THREE.Mesh(new THREE.SphereGeometry(0.3,20,14),new THREE.MeshStandardMaterial({color:0xffffff,map:tex,roughness:0.5}));m.castShadow=true;
  const ring=new THREE.Mesh(new THREE.RingGeometry(0.7,0.9,28),new THREE.MeshBasicMaterial({color:0xf2c94c,transparent:true,opacity:0.7,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=-0.28;m.add(ring);
  ballObj=m; return m; }
/* Petardo no camarote: leva o petardo a um camarote (A/B), arma-o (3 s parado), defende-o 35 s; rondas à melhor de 5 */
let bombFx=null;
function lblSprite(t,col){ let tex=null; try{ const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'); if(g&&g.fillText){ g.fillStyle=col;g.beginPath();g.arc(64,64,54,0,Math.PI*2);g.fill();g.lineWidth=8;g.strokeStyle='#1f2a33';g.stroke();g.fillStyle='#fff';g.font='bold 76px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(t,64,68);tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace; } }catch(e){}
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,color:tex?0xffffff:0xff5a3a,depthWrite:false}));sp.scale.set(1.6,1.6,1);return sp; }
function bombSites(){ const pickFree=(tx,tz)=>{ let best=null,bd=1e9; for(let z=1;z<G.MH-1;z++)for(let x=Math.floor(G.MW*0.6);x<G.MW-1;x++){ if(G.MAP[z][x]!=='.')continue; const d=Math.hypot(x-tx,z-tz); if(d<bd){bd=d;best={x:(x+0.5)*S,z:(z+0.5)*S};} } return best; };
  return [pickFree(G.MW-6,G.MH*0.28),pickFree(G.MW-6,G.MH*0.72)].filter(Boolean); }
function bombVisuals(B){ if(bombFx)scene.remove(bombFx); bombFx=new THREE.Group(); B.sites.forEach((st,i)=>{ const ring=new THREE.Mesh(new THREE.RingGeometry(2.2,2.6,40),new THREE.MeshBasicMaterial({color:0xff6a3a,transparent:true,opacity:0.85,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.set(st.x,0.05,st.z);bombFx.add(ring);
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,16,10,1,true),new THREE.MeshBasicMaterial({color:0xff8a4a,transparent:true,opacity:0.2,depthWrite:false,side:THREE.DoubleSide}));beam.position.set(st.x,8,st.z);bombFx.add(beam);
    const l=lblSprite(i?'B':'A','#e8502e');l.position.set(st.x,4.2,st.z);bombFx.add(l); });
  const pet=new THREE.Group();const body=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,0.62,14),new THREE.MeshStandardMaterial({color:0xc8202a,roughness:0.5}));body.position.y=0.31;pet.add(body);
  const band=new THREE.Mesh(new THREE.CylinderGeometry(0.165,0.165,0.1,14),new THREE.MeshStandardMaterial({color:0xf2c94c,roughness:0.4,metalness:0.3}));band.position.y=0.4;pet.add(band);
  const fuse=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.18,6),new THREE.MeshStandardMaterial({color:0x3a2a1a}));fuse.position.set(0.04,0.7,0);fuse.rotation.z=-0.4;pet.add(fuse);
  const led=new THREE.Mesh(new THREE.SphereGeometry(0.05,8,6),new THREE.MeshBasicMaterial({color:0xff2020}));led.position.set(0,0.52,0.16);pet.add(led);pet.userData.led=led;B.mesh=pet;bombFx.add(pet); scene.add(bombFx); }
function bombRoundReset(B){ B.st='carry';B.carrier='player';B.plantT=0;B.fuse=35;B.defT=0;B.roundT=90;B.site=null;B.beep=0;
  for(const e of enemies)if(e.state!=='dead')removeEnemy(e); P.x=tdm.home.x;P.z=tdm.home.z;P.y=0;P.vy=0;P.hp=P.maxHp;P.yaw=-Math.PI/2;
  let i=0;for(const a of allies){ if(a.state==='dead')continue; a.x=tdm.home.x+2+(i%2)*1.5;a.z=tdm.home.z-3+i*2;i++; } tdm.spT=2.5; }
function bombRoundEnd(win,why){ const B=tdm.bomb;B.st='done';tdm.sc[win?0:1]++; msg((win?'RONDA DOS LEÕES! ':'Ronda dos adversários · ')+why+' · '+tdm.sc[0]+'–'+tdm.sc[1],win?'#f2c94c':'#ff6a5a',3.2); sfx(win?'whistle':'whistle',0.6);
  if(tdm.sc[0]>=3||tdm.sc[1]>=3){ if(tdm.sc[0]>=3){save.prog.money+=1800;runCash+=1800;} tdm.over=true; setTimeout(()=>{ if(mode==='play')gameOver(); },1800); } else B.nextT=3.2; }
function bombUpdate(dt){ const B=tdm.bomb; if(!B.mesh)bombVisuals(B); const m=B.mesh,led=m.userData.led;
  if(B.st==='done'){ if(B.nextT>0){B.nextT-=dt;if(B.nextT<=0){B.round++;bombRoundReset(B);msg('RONDA '+B.round+' · leva o petardo a um camarote (A ou B)','#f2c94c',3);}} return; }
  if(B.st==='carry'){ B.roundT-=dt; if(B.roundT<=0){ bombRoundEnd(false,'tempo esgotado'); return; }
    if(B.carrier==='player'){ m.position.set(P.x+Math.cos(P.yaw)*0.4,0.9,P.z-Math.sin(P.yaw)*0.4); const st=B.sites.find(q=>Math.hypot(P.x-q.x,P.z-q.z)<2.5);
      if(st&&P.moving<0.15&&P.alive){ B.plantT+=dt; if(B.plantT>=3){ B.st='planted';B.site=st;B.fuse=35;B.defT=0; m.position.set(st.x,0,st.z); msg('PETARDO ARMADO! Defende o camarote durante 35 s','#f2c94c',3.2); sfx('pin'); } }
      else B.plantT=Math.max(0,B.plantT-dt*2); }
    else { m.position.set(B.x,0,B.z); m.rotation.y+=dt*2; if(P.alive&&Math.hypot(P.x-B.x,P.z-B.z)<1.3){ B.carrier='player'; msg('Voltaste a apanhar o petardo','#f2c94c',2); sfx('pick'); } } }
  else if(B.st==='planted'){ B.fuse-=dt; B.beep-=dt; const per=B.fuse>10?1:(B.fuse>4?0.5:0.22); if(B.beep<=0){ B.beep=per; sfx('ping',0.5); } if(led)led.visible=B.beep>per*0.5;
    let near=false; for(const e of enemies){ if(e.state==='dead'||e.state==='warm')continue; if(Math.hypot(e.x-B.site.x,e.z-B.site.z)<2.5){near=true;break;} }
    B.defT=near?B.defT+dt:Math.max(0,B.defT-dt*0.5); if(B.defT>=5){ bombRoundEnd(false,'desarmaram o petardo'); return; }
    if(B.fuse<=0){ const st=B.site; puffSmoke(st.x,1,st.z,30,0xf2c94c,1.6,4,1.6); puffSmoke(st.x,1,st.z,24,0x2fb34a,1.4,3.5,1.4); puffSmoke(st.x,1.5,st.z,20,0xd8202a,1.2,3,1.2); shake=Math.max(shake,0.8); sfx('boom',0.9); m.position.set(0,-50,0); bombRoundEnd(true,'o petardo rebentou no camarote'); } } }
function flowTarget(){ if(tdm&&tdm.bomb&&tdm.bomb.st==='planted'&&tdm.bomb.site)return tdm.bomb.site; if(tdm&&tdm.ball){ const B=tdm.ball; if(B.st==='center'||B.st==='ground')return {x:B.x,z:B.z}; if(B.st==='ally'&&B.holder&&B.holder.state!=='dead')return {x:B.holder.x,z:B.holder.z}; } return P; }
function ballGoal(){ return {x:(G.MW-1.6)*S,z:G.MH*S/2}; }
function ballOwnGoal(){ return {x:1.6*S,z:G.MH*S/2}; }
function ballUpdate(dt){ const B=tdm.ball,m=ballMesh(); if(!m.parent)scene.add(m); const gl=ballGoal(),og=ballOwnGoal();
  const resetBall=()=>{ B.st='center'; B.x=G.START.x; B.z=G.START.z; B.holder=null; B.t=0; };
  if(B.st==='center'||B.st==='ground'){ m.position.set(B.x,0.3+Math.abs(Math.sin(gameT*3))*0.15,B.z); m.rotation.y+=dt*2;
    if(B.st==='ground'){ B.t-=dt; if(B.t<=0){ resetBall(); msg('A bola voltou ao centro','#f2c94c',2); } }
    if(P.alive&&Math.hypot(P.x-B.x,P.z-B.z)<1.3){ B.st='player'; msg('TENS A BOLA! Leva-a à baliza adversária (segue a seta)','#f2c94c',3); sfx('pick'); return; }
    for(const a of allies){ if(a.state==='dead')continue; if(Math.hypot(a.x-B.x,a.z-B.z)<1.3){ B.st='ally'; B.holder=a; msg('Um colega apanhou a bola!','#8fe38f',2.2); return; } }
    for(const e of enemies){ if(e.state==='dead'||e.state==='warm')continue; if(Math.hypot(e.x-B.x,e.z-B.z)<1.3){ B.st='enemy'; B.holder=e; B.t=30; msg('Roubaram a bola! Abate o portador antes de chegar à tua baliza','#ff6a5a',3); return; } } }
  else if(B.st==='player'){ m.position.set(P.x-Math.sin(P.yaw)*0.6,0.3,P.z-Math.cos(P.yaw)*0.6); m.rotation.x-=dt*(P.moving?9:0);
    if(Math.hypot(P.x-gl.x,P.z-gl.z)<4.5){ tdm.sc[0]++; resetBall(); msg('GOLO DOS LEÕES! '+tdm.sc[0]+'–'+tdm.sc[1],'#f2c94c',3.2); sfx('whistle'); puffSmoke(gl.x,1,gl.z,16,0xf2c94c,1.2,2.5,1.2); } }
  else if(B.st==='ally'){ const a=B.holder; if(!a||a.state==='dead'||a.remove){ B.st='ground'; B.t=8; if(a){B.x=a.x;B.z=a.z;} msg('O colega perdeu a bola!','#ff8a78',2); return; }
    m.position.set(a.x,0.3,a.z+0.5); m.rotation.x-=dt*8;
    if(Math.hypot(a.x-gl.x,a.z-gl.z)<4.5){ tdm.sc[0]++; resetBall(); msg('GOLO DOS LEÕES (colega)! '+tdm.sc[0]+'–'+tdm.sc[1],'#f2c94c',3.2); sfx('whistle'); puffSmoke(gl.x,1,gl.z,16,0xf2c94c,1.2,2.5,1.2); } }
  else if(B.st==='enemy'){ const e=B.holder; if(!e||e.state==='dead'){ B.st='ground'; B.t=8; if(e){B.x=e.x;B.z=e.z;} msg('Portador abatido! A bola está no chão','#8fe38f',2.4); return; }
    const dx=og.x-e.x,dz=og.z-e.z,dl=Math.hypot(dx,dz)||1; const sp=4.2; e.x+=dx/dl*sp*dt; e.z+=dz/dl*sp*dt; collideCircle(e,0.4,0,true); e.yaw=Math.atan2(-dx,-dz);
    m.position.set(e.x,(e.y||0)+2.4,e.z); B.t-=dt;
    if(dl<4.5||B.t<=0){ tdm.sc[1]++; resetBall(); msg('Golo dos adversários · '+tdm.sc[0]+'–'+tdm.sc[1],'#ff6a5a',3); sfx('whistle',0.5); } } }
function spawnAlly(){ const model=pool.acquire(); if(!model)return null; const R=ROLES.medio,o={skin:pick(SKINS),hair:pick(HAIRS),num:2+Math.floor(Math.random()*20)};
  try{ dressEnemy(model,LEO_TM,R,o); if(charTemplate&&charTemplate.asset&&charTemplate.asset.kits&&charTemplate.asset.kits.kit_player){ const tone=o.skin,skin=tone==='light'?charTemplate.baseMaterials.Body.map:charTemplate.asset.skins[tone]; model.setColors(skin,charTemplate.asset.kits.kit_player,o.hair); } if(charTemplate.kitShader)model.setKit(0xd8202a,0x1f2a3a,0xd8202a,o.skin,o.hair); else if(charTemplate.flat&&model.mats&&model.mats.Kit)model.mats.Kit.color.setHex(0xd8202a); }catch(e){}
  const s=(tdm&&tdm.home)||G.START,a={ally:true,T:R,hp:120,maxHp:120,x:s.x+rand(-3,3),z:s.z+rand(-2,3),y:0,yaw:0,model,state:'move',t:0,fireCd:rand(0.5,1.2),tgt:null,tc:0,mT:0,gait:'',up:''};
  model.spawn(a.x,0,a.z,0,1); if(model.setGear)model.setGear({vest:true,helmet:Math.random()<0.5}); allies.push(a); return a; }
function allyHit(a,dmg){ if(!a||a.state==='dead')return; a.hp-=dmg; a.hurtT=1.6; if(a.model.hitFlash)a.model.hitFlash(); if(a.hp<=0){ a.state='dead'; a.t=0; a.model.muzzle&&a.model.muzzle(false); a.model.playFull('death_back'); if(tdm){tdm.stats=tdm.stats||{pk:0,pd:0,ak:0,ad:0};tdm.stats.ad++;} if(tdm&&!tdm.ball&&!tdm.bomb)tdm.sc[1]++; msg('Colega abatido · '+(tdm?tdm.sc[0]+'–'+tdm.sc[1]:''),'#ff8a78',2); } }
let tdmForce=false;
function allyTargetFor(e){ const dP=Math.hypot(P.x-e.x,P.z-e.z); let best=null,bd=tdmForce?30:Math.min(30,dP*0.85); for(const a of allies){ if(a.state==='dead')continue; const d=Math.hypot(a.x-e.x,a.z-e.z); if(d<bd&&los(e.x,e.z,a.x,a.z)){bd=d;best=a;} } return best; }
function tdmPlayerDown(){ tdm.stats=tdm.stats||{pk:0,pd:0,ak:0,ad:0}; tdm.stats.pd++; if(tdm.bomb){ const B=tdm.bomb; if(B.st==='carry'&&B.carrier==='player'){ B.carrier='ground'; B.x=P.x; B.z=P.z; msg('Deixaste cair o petardo!','#ff8a78',2); } } else if(!tdm.ball)tdm.sc[1]++; else if(tdm.ball.st==='player'){ tdm.ball.st='ground'; tdm.ball.x=P.x; tdm.ball.z=P.z; tdm.ball.t=8; msg('Perdeste a bola!','#ff8a78',2); } P.hp=P.maxHp; P.armor=0; P.alive=true; const s=tdm.home||G.START; P.x=s.x; P.z=s.z; P.y=0; P.vy=0; hurtT=0; P.inv=2.5; msg('Caíste! Reapareces no centro · '+tdm.sc[0]+'–'+tdm.sc[1],'#ff8a78',3); sfx('whistle',0.4); }
function tdmSpawn(dt,alive){ tdm.t-=dt; if(tdm.ball)ballUpdate(dt); if(tdm.bomb){ bombUpdate(dt); if(tdm.bomb.st==='done')return; } if(P.inv>0)P.inv-=dt; tdm.spT-=dt; if(alive<5&&tdm.spT<=0){ tdm.spT=1.8; spawnEnemy(pick(['medio','medio','defesa','ponta','escudo'])); }
  let aliveA=0;for(let i=0;i<allies.length;i++)if(allies[i].state!=='dead')aliveA++; tdm.aT-=dt; if(aliveA<4&&tdm.aT<=0){ tdm.aT=4; spawnAlly(); }
  if(!tdm.bomb&&(tdm.t<=0||tdm.sc[0]>=tdm.goal||tdm.sc[1]>=tdm.goal)){ const w=tdm.sc[0]>tdm.sc[1]; if(w){ save.prog.money+=1500; runCash+=1500; } msg((w?'VITÓRIA! ':tdm.sc[0]<tdm.sc[1]?'DERROTA · ':'EMPATE · ')+tdm.sc[0]+'–'+tdm.sc[1],'#f2c94c',3); tdm.over=true; gameOver(); } }
/* adversários que não te veem mas veem um colega: viram-se e disparam contra ele */
function tdmEnemyPass(dt){ for(const e of enemies){ if(e.state==='dead'||e.state==='warm'||e.hasLos||e.T.perch)continue; tdmForce=true; const a=allyTargetFor(e); tdmForce=false; if(!a)continue;
    e.aimA=a; e.aimAT=gameT+0.8; e.afT=(e.afT===undefined?rand(0.3,0.9):e.afT)-dt; if(e.afT<=0){ e.afT=(e.T.interval||0.6)*rand(0.9,1.4); tdmForce=true; enemyFire(e,Math.hypot(a.x-e.x,a.z-e.z)); tdmForce=false; } } }
function tdmAllies(dt){ tdmEnemyPass(dt); for(let i=allies.length-1;i>=0;i--){ const a=allies[i]; updateAlly(a,dt); if(a.remove){ allies.splice(i,1); } } }
function updateAlly(a,dt){ const g=a.model.root;
  if(a.state==='dead'){ a.t+=dt; if(a.t>3.5&&!a.remove){ try{a.model.release();}catch(e){} a.remove=true; } return; }
  a.tc-=dt; if(a.tc<=0){ a.tc=0.35; let best=null,bd=38; for(const e of enemies){ if(e.state==='dead'||e.state==='warm')continue; const d=Math.hypot(e.x-a.x,e.z-a.z); if(d<bd&&los(a.x,a.z,e.x,e.z)){bd=d;best=e;} } a.tgt=best; }
  if(a.tgt&&a.tgt.state==='dead')a.tgt=null;
  const dp=Math.hypot(P.x-a.x,P.z-a.z); let mvx=0,mvz=0; if(a.hurtT>0)a.hurtT-=dt;
  const free=(x,z)=>{ const B=boxAt(Math.floor(x/S),Math.floor(z/S)); return !B; };
  // abrigo: levou tiros e tem alvo → ponto próximo sem linha de vista para o atirador
  if(a.tgt&&a.hurtT>0&&!a.cov){ let best=null,bd=1e9; for(let k=0;k<14;k++){ const an=k/14*TAU,r=2.5+(k%3)*1.6,x=a.x+Math.cos(an)*r,z=a.z+Math.sin(an)*r; if(!free(x,z))continue; if(los(x,z,a.tgt.x,a.tgt.z))continue; const d=Math.hypot(x-a.x,z-a.z); if(d<bd){bd=d;best={x,z,t:1.4};} } a.cov=best; }
  let ballGo=null; if(tdm&&tdm.ball){ const B=tdm.ball; if(B.st==='ally'&&B.holder===a)ballGo=ballGoal(); else if((B.st==='center'||B.st==='ground')){ const dA=Math.hypot(a.x-B.x,a.z-B.z),dP=Math.hypot(P.x-B.x,P.z-B.z); let nearest=true; for(const o of allies){ if(o!==a&&o.state!=='dead'&&Math.hypot(o.x-B.x,o.z-B.z)<dA){nearest=false;break;} } if(nearest&&(dA<dP||dP>10))ballGo={x:B.x,z:B.z}; } }
  if(ballGo){ const f=flowStepTo(a,ballGo); if(f){mvx=f.x;mvz=f.z;} a.cov=null; }
  else if(a.cov){ const dx=a.cov.x-a.x,dz=a.cov.z-a.z,dl=Math.hypot(dx,dz); if(dl>0.5){mvx=dx/dl;mvz=dz/dl;} else { a.cov.t-=dt; if(a.cov.t<=0)a.cov=null; } }
  else if(dp>12||(!a.tgt&&dp>9)){ const f=flowStep(a); if(f){mvx=f.x;mvz=f.z;} }
  else { // formação em leque à volta do jogador
    const idx=Math.max(0,allies.indexOf(a)),sl=[-1.0,1.0,-2.3,2.3][idx%4],gx=P.x-Math.sin(P.yaw+sl)*5,gz=P.z-Math.cos(P.yaw+sl)*5;
    if(free(gx,gz)&&!a.tgt){ const dx=gx-a.x,dz=gz-a.z,dl=Math.hypot(dx,dz); if(dl>1.2){mvx=dx/dl;mvz=dz/dl;} }
    else if(a.tgt){ a.stT=(a.stT||0)-dt; if(a.stT<=0){a.stT=rand(0.8,1.6);a.stD=Math.random()<0.5?-1:1;} const tx=a.tgt.x-a.x,tz=a.tgt.z-a.z,tl=Math.hypot(tx,tz)||1; mvx=-tz/tl*a.stD*0.6; mvz=tx/tl*a.stD*0.6; } }
  const sp=a.cov?3.8:3.3; a.x+=mvx*sp*dt; a.z+=mvz*sp*dt; collideCircle(a,0.4,0,true);
  let face=null; if(a.tgt)face=Math.atan2(-(a.tgt.x-a.x),-(a.tgt.z-a.z)); else if(mvx||mvz)face=Math.atan2(-mvx,-mvz);
  if(face!==null){ let dy=face-a.yaw; while(dy>Math.PI)dy-=TAU; while(dy<-Math.PI)dy+=TAU; a.yaw+=dy*Math.min(1,dt*7); }
  g.position.set(a.x,0,a.z); g.rotation.y=a.yaw;
  const moving=Math.hypot(mvx,mvz)>0.1,gait=moving?'jog':'idle'; if(gait!==a.gait){a.gait=gait;a.model.setLower(gait,0.3);} if(moving&&a.model.setGaitSpeed)a.model.setGaitSpeed(sp);
  const up=(a.tgt||moving)?'aim':'idle_upper'; if(up!==a.up){a.up=up;a.model.setUpper(up,0.25);}
  if(a.mT>0){a.mT-=dt;if(a.mT<=0&&a.model.muzzle)a.model.muzzle(false);}
  a.grenT=(a.grenT===undefined?rand(10,18):a.grenT)-dt;
  if(a.tgt&&a.grenT<=0){ const e=a.tgt,d=Math.hypot(e.x-a.x,e.z-a.z); let cl=0; for(const o of enemies){ if(o!==e&&o.state!=='dead'&&Math.hypot(o.x-e.x,o.z-e.z)<4.5)cl++; }
    if(d>7&&d<24&&(cl>=1||Math.random()<0.15)){ const dx=(e.x-a.x)/d,dz=(e.z-a.z)/d; throwGrenade(a.x+dx*0.6,1.5,a.z+dz*0.6,dx,0.42,dz,5.5+d*0.42,false); const gr=grenades[grenades.length-1]; if(gr){gr.ally=true;gr.dmg=75;gr.radius=4.2;} if(a.model.fireUpper)a.model.fireUpper('throw'); a.grenT=rand(20,28); } else a.grenT=3; }
  if(a.tgt){ a.fireCd-=dt; if(a.fireCd<=0){ a.fireCd=rand(0.35,0.75); const e=a.tgt,d=Math.hypot(e.x-a.x,e.z-a.z),chance=clamp(0.4-d/90,0.08,0.4);
      if(a.model.flash&&a.model.flash.getWorldPosition){ a.model.flash.getWorldPosition(_v1); tracerFX(_v1.x,_v1.y,_v1.z,e.x+rand(-0.3,0.3),(e.y||0)+1.3,e.z+rand(-0.3,0.3),0xffe0a0); }
      if(a.model.muzzle)a.model.muzzle(true); a.mT=0.06; if(a.model.fireUpper)a.model.fireUpper('shoot'); sfx('eshot',clamp(1-dp/60,0.08,0.5));
      if(Math.random()<chance){ e.lastAlly=gameT; hitEnemy(e,11,Math.random()<0.08,null,false); } } }
}
function enemyFire(e,d){
  const T=e.T;
  if(T.interval<0.6&&!e.burst){e.burst=3;}
  if(e.burst>0){e.burst--;e.fireCd=e.burst>0?0.09:T.interval*rand(1.2,1.8);}else e.fireCd=T.interval*rand(0.8,1.25);
  e.model.flash.getWorldPosition(_v1);const gx=_v1.x,gy=_v1.y,gz=_v1.z;
  e.model.fireUpper('shoot');
  const chance=(T.sniper||T.perch)?clamp((T.acc*1.35*(e.accMul||1)*(e.supT>0?0.6:1)-d/320-(P.moving>0.3?0.18:0)-(P.sprint?0.12:0))*diff.acc*adaptAcc(),0.15,0.9):clamp((T.acc*(e.accMul||1)*(e.supT>0?0.55:1)-d/75-(P.moving>0.3?0.1:0)-(P.sprint?0.08:0)-(P.y>0.2?0.08:0))*diff.acc*adaptAcc(),0.05,0.85);
  const hit=Math.random()<chance;
  const ally=tdm?allyTargetFor(e):null;if(ally){e.aimA=ally;e.aimAT=gameT+0.8;}let tx=ally?ally.x:P.x,ty=ally?1.35:1.4+P.y,tz=ally?ally.z:P.z;
  if(!hit){const a=Math.random()*TAU,rr=rand(0.8,2.2);tx+=Math.cos(a)*rr;tz+=Math.sin(a)*rr;ty+=rand(-0.6,0.8);}
  _v2.set(tx-gx,ty-gy,tz-gz);const len=_v2.length();_v2.normalize();
  const tw=rayWorld(_v1,_v2,len,HIT);
  const ex=gx+_v2.x*tw,ey=gy+_v2.y*tw,ez=gz+_v2.z*tw;
  tracerFX(gx,gy,gz,ex,ey,ez,0xffc070);
  if(tw<len){const bx=ex-_v2.x*0.15,by=ey-_v2.y*0.15,bz=ez-_v2.z*0.15;hitFX({x:bx,y:by,z:bz},false,HIT.mat);if(Math.random()<0.5&&inArena(bx,bz))placeDecal(bx,by,bz,HIT.nx,HIT.ny,HIT.nz);}
  else if(hit){if(ally)allyHit(ally,T.dmg*(e.dmgMul||1));else damagePlayer(T.dmg*(e.dmgMul||1),e);}
  e.model.muzzle(true);e.muzzleT=0.06;
  sfx('eshot',clamp(1-d/60,0.15,1));
}
/* ---- house navigation: enemies storm the house the player is in (doors, stairs, deck) and leave when the player leaves ---- */
function housePath(e,b,toDeck){
  if(!b||!b.wp)return [];
  const wp=b.wp,inside=e.x>=b.x0&&e.x<=b.x1&&e.z>=b.z0&&e.z<=b.z1,onDeck=inside&&e.y>2.5;
  const nearDoor=()=>Math.hypot(e.x-wp.doorS_out.x,e.z-wp.doorS_out.z)<=Math.hypot(e.x-wp.doorW_out.x,e.z-wp.doorW_out.z)?['doorS_out','doorS_in']:['doorW_out','doorW_in'];
  let path=[];
  if(onDeck)path=toDeck?['deck']:['stairTop','stairBottom','room'];
  else if(inside)path=toDeck?['stairBottom','stairTop','deck']:['room'];
  else path=nearDoor().concat(toDeck?['stairBottom','stairTop','deck']:['room']);
  return path.map(k=>wp[k]);
}
function houseExitPath(e,b){if(!b||!b.wp)return null;const wp=b.wp;const inside=e.x>=b.x0&&e.x<=b.x1&&e.z>=b.z0&&e.z<=b.z1;if(!inside)return null;const onDeck=e.y>2.5;const nearIn=Math.hypot(e.x-wp.doorS_in.x,e.z-wp.doorS_in.z)<=Math.hypot(e.x-wp.doorW_in.x,e.z-wp.doorW_in.z)?['doorS_in','doorS_out']:['doorW_in','doorW_out'];return (onDeck?['stairTop','stairBottom']:[]).concat(nearIn).map(k=>wp[k]);}
function navUpdate(e,dt){ // returns true when the enemy is being steered by waypoints this frame
  const pb=buildingAt(P.x,P.z),eb=buildingAt(e.x,e.z);
  e.navT=(e.navT||0)-dt;
  if(e.navT<=0){e.navT=0.5;
    if(eb&&pb!==eb&&!e.T.perch){const p=houseExitPath(e,eb);e.nav=p?{b:eb,key:'exit',path:p,i:0,exit:true}:null;}
    else if(pb&&(Math.hypot(P.x-e.x,P.z-e.z)<26||eb===pb)&&!e.T.perch){const toDeck=P.y>2.5;const key=pb.x0+':'+(toDeck?1:0);if(!e.nav||e.nav.key!==key||e.nav.b!==pb){e.nav={b:pb,key,path:housePath(e,pb,toDeck),i:0};}}
    else if(e.nav&&e.nav.b&&eb===e.nav.b){const p=houseExitPath(e,e.nav.b);e.nav=p?{b:e.nav.b,key:'exit',path:p,i:0,exit:true}:null;}
    else if(e.nav&&!eb)e.nav=null;
  }
  if(!e.nav)return false;
  const t=e.nav.path[e.nav.i];if(!t){e.nav=null;return false;}
  const dx=t.x-e.x,dz=t.z-e.z,d=Math.hypot(dx,dz);
  if(d<0.7){e.nav.i++;if(e.nav.i>=e.nav.path.length){if(e.nav.exit)e.nav=null;else e.nav.i=e.nav.path.length-1;}return true;}
  e.navDir={x:dx/d,z:dz/d};return true;
}
function updateEnemy(e,dt){
  const T=e.T,g=e.model.root;
  if(e.muzzleT>0){e.muzzleT-=dt;if(e.muzzleT<=0)e.model.muzzle(false);}
  if(e.flash>0)e.flash-=dt;
  if(e.state==='warm'){e.y=Math.max(0,e.y-14*dt);g.position.y=e.y;if(e.y<=0){e.state='move';puffSmoke(e.x,0.1,e.z,6,0x8a8478,0.4,1.5,0.9);}return;}
  if(e.state==='dead'){e.t+=dt;if(e.knock&&e.knock.t>0){const k=e.knock;k.t-=dt;e.x+=k.vx*dt;e.z+=k.vz*dt;k.vx*=0.88;k.vz*=0.88;collideCircle(e,0.4,e.y||0,!(e.nav||buildingAt(e.x,e.z)));g.position.set(e.x,e.y||0,e.z);}if(e.fly){const f=e.fly;e.x+=f.vx*dt;e.z+=f.vz*dt;f.vy-=14*dt;e.y=Math.max(0,(e.y||0)+f.vy*dt);f.vx*=0.98;f.vz*=0.98;collideCircle(e,0.4,0,true);if(e.y<=0&&f.vy<0){e.fly=null;e.y=0;puffSmoke(e.x,0.1,e.z,3,0x8a8478,0.4,1,0.8);}g.position.set(e.x,e.y,e.z);}if(e.t>3.0)g.position.y-=dt*0.7;if(e.t>4.4)removeEnemy(e);return;}
  const dx=P.x-e.x,dz=P.z-e.z,d=Math.hypot(dx,dz)||0.001;
  e.losT-=dt;if(e.losT<=0){e.losT=0.2;e.hasLos=los(e.x,e.z,P.x,P.z,(e.perchY||e.y||0)+1.5,P.y+1.5);if(!e.hasLos&&d<12){const bb=buildingAt(e.x,e.z);if(bb&&bb===buildingAt(P.x,P.z)&&Math.abs((P.y||0)-(e.y||0))<1.6)e.hasLos=true;}}
  if(e.hasLos)e.noLosT=0;else e.noLosT=(e.noLosT||0)+dt;
  if(e.grenT>0)e.grenT-=dt;
  if(e.state==='perch'){ // sniper on a tower/house deck: never moves, laser warning then a heavy shot
    e.yaw=Math.atan2(-dx,-dz);g.position.set(e.x,e.perchY,e.z);g.rotation.y=e.yaw;
    const canSee=e.hasLos&&d<T.range;
    if(canSee){e.aimT+=dt;if(e.upper!=='aim'){e.upper='aim';e.model.setUpper('aim');}if(!e.laser){const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);e.laser=new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xff2020,transparent:true,opacity:0.7}));scene.add(e.laser);}
      e.model.flash.getWorldPosition(_v1);const pos=e.laser.geometry.attributes.position;pos.setXYZ(0,_v1.x,_v1.y,_v1.z);pos.setXYZ(1,P.x,P.y+1.3,P.z);pos.needsUpdate=true;e.laser.visible=true;
      if(e.aimT>1.0&&!e.warned){e.warned=true;msg('Atirador a apontar!','#ff5555');}
      e.fireCd-=dt;if(e.fireCd<=0&&e.aimT>1.1){enemyFire(e,d);e.aimT=0;e.warned=false;}}
    else{e.aimT=0;e.warned=false;if(e.laser)e.laser.visible=false;if(e.upper!=='idle_upper'){e.upper='idle_upper';e.model.setUpper('idle_upper');}}
    if(e.gait!=='idle'){e.gait='idle';e.model.setLower('idle');}
    return;
  }
  if(T.boss){ // captain: aura heals nearby allies; phases at 60% and 30% health
    e.auraT=(e.auraT||0)-dt;if(e.auraT<=0){e.auraT=1;for(const o of enemies){if(o===e||o.state==='dead'||o.state==='warm')continue;if(Math.hypot(o.x-e.x,o.z-e.z)<8){o.hp=Math.min(o.maxHp,o.hp+4);}}
      if(!e.aura){e.aura=new THREE.Mesh(new THREE.RingGeometry(1.2,1.6,32),new THREE.MeshBasicMaterial({color:0xffb020,transparent:true,opacity:0.35,side:THREE.DoubleSide,depthWrite:false}));e.aura.rotation.x=-Math.PI/2;scene.add(e.aura);}}
    if(e.aura){e.aura.position.set(e.x,0.05,e.z);e.aura.scale.setScalar(1+0.15*Math.sin(gameT*4));}
    const frac=e.hp/e.maxHp,ph=frac>0.6?1:(frac>0.3?2:3);
    if(ph!==(e.phase||1)){e.phase=ph;if(ph===2){say(CAPTAINS[e.team.key]||captain(),(CAPTAINS[e.team.key]||captain()).phase2);sfx('siren');for(let i=0;i<3;i++)spawnEnemy('defesa');e.dmgMul=1.3;}
      else if(ph===3){say(CAPTAINS[e.team.key]||captain(),(CAPTAINS[e.team.key]||captain()).phase3);msg('Fúria: só headshots fazem dano total','#ff5555');sfx('siren');e.spdMul=1.35;e.bodyMul=0.35;e.dmgMul=1.5;e.model.hitFlash();}}
  }
  const inRange=d<T.range&&e.hasLos;
  let mvx=0,mvz=0;e.spdBoost=1;if(e.supT>0)e.supT-=dt;
  if(T.boss)bossMech(e,dt,d,dx,dz);
  if(e.stunT>0){e.stunT-=dt;if(Math.random()<dt*3)sparksAt(e.x,(e.y||0)+2.2*e.scale,e.z,3,0xffe066);}
  else if(e.state==='charge'){ // El Toro: raspa o chão e investe em linha reta
    e.chT-=dt;
    if(e.chPhase===0){if(Math.random()<dt*8)puffSmoke(e.x,0.1,e.z,1,0x8a8478,0.3,0.6,0.6);if(e.chT<=0){e.chPhase=1;e.chT=1.4;e.chX=dx/d;e.chZ=dz/d;e.chPrev=null;sfx('jump');}}
    else{e.spdBoost=3.4;mvx=e.chX;mvz=e.chZ;if(e.chPrev&&e.chT<1.25&&Math.hypot(e.x-e.chPrev[0],e.z-e.chPrev[1])<dt*1.5)e.chBump=true;e.chPrev=[e.x,e.z];
      if(d<1.5&&!e.chHit){e.chHit=true;damagePlayer(24*(e.dmgMul||1),e);P.x+=e.chX*2;P.z+=e.chZ*2;shake=Math.max(shake,5);}
      if(e.chT<=0||e.chBump){e.state='attack';if(e.chBump){e.stunT=1.8;msg('Olé! El Toro bateu com os cornos: está tonto!','#f2c94c');}}}
  }
  else if(e.state==='think'){e.thT-=dt;if(e.thT<=0)e.state='attack';}
  else if(e.state==='retreat'){e.rtT-=dt;mvx=-dx/d;mvz=-dz/d;e.spdBoost=1.25;if(e.rtT<=0){e.state='attack';e.hp=Math.min(e.maxHp,e.hp+e.maxHp*0.3);shout(e,'spray');for(let i=0;i<6;i++)puffSmoke(e.x,1.1,e.z,1,0xc8f0ff,0.3,0.6,0.7);}}
  else if(e.state==='flank'){ // médios/defesas contornam pela ala
    e.flT-=dt;const f=flowStep(e);const px=-dz/d*e.flSide,pz=dx/d*e.flSide;mvx=f.x*0.4+px;mvz=f.z*0.4+pz;
    if(e.hasLos&&d<T.range){e.fireCd-=dt;if(e.fireCd<=0){e.hasTok=canShoot(e);if(e.hasTok)enemyFire(e,d);}}
    if(e.flT<=0||d<9)e.state='attack';
  }
  else if(e.state==='cover'){ // abrigo: corre para trás do obstáculo, espera, espreita, dispara, volta
    const c=e.cv;c.t-=dt;
    if(c.ph==='go'){const ux=c.x-e.x,uz=c.z-e.z,ul=Math.hypot(ux,uz);if(ul<0.55){c.ph='hide';c.t=rand(0.9,1.8);if(Math.random()<0.45)e.model.fireUpper('reload');}else{mvx=ux/ul;mvz=uz/ul;e.spdBoost=1.25;}if(c.t<-4.5){e.state='attack';e.coverCd=gameT+3;}}
    else if(c.ph==='hide'){if(los(c.x,c.z,P.x,P.z,1.4,P.y+1.5)){e.state='attack';e.coverCd=gameT+1.2;}else if(c.t<=0){if(c.px!=null){c.ph='peek';c.t=rand(1.3,2.2);if(Math.random()<0.3)shout(e,'peek');}else{e.state='attack';e.coverCd=gameT+4;}}}
    else if(c.ph==='peek'){const ux=c.px-e.x,uz=c.pz-e.z,ul=Math.hypot(ux,uz);if(ul>0.35&&!e.hasLos){mvx=ux/ul;mvz=uz/ul;}
      if(e.hasLos&&d<T.range){e.fireCd-=dt;if(e.fireCd<=0){e.hasTok=canShoot(e);if(e.hasTok)enemyFire(e,d);}}
      if(c.t<=0){c.n++;if(c.n>=3||d<7){e.state='attack';e.coverCd=gameT+5;}else{c.ph='go';c.t=0;}}}
  }
  const navigating=navUpdate(e,dt);const mustNav=navigating&&e.nav&&e.navDir&&(Math.abs(P.y-(e.y||0))>1.5||e.nav.i<e.nav.path.length-1||e.nav.exit);
  if(e.state==='move'){
    if(inRange&&(!T.keep||d<=T.keep+6)){e.state='attack';e.strafeT=0;}
    else if(navigating){if(e.navDir){mvx=e.navDir.x;mvz=e.navDir.z;}}
    else{
      const cx=Math.floor(e.x/S),cz=Math.floor(e.z/S);let bestV=G.flow[cx+cz*G.MW],bx=cx,bz=cz;
      for(let ddz=-1;ddz<=1;ddz++)for(let ddx=-1;ddx<=1;ddx++){
        if(!ddx&&!ddz)continue;const nx=cx+ddx,nz=cz+ddz;
        if(nx<0||nz<0||nx>=G.MW||nz>=G.MH||G.BOX[nx+nz*G.MW])continue;
        if(ddx&&ddz&&(G.BOX[cx+ddx+cz*G.MW]||G.BOX[cx+(cz+ddz)*G.MW]))continue;
        const v=G.flow[nx+nz*G.MW];if(v>=0&&(bestV<0||v<bestV)){bestV=v;bx=nx;bz=nz;}
      }
      let tx=(bx+0.5)*S,tz=(bz+0.5)*S;if(bx===cx&&bz===cz){tx=P.x;tz=P.z;}
      const ux=tx-e.x,uz=tz-e.z,ul=Math.hypot(ux,uz)||1;mvx=ux/ul;mvz=uz/ul;
      if(d>8){const lx=-mvz*e.lane*0.35,lz=mvx*e.lane*0.35;mvx+=lx;mvz+=lz;}
      if(T.gren&&e.noLosT>3&&!(e.grenT>0)&&d>7&&d<26){e.grenT=rand(9,16);e.model.flash.getWorldPosition(_v1);const sp2=clamp(d*0.75,7,14);throwGrenade(_v1.x,_v1.y+0.3,_v1.z,dx/d,0.95,dz/d,sp2,false);msg('Granada por cima da cobertura!','#ff8a8a');shout(e,'gren');sfx('pin');}
    }
  }
  if(e.state==='attack'&&!(e.stunT>0)){
    if(!inRange)e.state='move';
    else if(tactics(e,d)){}
    else{
      e.fireCd-=dt;if(e.fireCd<=0){e.hasTok=canShoot(e);if(e.hasTok)enemyFire(e,d);}
      if(T.gren){e.grenT-=dt;if(e.grenT<=0&&d>5&&d<17){e.grenT=rand(11,20);e.model.flash.getWorldPosition(_v1);const sp=clamp(d*0.85,6,13);throwGrenade(_v1.x,_v1.y,_v1.z,dx/d,0.55,dz/d,sp,false);msg('Granada adversária!','#ff8a8a');shout(e,'gren');sfx('pin');}}
      e.strafeT-=dt;if(e.strafeT<=0){e.strafeT=rand(0.8,1.8);e.strafeDir=Math.random()<0.4?0:(Math.random()<0.5?-1:1);}
      if(e.strafeDir){mvx=-dz/d*e.strafeDir*0.6;mvz=dx/d*e.strafeDir*0.6;}
      if(mustNav){mvx=e.navDir.x*0.85;mvz=e.navDir.z*0.85;}
      else if(!T.keep&&d>T.range*0.6){mvx+=dx/d*0.5;mvz+=dz/d*0.5;}
      if(T.keep&&d<T.keep-6){mvx-=dx/d*0.7;mvz-=dz/d*0.7;}
    }
  }
  if(e.guardOf&&e.guardOf.state!=='dead'&&(e.state==='move'||e.state==='attack')){const b=e.guardOf,gx=b.x+(dx/d)*2.2+(e.gSide||1)*1.7*(-dz/d),gz=b.z+(dz/d)*2.2+(e.gSide||1)*1.7*(dx/d),ux=gx-e.x,uz=gz-e.z,ul=Math.hypot(ux,uz);if(ul>0.8){mvx=ux/ul;mvz=uz/ul;}else{mvx=mvz=0;}}
  if(e.dashT>0){mvx=e.dashX;mvz=e.dashZ;e.spdBoost=3.2;}
  if(e.stunT>0||e.state==='think'||(e.state==='charge'&&e.chPhase===0)){mvx=mvz=0;}
  if(!T.boss&&(e.state==='attack'||e.state==='flank'||(e.state==='cover'&&e.cv&&e.cv.ph==='peek'))&&e.state!=='charge')e.spdBoost=Math.min(e.spdBoost||1,2.4/Math.max(0.1,T.speed));
  if(e.limpT>0)e.limpT-=dt;
  const sp=T.speed*(1+(globalWave()-1)*0.012)*((mod&&mod.speed)||1)*(e.spdMul||1)*(e.limpT>0?0.5:1)*(e.spdBoost||1);let moved=false;
  { // smoothed velocity: enemies accelerate/decelerate instead of stopping dead
    let tx=0,tz=0;if(mvx||mvz){const ml=Math.hypot(mvx,mvz),m=Math.min(1,ml);tx=mvx/ml*m*sp;tz=mvz/ml*m*sp;}
    const k=Math.min(1,dt*(mvx||mvz?9:12));e.vx=(e.vx||0)+(tx-(e.vx||0))*k;e.vz=(e.vz||0)+(tz-(e.vz||0))*k;
    const vl=Math.hypot(e.vx,e.vz);if(vl>0.05){e.x+=e.vx*dt;e.z+=e.vz*dt;e.walk+=dt*vl*2.4;moved=true;if(!(mvx||mvz)){mvx=e.vx/vl;mvz=e.vz/vl;}}else{e.vx=e.vz=0;}
  }
  for(const o of enemies){if(o===e||o.state==='dead'||o.state==='warm')continue;const sx=e.x-o.x,sz=e.z-o.z,sd=Math.hypot(sx,sz),mn=(e.scale+o.scale)*0.8;if(sd>0.01&&sd<mn){const p=(mn-sd)*0.5;e.x+=sx/sd*p;e.z+=sz/sd*p;}}
  if(e.nav||buildingAt(e.x,e.z)){collideCircle(e,0.42*e.scale,e.y,false);const gnd=groundAt(e.x,e.z,e.y);e.y=e.y>gnd?Math.max(gnd,e.y-9*dt):gnd;}else{collideCircle(e,0.45*e.scale,0,true);e.y=0;}
  const faceP=e.state==='attack'||e.state==='think'||(e.state==='cover'&&e.cv&&e.cv.ph!=='go')||(e.state==='charge'&&e.chPhase===0)||(e.state==='flank'&&e.hasLos)||(e.hasLos&&d<9&&e.state!=='retreat');
  // pernas na direção do movimento, tronco rodado até ~75º para o jogador; a recuar, anda para trás virado para ele
  const wrapA=a=>Math.atan2(Math.sin(a),Math.cos(a)),aimYaw=(e.aimA&&e.aimAT>gameT&&e.aimA.state!=='dead')?Math.atan2(-(e.aimA.x-e.x),-(e.aimA.z-e.z)):Math.atan2(-(P.x-e.x),-(P.z-e.z)),movYaw=moved?Math.atan2(-mvx,-mvz):null;let back=false,ty=e.yaw;
  if(faceP){ if(movYaw!==null&&Math.hypot(e.vx||0,e.vz||0)>0.4){ const rel=wrapA(aimYaw-movYaw); if(Math.abs(rel)<=0.6)ty=movYaw; else if(Math.abs(rel)<=1.7)ty=wrapA(aimYaw-Math.sign(rel)*0.6); else{ty=aimYaw;back=true;} } else ty=aimYaw; }
  else if(movYaw!==null)ty=movYaw;
  let dy=wrapA(ty-e.yaw);e.yaw+=dy*Math.min(1,dt*6);
  e.back=back;e.twistT=faceP&&!back?Math.max(-0.6,Math.min(0.6,wrapA(aimYaw-e.yaw))):0;
  g.position.set(e.x,e.y||0,e.z);g.rotation.y=e.yaw;if(e.stag>0)e.stag-=dt;
  /* animation selection: lower = gait, upper = aim when attacking */
  /* measured ground speed (smoothed) drives the gait choice and the clip time scale, so feet keep pace with the ground */
  const mvd=Math.hypot(e.x-(e.px==null?e.x:e.px),e.z-(e.pz==null?e.z:e.pz))/Math.max(1e-3,dt);e.px=e.x;e.pz=e.z;e.spd=(e.spd||0)*0.75+Math.min(mvd,8)*0.25;
  let gait='idle';
  if(moved&&e.spd>0.25){const prev=e.gait;gait=prev==='sprint'?(e.spd<3.1?'jog':'sprint'):prev==='jog'?(e.spd>3.8?'sprint':(e.spd<1.75?'walk':'jog')):prev==='walk'?(e.spd>2.3?'jog':'walk'):(e.spd>3.6?'sprint':(e.spd>2.05?'jog':'walk'));if(e.back&&gait==='sprint')gait='jog';}
  if(gait!==e.gait){e.gait=gait;e.model.setLower(gait,0.3);}
  e.model.setGaitSpeed(e.spd,e.back?-1:1);e.model.twist=e.twistT||0;
  const up=(e.state==='attack'||e.state==='flank'||(e.state==='cover'&&e.cv&&e.cv.ph==='peek')||gait!=='idle')?'aim':(gait==='idle'?'idle_upper':(gait.startsWith('strafe')?'walk_upper':gait+'_upper'));if(up!==e.upper){e.upper=up;e.model.setUpper(up);}
}

/* ===================== Recolhas, mensagens, XP ===================== */
function spawnPickup(kind,x,z){
  const g=new THREE.Group();
  if(kind==='ammo'){g.add(new THREE.Mesh(boxGeo(0.5,0.32,0.36),M(0x6b7f2f,0.7)));const s=new THREE.Mesh(boxGeo(0.52,0.08,0.38),brassMat);s.position.y=0.05;g.add(s);}
  else{g.add(new THREE.Mesh(boxGeo(0.44,0.44,0.44),M(0xf2f2f2,0.5)));const red=M(0xd8202a,0.5);const c1=new THREE.Mesh(boxGeo(0.3,0.1,0.46),red),c2=new THREE.Mesh(boxGeo(0.1,0.3,0.46),red);g.add(c1);g.add(c2);}
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  g.position.set(x,0.5,z);scene.add(g);pickups.push({kind:kind,x:x,z:z,g:g,t:24});
}
function updatePickups(dt){
  for(const p of pickups){
    p.t-=dt;p.g.rotation.y+=dt*2;p.g.position.y=0.5+Math.sin(gameT*3+p.x)*0.1;
    if(Math.hypot(p.x-P.x,p.z-P.z)<1.5){
      p.t=0;
      if(p.kind==='ammo'){for(const k of ORDER)if(k!=='pistol')wst[k].reserve=Math.min(WEAPONS[k].reserve*2,wst[k].reserve+WEAPONS[k].mag*(B(k)==='ar'||B(k)==='smg'?2:1));msg('Munições recolhidas','#7fd7ff');}
      else{P.hp=Math.min(P.maxHp,P.hp+40);msg('+40 vida','#5fd35f');}
      sfx('pick');
    }
    if(p.t<=0)scene.remove(p.g);
  }
  pickups=pickups.filter(p=>p.t>0);
}
function msg(txt,col,t){msgs.push({txt:txt,col:col,t:Math.min(t||2.4,3.4)});if(msgs.length>4)msgs.shift();}
/* ===================== Narrativa: capitães, locutor, cartões, manchetes ===================== */
const playerName=()=>(save.prog.name||'PISTOLEIRO').toUpperCase();
const captain=()=>CAPTAINS[team.key]||CAPTAINS.esp;
let sayCd=0,announceCd=0,headSaid=false,lowSaid=false,tauntT=0,radioQ=[],radioT=0,chantT=18;
function say(cap,line){ if(!line)return; msg(cap.nome+': «'+line+'»','#ffb3b3',4.5); }
function announce(key,vars,force){ if(!force&&announceCd>0)return; const pool=ANNOUNCER[key]; if(!pool)return; announceCd=force?announceCd:3; msg('LOCUTOR: '+fill(pickLine(pool),vars||{}),'#cfd8e3',4.2); }
let cardQueue=[],cardDone=null,storyModelInst=null;
const _cf=new THREE.Vector3(),_cr=new THREE.Vector3(),_cu=new THREE.Vector3(0,1,0);
function storyModel(spec){ // place a dressed character 2.6 m in front of the camera, on the left, facing it
  storyModelHide(); if(!spec||!pool||!charTemplate)return;
  const m=pool.acquire(); if(!m)return; storyModelInst=m;
  camera.getWorldDirection(_cf); _cf.y=0; _cf.normalize(); _cr.crossVectors(_cf,_cu).normalize();
  const px=camera.position.x+_cf.x*2.5-_cr.x*1.7, pz=camera.position.z+_cf.z*2.5-_cr.z*1.7, py=camera.position.y-1.62;
  m.spawn(px,py,pz,Math.atan2(-(camera.position.x-px),-(camera.position.z-pz)),1);
  if(spec.who==='player'){ m.setColors(charTemplate.baseMaterials.Body.map,charTemplate.asset.kits.kit_player,0x2a1a0e); m.setNumber(texJersey(playerName())); m.setShield(false); m.setGear({}); }
  else { const tm=TEAMS.find(t=>t.key===spec.team)||team; const R=ROLES.capitao; dressEnemy(m,tm,R,{skin:pick(['light','tan','dark']),hair:pick([0x1a1a1a,0x3b2a1a,0x7a5a2a]),num:10}); m.setGear({vest:true,band:true}); m.root.scale.setScalar(1.12); }
  m.setLower(spec.pose==='walk'?'walk':'idle',0); m.setUpper(spec.pose==='aim'||spec.pose==='reload'?spec.pose:(spec.pose==='walk'?'walk_upper':'idle_upper'),0); m.setGaitSpeed(spec.pose==='walk'?1.5:0);
  if(m.rifle)m.rifle.visible=spec.rifle!==false;
  m.root.visible=true;
}
function storyModelHide(){ if(storyModelInst&&storyModelInst.rifle)storyModelInst.rifle.visible=true; if(storyModelInst){ storyModelInst.release(); storyModelInst=null; } }
let choicePending=null,tunnelChoose=null;
function showCards(cards,done,paper){ cardQueue=cards.slice(); cardDone=done||null; const el=$('card'); el.classList.toggle('paper',!!paper); nextCard(); }
function endTunnel(){const el=$('card');el.classList.remove('tunnel');const b=$('tunnelBox');if(b&&b.classList)b.classList.add('hidden');tunnelChoose=null;musicStop();}
function nextCard(){ const el=$('card');
  if(choicePending){const f=choicePending;choicePending=null;f('a');return;}
  if(el.classList.contains('tunnel'))endTunnel();
  $('cardChoices').classList.add('hidden');$('cardBtn').classList.remove('hidden');
  if(!cardQueue.length){ el.classList.add('hidden'); storyModelHide(); const d=cardDone; cardDone=null; if(d)d(); return; }
  const c=cardQueue.shift(); const art=$('cardArt'),pt=$('cardPt');
  const cb=$('cardBtn'); cb.disabled=!!c.lockBtn;
  if(c.paper!==undefined) el.classList.toggle('paper',!!c.paper);
  if(c.tunnel){ runTunnel(); return; }
  if(c.postcard){ storyModelHide(); el.classList.remove('withmodel'); el.classList.add('postcard'); if(art){art.src=sceneURL(c.postcard+(c.postcardWon?':won':''));art.classList.remove('hidden');} }
  else { el.classList.remove('postcard'); if(art){art.classList.add('hidden');art.removeAttribute('src');} if(c.portrait){storyModelHide();el.classList.remove('withmodel');} else { storyModel(c.model); el.classList.toggle('withmodel',!!c.model); } }
  if(c.portrait&&pt){ pt.src=portraitURL(c.portrait.key,c.portrait.mood); pt.classList.remove('hidden'); el.classList.add('withpt'); } else { if(pt)pt.classList.add('hidden'); el.classList.remove('withpt'); }
  $('cardKicker').textContent=c.kicker||''; $('cardTitle').textContent=c.title||''; $('cardSub').textContent=c.sub||''; $('cardBody').textContent=c.body||''; cb.textContent=c.btn||(cardQueue.length?'Continuar':'Jogar'); $('cardHint').textContent=c.hint||'';
  if(c.choice){ $('choiceA').textContent=c.a; $('choiceB').textContent=c.b; $('cardChoices').classList.remove('hidden'); cb.classList.add('hidden'); choicePending=(k)=>{ choicePending=null; if(c.onChoice)c.onChoice(k); nextCard(); }; }
  el.classList.remove('hidden'); }
$('choiceA').addEventListener('click',()=>{if(choicePending)choicePending('a');});
$('choiceB').addEventListener('click',()=>{if(choicePending)choicePending('b');});
function preMatchCards(){ return [{tunnel:true}]; }
function runTunnel(){ const el=$('card'),t=team,c=captain(),tl=TUNNEL[t.key]||TUNNEL.esp; storyModelHide();
  el.classList.remove('withmodel','postcard','withpt','paper'); el.classList.add('tunnel');
  const art=$('cardArt'); if(art)art.classList.add('hidden'); const pt=$('cardPt'); if(pt)pt.classList.add('hidden');
  $('tunnelBox').classList.remove('hidden'); $('tunBg').src=tunnelURL(t); $('tunHero').src=portraitURL('hero','neutral'); $('tunCap').src=portraitURL(t.key);
  $('tunHeroName').textContent=playerName();
  $('tunCapName').innerHTML=c.nome+(c.alcunha?' <em>«'+c.alcunha+'»</em>':'')+'<small>'+t.nome+' · '+t.estadio+'</small>';
  const bub=$('tunBubble'); const say=(who,txt)=>{ bub.className='bubble '+who; bub.textContent=txt; void bub.offsetWidth; bub.classList.add('pop'); };
  say('cap',pickLine(c.intro));
  $('tunA').innerHTML='<b>Humilde</b>«'+tl.humble[0]+'»<small>O público fica contigo · +15% dinheiro</small>'; $('tunB').innerHTML='<b>Provocador</b>«'+tl.cocky[0]+'»<small>Capitão +25% vida · +40% pontos</small>';
  for(const id of ['tunA','tunB']){ const b=$(id); b.classList.remove('picked','dropped'); b.style.animation='none'; void b.offsetWidth; b.style.animation=''; }
  $('tunChoices').classList.remove('hidden'); $('tunGo').classList.add('hidden'); $('tunEffect').classList.add('hidden');
  musicPlay('tunnel');
  tunnelChoose=(k)=>{ tunnelChoose=null; runMods=k==='humble'?{money:1.15,score:1,bossHp:1}:{money:1,score:1.4,bossHp:1.25}; $(k==='humble'?'tunA':'tunB').classList.add('picked'); $(k==='humble'?'tunB':'tunA').classList.add('dropped'); sfx('pick',0.5);
    setTimeout(()=>{ if(!el.classList.contains('tunnel'))return; $('tunChoices').classList.add('hidden'); say('hero',tl[k][0]); },480);
    setTimeout(()=>{ if(!el.classList.contains('tunnel'))return; say('cap',tl[k][1]); $('tunCap').src=portraitURL(t.key,k==='humble'?'smug':'angry'); const e=$('tunEffect'); e.textContent=k==='humble'?'O público está contigo · +15% dinheiro neste jogo':'O capitão vem furioso · +25% vida do capitão · +40% pontos'; e.className='eff '+k; $('tunGo').classList.remove('hidden'); if(k==='cocky')sfx('whistle',0.5); },1600); };
  el.classList.remove('hidden'); }
$('tunA').addEventListener('click',()=>{if(tunnelChoose)tunnelChoose('humble');});
$('tunB').addEventListener('click',()=>{if(tunnelChoose)tunnelChoose('cocky');});
$('tunGo').addEventListener('click',()=>nextCard());
function savePaper(card,key){ save.prog.papers=save.prog.papers||[]; const rec={key,kicker:card.kicker,title:card.title,sub:card.sub,body:card.body}; const k=save.prog.papers.findIndex(p=>p.key===key); if(k>=0)save.prog.papers[k]=rec; else save.prog.papers.push(rec); persist(); }
function victoryCards(i){ const t=TEAMS[i]; if(t.final)return endingCards(); const c=CAPTAINS[t.key]||captain(); const hc=Object.assign(headlineCard('win'),{paper:true,btn:'Continuar'}); savePaper(hc,t.key); const cards=[hc]; const ch=CHAPTERS[t.key];
  if(ch&&ch.clue)cards.push({paper:false,portrait:{key:t.key,mood:'defeated'},kicker:'Pista',title:c.nome.toUpperCase()+' FALA',body:'«'+ch.clue+'»',btn:'Continuar'});
  if(ch&&ch.memory)cards.push({paper:false,portrait:{key:'hero',mood:'happy'},kicker:'Memória · Capítulo '+ch.n,title:ch.title.toUpperCase(),body:ch.memory,btn:'Ver o mapa'});
  if(t.extra&&EVIDENCE[t.key]){ const n=Object.keys(save.prog.evidence||{}).length; cards.push({paper:false,portrait:{key:t.key,mood:'defeated'},kicker:'Prova '+n+'/5 · encontrada no balneário',title:EVIDENCE[t.key].nome.toUpperCase(),body:EVIDENCE[t.key].desc+(n>=5?' Tens as cinco provas: volta ao iate do Nabo para o final verdadeiro.':''),btn:'Ver o mapa'}); }
  return cards; }
function endingCards(){ const ev=Object.keys(save.prog.evidence||{}).length; const P=o=>Object.assign({paper:true,kicker:'O Apito Final · edição especial',btn:'Continuar'},o);
  if(ev<5){ const e=ENDINGS.partial; const card=P({title:e.h,sub:e.s,body:e.body}); savePaper(card,'cft'); return [card,{paper:false,portrait:{key:'cft',mood:'smug'},kicker:'Final incompleto',title:'FALTAM '+(5-ev)+' PROVAS',body:'O Nabo escapou por falta de provas. Cada jogo extra do mapa esconde uma: com as cinco, volta ao iate para o final verdadeiro.',btn:'Ver o mapa'}]; }
  const e=ENDINGS.true; const card=P({title:e.h,sub:e.s,body:e.body}); savePaper(card,'cft');
  return [card,{paper:false,portrait:{key:'cft',mood:'defeated'},kicker:'Final verdadeiro',title:'A BOLA É TUA',body:'No cofre do iate, entre envelopes e contratos, está a última bola oficial do mundo. Tens a pistola numa mão e a bola na outra.',btn:'Continuar'},
    {paper:false,portrait:{key:'hero',mood:'neutral'},kicker:'A escolha',title:'O QUE FAZES COM A BOLA?',body:'Foste o maior goleador. Agora és o maior pistoleiro. Só podes ser um.',choice:true,a:'Devolver a bola ao futebol',b:'Guardá-la e continuar a disparar',
     onChoice:k=>{ save.prog.endingChoice=k==='a'?'ball':'gun'; save.prog.trueEnding=true; persist(); const E=k==='a'?ENDINGS.ball:ENDINGS.gun; cardQueue.unshift(k==='a'?{paper:false,postcard:'ilha',postcardWon:true,kicker:'Epílogo',title:E.title,sub:E.body,btn:'Ver o mapa'}:{paper:false,portrait:{key:'hero',mood:'smug'},kicker:'Epílogo',title:E.title,body:E.body,btn:'Ver o mapa'}); }}]; }
/* ---------- música chiptune (volume baixo) ---------- */
const MUSIC={map:{bpm:132,steps:[[72,48],[0,0],[76,55],[0,0],[79,48],[0,0],[76,55],[77,0],[79,53],[0,0],[81,60],[79,53],[77,0],[0,60],[76,53],[74,0],[72,48],[0,0],[76,55],[0,0],[79,48],[0,0],[84,55],[0,0],[83,55],[81,0],[79,62],[77,0],[76,55],[0,0],[74,50],[0,0]]},
 tunnel:{bpm:92,steps:[[57,45],[0,0],[0,45],[0,0],[58,46],[0,0],[0,46],[0,0],[57,45],[0,0],[0,45],[0,0],[55,43],[0,0],[53,41],[0,0]]},
 win:{bpm:150,once:true,steps:[[72,48],[76,0],[79,55],[84,0],[0,60],[79,0],[84,48],[0,0],[88,60],[0,0],[0,0],[0,0]]}};
let musicT=null,musicOn=null,musicStep=0,musicNext=0,musicGain=null,mNoiseBuf=null;
function mNote(m,t,d,type,v){const o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.value=440*Math.pow(2,(m-69)/12);g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(v,t+0.01);g.gain.exponentialRampToValueAtTime(0.0001,t+d);o.connect(g);g.connect(musicGain);o.start(t);o.stop(t+d+0.03);}
function mHat(t,v){if(!mNoiseBuf){mNoiseBuf=AC.createBuffer(1,2205,44100);const d=mNoiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,3);}const b=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain();b.buffer=mNoiseBuf;f.type="highpass";f.frequency.value=6000;g.gain.value=v;b.connect(f);f.connect(g);g.connect(musicGain);b.start(t);}
function musicPlay(name){ if(musicOn===name)return; musicStop(); try{ if(!AC||!AC.createOscillator||save.settings.sound===false)return; const M=MUSIC[name]; if(!M)return; musicOn=name; musicStep=0; musicNext=AC.currentTime+0.06; musicGain=AC.createGain(); musicGain.gain.value=name==='win'?0.07:0.045; musicGain.connect(AC.destination); const spb=60/M.bpm/2;
  musicT=setInterval(()=>{ try{ while(musicGain&&musicNext<AC.currentTime+0.25){ const st=M.steps[musicStep%M.steps.length],t=musicNext; if(st[0])mNote(st[0],t,spb*0.9,'square',0.5); if(st[1])mNote(st[1],t,spb*1.8,'triangle',0.9); if(musicStep%2===0)mHat(t,0.18); musicStep++; musicNext+=spb; if(M.once&&musicStep>=M.steps.length){ const n=musicOn; setTimeout(()=>{ if(musicOn===n)musicStop(); },700); break; } } }catch(e){ musicStop(); } },60); }catch(e){ musicOn=null; } }
function musicStop(){ if(musicT){clearInterval(musicT);musicT=null;} if(musicGain){ const g=musicGain; musicGain=null; try{ g.gain.setTargetAtTime(0,AC.currentTime,0.08); }catch(e){} setTimeout(()=>{ try{g.disconnect();}catch(e){} },500); } musicOn=null; }
function postcardCard(){ return postcardFor(levelIdx); }
function arrivalCards(){ save.prog.seenArr=save.prog.seenArr||{}; if(save.prog.seenArr[team.key])return []; save.prog.seenArr[team.key]=1; return [postcardCard(),captainCard()]; } // cartões de chegada só na 1.ª vez em cada país
function captainCard(){ const c=captain(); return {model:{who:'captain',team:team.key,pose:'aim'},kicker:'Jogo '+(levelIdx+1)+' de 5 · '+team.estadio,title:c.nome+' · '+c.alcunha,sub:team.nome,body:c.bio+'\n\n«'+pickLine(c.intro)+'»',btn:'Entrar em campo',hint:team.desc}; }
function headlineCard(kind,vars){ const t=pickLine(HEADLINES[kind]); const v=Object.assign({p:playerName(),team:team.nome.toUpperCase(),b:captain().nome.toUpperCase(),est:team.estadio.toUpperCase(),kills,head,w:wave},vars||{}); return {kicker:PAPER+' · edição da noite',title:fill(t.h,v),sub:fill(t.s,v),body:fill(paperBody(kind),v),btn:kind==='over'?'Fechar o jornal':'Próximo jogo'}; }
function paperBody(kind){ const c=captain(); if(kind==='win') return 'Em '+team.estadio+', {p} enfrentou '+team.nome+' e saiu de campo com {kills} eliminações, {head} delas na cabeça, e '+runCash.toLocaleString('pt-PT')+' € em prémios que a '+'CFT'+' descreve como «ajudas de custo». O capitão '+c.nome+', '+c.alcunha.toLowerCase()+', deixou o relvado em silêncio; as suas últimas palavras terão sido: «'+c.death+'» O presidente '+PRESIDENT+' não respondeu às perguntas e saiu pela porta das traseiras, como é hábito.'; if(kind==='over') return 'A partida em '+team.estadio+' terminou na onda {w} com {p} a ser retirado de campo depois de {kills} eliminações. A '+'CFT'+' classificou a jornada como «um sucesso de organização». '+c.nome+' declarou: «'+pickLine(c.taunts)+'» A claque mantém o pedido de reembolso.'; return 'Cinco estádios, cinco capitães. A Taça de Todos os Tiros tem finalmente um vencedor, e a '+'CFT'+' tem finalmente um problema: '+PRESIDENT+' desapareceu com o troféu, com os 40 milhões e com o guião da conferência de imprensa.'; }
function storyBeforeGame(opts){ opts=opts||{}; if(opts.quick)return Promise.resolve(); return new Promise(res=>{ const cards=[]; if(!save.prog.seenPrologue){ for(const c of PROLOGUE) cards.push(Object.assign({kicker:'Prólogo'},c)); save.prog.seenPrologue=true; persist(); } if(!opts.skipPostcard) cards.push(postcardCard()); cards.push(...(typeof preMatchCards==='function'?preMatchCards():[captainCard()])); showCards(cards,res,false); }); }
function radioPlay(vars){ const ex=pickLine(RADIO); radioQ=ex.map(l=>[l[0],fill(l[1],vars)]); radioT=1.2; }
function radioUpdate(dt){ if(!radioQ.length)return; radioT-=dt; if(radioT<=0){ const [who,line]=radioQ.shift(); msg('RÁDIO · '+who+': '+line,'#ffe0a0',3.6); radioT=2.6; } }
function chantUpdate(dt){ chantT-=dt; if(chantT<=0){ chantT=rand(35,60); if(mode==='play'&&!clearing){ msg('PÚBLICO: «'+fill(pickLine(CHANTS),{p:playerName()})+'»','#a8ffb0',3.5); crowdSwell(); } } }
let ambGain=null;function crowdSwell(){ try{ if(ambGain){ const t=AC.currentTime; ambGain.gain.cancelScheduledValues(t); ambGain.gain.setValueAtTime(ambGain.gain.value,t); ambGain.gain.linearRampToValueAtTime(0.5,t+0.6); ambGain.gain.linearRampToValueAtTime(0.22,t+3.2); } }catch(e){} }
function bossTaunts(dt){ const b=enemies.find(e=>e.T.boss&&e.state!=='dead'&&e.state!=='warm'); if(!b)return; tauntT-=dt; if(tauntT<=0){ tauntT=rand(14,22); if(b.hasLos) say(captain(),pickLine(captain().taunts)); } }
function addXP(n){save.prog.xp+=n;let up=false;while(save.prog.xp>=xpFor(save.prog.level)){save.prog.xp-=xpFor(save.prog.level);save.prog.level++;up=true;const nw=ORDER.find(k=>WEAPONS[k].lvl===save.prog.level);msg('Nível '+save.prog.level+'!'+(nw?' Desbloqueaste: '+WEAPONS[nw].nome:''),'#f2c94c');if(nw&&mode==='play'){wst[nw]={mag:magOf(nw),reserve:WEAPONS[nw].reserve};}}if(up){sfx('lvl');persist();}}

/* ===================== Campanha ===================== */
let objDone=0,bossSpawnT=0,bossKillT=0;
function starsFor(){let st=1;if(objDone>0)st++;if(bossKillT>0&&bossKillT-bossSpawnT<60)st++;return st;}
function awardStars(){const st=starsFor();save.prog.stars=save.prog.stars||{};save.prog.stars[team.key]=Math.max(save.prog.stars[team.key]||0,st);if(save.prog.fails)save.prog.fails[team.key]=0;persist();return st;}
let levelEnded=false,victoryT=0,victoryGo=null,runMods={money:1,score:1,bossHp:1};
function levelDone(){try{ if(!quickRun&&!team.extra){ save.prog.cp=save.prog.cp||{}; const nk=String(levelIdx+1); if(!save.prog.cp[nk])save.prog.cp[nk]=snapLoadout(); } }catch(e){} // vitória: jornal, depois volta ao mapa com a sequência de recompensa
  const st=awardStars();const i=levelIdx,t=team;levelEnded=true;clearT=999;
  const before=save.prog.unlocked||0;let newNode=null,extrasOpened=false,evidence=null;
  if(t.extra){save.prog.extraDone=save.prog.extraDone||{};save.prog.extraDone[t.key]=true;save.prog.evidence=save.prog.evidence||{};if(!save.prog.evidence[t.key]){save.prog.evidence[t.key]=true;evidence=(typeof EVIDENCE!=='undefined'&&EVIDENCE[t.key])?EVIDENCE[t.key].nome:t.nome;}}
  else if(t.final){save.prog.champion=true;}
  else{save.prog.unlocked=Math.max(before,i+1);if(save.prog.unlocked>before){newNode=(i+1<MAIN)?i+1:(FINAL_IDX>=0?FINAL_IDX:null);if(before<2&&save.prog.unlocked>=2)extrasOpened=true;}}
  const prize=Math.round((t.final?3000:(t.extra?1500:1000))*econ());save.prog.money+=prize;runCash+=prize;persist();
  banner={txt:t.final?'O NABO CAIU!':'VITÓRIA',sub:t.nome+' · '+'★'.repeat(st)+'☆'.repeat(3-st)+' · +'+prize+' €',t:4.5};confetti(t.final?260:160);sfx('cheer',1);if(t.final){fireworksT=9;sfx('anthem');}
  victoryT=3;victoryGo=()=>{if(mode!=='play')return;mode='story';uiEl.classList.remove('on');musicPlay('win');
    const cards=(typeof victoryCards==='function')?victoryCards(i):[headlineCard(t.final?'champion':'win')];
    showCards(cards,async()=>{await iris(true);await toMenu();openWorldMap({reward:{won:i,stars:st,newNode,extrasOpened,evidence}});await iris(false);},!t.final);};
}
async function advanceLevel(){
  for(const e of enemies)removeEnemy(e);enemies=[];fireTok=[];for(const b of blasts)scene.remove(b.m);blasts.length=0;for(const b of bubbles){b.t=0;b.sp.visible=false;}for(const p of pickups)scene.remove(p.g);pickups=[];for(const g of grenades)scene.remove(g.m);grenades=[];for(const b of bombs)scene.remove(b.m);bombs=[];
  mode='story';uiEl.classList.remove('on');await new Promise(res=>showCards([headlineCard('win')],res,true));
  mode='loading';await loadLevel(levelIdx+1);clearDecals();
  P.x=G.START.x;P.z=G.START.z;P.y=0;P.vy=0;P.hp=P.maxHp;P.gren=Math.min(4,P.gren+2);flowCx=-1;
  for(const k of ORDER)if(k!=='pistol'){wst[k].reserve=Math.max(wst[k].reserve,WEAPONS[k].reserve);wst[k].mag=magOf(k);}reloading=0;
  msg((team.final?'Final':(team.extra?'Jogo extra':'Jogo '+(levelIdx+1)+' de '+MAIN))+': '+team.nome+' · '+team.estadio,'#f2c94c');
  mode='story';await new Promise(res=>showCards(arrivalCards(),res,false));mode='play';uiEl.classList.add('on');
  ambientOff();ambientOn();wave=0;startWave(1);
}

/* ===================== Níveis ===================== */
async function loadLevel(idx){
  worldReady=false;levelIdx=idx;team=TEAMS[idx];theme=team.theme;$('loading').style.display='flex';{const le=$('loading'),ls=le&&le.querySelector('small');if(ls)ls.textContent='A CARREGAR '+team.estadio.toUpperCase()+'…';else if(le)le.textContent='A CARREGAR '+team.estadio.toUpperCase()+'…';}
  await worldBuilder.build(idx,Q,{scoreTex});buildMini();drawScoreboard();
  postMat.uniforms.uExp.value=theme.exp;renderer.toneMappingExposure=theme.exp;
  $('loading').style.display='none';worldReady=true;
}
/* ===================== Ciclo de jogo ===================== */
function update(dt){
  gameT+=dt;
  let mx=0,mz=0;
  if(joy.active){mx=joy.vx;mz=-joy.vy;}
  else{if(keys.w||keys.arrowup)mz+=1;if(keys.s||keys.arrowdown)mz-=1;if(keys.d||keys.arrowright)mx+=1;if(keys.a||keys.arrowleft)mx-=1;}
  let ml=Math.hypot(mx,mz);if(ml>1){mx/=ml;mz/=ml;ml=1;}
  P.sprint=!ads&&ml>0.85&&mz>0.5&&(joy.active?true:!!keys.shift);
  const spd=(P.sprint?7.2:4.6)*(ads?0.6:1)*(1+0.08*(save.prog.up.speed||0));
  const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw),rx=Math.cos(P.yaw),rz=-Math.sin(P.yaw);
  const lad=P.mantle?null:ladderAt(P.x,P.z,P.y);
  const facingWall=fz<0,climbIn=mz>0.2?(facingWall?1:-1):(mz<-0.2?(facingWall?-1:1):0);
  if(P.mantle){ // a subir para cima de uma estrutura
    const m=P.mantle;m.t+=dt;const u=Math.min(1,m.t/m.dur),up=Math.min(1,u/0.62),fw=u<0.55?0:(u-0.55)/0.45;
    P.y=m.y0+(m.y1-m.y0)*(1-Math.pow(1-up,2));P.x=m.x0+(m.x1-m.x0)*fw;P.z=m.z0+(m.z1-m.z0)*fw;
    if(u>=1){P.y=m.y1;P.vy=0;P.onGround=true;P.mantle=null;}
    P.moving=0;P.sprint=false;
  }else if(lad&&!(P.y<=0.03&&climbIn<0)){ // escada: o sentido depende de estares virado para a parede; do topo avanças e desces
    P.onLadder=true;const climb=climbIn;P.vy=climb*2.8;P.y=Math.min(lad.top,Math.max(0,P.y+P.vy*dt));P.x+=(lad.cx-P.x)*Math.min(1,dt*8);P.z+=(lad.z0+0.35-P.z)*Math.min(1,dt*8);
    if(climb>0&&P.y>=lad.top-0.05){P.y=lad.top;P.z=lad.exitZ;P.vy=0;P.onGround=true;P.onLadder=false;}
    P.moving=0;P.sprint=false;
  }else{
    P.onLadder=false;
    P.x+=(fx*mz+rx*mx)*spd*dt;P.z+=(fz*mz+rz*mx)*spd*dt;collideCircle(P,0.4,P.y);
    const gnd=groundAt(P.x,P.z,P.y);P.vy-=16*dt;P.y+=P.vy*dt;if(P.y<=gnd){if(P.vy<-4)shake=Math.max(shake,1.5);P.y=gnd;P.vy=0;P.onGround=true;}else P.onGround=P.y-gnd<0.05;
  }
  P.moving=ml;const prevBob=P.bob;P.bob+=dt*(P.sprint?13:9)*ml*(P.y>0?0:1);
  if(Math.floor(prevBob/Math.PI)!==Math.floor(P.bob/Math.PI)&&ml>0.3&&gameT-(P.lastStep||0)>(P.sprint?0.36:0.48)){P.lastStep=gameT;sfx('step',P.sprint?0.8:0.5);puffSmoke(P.x-fx*0.3,0.08,P.z-fz*0.3,P.sprint?3:1,theme.weather==='rain'?0x6a7a5a:0x8a8a6a,0.12,0.5,0.5);}
  if(theme.weather==='rain'){for(let i=0;i<6;i++){const a=Math.random()*TAU,r=rand(1,16);emit(smokePS,P.x+Math.cos(a)*r,rand(5,9),P.z+Math.sin(a)*r,{vx:rand(-0.6,0.6),vy:-rand(11,15),vz:rand(-0.6,0.6),life:1.1,size:rand(0.03,0.05),col:0xc9d6e6,a:0.55,drag:1,grav:0,die:true});}}
  ambT-=dt;if(ambT<=0){ambT=rand(9,24);sfx('boom',rand(0.06,0.16));}
  P.roll+=((-mx*0.02)-P.roll)*Math.min(1,dt*6);const scoped=ads&&WEAPONS[cur].scope,swY=scoped?Math.sin(gameT*1.1)*0.004:0,swX=scoped?Math.cos(gameT*0.8)*0.003:0;
  camera.position.set(P.x,1.6+P.y+Math.sin(P.bob)*0.035*ml,P.z);camera.rotation.set(P.pitch+swX,P.yaw+swY,P.roll+(shake>0?(Math.random()-0.5)*shake*0.01:0));
  if(shake>0){camera.position.x+=(Math.random()-0.5)*shake*0.02;camera.position.y+=(Math.random()-0.5)*shake*0.02;}
  const yawV=(P.yaw-(P.prevYaw||P.yaw))/Math.max(dt,0.001);P.prevYaw=P.yaw;vmSway+=(clamp(yawV*0.004,-0.05,0.05)-vmSway)*Math.min(1,dt*8);
  const pitV=(P.pitch-(P.prevPitch||P.pitch))/Math.max(dt,0.001);P.prevPitch=P.pitch;vmSwayY+=(clamp(pitV*0.003,-0.04,0.04)-vmSwayY)*Math.min(1,dt*8);
  if(gameT-P.lastHit>4&&P.hp<P.maxHp)P.hp=Math.min(P.maxHp,P.hp+18*dt);
  flowT-=dt;const _ft=flowTarget(),pcx=Math.floor(_ft.x/S),pcz=Math.floor(_ft.z/S);
  if(flowT<=0||pcx!==flowCx||pcz!==flowCz){flowT=0.35;flowCx=pcx;flowCz=pcz;computeFlow(pcx,pcz);}
  /* armas */
  fireCd-=dt;muzzleT-=dt;recoilK*=Math.exp(-12*dt);
  if(switching>0){switching-=dt;if(nextWeapon&&switching<=0.28){cur=nextWeapon;nextWeapon=null;for(const j of ORDER)views[j].group.visible=(j===cur);}}
  if(reloading>0){reloading-=dt;if(reloading<=0){const st=wst[cur],take=Math.min(magOf(cur)-st.mag,st.reserve);st.mag+=take;if(st.reserve!==Infinity)st.reserve-=take;sfx('reload2');}}
  if(reloadAt&&gameT>=reloadAt){reloadAt=0;if(wst[cur].mag===0)reload();}
  const w=WEAPONS[cur];
  let want=fireHeld;if(!w.auto&&fireHeld&&firePrev)want=false;firePrev=fireHeld;
  aimOnEnemy=false;assistUpdate(dt);
  {const d=camDir(),he=rayEnemies(camera.position,d,w.range,enemies);if(he&&rayWorld(camera.position,d,he.t)>=he.t){aimOnEnemy=true;const eff=(B(cur)==='sniper')?(ads?w.range:0):(B(cur)==='shotgun'?(w.falloff?w.falloff[1]*1.15:w.range):(w.falloff?w.falloff[1]*1.6:w.range));if(!want&&save.settings.auto&&isTouch&&reloading<=0&&wst[cur].mag>0&&he.t<=eff)want=true;}}
  if(want&&fireCd<=0&&reloading<=0&&switching<=0)fire();
  const fovT=ads?(w.adsFov-(att().sight?4:0))*baseFov/78:(P.sprint?baseFov+6:baseFov);const adsRate=(1/Math.max(0.08,(w.adsTime||0.25)*wAdsMul(cur)*(att().stock?0.8:1)))*2.2;camera.fov+=(fovT-camera.fov)*(1-Math.exp(-adsRate*dt));if(fovPunch>0){fovPunch=Math.max(0,fovPunch-dt*16);}camera.fov-=fovPunch*(1-Math.exp(-30*dt))*0.35;camera.updateProjectionMatrix();updatePointScale();
  updateViewmodel(dt);
  /* killstreak */
  if(streakT>0){streakT-=dt;if(streakT<=0){streak=0;}}
  if(uavT>0)uavT-=dt;
  if(airT>0){airT-=dt;if(airT<=0)dropBombs();}
  /* ondas e campanha */
  let alive=0;for(let i=0;i<enemies.length;i++)if(enemies[i].state!=='dead')alive++;
  if(tdm){if(!tdm.over)tdmSpawn(dt,alive);}
  else if(toSpawn>0){spawnT-=dt;if(spawnT<=0&&alive<Q.enemiesMax){spawnT=spawnInt;spawnEnemy(pickRole(),endless?pick(TEAMS):null);toSpawn--;}}
  else if(alive===0){
    if(!clearing){clearing=true;clearT=12;if(!pendingAdvance){announce('clear',{},true);radioPlay({p:playerName(),kills,b:captain().nome,n:globalWave()+1});}const bonus=globalWave()*100,cash=Math.round(globalWave()*60*((mod&&mod.money)||1)*econ());score+=bonus;addXP(globalWave()*20);xpGained+=globalWave()*20;save.prog.money+=cash;runCash+=cash;msg('Onda '+wave+' concluída  +'+bonus+'  +'+cash+' €  (+'+(globalWave()*20)+' XP)','#f2c94c');if(wave===5&&!endless)levelDone();}
    else{clearT-=dt;if(clearT<=0){clearing=false;if(pendingAdvance){pendingAdvance=false;advanceLevel();return;}else startWave(wave+1);}}
  }
  for(const e of enemies)updateEnemy(e,dt);if(tdm)tdmAllies(dt);updateBubbles(dt);updateBlasts(dt);updateSentries(dt);ambientUpdate(dt);updateFlying(dt);taUpdate(dt);tutUpdate(dt);
  { const f=(Math.floor(gameT*(streakT>0?3.2:1.3))%2)*0.5; for(const t of CROWD_TEX) t.offset.y=f; }
  {let rm=false;for(let i=0;i<enemies.length;i++)if(enemies[i].remove){rm=true;break;}if(rm)enemies=enemies.filter(e=>!e.remove);}pool.update(dt,camera.position,Q.lodBias);
  if(victoryGo){victoryT-=dt;if(victoryT<=0){const g=victoryGo;victoryGo=null;g();return;}}
  if(announceCd>0)announceCd-=dt;if(sayCd>0)sayCd-=dt;bossTaunts(dt);radioUpdate(dt);chantUpdate(dt);
  if(patT>0){patT-=dt;if(patT<=0)patIdx=0;}if(recoilAcc>0&&!fireHeld){const rec=Math.min(recoilAcc,dt*1.6);P.pitch-=rec;recoilAcc-=rec;}
  if(P.sprint)sprintOutT=(WEAPONS[cur].sprintOut||0.25);else if(sprintOutT>0)sprintOutT-=dt;if(P.hp<30&&!lowSaid){lowSaid=true;announce('lowhp',{},true);}
  updatePickups(dt);updateGrenades(dt);updateRockets(dt);updateTurrets(dt);objUpdate(dt);evtUpdate(dt);updateFX(dt);
  scoreT-=dt;if(scoreT<=0){scoreT=1;drawScoreboard();}
  const ns=(clearing&&!pendingAdvance&&clearT>1)||G.SHOPS.some(sh=>Math.hypot(sh.x-P.x,sh.z-P.z)<3.4);if(ns!==nearShop){nearShop=ns;$('btnShop').classList.toggle('on',ns);}
  /* resolução dinâmica (telemóvel): mede o tempo real de cada frame e ajusta a resolução em passos, para interiores e tiroteios não engasgarem */
  if(isTouch&&!window.__rdpNoDyn){dynAcc+=dt;dynN++;if(dynAcc>=0.5){const ms=dynAcc/dynN*1000;dynAcc=0;dynN=0;let ns=dynScale;if(ms>21)ns=Math.max(0.55,dynScale-0.1);else if(ms<15.5){if(++dynGood>=3){ns=Math.min(1,dynScale+0.05);dynGood=0;}}else dynGood=0;if(Math.abs(ns-dynScale)>0.001){dynScale=ns;resize();}}}
  /* auto-qualidade */
  fpsAcc+=dt;fpsN++;if(fpsAcc>=2){const fps=fpsN/fpsAcc;fpsAcc=0;fpsN=0;if(fps<30)fpsLow++;else fpsLow=0;if(fpsLow>=3&&!qualDropped&&gameT>8){qualDropped=true;fpsLow=0;const i=TIER_ORDER.indexOf(save.settings.quality);if(i>0){save.settings.quality=TIER_ORDER[i-1];applyQuality();persist();msg('Qualidade reduzida para '+TIERS[save.settings.quality].label+' para manter a fluidez','#bbb');}}}
}
let aimOnEnemy=false;
function menuUpdate(dt){
  menuA+=dt*0.08;const r=2.8; if(menuWeapon){ menuWeapon.rotation.y+=dt*0.55; menuWeapon.position.y=1.05+Math.sin(gameT*0.9)*0.03; }
  const ST=G.START;
  camera.position.set(ST.x+Math.sin(menuA)*r*0.18,1.22,ST.z+2.2+Math.cos(menuA)*r*0.06);
  camera.lookAt(ST.x,1.02,ST.z);camera.fov=46;camera.updateProjectionMatrix();
  gameT+=dt;updateFX(dt);if(pool)pool.update(dt,camera.position,Q.lodBias);
}
function overUpdate(dt){
  overT+=dt;
  _v1.set(P.x+Math.sin(P.yaw)*3.2,1.9,P.z+Math.cos(P.yaw)*3.2);camera.position.lerp(_v1,1-Math.exp(-4*dt));camera.lookAt(P.x,0.7,P.z);
  for(const e of enemies)if(e.state==='dead')updateEnemy(e,dt);enemies=enemies.filter(e=>!e.remove);
  updateGrenades(dt);updateRockets(dt);updateFX(dt);if(pool)pool.update(dt,camera.position,Q.lodBias);
}

/* ===================== HUD ===================== */
const dom={money:$('money'),hpfill:$('hpfill'),hptxt:$('hptxt'),wave:$('wavetxt'),score:$('scoretxt'),enem:$('enemtxt'),wname:$('wname'),mag:$('mag'),res:$('res'),gren:$('gren')};
const dcache={};
function setText(el,key,val){if(dcache[key]!==val){dcache[key]=val;el.textContent=val;}}
function updateDOM(){try{const lh=$('lowhp');if(lh){const f=P.maxHp?P.hp/P.maxHp:1;lh.style.opacity=(mode==='play'&&P.alive&&f<0.35)?String(Math.min(1,(0.35-f)/0.3+0.25)):'0';}}catch(e){}
  setText(dom.hptxt,'hp',String(Math.ceil(P.hp))+(P.armor>0?' · colete '+Math.ceil(P.armor):''));{const af=document.getElementById('arfill'),hb=document.getElementById('hpbox');if(af){const on=P.armor>0;if(hb&&hb.classList.contains('arm')!==on)hb.classList.toggle('arm',on);const w=Math.min(100,P.armor)+'%';if(af.style.width!==w)af.style.width=w;}}setText(dom.money,'money','€ '+save.prog.money.toLocaleString('pt-PT'));
  const wp=Math.max(0,P.hp/P.maxHp*100).toFixed(1)+'%';if(dcache.w!==wp){dcache.w=wp;dom.hpfill.style.width=wp;dom.hpfill.style.background=P.hp>35?'#4cd964':'#ff453a';}
  const extra=[(clearing&&!pendingAdvance&&!endless)?'Próxima onda em '+Math.ceil(clearT)+' s · loja aberta (E)':null,mod?mod.nome:null,objHudText(),evt&&evt.active?EVENTS[evt.type].nome+(evt.left>0&&evt.type!=='reinforcements'?' '+Math.ceil(evt.left)+' s':''):null].filter(Boolean).join(' · ');
  setText(dom.wave,'wave',(tdm&&tdm.bomb?'RONDA '+tdm.bomb.round+' · LEÕES '+tdm.sc[0]+' – '+tdm.sc[1]+' · '+(tdm.bomb.st==='planted'?(tdm.bomb.defT>0.2?'A DESARMAR! '+Math.ceil(5-tdm.bomb.defT)+' s':'ARMADO · '+Math.ceil(tdm.bomb.fuse)+' s'):tdm.bomb.st==='carry'?(tdm.bomb.plantT>0?'A ARMAR '+Math.ceil(3-tdm.bomb.plantT)+' s':(tdm.bomb.carrier==='player'?'LEVA O PETARDO':'APANHA O PETARDO')+' · '+Math.ceil(tdm.bomb.roundT)+' s'):'FIM DA RONDA'):tdm?(tdm.ball?'⚽ ':'')+'LEÕES '+tdm.sc[0]+' – '+tdm.sc[1]+' '+team.nome.toUpperCase()+' · '+Math.floor(Math.max(0,tdm.t)/60)+':'+String(Math.floor(Math.max(0,tdm.t)%60)).padStart(2,'0'):taRun?'Contra-relógio · '+Math.floor(timeAttack/60)+':'+String(Math.floor(timeAttack%60)).padStart(2,'0'):endless?'Prolongamento · Onda '+wave:(team.extra?'Extra · '+team.nome:'Jogo '+(levelIdx+1)+'/5')+' · Onda '+wave+'/5')+(extra?' · '+extra:''));setText(dom.score,'score',score.toLocaleString('pt-PT'));
  setText(dom.enem,'en',team.nome+' · Inimigos: '+(enemies.filter(e=>e.state!=='dead').length+toSpawn)+' · Nível '+save.prog.level+(streak>1?' · Série '+streak:''));
  setText(dom.wname,'wn',WEAPONS[cur].nome);setText(dom.mag,'mag',String(wst[cur].mag));setText(dom.res,'res','/ '+(wst[cur].reserve===Infinity?'∞':wst[cur].reserve));setText(dom.gren,'gr','Granadas: '+P.gren);{const gb=document.getElementById('grenBadge');if(gb&&gb.textContent!==String(P.gren))gb.textContent=P.gren;}
}
let mini=null;
function buildMini(){mini=document.createElement('canvas');mini.width=mini.height=208;const g=mini.getContext('2d'),s=208/G.MW;g.fillStyle='rgba(20,60,20,0.6)';g.fillRect(0,0,G.MW*s,G.MH*s);for(let z=0;z<G.MH;z++)for(let x=0;x<G.MW;x++){const ch=G.MAP[z][x];if(ch==='#'||ch==='H'||ch==='T')g.fillStyle='rgba(225,225,225,0.55)';else if(ch==='C'||ch==='V'||ch==='D')g.fillStyle='rgba(120,160,220,0.6)';else if(ch==='G')g.fillStyle='rgba(255,255,255,0.8)';else if(ch==='M')g.fillStyle='rgba(242,201,76,0.9)';else if(ch==='c'||ch==='b'||ch==='S'||ch==='w')g.fillStyle='rgba(200,150,90,0.55)';else continue;g.fillRect(x*s,z*s,s+0.5,s+0.5);}}
function drawHUD(dt){
  hctx.setTransform(DPR,0,0,DPR,0,0);hctx.clearRect(0,0,W,H);
  if(mode!=='play'&&mode!=='pause')return;
  const cx=W/2,cy=H/2,w=WEAPONS[cur],playing=mode==='play';
  if(!Q.post){const lowK=P.hp<35?(0.4-P.hp/100)*(0.6+0.4*Math.sin(gameT*6)):0,vig=Math.max(hurtT,lowK*1.3);if(vig>0){const g=hctx.createRadialGradient(cx,cy,Math.min(W,H)*0.28,cx,cy,Math.max(W,H)*0.75);g.addColorStop(0,'rgba(200,0,0,0)');g.addColorStop(1,'rgba(200,0,0,'+Math.min(0.85,vig).toFixed(2)+')');hctx.fillStyle=g;hctx.fillRect(0,0,W,H);}}
  if(tdm&&tdm.bomb&&mode==='play'&&tdm.bomb.st!=='done'){ const B=tdm.bomb,st0=B.sites.slice().sort((a,b)=>Math.hypot(a.x-P.x,a.z-P.z)-Math.hypot(b.x-P.x,b.z-P.z))[0],tgt=B.st==='planted'?B.site:(B.carrier==='player'?st0:{x:B.x,z:B.z});
    if(tgt){ const ang=Math.atan2(tgt.x-P.x,tgt.z-P.z)-Math.atan2(-Math.sin(P.yaw),-Math.cos(P.yaw)),ay=isTouch?96:84; hctx.save();hctx.translate(cx,ay);hctx.rotate(ang);hctx.fillStyle=B.st==='planted'&&B.defT>0.2?'#ff5a4a':'#ff9a3a';hctx.strokeStyle='rgba(0,0,0,.55)';hctx.lineWidth=2;hctx.beginPath();hctx.moveTo(0,-13);hctx.lineTo(9,6);hctx.lineTo(0,1);hctx.lineTo(-9,6);hctx.closePath();hctx.fill();hctx.stroke();hctx.restore(); }
    if(B.st==='carry'&&B.plantT>0){ hctx.save();hctx.strokeStyle='rgba(0,0,0,.4)';hctx.lineWidth=6;hctx.beginPath();hctx.arc(cx,cy+60,18,0,TAU);hctx.stroke();hctx.strokeStyle='#f2c94c';hctx.beginPath();hctx.arc(cx,cy+60,18,-Math.PI/2,-Math.PI/2+TAU*Math.min(1,B.plantT/3));hctx.stroke();hctx.restore(); } }
  if(tdm&&tdm.ball&&ballObj&&mode==='play'){ const B=tdm.ball,tgt=B.st==='player'?ballGoal():{x:ballObj.position.x,z:ballObj.position.z},ang=Math.atan2(tgt.x-P.x,tgt.z-P.z)-Math.atan2(-Math.sin(P.yaw),-Math.cos(P.yaw)),ay=isTouch?96:84;
    hctx.save();hctx.translate(cx,ay);hctx.rotate(ang);hctx.fillStyle=B.st==='enemy'?'#ff5a4a':'#f2c94c';hctx.strokeStyle='rgba(0,0,0,.55)';hctx.lineWidth=2;hctx.beginPath();hctx.moveTo(0,-13);hctx.lineTo(9,6);hctx.lineTo(0,1);hctx.lineTo(-9,6);hctx.closePath();hctx.fill();hctx.stroke();hctx.restore(); }
  { const hasHolo=!!(views[cur]&&views[cur].att&&views[cur].att.sight); holoK=Math.max(0,Math.min(1,holoK+(ads&&hasHolo&&!w.scope?1:-1)*(1/60)*6));
    if(holoK>0.02){ const r=Math.min(W,H)*0.045;hctx.save();hctx.globalAlpha=holoK;hctx.strokeStyle='#ff4a3a';hctx.fillStyle='#ff4a3a';hctx.shadowColor='rgba(255,70,50,0.9)';hctx.shadowBlur=8;hctx.lineWidth=1.6;
      hctx.beginPath();hctx.arc(cx,cy,r,0,TAU);hctx.stroke();hctx.lineWidth=2.2;hctx.beginPath();for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]){hctx.moveTo(cx+dx*r*0.78,cy+dy*r*0.78);hctx.lineTo(cx+dx*r*1.22,cy+dy*r*1.22);}hctx.stroke();
      hctx.beginPath();hctx.arc(cx,cy,1.8,0,TAU);hctx.fill();hctx.restore(); } }
  if(ads&&w.scope){
    const R=Math.min(W,H)*0.44;hctx.fillStyle='rgba(0,0,0,0.97)';hctx.beginPath();hctx.rect(0,0,W,H);hctx.arc(cx,cy,R,0,TAU,true);hctx.fill();
    hctx.strokeStyle='rgba(0,0,0,0.9)';hctx.lineWidth=2;hctx.beginPath();hctx.moveTo(cx-R,cy);hctx.lineTo(cx+R,cy);hctx.moveTo(cx,cy-R);hctx.lineTo(cx,cy+R);hctx.stroke();
    hctx.strokeStyle='rgba(0,0,0,0.6)';hctx.beginPath();hctx.arc(cx,cy,R*0.25,0,TAU);hctx.stroke();
    for(let i=1;i<=3;i++){hctx.beginPath();hctx.moveTo(cx-10,cy+i*22);hctx.lineTo(cx+10,cy+i*22);hctx.stroke();}
  }else if(holoK<0.3){
    const sp=(ads?0.3:1)*(P.sprint?2.2:1)*(1+P.moving*0.5),gap=5+w.spread*260*sp+recoilK*6,len=8;
    hctx.strokeStyle=aimOnEnemy?'rgba(255,70,70,0.95)':'rgba(255,255,255,0.9)';hctx.lineWidth=2;hctx.lineCap='round';
    hctx.beginPath();hctx.moveTo(cx-gap-len,cy);hctx.lineTo(cx-gap,cy);hctx.moveTo(cx+gap,cy);hctx.lineTo(cx+gap+len,cy);hctx.moveTo(cx,cy-gap-len);hctx.lineTo(cx,cy-gap);hctx.moveTo(cx,cy+gap);hctx.lineTo(cx,cy+gap+len);hctx.stroke();
    hctx.fillStyle=hctx.strokeStyle;hctx.beginPath();hctx.arc(cx,cy,1.5,0,TAU);hctx.fill();
  }
  if(hitT>0){const pk=1+Math.max(0,hitT-0.12)*2.2;hctx.save();hctx.translate(cx,cy);hctx.scale(pk,pk);hctx.translate(-cx,-cy);if(hitCls==='res'){hctx.font='bold 10px sans-serif';hctx.fillStyle='#c8ced6';hctx.textAlign='center';hctx.fillText('resiste',cx,cy+27);}hctx.strokeStyle=hitKill?'#ff3b3b':(hitHead?'#ffd24a':(hitCls==='res'?'#9aa3ad':(hitCls==='weak'?'#ff9a3a':'#ffffff')));hctx.lineWidth=2.5;hctx.beginPath();for(const q of [[-1,-1],[1,-1],[-1,1],[1,1]]){hctx.moveTo(cx+q[0]*6,cy+q[1]*6);hctx.lineTo(cx+q[0]*13,cy+q[1]*13);}hctx.stroke();hctx.restore();}
  for(const d of dmgInd){const a=d.ang-Math.PI/2,R=Math.min(W,H)*0.22;hctx.strokeStyle='rgba(255,40,40,'+(d.t*0.9).toFixed(2)+')';hctx.lineWidth=8;hctx.beginPath();hctx.arc(cx,cy,R,a-0.35,a+0.35);hctx.stroke();}
  hctx.textAlign='center';
  if(dmgNums.length){hctx.lineWidth=3;hctx.strokeStyle='rgba(0,0,0,0.8)';for(const n of dmgNums){const sp=toScreen(n.x,n.y+(0.8-n.t)*0.9,n.z);if(!sp)continue;hctx.font=(n.head?'700 19px':'700 15px')+' Oswald,Impact,"Arial Black",sans-serif';hctx.globalAlpha=Math.min(1,n.t*2.5);hctx.strokeText(n.v,sp[0],sp[1]);hctx.fillStyle=n.head?'#ffd166':'#fff';hctx.fillText(n.v,sp[0],sp[1]);}hctx.globalAlpha=1;}
  for(const e of enemies){if(e.state==='dead'||e.state==='warm'||e.hbT>0)continue;const dd=Math.hypot(e.x-P.x,e.z-P.z);if(dd<24||dd>70||!e.hasLos)continue;const sp=toScreen(e.x,(e.perchY||e.y||0)+2.15*e.scale,e.z);if(!sp)continue;hctx.globalAlpha=0.65;hctx.fillStyle=e.T.boss?'#f2c94c':'#ff5050';hctx.beginPath();hctx.moveTo(sp[0],sp[1]-5);hctx.lineTo(sp[0]+4,sp[1]);hctx.lineTo(sp[0],sp[1]+5);hctx.lineTo(sp[0]-4,sp[1]);hctx.closePath();hctx.fill();hctx.globalAlpha=1;}
  for(const e of enemies){if(!(e.hbT>0)||e.state==='dead'||e.state==='warm')continue;const dd=Math.hypot(e.x-P.x,e.z-P.z);if(dd>45||!los(P.x,P.z,e.x,e.z,P.y+1.5,1.5))continue;const sp=toScreen(e.x,2.25*e.scale,e.z);if(!sp)continue;const bw=e.T.boss?60:34,k=clamp(e.hp/e.maxHp,0,1);hctx.globalAlpha=Math.min(1,e.hbT);hctx.fillStyle='rgba(0,0,0,0.55)';hctx.fillRect(sp[0]-bw/2-1,sp[1]-5,bw+2,6);hctx.fillStyle=e.T.boss?'#f2c94c':(k>0.5?'#ff5252':'#ff2020');hctx.fillRect(sp[0]-bw/2,sp[1]-4,bw*k,4);if(e.T.boss){hctx.font='bold 11px sans-serif';hctx.fillStyle='#f2c94c';hctx.fillText(e.nome,sp[0],sp[1]-9);}hctx.globalAlpha=1;}
  if(reloading>0){const pr=1-reloading/reloadTotal;hctx.strokeStyle='rgba(255,255,255,0.35)';hctx.lineWidth=3;hctx.beginPath();hctx.arc(cx,cy+36,12,0,TAU);hctx.stroke();hctx.strokeStyle='#f2c94c';hctx.beginPath();hctx.arc(cx,cy+36,12,-Math.PI/2,-Math.PI/2+TAU*pr);hctx.stroke();hctx.fillStyle='#fff';hctx.font='bold 11px sans-serif';hctx.fillText('A recarregar',cx,cy+64);}
  else if(wst[cur].mag===0){hctx.fillStyle='#ff5252';hctx.font='bold 13px sans-serif';hctx.fillText(wst[cur].reserve>0?'Recarrega':'Sem munições, troca de arma',cx,cy+58);}
  if(joy.active){hctx.beginPath();hctx.arc(joy.ox,joy.oy,JOY_R,0,TAU);hctx.fillStyle='rgba(255,255,255,0.08)';hctx.fill();hctx.strokeStyle='rgba(255,255,255,0.35)';hctx.lineWidth=2;hctx.stroke();hctx.beginPath();hctx.arc(joy.x,joy.y,22,0,TAU);hctx.fillStyle='rgba(255,255,255,0.4)';hctx.fill();}
  /* minimapa */
  const mx=W-14-96,my=12,ms=96/G.MW;if(mini)hctx.drawImage(mini,mx,my,96,96);
  for(const e of enemies){if(e.state==='dead')continue;const dd=Math.hypot(e.x-P.x,e.z-P.z);if(uavT<=0&&dd>30)continue;const ex=mx+e.x/S*ms,ey=my+e.z/S*ms;hctx.fillStyle=e.T.boss?'#f2c94c':(e.T.perch?'#ff9a3c':(e.T.shield?'#7fb4ff':'#ff4040'));hctx.beginPath();if(e.T.perch){hctx.moveTo(ex,ey-3.5);hctx.lineTo(ex+3,ey+2.5);hctx.lineTo(ex-3,ey+2.5);hctx.closePath();}else if(e.T.shield){hctx.rect(ex-2.5,ey-2.5,5,5);}else hctx.arc(ex,ey,e.T.boss?3.5:2,0,TAU);hctx.fill();}
  if(tdm){hctx.fillStyle='#4ade80';for(const a of allies){if(a.state==='dead')continue;hctx.beginPath();hctx.arc(mx+a.x/S*ms,my+a.z/S*ms,2.4,0,TAU);hctx.fill();}
    if(tdm.ball&&ballObj){hctx.fillStyle='#ffffff';hctx.strokeStyle='#f2c94c';hctx.lineWidth=1.5;hctx.beginPath();hctx.arc(mx+ballObj.position.x/S*ms,my+ballObj.position.z/S*ms,3,0,TAU);hctx.fill();hctx.stroke();hctx.fillStyle='#f2c94c';hctx.fillRect(mx+(G.MW-1.6)*ms-2,my+G.MH*ms/2-4,4,8);}}
  hctx.save();hctx.translate(mx+P.x/S*ms,my+P.z/S*ms);hctx.rotate(-P.yaw);hctx.fillStyle='#4cd964';hctx.beginPath();hctx.moveTo(0,-5);hctx.lineTo(4,4);hctx.lineTo(-4,4);hctx.closePath();hctx.fill();hctx.restore();
  if(uavT>0){hctx.fillStyle='#7fd7ff';hctx.font='bold 10px sans-serif';hctx.fillText('UAV '+Math.ceil(uavT)+'s',mx+48,my+G.MH*ms+12);}
  if(streak>0&&streakT>0){hctx.fillStyle='rgba(0,0,0,0.4)';hctx.fillRect(cx-40,52,80,4);hctx.fillStyle='#f2c94c';hctx.fillRect(cx-40,52,80*clamp(streakT/12,0,1),4);}
  /* faixas */
  hctx.lineJoin='round';
  if(banner&&banner.t>0){
    const a=Math.min(1,banner.t/0.5);hctx.globalAlpha=a;
    hctx.font='bold 30px Impact,"Arial Black",sans-serif';hctx.lineWidth=5;hctx.strokeStyle='rgba(0,0,0,0.7)';hctx.strokeText(banner.txt,cx,H*0.27);hctx.fillStyle='#f2c94c';hctx.fillText(banner.txt,cx,H*0.27);
    hctx.font='bold 12px sans-serif';hctx.lineWidth=3;hctx.strokeText(banner.sub,cx,H*0.27+20);hctx.fillStyle='#fff';hctx.fillText(banner.sub,cx,H*0.27+20);hctx.globalAlpha=1;
  }else if(waveBanner>0){
    const a=Math.min(1,waveBanner/0.5);hctx.globalAlpha=a;
    {const bg=hctx.createLinearGradient(cx-260,0,cx+260,0);bg.addColorStop(0,'rgba(8,12,18,0)');bg.addColorStop(0.5,'rgba(8,12,18,0.6)');bg.addColorStop(1,'rgba(8,12,18,0)');hctx.fillStyle=bg;hctx.fillRect(cx-260,H*0.27-30,520,58);hctx.fillStyle='#f2c94c';hctx.fillRect(cx-90,H*0.27+30,180,2);}hctx.font='700 30px Oswald,Impact,"Arial Black",sans-serif';hctx.lineWidth=5;hctx.strokeStyle='rgba(0,0,0,0.55)';hctx.strokeText('ONDA '+wave,cx,H*0.27);hctx.fillStyle='#fff';hctx.fillText('ONDA '+wave,cx,H*0.27);
    const sub=bossWave?'O CAPITÃO '+team.boss.toUpperCase()+' ENTRA EM CAMPO':(wave===1?(endless?'PROLONGAMENTO':team.estadio.toUpperCase()+' · VS '+team.nome.toUpperCase()):'');
    if(sub){hctx.font='bold 12px Impact,"Arial Black",sans-serif';hctx.lineWidth=3;hctx.strokeText(sub,cx,H*0.27+20);hctx.fillStyle='#f2c94c';hctx.fillText(sub,cx,H*0.27+20);}
    hctx.globalAlpha=1;
  }
  if(airT>0){hctx.fillStyle='#f2c94c';hctx.font='bold 16px Impact,"Arial Black",sans-serif';hctx.fillText('ATAQUE AÉREO A CAMINHO',cx,H*0.38);}
  if(nearShop&&!isTouch){hctx.fillStyle='#8fe38f';hctx.font='bold 14px sans-serif';hctx.fillText('Prime E para abrir a loja',cx,cy+90);}
  for(const sh of G.SHOPS){hctx.fillStyle='#f2c94c';hctx.fillRect(mx+sh.x/S*ms-2,my+sh.z/S*ms-2,4,4);}
  /* mensagens */
  { let sub=null;const feed=_feedBuf;feed.length=0;for(let i=0;i<msgs.length;i++){const m=msgs[i];if(m.sub===undefined)m.sub=SUB_RE.test(m.txt);if(m.sub)sub=m;else feed.push(m);}if(feed.length>3)feed.splice(0,feed.length-3);
    hctx.font='600 12.5px Oswald,"Arial Narrow",sans-serif';hctx.lineWidth=3;hctx.strokeStyle='rgba(0,0,0,0.75)';hctx.textAlign='left';
    feed.forEach((m,i)=>{hctx.globalAlpha=Math.min(1,m.t*1.5);const y=(isTouch?196:120)+i*17,x=isTouch?16:14;hctx.strokeText(m.txt,x,y);hctx.fillStyle=m.col;hctx.fillText(m.txt,x,y);});
    if(sub)drawSub(sub); }
  hctx.textAlign='center';hctx.globalAlpha=1;
  if(playing){hitT-=dt;hurtT=Math.max(0,hurtT-dt*1.2);waveBanner-=dt;if(banner)banner.t-=dt;for(const d of dmgInd)d.t-=dt*0.8;dmgInd=dmgInd.filter(d=>d.t>0);for(const m of msgs)m.t-=dt;msgs=msgs.filter(m=>m.t>0);for(const n of dmgNums)n.t-=dt;dmgNums=dmgNums.filter(n=>n.t>0);for(const e of enemies)if(e.hbT>0)e.hbT-=dt;}
}

/* legenda do locutor / público / rádio: balão em baixo, afastado dos botões da direita, no máximo 2 linhas */
const SUB_RE=/^(LOCUTOR|PÚBLICO|RÁDIO|RADIO|TREINADOR|OLHEIRO)/,_feedBuf=[];
function drawSub(m){ const a=Math.min(1,m.t*1.5),i=m.txt.indexOf(':'),who=(i>0&&i<12)?m.txt.slice(0,i):'',body=(i>0&&i<12)?m.txt.slice(i+1).trim():m.txt;
  const maxW=Math.max(260,W*0.36),cxs=isTouch?W*0.42:W/2;hctx.font='600 13px sans-serif';
  const words=body.split(' '),lines=[];let line='';for(const w of words){const t=line?line+' '+w:w;if(hctx.measureText(t).width>maxW-26&&line){lines.push(line);line=w;if(lines.length===2)break;}else line=t;}
  if(lines.length<2&&line)lines.push(line); else if(lines.length===2&&line&&!lines.includes(line))lines[1]=lines[1].replace(/\s*\S*$/,'…');
  const lw=Math.min(maxW,Math.max(...lines.map(l=>hctx.measureText(l).width))+26),bh=lines.length*17+(who?15:0)+14,bx=cxs-lw/2,by=H-(isTouch?12:44)-bh;
  hctx.globalAlpha=a*0.92;hctx.fillStyle='rgba(8,12,18,0.72)';hctx.beginPath();if(hctx.roundRect)hctx.roundRect(bx,by,lw,bh,10);else hctx.rect(bx,by,lw,bh);hctx.fill();
  hctx.globalAlpha=a;hctx.textAlign='center';let y=by+7;
  if(who){hctx.font='800 10px sans-serif';hctx.fillStyle=m.col||'#f2c94c';hctx.fillText(who,cxs,y+9);y+=15;}
  hctx.font='600 13px sans-serif';hctx.fillStyle='#f4f6f8';for(const l of lines){hctx.fillText(l,cxs,y+12);y+=17;}
  hctx.globalAlpha=1; }
/* ===================== Loja ===================== */
const shopEl=$('shop');
function applyUpgrades(){P.maxHp=100+20*save.prog.up.hp;}
function shopPrice(it){if(it.kind==='weapon'&&!unlocked(it.w)&&wStage(it.w)>storyStage())return null;if(it.kind==='att'&&(attOf(attTarget())[it.a]||(ATT_BAN[it.a]||[]).includes(attTarget())))return null;if(it.kind==='skin'){if(save.prog.skin===it.s||(it.s==='none'&&!save.prog.skin))return null;if(it.trophy)return (save.prog.unlocked||0)>=it.trophy?0:null;return (save.prog.skinsOwned||{})[it.s]?0:it.price;}return it.kind==='up'?(save.prog.up[it.id]>=it.max?null:it.prices[save.prog.up[it.id]]):it.price;}
let shopTab='arsenal',shopSelW=null,shopRailScroll=null;
const SHOP_COL={arsenal:'#f2c94c',weapon:'#ff6a4a',consume:'#46d17a',up:'#4aa8ff',att:'#b07aff',skin:'#ff6ab8',all:'#f2c94c'},SHOP_TICON={arsenal:'🎖️',weapon:'🔫',consume:'🧰',up:'⚡',att:'🔭',skin:'🎨',all:'🛒'};
const ITEM_ICON={med:'🩹',ammo:'📦',gren:'🧨',armor:'🛡️',heavy:'🪖',mine:'💠',c4:'🧱',sentry:'🛰️',dmg:'💥',mag:'🔋',reload:'⏱️',hp:'❤️',head:'🎯',blast:'💣',speed:'👟',att_sight:'🔴',att_laser:'🟥',att_grip:'✊',att_stock:'🪵',sk_none:'⚙️',sk_camo:'🌿',sk_tiger:'🐯',sk_zebra:'🦓',sk_gold:'🏆'};
const SHOP_TABS=[['arsenal','Arsenal'],['consume','Equipamento'],['up','Melhorias'],['att','Acessórios'],['skin','Pinturas']]; // loja simples: as armas estão todas no Arsenal, por categoria
function renderShop(){
  const T=$('shopTabs'); const money=$('shopMoney'); if(money)money.textContent=save.prog.money.toLocaleString('pt-PT')+' €';
  const hp=$('shopHp'); if(hp)hp.textContent=Math.ceil(P.hp)+'/'+P.maxHp+(P.armor>0?'  +'+Math.ceil(P.armor):'');
  if(shopEl&&shopEl.style&&shopEl.style.setProperty)shopEl.style.setProperty('--acc',SHOP_COL[shopTab]||'#f2c94c');
  if(T){ T.innerHTML=''; for(const [k,n] of SHOP_TABS){ if(mode==='menushop'&&k==='consume')continue; const b=document.createElement('button'); b.className='gtab'+(k===shopTab?' on':''); b.innerHTML='<span>'+n+'</span>'; b.addEventListener('click',()=>{shopTab=k;renderShop();}); T.appendChild(b); } }
  const L=$('shopList'); L.className='shopbody tab-'+shopTab; L.innerHTML='';
  if(shopTab==='arsenal'){ if(!shopSelW||!WEAPONS[shopSelW])shopSelW=cur; renderArsenal(L); return; }
  renderGrid(L);
}
function renderArsenal(L){
  const k=shopSelW,w=WEAPONS[k],own=unlocked(k),it=SHOP.find(x=>x.kind==='weapon'&&x.w===k),price=it?shopPrice(it):null,a=attOf(k),lv=wlevel(k),next=lv<WXP_LEVELS.length?WXP_LEVELS[lv]:null;
  let SG=null;try{SG=armSuggest();}catch(e){}
  const skinIt=SHOP.find(x=>x.kind==='skin'&&x.s===(save.prog.skin||'none'));
  const catName=WCAT[B(k)]||'';
  const stat=(lbl,v,col)=>'<div class="gstat"><span>'+lbl+'</span><i><b style="width:'+Math.round(v*100)+'%;background:'+col+'"></b></i></div>';
  const bars=[['DANO',Math.min(1,w.dmg*(w.pellets||1)/300),'#ff5a3a'],['CADÊNCIA',Math.min(1,(1/w.rate)/12),'#f2c94c'],['ALCANCE',Math.min(1,(w.falloff?w.falloff[1]:w.range)/200),'#4aa8ff'],['PRECISÃO',Math.max(0.05,1-w.spread/0.06),'#46d17a'],['CONTROLO',Math.max(0.05,1-w.kick/0.11),'#b07aff']];
  // painel central: nome, classe, arma 3D grande, barras
  const stage=document.createElement('div'); stage.className='gstage';
  stage.innerHTML='<div class="gname"><span class="gcat">'+catName+'</span><h3>'+w.nome+'</h3>'
    +(CLASS_INFO[w.cls]?'<div class="gcls"><b>'+CLASS_INFO[w.cls].nome.toUpperCase()+'</b> · ✔ '+CLASS_INFO[w.cls].bom+' · ✘ '+CLASS_INFO[w.cls].fraco+'</div>':'')+'</div>'
    +'<div class="ghero">'+((weaponIcons['__skin_'+k]||weaponIcons[k])?'<img src="'+(weaponIcons['__skin_'+k]||weaponIcons[k])+'" alt="">':'')+'<div class="glvl">NÍVEL '+lv+(next?'<i><b style="width:'+Math.round(wxp(k)/next*100)+'%"></b></i>':' · MÁX')+'</div></div>'
    +'<div class="gstats">'+bars.map(r=>stat(r[0],r[1],r[2])).join('')+'</div>';
  // barra de ação
  const act=document.createElement('div'); act.className='gact';
  let actHTML='';
  if(own){ actHTML='<button class="gbuy'+(k===cur?' owned':'')+'" id="gEquip">'+(k===cur?'▸ EQUIPADA':'EQUIPAR')+'</button>'; }
  else if(it&&price!=null){ actHTML='<button class="gbuy'+(price>save.prog.money?' off':'')+'" id="gBuy">COMPRAR · '+price.toLocaleString('pt-PT')+' €</button>'; }
  else { actHTML='<button class="gbuy off" disabled>À VENDA · JOGO '+wStage(k)+'</button>'; }
  act.innerHTML=actHTML+'<div class="gaccess">'
    +['sight','laser','grip','stock'].map(id=>'<span class="'+(a[id]?'on':'')+'">'+(ATTACHMENTS[id]?ATTACHMENTS[id].nome:id)+'</span>').join('')
    +'<span class="'+(save.prog.skin?'on':'')+'">'+(skinIt?skinIt.nome:'Original')+'</span></div>';
  // armeiro (só se for tua)
  if(own){ const arm=document.createElement('div'); arm.className='garm';
    for(const uk of ['barrel','mag','mech']){ const U=WUP[uk],lvw=wu(k)[uk],full=lvw>=U.max,pr=full?0:U.price[lvw];
      const bb=document.createElement('button'); bb.className='garmb'+(full?' full':(pr>save.prog.money?' off':''));
      bb.innerHTML='<b>'+({barrel:'CANO',mag:'CARREG.',mech:'MECAN.'})[uk]+'</b><i>'+'●'.repeat(lvw)+'○'.repeat(U.max-lvw)+'</i><small>'+(full?'MÁX':pr.toLocaleString('pt-PT')+' €')+'</small>';
      bb.addEventListener('click',()=>{ if(full||pr>save.prog.money)return; save.prog.money-=pr; wu(k)[uk]++; persist(); sfx('pick'); renderShop(); });
      arm.appendChild(bb); }
    act.appendChild(arm); }
  // carrossel de armas por categoria
  const rail=document.createElement('div'); rail.className='grail';
  let lastCat='';
  for(const wk of ORDER){ const cat=WCAT[B(wk)]||''; if(cat!==lastCat){ lastCat=cat; const h=document.createElement('div'); h.className='grcat'; h.textContent=cat; rail.appendChild(h); }
    const ww=WEAPONS[wk],o2=unlocked(wk),card=document.createElement('button'); card.className='gcard'+(wk===shopSelW?' on':'')+(o2?'':' locked');
    const star=(SG&&SG.rec.includes(ww.cls))?'<em class="grec">★</em>':'';
    card.innerHTML=star+(weaponIcons[wk]?'<img src="'+weaponIcons[wk]+'" alt="">':'<span class="noimg"></span>')+'<b>'+ww.nome+'</b><small>'+(o2?(wk===cur?'Equipada':'Nv '+wlevel(wk)):(SHOP.find(x=>x.kind==='weapon'&&x.w===wk&&shopPrice(x)!=null)?(SHOP.find(x=>x.kind==='weapon'&&x.w===wk).price).toLocaleString('pt-PT')+' €':'Jogo '+wStage(wk)))+'</small>';
    card.addEventListener('click',()=>{shopSelW=wk;renderShop();}); rail.appendChild(card); }
  const prevRail=L.querySelector('.grail'); const keepScroll=shopRailScroll; L.appendChild(stage); L.appendChild(act); L.appendChild(rail);
  rail.addEventListener('scroll',()=>{shopRailScroll={t:rail.scrollTop,l:rail.scrollLeft};},{passive:true});
  if(keepScroll){ rail.scrollTop=keepScroll.t; rail.scrollLeft=keepScroll.l; } else { const on=rail.querySelector('.gcard.on'); if(on&&on.scrollIntoView){ try{ on.scrollIntoView({block:'nearest',inline:'nearest'}); }catch(e){} } }
  const eb=$('gEquip'); if(eb)eb.addEventListener('click',()=>{ if(k!==cur){setWeapon(k);renderShop();} });
  const bb=$('gBuy'); if(bb)bb.addEventListener('click',()=>{ if(it&&price<=save.prog.money){buy(it);renderShop();} });
  if(SG){ const tip=document.createElement('div'); tip.className='gtip'; tip.innerHTML='<em>🛠️</em>'+SG.txt; L.appendChild(tip); }
}
function renderGrid(L){
  if(shopTab==='att'){ const hd=document.createElement('div'); hd.className='gsub'; hd.textContent='Acessórios para '+WEAPONS[attTarget()].nome; L.appendChild(hd); }
  const grid=document.createElement('div'); grid.className='ggrid';
  for(const it of SHOP){ if(it.kind!==shopTab)continue; const price=shopPrice(it),owned=it.kind==='weapon'&&unlocked(it.w);
    const b=document.createElement('button'); b.className='gitem'+(it.kind==='weapon'?' wide':'');
    const lvl=it.kind==='up'?'<i class="gdots">'+'●'.repeat(save.prog.up[it.id])+'○'.repeat(Math.max(0,it.max-save.prog.up[it.id]))+'</i>':'';
    const plab=price===null&&it.kind==='att'&&(ATT_BAN[it.a]||[]).includes(attTarget())?'Incompatível':price===null&&it.kind==='att'?'Montado':price===null?((it.kind==='skin'&&(save.prog.skin===it.s||(it.s==='none'&&!save.prog.skin)))?'Equipada':(it.trophy?'Troféu':'Máximo')):(owned?'Já tens':(price===0?'Equipar':price.toLocaleString('pt-PT')+' €'));
    const off=price===null||owned||price>save.prog.money;
    b.innerHTML='<b>'+it.nome.replace(/ \(\d\/\d\)$/,'')+'</b>'+lvl+'<small>'+(it.desc||'')+'</small><span class="gprice'+(off?' off':'')+'">'+plab+'</span>';
    b.disabled=off; b.addEventListener('click',()=>{if(!off)buy(it);}); grid.appendChild(b); }
  L.appendChild(grid);
}
function statBars(k){ const w=WEAPONS[k]; const rows=[['Dano',Math.min(1,w.dmg*(w.pellets||1)/300)],['Cadência',Math.min(1,(1/w.rate)/12)],['Alcance',Math.min(1,(w.falloff?w.falloff[1]:w.range)/200)],['Precisão',Math.max(0.05,1-w.spread/0.06)],['Controlo',Math.max(0.05,1-w.kick/0.11)]];
  return '<div class="bars">'+rows.map(r=>'<div class="br"><span>'+r[0]+'</span><i><b style="width:'+Math.round(r[1]*100)+'%"></b></i></div>').join('')+'</div>'; }
function buy(it){
  const price=shopPrice(it);if(price===null||price>save.prog.money||(it.kind==='weapon'&&unlocked(it.w))||(it.kind==='att'&&attOf(attTarget())[it.a]))return;
  save.prog.money-=price;
  if(it.kind==='consume'){
    if(it.id==='ammo'){for(const k of ORDER){if(WEAPONS[k].reserve!==Infinity)wst[k].reserve=Math.max(wst[k].reserve,WEAPONS[k].reserve*2);wst[k].mag=magOf(k);}}
    else if(it.id==='med')P.hp=P.maxHp;else if(it.id==='gren')P.gren=Math.min(4,P.gren+2);else if(it.id==='armor')P.armor=80;
    else if(it.id==='heavy'){for(const k of ['gl','rpg']){if(wst[k]){wst[k].reserve=Math.max(wst[k].reserve,WEAPONS[k].reserve);wst[k].mag=magOf(k);}}}
    else if(it.id==='mine'){P.mines=Math.min(4,(P.mines||0)+2);$('btnMine').classList.remove('hidden');}
    else if(it.id==='c4'){P.c4=Math.min(4,(P.c4||0)+2);updateGearBtns();}
    else if(it.id==='sentry'){P.sentries=Math.min(2,(P.sentries||0)+1);updateGearBtns();}
  }else if(it.kind==='att'){attOf(attTarget())[it.a]=true;applyAttachments();msg('Acessório montado: '+ATTACHMENTS[it.a].nome,'#f2c94c');}
  else if(it.kind==='skin'){save.prog.skinsOwned=save.prog.skinsOwned||{};save.prog.skinsOwned[it.s]=true;save.prog.skin=it.s==='none'?null:it.s;applySkin();try{renderWeaponIcons();}catch(e){}msg(it.nome+' aplicada','#f2c94c');}
  else if(it.kind==='weapon'){save.prog.owned[it.w]=true;if(!wst[it.w])wst[it.w]={mag:magOf(it.w),reserve:WEAPONS[it.w].reserve};try{renderWeaponIcons();}catch(e){}msg('Arma comprada: '+WEAPONS[it.w].nome,'#f2c94c');}
  else{save.prog.up[it.id]++;applyUpgrades();if(it.id==='hp')P.hp=Math.min(P.maxHp,P.hp+20);if(it.id==='mag')for(const k of ORDER)if(wst[k])wst[k].mag=Math.max(wst[k].mag,magOf(k));}
  sfx('pick');persist();renderShop();
}
function openMenuShop(){ if(mode!=='menu')return; mode='menushop'; document.body.classList.add('menushop'); shopTab='arsenal'; shopSelW=cur; shopRailScroll=null; shopEl.classList.remove('hidden'); renderShop(); const c=$('shopClose'); if(c)c.textContent='✕ FECHAR'; }
function openShop(){if(mode!=='play'||!nearShop)return;mode='shop';fireHeld=false;joy.active=false;joy.vx=joy.vy=0;look.active=false;ads=false;shopSelW=cur;shopRailScroll=null;uiEl.classList.remove('on');shopEl.classList.remove('hidden');renderShop();if(document.pointerLockElement)document.exitPointerLock();sfx('pick');}
function closeShop(){ if(mode==='menushop'){ mode='menu'; document.body.classList.remove('menushop'); shopEl.classList.add('hidden'); try{placeMenuModel();}catch(e){} const c=$('shopClose'); if(c)c.textContent='✕ JOGAR'; refreshMenu(); return; } if(mode!=='shop')return;mode='play';shopEl.classList.add('hidden');uiEl.classList.add('on');last=performance.now();lockPointer();}
$('shopClose').addEventListener('click',closeShop);
tapBtn($('btnShop'),()=>{openShop();});

/* ===================== Menu, fluxo ===================== */
const menuEl=$('menu'),pauseEl=$('pause'),overEl=$('over'),uiEl=$('ui');
function refreshMenu(){
  const s=save.settings,p=save.prog,tm=TEAMS[s.level];
  try{ const nt=TEAMS[nextIdx()]; const im=$('lbStoryImg'); if(im&&nt)im.src=sceneURL(nt.key); const q=$('lbQuickTxt'); if(q&&nt)q.textContent=(isWon(s.level)?'Repetir ':'')+nt.nome+' · '+nt.estadio; const nm=$('lbName'); if(nm)nm.textContent=playerName(); const lv=$('lbLv'); if(lv)lv.textContent=String(p.level||1); const wn=$('lbWpnName'); if(wn)wn.textContent=WEAPONS[cur].nome; const ws=$('lbWpnSub'); if(ws)ws.textContent=(WCAT[B(cur)]||'')+' · nível '+wlevel(cur); const wl=$('lbWpn'); if(wl)wl.textContent=WEAPONS[cur].nome+' equipada · '+ORDER.filter(k=>unlocked(k)).length+' armas'; const sc=$('lbScout'); if(sc&&nt)sc.textContent=(nt.scout||'').replace(/^./,c=>c.toUpperCase()); const d=$('lbDaily'); if(d){ const dt=dailyText(); d.textContent=dt.replace(/^Desafios? [^:]*:\s*/i,'').split('\n')[0].slice(0,90)||dt.slice(0,90); } }catch(e){}
  try{$('oMapV').textContent='Jogo '+(s.level+1)+': '+tm.nome;}catch(e){}$('mapDesc').textContent=(document.querySelector('#menu .lobby.v3')?('Jogo '+Math.min(MAIN,(p.unlocked||0)+1)+' de '+MAIN+' · '+(TEAMS[nextIdx()]||tm).estadio):(tm.desc+(p.champion?' Já és campeão do mundo.':'')));
  $('oDiffV').textContent=DIFF[s.diff].label;$('oQualV').textContent=TIERS[s.quality].label;$('oSensV').textContent=SENS[s.sens].label;
  $('oAutoV').textContent=s.auto?'Ligado':'Desligado';$('oAssistV').textContent=['Desligada','Normal','Forte'][s.assist??1];$('oGyroV').textContent=['Desligado','Ligado','Invertido'][s.gyro||0];$('oSoundV').textContent=s.sound?'Ligado':'Desligado';$('oDebugV').textContent=s.debug?'Visível':'Escondido';$('oNameV').textContent=playerName();$('oHudV').textContent=({0.7:'Pequenos',0.85:'Médios',1:'Grandes',1.15:'Muito grandes'})[s.hud||0.85]||'Médios';applyHudScale();$('oFullV').textContent=isStandalone()?'App instalada':(fullscreenSupported()?'Tocar':'No iPhone: Partilhar → Ecrã principal');
  const next=ORDER.filter(k=>WEAPONS[k].lvl>p.level).sort((a,b)=>WEAPONS[a].lvl-WEAPONS[b].lvl)[0];
  const b=p.best[s.diff];
  try{$('lvlTxt').textContent='NV '+p.level+'  '+p.xp+'/'+xpFor(p.level)+' XP';}catch(e){} try{const mt=$('moneyTxt');if(mt)mt.textContent=(p.money||0).toLocaleString('pt-PT')+' €';}catch(e){}
  $('xpFill').style.width=Math.min(100,p.xp/xpFor(p.level)*100).toFixed(1)+'%';
  $('wpnTxt').textContent=dailyText()+'\nArmas: '+ORDER.map(k=>WEAPONS[k].nome+(unlocked(k)?' ✓':' (nível '+WEAPONS[k].lvl+')')).join(' · ')+'\nTotal: '+(p.kills||0)+' eliminações, '+(p.head||0)+' na cabeça, '+(p.games||0)+' partidas';
}
function cycle(key,arr){const i=arr.indexOf(save.settings[key]);save.settings[key]=arr[(i+1)%arr.length];}
$('oMap').addEventListener('click',async()=>{const max=Math.min(MAIN-1,save.prog.unlocked||0);if(save.settings.level>=MAIN)save.settings.level=-1;save.settings.level=(save.settings.level+1)%(max+1);await loadLevel(save.settings.level);placeMenuModel();refreshMenu();persist();});
$('oDiff').addEventListener('click',()=>{cycle('diff',['recruta','regular','veterano']);refreshMenu();persist();});
$('oQual').addEventListener('click',()=>{cycle('quality',TIER_ORDER);applyQuality();refreshMenu();persist();});
$('oDebug').addEventListener('click',()=>{save.settings.debug=!save.settings.debug;debug.toggle(save.settings.debug);refreshMenu();persist();});
$('cardBtn').addEventListener('click',()=>nextCard());
$('oName').addEventListener('click',()=>{$('nameInput').value=save.prog.name||'';$('namebox').classList.remove('hidden');setTimeout(()=>$('nameInput').focus(),50);});
$('nameOk').addEventListener('click',()=>{const v=$('nameInput').value.replace(/[^A-Za-zÀ-ÿ0-9 ]/g,'').trim().toUpperCase().slice(0,10);save.prog.name=v;persist();$('namebox').classList.add('hidden');if(pmodel)pmodel.setNumber(texJersey(playerName()));refreshMenu();});
function applyHudScale(){try{document.documentElement.style.setProperty('--hud',String(save.settings.hud||0.85));}catch(e){}}
$('oHud').addEventListener('click',()=>{const opts=[0.7,0.85,1,1.15];const i=opts.indexOf(save.settings.hud||0.85);save.settings.hud=opts[(i+1)%opts.length];applyHudScale();refreshMenu();persist();});
$('oStory').addEventListener('click',()=>{showCards(PROLOGUE.map(c=>Object.assign({kicker:'Prólogo'},c)),null,false);});
$('oFull').addEventListener('click',()=>{if(isStandalone())return;if(fullscreenSupported()){try{const el=document.documentElement,fn=el.requestFullscreen||el.webkitRequestFullscreen||el.webkitRequestFullScreen;const pr=fn.call(el);if(pr&&pr.catch)pr.catch(()=>{});}catch(e){}}else{msg('iPhone: toca em Partilhar e depois em "Adicionar ao ecrã principal". Abre pelo ícone e joga em ecrã inteiro.','#f2c94c');alert('Para ecrã inteiro no iPhone:\n1. Toca no botão Partilhar do Safari\n2. Escolhe "Adicionar ao ecrã principal"\n3. Abre o jogo pelo ícone novo\n\n(Na app Documents não há ecrã inteiro; usa o Safari com um servidor ou o ficheiro publicado.)');}});
$('oSens').addEventListener('click',()=>{save.settings.sens=(save.settings.sens+1)%SENS.length;refreshMenu();persist();});
$('oAuto').addEventListener('click',()=>{save.settings.auto=!save.settings.auto;refreshMenu();persist();});
$('oLayout').addEventListener('click',()=>{ document.body.classList.add('editing'); uiEl.classList.add('on'); $('layoutBar').classList.remove('hidden'); });
$('lyDone').addEventListener('click',()=>{ document.body.classList.remove('editing'); $('layoutBar').classList.add('hidden'); if(mode!=='play')uiEl.classList.remove('on'); persist(); });
$('lyReset').addEventListener('click',()=>{ save.settings.layout={}; applyLayout(); persist(); });
setTimeout(()=>{ try{ applyLayout(); }catch(e){} },0);
$('oAssist').addEventListener('click',()=>{save.settings.assist=((save.settings.assist??1)+1)%3;refreshMenu();persist();});
$('oGyro').addEventListener('click',async()=>{const n=((save.settings.gyro||0)+1)%3;if(n===1&&typeof DeviceMotionEvent!=='undefined'&&typeof DeviceMotionEvent.requestPermission==='function'){try{const r=await DeviceMotionEvent.requestPermission();if(r!=='granted'){msg('O iPhone não deu permissão ao giroscópio','#bbb');save.settings.gyro=0;refreshMenu();persist();return;}}catch(e){}}save.settings.gyro=n;refreshMenu();persist();});
/* giroscópio: com o telemóvel deitado, rodar o corpo = beta, inclinar = gamma; 'Invertido' troca o sentido */
window.addEventListener('devicemotion',e=>{const gy=save.settings.gyro||0;if(!gy||mode!=='play'||!e.rotationRate)return;const rr=e.rotationRate;let it=e.interval||16;if(it>1)it/=1000;it=Math.min(0.05,it);const ang=(screen.orientation&&typeof screen.orientation.angle==='number')?screen.orientation.angle:(window.orientation||0);const sg=((ang===90||ang===-270)?1:-1)*(gy===2?-1:1),k=Math.PI/180*(ads?0.55:0.9)*it;P.yaw+=(rr.beta||0)*k*sg;P.pitch=clamp(P.pitch+(rr.gamma||0)*k*sg,-1.45,1.45);});
$('oSound').addEventListener('click',()=>{save.settings.sound=!save.settings.sound;if(!save.settings.sound)ambientOff();refreshMenu();persist();});
let menuWeapon=null;
function placeMenuModel(){ensurePlayerModel();if(pmodel){pmodel.spawn(G.START.x,0,G.START.z,Math.PI*0.92,1);pmodel.setLower('idle');pmodel.setUpper('idle_upper');if(pmodel.root)pmodel.root.visible=false;}
  try{ if(menuWeapon){scene.remove(menuWeapon);menuWeapon=null;} const v=views[cur]; const m=v&&v.group&&v.group.children[0]; if(m){ const clone=m.clone(true); clone.traverse(o=>{ if(o.isMesh){ o.frustumCulled=false; o.castShadow=true; } }); const box=new THREE.Box3().setFromObject(clone),size=box.getSize(new THREE.Vector3()),ctr=box.getCenter(new THREE.Vector3()); const sc=1.35/Math.max(size.x,size.y,size.z); const g=new THREE.Group(); clone.scale.setScalar(sc); clone.position.set(-ctr.x*sc,-ctr.y*sc,-ctr.z*sc); g.add(clone); g.position.set(G.START.x,1.05,G.START.z); g.rotation.y=Math.PI*0.5; menuWeapon=g; scene.add(g); } }catch(e){}
  try{menuThumbs();}catch(e){}}
/* miniaturas do estádio renderizadas pelo motor para os cartões do lobby */
function renderSceneThumb(px,py,pz,lx,ly,lz,W,H){ if(!renderer||!renderer.readRenderTargetPixels||!worldReady)return null;
  const rt=new THREE.WebGLRenderTarget(W,H,{samples:0}),cam=new THREE.PerspectiveCamera(52,W/H,0.1,400); cam.position.set(px,py,pz); cam.lookAt(lx,ly,lz); cam.updateProjectionMatrix();
  const prevRT=renderer.getRenderTarget(); renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene,cam);
  const buf=new Uint8Array(W*H*4); renderer.readRenderTargetPixels(rt,0,0,W,H,buf); renderer.setRenderTarget(prevRT); rt.dispose();
  const c=document.createElement('canvas'); c.width=W; c.height=H; const g=c.getContext('2d'); if(!g||!g.createImageData)return null;
  const img=g.createImageData(W,H); for(let y=0;y<H;y++){ const src=(H-1-y)*W*4,dst=y*W*4; img.data.set(buf.subarray(src,src+W*4),dst); } g.putImageData(img,0,0); return c.toDataURL('image/jpeg',0.82); }
function menuThumbs(){ const ST=G.START; const a=renderSceneThumb(ST.x+34,10,ST.z+30,ST.x-4,0.5,ST.z-6,480,220),b=renderSceneThumb(ST.x-32,9,ST.z+24,ST.x+8,0.5,ST.z-8,480,220);
  const i1=$('lbQuickImg'),i2=$('lbModesImg'); if(i1&&a)i1.src=a; if(i2&&b)i2.src=b; menuThumbCache={a,b}; try{for(const id of ['hubTdm','hubBall','hubBomb','hubTime','hubEndless']){const r=$(id);if(!r)continue;let im=r.querySelector('img.hgimg');if(!im){im=document.createElement('img');im.className='hgimg';im.alt='';r.insertBefore(im,r.firstChild);}im.src=(id==='hubTdm'||id==='hubBomb')?(a||''):(b||'');}}catch(e){} }
let menuThumbCache=null;
function clearWorldEntities(){for(const f of flying)scene.remove(f.m);flying.length=0;for(const c of c4s)scene.remove(c.m);c4s.length=0;for(const t of sentries)scene.remove(t.m);sentries.length=0;if(typeof updateGearBtns==='function')try{updateGearBtns();}catch(e){}
  for(const e of enemies)removeEnemy(e);for(const p of pickups)scene.remove(p.g);for(const g of grenades)scene.remove(g.m);for(const b of bombs)scene.remove(b.m);
  enemies=[];fireTok=[];for(const b of blasts)scene.remove(b.m);blasts.length=0;for(const b of bubbles){b.t=0;b.sp.visible=false;}pickups=[];msgs=[];dmgInd=[];grenades=[];bombs=[];dmgNums=[];banner=null;fireworksT=0;
  for(const t of tracers){t.alive=false;t.mesh.visible=false;}for(const s of shells){s.alive=false;s.mesh.visible=false;}clearDecals();
  smokePS.list.length=0;sparkPS.list.length=0;for(const f of fireSprites){f.t=0;f.sp.visible=false;}
}
async function startGame(opts){taRun=false;timeAttack=0;tdmClear();try{if(menuWeapon){scene.remove(menuWeapon);menuWeapon=null;}if(pmodel&&pmodel.root)pmodel.root.visible=true;}catch(e){}
  { const q=!!(opts&&opts.quick); quickRun=q; if(q){ if(!save.prog.lineBak)save.prog.lineBak=snapLoadout(); applyLoadout(arcadeBase()); }
    else { restoreLine(); lastQuickId=null; save.prog.cp=save.prog.cp||{}; const ck=String(save.settings.level); if(save.prog.cp[ck])applyLoadout(save.prog.cp[ck]); else save.prog.cp[ck]=snapLoadout(); }
    P.c4=0;P.mines=0;P.sentries=0; persist(); }
  if(mode==='loading')return;levelEnded=false;victoryGo=null;audioInit();clearWorldEntities();
  if(!worldReady||levelIdx!==save.settings.level){mode='loading';await loadLevel(save.settings.level);}
  diff=DIFF[save.settings.diff];endless=false;pendingAdvance=false;
  P.x=G.START.x;P.z=G.START.z;P.y=0;P.vy=0;P.yaw=0;P.pitch=0;P.hp=P.maxHp;P.alive=true;P.lastHit=-99;P.bob=0;P.moving=0;P.sprint=false;P.gren=2;P.prevYaw=0;P.prevPitch=0;P.roll=0;
  gameT=0;score=0;kills=0;head=0;xpGained=0;wave=0;toSpawn=0;clearing=false;waveBanner=0;fireCd=0;reloading=0;reloadAt=0;switching=0;ads=false;recoilK=0;muzzleT=0;hitT=0;hurtT=0;fireHeld=false;firePrev=false;flowCx=-1;flowCz=-1;flowT=0;streak=0;streakT=0;uavT=0;airReady=false;airT=0;fpsAcc=0;fpsN=0;fpsLow=0;shake=0;scoreT=0;
  $('btnStreak').classList.remove('on');
  runMods={money:1,score:1,bossHp:1};applyUpgrades();P.hp=P.maxHp;P.armor=0;runCash=0;nearShop=false;$('btnShop').classList.remove('on');
  cur='ar';for(const k of ORDER){wst[k]={mag:magOf(k),reserve:WEAPONS[k].reserve};views[k].group.visible=(k===cur);}
  vmx=HIP.x;vmy=HIP.y;vmz=HIP.z;joy.active=false;joy.vx=joy.vy=0;look.active=false;
  if(pmodel)pmodel.release();
  modClear();objClear();evtEnd();runMaxWave=0;objDone=0;bossSpawnT=0;bossKillT=0;ensureDaily();applyAttachments();for(const t of turrets)scene.remove(t.m);turrets=[];
  camera.fov=baseFov;camera.updateProjectionMatrix();
  menuEl.classList.add('hidden');overEl.classList.add('hidden');pauseEl.classList.add('hidden');headSaid=false;lowSaid=false;
  mode='story';await storyBeforeGame(opts);
  mode='play';uiEl.classList.add('on');
  save.prog.games++;persist();
  msg((team.final?'Final':(team.extra?'Jogo extra':'Jogo '+(levelIdx+1)+' de '+MAIN))+': '+team.nome+' · '+team.estadio,'#f2c94c');
  if(!quickRun&&team.scout)setTimeout(()=>{if(mode==='play')msg('OLHEIRO: '+team.scout,'#7fd7ff',3.4);},2600);
  startWave(1);lockPointer();ambientOn();goFullscreen();
}
function isStandalone(){return window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;}
function fullscreenSupported(){const el=document.documentElement;return !!(el.requestFullscreen||el.webkitRequestFullscreen||el.webkitRequestFullScreen);}
function goFullscreen(){if(!isTouch)return;try{const el=document.documentElement,fn=el.requestFullscreen||el.webkitRequestFullscreen;if(fn){const p=fn.call(el);if(p&&p.catch)p.catch(()=>{});}}catch(e){}try{if(screen.orientation&&screen.orientation.lock){const p=screen.orientation.lock('landscape');if(p&&p.catch)p.catch(()=>{});}}catch(e){}}
glc.addEventListener('webglcontextlost',e=>{e.preventDefault();if(mode==='play')pause();});
function pause(){if(mode!=='play')return;mode='pause';fireHeld=false;joy.active=false;joy.vx=joy.vy=0;look.active=false;pauseEl.classList.remove('hidden');try{const pi=$('pauseInfo');if(pi){const tl=(l,v)=>'<div class="rtile"><b>'+v+'</b><small>'+l+'</small></div>';pi.innerHTML='<div class="restiles">'+tl(tdm?'placar':(quickRun?'modo':(team.extra?'extra':'jogo')),tdm?tdm.sc[0]+'–'+tdm.sc[1]:(quickRun?(taRun?'Relógio':'Rápido'):(team.extra?team.nome:(levelIdx+1)+'/'+MAIN)))+tl('onda',wave)+tl('pontos',score.toLocaleString('pt-PT'))+tl('abates',kills)+'</div>';}const pt=$('pauseTitle');if(pt)pt.textContent=(quickRun?'Modo rápido':'Modo História')+' · '+team.nome;}catch(e){}if(document.pointerLockElement)document.exitPointerLock();ambientOff();}
function resume(){if(mode!=='pause')return;mode='play';pauseEl.classList.add('hidden');last=performance.now();lockPointer();ambientOn();}
async function toMenu(){
  clearWorldEntities();mode='menu';gameT=0;menuA=0;endless=false;
  for(const k of ORDER)views[k].group.visible=false;
  if(levelIdx!==save.settings.level){await loadLevel(save.settings.level);}
  placeMenuModel();camera.fov=baseFov;camera.updateProjectionMatrix();drawScoreboard();
  uiEl.classList.remove('on');pauseEl.classList.add('hidden');overEl.classList.add('hidden');menuEl.classList.remove('hidden');
  refreshMenu();if(document.pointerLockElement)document.exitPointerLock();ambientOff();
}
function gameOver(){
  mode='over';overT=0;fireHeld=false;joy.active=false;look.active=false;ads=false;
  for(const k of ORDER)views[k].group.visible=false;
  ensurePlayerModel();if(pmodel){pmodel.spawn(P.x,0,P.z,P.yaw,1);pmodel.playFull('death_back');}
  camera.fov=baseFov;camera.updateProjectionMatrix();uiEl.classList.remove('on');$('btnStreak').classList.remove('on');
  const key=save.settings.diff,prev=save.prog.best[key];const isNew=!prev||score>prev.score;
  if(isNew)save.prog.best[key]={levelIdx:levelIdx,wave:wave,score:score};save.prog.kills+=kills;save.prog.head+=head;
  if(!endless&&!taRun){save.prog.fails=save.prog.fails||{};save.prog.fails[team.key]=(save.prog.fails[team.key]||0)+1;}
  const wasTDM=tdm?{sc:tdm.sc.slice(),st:Object.assign({pk:0,pd:0,ak:0,ad:0},tdm.stats||{}),kind:tdm.bomb?'bomb':(tdm.ball?'ball':'tdm')}:null;tdmClear();
  if(quickRun){restoreLine();quickRun=false;}
  const wasTA=taRun;if(wasTA)save.prog.bestTA=Math.max(save.prog.bestTA||0,kills);taRun=false;timeAttack=0;persist();
  sfx('over');ambientOff();if(document.pointerLockElement)document.exitPointerLock();
  const capturedLevel=levelIdx,capturedWave=wave,capturedTeam=team.nome,wasEndless=endless;
  setTimeout(()=>{
    if(mode!=='over')return;
    const tile=(l,v)=>'<div class="rtile"><b>'+v+'</b><small>'+l+'</small></div>';
    $('stats').innerHTML='<div class="resscore"><b>'+score.toLocaleString('pt-PT')+'</b><small>pontos · '+diff.label+(wasTDM?' · modo de equipa':wasTA?' · contra-relógio (recorde '+(save.prog.bestTA||0)+' abates)':wasEndless?' · prolongamento':' · vs '+capturedTeam)+'</small></div>'+
      '<div class="restiles">'+(wasTDM?tile('teus abates',wasTDM.st.pk)+tile('tuas quedas',wasTDM.st.pd)+tile('abates dos colegas',wasTDM.st.ak)+tile(wasTDM.kind==='bomb'?'rondas':wasTDM.kind==='ball'?'golos':'placar',wasTDM.sc[0]+'–'+wasTDM.sc[1]):tile('abates',kills)+tile('na cabeça',head)+tile(wasEndless?'prolongamento':'jogo '+(capturedLevel+1),'Onda '+capturedWave)+tile('nível',save.prog.level))+'</div>'+
      '<div class="resrew"><span>+'+xpGained+' XP</span><span>+'+runCash.toLocaleString('pt-PT')+' €</span></div>'+
      '<span class="rec'+(isNew?' new':'')+'">'+(isNew?'★ Novo recorde nesta dificuldade':'Melhor: jogo '+(prev.levelIdx+1)+', onda '+prev.wave+', '+prev.score.toLocaleString('pt-PT')+' pts')+'</span>';
    {const hc=headlineCard('over');try{const rb=$('resBadge');if(rb)rb.textContent=wasTDM?(wasTDM.sc[0]>wasTDM.sc[1]?'VITÓRIA':'DERROTA'):(hc.win?'VITÓRIA':'FIM DE JOGO');}catch(e){}$('resTitle').textContent=wasTDM?((wasTDM.sc[0]>wasTDM.sc[1]?'Vitória dos Leões ':wasTDM.sc[0]<wasTDM.sc[1]?'Derrota dos Leões ':'Empate ')+wasTDM.sc[0]+'–'+wasTDM.sc[1]):hc.title;$('quip').textContent=wasTDM?({tdm:'Equipa contra Equipa · 5 contra 5',ball:'Roubar a Bola · golos',bomb:'Petardo no camarote · rondas'})[wasTDM.kind]:hc.sub;announce('death',{},true);}
    overEl.classList.remove('hidden');
  },1500);
}
/* ===================== Mapa-mundo e hub de modos ===================== */
const CONT=[ // continents (lon,lat), true proportions; Europe drawn in detail because it is zoomed
 [[-168,72],[-140,70],[-95,78],[-60,60],[-55,47],[-75,35],[-82,25],[-97,20],[-105,22],[-118,32],[-125,48],[-150,60],[-165,62]],
 [[-80,10],[-62,10],[-50,0],[-35,-8],[-40,-22],[-48,-28],[-58,-38],[-65,-50],[-72,-52],[-75,-40],[-70,-18],[-80,-5]],
 [[-9.5,43.5],[-1.8,43.4],[3.3,42.4],[0.5,40.5],[-0.3,38.5],[-2.2,36.8],[-6,36.2],[-9,37],[-9.5,39.5],[-8.8,42]],
 [[-4.7,48.4],[-1.5,49.5],[1.5,51],[4,53],[8.5,54],[10.5,56.5],[12,58],[11,62],[15,66],[22,70],[28,71],[31,66],[30,60],[24,57],[19,54.5],[15,53],[14.5,50],[17,48],[22,45],[28,44],[28,42],[23,40],[20,39],[17,41],[15,43],[12.5,44],[8.5,44],[6.5,43],[3.3,43.2],[-1.8,43.6],[-2,46.5]],
 [[7,44],[12,45],[13.6,45.8],[12.5,43],[15.5,41.5],[18.5,40],[16,38],[15.5,40],[12.5,41.5],[10,43.5],[8,44]],
 [[-5.7,50],[1.5,51],[1.7,52.8],[-0.5,54],[-2,56],[-3.5,58.5],[-6,58.5],[-5,56],[-3.5,54.5],[-3.2,53],[-5.5,51.5]],
 [[-10,51.5],[-6,52],[-6,55],[-8,55.3],[-10,53.5]],
 [[-17,15],[-17,32],[0,36],[10,37],[30,31],[43,11],[51,10],[40,-5],[35,-25],[20,-35],[12,-20],[9,4],[-5,5],[-15,10]],
 [[32,45],[40,50],[60,70],[100,78],[140,75],[180,68],[170,60],[140,52],[130,38],[120,25],[105,12],[100,5],[78,8],[68,22],[52,25],[45,35],[36,38]],
 [[114,-22],[120,-12],[135,-12],[145,-15],[153,-28],[147,-40],[133,-32],[118,-34]],
 [[130,32],[140,35],[145,44],[142,45],[133,36]]
];
const KINDS=['grass','grass','grass','grass','grass','grass','grass','sand','grass','sand','grass'];
const MAPV={lon0:-100,lon1:160,lat0:-58,lat1:76};
function mapXY(lon,lat,W,H){return [(lon-MAPV.lon0)/(MAPV.lon1-MAPV.lon0)*W,(MAPV.lat1-lat)/(MAPV.lat1-MAPV.lat0)*H];}
let mapSel=null;

const REGIONS={world:{nome:'Mundo',lon:[-100,160],lat:[-58,76]},europa:{nome:'Europa',lon:[-26,34],lat:[33,64],teams:['esp','fra','ale','ita','eng','ned','cft']},sul:{nome:'América do Sul',lon:[-84,-28],lat:[-57,13],teams:['bra','uru','arg']},asia:{nome:'Ásia',lon:[118,152],lat:[26,50],teams:['jpn']}};
let mapView={x:0,y:0,w:1600,h:896},mapRegion='world',mapAnim=null;
/* ---- cartoon world map: tilted ground plane (scale 0.62), vertical shaded cliffs per edge, upright props ---- */
let mapRngSeed=7;const mrnd=()=>{mapRngSeed=(mapRngSeed*1664525+1013904223)>>>0;return mapRngSeed/4294967296;};
const TILT=0.62,TOP=64;
const G2S=(x,y)=>[x,y*TILT+TOP];
function pointInPoly(pt,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const xi=poly[i][0],yi=poly[i][1],xj=poly[j][0],yj=poly[j][1];if(((yi>pt[1])!==(yj>pt[1]))&&(pt[0]<(xj-xi)*(pt[1]-yi)/(yj-yi)+xi))inside=!inside;}return inside;}
function polyPx(c,W,H){return c.map(p=>mapXY(p[0],p[1],W,H));}
function smoothPoly(pp,iters){let pts=pp.slice();for(let k=0;k<iters;k++){const out=[];for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];out.push([a[0]*0.75+b[0]*0.25,a[1]*0.75+b[1]*0.25]);out.push([a[0]*0.25+b[0]*0.75,a[1]*0.25+b[1]*0.75]);}pts=out;}return pts;}
function shrinkPoly(pp,k){const cx=pp.reduce((a,p)=>a+p[0],0)/pp.length,cy=pp.reduce((a,p)=>a+p[1],0)/pp.length;return pp.map(p=>[cx+(p[0]-cx)*k,cy+(p[1]-cy)*k]);}
function pathOf(pts){return 'M'+pts.map(p=>p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' L')+' Z';}
function cliffs(ptsG,depth,tone){ // vertical faces for south-facing edges, shaded by orientation
  let out='';const n=ptsG.length;let area=0;for(let i=0;i<n;i++){const a=ptsG[i],b=ptsG[(i+1)%n];area+=a[0]*b[1]-b[0]*a[1];}const cw=area<0;
  for(let i=0;i<n;i++){const a=ptsG[i],b=ptsG[(i+1)%n];let nx=b[1]-a[1],ny=-(b[0]-a[0]);if(cw){nx=-nx;ny=-ny;}const len=Math.hypot(nx,ny)||1;nx/=len;ny/=len;if(ny<=0.05)continue;
    const A=G2S(a[0],a[1]),B=G2S(b[0],b[1]);const shade=0.55+0.45*ny-0.25*Math.max(0,nx);const c=tone.map(v=>Math.round(v*shade));
    out+='<path d="M'+A[0].toFixed(1)+' '+A[1].toFixed(1)+' L'+B[0].toFixed(1)+' '+B[1].toFixed(1)+' L'+B[0].toFixed(1)+' '+(B[1]+depth).toFixed(1)+' L'+A[0].toFixed(1)+' '+(A[1]+depth).toFixed(1)+' Z" fill="rgb('+c.join(',')+')" stroke="#3b2714" stroke-width="1.2" stroke-linejoin="round"/>';
    for(let k=1;k<3;k++){const t=k/3;out+='<line x1="'+A[0].toFixed(1)+'" y1="'+(A[1]+depth*t).toFixed(1)+'" x2="'+B[0].toFixed(1)+'" y2="'+(B[1]+depth*t).toFixed(1)+'" stroke="rgba(0,0,0,.18)" stroke-width="1"/>';}}
  return out;}
function tree(x,y,s){return '<g transform="translate('+x.toFixed(1)+','+y.toFixed(1)+') scale('+s.toFixed(2)+')"><ellipse cy="3" rx="9" ry="3" fill="rgba(0,0,0,.28)"/><rect x="-2.2" y="-6" width="4.4" height="9" fill="#5a3a1e"/><circle cy="-12" r="9" fill="#2e8b3a" stroke="#1c5a22" stroke-width="1.6"/><circle cx="-4" cy="-15" r="5" fill="#55c25a" opacity=".85"/><circle cx="5" cy="-9" r="4" fill="#1f6b2a" opacity=".6"/></g>';}
function hill(x,y,s){return '<g transform="translate('+x.toFixed(1)+','+y.toFixed(1)+') scale('+s.toFixed(2)+')"><ellipse cy="2" rx="24" ry="6" fill="rgba(0,0,0,.22)"/><path d="M-24 0 Q0 -26 24 0 Z" fill="#6ec24d" stroke="#2f6b2a" stroke-width="1.8"/><path d="M-16 -3 Q-6 -18 6 -12" fill="none" stroke="#a6e880" stroke-width="3" stroke-linecap="round" opacity=".9"/></g>';}
function mountain(x,y,s){ // blends into the terrain: soft green skirt, two shaded faces, ridge, jagged snow cap
  return '<g transform="translate('+x.toFixed(1)+','+y.toFixed(1)+') scale('+s.toFixed(2)+')"><ellipse cy="3" rx="30" ry="8" fill="rgba(0,0,0,.22)"/><ellipse cy="1" rx="28" ry="7" fill="#5aa640" opacity=".9"/><path d="M-24 0 Q-14 -10 -6 -22 L0 -36 L7 -24 Q16 -10 24 0 Z" fill="#9a8668" stroke="#4a3f2a" stroke-width="1.8" stroke-linejoin="round"/><path d="M0 -36 L7 -24 Q16 -10 24 0 L4 0 Z" fill="#6e5e46"/><path d="M0 -36 L-2 -30 L1 -26 L-3 -20 L0 -14 L0 -36 Z" fill="rgba(255,255,255,.18)"/><path d="M-6 -22 L0 -36 L7 -24 L4 -20 L1 -24 L-2 -19 Z" fill="#fff"/><path d="M0 -36 L7 -24 L4 -20 L1 -24 Z" fill="#dfe8f0"/></g>';}
const RANGES=[[-1.5,42.7,1.0],[1.2,42.6,0.9],[7.5,46.2,1.15],[9.5,46.7,1.25],[11.5,46.9,1.05],[13.2,47.1,0.9],[11,44,0.7],[13,42.5,0.7],[8,62,0.9],[12,64.5,0.9],[15,66.5,0.8],[-4.5,57,0.7],[-3.3,37.1,0.8],[-70,-15,1.0],[-69,-22,1.15],[-70,-30,1.15],[-70.5,-37,1.0],[-72,-45,0.9],[-112,45,1.0],[-107,40,1.0],[-120,37,0.8],[85,29,1.35],[90,28,1.15],[80,31,1.05],[138.7,35.5,1.25],[-5,32,0.8],[29,-29,0.7],[100,45,0.9],[60,40,0.8]];
function mountainsLayer(W,H,sc){let o='';const pts=RANGES.map(m=>{const g=mapXY(m[0],m[1],W,H);return [g[0],g[1],m[2]];}).sort((a,b)=>a[1]-b[1]);for(const [x,y,z] of pts){const S=G2S(x,y);o+=mountain(S[0],S[1],z*sc);}return o;}
/* landmarks: stylised monuments, base at the origin, drawn upwards */
/* cenas dos países no mapa: desenhadas na mesma vista inclinada do mapa (chão comprimido TILT=0,62, objetos na vertical), luz da esquerda, sombras projetadas */
const LANDMARKS=(()=>{ const T=0.62,LN='#1f2a33',F=v=>(+v).toFixed(1);
  const shadow=(x,y,rx,ry)=>'<ellipse cx="'+F(x)+'" cy="'+F(y)+'" rx="'+F(rx)+'" ry="'+F(ry)+'" fill="rgba(20,40,20,.28)"/>';
  function corners(cx,cy,w,d,a,base){ const ca=Math.cos(a),sa=Math.sin(a); return [[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([x,y])=>[cx+x*ca-y*sa,cy+(x*sa+y*ca)*T-base]); }
  const N=[[0,-1],[1,0],[0,1],[-1,0]];
  function prism(cx,cy,w,d,h,a,top,l,r,base=0){ const P=corners(cx,cy,w,d,a,base),ca=Math.cos(a),sa=Math.sin(a);let o='';
    for(let i=0;i<4;i++){ const nx=N[i][0]*ca-N[i][1]*sa,ny=N[i][0]*sa+N[i][1]*ca; if(ny<=0.01)continue; const p=P[i],q=P[(i+1)%4];
      o+='<path d="M'+F(p[0])+' '+F(p[1])+' L'+F(q[0])+' '+F(q[1])+' L'+F(q[0])+' '+F(q[1]-h)+' L'+F(p[0])+' '+F(p[1]-h)+' Z" fill="'+(nx<0?l:r)+'" stroke="'+LN+'" stroke-width="1.2" stroke-linejoin="round"/>'; }
    return o+'<path d="M'+P.map(p=>F(p[0])+' '+F(p[1]-h)).join(' L')+' Z" fill="'+top+'" stroke="'+LN+'" stroke-width="1.2" stroke-linejoin="round"/>'; }
  function pyramid(cx,cy,w,d,h,a,base,l,r){ const P=corners(cx,cy,w,d,a,base),ca=Math.cos(a),sa=Math.sin(a),A=[cx,cy-base-h],fs=[];
    for(let i=0;i<4;i++){ const nx=N[i][0]*ca-N[i][1]*sa,ny=N[i][0]*sa+N[i][1]*ca; if(ny>-0.25)fs.push({p:P[i],q:P[(i+1)%4],nx,ny}); } fs.sort((x,y)=>x.ny-y.ny);
    return fs.map(f=>'<path d="M'+F(f.p[0])+' '+F(f.p[1])+' L'+F(f.q[0])+' '+F(f.q[1])+' L'+F(A[0])+' '+F(A[1])+' Z" fill="'+(f.nx<0?l:r)+'" stroke="'+LN+'" stroke-width="1.2" stroke-linejoin="round"/>').join(''); }
  function cyl(cx,cy,r,h,top,l,rr,base=0){ const ry=r*T,y0=cy-base;
    return '<path d="M'+F(cx-r)+' '+F(y0)+' A'+F(r)+' '+F(ry)+' 0 0 0 '+F(cx+r)+' '+F(y0)+' L'+F(cx+r)+' '+F(y0-h)+' L'+F(cx-r)+' '+F(y0-h)+' Z" fill="'+l+'" stroke="'+LN+'" stroke-width="1.2"/><path d="M'+F(cx+r*0.15)+' '+F(y0+ry*0.99)+' A'+F(r)+' '+F(ry)+' 0 0 0 '+F(cx+r)+' '+F(y0)+' L'+F(cx+r)+' '+F(y0-h)+' L'+F(cx+r*0.15)+' '+F(y0-h)+' Z" fill="'+rr+'"/><path d="M'+F(cx+r)+' '+F(y0)+' L'+F(cx+r)+' '+F(y0-h)+'" stroke="'+LN+'" stroke-width="1.2"/><ellipse cx="'+F(cx)+'" cy="'+F(y0-h)+'" rx="'+F(r)+'" ry="'+F(ry)+'" fill="'+top+'" stroke="'+LN+'" stroke-width="1.2"/>'; }
  function tree(x,y,r,c1,c2,fruit){ let o=shadow(x+r*0.6,y+1,r*1.15,r*0.42)+'<rect x="'+F(x-1.2)+'" y="'+F(y-r*1.1)+'" width="2.4" height="'+F(r*1.1)+'" fill="#6a4a2a" stroke="'+LN+'" stroke-width="1"/><circle cx="'+F(x)+'" cy="'+F(y-r*1.6)+'" r="'+F(r)+'" fill="'+c1+'" stroke="'+LN+'" stroke-width="1.2"/><path d="M'+F(x+r*0.15)+' '+F(y-r*2.58)+' A'+F(r)+' '+F(r)+' 0 0 1 '+F(x+r*0.15)+' '+F(y-r*0.62)+' A'+F(r*0.95)+' '+F(r*0.95)+' 0 0 0 '+F(x+r*0.15)+' '+F(y-r*2.58)+' Z" fill="'+c2+'"/><circle cx="'+F(x-r*0.35)+'" cy="'+F(y-r*1.95)+'" r="'+F(r*0.28)+'" fill="#ffffff" opacity=".25"/>';
    if(fruit)for(let i=0;i<4;i++)o+='<circle cx="'+F(x-r*0.45+i*r*0.3)+'" cy="'+F(y-r*1.6+((i%2)?-r*0.32:r*0.28))+'" r="1.4" fill="'+fruit+'" stroke="'+LN+'" stroke-width=".5"/>'; return o; }
  function palm(x,y,s){ let o=shadow(x+7*s,y+1,10*s,3*s)+'<path d="M'+F(x)+' '+F(y)+' Q'+F(x+4*s)+' '+F(y-13*s)+' '+F(x+1.5*s)+' '+F(y-25*s)+'" fill="none" stroke="#5a3e24" stroke-width="'+F(3.2*s)+'" stroke-linecap="round"/><path d="M'+F(x)+' '+F(y)+' Q'+F(x+4*s)+' '+F(y-13*s)+' '+F(x+1.5*s)+' '+F(y-25*s)+'" fill="none" stroke="#8a6a44" stroke-width="'+F(1.6*s)+'" stroke-linecap="round"/>';
    for(const a of [-2.7,-2.1,-1.4,-0.7,-0.1,0.5]) o+='<path d="M'+F(x+1.5*s)+' '+F(y-25*s)+' q'+F(Math.cos(a)*7*s)+' '+F(Math.sin(a)*4*s-4*s)+' '+F(Math.cos(a)*14*s)+' '+F(Math.sin(a)*3*s+4*s)+'" fill="none" stroke="#2f6a2a" stroke-width="'+F(3*s)+'" stroke-linecap="round"/><path d="M'+F(x+1.5*s)+' '+F(y-25*s)+' q'+F(Math.cos(a)*7*s)+' '+F(Math.sin(a)*4*s-4*s)+' '+F(Math.cos(a)*14*s)+' '+F(Math.sin(a)*3*s+4*s)+'" fill="none" stroke="#5aaa4a" stroke-width="'+F(1.4*s)+'" stroke-linecap="round"/>'; return o; }
  function house(cx,cy,w,d,h,a,wall,wallD,roof,roofD){ return shadow(cx+w*0.4,cy+2,w*0.8,d*0.5)+prism(cx,cy,w,d,h,a,wall,wall,wallD)+pyramid(cx,cy,w*1.1,d*1.12,h*0.8,a,h,roof,roofD); }
  const L={};
  L.esp=house(-17,5,12,9,8,0.35,'#f7f3ea','#d8d2c4','#d0683c','#a04a2a')+shadow(12,3,15,4.5)+prism(0,0,11,11,40,0.25,'#efd9a8','#e2c28c','#c9a46a')
    +'<path d="M-4.2 -12 v-5 M-4.2 -23 v-5 M-4.2 -33 v-4" stroke="#6a4a2a" stroke-width="1.6" stroke-linecap="round"/>'+prism(0,0,9.5,9.5,9,0.25,'#fbf6ea','#f4ead6','#d9cdb4',40)
    +'<path d="M-3.8 -42 v-4.5" stroke="#6a4a2a" stroke-width="2" stroke-linecap="round"/>'+prism(0,0,6,6,6,0.25,'#efd9a8','#e2c28c','#c9a46a',49)+pyramid(0,0,4.6,4.6,8,0.25,55,'#e0b84a','#a8801a')+'<line x1="0" y1="-63" x2="0" y2="-67" stroke="'+LN+'" stroke-width="1.2"/>'
    +house(19,9,14,9,9,-0.3,'#f4ead8','#d6c8ae','#d0683c','#a04a2a')+tree(-26,11,4.5,'#4f9a45','#3b7c35','#f29a2a');
  const eif='M-11 0 L-4 -20 L-2.2 -36 L0 -54 L2.2 -36 L4 -20 L11 0 L6 0 Q0 -9 -6 0 Z';
  L.fra=house(-19,4,14,9,11,0.3,'#f1e6cf','#d8caa8','#5f7185','#46586a')+shadow(12,2,15,4.5)+'<path transform="translate(2.4,-1.4)" d="'+eif+'" fill="#5a412c" stroke="'+LN+'" stroke-width="1.2" stroke-linejoin="round"/><path d="'+eif+'" fill="#a07c56" stroke="'+LN+'" stroke-width="1.4" stroke-linejoin="round"/><path d="M0 -54 L2.2 -36 L4 -20 L11 0 L6 0 Q3 -5 0 -6 Z" fill="#806040"/>'
    +prism(1,-20.5,16,5,2.6,0,'#c49a6a','#a07c56','#806040')+prism(1,-36.5,9,3.5,2.2,0,'#c49a6a','#a07c56','#806040')+'<path d="M-6.5 -8 L7 -8 M-3.3 -28 L3.6 -28" stroke="#4a3624" stroke-width="1"/><line x1="0" y1="-54" x2="0" y2="-60" stroke="'+LN+'" stroke-width="1.4" stroke-linecap="round"/>'+tree(21,6,4.8,'#4f9a45','#3b7c35');
  L.ale=shadow(26,-2,7,2)+cyl(26,-6,1.3,40,'#eeeeee','#e0e0e0','#b8b8b8')+'<circle cx="26" cy="-50" r="4.6" fill="#c8d0d8" stroke="'+LN+'" stroke-width="1.2"/><path d="M26 -54.6 A4.6 4.6 0 0 1 26 -45.4 A4 4 0 0 0 26 -54.6 Z" fill="#9aa4ae"/><line x1="26" y1="-55" x2="26" y2="-62" stroke="'+LN+'" stroke-width="1"/>'
    +shadow(8,4,26,5)+prism(0,2,40,10,3,0,'#e0d2b0','#d0c09a','#b8a67e')+[-15,-9,-3,3,9,15].map(x=>cyl(x,4,1.7,15,'#efe4c8','#e8dcc0','#c0ae82',3)).join('')+prism(0,2,42,12,5,0,'#f2e8ce','#e8dcc0','#c8b890',18)+prism(0,2,16,8,5,0,'#e0d2b0','#d0c09a','#b8a67e',23)
    +'<path d="M-6 -26.5 L-5 -32.5 L-2 -30.5 L0 -35.5 L2 -30.5 L5 -32.5 L6 -26.5 Z" fill="#4a8a7a" stroke="'+LN+'" stroke-width="1.2" stroke-linejoin="round"/>';
  L.eng=shadow(10,2,12,4)+prism(0,0,10,10,38,0.3,'#eed7a2','#d9c08a','#b99c62')+'<path d="M-3.8 -8 v-24" stroke="#8a7040" stroke-width="1"/>'+prism(0,0,12,12,9,0.3,'#eed7a2','#d9c08a','#b99c62',38)+'<circle cx="-2.4" cy="-42.5" r="3.2" fill="#fffbe8" stroke="'+LN+'" stroke-width="1.1"/><path d="M-2.4 -42.5 v-2.2 M-2.4 -42.5 h1.6" stroke="'+LN+'" stroke-width=".8"/>'+pyramid(0,0,12.5,12.5,13,0.3,47,'#4e5e6e','#34424f')
    +shadow(-16,9,4,1.6)+prism(-17,8,4,4,11,0.2,'#f0563f','#d8322a','#a8201a')+'<rect x="-19.2" y="-1" width="2.6" height="3" fill="#cfe8ff"/>'
    +shadow(24,11,13,3.5)+prism(21,10,19,7,10,-0.12,'#f0563f','#d8322a','#a8201a')+'<path d="M13 3.5 h14 M13 -1 h14" stroke="#fff4d0" stroke-width="1.8"/><circle cx="15" cy="11" r="2" fill="#1f2a33"/><circle cx="26" cy="9.6" r="2" fill="#1f2a33"/>';
  L.ned=[0,1,2,3,4].map(i=>'<path d="M-30 '+F(7+i*3.2)+' L28 '+F(5+i*3.2)+'" stroke="'+['#e84a6a','#f2c94c','#f4f4f4','#e86a2a','#c84aa8'][i]+'" stroke-width="2.2" stroke-linecap="round"/>').join('')
    +shadow(10,2,11,3.6)+cyl(0,0,7,24,'#c0724a','#a0522d','#84421f')+'<rect x="-3.2" y="-7" width="3.6" height="7" rx="1.4" fill="#3a2a1a"/><path d="M-8 -24 Q0 -37 8 -24 Z" fill="#6a5a4a" stroke="'+LN+'" stroke-width="1.3"/><g transform="translate(0 -28) rotate(20)">'
    +[0,90,180,270].map(a=>'<g transform="rotate('+a+')"><rect x="-1.4" y="-22" width="4.4" height="20" fill="#f7f1e2" stroke="'+LN+'" stroke-width="1"/><path d="M-1.4 -17 h4.4 M-1.4 -12 h4.4 M-1.4 -7 h4.4" stroke="#b8ae98" stroke-width=".8"/></g>').join('')+'<circle r="2" fill="#3a2a1a" stroke="'+LN+'" stroke-width=".8"/></g>';
  L.bra='<ellipse cx="10" cy="8" rx="30" ry="7" fill="#f2dca0" stroke="#d8bc78" stroke-width="1"/>'+shadow(26,2,9,3)+'<path d="M12 4 Q11 -18 20 -28 Q29 -20 29 4 Z" fill="#9aa08a" stroke="'+LN+'" stroke-width="1.4" stroke-linejoin="round"/><path d="M20 -28 Q29 -20 29 4 L21 4 Q23 -12 20 -28 Z" fill="#767c66"/><path d="M13 -9 Q20 -12 28 -8" stroke="#5aa640" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
    +shadow(2,2,18,4.5)+'<path d="M-24 2 Q-16 -12 -8 -28 Q-4 -38 0 -38 Q6 -32 10 -18 Q14 -6 18 2 Z" fill="#56a64a" stroke="'+LN+'" stroke-width="1.5" stroke-linejoin="round"/><path d="M0 -38 Q6 -32 10 -18 Q14 -6 18 2 L4 2 Q6 -16 0 -38 Z" fill="#3f8436"/>'
    +'<rect x="-1.8" y="-42" width="3.6" height="4" fill="#e8e8e2" stroke="'+LN+'" stroke-width="1"/><rect x="-1.5" y="-54" width="3" height="12" rx="1" fill="#f7f7f2" stroke="'+LN+'" stroke-width="1.1"/><rect x="-9" y="-52" width="18" height="2.4" rx="1.2" fill="#f7f7f2" stroke="'+LN+'" stroke-width="1.1"/><circle cy="-56" r="1.9" fill="#f7f7f2" stroke="'+LN+'" stroke-width="1"/>'+palm(-20,10,0.9);
  L.arg=house(-19,4,10,9,9,0.3,'#3a7ae0','#2a5ab0','#d8323a','#a82028')+house(-8,11,10,8,8,0.2,'#f2c94c','#caa032','#3fa55a','#2a7a3a')
    +shadow(9,2,13,4)+prism(0,0,7,7,46,0.78,'#fdfbf6','#f0ece2','#cbc4b4')+pyramid(0,0,7,7,6.5,0.78,46,'#f0ece2','#cbc4b4')+'<rect x="-1" y="-41" width="2" height="2.8" fill="#5a5048"/>'+house(19,8,11,9,9,-0.25,'#e84a3a','#b8302a','#2a6ab8','#1a4a88');
  L.uru=shadow(12,3,16,5)+prism(0,0,18,14,20,0.3,'#eadcbc','#d8c9a8','#bfae88')+[0,1,2].map(r=>'<path d="M-6.5 '+F(-5-r*6)+' h4 M-0.5 '+F(-6-r*6)+' h3" stroke="#6a5a44" stroke-width="1.6"/>').join('')+prism(0,0,11,9,15,0.3,'#eadcbc','#d8c9a8','#bfae88',20)+prism(0,0,6,6,8,0.3,'#eadcbc','#d8c9a8','#bfae88',35)
    +'<path d="M-3.4 -43 Q0 -51 3.4 -43 Z" fill="#6a8a9a" stroke="'+LN+'" stroke-width="1.1"/><line x1="0" y1="-49" x2="0" y2="-55" stroke="'+LN+'" stroke-width="1.1"/>'+palm(20,8,0.8);
  L.jpn=tree(-18,2,5,'#f7b4cf','#e48ab2')+shadow(6,3,16,4)+cyl(-8,0,1.7,24,'#f0563f','#e84a3a','#a8201a')+cyl(8,0,1.7,24,'#f0563f','#d8322a','#a8201a')+prism(0,0,24,3,2.4,0,'#f0563f','#e84a3a','#a8201a',18)
    +'<rect x="-1.2" y="-23" width="2.4" height="3.4" fill="#e84a3a" stroke="'+LN+'" stroke-width="1"/>'+prism(0,0,28,3.4,2.4,0,'#f0563f','#e84a3a','#a8201a',23)+'<path d="M-16 -25.4 Q0 -30.5 16 -25.4 L15 -23.2 L-15 -23.2 Z" fill="#26313a" stroke="'+LN+'" stroke-width="1"/>'+tree(20,8,4.6,'#f7b4cf','#e48ab2');
  return L; })();
const LMOFF={uru:[40,44]}; // cenas que cairiam no mar: posição própria
function landmarksLayer(W,H){let o='';for(const t of TEAMS){const lm=LANDMARKS[t.key];if(!lm)continue;const g=mapXY(t.map.lon,t.map.lat,W,H);const S=G2S(g[0],g[1]);const side=(['ned','eng','esp','bra','jpn'].includes(t.key))?-1:1;o+='<g class="lm" data-k="'+t.key+'" data-p="'+S[0].toFixed(1)+','+S[1].toFixed(1)+'"><g transform="translate('+((LMOFF[t.key]||[76*side])[0])+','+((LMOFF[t.key]||[0,20])[1])+') scale(1.25)"><g class="lmi"><ellipse cy="4" rx="36" ry="12" fill="#6aa84c" opacity=".55"/>'+lm+'</g></g></g>';}return o;}
function flowers(x,y){let o='';for(let k=0;k<4;k++){const dx=(mrnd()-0.5)*18,dy=(mrnd()-0.5)*8;o+='<circle cx="'+(x+dx).toFixed(1)+'" cy="'+(y+dy).toFixed(1)+'" r="2.2" fill="'+(k%2?'#ffe66d':'#ffffff')+'" stroke="#c98a12" stroke-width=".8"/>';}return o;}
function scatter(ptsG,kind,W,H,dense){let xs=ptsG.map(p=>p[0]),ys=ptsG.map(p=>p[1]);const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);const area=(x1-x0)*(y1-y0);const PS=dense?0.42:0.7;
  const items=[];const n=Math.max(dense?6:2,Math.round(area/(dense?1600:12000)));let tries=0;while(items.length<n&&tries<600){tries++;const x=x0+mrnd()*(x1-x0),y=y0+mrnd()*(y1-y0);if(!pointInPoly([x,y],ptsG))continue;items.push([x,y]);}
  items.sort((a,b)=>a[1]-b[1]);let out='';for(const [x,y] of items){const S=G2S(x,y);const r=mrnd();
    if(kind==='sand'){out+='<ellipse cx="'+S[0].toFixed(1)+'" cy="'+S[1].toFixed(1)+'" rx="'+(14*PS).toFixed(1)+'" ry="'+(5*PS).toFixed(1)+'" fill="#f0dc9a" stroke="#c9ad5a" stroke-width="1"/>';}
    else if(r<0.35)out+=hill(S[0],S[1],PS*(0.7+mrnd()*0.6));else if(r<0.82)out+=tree(S[0],S[1],PS*(0.8+mrnd()*0.5));else out+=flowers(S[0],S[1]);}
  return out;}

function heroSprite(x,y,sc){return '<g transform="translate('+x.toFixed(0)+','+y.toFixed(0)+') scale('+sc+')"><ellipse cx="0" cy="16" rx="13" ry="4.5" fill="rgba(0,0,0,.35)"/><g><animateTransform attributeName="transform" type="translate" values="0 0;0 -7;0 0" dur="0.85s" repeatCount="indefinite"/><rect x="-8" y="-4" width="16" height="17" rx="5" fill="#d8202a" stroke="#3a0a10" stroke-width="2.2"/><rect x="-7" y="11" width="6" height="8" rx="2" fill="#1c6b2a" stroke="#0e3a14" stroke-width="1.5"/><rect x="1" y="11" width="6" height="8" rx="2" fill="#1c6b2a" stroke="#0e3a14" stroke-width="1.5"/><circle cx="0" cy="-13" r="10" fill="#f1c9a5" stroke="#4a2a1a" stroke-width="2.2"/><path d="M-10 -15 q10 -14 20 0 q-5 -5 -10 -4 q-5 -1 -10 4z" fill="#2a1a0e"/><circle cx="-3.5" cy="-13" r="1.6" fill="#222"/><circle cx="3.5" cy="-13" r="1.6" fill="#222"/><path d="M-3 -8 q3 3 6 0" fill="none" stroke="#7a3a2a" stroke-width="1.4"/><rect x="-15" y="-2" width="10" height="4.5" rx="2" fill="#2c2e33" transform="rotate(-25)"/></g></g>';}
/* ---------- progresso, rota e estados ---------- */
const FINAL_IDX=TEAMS.findIndex(t=>t.final);
function isWon(i){const t=TEAMS[i];if(t.extra)return !!(save.prog.extraDone&&save.prog.extraDone[t.key]);if(t.final)return !!save.prog.champion;return i<(save.prog.unlocked||0);}
function teamState(i){const t=TEAMS[i],u=save.prog.unlocked||0;if(t.extra)return u>=2?'open':'locked';if(t.final)return u>=MAIN?'open':'locked';return i<=u?'open':'locked';}
function nextIdx(){const u=save.prog.unlocked||0;if(u<MAIN)return u;if(FINAL_IDX>=0&&!save.prog.champion)return FINAL_IDX;return MAIN-1;}
function regionOf(i){if(i==='home')return 'europa';const k=TEAMS[i].key;for(const rk of Object.keys(REGIONS)){const R=REGIONS[rk];if(R.teams&&R.teams.includes(k))return rk;}return 'world';}
const SIDE={ita:1,eng:1,ned:2,uru:4,jpn:3};
function allSegs(){const out=[];let prev='home';const route=[];for(let i=0;i<MAIN;i++)route.push(i);if(FINAL_IDX>=0)route.push(FINAL_IDX);
  for(const i of route){out.push({from:prev,to:i,kind:(prev==='home'||regionOf(prev)!==regionOf(i))?'flight':'road',main:true});prev=i;}
  TEAMS.forEach((t,i)=>{if(t.extra&&SIDE[t.key]!==undefined){const f=SIDE[t.key];out.push({from:f,to:i,kind:regionOf(f)!==regionOf(i)?'flight':'road',side:true});}});return out;}
function segIndexTo(i){return allSegs().findIndex(s=>s.to===i&&s.main);}
function segRevealed(s){if(s.side)return teamState(s.to)==='open';if(s.from==='home')return !!save.prog.introDone||(save.prog.unlocked||0)>0;return teamState(s.to)==='open';}
const MW=1600,MH=896; // mundo do mapa 60% maior: os ícones mantêm o tamanho, por isso ficam mais afastados
function npos(i){const g=i==='home'?mapXY(-28,38,MW,MH):mapXY(TEAMS[i].map.lon,TEAMS[i].map.lat,MW,MH);return G2S(g[0],g[1]);}
function segD(a,b,kind,alt,side){const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1;let cx,cy;
  if(kind==='flight'){cx=mx;cy=Math.max(24,my-L*0.3);}else{const s=(alt?1:-1)*(side?0.12:0.2);cx=mx-dy*s;cy=my+dx*s;}
  return 'M'+a[0].toFixed(1)+' '+a[1].toFixed(1)+' Q'+cx.toFixed(1)+' '+cy.toFixed(1)+' '+b[0].toFixed(1)+' '+b[1].toFixed(1);}
function segStrokes(d,kind,side){const w=side?0.7:1;
  if(kind==='flight')return '<path d="'+d+'" fill="none" stroke="rgba(0,0,0,.28)" data-w="'+(4.5*w)+'" data-d="10 9" stroke-linecap="round" transform="translate(0,2)"/><path d="'+d+'" fill="none" stroke="#ffffff" data-w="'+(3.2*w)+'" data-d="10 9" stroke-linecap="round"/>';
  return '<path class="rv" d="'+d+'" fill="none" stroke="rgba(40,24,10,.55)" data-w="'+(11*w)+'" stroke-linecap="round"/><path class="rv" d="'+d+'" fill="none" stroke="#e8c98a" data-w="'+(7.5*w)+'" stroke-linecap="round"/><path class="dots" d="'+d+'" fill="none" stroke="#fff7e0" data-w="'+(2.6*w)+'" data-d="1 10" stroke-linecap="round"/>';}
/* ---------- ícones desenhados (sem emojis) ---------- */
function lockIcon(){return '<g><rect x="-8" y="-5" width="16" height="13" rx="3" fill="#f2c94c" stroke="#3a2a00" stroke-width="2.2"/><path d="M-4.5 -5 v-4 a4.5 4.5 0 0 1 9 0 v4" fill="none" stroke="#3a2a00" stroke-width="2.6"/><circle cy="1" r="2" fill="#3a2a00"/></g>';}
function trophyIcon(){return '<g><path d="M-8 -10 h16 v5 a8 8 0 0 1 -16 0 z" fill="#ffd84a" stroke="#5a3a00" stroke-width="2"/><path d="M-8 -8 h-4 a4 4 0 0 0 5 6 M8 -8 h4 a4 4 0 0 1 -5 6" fill="none" stroke="#5a3a00" stroke-width="1.8"/><rect x="-2.5" y="2" width="5" height="5" fill="#ffd84a" stroke="#5a3a00" stroke-width="1.5"/><rect x="-7" y="7" width="14" height="4" rx="1.5" fill="#ffd84a" stroke="#5a3a00" stroke-width="1.5"/><path d="M-4 -8 v4" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".8"/></g>';}
function folderIcon(){return '<g><path d="M-10 -6 h7 l2 2 h11 v12 h-20 z" fill="#f2c94c" stroke="#3a2a00" stroke-width="2"/><path d="M-10 -2 h20" stroke="#3a2a00" stroke-width="1.5"/><text y="6" text-anchor="middle" font-size="7" font-weight="900" fill="#3a2a00">?</text></g>';}
function planeSprite(){return '<g><path d="M-18 0 L10 -3.5 Q20 0 10 3.5 Z" fill="#ffffff" stroke="#1f2a33" stroke-width="2"/><path d="M-2 -2.5 L-9 -14 L-3 -14 L5 -2.5 Z M-2 2.5 L-9 14 L-3 14 L5 2.5 Z" fill="#e3262d" stroke="#1f2a33" stroke-width="1.6" stroke-linejoin="round"/><path d="M-15 -1 L-20 -8 L-16 -8 L-11 -1 Z" fill="#e3262d" stroke="#1f2a33" stroke-width="1.4"/><circle cx="9" cy="-1" r="1.4" fill="#5ec8ff"/></g>';}
function stadiumIcon(t,r,st,num){
  const col='#'+t.shirt.toString(16).padStart(6,'0'),col2='#'+t.shorts.toString(16).padStart(6,'0'),g=st==='locked';
  const sc=r/19;let o='<g transform="scale('+sc.toFixed(2)+')">';
  if(st==='next')o+='<ellipse cy="6" rx="46" ry="18" fill="#fff6a0" opacity=".35"><animate attributeName="opacity" values=".12;.55;.12" dur="1.3s" repeatCount="indefinite"/><animate attributeName="rx" values="40;52;40" dur="1.3s" repeatCount="indefinite"/></ellipse>';
  if(t.final){
    o+='<ellipse cy="16" rx="50" ry="9" fill="rgba(255,255,255,.35)"/><path d="M-46 0 L46 0 L35 17 L-37 17 Z" fill="'+(g?'#8a8f98':'#fbfbfb')+'" stroke="#1e2126" stroke-width="2.4" stroke-linejoin="round"/><path d="M-44 5 L43 5" stroke="'+(g?'#6a6f77':'#f2c94c')+'" stroke-width="3"/><rect x="-30" y="-13" width="26" height="13" rx="2" fill="'+(g?'#9a9fa8':'#e9e3d0')+'" stroke="#1e2126" stroke-width="2"/><rect x="-26" y="-9" width="6" height="4" fill="#5ec8ff"/><rect x="-16" y="-9" width="6" height="4" fill="#5ec8ff"/><ellipse cx="20" cy="-4" rx="18" ry="7" fill="'+(g?'#6a6f77':'#4fb44f')+'" stroke="#1e2126" stroke-width="2"/><ellipse cx="20" cy="-4" rx="10" ry="3.5" fill="none" stroke="#e8ffe8" stroke-width="1"/><line x1="-20" y1="-13" x2="-20" y2="-36" stroke="#1e2126" stroke-width="2.2"/><path d="M-20 -36 l20 6 l-20 6 z" fill="'+(g?'#8a8f98':'#ffd84a')+'" stroke="#1e2126" stroke-width="1.5"/><text x="-13" y="-26.5" text-anchor="middle" font-size="9" font-weight="900" fill="#1a1200">'+(num||'F')+'</text>';
  } else {
    o+='<ellipse cx="0" cy="16" rx="34" ry="12" fill="rgba(0,0,0,.35)"/>';
    o+='<path d="M-30 6 a30 12 0 0 0 60 0 v-8 a30 12 0 0 1 -60 0 z" fill="'+(g?'#3a3e45':'#5c6168')+'" stroke="#1e2126" stroke-width="2"/>';
    o+='<path d="M-30 -2 a30 12 0 0 0 60 0" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="3"/>';
    o+='<ellipse cx="0" cy="-2" rx="30" ry="12" fill="'+(g?'#7a7f88':col)+'" stroke="#1e2126" stroke-width="2"/><ellipse cx="0" cy="-2" rx="30" ry="12" fill="url(#gloss)"/>';
    o+='<ellipse cx="0" cy="-2" rx="17" ry="7" fill="'+(g?'#6a6f77':'#4fb44f')+'" stroke="#1e5e22" stroke-width="1.5"/><ellipse cx="0" cy="-2" rx="16" ry="6" fill="none" stroke="#e8ffe8" stroke-width="1"/><line x1="0" y1="-8" x2="0" y2="4" stroke="#e8ffe8" stroke-width="1"/>';
    o+='<path d="M-30 -2 a30 12 0 0 1 60 0" fill="none" stroke="'+(g?'#9a9fa8':col2)+'" stroke-width="5"/>';
    o+='<g>'+(st==='next'?'<animateTransform attributeName="transform" type="translate" values="0 0;0 -5;0 0" dur="0.8s" repeatCount="indefinite"/>':'')+'<line x1="26" y1="-4" x2="26" y2="-40" stroke="#3b2714" stroke-width="2.5"/><path d="M26 -40 l22 7 l-22 7 z" fill="'+(g?'#8a8f98':'#ffd84a')+'" stroke="#3b2714" stroke-width="1.5"/><text x="34" y="-29.5" text-anchor="middle" font-size="10" font-weight="900" fill="#1a1200">'+(num||'★')+'</text></g>';
  }
  if(st==='won')o+='<g transform="translate(-30,-24)">'+trophyIcon()+'</g>';
  if(g)o+='<g transform="translate(0,-2)">'+lockIcon()+'</g>';
  if(t.extra&&!g&&st!=='won'&&!(save.prog.evidence&&save.prog.evidence[t.key]))o+='<g transform="translate(-30,-22)">'+folderIcon()+'</g>';
  return o+'</g>';}
/* ---------- câmara do mapa ---------- */
function clampView(v){v.w=Math.max(140,Math.min(MW,v.w));v.h=v.w*(MH/MW);v.x=Math.max(0,Math.min(MW-v.w,v.x));v.y=Math.max(0,Math.min(MH-v.h,v.y));return v;}
function regionBox(key){const R=REGIONS[key];if(!R||key==='world')return {x:0,y:0,w:MW,h:MH};const a=mapXY(R.lon[0],R.lat[1],MW,MH),b=mapXY(R.lon[1],R.lat[0],MW,MH);const A=G2S(a[0],a[1]),B=G2S(b[0],b[1]);return zoomBox(boxAround([[A[0],A[1]-10],[B[0],B[1]+30]],0),key);}
/* com o mundo 1,6x maior, cada região aproxima-se na mesma proporção (ícones ao tamanho de antes, mais espaço entre eles), centrada no estádio escolhido */
const REGION_ZOOM=1.9;
function zoomBox(f,key){ const w=f.w/REGION_ZOOM,h=f.h/REGION_ZOOM,R=REGIONS[key]; let cx=f.x+f.w/2,cy=f.y+f.h/2; const tk=(mapSel!=null&&TEAMS[mapSel])?TEAMS[mapSel].key:null; if(tk&&R&&R.teams&&R.teams.includes(tk)){ const p=npos(mapSel); cx=Math.min(Math.max(p[0],f.x+w/2),f.x+f.w-w/2); cy=Math.min(Math.max(p[1]-10,f.y+h/2),f.y+f.h-h/2); } return clampView({x:cx-w/2,y:cy-h/2,w,h}); }
function boxAround(pts,pad){let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const p of pts){x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1]);}x0-=pad;x1+=pad;y0-=pad;y1+=pad;let w=Math.max(180,x1-x0),h=Math.max(100,y1-y0);const asp=MW/MH;if(w/h<asp)w=h*asp;else h=w/asp;return clampView({x:(x0+x1)/2-w/2,y:(y0+y1)/2-h/2,w,h});}
function setView(v,animate,dur){if(mapAnim)cancelAnimationFrame(mapAnim);if(!animate||typeof requestAnimationFrame!=='function'){mapView=v;applyView();return Promise.resolve();}const from=Object.assign({},mapView),t0=performance.now(),D=dur||650;return new Promise(res=>{const step=now=>{const t=Math.min(1,(now-t0)/D),e=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;mapView={x:from.x+(v.x-from.x)*e,y:from.y+(v.y-from.y)*e,w:from.w+(v.w-from.w)*e,h:from.h+(v.h-from.h)*e};applyView();if(t<1)mapAnim=requestAnimationFrame(step);else{mapAnim=null;res();}};mapAnim=requestAnimationFrame(step);});}
function viewScale(){const svg=$('mapSvg');const r=svg.getBoundingClientRect?svg.getBoundingClientRect():null;if(!r||!r.width)return null;const s=Math.max(r.width/mapView.w,r.height/mapView.h);return {r,s,ox:(r.width-mapView.w*s)/2,oy:(r.height-mapView.h*s)/2};}
function toScreenMap(px,py){const v=viewScale();if(!v)return null;return [v.r.left+v.ox+(px-mapView.x)*v.s,v.r.top+v.oy+(py-mapView.y)*v.s];}
function toViewMap(cx,cy,view){const svg=$('mapSvg');const r=svg.getBoundingClientRect();const vw=view||mapView;const s=Math.max(r.width/vw.w,r.height/vw.h),ox=(r.width-vw.w*s)/2,oy=(r.height-vw.h*s)/2;return [vw.x+(cx-r.left-ox)/s,vw.y+(cy-r.top-oy)/s];}
function mapQ(sel){const svg=$('mapSvg');return svg.querySelectorAll?Array.from(svg.querySelectorAll(sel)).filter(e=>e&&e.getAttribute):[];}
function mapQ1(sel){const svg=$('mapSvg');const r=svg.querySelector?svg.querySelector(sel):null;return (r&&r.getAttribute)?r:null;}
function applyView(){const svg=$('mapSvg');svg.setAttribute('viewBox',mapView.x.toFixed(1)+' '+mapView.y.toFixed(1)+' '+mapView.w.toFixed(1)+' '+mapView.h.toFixed(1));const k=mapView.w/MW;const zoomed=k<0.55;
  svg.classList.toggle('zoomed',zoomed);const pp=el=>(el.getAttribute('data-p')||'0,0').split(',');
  for(const n of mapQ('.node')){const p=pp(n);n.setAttribute('transform','translate('+p[0]+','+p[1]+') scale('+(k*(zoomed?1.35:0.6)).toFixed(3)+')');}
  for(const l of mapQ('.lm')){const p=pp(l);l.setAttribute('transform','translate('+p[0]+','+p[1]+') scale('+(k*(zoomed?2.4:1.3)).toFixed(3)+')');}
  const hm=mapQ1('#homeG');if(hm){const p=pp(hm);hm.setAttribute('transform','translate('+p[0]+','+p[1]+') scale('+(k*(zoomed?1:0.6)).toFixed(3)+')');}
  const h=mapQ1('#heroG');if(h){const p=pp(h);h.setAttribute('transform','translate('+p[0]+','+p[1]+') scale('+(k*1.3).toFixed(3)+')');}
  for(const r of mapQ('.regionlbl')){const p=pp(r);r.setAttribute('transform','translate('+p[0]+','+p[1]+') scale('+k.toFixed(3)+')');r.style.display=zoomed?'none':'';}
  const tt=mapQ1('#mapTitle');if(tt)tt.setAttribute('transform','translate('+(mapView.x+22*k).toFixed(1)+','+(mapView.y+118*k).toFixed(1)+') scale('+k.toFixed(3)+') rotate(-4)');
  for(const e of mapQ('[data-w]')){e.setAttribute('stroke-width',(+e.getAttribute('data-w')*k).toFixed(2));const d=e.getAttribute('data-d');if(d)e.setAttribute('stroke-dasharray',d.split(' ').map(v=>(+v*k).toFixed(2)).join(' '));}
  for(const b of document.querySelectorAll('#mapRegions button'))b.classList.toggle('on',b.getAttribute('data-r')===mapRegion);const rl=document.getElementById('mapRegionLbl');if(rl)rl.textContent=({world:'Mundo',europa:'Europa',sul:'América do Sul',asia:'Ásia'})[mapRegion]||'Mundo';}
function gotoRegion(key,animate){mapRegion=key;return setView(regionBox(key),animate!==false);}
{ const rb=document.getElementById('mapRegionBtn'); if(rb) rb.addEventListener('click',()=>{ const order=['world','europa','sul','asia']; gotoRegion(order[(order.indexOf(mapRegion)+1)%order.length]); }); }
/* ---------- desenho: camada fixa (uma vez), camada dinâmica (progresso), topo (nuvens, título) ---------- */
let mapBuilt=false,mapSeq=0;
function buildMapStatic(){const W=MW,H=MH;mapRngSeed=7;
  let out='<defs><linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5cc4f2"/><stop offset=".5" stop-color="#2f96dc"/><stop offset="1" stop-color="#1a5fb0"/></linearGradient><linearGradient id="land" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fdc62"/><stop offset="1" stop-color="#5fae45"/></linearGradient><pattern id="grass" width="26" height="18" patternUnits="userSpaceOnUse"><ellipse cx="6" cy="8" rx="4" ry="1.4" fill="rgba(0,60,0,.10)"/><ellipse cx="18" cy="14" rx="4" ry="1.4" fill="rgba(0,60,0,.10)"/><ellipse cx="14" cy="3" rx="3" ry="1.1" fill="rgba(255,255,255,.12)"/></pattern><pattern id="waves" width="60" height="30" patternUnits="userSpaceOnUse"><path d="M0 15 q15 -9 30 0 t30 0" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="2.5"/></pattern><radialGradient id="gloss" cx="35%" cy="25%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></radialGradient><radialGradient id="vig" cx="50%" cy="45%" r="70%"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient></defs>';
  out+='<rect width="'+W+'" height="'+H+'" fill="url(#sea)"/><rect width="'+W+'" height="'+H+'" fill="url(#waves)"/>';
  const lands=CONT.map((c,ci)=>({pts:smoothPoly(polyPx(c,W,H),2),kind:KINDS[ci]})).sort((a,b)=>Math.max(...a.pts.map(p=>p[1]))-Math.max(...b.pts.map(p=>p[1])));
  for(const L of lands){const ptsS=L.pts.map(p=>G2S(p[0],p[1]));const d=pathOf(ptsS);
    out+='<path d="'+d+'" fill="none" stroke="#9fe0f6" stroke-width="18" stroke-linejoin="round" opacity=".5"/><path d="'+d+'" fill="rgba(0,20,60,.18)" transform="translate(5,15)"/>';
    out+=cliffs(L.pts,14,L.kind==='sand'?[196,160,96]:[150,104,62]);
    out+='<path d="'+d+'" fill="'+(L.kind==='sand'?'#efd58a':'url(#land)')+'" stroke="#2f5a26" stroke-width="3" stroke-linejoin="round"/><path d="'+d+'" fill="url(#grass)"/>';
    out+='<path d="'+d+'" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2" transform="translate(0,-1.5)"/>';
    if(L.pts.length>=8){const inner=smoothPoly(shrinkPoly(L.pts,0.56),1);const innerS=inner.map(p=>G2S(p[0],p[1]));const d2=pathOf(innerS);out+=cliffs(inner,9,L.kind==='sand'?[196,160,96]:[150,104,62]);out+='<path d="'+d2+'" fill="'+(L.kind==='sand'?'#f5e2a0':'#a9e07e')+'" stroke="#2f5a26" stroke-width="2.5" stroke-linejoin="round"/><path d="'+d2+'" fill="url(#grass)"/>';}
    out+='<g class="propsWorld">'+scatter(L.pts,L.kind,W,H,false)+'</g><g class="propsZoom">'+scatter(L.pts,L.kind,W,H,true)+'</g>';}
  out+='<g class="propsWorld">'+mountainsLayer(W,H,0.5)+'</g><g class="propsZoom">'+mountainsLayer(W,H,0.34)+landmarksLayer(W,H)+'</g>';
  out+='<path d="M0 '+(H-26)+' q60 -16 120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 V'+H+' H0 Z" fill="#eef5fb" stroke="#bfd8ea" stroke-width="3"/>';
  return out;}
function buildMapTop(){let out='';for(let k=0;k<4;k++){const cx=140+k*230,cy=34+(k%2)*26;out+='<g><animateTransform attributeName="transform" type="translate" values="0 0;'+(30+k*10)+' 0;0 0" dur="'+(18+k*4)+'s" repeatCount="indefinite"/><ellipse cx="'+cx+'" cy="'+(cy+120)+'" rx="40" ry="12" fill="rgba(0,20,60,.12)"/><ellipse cx="'+cx+'" cy="'+cy+'" rx="36" ry="13" fill="#fff"/><ellipse cx="'+(cx-18)+'" cy="'+(cy-6)+'" rx="19" ry="13" fill="#fff"/><ellipse cx="'+(cx+14)+'" cy="'+(cy-9)+'" rx="24" ry="15" fill="#fff"/><ellipse cx="'+(cx+4)+'" cy="'+(cy+4)+'" rx="30" ry="8" fill="#e6f0f8"/></g>';}
  out+='<rect width="'+MW+'" height="'+MH+'" fill="url(#vig)" pointer-events="none"/>';
  out+='<g id="mapTitle" transform="translate(22,118) rotate(-4)"><text class="ttl" font-size="44" fill="#e3262d" stroke="#fff" stroke-width="11" paint-order="stroke" stroke-linejoin="round">MODO HISTÓRIA</text><text class="ttl" font-size="44" fill="#e3262d" stroke="#5a0c10" stroke-width="3" paint-order="stroke" stroke-linejoin="round">MODO HISTÓRIA</text><text y="24" font-size="13" font-weight="800" fill="#fff" stroke="#1a2a3a" stroke-width="3" paint-order="stroke">TAÇA DE TODOS OS TIROS</text></g>';return out;}
function nodeHTML(i,o){const t=TEAMS[i],st0=teamState(i),won=isWon(i);const st=st0==='locked'?'locked':(won?'won':(i===nextIdx()?'next':'open'));const p=npos(i);const r=t.extra?15:(t.final?21:20);const stars=(save.prog.stars&&save.prog.stars[t.key])||0;const col='#'+t.shirt.toString(16).padStart(6,'0'),rgb=[t.shirt>>16&255,t.shirt>>8&255,t.shirt&255],light=(0.299*rgb[0]+0.587*rgb[1]+0.114*rgb[2])/255>0.62,lk=st==='locked';const fs=t.extra?10.5:12.5,wpx=Math.round(t.nome.length*fs*0.62+20);
  return '<g class="node st-'+st+(o.hideNode===i||(o.hideExtras&&t.extra)?' hid':'')+'" data-i="'+i+'" data-p="'+p[0].toFixed(1)+','+p[1].toFixed(1)+'"><g class="nin"><g transform="scale('+(st==='locked'?0.85:(st==='next'?1.12:1))+')">'+'<ellipse cy="7" rx="'+(r*2.9)+'" ry="'+(r*1.15)+'" fill="'+(lk?'#8a8f98':col)+'" opacity=".2"/><ellipse cy="7" rx="'+(r*2.9)+'" ry="'+(r*1.15)+'" fill="none" stroke="'+(lk?'#8a8f98':col)+'" stroke-width="2" stroke-dasharray="6 5" opacity=".75"/>'+'<g class="selx"><ellipse cy="7" rx="'+(r*2.5)+'" ry="'+(r*1.02)+'" fill="#fff2a0" opacity=".45"><animate attributeName="opacity" values=".25;.6;.25" dur="1.4s" repeatCount="indefinite"/></ellipse></g>'
   +'<ellipse class="selr" cy="8" rx="'+(r*2)+'" ry="'+(r*0.85)+'" fill="none" stroke="#fff" stroke-width="3"><animate attributeName="rx" values="'+(r*1.8)+';'+(r*2.2)+';'+(r*1.8)+'" dur="1.4s" repeatCount="indefinite"/></ellipse>'
   +stadiumIcon(t,r,st,t.extra?null:(t.final?'F':String(i+1)))
   +'<g class="selx selpin" transform="translate(0,'+(-r*2.1)+')"><path d="M-9 -12 L9 -12 L0 1 Z" fill="#f2c94c" stroke="#1f2a33" stroke-width="2" stroke-linejoin="round"/><animateTransform attributeName="transform" type="translate" additive="sum" values="0 0;0 -6;0 0" dur="0.9s" repeatCount="indefinite"/></g>'
   +'<g class="lbl" transform="translate(0,'+(r+15)+')"><rect x="'+(-wpx/2)+'" y="-10" width="'+wpx+'" height="20" rx="10" fill="'+(lk?'#5a5f68':col)+'" stroke="#1f2a33" stroke-width="2.2"/><text y="4.6" text-anchor="middle" font-size="'+fs+'" font-weight="800" fill="'+(lk?'#d8dbe0':(light?'#1f2a33':'#fff'))+'">'+t.nome+'</text></g>'
   +(stars?'<text class="nstars'+(o.hideStars===i?' hid':'')+'" y="'+(r+38)+'" text-anchor="middle" font-size="13" fill="#ffd84a" stroke="#5a3a00" stroke-width="2" paint-order="stroke">'+'★'.repeat(stars)+'<tspan fill="#6a6f78" stroke="#22252a">'+'★'.repeat(3-stars)+'</tspan></text>':'')
   +'</g></g></g>';}
function renderMapDyn(o){o=o||{};const dyn=mapQ1('#mapDyn');let out='';const segs=allSegs();
  segs.forEach((s,k)=>{const a=npos(s.from),b=npos(s.to),d=segD(a,b,s.kind,k%2,s.side);const rev=segRevealed(s)&&o.hideSeg!==k&&!(o.hideExtras&&s.side);
    if(rev)out+='<g class="seg" id="segg-'+k+'">'+segStrokes(d,s.kind,s.side)+'</g>';
    else if(o.hideSeg===k||(o.hideExtras&&s.side))out+='<g class="seg hid" id="segg-'+k+'">'+segStrokes(d,s.kind,s.side)+'</g>';
    else if(!s.side)out+='<path d="'+d+'" fill="none" stroke="#ffffff" opacity=".3" data-w="2.2" data-d="1 8" stroke-linecap="round"/>';
    out+='<path id="segp-'+k+'" d="'+d+'" fill="none" stroke="none"/>';});
  const hp=npos('home');out+='<g id="homeG" data-p="'+hp[0].toFixed(1)+','+hp[1].toFixed(1)+'"><ellipse cy="4" rx="28" ry="12" fill="rgba(0,0,0,.3)"/><ellipse rx="26" ry="11" fill="#c9a86a" stroke="#7a5632" stroke-width="2"/><ellipse cy="-3" rx="26" ry="11" fill="url(#land)" stroke="#2f5a26" stroke-width="2.5"/>'+mountain(4,-6,0.55)+tree(-12,-8,0.55)+'<g transform="translate(15,-8)"><rect x="-2" y="-14" width="4" height="14" fill="#fff" stroke="#1f2a33" stroke-width="1.2"/><rect x="-3" y="-17" width="6" height="4" fill="#e3262d" stroke="#1f2a33" stroke-width="1"/></g><text y="-26" text-anchor="middle" font-size="11" font-weight="800" fill="#fff" stroke="#1a2a3a" stroke-width="3" paint-order="stroke">Ilha do Corvo Negro</text></g>';
  const order=[...Array(TEAMS.length).keys()].sort((a,b)=>npos(a)[1]-npos(b)[1]);for(const i of order)out+=nodeHTML(i,o);
  for(const rk of ['europa','sul','asia']){const R=REGIONS[rk];const c=mapXY((R.lon[0]+R.lon[1])/2,(R.lat[0]+R.lat[1])/2,MW,MH);const S=G2S(c[0],c[1]);const ids=TEAMS.map((t,i)=>R.teams.includes(t.key)?i:-1).filter(i=>i>=0);const w=ids.filter(isWon).length;out+='<g class="regionlbl" data-r="'+rk+'" data-p="'+S[0].toFixed(1)+','+S[1].toFixed(1)+'"><rect x="-74" y="-20" width="148" height="40" rx="20" fill="#1a2a3a" stroke="#f2c94c" stroke-width="2.5"/><text y="-3" text-anchor="middle" font-size="14" font-weight="900" fill="#fff">'+R.nome.toUpperCase()+'</text><text y="12" text-anchor="middle" font-size="10" fill="#f2c94c">'+w+'/'+ids.length+' vencidos · toca para ver</text></g>';}
  if(FINAL_IDX>=0&&!save.prog.champion){const fp=npos(FINAL_IDX);out+='<g class="jet"><animateMotion dur="14s" repeatCount="indefinite" rotate="auto" path="M'+(fp[0]+18).toFixed(1)+' '+(fp[1]-10).toFixed(1)+' a18 7 0 1 0 -36 0 a18 7 0 1 0 36 0"/><g transform="scale(0.3)">'+planeSprite().replace(/#e3262d/g,'#f2c94c').replace('#ffffff','#1c1f26')+'</g></g>';}
  const at=o.heroAt!==undefined?o.heroAt:nextIdx();const h=npos(at);out+='<g id="heroG" data-p="'+h[0].toFixed(1)+','+h[1].toFixed(1)+'"><g id="heroIn" transform="translate(-26,-6)">'+heroSprite(0,0,1)+'</g></g>';
  if(dyn)dyn.innerHTML=out;}
function openWorldMap(opts){opts=opts||{};const el=$('worldmap');el.classList.remove('hidden');musicPlay('map');const svg=$('mapSvg');
  if(!mapBuilt||!mapQ1('#mapDyn')){svg.innerHTML='<g id="mapStatic">'+buildMapStatic()+'</g><g id="mapDyn"></g><g id="mapTop">'+buildMapTop()+'</g>';mapBuilt=true;}
  mapSeq++;
  if(opts.reward){runReward(opts.reward);return;}
  if(opts.intro){runIntro();return;}
  renderMapDyn();if(mapSel===null||opts.reset)mapSel=nextIdx();
  if(!opts.keepView){mapRegion=regionOf(mapSel);mapView=regionBox(mapRegion);}applyView();updateSelection();updateEvidenceHud();}
function updateSelection(){for(const n of mapQ('.node'))n.classList.toggle('sel',+n.getAttribute('data-i')===mapSel);const sk=(mapSel!=null&&TEAMS[mapSel])?TEAMS[mapSel].key:'';for(const l of mapQ('.lm'))l.classList.toggle('sel',l.getAttribute('data-k')===sk);updateMapBar();}
function flames(n){let o='';for(let i=0;i<5;i++)o+='<svg class="fl'+(i<n?' on':'')+'" viewBox="0 0 12 14"><path d="M6 1 C8 5 11 6 10 10 C9.5 12.5 7.8 13.5 6 13.5 C3.5 13.5 2 11.8 2 9.6 C2 7.5 3.4 6.6 4 5 C4.4 6.5 5.2 7 5.6 7 C5.2 5 5.4 3 6 1Z"/></svg>';return o;}
function captainMedal(t){const cc='#'+t.shirt.toString(16).padStart(6,'0'),cc2='#'+t.shorts.toString(16).padStart(6,'0');const c=CAPTAINS[t.key]||{nome:t.boss};
  if(typeof portraitURL==='function')return '<div class="medal pt" style="background:linear-gradient(135deg,'+cc+','+cc2+')"><img src="'+portraitURL(t.key,'smug')+'" alt=""></div>';
  return '<div class="medal" style="background:radial-gradient(circle at 35% 30%,#fff8 0,#fff0 40%),linear-gradient(135deg,'+cc+','+cc2+')"><span>'+c.nome.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()+'</span></div>';}
function lockReason(i){const t=TEAMS[i];if(t.extra)return 'Abre depois de venceres o Jogo 2';if(t.final)return 'Vence as cinco seleções para chegar ao iate';return 'Vence o Jogo '+i+' para abrir';}
function updateMapBar(){if(mapSel===null)return;const i=mapSel,t=TEAMS[i],st=teamState(i),c=CAPTAINS[t.key]||{nome:t.boss,alcunha:''},stars=(save.prog.stars&&save.prog.stars[t.key])||0;
  const lab=t.final?'Final':(t.extra?'Extra':'Jogo '+(i+1)+'/'+MAIN);const info=$('mapInfo');
  const nev=Object.keys(save.prog.evidence||{}).length;const ev=t.extra?((save.prog.evidence&&save.prog.evidence[t.key])?'<span class="mi-ev ok">Prova encontrada</span>':'<span class="mi-ev">Prova escondida</span>'):(t.final?'<span class="mi-ev'+(nev>=5?' ok':'')+'">Provas '+nev+'/5</span>':'');
  info.innerHTML='<div class="mi-art"><img src="'+sceneURL(t.key)+'" alt="">'+captainMedal(t)+'</div><div class="mi-text"><div class="mi-title">'+lab+' · '+t.nome+'</div><div class="mi-sub">'+c.nome+(c.alcunha?' «'+c.alcunha+'»':'')+'</div>'+(st==='locked'?'<div class="mi-lock">'+lockReason(i)+'</div>':'<div class="mi-diff">'+flames(t.tier||1)+ev+'</div>')+(t.scout&&st!=='locked'?'<div class="mi-scout">🔎 Olheiro: '+t.scout+'</div>':'')+'</div><div class="mi-stars">'+'<b>'+'★'.repeat(stars)+'</b>'+'★'.repeat(3-stars)+'</div>';
  const btn=$('mapPlay');btn.disabled=st==='locked';btn.textContent=st==='locked'?'Fechado':(isWon(i)?'Repetir':'Jogar');}
function updateEvidenceHud(){const e=$('mapEvidence');if(!e)return;const n=Object.keys(save.prog.evidence||{}).length;e.innerHTML='<svg viewBox="-12 -10 24 20" width="20" height="17">'+folderIcon()+'</svg><span>Provas '+n+'/5</span>';e.classList.toggle('hidden',(save.prog.unlocked||0)<2);}
/* ---------- momentos: estrelas, estrada, herói ---------- */
const waitMs=ms=>new Promise(r=>setTimeout(r,ms));
function popStars(i,n){return new Promise(res=>{const p=npos(i);const sp=toScreenMap(p[0],p[1]);const host=$('worldmap');if(!sp||!host.appendChild){res();return;}const els=[];for(let k=0;k<3;k++){const d=document.createElement('div');d.className='starpop'+(k<n?'':' off');d.textContent='★';d.style.left=(sp[0]+(k-1)*42)+'px';d.style.top=(sp[1]-70-(k===1?12:0))+'px';d.style.animationDelay=(k*0.28)+'s';host.appendChild(d);els.push(d);if(k<n)setTimeout(()=>sfx('pick',0.7+k*0.15),k*280+120);}
  setTimeout(()=>{for(const d of els)d.remove&&d.remove();const s=mapQ1('.node[data-i="'+i+'"] .nstars');if(s)s.classList.remove('hid');res();},1500);});}
function revealSeg(k){return new Promise(res=>{const g=mapQ1('#segg-'+k);if(!g){res();return;}g.classList.remove('hid');const paths=Array.from(g.querySelectorAll?g.querySelectorAll('.rv'):[]);const dots=g.querySelector?g.querySelector('.dots'):null;
  if(!paths.length||!paths[0].getTotalLength||typeof requestAnimationFrame!=='function'){g.style.opacity='';res();return;}
  if(dots)dots.style.opacity='0';const L=paths[0].getTotalLength();for(const p of paths){p.style.strokeDasharray=L+' '+L;p.style.strokeDashoffset=L;}const t0=performance.now(),D=900;
  const step=now=>{const t=Math.min(1,(now-t0)/D);for(const p of paths)p.style.strokeDashoffset=(L*(1-t)).toFixed(1);if(t<1)requestAnimationFrame(step);else{for(const p of paths){p.style.strokeDasharray='';p.style.strokeDashoffset='';}if(dots)dots.style.opacity='';res();}};requestAnimationFrame(step);});}
function fadeSeg(k){const g=mapQ1('#segg-'+k);if(g)g.classList.remove('hid');return waitMs(250);}
function moveHero(k,kind){return new Promise(res=>{const path=mapQ1('#segp-'+k),h=mapQ1('#heroG'),inn=mapQ1('#heroIn');if(!path||!h||!path.getTotalLength||typeof requestAnimationFrame!=='function'){res();return;}
  const L=path.getTotalLength(),D=kind==='flight'?1900:1200,t0=performance.now();if(kind==='flight'&&inn){inn.setAttribute('transform','translate(0,0)');inn.innerHTML=planeSprite();}else if(inn)inn.setAttribute('transform','translate(0,-4)');
  const step=now=>{const t=Math.min(1,(now-t0)/D),e=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;const p=path.getPointAtLength(L*e),q=path.getPointAtLength(Math.min(L,L*e+2));h.setAttribute('data-p',p.x.toFixed(1)+','+p.y.toFixed(1));
    if(kind==='flight'&&inn)inn.setAttribute('transform','rotate('+(Math.atan2(q.y-p.y,q.x-p.x)*180/Math.PI).toFixed(1)+')');applyView();
    if(t<1)requestAnimationFrame(step);else{if(inn){inn.innerHTML=heroSprite(0,0,1);inn.setAttribute('transform','translate(-26,-6)');}res();}};requestAnimationFrame(step);});}
function popNode(i){const n=mapQ1('.node[data-i="'+i+'"]');if(n){n.classList.remove('hid');n.classList.add('newly');}sfx('whistle',0.6);}
function mapToast(txt){const t=$('mapToast');if(!t)return;t.textContent=txt;t.classList.remove('hidden');clearTimeout(mapToast._t);mapToast._t=setTimeout(()=>t.classList.add('hidden'),4200);}
async function runReward(r){const my=mapSeq;const i=r.won;const nn=r.newNode;mapSel=(nn!==null&&nn!==undefined)?nn:i;
  const k=(nn!==null&&nn!==undefined)?segIndexTo(nn):-1;const segs=allSegs();
  renderMapDyn({hideSeg:k>=0?k:undefined,hideNode:nn,hideStars:i,heroAt:i,hideExtras:r.extrasOpened});updateSelection();updateEvidenceHud();
  const pts=[npos(i)];if(k>=0)pts.push(npos(nn));mapView=boxAround(pts,90);applyView();
  await waitMs(350);if(my!==mapSeq)return;
  await popStars(i,r.stars);if(my!==mapSeq)return;
  if(r.evidence)mapToast('Prova encontrada: '+r.evidence+' · '+Object.keys(save.prog.evidence||{}).length+'/5');
  if(k>=0){const kind=segs[k].kind;if(kind==='flight'){await setView(boxAround(pts,80),true,700);await fadeSeg(k);}else await revealSeg(k);if(my!==mapSeq)return;
    await moveHero(k,kind);if(my!==mapSeq)return;popNode(nn);await waitMs(500);}
  if(r.extrasOpened){for(const n of mapQ('.node')){const t=TEAMS[+n.getAttribute('data-i')];if(t&&t.extra){n.classList.remove('hid');n.classList.add('newly');}}for(const g of mapQ('.seg.hid'))g.classList.remove('hid');mapToast('Jogos extra abertos: cinco seleções opcionais, cada uma esconde uma prova contra o Nabo');}
  if(my!==mapSeq)return;await waitMs(300);mapRegion=regionOf(mapSel);await setView(regionBox(mapRegion),true);}
async function runIntro(){const my=mapSeq;mapSel=0;renderMapDyn({hideSeg:0,hideNode:0,heroAt:'home'});updateSelection();const pts=[npos('home'),npos(0)];mapView=boxAround(pts,70);applyView();
  await waitMs(500);if(my!==mapSeq)return;mapToast('A viagem começa: da ilha para Sevilha');await fadeSeg(0);await moveHero(0,'flight');if(my!==mapSeq)return;popNode(0);save.prog.introDone=true;persist();await waitMs(500);mapRegion='europa';await setView(regionBox('europa'),true);}
/* ---------- transição em círculo (íris) ---------- */
function iris(close,x,y){return new Promise(res=>{const el=$('iris');const h=el&&el.querySelector?el.querySelector('.hole'):null;if(!h||!h.style||!el.classList){res();return;}h.style.left=(x!==undefined?x+'px':'50%');h.style.top=(y!==undefined?y+'px':'50%');el.classList.remove('hidden');void el.offsetWidth;el.classList.toggle('closed',!!close);setTimeout(()=>{if(!close)el.classList.add('hidden');res();},470);});}
/* ---------- jogar a partir do mapa: o postal cobre o carregamento ---------- */
function postcardFor(i){const t=TEAMS[i];const pc=POSTCARDS[t.key]||{title:t.estadio.toUpperCase(),line:t.desc};const lab=t.final?'Final':(t.extra?'Jogo extra':'Jogo '+(i+1)+' de '+MAIN);const back=isWon(i);const ch=t.extra?null:CHAPTERS[t.key];return {postcard:t.key,postcardWon:back,kicker:(ch?'Capítulo '+ch.n+' · '+ch.title:lab)+' · '+t.estadio,title:back?pc.title.replace('BEM-VINDO AO','DE VOLTA AO').replace('BEM-VINDO A','DE VOLTA A'):pc.title,sub:pc.line,body:'',btn:'Continuar'};}
async function playFromMap(i){if(teamState(i)==='locked'||mode==='loading'||mode==='story')return;mapSeq++;save.settings.level=i;persist();try{audioInit();}catch(e){}
  const p=npos(i);const sp=toScreenMap(p[0],p[1]);await iris(true,sp?sp[0]:undefined,sp?sp[1]:undefined);
  musicStop();$('worldmap').classList.add('hidden');$('hub').classList.add('hidden');menuEl.classList.add('hidden');
  const needLoad=(levelIdx!==i||!worldReady);mode='story';const pc=postcardFor(i);pc.lockBtn=needLoad;if(needLoad)pc.btn='A preparar o estádio…';
  const go=new Promise(res=>showCards([pc],res,false));iris(false);
  const loadP=needLoad?loadLevel(i).then(()=>{const b=$('cardBtn');b.disabled=false;b.textContent='Continuar';}):Promise.resolve();
  await go;await loadP;mode='menu';await startGame({skipPostcard:true});}
$('mapPlay').addEventListener('click',()=>{if(mapSel!==null)playFromMap(mapSel);});
$('mapClose').addEventListener('click',()=>{mapSeq++;musicStop();$('worldmap').classList.add('hidden');});
for(const b of document.querySelectorAll('#mapRegions button'))b.addEventListener('click',()=>{mapSeq++;gotoRegion(b.getAttribute('data-r'));});
{ // gestos: um dedo arrasta (com inércia), dois dedos fazem pinça no ponto entre eles, toque seleciona o estádio mais próximo
  const svg=$('mapSvg');const pts=new Map();let start=null,pinch0=null,wasPinch=false,vel=[0,0],lastT=0,inert=null;
  const stopInert=()=>{if(inert){cancelAnimationFrame(inert);inert=null;}};
  svg.addEventListener('pointerdown',e=>{stopInert();pts.set(e.pointerId,[e.clientX,e.clientY]);try{svg.setPointerCapture(e.pointerId);}catch(_){}
    if(pts.size===1){start={x:e.clientX,y:e.clientY,v:Object.assign({},mapView),moved:false};wasPinch=false;vel=[0,0];lastT=performance.now();}
    else if(pts.size===2){const [a,b]=[...pts.values()];pinch0={d:Math.hypot(a[0]-b[0],a[1]-b[1])||1,v:Object.assign({},mapView),anchor:toViewMap((a[0]+b[0])/2,(a[1]+b[1])/2)};wasPinch=true;mapSeq++;}});
  svg.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;const prev=pts.get(e.pointerId);pts.set(e.pointerId,[e.clientX,e.clientY]);
    if(pts.size>=2&&pinch0){const [a,b]=[...pts.values()];const d=Math.hypot(a[0]-b[0],a[1]-b[1])||1,mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;const nw=Math.max(140,Math.min(MW,pinch0.v.w*pinch0.d/d)),nh=nw*(MH/MW);const r=svg.getBoundingClientRect();const s=Math.max(r.width/nw,r.height/nh),ox=(r.width-nw*s)/2,oy=(r.height-nh*s)/2;
      mapView=clampView({x:pinch0.anchor[0]-(mx-r.left-ox)/s,y:pinch0.anchor[1]-(my-r.top-oy)/s,w:nw,h:nh});mapRegion='';applyView();return;}
    if(start&&pts.size===1){const dx=e.clientX-start.x,dy=e.clientY-start.y;if(!start.moved&&Math.hypot(dx,dy)>8){start.moved=true;mapSeq++;}if(!start.moved)return;const v=viewScale();if(!v)return;
      mapView=clampView({x:start.v.x-dx/v.s,y:start.v.y-dy/v.s,w:mapView.w,h:mapView.h});mapRegion='';applyView();const now=performance.now(),dt=Math.max(1,now-lastT);vel=[-(e.clientX-prev[0])/v.s/dt*16,-(e.clientY-prev[1])/v.s/dt*16];lastT=now;}});
  const up=e=>{if(!pts.has(e.pointerId))return;pts.delete(e.pointerId);
    if(pts.size===1&&wasPinch){const [a]=[...pts.values()];start={x:a[0],y:a[1],v:Object.assign({},mapView),moved:true};pinch0=null;return;}
    if(pts.size===0){if(start&&!start.moved&&!wasPinch)mapTap(e.clientX,e.clientY);else if(start&&start.moved&&!wasPinch&&Math.hypot(vel[0],vel[1])>0.4){const run=()=>{vel[0]*=0.92;vel[1]*=0.92;mapView=clampView({x:mapView.x+vel[0],y:mapView.y+vel[1],w:mapView.w,h:mapView.h});applyView();if(Math.hypot(vel[0],vel[1])>0.05)inert=requestAnimationFrame(run);else inert=null;};inert=requestAnimationFrame(run);}start=null;pinch0=null;}};
  svg.addEventListener('pointerup',up);svg.addEventListener('pointercancel',up);
  svg.addEventListener('wheel',e=>{e.preventDefault();stopInert();mapSeq++;const f=e.deltaY>0?1.15:0.87;const a=toViewMap(e.clientX,e.clientY);const nw=Math.max(140,Math.min(MW,mapView.w*f)),nh=nw*(MH/MW);const r=svg.getBoundingClientRect();const s=Math.max(r.width/nw,r.height/nh),ox=(r.width-nw*s)/2,oy=(r.height-nh*s)/2;mapView=clampView({x:a[0]-(e.clientX-r.left-ox)/s,y:a[1]-(e.clientY-r.top-oy)/s,w:nw,h:nh});mapRegion='';applyView();},{passive:false});
}
function mapTap(cx,cy){let best=null,bd=46;for(const n of mapQ('.node')){if(n.classList.contains('hid'))continue;const p=n.getAttribute('data-p').split(',');const sp=toScreenMap(+p[0],+p[1]);if(!sp)continue;const d=Math.hypot(sp[0]-cx,sp[1]-(cy+8));if(d<bd){bd=d;best=+n.getAttribute('data-i');}}
  if(best!==null){mapSel=best;updateSelection();sfx('pick',0.35);return;}
  if(mapView.w/MW>=0.55)for(const r of mapQ('.regionlbl')){const p=r.getAttribute('data-p').split(',');const sp=toScreenMap(+p[0],+p[1]);if(sp&&Math.hypot(sp[0]-cx,sp[1]-cy)<80){mapSeq++;gotoRegion(r.getAttribute('data-r'));return;}}}
/* ---------- hub ---------- */
$('hubStory').addEventListener('click',()=>{$('hub').classList.add('hidden');if(!save.prog.seenPrologue){save.prog.seenPrologue=true;persist();showCards(PROLOGUE.map(c=>Object.assign({kicker:'Prólogo'},c)),()=>openWorldMap({intro:!save.prog.introDone}),false);}else openWorldMap({intro:!save.prog.introDone});});
$('hubQuick').addEventListener('click',()=>{$('hub').classList.add('hidden');save.settings.level=nextIdx();persist();startGame();});
$('hubEndless').addEventListener('click',async()=>{$('hub').classList.add('hidden');const i=Math.min(MAIN-1,save.prog.unlocked||0);save.settings.level=i;if(levelIdx!==i||!worldReady){mode='loading';await loadLevel(i);placeMenuModel();mode='menu';}await startGame({quick:true});endless=true;});
if($('hubBomb'))$('hubBomb').addEventListener('click',async()=>{$('hub').classList.add('hidden');const i=Math.min(MAIN-1,save.prog.unlocked||0);save.settings.level=i;if(levelIdx!==i||!worldReady){mode='loading';await loadLevel(i);placeMenuModel();mode='menu';}await startGame({quick:true});tdmStart('bomb');});
if($('hubBall'))$('hubBall').addEventListener('click',async()=>{$('hub').classList.add('hidden');const i=Math.min(MAIN-1,save.prog.unlocked||0);save.settings.level=i;if(levelIdx!==i||!worldReady){mode='loading';await loadLevel(i);placeMenuModel();mode='menu';}await startGame({quick:true});tdmStart('ball');});
if($('hubTdm'))$('hubTdm').addEventListener('click',async()=>{$('hub').classList.add('hidden');const i=Math.min(MAIN-1,save.prog.unlocked||0);save.settings.level=i;if(levelIdx!==i||!worldReady){mode='loading';await loadLevel(i);placeMenuModel();mode='menu';}await startGame({quick:true});tdmStart();});
$('hubTime').addEventListener('click',async()=>{$('hub').classList.add('hidden');const i=Math.min(MAIN-1,save.prog.unlocked||0);save.settings.level=i;if(levelIdx!==i||!worldReady){mode='loading';await loadLevel(i);placeMenuModel();mode='menu';}await startGame({quick:true});endless=true;taRun=true;timeAttack=120;spawnInt=Math.max(0.35,spawnInt*0.6);msg('CONTRA-RELÓGIO: 2 minutos, o máximo de abates!','#f2c94c',3);});
$('hubClose').addEventListener('click',()=>{$('hub').classList.add('hidden');});
$('toMap').addEventListener('click',async()=>{await toMenu();openWorldMap();});
$('mapAlbum').addEventListener('click',()=>{const g=$('albumGrid');const P=save.prog.papers||[];g.innerHTML=P.length?P.map((p,k)=>'<div class="apaper" data-k="'+k+'"><div class="ah">O APITO FINAL</div><div class="at">'+p.title+'</div><div class="as">'+(p.sub||'')+'</div></div>').join(''):'<div class="aempty">Ainda sem primeiras páginas. Vence um jogo para seres notícia.</div>';$('album').classList.remove('hidden');});
$('albumGrid').addEventListener('click',e=>{const d=e.target&&e.target.closest?e.target.closest('.apaper'):null;if(!d)return;const p=(save.prog.papers||[])[+d.getAttribute('data-k')];if(p)showCards([Object.assign({paper:true,btn:'Fechar'},p)],null,true);});
$('albumClose').addEventListener('click',()=>$('album').classList.add('hidden'));
$('play').addEventListener('click',()=>{try{const t=TEAMS[nextIdx()],sm=$('hubCont');if(sm)sm.textContent='Continua: '+t.nome+' · '+t.estadio;}catch(e){}try{const pr=$('hubProg');if(pr){const st=Object.values(save.prog.stars||{}).reduce((x,y)=>x+y,0);pr.textContent='Jogo '+Math.min(MAIN,(save.prog.unlocked||0)+1)+' de '+MAIN+' · '+st+' ★ · capitães · jornal';}const tr=$('hubTimeRec');if(tr&&save.prog.bestTA)tr.textContent='2 minutos · recorde '+save.prog.bestTA+' abates';}catch(e){}$('hub').classList.remove('hidden');});

for(const id of ['hubEndless','hubTime','hubTdm','hubBall','hubBomb']){const b=$(id);if(b)b.addEventListener('click',()=>{lastQuickId=id;},true);}
if($('pauseRestart'))$('pauseRestart').addEventListener('click',()=>{ pauseEl.classList.add('hidden'); if(lastQuickId&&$(lastQuickId)){ $(lastQuickId).click(); } else startGame(); });
for(const [id,fn] of [['lbStory',()=>{const b=$('hubStory');if(b)b.click();}],['lbMap',()=>{const b=$('hubStory');if(b)b.click();}],['lbQuick',()=>{const b=$('hubQuick');if(b)b.click();}],['lbModes',()=>{$('play').click();}],['lbPlay',()=>{const b=$('hubQuick');if(b)b.click();}],['lbArsenal',()=>openMenuShop()],['btnSettings',()=>{$('settingsPanel').classList.toggle('hidden');}],['lbSettings2',()=>{$('settingsPanel').classList.toggle('hidden');}],['settingsClose',()=>{$('settingsPanel').classList.add('hidden');}],['lbDailyBtn',()=>{msg(dailyText(),'#f2c94c',4);}]]){ const b=$(id); if(b)b.addEventListener('click',fn); }
$('again').addEventListener('click',()=>{ if(lastQuickId&&$(lastQuickId)){ const id=lastQuickId; overEl.classList.add('hidden'); $(id).click(); } else startGame(); });
$('resume').addEventListener('click',resume);
$('quit1').addEventListener('click',toMenu);
$('quit2').addEventListener('click',toMenu);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='play')pause();});

/* ===================== Qualidade, tamanho, ciclo ===================== */
function applyQuality(){
  Q=TIERS[save.settings.quality]||TIERS.medium;
  rt.samples=isTouch?Math.min(2,Q.msaa):Q.msaa;rt.dispose();renderer.shadowMap.type=(Q.softShadows&&!isTouch)?THREE.PCFSoftShadowMap:THREE.PCFShadowMap;
  renderer.shadowMap.enabled=Q.shadows;const sun=worldBuilder.sun;if(sun){if(Q.shadows)sun.shadow.mapSize.set(Q.shadowMap,Q.shadowMap);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}}
  renderer.toneMapping=Q.post?THREE.NoToneMapping:THREE.ACESFilmicToneMapping;
  postMat.uniforms.uBloom.value=Q.bloom?0.75:0.0;smokePS.max=Math.min(1200,Q.particles);sparkPS.max=Math.min(400,Math.round(Q.particles*0.4));
  scene.traverse(o=>{if(o.material){const ms=Array.isArray(o.material)?o.material:[o.material];for(const m of ms)m.needsUpdate=true;}});
  if(pool)pool.setShadows(Q.enemyShadows);camera.far=Q.viewDistance+600;
  resize();
}
function resize(){
  W=window.innerWidth;H=window.innerHeight;DPR=Math.min(window.devicePixelRatio||1,2);
  renderer.setPixelRatio(effectivePixelRatio(Q,W,H)*dynScale);renderer.setSize(W,H,false);glc.style.width=W+'px';glc.style.height=H+'px';
  camera.aspect=W/H;baseFov=78;if(mode!=='play'){camera.fov=baseFov;}camera.updateProjectionMatrix();
  const portrait=isTouch&&H>W;const rot=$('rotate');if(rot){rot.classList.toggle('hidden',!portrait);}if(portrait&&mode==='play')pause();
  const pr=renderer.getPixelRatio();rt.setSize(Math.max(8,Math.floor(W*pr)),Math.max(8,Math.floor(H*pr)));postMat.uniforms.uRes.value.set(W*pr,H*pr);
  const bw=Math.max(8,Math.floor(W*pr/4)),bh=Math.max(8,Math.floor(H*pr/4));rtB1.setSize(bw,bh);rtB2.setSize(bw,bh);brightMat.uniforms.uTexel.value.set(1/bw,1/bh);blurMat.uniforms.uTexel.value.set(1/bw,1/bh);
  hud.width=Math.floor(W*DPR);hud.height=Math.floor(H*DPR);hud.style.width=W+'px';hud.style.height=H+'px';
  updatePointScale();
}
function updatePointScale(){const s=(H*renderer.getPixelRatio())/(2*Math.tan(camera.fov*Math.PI/360));smokePS.mat.uniforms.uScale.value=s;sparkPS.mat.uniforms.uScale.value=s;}
window.addEventListener('resize',resize);window.addEventListener('orientationchange',()=>setTimeout(resize,250));
function render(){
  if(Q.post){renderer.setRenderTarget(rt);renderer.render(scene,camera);
    if(Q.bloom){quad.material=brightMat;renderer.setRenderTarget(rtB1);renderer.render(postScene,postCam);
    quad.material=blurMat;renderer.setRenderTarget(rtB2);renderer.render(postScene,postCam);}
    quad.material=postMat;renderer.setRenderTarget(null);
    const u=postMat.uniforms;u.uTime.value=perfT;u.uHurt.value=(mode==='play'?hurtT*0.8+(P.hp<30?0.22*(0.5+0.5*Math.sin(gameT*5)):0):0);u.uAber.value=1+hurtT*4;
    renderer.render(postScene,postCam);}
  else renderer.render(scene,camera);
}
try{
loadLocal();ensureDaily();loadSounds();await loadWeaponModels();applyAttachments();try{applySkin();}catch(e){}try{renderWeaponIcons();}catch(e){console.warn('icons',e);}await initCharacters();await loadLevel(save.settings.level);placeMenuModel();applyQuality();refreshMenu();debug.toggle(!!save.settings.debug);
debug.extra=()=>'inimigos '+enemies.filter(e=>e.state!=='dead').length+' · modo '+mode+' · qualidade '+Q.label+'\npersonagem GLB '+(registry.available.character?'OK':'FALHOU (cápsulas)')+' · módulos '+(registry.modulesOk||0)+'/'+Object.keys(registry.manifest.modules||{}).length+' · KTX2 '+(registry.ktxFormat||'?')+(registry.singleFile?' · ficheiro único':'')+(registry.failed.length?'\nFALHOU: '+registry.failed.slice(0,4).join(' | '):'')+'\n'+registry.log.slice(-1).join('');
for(const k of ORDER)wst[k]={mag:WEAPONS[k].mag,reserve:WEAPONS[k].reserve};
$('loading').style.display='none';
}catch(err){$('loading').style.display='none';$('err').innerHTML='Erro ao iniciar o jogo:<br><small>'+String(err&&err.message?err.message:err)+'<br>'+String(err&&err.stack||'').slice(0,300)+'</small>';$('err').classList.remove('hidden');throw err;}
let last=performance.now();
function isOpaqueOverlay(){const c=$('card'),m=$('worldmap'),h=$('hub'),sh=$('shop');const vis=x=>x&&x.classList&&!x.classList.contains('hidden');return vis(m)||vis(h)||vis(sh)||(vis(c)&&(c.classList.contains('postcard')||c.classList.contains('paper')||c.classList.contains('tunnel')));}
function frame(now){
  if(mode==='story'){const sdt=Math.min(0.05,(now-last)/1000||0.016);last=now;requestAnimationFrame(frame);if(isOpaqueOverlay())return;if(pool)pool.update(sdt,camera.position,1);render();return;}
  requestAnimationFrame(frame);
  renderer.info.reset();let dt=(now-last)/1000;last=now;if(dt>0.05)dt=0.05;if(dt<0)dt=0;perfT+=dt;window.__lastDt=dt;
  if(mode==='play'){if(!window.__rdpFreeze)update(dt);}else if(mode==='menu')menuUpdate(dt);else if(mode==='over')overUpdate(dt);
  if(worldReady&&!isOpaqueOverlay())render();debug.tick(dt);
  if(mode==='play'||mode==='pause'||mode==='shop')updateDOM();
  drawHUD(dt);
}
/* ===================== Ganchos de teste (consola / harness) ===================== */
window.__rdp={enemiesRaw:()=>enemies,thumbs:()=>{try{const ST=G.START;const r=renderSceneThumb(ST.x+34,10,ST.z+30,ST.x-4,0.5,ST.z-6,480,220);return 'thumb '+(r?r.length:'null')+' rr='+(!!renderer.readRenderTargetPixels)+' world='+worldReady+' el='+(!!$('lbQuickImg'));}catch(e){return 'ERR '+e.message+' '+(e.stack||'').slice(0,200);}},hitTest:(role,wk,head)=>{const sc=cur;cur=wk;spawnEnemy(role);const e=enemies[enemies.length-1];if(!e){cur=sc;return -1;}e.state='attack';e.x=P.x;e.z=P.z-6;e.yaw=Math.atan2(-(P.x-e.x),-(P.z-e.z));let n=0;const w=WEAPONS[wk],per=dmgOf(w)*(w.pellets||1)*(head?(w.headMul||2):1),ex=(B(wk)==='gl'||B(wk)==='rpg');while(e.state!=='dead'&&n<300){if(ex){explosiveKill=true;hitEnemy(e,per,false,null,true);explosiveKill=false;}else hitEnemy(e,per,!!head,{x:e.x,y:1.2,z:e.z},true);e.stunT=0;n++;}removeEnemy(e);cur=sc;return n;},startQuick:()=>startGame({quick:true}),pocket:()=>({c4:P.c4,sentries:P.sentries,mines:P.mines}),tdmNow:(k)=>{tdmStart(k);return allies.length;},bombState:()=>tdm&&tdm.bomb?{st:tdm.bomb.st,round:tdm.bomb.round,sc:tdm.sc.slice(),sites:tdm.bomb.sites,fuse:Math.round(tdm.bomb.fuse||0),carrier:tdm.bomb.carrier}:null,ballState:()=>tdm&&tdm.ball?{st:tdm.ball.st,sc:tdm.sc.slice(),x:tdm.ball.x,z:tdm.ball.z}:null,ballDrop:(x,z)=>{if(tdm&&tdm.ball){tdm.ball.st='ground';tdm.ball.x=x;tdm.ball.z=z;tdm.ball.t=30;}},tdmState:()=>tdm?{sc:tdm.sc.slice(),t:Math.round(tdm.t),allies:allies.filter(a=>a.state!=='dead').length,en:enemies.filter(e=>e.state!=='dead').length}:null,shopNow:(tab)=>{nearShop=true;if(tab)shopTab=tab;openShop();return mode;},jumpNow:()=>jump(),attAll:()=>{const a=att();a.sight=a.laser=a.grip=a.stock=true;applyAttachments();return Object.keys(views.ar.att||{}).join(',');},skin:(k)=>{save.prog.skin=k||null;applySkin();return save.prog.skin;},forceOver:()=>{P.hp=0;P.alive=false;gameOver();},tpy:(x,z,y)=>{P.x=x;P.z=z;P.y=y;P.vy=0;},give:(k,n)=>{P[k]=(P[k]||0)+(n||1);updateGearBtns();},c4:()=>{placeC4();return c4s.length;},det:()=>{detonateC4();return c4s.length;},sentry:()=>{placeSentry();return sentries.length;},sentries:()=>sentries.map(t=>({t:+t.t.toFixed(1),shots:t.shots})),grid:()=>({MAP:G.MAP,S,MW:G.MW,MH:G.MH,ROOFS:G.ROOFS||[],TREES:G.TREES||[]}),py:()=>P.y,bubTest:()=>{const b=bubbles[0];if(!b)return 'none';const d=camDir();b.sp.position.set(camera.position.x+d.x*5,camera.position.y+d.y*5+0.2,camera.position.z+d.z*5);return JSON.stringify({fog:scene.fog?[scene.fog.near,scene.fog.far,scene.fog.density]:null,mat:b.sp.material.type,fogOn:b.sp.material.fog});},bubDbg:()=>bubbles.map(b=>{const v=b.sp.position.clone().project(camera);let root=b.sp;while(root.parent)root=root.parent;return {inScene:root===scene,layers:b.sp.layers.mask,camLayers:camera.layers.mask,scr:[v.x.toFixed(2),v.y.toFixed(2),v.z.toFixed(3)],op:b.sp.material.opacity,w:b.c.width,vis:b.sp.visible};}),shoutAt:(k)=>{const cd=camDir();let best=null,bd=-1;for(const e of enemies){if(e.state==='dead'||e.state==='warm')continue;const x=e.x-camera.position.x,z=e.z-camera.position.z,l=Math.hypot(x,z)||1,dt2=(cd.x*x+cd.z*z)/l;if(dt2>bd){bd=dt2;best=e;}}if(!best)return 'none';shoutCd=0;best.shCd=0;shout(best,k);updateBubbles(0.001);return best.state+' '+bd.toFixed(2)+' '+JSON.stringify(bubbles.map(b=>[b.t.toFixed(2),b.sp.visible,b.sp.position.x.toFixed(1),b.sp.position.y.toFixed(1),b.sp.position.z.toFixed(1),best.x.toFixed(1),best.z.toFixed(1)]));},blastAt:(x,z)=>markBlast(x,z,1.6),god:()=>{P.maxHp=P.hp=1e7;},ai:()=>enemies.map(e=>e.state+(e.cv&&e.state==='cover'?':'+e.cv.ph:'')),hipw:(k,o)=>{Object.assign(HIPW[B(k)],o);vmx=HIPW[B(k)].x;vmy=HIPW[B(k)].y;vmz=HIPW[B(k)].z;},reloadNow:()=>reload(),fireOnce:()=>fire(),adsOn:(v)=>{ads=!!v;},prog:()=>save.prog,vcards:(i)=>{mode='story';showCards(victoryCards(i),()=>{},true);},openMap:(o)=>openWorldMap(o),icons:()=>weaponIcons,reprologue:()=>{mode='story';showCards(PROLOGUE.map(c=>Object.assign({kicker:'Prólogo'},c)),()=>{mode='play';},false);},snd:()=>SND,spawnRole:(r)=>{spawnEnemy(r);return enemies[enemies.length-1].state;},turret:()=>placeTurret(),att:()=>att(),extras:()=>({mod:modKey,obj:obj?{type:obj.type,done:obj.done,failed:obj.failed}:null,evt:evt?{type:evt.type,active:evt.active}:null,daily:save.prog.daily}),forceMod:k=>{modClear();modApply(k);},forceObj:t=>{objClear();return objStart(t);},forceEvt:k=>{evtEnd();evtSchedule(k,0);},setY:y=>{P.y=y;P.vy=0;},keyDown:k=>{keys[k]=true;},keyUp:k=>{keys[k]=false;},rayFwd:()=>{const d=camDir();const t=rayWorld(camera.position,d,80,HIT);return {t:+t.toFixed(2),dir:d.toArray().map(v=>+v.toFixed(2)),n:[HIT.nx,HIT.ny,HIT.nz]};},camPos:()=>camera.position.toArray().map(v=>+v.toFixed(2)),buildings:()=>G.BUILDINGS.map(b=>[b.x0,b.z0,b.x1,b.z1]),py:()=>+P.y.toFixed(2),owned:()=>save.prog.owned,setWeapon:k=>{if(WEAPONS[k]){cur=k;for(const j of ORDER)views[j].group.visible=(j===cur);if(!wst[k])wst[k]={mag:magOf(k),reserve:WEAPONS[k].reserve};}},weaponState:()=>({cur,mag:wst[cur].mag,reserve:wst[cur].reserve}),projectiles:()=>({grenades:grenades.length,rockets:rockets.length,mines:mines.length}),pmines:()=>P.mines,dummy:(x,z,yaw,lower,upper,spd,n)=>{if(!window.__D){window.__D=pool.acquire();window.__D.spawn(x,0,z,yaw,1);dressEnemy&&0;}const D=window.__D;D.root.position.set(x,0,z);D.root.rotation.y=yaw;if(!D.lower||D.lower._clip.name!==lower)D.setLower(lower,0);if(upper&&(!D.upper||D.upper._clip.name!==upper))D.setUpper(upper,0);D.setGaitSpeed(spd||0);for(let i=0;i<(n||1);i++)D.update(1/60,camera.position,1);scene.updateMatrixWorld(true);return lower+' ts '+(D.lower?D.lower.getEffectiveTimeScale().toFixed(2):'-');},menuPose:(lower,upper,yaw,spd,n)=>{if(!pmodel)return 'no model';pmodel.root.rotation.y=yaw;if(pmodel.lower==null||pmodel.lower._clip.name!==lower)pmodel.setLower(lower,0);if(upper&&(pmodel.upper==null||pmodel.upper._clip.name!==upper))pmodel.setUpper(upper,0);pmodel.setGaitSpeed(spd||0);for(let i=0;i<(n||1);i++){pmodel.update(1/60,camera.position,1);}scene.updateMatrixWorld(true);return lower+' '+(pmodel.lower&&pmodel.lower.getEffectiveTimeScale().toFixed(2));},level:async(i)=>{save.settings.level=i;await loadLevel(i);return team.nome;},forceLod:l=>{window.__forceLod=l;},project:(x,y,z)=>{const v=new THREE.Vector3(x,y,z).project(camera);return {sx:+(((v.x+1)/2)*W).toFixed(0),sy:+(((1-v.y)/2)*H).toFixed(0),depth:+v.z.toFixed(3)};},meshInfo:()=>{const e=enemies.filter(e=>e.state!=='dead')[0];if(!e)return null;const m=e.model;const out=[];for(const lvl of [0,1,2])for(const sm of m.lods[lvl]){out.push({lvl,cls:sm.userData.cls,vis:sm.visible,parentVis:sm.parent.visible,rootVis:m.root.visible,skel:sm.skeleton.bones.length,bt:!!sm.skeleton.boneTexture,mat:sm.material.type,opacity:sm.material.opacity,transp:sm.material.transparent,posType:sm.geometry.attributes.position.array.constructor.name,norm:sm.geometry.attributes.position.normalized,hasSkin:!!sm.geometry.attributes.skinIndex,skinType:sm.geometry.attributes.skinIndex&&sm.geometry.attributes.skinIndex.array.constructor.name,drawRange:sm.geometry.drawRange.count,idx:!!sm.geometry.index});}return {lod:m.lod,items:out};},step:(dt,n)=>{for(let i=0;i<n;i++)update(dt);},spawnState:()=>({toSpawn,spawnT,spawnInt,wave,alive:enemies.filter(e=>e.state!=='dead').length,lastDt:window.__lastDt,poolFree:pool.items.filter(c=>!c.alive).length,spawns:G.SPAWNS.length,worldReady}),poolDump:()=>pool.items.map(c=>({alive:c.alive,vis:c.root.visible,x:+c.root.position.x.toFixed(1),z:+c.root.position.z.toFixed(1),isP:c===pmodel})).filter(c=>c.vis),look:(y,p)=>{P.yaw=y;P.pitch=p||0;},tp:(x,z)=>{P.x=x;P.z=z;},pos:()=>({x:P.x,z:P.z,yaw:P.yaw}),world:()=>{const out=[];scene.traverse(o=>{if(o.isInstancedMesh)out.push({n:o.name||(o.userData.moduleId||'?'),count:o.count,vis:o.visible,tris:(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3|0,mat:o.material.name||o.material.type,vc:!!o.material.vertexColors,hasCol:!!o.geometry.attributes.color,uv:!!o.geometry.attributes.uv,sphere:o.boundingSphere?[+o.boundingSphere.center.x.toFixed(1),+o.boundingSphere.center.z.toFixed(1),+o.boundingSphere.radius.toFixed(1)]:null});});return out;},dbg:()=>({mode,levelIdx,team:team.nome,wave,score,kills,head,endless,enemies:enemies.length,alive:enemies.filter(e=>e.state!=='dead').length,hp:P.hp,money:save.prog.money,unlocked:save.prog.unlocked,champion:save.prog.champion,quality:Q.label,worldReady,charAsset:registry.available.character,drawCalls:renderer.info?renderer.info.render.calls:0}),
  killAll:()=>{for(const e of enemies)if(e.state!=='dead')hitEnemy(e,99999,Math.random()<0.5,null,true);},hurt:n=>damagePlayer(n||30,{x:P.x+3,z:P.z}),gotoShop:()=>{P.x=G.SHOPS[0].x+2.6;P.z=G.SHOPS[0].z;},money:n=>{save.prog.money=n;},start:startGame,shop:openShop,closeShop,setQuality:q=>{save.settings.quality=q;applyQuality();},roles:()=>enemies.map(e=>e.role+'/'+e.team.key+'/'+e.state)};
requestAnimationFrame(frame);
}
