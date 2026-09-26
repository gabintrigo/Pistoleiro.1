/** On-screen performance panel: FPS, frame time, draw calls, triangles, geometries, textures, JS heap, enemies. */
export class DebugPanel {
  constructor(renderer){ this.renderer=renderer; this.el=document.getElementById('debug'); this.frames=0; this.acc=0; this.fps=0; this.ms=0; this.visible=false; this.samples=[]; this.extra=()=>''; try{ const gl=renderer.getContext(); const dbg=gl.getExtension('WEBGL_debug_renderer_info'); this.gpu=(dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):'')+' · '+(navigator.hardwareConcurrency||'?')+' núcleos · '+(navigator.userAgent.match(/OS (\d+_\d+)/)?'iOS '+navigator.userAgent.match(/OS (\d+_\d+)/)[1].replace('_','.'):''); }catch(e){ this.gpu=''; } }
  toggle(on){ this.visible = on===undefined? !this.visible : on; this.el.style.display=this.visible?'block':'none'; }
  tick(dt){
    this.frames++; this.acc+=dt; this.samples.push(dt*1000); if(this.samples.length>120) this.samples.shift();
    if(this.acc>=0.5){ this.fps=this.frames/this.acc; this.ms=this.samples.reduce((a,b)=>a+b,0)/this.samples.length; this.frames=0; this.acc=0; if(this.visible) this.render(); }
  }
  render(){
    const i=this.renderer.info, mem=performance.memory, worst=Math.max(...this.samples).toFixed(1);
    this.el.textContent=`FPS ${this.fps.toFixed(0)} · ${this.ms.toFixed(1)} ms (pior ${worst})\n`+
      `draw calls ${i.render.calls} · tris ${(i.render.triangles/1000).toFixed(1)}k\n`+
      `geometrias ${i.memory.geometries} · texturas ${i.memory.textures} · programas ${i.programs?i.programs.length:'-'}\n`+
      (mem?`heap ${(mem.usedJSHeapSize/1048576).toFixed(0)} / ${(mem.jsHeapSizeLimit/1048576).toFixed(0)} MB\n`:'heap n/d (Safari)\n')+
      `pixel ratio ${this.renderer.getPixelRatio().toFixed(2)} · ${this.renderer.domElement.width}×${this.renderer.domElement.height} · ${this.gpu||''}\n`+this.extra();
  }
}
