/* Retratos ilustrados (SVG 200x200), originais: herói, capitães e o presidente Nabo. Humores: neutral, smug, angry, happy, hurt, defeated. */
const OL='#1f2a33';
export const CH={
 hero:{skin:'#f1c9a5',head:'oval',hair:'fade',hc:'#2a1a0e',brow:3.5,fh:'stubble',shirt:'#d8202a',trim:'#1c6b2a',acc:[],mood:'happy'},
 esp:{skin:'#e8b894',head:'long',hair:'quiff',hc:'#1a1a1a',brow:3,fh:'stubble',shirt:'#d8202a',trim:'#f2c94c',acc:['armband'],mood:'smug'},
 fra:{skin:'#f0c8a8',head:'oval',hair:'swept',hc:'#6b4a2a',brow:2.5,fh:'pencil',shirt:'#1e3a8a',trim:'#ffffff',acc:['armband','scarf'],mood:'smug'},
 ale:{skin:'#f4d2b8',head:'square',hair:'flattop',hc:'#e8c860',brow:3,shirt:'#f4f4f4',trim:'#111111',acc:['armband','glasses'],mood:'neutral'},
 bra:{skin:'#8d5a3b',head:'round',hair:'curly',hc:'#2a1a0e',tips:'#f2d060',brow:3,shirt:'#f2c400',trim:'#1c8a3c',acc:['armband','earring'],mood:'happy'},
 arg:{skin:'#e2b48f',head:'long',hair:'slick',hc:'#1a1a1a',gray:true,brow:3,fh:'stubble',shirt:'#7fc4ec',trim:'#ffffff',acc:['armband','sunglasses','chain'],mood:'smug'},
 ita:{skin:'#d9a57a',head:'square',hair:'bald',hc:'#2a2a2a',brow:6,uni:true,fh:'stubble',shirt:'#1b4fa0',trim:'#ffffff',acc:['armband'],mood:'angry'},
 eng:{skin:'#f6d9c4',head:'long',hair:'bowler',hc:'#8a6a4a',brow:3,fh:'handlebar',shirt:'#f4f4f4',trim:'#d8202a',acc:['armband','monocle'],mood:'smug'},
 ned:{skin:'#f6d0b4',head:'oval',hair:'long',hc:'#e8c860',band:'#f27a1a',brow:2.5,freckles:true,shirt:'#f27a1a',trim:'#ffffff',acc:['armband'],mood:'happy'},
 uru:{skin:'#c98e66',head:'long',hair:'long',hc:'#1a1a1a',band:'#7fc4ec',brow:4,fh:'beard',shirt:'#7fc4ec',trim:'#111111',acc:['armband'],mood:'angry'},
 jpn:{skin:'#f0cfa8',head:'oval',hair:'topknot',hc:'#111111',band:'#ffffff',brow:3,shirt:'#1c2f6b',trim:'#d8202a',acc:['armband'],mood:'neutral'},
 cft:{skin:'#f0bfa0',head:'wide',hair:'combover',hc:'#9a9a9a',brow:4,suit:true,acc:['cigar','chain'],mood:'smug'}
};
const darken=(hex,k)=>{const n=parseInt(hex.slice(1),16);const r=Math.round(((n>>16)&255)*k),g=Math.round(((n>>8)&255)*k),b=Math.round((n&255)*k);return '#'+((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1);};
function headPath(h){switch(h){
 case 'round':return '<ellipse cx="100" cy="90" rx="50" ry="52"/>';
 case 'square':return '<path d="M54 72 Q54 36 100 34 Q146 36 146 72 L144 108 Q140 140 100 144 Q60 140 56 108 Z"/>';
 case 'long':return '<ellipse cx="100" cy="90" rx="43" ry="58"/>';
 case 'wide':return '<path d="M44 92 Q44 38 100 36 Q156 38 156 92 Q156 150 100 152 Q44 150 44 92 Z"/>';
 default:return '<ellipse cx="100" cy="90" rx="46" ry="55"/>';}}
function hair(c){const hc=c.hc,dk=darken(hc,0.7);switch(c.hair){
 case 'fade':return '<path d="M54 84 Q50 38 100 32 Q150 38 146 84 Q142 58 122 52 Q104 46 84 52 Q62 60 54 84 Z" fill="'+hc+'" stroke="'+OL+'" stroke-width="3"/><path d="M80 52 Q96 22 126 40 Q110 36 98 48 Z" fill="'+hc+'" stroke="'+OL+'" stroke-width="3"/>';
 case 'quiff':return '<path d="M56 86 Q48 44 86 34 Q92 4 140 16 Q162 32 146 86 Q142 60 124 52 Q100 46 80 54 Q62 62 56 86 Z" fill="'+hc+'" stroke="'+OL+'" stroke-width="3"/><path d="M96 22 Q118 12 136 22 M92 32 Q116 22 140 30" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".55"/>';
 case 'swept':return '<path d="M54 88 Q52 38 100 34 Q152 36 150 90 Q148 60 128 50 Q108 42 80 50 Q62 58 54 88 Z" fill="'+hc+'" stroke="'+OL+'" stroke-width="3"/><path d="M78 50 q-8 14 6 16 q10 -2 4 -12" fill="none" stroke="'+dk+'" stroke-width="4" stroke-linecap="round"/><path d="M60 70 Q58 96 62 104 M140 70 Q142 96 138 104" stroke="'+hc+'" stroke-width="8" stroke-linecap="round"/>';
 case 'flattop':return '<path d="M56 74 L56 36 L144 36 L144 74 Q132 54 100 54 Q68 54 56 74 Z" fill="'+hc+'" stroke="'+OL+'" stroke-width="3"/><path d="M62 42 h76" stroke="'+darken(hc,0.85)+'" stroke-width="3"/>';
 case 'curly':{let o='';const pts=[[60,62],[70,46],[84,36],[100,32],[116,36],[130,46],[140,62],[64,80],[136,80]];for(const [x,y] of pts)o+='<circle cx="'+x+'" cy="'+y+'" r="15" fill="'+hc+'" stroke="'+OL+'" stroke-width="3"/>';for(const [x,y] of pts.slice(1,6))o+='<circle cx="'+(x+3)+'" cy="'+(y-5)+'" r="6" fill="'+(c.tips||hc)+'"/>';return o;}
 case 'slick':return '<path d="M54 86 Q52 40 100 34 Q148 40 146 86 Q140 48 100 48 Q60 48 54 86 Z" fill="'+hc+'" stroke="'+OL+'" stroke-width="3"/><path d="M70 44 Q100 36 130 44 M66 54 Q100 44 134 54" fill="none" stroke="#fff" stroke-width="2" opacity=".35"/>'+(c.gray?'<path d="M56 70 Q58 84 60 90 M144 70 Q142 84 140 90" stroke="#c9c9c9" stroke-width="6" stroke-linecap="round"/>':'');
 case 'bald':return '<path d="M52 72 Q50 94 58 104 M148 72 Q150 94 142 104" stroke="'+hc+'" stroke-width="9" stroke-linecap="round"/><ellipse cx="86" cy="46" rx="14" ry="6" fill="#fff" opacity=".35" transform="rotate(-20 86 46)"/>';
 case 'bowler':return '<path d="M58 74 Q58 90 62 104 M142 74 Q142 90 138 104" stroke="'+hc+'" stroke-width="8" stroke-linecap="round"/><ellipse cx="100" cy="52" rx="62" ry="11" fill="#1a1a1a" stroke="'+OL+'" stroke-width="3"/><path d="M62 52 Q62 6 100 6 Q138 6 138 52 Z" fill="#1a1a1a" stroke="'+OL+'" stroke-width="3"/><path d="M64 44 Q100 50 136 44" stroke="#5a3a1e" stroke-width="6"/><path d="M76 18 Q90 10 104 12" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".3" fill="none"/>';
 case 'long':return '<path d="M50 150 Q42 96 52 60 Q66 30 100 30 Q134 30 148 60 Q158 96 150 150 L136 150 Q142 100 136 74 Q122 56 100 56 Q78 56 64 74 Q58 100 64 150 Z" fill="'+hc+'" stroke="'+OL+'" stroke-width="3"/><path d="M52 62 Q100 40 148 62 L148 74 Q100 54 52 74 Z" fill="'+(c.band||hc)+'" stroke="'+OL+'" stroke-width="3"/>';
 case 'topknot':return '<path d="M56 80 Q54 40 100 36 Q146 40 144 80 Q138 58 100 56 Q62 58 56 80 Z" fill="'+hc+'" stroke="'+OL+'" stroke-width="3"/><circle cx="100" cy="26" r="13" fill="'+hc+'" stroke="'+OL+'" stroke-width="3"/><path d="M54 64 Q100 50 146 64 L146 76 Q100 62 54 76 Z" fill="'+(c.band||'#fff')+'" stroke="'+OL+'" stroke-width="3"/><circle cx="100" cy="64" r="6" fill="#d8202a"/><path d="M146 70 l14 8 l-6 4 z" fill="'+(c.band||'#fff')+'" stroke="'+OL+'" stroke-width="2"/>';
 case 'combover':return '<path d="M48 80 Q46 96 52 106 M152 80 Q154 96 148 106" stroke="'+hc+'" stroke-width="10" stroke-linecap="round"/><path d="M56 62 Q96 40 146 56 M58 70 Q98 48 148 64 M62 56 Q96 38 140 48" fill="none" stroke="'+hc+'" stroke-width="3" stroke-linecap="round"/><ellipse cx="86" cy="50" rx="14" ry="5" fill="#fff" opacity=".3" transform="rotate(-15 86 50)"/>';
 }return '';}
function brows(c,m){const w=c.brow||3,hc=c.hc==='#e8c860'?'#b8962a':darken(c.hc,1);let L,R;
 if(m==='angry'){L='M70 74 L92 82';R='M130 74 L108 82';}else if(m==='hurt'||m==='defeated'){L='M70 80 L92 74';R='M130 80 L108 74';}else if(m==='smug'){L='M70 78 Q80 74 92 78';R='M108 72 Q120 66 132 72';}else if(m==='happy'){L='M70 76 Q81 70 92 75';R='M108 75 Q119 70 130 76';}else{L='M70 78 Q81 74 92 78';R='M108 78 Q119 74 130 78';}
 if(c.uni)return '<path d="M68 78 Q84 70 100 78 Q116 70 132 78" fill="none" stroke="'+hc+'" stroke-width="'+w+'" stroke-linecap="round"/>';
 return '<path d="'+L+'" fill="none" stroke="'+hc+'" stroke-width="'+w+'" stroke-linecap="round"/><path d="'+R+'" fill="none" stroke="'+hc+'" stroke-width="'+w+'" stroke-linecap="round"/>';}
function eyes(c,m){const sk=c.skin;let o='';
 if(m==='happy')return '<path d="M74 92 Q82 84 90 92 M110 92 Q118 84 126 92" fill="none" stroke="'+OL+'" stroke-width="3.5" stroke-linecap="round"/>';
 for(const [x,side] of [[82,-1],[118,1]]){
   if(m==='hurt'&&side===1){o+='<path d="M112 86 l12 10 M124 86 l-12 10" stroke="'+OL+'" stroke-width="3.5" stroke-linecap="round"/>';continue;}
   const ry=m==='angry'?5.5:7.5;o+='<ellipse cx="'+x+'" cy="91" rx="9" ry="'+ry+'" fill="#fff" stroke="'+OL+'" stroke-width="2.5"/>';
   const py=m==='defeated'?94:91;o+='<circle cx="'+(x+(side<0?1.5:-1.5))+'" cy="'+py+'" r="3.8" fill="'+OL+'"/><circle cx="'+(x+(side<0?2.5:-0.5))+'" cy="'+(py-1.5)+'" r="1.2" fill="#fff"/>';
   if(m==='smug'||m==='defeated')o+='<path d="M'+(x-10)+' 91 Q'+x+' 81 '+(x+10)+' 91 L'+(x+10)+' 84 L'+(x-10)+' 84 Z" fill="'+sk+'" stroke="'+OL+'" stroke-width="2"/>';}
 return o;}
function mouth(m){switch(m){
 case 'smug':return '<path d="M86 122 Q102 128 116 116" fill="none" stroke="'+OL+'" stroke-width="3.5" stroke-linecap="round"/>';
 case 'angry':return '<path d="M84 118 Q100 112 116 118 Q114 136 100 136 Q86 136 84 118 Z" fill="#5a1a1a" stroke="'+OL+'" stroke-width="3"/><path d="M88 119 Q100 116 112 119 L112 123 L88 123 Z" fill="#fff"/>';
 case 'happy':return '<path d="M82 116 Q100 118 118 116 Q116 136 100 136 Q84 136 82 116 Z" fill="#7a2020" stroke="'+OL+'" stroke-width="3"/><path d="M86 117 Q100 119 114 117 L113 122 L87 122 Z" fill="#fff"/><path d="M92 130 Q100 126 108 130" fill="#e06a6a"/>';
 case 'hurt':return '<path d="M84 124 L90 118 L96 124 L102 118 L108 124 L114 118" fill="none" stroke="'+OL+'" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>';
 case 'defeated':return '<path d="M86 128 Q100 118 114 128" fill="none" stroke="'+OL+'" stroke-width="3.5" stroke-linecap="round"/><path d="M142 64 q4 8 0 12 q-4 -4 0 -12z" fill="#7fc4ec" stroke="'+OL+'" stroke-width="1.5"/>';
 default:return '<path d="M88 122 Q100 125 112 122" fill="none" stroke="'+OL+'" stroke-width="3.5" stroke-linecap="round"/>';}}
function facial(c,m){switch(c.fh){
 case 'stubble':return '<path d="M66 110 Q72 140 100 144 Q128 140 134 110 Q120 126 100 128 Q80 126 66 110 Z" fill="#000" opacity=".12"/>';
 case 'pencil':return '<path d="M86 113 Q100 109 114 113" fill="none" stroke="'+darken(c.hc,1)+'" stroke-width="3" stroke-linecap="round"/>';
 case 'handlebar':return '<path d="M100 112 Q86 106 76 114 Q70 118 72 108 M100 112 Q114 106 124 114 Q130 118 128 108" fill="none" stroke="'+c.hc+'" stroke-width="5" stroke-linecap="round"/>';
 case 'beard':return '<path d="M58 96 Q60 144 100 150 Q140 144 142 96 Q134 116 124 122 Q112 112 100 112 Q88 112 76 122 Q66 116 58 96 Z" fill="'+c.hc+'" stroke="'+OL+'" stroke-width="3"/>'+'<path d="M86 124 Q100 '+(m==='angry'?134:128)+' 114 124" fill="'+(m==='angry'?'#5a1a1a':'none')+'" stroke="'+OL+'" stroke-width="3"/>';
 }return '';}
function body(c){if(c.suit)return '<path d="M16 200 C20 162 52 148 80 144 L120 144 C148 148 180 162 184 200 Z" fill="#1c1f26" stroke="'+OL+'" stroke-width="3"/><path d="M80 144 L100 190 L120 144 Z" fill="#fff" stroke="'+OL+'" stroke-width="2.5"/><path d="M96 156 L104 156 L108 190 L100 198 L92 190 Z" fill="#f2c94c" stroke="'+OL+'" stroke-width="2"/><path d="M80 144 L92 174 L74 170 Z M120 144 L108 174 L126 170 Z" fill="#2c313a" stroke="'+OL+'" stroke-width="2"/>';
 return '<path d="M20 200 C24 164 52 150 80 146 L120 146 C148 150 176 164 180 200 Z" fill="'+c.shirt+'" stroke="'+OL+'" stroke-width="3"/><path d="M82 146 L100 172 L118 146" fill="none" stroke="'+c.trim+'" stroke-width="7" stroke-linejoin="round"/><path d="M130 158 Q146 170 150 200 M70 158 Q54 170 50 200" fill="none" stroke="#000" stroke-width="2" opacity=".15"/>';}
function acc(c,list){let o='';for(const a of list){switch(a){
 case 'armband':o+='<g transform="rotate(-18 160 180)"><rect x="146" y="172" width="30" height="14" rx="3" fill="#f2c94c" stroke="'+OL+'" stroke-width="2.5"/><text x="161" y="183" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="11" fill="#1a1200">C</text></g>';break;
 case 'glasses':o+='<rect x="68" y="82" width="28" height="19" rx="3" fill="rgba(200,230,255,.25)" stroke="'+OL+'" stroke-width="3"/><rect x="104" y="82" width="28" height="19" rx="3" fill="rgba(200,230,255,.25)" stroke="'+OL+'" stroke-width="3"/><path d="M96 90 L104 90 M68 88 L56 86 M132 88 L144 86" stroke="'+OL+'" stroke-width="3"/>';break;
 case 'sunglasses':o+='<path d="M66 84 Q82 80 96 84 L94 98 Q80 104 70 98 Z M104 84 Q118 80 134 84 L130 98 Q120 104 106 98 Z" fill="#101318" stroke="'+OL+'" stroke-width="2.5"/><path d="M96 88 L104 88" stroke="'+OL+'" stroke-width="3"/><path d="M72 88 l10 -2 M110 88 l10 -2" stroke="#fff" stroke-width="2" opacity=".5"/>';break;
 case 'monocle':o+='<circle cx="118" cy="91" r="13" fill="rgba(200,230,255,.2)" stroke="#c9a227" stroke-width="3"/><path d="M130 97 Q140 130 132 150" fill="none" stroke="#c9a227" stroke-width="1.8"/>';break;
 case 'earring':o+='<circle cx="147" cy="108" r="4" fill="#f2c94c" stroke="'+OL+'" stroke-width="1.5"/>';break;
 case 'chain':o+='<path d="M78 150 Q100 176 122 150" fill="none" stroke="#f2c94c" stroke-width="4" stroke-dasharray="3 2"/><circle cx="100" cy="166" r="5" fill="#f2c94c" stroke="'+OL+'" stroke-width="1.5"/>';break;
 case 'cigar':o+='<g transform="rotate(12 124 124)"><rect x="114" y="120" width="30" height="7" rx="3" fill="#7a4a22" stroke="'+OL+'" stroke-width="2"/><rect x="140" y="120" width="5" height="7" fill="#ff7a1a"/></g><path d="M150 112 q6 -8 0 -14 q-6 -6 0 -14" fill="none" stroke="#c9c9c9" stroke-width="2.5" opacity=".8"/>';break;
 case 'scarf':o+='<path d="M72 140 Q100 158 128 140 L130 152 Q100 170 70 152 Z" fill="#1e3a8a" stroke="'+OL+'" stroke-width="2.5"/><path d="M86 150 L82 184 L94 184 L96 154 Z" fill="#ffffff" stroke="'+OL+'" stroke-width="2"/><path d="M82 176 L94 176" stroke="#d8202a" stroke-width="5"/>';break;}}return o;}
export function portrait(key,mood){const c=CH[key]||CH.hero;const m=mood||c.mood;const sk=c.skin;
 let o='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">';
 o+=body(c);o+='<rect x="86" y="126" width="28" height="26" fill="'+sk+'" stroke="'+OL+'" stroke-width="3"/><path d="M86 136 Q100 146 114 136" fill="none" stroke="#000" stroke-width="3" opacity=".15"/>';
 if(c.hair==='long')o+=hair(c).split('<path d="M52 62')[0];
 o+='<ellipse cx="'+(c.head==='wide'?42:52)+'" cy="94" rx="8" ry="12" fill="'+sk+'" stroke="'+OL+'" stroke-width="3"/><ellipse cx="'+(c.head==='wide'?158:148)+'" cy="94" rx="8" ry="12" fill="'+sk+'" stroke="'+OL+'" stroke-width="3"/>';
 o+='<g fill="'+sk+'" stroke="'+OL+'" stroke-width="3.5">'+headPath(c.head)+'</g>';
 o+='<ellipse cx="124" cy="108" rx="16" ry="10" fill="#e06a6a" opacity=".18"/><ellipse cx="76" cy="108" rx="16" ry="10" fill="#e06a6a" opacity=".18"/>';
 if(c.head==='wide')o+='<path d="M60 132 Q100 162 140 132" fill="none" stroke="'+OL+'" stroke-width="2.5" opacity=".6"/>';
 if(c.freckles)for(const [x,y] of [[74,104],[80,108],[70,110],[126,104],[120,108],[130,110]])o+='<circle cx="'+x+'" cy="'+y+'" r="1.6" fill="#b8703a"/>';
 o+=eyes(c,m)+brows(c,m)+'<path d="M100 92 Q95 108 100 112 Q106 112 108 109" fill="none" stroke="'+OL+'" stroke-width="3" stroke-linecap="round"/>';
 o+=facial(c,m);if(c.fh!=='beard')o+=mouth(m);
 o+=(c.hair==='long'?'<path d="M52 62'+hair(c).split('<path d="M52 62')[1]:hair(c));
 o+=acc(c,c.acc||[]);
 return o+'</svg>';}
