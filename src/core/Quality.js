/** Quality tiers for iPhone: everything that costs GPU/CPU is parameterised here. */
export const TIERS = {
  low:      { label:'Baixa',      renderScale:0.55, shadows:false, shadowMap:0,    enemyShadows:false, post:false, bloom:false, particles:300,  textureSize:512,  viewDistance:140, lodBias:0.6, enemiesMax:8,  seatsRows:0, anisotropy:1, msaa:0, softShadows:false, envIntensity:1.0 },
  medium:   { label:'Média',      renderScale:0.72,shadows:true,  shadowMap:1024, enemyShadows:false, post:true,  bloom:false, particles:500,  textureSize:1024, viewDistance:220, lodBias:0.8, enemiesMax:10, seatsRows:1, anisotropy:2, msaa:2, softShadows:false, envIntensity:1.0 },
  high:     { label:'Alta',       renderScale:1.0, shadows:true,  shadowMap:2048, enemyShadows:true,  post:true,  bloom:true,  particles:1000, textureSize:2048, viewDistance:320, lodBias:1.0, enemiesMax:12, seatsRows:4, anisotropy:4, msaa:4, softShadows:true, envIntensity:1.0 },
  veryhigh: { label:'Muito alta', renderScale:1.25,shadows:true,  shadowMap:4096, enemyShadows:true,  post:true,  bloom:true,  particles:1600, textureSize:2048, viewDistance:400, lodBias:1.4, enemiesMax:14, seatsRows:8, anisotropy:8, msaa:4, softShadows:true, envIntensity:1.0 }
};
export const TIER_ORDER = ['low','medium','high','veryhigh'];
export function defaultTier(isTouch){
  if(!isTouch) return 'high';
  const cores = navigator.hardwareConcurrency||4, mem = navigator.deviceMemory||4;
  if(cores>=6 && mem>=6) return 'high';
  if(cores>=4) return 'medium';
  return 'low';
}
/** device pixel ratio actually used = min(dpr, 3) * renderScale, capped so the drawing buffer stays under ~4.2 Mpx on phones */
export function effectivePixelRatio(tier, W, H){
  const dpr = Math.min(window.devicePixelRatio||1, 3);
  let pr = dpr * tier.renderScale;
  const touch = (navigator.maxTouchPoints||0)>0;
  const maxPixels = touch ? 2.4e6 : 4.2e6; // no telemóvel ~2,4 Mpx chegam num ecrã de 6"; o resto do orçamento vai para a fluidez
  const px = W*H*pr*pr;
  if(px>maxPixels) pr *= Math.sqrt(maxPixels/px);
  return Math.max(0.5, pr);
}
