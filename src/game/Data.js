// Auto-extracted from the single-file version (v4b) — data tables and grid logic.
export /* mapas próprios dos jogos extra (gerados em /tmp/maps/gen.py, simétricos, todas as zonas alcançáveis): praça (ITA), ruas de Londres (ENG), canais (NED), porto (URU), jardim-labirinto (JPN) */
const LAY_ITA=['##############################','#s.......b..........b......s.#','#........B.........CC.CC.....#','#..CT....................T...#','#.............L..............#','#.......ww.ww....ww.ww.......#','#....M..................V....#','#.......c...b.K.b...c........#','#s.....c.............c......s#','#G...S........P........S....G#','#G...S.................S....G#','#s.....c.............c......s#','#.......c...b.K.b...c........#','#....M..................V....#','#.......ww.ww....ww.ww.......#','#.............L..............#','#..CT....B...............T...#','#..................CC.CC.....#','#s.......b..........b......s.#','##############################'];
const LAY_ENG=['##############################','#s.......b..........b......s.#','#.T.......................T..#','#....CCC.CCC.....CCC.CCC.....#','#.......b...........b.....M..#','#.L...........c..............#','#........CC.CC..CC.CC........#','#.....V.....B.........V......#','#s.....c.............c......s#','#G...S........P........S....G#','#G...S.................S....G#','#s.....c....B........c......s#','#.....V...............V......#','#........CC.CC..CC.CC........#','#.L...........c..............#','#.......b...........b.....M..#','#....CCC.CCC.....CCC.CCC.....#','#.T.......................T..#','#s.......b..........b......s.#','##############################'];
const LAY_NED=['##############################','#s.......b..........b......s.#','#.....T.......CC......T......#','#............................#','#..JJJJJ.JJJJJ.JJJJJ.JJJJJJ..#','#.L.........B.............M..#','#............................#','#....SSSSS.SSSSSSS.SSSSSS....#','#s.....c.c.........c.c......s#','#G...S........P........S....G#','#G...S.................S....G#','#s.....c.c.........c.c......s#','#....SSSSS.SSSSSSS.SSSSSS....#','#...........B................#','#.L.......................M..#','#..JJJJJ.JJJJJ.JJJJJ.JJJJJJ..#','#............................#','#.....T.......CC......T......#','#s.......b..........b......s.#','##############################'];
const LAY_URU=['##############################','#s.......b..........b......s.#','#...CCC....CCC..CCC....CCC...#','#...KKK....KKK..KKK....KKK...#','#...................L........#','#..T........b....b........T..#','#......CCC..........CCC......#','#..........B............M....#','#s....Kc.............cK.....s#','#G...S........P........S....G#','#G...S.................S....G#','#s....Kc...B.........cK.....s#','#.......................M....#','#......CCC..........CCC......#','#..T........b....b........T..#','#...................L........#','#...KKK....KKK..KKK....KKK...#','#...CCC....CCC..CCC....CCC...#','#s.......b..........b......s.#','##############################'];
const LAY_JPN=['##############################','#s.......b...B......b......s.#','#.....w.........c......w.....#','#.....w...T........T...w.....#','#.....w.......L........w.....#','#..www....w........w....www..#','#..C......w........w......C..#','#.........w.ww..ww.w.........#','#s....Mc.............c......s#','#G...S........P........S....G#','#G...S.................S....G#','#s....Mc.............c......s#','#.........w.ww..ww.w.........#','#..C......w........w......C..#','#..www....w........w....www..#','#.....w.......L........w.....#','#.....w...T........T...w.....#','#.....w......B..c......w.....#','#s.......b..........b......s.#','##############################'];
const LAY_A=[
"##############################",
"#s.......b.DD.b....DD......s.#",
"#....c...............c.......#",
"#..w.....SB........S.....w...#",
"#..w..........L..........w...#",
"#.c.....C..JJ.w.JJ..C......c.#",
"#...bT..C...........C..Tb....#",
"#...M...K.....S.....K........#",
"#s.....c.............c......s#",
"#G...Sc.......P.......cS....G#",
"#G...Sc................Sc...G#",
"#s.....c.............c......s#",
"#.......K.....S.....K....M...#",
"#...bT..C...........C..Tb....#",
"#.c.....C..JJ.w.JJ..C......c.#",
"#..w..........L..........w...#",
"#..w.....S......B..S.....w...#",
"#....c...............c.......#",
"#s.......b.DD.b....DD......s.#",
"##############################"
];
const LAY_B=[
"##############################",
"#s...L...b....b.....b...L...s#",
"#....CCB.....HH......CC......#",
"#....CC......HH......CC......#",
"#...M..K...w......w...K..M...#",
"#.c.c.....w..S.S..w.....c..c.#",
"#........b..........b........#",
"#.T.....................T....#",
"#s...JJc...S.....S...cJJ....s#",
"#G.....c......P......c......G#",
"#G.....c.............c......G#",
"#s...JJc...S.....S...cJJ....s#",
"#.T.....................T....#",
"#........b..........b........#",
"#.c.c.....w..S.S..w.....c..c.#",
"#..........w....B.w..........#",
"#....CC......HH......CC......#",
"#....CC......HH......CC......#",
"#s...L...b....b.....b...L...s#",
"##############################"
];
const LAY_C=[
"##############################",
"#s.....w.b....b...w.b.......s#",
"#..V...w....DD....w....V.....#",
"#......w..........w..........#",
"#..S.......c....c.......S....#",
"#.T...L..K....C....K..L....T.#",
"#............CCC.............#",
"#...b.......M.......JJJ......#",
"#s.....c....S...S....cB.....s#",
"#G...S.w......P......w.S....G#",
"#G...S.w.............w.S....G#",
"#s.....c....S...S....c......s#",
"#......JJJ.......M........b..#",
"#............CCC.............#",
"#.T...L..K....C....K..L....T.#",
"#..S.......c....c.......S....#",
"#......w..........w..........#",
"#..V...w....DD....w....V.....#",
"#s.....w.b....b...w.b.......s#",
"##############################"
];
const LAY_D=[
"##############################",
"#s..T....b....b.....b..T....s#",
"#............HH..............#",
"#....c.......HH.......c......#",
"#..w.....S..........S.B..w...#",
"#.cw...L....w..w....L....w.c.#",
"#......b....w..w....b........#",
"#....C...M....JJ....C........#",
"#s...C.c..K.......K.Cc......s#",
"#G...S........P........S....G#",
"#G...S.................S....G#",
"#s...C.c..K.......K.Cc......s#",
"#....C........JJ....C...M....#",
"#......b....w..w....b........#",
"#.cw.B.L....w..w....L....w.c.#",
"#..w.....S..........S....w...#",
"#....c.......HH.......c......#",
"#............HH..............#",
"#s..T....b....b.....b..T....s#",
"##############################"
];
const LAY_E=[
"##############################",
"#s..L....b....b.....b.....L.s#",
"#...CC.......HH.......CC.....#",
"#...CC.......HH.......CC.....#",
"#...M...S....KK.....S...M....#",
"#.cT......w.....w......T...c.#",
"#.....c...w..b..w...c..B.....#",
"#............www.............#",
"#s.....c....S...S....c......s#",
"#G...S.C......P......C.S....G#",
"#G...S.C.............C.S....G#",
"#s.....c....S...S....c......s#",
"#...B........www.............#",
"#.....c...w..b..w...c........#",
"#.cT......w.....w......T...c.#",
"#.......S....KK.....S........#",
"#...CC.......HH.......CC.....#",
"#...CC.......HH.......CC.....#",
"#s..L....b....b.....b.....L.s#",
"##############################"
];
export const TEAMS=[
{key:'esp',nome:'Espanha',estadio:'Arena do Sol',tier:1,traits:{},map:{lat:40,lon:-4},shirt:0xd8202a,shorts:0x1c2f6b,socks:0x1c2f6b,trim:0xf2c94c,numCol:0xf2c94c,gk:{shirt:0x2fb34a,shorts:0x121212,socks:0x121212},crowd:[0xd8202a,0xf2c94c,0xffffff,0xd8202a],boss:'El Toro',desc:'Jogo 1 de 5 · Tarde de sol na Arena do Sol. Bancadas vermelhas e douradas, bancos de suplentes e contentores para te abrigares.',layout:LAY_A,
 theme:{key:'esp',hdri:'sky_day',sky:['#3f79c2','#b9d1ea','#a8b8c4','#4a5a66'],sunDir:[0.35,0.85,0.4],sunCol:0xfff2dc,sunInt:2.2,hemi:[0xbcd6f4,0x3f5a2f,0.85],amb:0.1,fog:[0xb8cde0,70,330],exp:1.0,clouds:true,sunDisc:true,night:false,stars:false,flood:0.1,weather:null}},
{key:'fra',nome:'França',estadio:'Arena Azul',tier:2,traits:{roles:{medio:1.6},acc:1.05},map:{lat:47,lon:2},shirt:0x1e3a8a,shorts:0xffffff,socks:0xd8202a,trim:0xffffff,numCol:0xffffff,gk:{shirt:0x9a9a9a,shorts:0x111111,socks:0x111111},crowd:[0x1e3a8a,0xffffff,0xd8202a,0x1e3a8a],boss:'Le Coq',desc:'Jogo 2 de 5 · Crepúsculo na Arena Azul, com os projetores a acender. Torres de TV e cabines no relvado.',layout:LAY_B,
 theme:{key:'fra',hdri:'sky_dusk',sky:['#1d2350','#f08a5a','#c8785a','#2a2a30'],sunDir:[0.8,0.28,-0.5],sunCol:0xffa06a,sunInt:1.6,hemi:[0x5a5aa8,0x30281e,0.8],amb:0.12,fog:[0xd08a6a,70,330],exp:1.1,clouds:true,sunDisc:true,night:false,stars:false,flood:1.2,weather:null}},
{key:'ale',nome:'Alemanha',estadio:'Arena do Norte',tier:3,traits:{hp:1.12,roles:{escudo:2.2,guarda:1.5}},map:{lat:50.4,lon:12.2},shirt:0xf4f4f4,shorts:0x111111,socks:0xf4f4f4,trim:0x111111,numCol:0x111111,gk:{shirt:0xf2c400,shorts:0x111111,socks:0xf2c400},crowd:[0x111111,0xd8202a,0xf2c94c,0xffffff],boss:'Der Adler',desc:'Jogo 3 de 5 · Chuva e céu cinzento na Arena do Norte. Carrinhos médicos e placas de publicidade como cobertura.',layout:LAY_C,
 theme:{key:'ale',hdri:'sky_overcast',sky:['#5a6472','#9aa4ae','#8a929a','#3a3f45'],sunDir:[0.2,0.9,0.3],sunCol:0xdde4ee,sunInt:1.25,hemi:[0x9aa6b4,0x3a4a2f,0.95],amb:0.12,fog:[0x8f9aa4,50,250],exp:1.05,clouds:false,sunDisc:false,night:false,stars:false,flood:0.9,weather:'rain'}},
{key:'bra',nome:'Brasil',estadio:'Arena Tropical',tier:4,traits:{speed:1.12,roles:{ponta:2.2}},map:{lat:-15,lon:-50},shirt:0xf2c400,shorts:0x1746a2,socks:0xffffff,trim:0x1c8a3c,numCol:0x1c8a3c,gk:{shirt:0x8a8a8a,shorts:0x111111,socks:0x8a8a8a},crowd:[0xf2c400,0x1c8a3c,0x1746a2,0xf2c400],boss:'O Jaguar',desc:'Jogo 4 de 5 · Fim de tarde dourado na Arena Tropical. A seleção canarinha e o seu capitão, O Jaguar.',layout:LAY_D,
 theme:{key:'bra',hdri:'sky_golden',sky:['#2f4f8a','#ffb070','#e09050','#3a2a20'],sunDir:[-0.85,0.32,0.35],sunCol:0xffc080,sunInt:1.9,hemi:[0x7a70b0,0x4a3a24,0.72],amb:0.1,fog:[0xe0a070,70,330],exp:1.12,clouds:true,sunDisc:true,night:false,stars:false,flood:0.2,weather:null}},
{key:'arg',nome:'Argentina',estadio:'Arena da Prata',tier:5,traits:{acc:1.15,hp:1.08,roles:{atirador:2.5,medio:1.3}},map:{lat:-34,lon:-64},shirt:0x7fc4ec,shorts:0x111111,socks:0xffffff,trim:0xffffff,numCol:0x111111,stripes:0xffffff,gk:{shirt:0x2a2a2a,shorts:0x2a2a2a,socks:0x2a2a2a},crowd:[0x7fc4ec,0xffffff,0x7fc4ec,0xffffff],boss:'El Cóndor',desc:'Jogo 5 de 5 · A final, de noite, na Arena da Prata. A albiceleste e o seu capitão, El Cóndor. Depois: prolongamento infinito.',layout:LAY_E,
 theme:{key:'arg',hdri:'sky_night',sky:['#02040a','#0e1a33','#0a1020','#04060a'],sunDir:[0.25,0.92,0.2],sunCol:0xf0f4ff,sunInt:1.8,hemi:[0x3a4a6a,0x101418,0.6],amb:0.08,fog:[0x0d1424,50,270],exp:1.3,clouds:false,sunDisc:false,night:true,stars:true,flood:2.0,weather:null}}
];
export const DIFF={recruta:{label:'Recruta',hp:0.75,dmg:0.7,acc:0.8,score:0.8},regular:{label:'Regular',hp:1,dmg:1,acc:1,score:1},veterano:{label:'Veterano',hp:1.3,dmg:1.35,acc:1.15,score:1.35}};
const SENS=[{label:'Baixa',v:0.7},{label:'Normal',v:1},{label:'Alta',v:1.4}];
export const WEAPONS={
  ar:{nome:'KA-47',mag:30,reserve:180,dmg:27,rate:0.1,spread:0.014,reload:1.9,range:95,auto:true,kick:0.012,adsFov:52,lvl:1,tracer:3,falloff:[28,60,0.6],headMul:1.8,adsTime:0.22,sprintOut:0.22,pattern:[[1.0,0],[1.1,0.15],[1.2,-0.25],[1.15,0.35],[1.2,-0.4],[1.1,0.45],[1.0,-0.3],[1.05,0.5],[1.1,-0.55],[1.0,0.4]]},
  smg:{nome:'MP-9',mag:32,reserve:224,dmg:18,rate:0.065,spread:0.021,reload:1.6,range:45,auto:true,kick:0.008,adsFov:58,lvl:3,tracer:4,falloff:[16,36,0.5],headMul:1.6,adsTime:0.16,sprintOut:0.16,pattern:[[0.7,0.2],[0.8,-0.3],[0.85,0.4],[0.9,-0.45],[0.8,0.5],[0.85,-0.5]]},
  shotgun:{nome:'M870',mag:7,reserve:42,dmg:16,pellets:8,rate:0.8,spread:0.06,reload:2.4,range:26,auto:false,kick:0.05,adsFov:60,lvl:2,tracer:0,falloff:[6,12,0.12],headMul:1.5,adsTime:0.26,sprintOut:0.3,pattern:[[3.2,0.6],[3.4,-0.8]]},
  sniper:{nome:'R700',mag:5,reserve:30,dmg:140,rate:1.2,spread:0.002,reload:2.9,range:250,auto:false,kick:0.06,adsFov:18,lvl:4,tracer:1,scope:true,falloff:[80,200,0.85],headMul:3.0,adsTime:0.34,sprintOut:0.4,pattern:[[4.5,0.8],[4.8,-1.0]]},
  lmg:{nome:'M249 Fúria',mag:100,reserve:200,dmg:24,rate:0.085,spread:0.03,reload:4.2,range:90,auto:true,kick:0.015,adsFov:55,lvl:6,tracer:2,falloff:[30,70,0.65],headMul:1.6,adsTime:0.32,sprintOut:0.38,pattern:[[1.2,0.3],[1.3,-0.35],[1.4,0.5],[1.3,-0.6],[1.5,0.6],[1.4,-0.7],[1.3,0.65]]},
  gl:{nome:'M32 Estrondo',mag:6,reserve:24,dmg:150,rate:0.75,spread:0.008,reload:2.9,range:140,auto:false,kick:0.05,adsFov:56,lvl:5,tracer:0,projectile:'gl',speed:30,blast:5.5,ammoTag:'heavy',falloff:[200,300,1],headMul:1,adsTime:0.3,sprintOut:0.3,pattern:[[2.5,0.5]]},
  rpg:{nome:'RPG-7',mag:1,reserve:6,dmg:300,rate:1.0,spread:0.003,reload:3.4,range:220,auto:false,kick:0.1,adsFov:50,lvl:7,tracer:0,projectile:'rpg',speed:44,blast:7.5,ammoTag:'heavy',falloff:[300,400,1],headMul:1,adsTime:0.36,sprintOut:0.45,pattern:[[3.0,0.8]]},
  pistol:{nome:'P2020',mag:15,reserve:Infinity,dmg:25,rate:0.14,spread:0.016,reload:1.3,range:60,auto:false,kick:0.02,adsFov:60,lvl:1,tracer:0,falloff:[18,40,0.55],headMul:2.0,adsTime:0.14,sprintOut:0.12,pattern:[[1.4,0.2],[1.5,-0.3],[1.6,0.35]]}
};
export const ORDER=['ar','smg','shotgun','sniper','lmg','gl','rpg','pistol'];
/* ---- várias armas por categoria: variantes com o modelo 3D do tipo-base, pintura e números próprios ---- */
export const WCAT={pistol:'Pistolas',smg:'Submetralhadoras',ar:'Espingardas de assalto',lmg:'Metralhadoras',shotgun:'Caçadeiras',sniper:'Snipers',gl:'Explosivos',rpg:'Explosivos'};
const VARIANTS={
  pistol_mag:{base:'pistol',nome:'Magnum .357',dmg:52,rate:0.45,mag:6,reserve:42,reload:2.3,spread:0.006,kick:0.03,headMul:2.2,tint:{gun_polymer:0x2f2f33,gun_metal:0xb8bcc2},price:1200,stage:2},
  pistol_auto:{base:'pistol',nome:'G18 Rajada',dmg:16,rate:0.07,auto:true,mag:20,reserve:140,reload:1.6,spread:0.022,tint:{gun_polymer:0x3a4a2e},price:1400,stage:3},
  smg_vespa:{base:'smg',nome:'Vetor V9',dmg:14,rate:0.048,mag:40,reserve:240,reload:1.9,spread:0.025,tint:{gun_polymer:0x2a2e36,gun_metal:0xd8a92a},price:2400,stage:3},
  smg_45:{base:'smg',nome:'UMP Tribuno',dmg:27,rate:0.095,mag:25,reserve:175,reload:2.1,spread:0.016,kick:0.016,tint:{gun_polymer:0x5a4632},price:2800,stage:4},
  ar_tac:{base:'ar',nome:'M4 Falcão',dmg:33,rate:0.13,mag:25,reserve:175,reload:2.1,spread:0.008,kick:0.009,range:120,tint:{gun_wood:0x2a2b30,gun_metal:0x505a64},price:2200,stage:2},
  ar_choque:{base:'ar',nome:'SCR Martelo',dmg:41,rate:0.16,mag:20,reserve:140,reload:2.4,spread:0.012,kick:0.02,tint:{gun_wood:0x5a3a22,gun_metal:0x3a4652},price:3400,stage:4},
  lmg_light:{base:'lmg',nome:'RPK Ligeira',dmg:20,rate:0.072,mag:75,reserve:300,reload:3.3,spread:0.03,tint:{gun_tan:0x5a6a44},price:3600,stage:4},
  lmg_heavy:{base:'lmg',nome:'M60 Titã',dmg:34,rate:0.12,mag:100,reserve:300,reload:4.8,spread:0.036,kick:0.022,tint:{gun_tan:0x33343a,gun_metal:0x26282c},price:5800,stage:5},
  shotgun_db:{base:'shotgun',nome:'Serra 12',dmg:19,pellets:10,rate:0.22,mag:2,reserve:40,reload:1.8,spread:0.085,range:12,falloff:[4,9,0.08],tint:{gun_wood:0x8a5a2a,gun_metal:0x707478},price:1300,stage:2},
  shotgun_auto:{base:'shotgun',nome:'M4 Bunker',dmg:13,pellets:8,rate:0.3,mag:8,reserve:56,reload:2.6,spread:0.055,falloff:[7,14,0.15],range:20,tint:{gun_wood:0x2a2a2c},price:2200,stage:3},
  sniper_semi:{base:'sniper',nome:'MK14 Marco',dmg:88,rate:0.45,mag:10,reserve:50,reload:2.9,tint:{gun_wood:0x34363a},price:4000,stage:4},
  sniper_50:{base:'sniper',nome:'Barrett .50',dmg:270,rate:1.6,mag:5,reserve:25,reload:3.9,kick:0.12,tint:{gun_wood:0x6a6a58,gun_metal:0x2a2b2f},price:6000,stage:5}
};
for(const [k,v] of Object.entries(VARIANTS)){ WEAPONS[k]=Object.assign({},WEAPONS[v.base],v); }
for(const k of ['pistol','smg','ar','lmg','shotgun','sniper','gl','rpg'])WEAPONS[k].base=WEAPONS[k].base||undefined;
ORDER.length=0; ORDER.push('ar','ar_tac','ar_choque','smg','smg_vespa','smg_45','shotgun','shotgun_db','shotgun_auto','lmg','lmg_light','lmg_heavy','sniper','sniper_semi','sniper_50','gl','rpg','pistol','pistol_mag','pistol_auto');
export const HIP={x:0.25,y:-0.27,z:-0.6};
export const ADSP={ar:{x:0,y:-0.19,z:-0.5},smg:{x:0,y:-0.18,z:-0.46},shotgun:{x:0,y:-0.2,z:-0.5},sniper:{x:0,y:-0.15,z:-0.55},lmg:{x:0,y:-0.2,z:-0.52},pistol:{x:0,y:-0.17,z:-0.42}};
export const ROLES={
  defesa:{nome:'Defesa',hp:95,speed:3.5,dmg:6,interval:0.9,range:24,acc:0.32,score:100,scale:1},
  medio:{nome:'Médio',hp:170,speed:3.8,dmg:8,interval:0.55,range:28,acc:0.42,score:150,scale:1,gren:true},
  guarda:{nome:'Guarda-redes',hp:360,speed:2.8,dmg:12,interval:0.42,range:20,acc:0.4,score:300,scale:1.16,gk:true,gren:true},
  ponta:{nome:'Ponta de lança',hp:120,speed:3.2,dmg:36,interval:2.3,range:62,acc:0.75,score:250,scale:1,keep:32,sniper:true},
  escudo:{nome:'Escudeiro',hp:230,speed:3.0,dmg:9,interval:0.7,range:15,acc:0.45,score:220,scale:1.05,shield:true},
  atirador:{nome:'Atirador',hp:105,speed:0,dmg:38,interval:2.8,range:85,acc:0.8,score:320,scale:1,perch:true,sniper:true},
  extremo:{nome:'Extremo',hp:85,speed:5.0,dmg:5,interval:0.3,range:14,acc:0.38,score:180,scale:0.98},
  capitao:{nome:'Capitão',hp:1100,speed:3.2,dmg:14,interval:0.32,range:32,acc:0.5,score:1500,scale:1.24,boss:true,aura:true}
};
export const QUIPS=['A seleção adversária ganhou esta. Só esta.','Recarrega, respira e volta ao relvado.','Um pistoleiro cai… e volta sempre.','A cobertura existe por alguma razão.','O nome nas costas não se rende.','As granadas também marcam golos.'];

export const SHOP=[
 {id:'med',nome:'Kit médico',desc:'Vida ao máximo agora',price:200,kind:'consume'},
 {id:'ammo',nome:'Munições completas',desc:'Enche todas as armas',price:300,kind:'consume'},
 {id:'gren',nome:'Granadas +2',desc:'Até 4 no bolso',price:250,kind:'consume'},
 {id:'armor',nome:'Colete balístico',desc:'Absorve 80 de dano',price:600,kind:'consume'},
 {id:'w_shotgun',nome:'Caçadeira',desc:'Compra em vez de esperar pelo nível',price:900,kind:'weapon',w:'shotgun'},
 {id:'w_smg',nome:'Submetralhadora',desc:'Compra em vez de esperar pelo nível',price:1500,kind:'weapon',w:'smg'},
 {id:'w_sniper',nome:'Sniper',desc:'Compra em vez de esperar pelo nível',price:3200,kind:'weapon',w:'sniper'},
 {id:'w_lmg',nome:'Metralhadora LMG',desc:'Compra em vez de esperar pelo nível',price:4200,kind:'weapon',w:'lmg'},
 {id:'w_gl',nome:'Lança-granadas',desc:'6 granadas em arco, explodem ao impacto',price:3000,kind:'weapon',w:'gl'},
 {id:'w_rpg',nome:'RPG',desc:'Rocket de impacto, raio enorme. 1 tiro, recarga lenta',price:4600,kind:'weapon',w:'rpg'},
 {id:'heavy',nome:'Munição pesada',desc:'Enche lança-granadas e RPG',price:500,kind:'consume'},
 {id:'mine',nome:'Minas de proximidade +2',desc:'Coloca no chão (botão Mina / tecla M), até 4',price:350,kind:'consume'},
 {id:'sk_none',nome:'Pintura: original',desc:'Aço e madeira de fábrica, em todas as armas',price:0,kind:'skin',s:'none'},
 {id:'sk_camo',nome:'Pintura: camuflado',desc:'Floresta, em todas as armas',price:1200,kind:'skin',s:'camo'},
 {id:'sk_tiger',nome:'Pintura: tigre',desc:'Laranja e preto, em todas as armas',price:1500,kind:'skin',s:'tiger'},
 {id:'sk_zebra',nome:'Pintura: zebra rosa',desc:'Rosa e preto, em todas as armas',price:1800,kind:'skin',s:'zebra'},
 {id:'sk_gold',nome:'Pintura: ouro (troféu)',desc:'Vence 3 capitães para desbloquear',price:0,kind:'skin',s:'gold',trophy:3},
 {id:'c4',nome:'C4 +2',desc:'Cola na parede ou no chão (botão C4 / tecla C) e rebenta com o detonador (tecla X), até 4',price:450,kind:'consume'},
 {id:'sentry',nome:'Metralhadora montada',desc:'Tripé com escudo: coloca onde estás a olhar (botão Montar / tecla T), dispara sozinha 60 s, até 2 no bolso',price:1800,kind:'consume'},
 {id:'dmg',nome:'Dano +12%',desc:'Permanente, todas as armas',prices:[800,1600,3200],kind:'up',max:3},
 {id:'mag',nome:'Carregador +25%',desc:'Permanente',prices:[600,1200,2400],kind:'up',max:3},
 {id:'reload',nome:'Recarga 15% mais rápida',desc:'Permanente',prices:[500,1000,2000],kind:'up',max:3},
 {id:'hp',nome:'Vida máxima +20',desc:'Permanente',prices:[1000,2000,4000],kind:'up',max:3},
 {id:'head',nome:'Headshot +50% dano',desc:'Permanente',prices:[700,1400],kind:'up',max:2},
 {id:'blast',nome:'Explosões +25%',desc:'Raio e dano de granadas, minas, GL e RPG',prices:[900,1800],kind:'up',max:2},
 {id:'att_sight',nome:'Mira holográfica',desc:'Aponta mais depressa, 15% mais precisa a apontar',price:900,kind:'att',a:'sight'},
 {id:'att_laser',nome:'Mira laser',desc:'Tiro da anca 25% mais preciso',price:700,kind:'att',a:'laser'},
 {id:'att_grip',nome:'Punho vertical',desc:'Menos dispersão em movimento',price:800,kind:'att',a:'grip'},
 {id:'att_stock',nome:'Coronha tática',desc:'Recuo 30% menor',price:1100,kind:'att',a:'stock'},
 {id:'speed',nome:'Velocidade +8%',desc:'Permanente, andar e correr',prices:[700,1400],kind:'up',max:2}
];

/* ---- profundidade das rondas ---- */
/* regras de identidade por estádio: pesos extra para modificadores e eventos */
export const MAIN=5;
const T=k=>TEAMS.find(t=>t.key===k);
const clone=(o,extra)=>Object.assign(JSON.parse(JSON.stringify(o)),extra||{});
TEAMS.push(
{key:'ita',extra:true,nome:'Itália',estadio:'Arena do Ferrolho',tier:3,traits:{hp:1.18,roles:{escudo:3,guarda:1.5},speed:0.95},map:{lat:42,lon:12},shirt:0x1b4fa0,shorts:0xffffff,socks:0x1b4fa0,trim:0xffffff,numCol:0xffffff,gk:{shirt:0x222222,shorts:0x222222,socks:0x222222},crowd:[0x1b4fa0,0xffffff,0x2fb34a,0xd8202a],boss:'Il Catenaccio',kitBase:'fra',kitTint:0xffffff,desc:'Jogo extra · A Arena do Ferrolho tem mais escudos do que adeptos. A Itália defende primeiro e pergunta depois.',layout:LAY_ITA,theme:clone(T('esp').theme,{key:'ita'})},
{key:'eng',extra:true,nome:'Inglaterra',estadio:'Arena da Chuva',tier:4,traits:{acc:1.2,roles:{atirador:3,medio:1.2}},map:{lat:53,lon:-2},shirt:0xf4f4f4,shorts:0x1c2f6b,socks:0xf4f4f4,trim:0xd8202a,numCol:0x1c2f6b,gk:{shirt:0xf2c400,shorts:0x111111,socks:0xf2c400},crowd:[0xf4f4f4,0xd8202a,0x1c2f6b,0xf4f4f4],boss:'Sir Longball',kitBase:'ale',kitTint:0xffffff,desc:'Jogo extra · Chove sempre na Arena da Chuva. Atiradores nos terraços, chá ao intervalo, e um lorde que pede desculpa antes de disparar.',layout:LAY_ENG,theme:clone(T('ale').theme,{key:'eng',weather:'rain',sunInt:1.3,exp:0.9})},
{key:'ned',extra:true,nome:'Países Baixos',estadio:'Arena Laranja',tier:4,traits:{speed:1.22,roles:{ponta:3,defesa:0.7}},map:{lat:53.9,lon:6.2},shirt:0xf27a1a,shorts:0xffffff,socks:0xf27a1a,trim:0x1c2f6b,numCol:0xffffff,gk:{shirt:0x2fb34a,shorts:0x111111,socks:0x2fb34a},crowd:[0xf27a1a,0xffffff,0xf27a1a,0x1c2f6b],boss:'O Totaal',kitBase:'bra',kitTint:0xff9a3c,desc:'Jogo extra · Futebol total: toda a gente corre para todo o lado, ao mesmo tempo, muito depressa. Não há onde te escondas por muito tempo.',layout:LAY_NED,theme:clone(T('bra').theme,{key:'ned'})},
{key:'uru',extra:true,nome:'Uruguai',estadio:'Arena da Garra',tier:5,traits:{hp:1.1,speed:1.08,acc:1.1,roles:{medio:2,guarda:2,escudo:1.5}},map:{lat:-29,lon:-50},shirt:0x7fc4ec,shorts:0x111111,socks:0x111111,trim:0xffffff,numCol:0xffffff,gk:{shirt:0xd8202a,shorts:0x111111,socks:0xd8202a},crowd:[0x7fc4ec,0x111111,0x7fc4ec,0xffffff],boss:'La Garra',kitBase:'arg',kitTint:0xffffff,desc:'Jogo extra · Ninguém desiste na Arena da Garra. Vêm a correr, vêm em grupo, vêm com o guarda-redes. Aguenta.',layout:LAY_URU,theme:clone(T('arg').theme,{key:'uru'})},
{key:'jpn',extra:true,nome:'Japão',estadio:'Arena da Precisão',tier:5,traits:{acc:1.3,hp:0.95,roles:{atirador:2.5,medio:1.5}},map:{lat:36,lon:138},shirt:0x1c2f6b,shorts:0xffffff,socks:0x1c2f6b,trim:0xd8202a,numCol:0xffffff,gk:{shirt:0xf2c400,shorts:0x111111,socks:0xf2c400},crowd:[0x1c2f6b,0xffffff,0xd8202a,0x1c2f6b],boss:'O Samurai',kitBase:'fra',kitTint:0xaab8ff,desc:'Jogo extra · Na Arena da Precisão não se desperdiça uma bala. Cada tiro deles é contado; cada tiro teu devia ser.',layout:LAY_JPN,theme:clone(T('fra').theme,{key:'jpn'})}
);
TEAMS.push({key:'cft',final:true,nome:'CFT',estadio:'Iate-Estádio Nabo I',tier:5,traits:{hp:1.15,acc:1.12,roles:{escudo:2.5,guarda:2,atirador:1.6}},map:{lat:36.3,lon:18},shirt:0x2a2a2a,shorts:0x1a1a1a,socks:0x1a1a1a,trim:0xf2c94c,numCol:0xf2c94c,gk:{shirt:0xf2c94c,shorts:0x1a1a1a,socks:0x1a1a1a},crowd:[0xf2c94c,0x1a1a1a,0xffffff,0xf2c94c],boss:'Presidente Nabo',kitBase:'ale',kitTint:0x3a3a3a,desc:'Final · O iate do presidente Nabo, ancorado no Mediterrâneo, com um estádio no convés. Seguranças de fato, atiradores nos camarotes e o próprio Nabo rodeado de envelopes.',layout:T('arg').layout,theme:clone(T('arg').theme,{key:'cft'})});
export const TEAM_RULES={esp:{},fra:{mods:{fog:3},events:{rain:1}},ale:{mods:{armored:3,scarce:1}},bra:{events:{rain:4},mods:{double:1}},arg:{events:{blackout:4},mods:{headshots:1}},ita:{mods:{armored:4}},eng:{events:{rain:5},mods:{fog:2}},ned:{mods:{fast:4}},uru:{events:{reinforcements:4},mods:{scarce:2}},jpn:{mods:{headshots:4}},cft:{events:{blackout:3,reinforcements:3},mods:{armored:2}}};
export const MODS={
  headshots:{nome:'Só headshots',desc:'Tiros no corpo fazem 30% do dano',body:0.3},
  fog:{nome:'Nevoeiro',desc:'Visibilidade reduzida para todos',fog:0.35},
  scarce:{nome:'Munição escassa',desc:'Reservas a metade nesta onda',scarce:1},
  armored:{nome:'Coletes',desc:'Inimigos com +50% de vida',hp:1.5},
  fast:{nome:'Contra-ataque',desc:'Inimigos 25% mais rápidos',speed:1.25},
  double:{nome:'Dinheiro a dobrar',desc:'Ganhos duplicados nesta onda',money:2}
};
export const OBJECTIVES={
  hold:{nome:'Defende a zona',desc:'Fica dentro do círculo 40 s no total',dur:40,reward:500},
  bombs:{nome:'Desativa as bombas',desc:'3 bombas · 3 s cada · 90 s',count:3,timer:90,reward:600},
  race:{nome:'Chega ao terraço',desc:'Sobe à estrutura marcada em 45 s',timer:45,reward:450}
};
export const EVENTS={
  rain:{nome:'Tempestade',desc:'Chuva forte',dur:40},
  blackout:{nome:'Apagão',desc:'Projetores em baixo',dur:20},
  reinforcements:{nome:'Reforços',desc:'Mais inimigos a entrar em campo',count:4}
};
export const ATTACHMENTS={
  sight:{nome:'Mira holográfica',desc:'Aponta mais depressa, 15% mais precisa a apontar',price:900},
  laser:{nome:'Mira laser',desc:'Tiro da anca 25% mais preciso',price:700},
  grip:{nome:'Punho vertical',desc:'Menos dispersão em movimento',price:800},
  stock:{nome:'Coronha tática',desc:'Recuo 30% menor',price:1100}
};
export const CHALLENGES=[
  {id:'kills',nome:'Elimina {n} inimigos',goals:[20,35,50],reward:300},
  {id:'head',nome:'{n} headshots',goals:[8,12,20],reward:350},
  {id:'high',nome:'{n} eliminações do alto (torre ou terraço)',goals:[3,5,8],reward:400},
  {id:'expl',nome:'{n} eliminações com explosivos',goals:[4,6,10],reward:350},
  {id:'wave',nome:'Chega à onda {n} numa partida',goals:[4,5,6],reward:500},
  {id:'cash',nome:'Ganha {n} € numa partida',goals:[800,1200,2000],reward:400}
];

/* loja: uma entrada por variante */
for(const [k,v] of Object.entries(VARIANTS)){ SHOP.push({id:'w_'+k,nome:v.nome,desc:WCAT[v.base]+' · '+(v.pellets?v.pellets+' bagos · ':'')+'dano '+v.dmg,price:v.price,kind:'weapon',w:k}); }

/* ---- tipos de dano contra proteções: a dificuldade está também em escolher a arma certa ---- */
{ const DCLS={pistol:'ligeiro',smg:'ligeiro',ar:'medio',lmg:'medio',shotgun:'dispersao',sniper:'perfurante',gl:'explosivo',rpg:'explosivo'};
  for(const k in WEAPONS){ WEAPONS[k].cls=DCLS[WEAPONS[k].base||k]||'medio'; }
  Object.assign(WEAPONS.pistol_mag,{cls:'perfurante'}); Object.assign(WEAPONS.smg_45,{cls:'medio'}); Object.assign(WEAPONS.ar_choque,{cls:'perfurante'}); Object.assign(WEAPONS.lmg_heavy,{cls:'perfurante'}); }
export const ARMOR_OF={defesa:'colete',guarda:'blindado',escudo:'escudo',extremo:'rapido',capitao:'colete'};
export const ARMOR_MULT={colete:{ligeiro:0.5,medio:0.9,perfurante:1.15,dispersao:0.75,explosivo:1.0},blindado:{ligeiro:0.25,medio:0.55,perfurante:1.3,dispersao:0.5,explosivo:1.4},escudo:{},rapido:{ligeiro:1.2,dispersao:1.25,perfurante:0.9}};
export const ARMOR_TIP={colete:'Coletes: balas ligeiras (pistolas e submetralhadoras) quase não entram. Usa espingarda, sniper, explosivos ou aponta à cabeça.',blindado:'Blindados: só perfurantes (snipers, Magnum, metralhadora pesada) e explosivos fazem estragos a sério.',escudo:'Escudeiros: de frente quase nada passa. Flanqueia, usa explosivos ou perfurantes.'};
export const CLASS_INFO={ligeiro:{nome:'Ligeiro',bom:'extremos e alvos sem colete',fraco:'coletes, blindados e escudos'},medio:{nome:'Médio',bom:'quase tudo, incluindo coletes',fraco:'blindados e escudos de frente'},perfurante:{nome:'Perfurante',bom:'blindados, coletes e atiradores ao longe',fraco:'extremos rápidos ao perto'},dispersao:{nome:'Dispersão',bom:'extremos e grupos ao perto',fraco:'tudo o que está longe e blindados'},explosivo:{nome:'Explosivo',bom:'escudos, blindados e grupos',fraco:'inimigos colados a ti'}};
{ const MIX={fra:{escudo:2.4},ale:{defesa:1.8,guarda:2.2,escudo:1.3},bra:{extremo:3.0,ponta:0.6},arg:{atirador:2.2,ponta:1.8},ita:{defesa:2.0,escudo:1.6},eng:{extremo:1.6,medio:1.3},ned:{ponta:1.5,extremo:1.4},uru:{guarda:1.7,defesa:1.5},jpn:{extremo:2.0,atirador:1.4},cft:{guarda:1.8,escudo:1.8,atirador:1.5}};
  const SCOUT={esp:'a Espanha joga equilibrada: a tua espingarda chega para quase tudo.',fra:'a França enche o campo de escudeiros. Flanqueia, leva explosivos ou perfurantes.',ale:'a Alemanha traz coletes pesados e guarda-redes blindados. Balas ligeiras não servem: espingarda, sniper ou explosivos.',bra:'o Brasil ataca com enxames de extremos rápidos. Caçadeira ou submetralhadora, de perto.',arg:'a Argentina põe atiradores nas torres e pontas ao longe. Sniper ou espingarda tática.',ita:'a Itália fecha-se com coletes e escudos: paciência e perfurantes.',eng:'a Inglaterra corre muito: extremos e médios em quantidade.',ned:'os Países Baixos jogam de longe e pelas alas.',uru:'o Uruguai põe blindados à frente: perfurantes e explosivos.',jpn:'o Japão é rápido e tem atiradores: atenção aos telhados.',cft:'o iate do Nabo tem seguranças blindados, escudos e atiradores: leva de tudo.'};
  for(const t of TEAMS){ t.traits=t.traits||{}; t.traits.roles=Object.assign({},t.traits.roles||{},MIX[t.key]||{}); t.scout=SCOUT[t.key]||''; } }
