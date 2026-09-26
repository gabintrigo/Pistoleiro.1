/** Packs dist/ into ONE self-contained HTML (assets embedded as base64, fetch() intercepted) so the game runs
 *  from a local file in apps like Documents (iOS) exactly like the previous single-file version. */
import fs from 'node:fs'; import path from 'node:path';
const DIST=path.resolve('dist'), OUT=path.resolve(process.argv[2]||'/mnt/user-data/outputs/regresso-do-pistoleiro.html'), HOSTED=process.argv.includes('--hosted');
const html=fs.readFileSync(path.join(DIST,'index.html'),'utf8');
const jsFile=html.match(/src="\.\/(assets\/index-[^"]+\.js)"/)[1];
const js=fs.readFileSync(path.join(DIST,jsFile),'utf8');
const files={}; const walk=(d,rel='')=>{ for(const f of fs.readdirSync(d)){ const p=path.join(d,f), r=rel?rel+'/'+f:f; const st=fs.statSync(p); if(st.isDirectory()) walk(p,r); else if(!/\.(js|html|webmanifest)$/.test(f)||/basis_transcoder.*\.js$/.test(f)) files[r]=p; } };
walk(path.join(DIST,'assets'),'assets'); walk(path.join(DIST,'basis'),'basis');
let total=0; const entries=[]; for(const [k,p] of Object.entries(files)){ const b=fs.readFileSync(p); total+=b.length; entries.push(JSON.stringify(k)+':"'+b.toString('base64')+'"'); }
const embed='window.__EMBEDDED={'+entries.join(',\n')+'};';
const shim=`(function(){const E=window.__EMBEDDED;const keys=Object.keys(E);const b64=s=>{const bin=atob(s),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u;};
function key(u){u=String(u).split('?')[0].split('#')[0];let m=u.match(/(assets\\/[^\\s]+|basis\\/[^\\s]+)$/);if(m&&E[m[1]])return m[1];const base=u.split('/').pop();return keys.find(k=>k.split('/').pop()===base)||null;}
const mime=k=>k.endsWith('.wasm')?'application/wasm':k.endsWith('.js')?'text/javascript':k.endsWith('.glb')?'model/gltf-binary':k.endsWith('.png')?'image/png':'application/octet-stream';
const orig=window.fetch.bind(window);
window.fetch=function(input,init){const u=input instanceof Request?input.url:String(input);const k=key(u);if(k){const bytes=b64(E[k]);return Promise.resolve(new Response(bytes,{status:200,headers:{'Content-Type':mime(k),'Content-Length':String(bytes.length)}}));}return orig(input,init);};
const cache={};window.__resolveEmbedded=function(url){const k=key(url);if(!k)return url;if(!cache[k])cache[k]=URL.createObjectURL(new Blob([b64(E[k])],{type:mime(k)}));return cache[k];};
window.__SINGLEFILE=true;})();`;
let out=html.replace(/<link rel="manifest"[^>]*>\s*/,'').replace(/<script id="vite-plugin-pwa:register-sw"[^>]*><\/script>\s*/,'').replace(/<script type="module" crossorigin src="[^"]+"><\/script>/,'');
if(HOSTED){ out=out.replace('</head>',()=>'<link rel="manifest" href="./manifest.webmanifest">\n<script>if(location.protocol.startsWith(\'http\')&&\'serviceWorker\' in navigator){window.addEventListener(\'load\',()=>{navigator.serviceWorker.register(\'./sw.js\').catch(()=>{});});}</script>\n</head>'); }
out=out.replace('</head>',()=>'<script>'+embed+'\n'+shim+'</script>\n</head>').replace('</body>',()=>'<script type="module">\n'+js.replace(/<\/script>/g,'<\\/script>')+'\n</script>\n</body>');
fs.writeFileSync(OUT,out);
console.log('[singlefile] embedded',entries.length,'files,',Math.round(total/1048576*10)/10,'MB raw ->',Math.round(fs.statSync(OUT).size/1048576*10)/10,'MB html at',OUT);
