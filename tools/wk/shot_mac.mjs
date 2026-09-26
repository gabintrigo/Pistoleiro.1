// Capturas em macOS: equivalente ao tools/wk/shot.py (que precisa de xvfb, só Linux).
// Fala CDP com um Chrome headless já a correr (--remote-debugging-port), sem dependências:
// o Node 26 traz WebSocket e fetch globais.
//
// uso: node tools/wk/shot_mac.mjs <url> <largura> <altura> <steps.json> [porta]
// steps.json = [[atraso_ms, js_ou_null, caminho_png_ou_null], ...]   ('w' em js = só capturar)
import fs from 'fs';

const [,, url, wArg, hArg, stepsPath, portArg] = process.argv;
if(!url||!stepsPath){ console.error('uso: node tools/wk/shot_mac.mjs <url> <largura> <altura> <steps.json> [porta]'); process.exit(1); }
const W=+(wArg||812), H=+(hArg||375), PORT=+(portArg||9222);
const steps=JSON.parse(fs.readFileSync(stepsPath,'utf8'));

const targets=await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page=targets.find(t=>t.type==='page'); if(!page) throw new Error('nenhuma página no Chrome; arrancou com --remote-debugging-port?');
const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((ok,no)=>{ ws.onopen=ok; ws.onerror=e=>no(new Error('ligação CDP falhou')); });

let id=0; const pending=new Map(); const loaded={done:false};
ws.onmessage=ev=>{ const m=JSON.parse(ev.data);
  if(m.id!==undefined){ const p=pending.get(m.id); if(p){ pending.delete(m.id); m.error?p.no(new Error(m.error.message)):p.ok(m.result); } return; }
  if(m.method==='Page.loadEventFired') loaded.done=true;
  if(m.method==='Runtime.consoleAPICalled'){ const t=m.params.args.map(a=>a.value??a.description??'').join(' '); if(t) console.log('  [consola]',t); }
  if(m.method==='Runtime.exceptionThrown') console.log('  [ERRO]', m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
};
const send=(method,params={})=>new Promise((ok,no)=>{ const i=++id; pending.set(i,{ok,no}); ws.send(JSON.stringify({id:i,method,params})); });
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
// viewport em pontos, como o iPhone em paisagem (dpr 1 para o PNG sair a 812x375)
// DPR=3 dá o PNG à resolução real do ecrã (2436x1125) mantendo o enquadramento em pontos
await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:+(process.env.DPR||1),mobile:true});
await send('Page.navigate',{url});
for(let i=0;i<200 && !loaded.done;i++) await sleep(100);

for(const [delay, js, out] of steps){
  if(delay) await sleep(delay);
  if(js && js!=='w'){
    const r=await send('Runtime.evaluate',{expression:js,awaitPromise:true,returnByValue:true,userGesture:true});
    if(r.exceptionDetails) console.log('  [passo falhou]', js.slice(0,60),'->', r.exceptionDetails.exception?.description||r.exceptionDetails.text);
    else if(r.result && r.result.value!==undefined) console.log('  ->', JSON.stringify(r.result.value).slice(0,300));
  }
  if(out){
    const {data}=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    fs.mkdirSync(out.replace(/\/[^/]+$/,'')||'.',{recursive:true}); fs.writeFileSync(out,Buffer.from(data,'base64'));
    console.log('  capturado', out);
  }
}
ws.close();
