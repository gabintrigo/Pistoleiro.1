import * as THREE from 'three';
import { AssetRegistry } from './assets/AssetRegistry.js';
import { startGameApp } from './game/Game.js';
const canvas=document.getElementById('gl');
let renderer;
try{ renderer=new THREE.WebGLRenderer({canvas, antialias:false, powerPreference:'high-performance'}); }
catch(e){ document.getElementById('err').classList.remove('hidden'); document.getElementById('loading').style.display='none'; throw e; }
renderer.outputColorSpace=THREE.SRGBColorSpace;
const registry=new AssetRegistry(renderer, import.meta.env.BASE_URL);
startGameApp({renderer, registry}).catch(e=>{ const el=document.getElementById('err'); el.innerHTML='Erro ao iniciar:<br><small>'+(e&&e.message)+'<br>'+String(e&&e.stack||'').slice(0,400)+'</small>'; el.classList.remove('hidden'); document.getElementById('loading').style.display='none'; console.error(e); });
