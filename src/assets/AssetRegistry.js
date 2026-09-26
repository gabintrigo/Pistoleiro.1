/** AssetRegistry: loads the manifest and turns external assets into ready-to-use three.js objects.
 *  - GLB modules (meshopt), skinned character template, KTX2 PBR sets, RGBE HDRIs (PMREM)
 *  - Material factory: maps module material names -> PBR texture sets + parameters
 *  - Every load is cached; failures return null so callers fall back to procedural content. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import manifest from './manifest.json' with { type: 'json' };
import { concreteTex, containerTex, metalTex, plasterTex } from '../world/Textures.js';
const CANVAS_COLOR={concrete:concreteTex, corrugated:containerTex, metal_painted:metalTex, plaster:plasterTex};

export class AssetRegistry {
  constructor(renderer, base='./'){
    this.renderer=renderer; this.base=base; this.manifest=manifest; this.cache=new Map();
    // single-file build: every asset URL is redirected to an in-memory blob (see tools/singlefile.mjs)
    if(typeof window!=='undefined'&&window.__resolveEmbedded){ THREE.DefaultLoadingManager.setURLModifier(window.__resolveEmbedded); this.singleFile=true; } this.pmrem=new THREE.PMREMGenerator(renderer); this.pmrem.compileEquirectangularShader();
    this.ktx2=new KTX2Loader().setTranscoderPath(base+'basis/').detectSupport(renderer);
    try{ const w=this.ktx2.workerConfig||{}; this.ktxFormat=w.astcSupported?'ASTC':w.etc2Supported?'ETC2':w.bptcSupported?'BPTC':w.dxtSupported?'DXT':'RGBA'; }catch(e){ this.ktxFormat='?'; }
    this.gltf=new GLTFLoader().setKTX2Loader(this.ktx2).setMeshoptDecoder(MeshoptDecoder);
    this.rgbe=new RGBELoader();
    this.materialSets={}; this.available={character:false,modules:false,materials:false,hdri:false};
    this.log=[]; this.failed=[];
  }
  url(p){ return this.base+p; }
  note(...a){ this.log.push(a.join(' ')); console.log('[assets]',...a); }
  async _cached(key, fn){ if(this.cache.has(key)) return this.cache.get(key); const attempt=()=>fn(); const p=attempt().catch(()=>new Promise(r=>setTimeout(r,400)).then(attempt)).catch(e=>{ const m=String(e&&e.message||e).slice(0,90); this.failed.push(key+': '+m); this.note('FALHOU',key,m); return null; }); this.cache.set(key,p); return p; }
  /* ---- textures ---- */
  async texture(path, {srgb=true, repeat=null, aniso=4}={}){
    return this._cached('tex:'+path, async()=>{ const t=await this.ktx2.loadAsync(this.url(path)); if(srgb) t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; if(repeat) t.repeat.set(repeat[0],repeat[1]); t.anisotropy=aniso; t.needsUpdate=true; return t; });
  }
  async materialSet(id, aniso=4){
    const m=this.manifest.materials[id]; if(!m) return null;
    return this._cached('set:'+id, async()=>{ const [map,normal,rough]=await Promise.all([m.color?this.texture(m.color,{srgb:true,aniso}):null, m.normal?this.texture(m.normal,{srgb:false,aniso}):null, m.rough?this.texture(m.rough,{srgb:false,aniso}):null]); return {map,normalMap:normal,roughnessMap:rough}; });
  }
  /* ---- HDRI -> PMREM env + background ---- */
  async environment(id){
    const h=this.manifest.hdri[id]; if(!h) return null;
    return this._cached('env:'+id, async()=>{ const tex=await this.rgbe.loadAsync(this.url(h.path)); tex.mapping=THREE.EquirectangularReflectionMapping; const env=this.pmrem.fromEquirectangular(tex).texture; return {env, background:tex}; });
  }
  /* ---- modules (static GLB) ---- */
  /** first-person / enemy weapon model: {scene, body, mag, tip, eject} or null */
  async weapon(id){
    const w=this.manifest.weapons&&this.manifest.weapons[id]; if(!w) return null;
    return this._cached('wpn:'+id, async()=>{ const g=await this.gltf.loadAsync(this.url(w.path)); const find=n=>g.scene.getObjectByName(n)||null; g.scene.traverse(o=>{ if(o.isMesh){ o.castShadow=false; o.receiveShadow=false; } }); return {scene:g.scene, body:find('body'), mag:find('mag'), tip:find('tip'), eject:find('eject'), info:w}; });
  }
  async module(id){
    const m=this.manifest.modules[id]; if(!m) return null;
    return this._cached('mod:'+id, async()=>{ const g=await this.gltf.loadAsync(this.url(m.path)); const meshes=[]; g.scene.traverse(o=>{ if(o.isMesh) meshes.push(o); }); this.modulesOk=(this.modulesOk||0)+1; return {scene:g.scene, meshes, info:m}; });
  }
  /* ---- character template (skinned + animations + LODs) ---- */
  async character(name='human_base'){
    const c=this.manifest.characters[name]; if(!c) return null;
    return this._cached('char:'+name, async()=>{
      const lods=c.lods||{}; const [g0,g1,g2]=await Promise.all([this.gltf.loadAsync(this.url(c.path)), lods.lod1?this.gltf.loadAsync(this.url(lods.lod1)).catch(()=>null):null, lods.lod2?this.gltf.loadAsync(this.url(lods.lod2)).catch(()=>null):null]);
      const skins={light:null}; const body=g0.scene.getObjectByName('Body')||g0.scene.children.find(o=>o.isSkinnedMesh);
      for(const tone of Object.keys(c.skins||{})) skins[tone]=await this.texture(c.skins[tone],{srgb:true,aniso:4});
      const kits={}; for(const id of Object.keys(c.kits||{})) kits[id]=await this.texture(c.kits[id],{srgb:true,aniso:2});
      return {gltf:g0, lod1:g1, lod2:g2, clips:g0.animations, skins, kits, info:c, flat:!!(c.meta&&c.meta.flatKit)};
    });
  }
  /* ---- material factory for module material names ---- */
  async pbr(name, opts={}){
    const key='mat:'+name+JSON.stringify(opts); if(this.cache.has(key)) return this.cache.get(key);
    const spec=MATERIAL_SPECS[name]||{color:0x9a9a9a};
    const mat=new THREE.MeshStandardMaterial({color:new THREE.Color(spec.color||0xffffff), roughness:spec.roughness??0.8, metalness:spec.metalness??0.0, vertexColors:!!opts.vertexColors, emissive:new THREE.Color(spec.emissive||0x000000), emissiveIntensity:spec.emissiveIntensity??1, transparent:!!spec.transparent, opacity:spec.opacity??1, side:spec.side||THREE.FrontSide});
    if(spec.set){ const s=await this.materialSet(spec.set, opts.aniso||4); if(s){ if(s.map) mat.map=s.map; if(s.normalMap){ mat.normalMap=s.normalMap; mat.normalScale.set(spec.normalScale||1,spec.normalScale||1); } if(s.roughnessMap) mat.roughnessMap=s.roughnessMap; if(spec.repeat){ for(const t of [mat.map,mat.normalMap,mat.roughnessMap]) if(t){ t.repeat.set(spec.repeat[0],spec.repeat[1]); } } mat.needsUpdate=true; } }
    if(CANVAS_COLOR[name]){ mat.map=CANVAS_COLOR[name](); if(spec.repeat) mat.map.repeat.set(spec.repeat[0],spec.repeat[1]); mat.needsUpdate=true; }
    if(opts.canvasMap){ mat.map=opts.canvasMap; mat.needsUpdate=true; }
    this.cache.set(key,mat); return mat;
  }
}
/** Module material name -> PBR spec (set = baked/scanned texture set id in the manifest) */
export const MATERIAL_SPECS = {
  concrete:{set:'concrete',color:0xffffff,roughness:0.95,repeat:[1,1],normalScale:0.5},
  metal_painted:{set:'metal_painted',color:0xffffff,roughness:0.5,metalness:0.45,normalScale:0.4},
  metal_dark:{color:0x2c2f35,roughness:0.55,metalness:0.7},
  plastic:{set:'plastic',color:0xffffff,roughness:0.45,normalScale:0.3},
  rubber:{set:'rubber_track',color:0x222222,roughness:0.9},
  corrugated:{set:'corrugated',color:0xffffff,roughness:0.55,metalness:0.35,normalScale:1.0},
  lamp:{color:0xfff6dc,emissive:0xfff0c8,emissiveIntensity:2.5,roughness:0.4},
  glass:{color:0x203040,roughness:0.08,metalness:0.6,transparent:true,opacity:0.55},
  goal_white:{color:0xf4f4f4,roughness:0.4},
  net:{color:0xdddddd,roughness:0.9,transparent:true,opacity:0.9,side:THREE.DoubleSide},
  ads:{color:0xffffff,roughness:0.5,emissive:0xffffff,emissiveIntensity:0.15},
  crate:{color:0x8a5a2e,roughness:0.9}, burlap:{color:0x9c8a5e,roughness:1.0},
  shop_green:{color:0x1f3a2a,roughness:0.6,metalness:0.3}, brass:{color:0xc9a227,roughness:0.35,metalness:0.8}, shopsign:{color:0xffffff,emissive:0xffffff,emissiveIntensity:1.0},
  cabin:{color:0xd9dbd6,roughness:0.7,metalness:0.15},
  cart_white:{color:0xf2f2f2,roughness:0.45,metalness:0.2}, cross_red:{color:0xd8202a,roughness:0.5},
  barrel_a:{color:0x9a3b2f,roughness:0.55,metalness:0.4}, barrel_b:{color:0x2f5f9a,roughness:0.55,metalness:0.4}, barrel_c:{color:0x5a6b3a,roughness:0.55,metalness:0.4},
  flag_a:{color:0xd8202a,roughness:0.9}, flag_b:{color:0xf2c94c,roughness:0.9},
  grass:{set:'grass',color:0xffffff,roughness:0.9},
  lm_stone:{color:0xd6bf94,roughness:0.92}, lm_dark:{color:0x3a342e,roughness:0.95}, lm_white:{color:0xe6e3dc,roughness:0.85}, lm_bronze:{color:0x5e4632,roughness:0.6,metalness:0.35}, lm_steel:{color:0xa8b0b8,roughness:0.3,metalness:0.8}, lm_red:{color:0xc8322a,roughness:0.6}, lm_rock:{color:0x5d6a48,roughness:1.0},
  bark:{color:0x5a4030,roughness:0.95}, leaf:{color:0x4f7a36,roughness:0.85}, leaf_dark:{color:0x2f4f2a,roughness:0.9}, leaf_purple:{color:0x8a5ac8,roughness:0.85},
  plaster:{color:0xffffff,roughness:0.92}, shutter:{color:0xffffff,roughness:0.6}, door_wood:{color:0x5a3a22,roughness:0.75}, window_frame:{color:0xe4e0d6,roughness:0.6}
};
