/** Small procedural canvas textures that stay procedural on purpose (dynamic content: ads, scoreboard, crowd, numbers, kits fallback). */
import * as THREE from 'three';
const TAU=Math.PI*2, rand=(a,b)=>a+Math.random()*(b-a), css=h=>'#'+h.toString(16).padStart(6,'0');
const cache={};
export function canvasTex(key,w,h,fn,{srgb=true,repeat=null,aniso=4}={}){
  if(cache[key]) return cache[key];
  const c=document.createElement('canvas'); c.width=w; c.height=h; fn(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=aniso; if(srgb) t.colorSpace=THREE.SRGBColorSpace; if(repeat) t.repeat.set(repeat[0],repeat[1]); t.userData.canvas=c; return cache[key]=t;
}
function grain(g,w,h,n,col,a){ g.fillStyle=col; for(let i=0;i<n;i++){ g.globalAlpha=Math.random()*a; g.fillRect(Math.random()*w,Math.random()*h,rand(1,3),rand(1,3)); } g.globalAlpha=1; }
/** Pitch macro map: mowing stripes, official lines (scaled to the arena), worn patches. Detail grass comes from the PBR set. */
export function pitchMacro(W0,H0){
  return canvasTex('pitch_'+W0+'x'+H0,2048,Math.round(2048*H0/W0),(g,w,h)=>{
    const pp=w/W0; g.fillStyle='#4a8a34'; g.fillRect(0,0,w,h);
    const stripeW=5.25; for(let i=0;i<Math.ceil(H0/stripeW);i++){ if(i%2) continue; g.fillStyle='rgba(0,0,0,0.075)'; g.fillRect(0,i*stripeW*pp,w,stripeW*pp); }
    grain(g,w,h,20000,'#2f6a22',0.25); grain(g,w,h,12000,'#7cc25a',0.2);
    const mx=7.5,mz=6, X0=mx,X1=W0-mx,Z0=mz,Z1=H0-mz, cx=W0/2,cz=H0/2;
    for(const m of [[X0+5.5,cz,5.5],[X1-5.5,cz,5.5],[cx,cz,3.5]]){ const rg=g.createRadialGradient(m[0]*pp,m[1]*pp,0,m[0]*pp,m[1]*pp,m[2]*pp); rg.addColorStop(0,'rgba(120,88,48,0.45)'); rg.addColorStop(1,'rgba(120,88,48,0)'); g.fillStyle=rg; g.fillRect(0,0,w,h); }
    g.strokeStyle='rgba(255,255,255,0.92)'; g.lineWidth=0.13*pp; g.fillStyle=g.strokeStyle;
    g.strokeRect(X0*pp,Z0*pp,(X1-X0)*pp,(Z1-Z0)*pp); g.beginPath(); g.moveTo(cx*pp,Z0*pp); g.lineTo(cx*pp,Z1*pp); g.stroke();
    const r=Math.min(9.15,(Z1-Z0)/6); g.beginPath(); g.arc(cx*pp,cz*pp,r*pp,0,TAU); g.stroke(); g.beginPath(); g.arc(cx*pp,cz*pp,0.22*pp,0,TAU); g.fill();
    const bw=Math.min(16.5,(X1-X0)/6), bh=Math.min(40.32,(Z1-Z0)*0.6), gw=bw/3, gh=bh*0.45;
    for(const s of [1,-1]){ const gx=s>0?X0:X1, bx=Math.min(gx,gx+s*bw), b5=Math.min(gx,gx+s*gw), ps=gx+s*bw*0.67;
      g.strokeRect(bx*pp,(cz-bh/2)*pp,bw*pp,bh*pp); g.strokeRect(b5*pp,(cz-gh/2)*pp,gw*pp,gh*pp); g.beginPath(); g.arc(ps*pp,cz*pp,0.22*pp,0,TAU); g.fill();
      const a=Math.acos(Math.min(1,(bw-bw*0.67)/r)); g.beginPath(); g.arc(ps*pp,cz*pp,r*pp,s>0?-a:Math.PI-a,s>0?a:Math.PI+a); g.stroke(); }
    g.beginPath(); g.arc(X0*pp,Z0*pp,1*pp,0,Math.PI/2); g.stroke(); g.beginPath(); g.arc(X1*pp,Z0*pp,1*pp,Math.PI/2,Math.PI); g.stroke(); g.beginPath(); g.arc(X1*pp,Z1*pp,1*pp,Math.PI,Math.PI*1.5); g.stroke(); g.beginPath(); g.arc(X0*pp,Z1*pp,1*pp,Math.PI*1.5,TAU); g.stroke();
    g.fillStyle='#6e7073'; g.fillRect(0,0,3.8*pp,h); g.fillRect(w-3.8*pp,0,3.8*pp,h); g.fillRect(0,0,w,3.8*pp); g.fillRect(0,h-3.8*pp,w,3.8*pp);
  },{aniso:8});
}
/* bancadas: 2 fileiras de 6 adeptos por faixa de 4 m, maioria com a camisola da equipa; 2 quadros (braços em baixo / no ar) empilhados na textura */
export const CROWD_TEX=new Set();
export function crowdTex(team){
  const tex=canvasTex('crowd2_'+team.key,512,256,(g,w,h)=>{
    const shirt=css(team.shirt),c1=css(team.crowd[0]),c2=css(team.crowd[1]||team.crowd[0]);
    const pal=()=>{const r=Math.random();return r<0.6?shirt:r<0.78?c2:r<0.88?c1:(Math.random()<0.5?'#e8e8e8':'#1c1c1c');};
    const skins=['#f1c9a5','#d9a577','#a06a3c','#5c3a21','#e8b894'],hairs=['#2a1a0e','#111111','#6b4a2a','#c9a25a'];
    const fans=[];for(let rank=0;rank<2;rank++)for(let k=0;k<6;k++)fans.push({x:(k+0.5)*(512/6)+(rank?42:0)+rand(-7,7),y:rank?68:50,sc:rank?0.95:1.08,col:pal(),skin:skins[Math.floor(Math.random()*5)],hair:hairs[Math.floor(Math.random()*4)],hat:Math.random()<0.2,scarf:Math.random()<0.35,a:Math.random()<0.22,b:Math.random()<0.62});
    fans.sort((p,q)=>p.y-q.y);
    const fan=(x,y,sc,p,up)=>{
      if(up){ g.strokeStyle=p.col;g.lineWidth=7*sc;g.lineCap='round';g.beginPath();g.moveTo(x-14*sc,y+24*sc);g.lineTo(x-19*sc,y-22*sc);g.moveTo(x+14*sc,y+24*sc);g.lineTo(x+19*sc,y-22*sc);g.stroke();
        g.fillStyle=p.skin;g.beginPath();g.arc(x-19*sc,y-24*sc,5*sc,0,TAU);g.arc(x+19*sc,y-24*sc,5*sc,0,TAU);g.fill();
        if(p.scarf){ for(let i=0;i<6;i++){ g.fillStyle=i%2?c2:shirt; g.fillRect(x-26*sc+i*8.7*sc,y-33*sc,8.7*sc,10*sc); } } }
      else if(p.scarf){ for(let i=0;i<4;i++){ g.fillStyle=i%2?c2:shirt; g.fillRect(x-8*sc,y+14*sc+i*9*sc,9*sc,9*sc); } }
      g.fillStyle=p.col;g.beginPath();g.ellipse(x,y+30*sc,21*sc,26*sc,0,Math.PI,0);g.fill();g.fillRect(x-21*sc,y+30*sc,42*sc,44*sc);
      g.fillStyle='rgba(255,255,255,0.12)';g.fillRect(x-21*sc,y+30*sc,8*sc,44*sc);
      g.fillStyle=p.skin;g.beginPath();g.arc(x,y,12*sc,0,TAU);g.fill();
      g.fillStyle=p.hat?p.col:p.hair;g.beginPath();g.arc(x,y-3*sc,12.5*sc,Math.PI,TAU);g.fill();
      g.fillStyle='rgba(0,0,0,0.32)';g.fillRect(x-21*sc,y+66*sc,42*sc,6*sc); };
    const flag=Math.random()<0.55?rand(30,420):-1;
    for(let f=0;f<2;f++){ const oy=f*128; g.save();g.beginPath();g.rect(0,oy,w,128);g.clip();
      g.fillStyle='#24262c';g.fillRect(0,oy,w,128);
      for(let x=0;x<w;x+=64){ g.fillStyle=c1;g.globalAlpha=0.35;g.fillRect(x+6,oy+62,52,60); } g.globalAlpha=1;
      for(const p of fans) fan(p.x%w,oy+p.y,p.sc,p,f?p.b:p.a);
      if(flag>=0){ const fy=oy+(f?2:8); g.fillStyle='#5a4a36';g.fillRect(flag-3,fy,3,80); g.fillStyle=shirt;g.fillRect(flag,fy,78,36); g.fillStyle=c2;g.fillRect(flag,fy+13,78,10); }
      g.restore(); }
  },{aniso:4});
  CROWD_TEX.add(tex);return tex;
}
export const ADS=[['FOGO E SABOR','#c8102e','#ffffff'],['RODÍZIO & BUFFET','#151515','#f2c94c'],['BELISCO','#f2c94c','#151515'],['PISTOLEIRO','#1a1a1a','#ff3b3b'],['ARENA','#1e3a8a','#ffffff'],['GOLO!','#f4f4f4','#151515'],['SUPER LIGA','#2fb34a','#ffffff'],['A FINAL','#7fc4ec','#151515']];
export function adsTex(){ return canvasTex('ads',2048,256,(g,w,h)=>{ const pw=w/8; ADS.forEach((a,i)=>{ g.fillStyle=a[1]; g.fillRect(i*pw,0,pw,h); g.fillStyle=a[2]; g.font='bold 60px Impact,"Arial Black",sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(a[0],i*pw+pw/2,h/2,pw-20); g.fillStyle='rgba(0,0,0,0.35)'; g.fillRect(i*pw,0,4,h); }); },{aniso:8}); }
export function shopSignTex(){ return canvasTex('shopsign',256,128,(g,w,h)=>{ g.fillStyle='#0f2a1b'; g.fillRect(0,0,w,h); g.strokeStyle='#f2c94c'; g.lineWidth=8; g.strokeRect(6,6,w-12,h-12); g.fillStyle='#f2c94c'; g.font='bold 66px Impact,"Arial Black",sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('LOJA',w/2,52); g.font='bold 24px sans-serif'; g.fillStyle='#8fe38f'; g.fillText('armas · melhorias · €',w/2,100); }); }
export function cabinTex(){ return canvasTex('cabin',256,256,(g,w,h)=>{ g.fillStyle='#d9dbd6'; g.fillRect(0,0,w,h); grain(g,w,h,2500,'#8f918c',0.25); for(let x=0;x<w;x+=64){ g.fillStyle='rgba(0,0,0,0.18)'; g.fillRect(x,0,3,h); } g.fillStyle='#3a3f48'; g.fillRect(150,70,70,186); g.fillStyle='#2b3f5a'; g.fillRect(40,80,80,60); g.fillStyle='rgba(255,255,255,0.3)'; g.fillRect(40,80,80,14); g.fillStyle='#c8102e'; g.fillRect(0,0,w,10); }); }
export function crateTex(){ return canvasTex('crate',512,512,(g,w,h)=>{ g.fillStyle='#7a4f26'; g.fillRect(0,0,w,h); for(let y=0;y<h;y+=84){ g.fillStyle=(y/84)%2?'#6d4522':'#835529'; g.fillRect(0,y,w,80); } grain(g,w,h,6000,'#3a2410',0.4); g.strokeStyle='#4a2e12'; g.lineWidth=18; g.strokeRect(14,14,w-28,h-28); g.fillStyle='rgba(255,255,255,0.75)'; g.font='bold 60px Impact,"Arial Black",sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('BOLAS',w/2,h/2-8); }); }
export function burlapTex(){ return canvasTex('burlap',256,256,(g,w,h)=>{ g.fillStyle='#9c8a5e'; g.fillRect(0,0,w,h); grain(g,w,h,5000,'#5e4f30',0.5); grain(g,w,h,3000,'#c9b78a',0.4); }); }
export function concreteTex(){ return canvasTex('concrete_c2',512,512,(g,w,h)=>{ // betão: manchas suaves de grande escala, grão fino, cofragem e furos dos tirantes (sem as antigas elipses em forma de folha)
  g.fillStyle='#8d8a84'; g.fillRect(0,0,w,h);
  for(let i=0;i<46;i++){ const x=Math.random()*w,y=Math.random()*h,r=rand(60,170),gr=g.createRadialGradient(x,y,0,x,y,r),lt=Math.random()<0.5,a=rand(0.03,0.07); gr.addColorStop(0,lt?'rgba(190,186,178,'+a+')':'rgba(60,56,50,'+a+')'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; for(const ox of [-w,0,w]) for(const oy of [-h,0,h]){ g.save(); g.translate(ox,oy); g.fillRect(x-r,y-r,2*r,2*r); g.restore(); } }
  grain(g,w,h,9000,'#5e5b55',0.28); grain(g,w,h,4500,'#b3b0aa',0.22);
  g.strokeStyle='rgba(40,38,34,0.45)'; g.lineWidth=2; for(let y=0;y<=h;y+=256){ g.beginPath(); g.moveTo(0,y); g.lineTo(w,y); g.stroke(); } for(let r=0;r<2;r++) for(let x=(r%2)*256;x<=w;x+=512){ g.beginPath(); g.moveTo(x,r*256); g.lineTo(x,r*256+256); g.stroke(); }
  g.fillStyle='rgba(35,33,30,0.55)'; for(let y=64;y<h;y+=128) for(let x=64;x<w;x+=128){ g.beginPath(); g.arc(x,y,3.2,0,TAU); g.fill(); }
  g.strokeStyle='rgba(45,42,38,0.35)'; g.lineWidth=1; for(let k=0;k<2;k++){ let x=Math.random()*w,y=Math.random()*h; g.beginPath(); g.moveTo(x,y); for(let s=0;s<9;s++){ x+=rand(-14,14); y+=rand(6,18); g.lineTo(x,y); } g.stroke(); }
},{aniso:8}); }
export function containerTex(){ return canvasTex('container_c',512,512,(g,w,h)=>{ g.fillStyle='#bdbdbd'; g.fillRect(0,0,w,h); for(let x=0;x<w;x+=32){ g.fillStyle='#a3a3a3'; g.fillRect(x,0,14,h); g.fillStyle='#d2d2d2'; g.fillRect(x+14,0,4,h); } grain(g,w,h,4000,'#555555',0.35); for(let i=0;i<7;i++){ const x=Math.random()*w; g.fillStyle='rgba(120,60,20,'+rand(0.25,0.55).toFixed(2)+')'; g.fillRect(x,rand(0,h*0.5),rand(4,14),rand(80,300)); } g.fillStyle='rgba(0,0,0,0.4)'; g.fillRect(0,h-30,w,30); g.fillRect(0,0,w,12); },{aniso:8}); }
export function metalTex(){ return canvasTex('metal_c',256,256,(g,w,h)=>{ g.fillStyle='#8a8d93'; g.fillRect(0,0,w,h); grain(g,w,h,2500,'#5a5d63',0.3); for(let i=0;i<40;i++){ g.strokeStyle='rgba(40,40,44,0.45)'; g.lineWidth=1; g.beginPath(); const x=Math.random()*w,y=Math.random()*h; g.moveTo(x,y); g.lineTo(x+rand(-30,30),y+rand(-8,8)); g.stroke(); } for(let i=0;i<5;i++){ g.fillStyle='rgba(120,70,30,'+rand(0.15,0.35).toFixed(2)+')'; g.beginPath(); g.ellipse(Math.random()*w,Math.random()*h,rand(10,30),rand(6,14),Math.random()*3,0,TAU); g.fill(); } },{aniso:4}); }
/** tileable cloth weave normal map (height -> normal), for jerseys */
export function fabricNormalTex(){
  const key='fabric_n'; if(cache[key]) return cache[key];
  const N=128,h=new Float32Array(N*N);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){ const wx=Math.sin(x*Math.PI/4),wy=Math.sin(y*Math.PI/4); h[y*N+x]=0.5+0.25*(((x>>2)+(y>>2))&1?wx:wy)+0.08*(Math.random()-0.5); }
  const c=document.createElement('canvas'); c.width=N; c.height=N; const g=c.getContext('2d'); const img=g.createImageData(N,N);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){ const l=h[y*N+((x+N-1)%N)],r=h[y*N+((x+1)%N)],u=h[((y+N-1)%N)*N+x],d=h[((y+1)%N)*N+x]; let nx=(l-r)*2.2,ny=(u-d)*2.2,nz=1; const len=Math.hypot(nx,ny,nz); nx/=len;ny/=len;nz/=len; const i=(y*N+x)*4; img.data[i]=(nx*0.5+0.5)*255; img.data[i+1]=(ny*0.5+0.5)*255; img.data[i+2]=(nz*0.5+0.5)*255; img.data[i+3]=255; }
  g.putImageData(img,0,0); const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(28,28); t.colorSpace=THREE.NoColorSpace; cache[key]=t; return t;
}
export function netTex(){ return canvasTex('net',64,64,(g,w,h)=>{ g.clearRect(0,0,w,h); g.strokeStyle='rgba(245,245,245,0.95)'; g.lineWidth=1.6; for(let i=0;i<=w;i+=8){ g.beginPath(); g.moveTo(i,0); g.lineTo(i,h); g.moveTo(0,i); g.lineTo(w,i); g.stroke(); } },{repeat:[1,1]}); }
export function numberTex(team,num,gk){
  return canvasTex('num_'+team.key+'_'+(gk?'g':'')+num,128,160,(g,w,h)=>{ const kit=gk?team.gk:team; g.fillStyle=css(kit.shirt); g.fillRect(0,0,w,h); if(team.stripes&&!gk){ const n=5,sw=w/n; for(let i=0;i<n;i++) if(i%2){ g.fillStyle=css(team.stripes); g.fillRect(i*sw,0,sw,h); } } g.fillStyle=css(gk?0xffffff:team.numCol); g.font='bold 96px Impact,"Arial Black",sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.strokeStyle='rgba(0,0,0,0.35)'; g.lineWidth=4; g.strokeText(String(num),w/2,h/2+6); g.fillText(String(num),w/2,h/2+6); });
}
export const texPuff=()=>canvasTex('puff',64,64,(g,w,h)=>{ const r=g.createRadialGradient(32,32,0,32,32,32); r.addColorStop(0,'rgba(255,255,255,1)'); r.addColorStop(0.4,'rgba(255,255,255,0.55)'); r.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=r; g.fillRect(0,0,w,h); },{srgb:false});
export const texFire=()=>canvasTex('fire',128,128,(g,w,h)=>{ const r=g.createRadialGradient(64,64,0,64,64,64); r.addColorStop(0,'rgba(255,255,230,1)'); r.addColorStop(0.25,'rgba(255,210,90,0.95)'); r.addColorStop(0.55,'rgba(255,110,20,0.6)'); r.addColorStop(1,'rgba(120,30,0,0)'); g.fillStyle=r; g.fillRect(0,0,w,h); },{srgb:false});
export const texHole=()=>canvasTex('hole',64,64,(g,w,h)=>{ const r=g.createRadialGradient(32,32,2,32,32,30); r.addColorStop(0,'rgba(5,5,5,0.95)'); r.addColorStop(0.35,'rgba(20,20,20,0.85)'); r.addColorStop(0.7,'rgba(40,40,40,0.35)'); r.addColorStop(1,'rgba(60,60,60,0)'); g.fillStyle=r; g.fillRect(0,0,w,h); },{srgb:false});
export const texPool=()=>canvasTex('pool',128,128,(g,w,h)=>{ const r=g.createRadialGradient(64,64,0,64,64,64); r.addColorStop(0,'rgba(255,225,170,0.55)'); r.addColorStop(0.5,'rgba(255,215,150,0.2)'); r.addColorStop(1,'rgba(255,200,130,0)'); g.fillStyle=r; g.fillRect(0,0,w,h); },{srgb:false});
export const texJersey=(name='PISTOLEIRO')=>canvasTex('jersey_'+name,256,320,(g,w,h)=>{ g.fillStyle='#c8102e'; g.fillRect(0,0,w,h); grain(g,w,h,1400,'#7a0a1c',0.25); g.fillStyle='#ffffff'; g.textAlign='center'; g.textBaseline='middle'; g.font='bold 58px Impact,"Arial Black",sans-serif'; g.font='bold '+(name.length>8?44:58)+'px Impact,"Arial Black",sans-serif'; g.fillText(name,w/2,86); });
/* cartazes e grafitos satíricos colados nos contentores */
export function posterTex(k){ return canvasTex('poster'+k,256,352,(g,w,h)=>{
  const torn=()=>{ g.fillStyle='rgba(40,40,40,0.55)'; for(let i=0;i<4;i++){ const x=Math.random()<0.5?0:w-26,y=Math.random()*h; g.beginPath();g.moveTo(x,y);g.lineTo(x+26,y+10);g.lineTo(x,y+30);g.fill(); } grain(g,w,h,1800,'#000',0.08); };
  const txt=(s,x,y,size,col,font)=>{ g.font=(font||'bold')+' '+size+'px Impact,"Arial Black",sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillStyle=col; g.fillText(s,x,y,w-24); };
  if(k===0){ g.fillStyle='#1d3a8a';g.fillRect(0,0,w,h); g.fillStyle='#c8102e';g.fillRect(0,h-92,w,92);
    g.fillStyle='#f1c9a5';g.beginPath();g.arc(128,150,62,0,TAU);g.fill(); g.strokeStyle='#3a2a1a';g.lineWidth=6;for(let i=0;i<4;i++){g.beginPath();g.moveTo(80,112+i*6);g.quadraticCurveTo(128,88+i*4,178,110+i*6);g.stroke();}
    g.fillStyle='#fff';g.beginPath();g.arc(128,172,30,0,Math.PI);g.fill(); g.fillStyle='#222';g.beginPath();g.arc(106,142,7,0,TAU);g.arc(150,142,7,0,TAU);g.fill();
    txt('VOTA',128,36,46,'#f2c94c'); txt('NABO',128,h-62,64,'#ffffff'); txt('A bola é de todos. Mas é minha.',128,h-18,17,'#ffe9a0','bold'); }
  else if(k===1){ g.fillStyle='#e9d8a6';g.fillRect(0,0,w,h); g.strokeStyle='#6b4a2a';g.lineWidth=10;g.strokeRect(10,10,w-20,h-20);
    txt('PROCURA-SE',128,48,40,'#4a2a12'); g.fillStyle='#3a2616';g.beginPath();g.arc(128,168,44,0,TAU);g.fill(); g.fillRect(60,118,136,14); g.beginPath();g.ellipse(128,112,40,26,0,Math.PI,0);g.fill(); g.fillRect(88,204,80,70);
    txt('O PISTOLEIRO',128,h-66,30,'#4a2a12'); txt('Recompensa: 1 bilhete VIP',128,h-32,17,'#6b4a2a','bold'); }
  else if(k===2){ g.fillStyle='#8b8e92';g.fillRect(0,0,w,h); grain(g,w,h,3500,'#55595e',0.35); g.fillStyle='rgba(233,216,166,0.8)';g.fillRect(30,40,120,90);
    g.save();g.translate(128,190);g.rotate(-0.12);txt('FORA',0,-38,64,'#ff2fa8');txt('NABO!',0,34,70,'#39e26b');g.restore();
    g.fillStyle='#ff2fa8';for(let i=0;i<7;i++){const x=60+Math.random()*140,y=150+Math.random()*30;g.fillRect(x,y,3,20+Math.random()*50);} }
  else { g.fillStyle='#141414';g.fillRect(0,0,w,h); g.fillStyle='#f2c94c';g.fillRect(0,0,w,18);g.fillRect(0,h-18,w,18);
    txt('VAR',128,110,104,'#ffffff'); txt('=',128,188,64,'#f2c94c'); txt('VERGONHA',128,258,50,'#f2c94c'); txt('Liga Nabo · época 2026',128,h-40,16,'#9aa0a8','bold'); }
  torn(); },{aniso:4}); }

/* reboco (paredes das casinhas; a cor vem da paleta do país por instância) */
export function plasterTex(){ return canvasTex('plaster',512,512,(g,w,h)=>{ g.fillStyle='#e9e6df'; g.fillRect(0,0,w,h);
  for(let i=0;i<60;i++){ const x=Math.random()*w,y=Math.random()*h,r=rand(40,140),gr=g.createRadialGradient(x,y,0,x,y,r); gr.addColorStop(0,Math.random()<0.5?'rgba(255,255,255,0.08)':'rgba(120,110,95,0.07)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.fillRect(x-r,y-r,2*r,2*r); }
  grain(g,w,h,12000,'#b9b3a6',0.22); grain(g,w,h,6000,'#ffffff',0.25);
  const gr=g.createLinearGradient(0,h*0.78,0,h); gr.addColorStop(0,'rgba(90,80,65,0)'); gr.addColorStop(1,'rgba(90,80,65,0.22)'); g.fillStyle=gr; g.fillRect(0,h*0.78,w,h*0.22);
  g.strokeStyle='rgba(90,84,74,0.3)'; g.lineWidth=1; for(let k=0;k<3;k++){ let x=Math.random()*w,y=Math.random()*h; g.beginPath(); g.moveTo(x,y); for(let s=0;s<6;s++){ x+=rand(-12,12); y+=rand(4,14); g.lineTo(x,y); } g.stroke(); }
},{aniso:8}); }
/* chão por país: calçada (ESP), lajes (FRA), asfalto (ALE), ondas de Copacabana (BRA), empedrado (ARG) */
export function groundTex(kind){ return canvasTex('ground_'+kind,512,512,(g,w,h)=>{
  if(kind==='calcada'){ g.fillStyle='#7d7568'; g.fillRect(0,0,w,h); for(let y=0;y<h;y+=32) for(let x=0;x<w;x+=32){ const v=172+Math.random()*30|0; g.fillStyle='rgb('+v+','+(v-8)+','+(v-26)+')'; g.fillRect(x+2+rand(-1,1),y+2+rand(-1,1),28,28); } grain(g,w,h,6000,'#6a6255',0.25); }
  else if(kind==='lajes'){ g.fillStyle='#6f6c66'; g.fillRect(0,0,w,h); for(let y=0;y<h;y+=128) for(let x=0;x<w;x+=128){ const v=165+Math.random()*30|0,o=(y/128)%2?64:0; g.fillStyle='rgb('+v+','+(v-4)+','+(v-14)+')'; g.fillRect(((x+o)%w)+3,y+3,122,122); if(o) g.fillRect(0,y+3,o-3,122); } grain(g,w,h,9000,'#57544e',0.25); grain(g,w,h,5000,'#d8d4cc',0.18); }
  else if(kind==='asfalto'){ g.fillStyle='#3d3f42'; g.fillRect(0,0,w,h); grain(g,w,h,22000,'#26282a',0.45); grain(g,w,h,9000,'#6a6c70',0.35);
    for(let i=0;i<5;i++){ const x=Math.random()*w,y=Math.random()*h,r=rand(40,110),gr=g.createRadialGradient(x,y,0,x,y,r); gr.addColorStop(0,'rgba(18,20,24,0.45)'); gr.addColorStop(1,'rgba(18,20,24,0)'); g.fillStyle=gr; g.fillRect(x-r,y-r,2*r,2*r); }
    g.strokeStyle='rgba(15,15,16,0.6)'; g.lineWidth=1.4; for(let k=0;k<5;k++){ let x=Math.random()*w,y=Math.random()*h; g.beginPath(); g.moveTo(x,y); for(let s=0;s<10;s++){ x+=rand(-18,18); y+=rand(-18,18); g.lineTo(x,y); } g.stroke(); } }
  else if(kind==='copacabana'){ const id=g.createImageData(w,h),d=id.data; for(let y=0;y<h;y++) for(let x=0;x<w;x++){ const cx=Math.floor(x/6),cy=Math.floor(y/6),jx=((cx*73+cy*151)%7)/7,wv=Math.sin((y/h)*Math.PI*4+Math.sin((x/w)*Math.PI*2)*0.9); const dark=Math.sin((x/w)*Math.PI*8+wv*1.6)>0; const edge=(x%6===0||y%6===0); let v=dark?40+jx*18:222+jx*20; if(edge) v*=0.7; const i=(y*w+x)*4; d[i]=v; d[i+1]=v*(dark?1:0.98); d[i+2]=v*(dark?1:0.94); d[i+3]=255; } g.putImageData(id,0,0); }
  else { g.fillStyle='#4a4846'; g.fillRect(0,0,w,h); for(let y=0,r=0;y<h;y+=28,r++) for(let x=-24;x<w;x+=48){ const o=r%2?24:0,v=112+Math.random()*50|0; g.fillStyle='rgb('+v+','+(v-3)+','+(v-8)+')'; g.beginPath(); if(g.roundRect) g.roundRect(x+o+2,y+2,44,24,7); else g.rect(x+o+2,y+2,44,24); g.fill(); } grain(g,w,h,7000,'#2e2c2a',0.3); }
},{aniso:8}); }
/* linhas do campo pintadas por cima do chão (futebol de rua), com desgaste */
export function pitchLinesTex(W0,H0){ const cw=1024,ch=Math.round(1024*H0/W0); return canvasTex('lines_'+W0+'x'+H0,cw,ch,(g,w,h)=>{ const sx=w/W0,sy=h/H0; g.clearRect(0,0,w,h); g.strokeStyle='rgba(240,240,236,0.8)'; g.lineWidth=Math.max(2,0.14*sx);
  const m=2*sx; g.strokeRect(m,m,w-2*m,h-2*m); g.beginPath(); g.moveTo(w/2,m); g.lineTo(w/2,h-m); g.stroke(); g.beginPath(); g.arc(w/2,h/2,9.15*sx,0,TAU); g.stroke();
  for(const s of [0,1]){ const x0=s?w-m:m,dir=s?-1:1; const bh=40.3*sy,sh=18.3*sy; g.strokeRect(Math.min(x0,x0+dir*16.5*sx),h/2-bh/2,16.5*sx,bh); g.strokeRect(Math.min(x0,x0+dir*5.5*sx),h/2-sh/2,5.5*sx,sh); }
  g.globalCompositeOperation='destination-out'; for(let i=0;i<5000;i++){ g.fillStyle='rgba(0,0,0,'+rand(0.2,0.9).toFixed(2)+')'; g.fillRect(Math.random()*w,Math.random()*h,rand(1,4),rand(1,4)); } g.globalCompositeOperation='source-over';
},{srgb:true,aniso:4}); }

/* sombra de contacto: mancha radial suave (alfa no canal de cor, usada com cor preta) */
export function blobTex(){ return canvasTex('blob',128,128,(g,w,h)=>{ const gr=g.createRadialGradient(64,64,6,64,64,64); gr.addColorStop(0,'rgba(255,255,255,0.9)'); gr.addColorStop(0.45,'rgba(255,255,255,0.55)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.clearRect(0,0,w,h); g.fillStyle=gr; g.fillRect(0,0,w,h); },{srgb:false,aniso:1}); }
