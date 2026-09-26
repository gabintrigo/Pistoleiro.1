// Grid, collision, line of sight and ray marching (extracted from v4b)
import { TEAMS } from '../game/Data.js';
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
export const S=4;export const G={MAP:null,MW:0,MH:0,BOX:null,SPAWNS:[],START:null,LAMPS:[],SHOPS:[],flow:null};
let MAP,MW,MH,BOX,SPAWNS,START,LAMPS,SHOPS,flow;
export const FULL={x0:-1e9,x1:1e9,z0:-1e9,z1:1e9,h:100,los:true};
export const boxAt=(cx,cz)=>(cx<0||cz<0||cx>=MW||cz>=MH)?FULL:BOX[cx+cz*MW];
function hash2(x,z){let h=(x*374761393+z*668265263)|0;h=(h^(h>>13))*1274126177;return ((h^(h>>16))>>>0)/4294967295;}
export function setMap(idx){
  MAP=TEAMS[idx].layout;MH=MAP.length;MW=MAP[0].length;BOX=new Array(MW*MH).fill(null);SPAWNS=[];LAMPS=[];SHOPS=[];START={x:MW*S/2,z:MH*S/2};flow=new Int16Array(MW*MH);
  for(let z=0;z<MH;z++)for(let x=0;x<MW;x++){
    const ch=MAP[z][x],bx=x*S,bz=z*S;let B=null;
    if(ch==='#')B={x0:bx,x1:bx+S,z0:bz,z1:bz+S,h:1.0,los:true};
    else if(ch==='H')B={x0:bx,x1:bx+S,z0:bz,z1:bz+S,h:3.2,los:true};
    else if(ch==='C')B={x0:bx,x1:bx+S,z0:bz,z1:bz+S,h:3.45,los:true,top:(TEAMS[idx].theme&&TEAMS[idx].theme.key==='cft')?2.9:3.2}; // casinha (contentor no iate); top = onde se pisa
    else if(ch==='D')B={x0:bx,x1:bx+S,z0:bz,z1:bz+S,h:2.3,los:true};
    else if(ch==='G')B={x0:bx,x1:bx+S,z0:bz,z1:bz+S,h:2.5,los:false};
    else if(ch==='c')B={x0:bx+0.3,x1:bx+S-0.3,z0:bz+0.3,z1:bz+S-0.3,h:1.6,los:false};
    else if(ch==='K')B={x0:bx+0.3,x1:bx+S-0.3,z0:bz+0.3,z1:bz+S-0.3,h:2.6,los:true};
    else if(ch==='b')B={x0:bx+0.7,x1:bx+S-0.7,z0:bz+0.7,z1:bz+S-0.7,h:1.3,los:false};
    else if(ch==='L'){B={x0:bx+1.82,x1:bx+2.18,z0:bz+1.82,z1:bz+2.18,h:6.5,los:false};LAMPS.push({x:bx+2,z:bz+2});}
    else if(ch==='M'){B={x0:bx+0.85,x1:bx+S-0.85,z0:bz+0.85,z1:bz+S-0.85,h:1.5,los:false};SHOPS.push({x:bx+2,z:bz+2});}
    else if(ch==='V'){const rot=hash2(x,z)<0.5?0:1;B=rot?{x0:bx+1.2,x1:bx+2.8,z0:bz+0.6,z1:bz+3.4,h:1.7,los:true,rot:1}:{x0:bx+0.6,x1:bx+3.4,z0:bz+1.2,z1:bz+2.8,h:1.7,los:true,rot:0};}
    else if(ch==='w'||ch==='S'||ch==='J'){const vert=(z>0&&MAP[z-1][x]===ch)||(z<MH-1&&MAP[z+1][x]===ch);const th=ch==='w'?0.3:(ch==='J'?0.7:1.3),hh=1.0;B=vert?{x0:bx+2-th/2,x1:bx+2+th/2,z0:bz,z1:bz+S,h:hh,los:false,vert:true}:{x0:bx,x1:bx+S,z0:bz+2-th/2,z1:bz+2+th/2,h:hh,los:false,vert:false};}
    else if(ch==='s')SPAWNS.push({x:bx+2,z:bz+2});
    else if(ch==='P')START={x:bx+2,z:bz+2};
    BOX[x+z*MW]=B;
  }
  // buildings (anchor 'B' = top-left cell of an 8x8 house): second pass so their cells are not reset by the '.' cells
  BUILDINGS=[];RAMPS=[];FLOORS=[];
  for(let z=0;z<MH-1;z++)for(let x=0;x<MW-1;x++) if(MAP[z][x]==='B') addBuilding(x,z);
  LADDERS=[];for(let z=0;z<MH;z++)for(let x=0;x<MW;x++) if(MAP[z][x]==='T') addTower(x,z);
  const ROOFS=[]; if(!(TEAMS[idx].theme&&TEAMS[idx].theme.key==='cft')) { const el=[]; for(let z=1;z<MH-1;z++)for(let x=1;x<MW-1;x++) if(MAP[z][x]==='C'&&MAP[z+1][x]==='.') el.push([x,z]); const pick=el.filter((_,i)=>i%2===0).slice(0,4); if(pick.length<2) for(const c of el){ if(pick.length>=2)break; if(!pick.includes(c))pick.push(c); } for(const [x,z] of pick) ROOFS.push(addRoof(x,z)); }
  // vegetação: células livres junto a casinhas, desviadas do meio da passagem; colisão só no tronco
  const TREES=[],tk=TEAMS[idx].theme&&TEAMS[idx].theme.key,SPEC={esp:['palm','cypress'],fra:['cypress','tree'],ale:['tree'],bra:['palm'],arg:['tree_purple','tree']}[tk]||(tk==='cft'?null:['tree']);
  if(SPEC){ const ladderCells=new Set(ROOFS.map(r=>Math.floor(r.lx/S)+','+Math.floor(r.lz/S)));
    for(let z=1;z<MH-1&&TREES.length<8;z++)for(let x=1;x<MW-1&&TREES.length<8;x++){ if(MAP[z][x]!=='.'||ladderCells.has(x+','+z)||(x*7+z*11)%5!==0)continue;
      const nb=[[1,0],[-1,0],[0,1],[0,-1]].find(d=>MAP[z+d[1]]&&MAP[z+d[1]][x+d[0]]==='C'); if(!nb)continue;
      const cx=(x+0.5)*S,cz=(z+0.5)*S,tx=cx+nb[0]*1.15+(nb[1]?1.1:0),tz=cz+nb[1]*1.15+(nb[0]?1.1:0),sp=SPEC[(x+z)%SPEC.length];
      TREES.push({x:tx,z:tz,sp,yaw:((x*13+z*7)%12)/12*Math.PI*2,sc:0.9+((x+z*3)%5)*0.06});
      BUILDINGS.push({x0:tx-0.25,x1:tx+0.25,z0:tz-0.25,z1:tz+0.25,cx:tx,cz:tz,extras:[{x0:tx-0.22,x1:tx+0.22,z0:tz-0.22,z1:tz+0.22,y0:0,y1:6}],tree:true}); } }
  Object.assign(G,{MAP,MW,MH,BOX,SPAWNS,START,LAMPS,SHOPS,flow,BUILDINGS,RAMPS,FLOORS,LADDERS,ROOFS,TREES});
}
let BUILDINGS=[],RAMPS=[],FLOORS=[],LADDERS=[];
export const TOWER={H:6.0,SIDE:3.6,DECK:4.0,LADDER_W:1.0,PARAPET:1.0};
/** 8x8 m house: ground room with two doors, stair along the north wall to an open roof deck with parapets.
 *  Walls/slabs are 3D boxes used by the player collision and by rayWorld; the whole footprint is solid for the enemy flow field. */
function addBuilding(x,z){
  const bx=x*S,bz=z*S,W=0.25,Hh=3.0,b={x0:bx,z0:bz,x1:bx+8,z1:bz+8,cx:bx+4,cz:bz+4,extras:[]};
  const add=o=>b.extras.push(o);
  add({x0:bx,x1:bx+8,z0:bz,z1:bz+W,y0:0,y1:Hh});                                             // north wall (stairs run along it)
  add({x0:bx+8-W,x1:bx+8,z0:bz,z1:bz+8,y0:0,y1:Hh});                                         // east wall
  add({x0:bx,x1:bx+2.9,z0:bz+8-W,z1:bz+8,y0:0,y1:Hh});add({x0:bx+5.1,x1:bx+8,z0:bz+8-W,z1:bz+8,y0:0,y1:Hh}); // south wall, door 2.9..5.1
  add({x0:bx,x1:bx+W,z0:bz,z1:bz+3.2,y0:0,y1:Hh});add({x0:bx,x1:bx+W,z0:bz+4.8,z1:bz+8,y0:0,y1:Hh});           // west wall, door 3.2..4.8
  add({x0:bx,x1:bx+8,z0:bz+1.6,z1:bz+8,y0:Hh,y1:3.25,slab:true});add({x0:bx+5.2,x1:bx+8,z0:bz,z1:bz+1.6,y0:Hh,y1:3.25,slab:true});add({x0:bx,x1:bx+0.5,z0:bz,z1:bz+1.6,y0:Hh,y1:3.25,slab:true}); // roof slab around the stairwell
  add({x0:bx,x1:bx+8,z0:bz,z1:bz+W,y0:3.25,y1:4.35});add({x0:bx,x1:bx+8,z0:bz+8-W,z1:bz+8,y0:3.25,y1:4.35});add({x0:bx,x1:bx+W,z0:bz,z1:bz+8,y0:3.25,y1:4.35});add({x0:bx+8-W,x1:bx+8,z0:bz,z1:bz+8,y0:3.25,y1:4.35}); // parapets
  add({x0:bx+0.45,x1:bx+5.1,z0:bz+1.56,z1:bz+1.66,y0:3.25,y1:4.3}); // guarda à volta da abertura da escada (no terraço)
  add({x0:bx+2.0,x1:bx+5.2,z0:bz+1.58,z1:bz+1.68,y0:0,y1:4.3}); // lado da escada fechado a partir do 4.º degrau (entra-se pelos primeiros, do lado da sala)
  const ramp={x0:bx+0.5,x1:bx+5.2,z0:bz+0.25,z1:bz+1.6,h0:0,h1:3.25};RAMPS.push(ramp);b.ramp=ramp;
  FLOORS.push({x0:bx,x1:bx+8,z0:bz,z1:bz+8,y:3.25,hole:ramp});
  for(let dz=0;dz<2;dz++)for(let dx=0;dx<2;dx++) BOX[(x+dx)+(z+dz)*MW]={x0:bx+dx*S,x1:bx+dx*S+S,z0:bz+dz*S,z1:bz+dz*S+S,h:4.35,los:true,building:b};
  // waypoints for enemy navigation inside the house (doors -> room -> stairs -> deck)
  b.wp={doorS_out:{x:bx+4,z:bz+9.3},doorS_in:{x:bx+4,z:bz+6.6},doorW_out:{x:bx-1.3,z:bz+4},doorW_in:{x:bx+1.4,z:bz+4},room:{x:bx+5.2,z:bz+4.6},stairBottom:{x:bx+0.95,z:bz+0.92},stairTop:{x:bx+5.7,z:bz+0.92},deck:{x:bx+4.2,z:bz+4.8}};
  BUILDINGS.push(b);
}
/** 3.6x3.6 m watchtower, 6 m high, ladder on the south (+z) face up to a 4x4 deck with parapets */
function addTower(x,z){
  const cx=x*S+2,cz=z*S+2,hs=TOWER.SIDE/2,hd=TOWER.DECK/2,H=TOWER.H,b={x0:cx-hd,z0:cz-hd,x1:cx+hd,z1:cz+hd,cx,cz,extras:[],tower:true};
  const add=o=>b.extras.push(o);
  add({x0:cx-hs,x1:cx+hs,z0:cz-hs,z1:cz+hs,y0:0,y1:H});                       // body
  add({x0:cx-hd,x1:cx+hd,z0:cz-hd,z1:cz+hd,y0:H,y1:H+0.25,slab:true});         // deck slab
  const W=0.2,py0=H+0.25,py1=H+0.25+TOWER.PARAPET,lw=TOWER.LADDER_W/2;
  add({x0:cx-hd,x1:cx+hd,z0:cz-hd,z1:cz-hd+W,y0:py0,y1:py1});add({x0:cx-hd,x1:cx-hd+W,z0:cz-hd,z1:cz+hd,y0:py0,y1:py1});add({x0:cx+hd-W,x1:cx+hd,z0:cz-hd,z1:cz+hd,y0:py0,y1:py1});
  add({x0:cx-hd,x1:cx-lw,z0:cz+hd-W,z1:cz+hd,y0:py0,y1:py1});add({x0:cx+lw,x1:cx+hd,z0:cz+hd-W,z1:cz+hd,y0:py0,y1:py1}); // south parapet with the ladder gap
  FLOORS.push({x0:cx-hd,x1:cx+hd,z0:cz-hd,z1:cz+hd,y:H+0.25});
  LADDERS.push({x0:cx-lw,x1:cx+lw,z0:cz+hs,z1:cz+hs+0.9,top:H+0.25,cx,cz,exitZ:cz+hd-0.7});
  BOX[x+z*MW]={x0:x*S+0.2,x1:x*S+S-0.2,z0:z*S+0.2,z1:z*S+S-0.2,h:H+1.25,los:true,building:b};
  BUILDINGS.push(b);
}
/** casinha com acesso ao telhado: corpo sólido até 3,15 m, terraço com platibanda (abertura a sul) e escada de mão na face sul */
function addRoof(x,z){
  const bx=x*S,bz=z*S,top=3.15,lx=bx+S/2+0.9,b={x0:bx,z0:bz,x1:bx+S,z1:bz+S,cx:bx+S/2,cz:bz+S/2,extras:[],tower:true,roof:true};
  const add=o=>b.extras.push(o),W=0.15;
  add({x0:bx+0.05,x1:bx+S-0.05,z0:bz+0.05,z1:bz+S-0.05,y0:0,y1:top});
  add({x0:bx,x1:bx+S,z0:bz,z1:bz+W,y0:top,y1:top+0.45});add({x0:bx,x1:bx+W,z0:bz,z1:bz+S,y0:top,y1:top+0.45});add({x0:bx+S-W,x1:bx+S,z0:bz,z1:bz+S,y0:top,y1:top+0.45});
  add({x0:bx,x1:lx-0.45,z0:bz+S-W,z1:bz+S,y0:top,y1:top+0.45});add({x0:lx+0.45,x1:bx+S,z0:bz+S-W,z1:bz+S,y0:top,y1:top+0.45});
  FLOORS.push({x0:bx+0.2,x1:bx+S-0.2,z0:bz+0.2,z1:bz+S-0.2,y:top});
  LADDERS.push({x0:lx-0.4,x1:lx+0.4,z0:bz+S,z1:bz+S+0.9,top,cx:lx,cz:bz+S/2,exitZ:bz+S-0.7});
  BOX[x+z*MW]={x0:bx,x1:bx+S,z0:bz,z1:bz+S,h:top+0.45,los:true,building:b};
  BUILDINGS.push(b); return {x,z,lx,lz:bz+S,top};
}
/** ladder volume containing (x,z) at height y (null if none) */
/** the house whose footprint contains (x,z), or null */
export function buildingAt(x,z){ for(const b of BUILDINGS){ if(!b.tower&&!b.tree&&b.wp&&x>=b.x0&&x<=b.x1&&z>=b.z0&&z<=b.z1) return b; } return null; }
export function ladderAt(x,z,y){ for(const l of LADDERS){ if(x>=l.x0&&x<=l.x1&&z>=l.z0&&z<=l.z1&&y>=-0.1&&y<=l.top+0.1) return l; } return null; }
const rampH=(r,x)=>r.h0+(r.h1-r.h0)*Math.max(0,Math.min(1,(x-r.x0)/(r.x1-r.x0)));
/** height of the surface under (x,z) that a body at height y can stand on (ground, stairs, roof decks) */
export function groundAt(x,z,y){
  let g=0;
  for(const r of RAMPS){ if(x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1){ const h=rampH(r,x); if(y>=h-0.6) g=Math.max(g,h); } }
  for(const f of FLOORS){ if(x>=f.x0&&x<=f.x1&&z>=f.z0&&z<=f.z1){ const hole=f.hole&&x>=f.hole.x0&&x<=f.hole.x1&&z>=f.hole.z0&&z<=f.hole.z1; if(!hole&&y>=f.y-0.6) g=Math.max(g,f.y); } }
  // em cima de quase tudo: o topo de caixotes, barris, carros, cabines, casinhas… é chão (postes finos não)
  const B=boxAt(Math.floor(x/S),Math.floor(z/S)); if(B&&B!==FULL&&!B.building&&(B.x1-B.x0)>=0.8&&(B.z1-B.z0)>=0.8){ const tp=B.top!=null?B.top:B.h; if(x>=B.x0-0.05&&x<=B.x1+0.05&&z>=B.z0-0.05&&z<=B.z1+0.05&&y>=tp-0.45) g=Math.max(g,tp); }
  return g;
}
export function computeFlow(px,pz){
  flow.fill(-1);const q=[px+pz*MW];flow[q[0]]=0;let head=0;
  while(head<q.length){
    const i=q[head++],cx=i%MW,cz=(i/MW)|0,d=flow[i];
    for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
      if(!dx&&!dz)continue;const nx=cx+dx,nz=cz+dz;
      if(nx<0||nz<0||nx>=MW||nz>=MH||BOX[nx+nz*MW])continue;
      if(dx&&dz&&(BOX[cx+dx+cz*MW]||BOX[cx+(cz+dz)*MW]))continue;
      const j=nx+nz*MW;if(flow[j]!==-1)continue;flow[j]=d+1;q.push(j);
    }
  }
}
function pushOut(p,B,r){
  const qx=clamp(p.x,B.x0,B.x1),qz=clamp(p.z,B.z0,B.z1),ddx=p.x-qx,ddz=p.z-qz,d=Math.hypot(ddx,ddz);
  if(d<r){
    if(d<1e-4){const l=p.x-B.x0,rr=B.x1-p.x,t=p.z-B.z0,b=B.z1-p.z,m=Math.min(l,rr,t,b);if(m===l)p.x=B.x0-r;else if(m===rr)p.x=B.x1+r;else if(m===t)p.z=B.z0-r;else p.z=B.z1+r;}
    else{const push=r-d;p.x+=ddx/d*push;p.z+=ddz/d*push;}
  }
}
export function collideCircle(p,r,py=0,enemy=false){
  const cx=Math.floor(p.x/S),cz=Math.floor(p.z/S);
  const feet=py+0.25,head=py+1.6;
  for(const b of BUILDINGS){ if(p.x<b.x0-2||p.x>b.x1+2||p.z<b.z0-2||p.z>b.z1+2) continue; if(enemy){ pushOut(p,{x0:b.x0,x1:b.x1,z0:b.z0,z1:b.z1},r); continue; }
    for(const w of b.extras){ if(w.slab||w.y1<=feet||w.y0>=head) continue; pushOut(p,w,r); }
    if(py<2.6&&b.ramp){ const rp=b.ramp; if(!(p.x>=rp.x0-0.1&&p.x<=rp.x1+0.1&&p.z>=rp.z0&&p.z<=rp.z1)&&rampH(rp,p.x)>py+0.9) pushOut(p,{x0:rp.x0,x1:rp.x1,z0:rp.z0,z1:rp.z1},r); } // do not walk into the side of the stairs
  }
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
    const B=boxAt(cx+dx,cz+dz);if(!B||B===FULL||B.building)continue;
    if(!enemy&&(B.x1-B.x0)>=0.8&&(B.z1-B.z0)>=0.8&&py>=(B.top!=null?B.top:B.h)-0.3)continue; // o jogador está por cima: não empurra
    const qx=clamp(p.x,B.x0,B.x1),qz=clamp(p.z,B.z0,B.z1),ddx=p.x-qx,ddz=p.z-qz,d=Math.hypot(ddx,ddz);
    if(d<r){
      if(d<1e-4){const l=p.x-B.x0,rr=B.x1-p.x,t=p.z-B.z0,b=B.z1-p.z,m=Math.min(l,rr,t,b);if(m===l)p.x=B.x0-r;else if(m===rr)p.x=B.x1+r;else if(m===t)p.z=B.z0-r;else p.z=B.z1+r;}
      else{const push=r-d;p.x+=ddx/d*push;p.z+=ddz/d*push;}
    }
  }
  p.x=clamp(p.x,S+r,(MW-1)*S-r);p.z=clamp(p.z,S+r,(MH-1)*S-r);
}
export function los(x0,z0,x1,z1,y0=1.5,y1=1.5){const high=Math.max(y0,y1)>2.9;const dx=x1-x0,dz=z1-z0,n=Math.ceil(Math.hypot(dx,dz)/0.4);for(let i=1;i<n;i++){const x=x0+dx*i/n,z=z0+dz*i/n,B=boxAt(Math.floor(x/S),Math.floor(z/S));if(B&&B.los&&x>=B.x0&&x<=B.x1&&z>=B.z0&&z<=B.z1){ if(B.building&&high) continue; return false; }}return true;}
export const HIT={nx:0,ny:1,nz:0,mat:'grass'};
const CELL_MAT={'#':'concrete',C:'metal',K:'wood',c:'wood',J:'concrete',S:'sand',b:'metal',w:'plastic',H:'wood',T:'metal',D:'plastic',G:'metal',L:'metal',V:'metal',M:'metal',B:'concrete'};
export function rayWorld(o,d,maxT,out){
  const st=0.2;let x=o.x,y=o.y,z=o.z,px,py,pz;
  for(let t=st;t<=maxT+1e-6;t+=st){
    px=x;py=y;pz=z;x+=d.x*st;y+=d.y*st;z+=d.z*st;
    if(y<=0){if(out){out.nx=0;out.ny=1;out.nz=0;out.mat='grass';}return t;}
    const B=boxAt(Math.floor(x/S),Math.floor(z/S));
    if(B&&B.building){ const b=B.building; let hit=null; for(const w of b.extras){ if(x>=w.x0&&x<=w.x1&&z>=w.z0&&z<=w.z1&&y>=w.y0&&y<=w.y1){ hit=w; break; } }
      if(!hit&&b.ramp){ const rp=b.ramp; if(x>=rp.x0&&x<=rp.x1&&z>=rp.z0&&z<=rp.z1&&y<=rampH(rp,x)) hit=rp; }
      if(hit){ if(out){ out.mat=hit.slab?'concrete':(hit===b.ramp?'wood':(b.tower?'metal':'concrete')); if(hit.y0!==undefined&&py>=hit.y1){out.nx=0;out.ny=1;out.nz=0;} else if(hit.y0!==undefined&&py<=hit.y0){out.nx=0;out.ny=-1;out.nz=0;} else if(px<hit.x0){out.nx=-1;out.ny=0;out.nz=0;} else if(px>hit.x1){out.nx=1;out.ny=0;out.nz=0;} else if(pz<hit.z0){out.nx=0;out.ny=0;out.nz=-1;} else {out.nx=0;out.ny=0;out.nz=1;} } return t; }
      continue; }
    if(B&&x>=B.x0&&x<=B.x1&&z>=B.z0&&z<=B.z1&&y<B.h){
      if(out){const ch=MAP[Math.floor(z/S)]?MAP[Math.floor(z/S)][Math.floor(x/S)]:'#';out.mat=CELL_MAT[ch]||'concrete';}
      if(out){if(py>=B.h){out.nx=0;out.ny=1;out.nz=0;}else if(px<B.x0){out.nx=-1;out.ny=0;out.nz=0;}else if(px>B.x1){out.nx=1;out.ny=0;out.nz=0;}else if(pz<B.z0){out.nx=0;out.ny=0;out.nz=-1;}else{out.nx=0;out.ny=0;out.nz=1;}}
      return t;
    }
  }
  return maxT;
}
export const inArena=(x,z)=>x>0.2&&z>0.2&&x<MW*S-0.2&&z<MH*S-0.2;
export function rayEnemies(o,d,maxT,enemies){
  let best=null;
  for(const e of enemies){
    if(e.model&&e.model.hitTest){ if(e.state==='dead'||e.state==='warm')continue; const h=e.model.hitTest(o,d,maxT); if(h&&(!best||h.t<best.t))best={e:e,t:h.t,head:h.head}; continue; }
    if(e.state==='dead'||e.state==='warm')continue;
    const r=0.46*e.scale,h=2.16*e.scale,ox=o.x-e.x,oz=o.z-e.z,a=d.x*d.x+d.z*d.z;if(a<1e-6)continue;
    const b=2*(ox*d.x+oz*d.z),c=ox*ox+oz*oz-r*r,disc=b*b-4*a*c;if(disc<0)continue;
    const sq=Math.sqrt(disc);let t=(-b-sq)/(2*a);if(t<0)t=(-b+sq)/(2*a);if(t<0||t>maxT)continue;
    const y=o.y+d.y*t;if(y<0||y>h)continue;
    if(!best||t<best.t)best={e:e,t:t,head:y>h*0.79};
  }
  return best;
}

