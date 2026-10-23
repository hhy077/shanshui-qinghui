const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

async function main(){
  const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
  try{
    const webgl=await browser.newPage({viewport:{width:1100,height:760}});
    await webgl.addInitScript(()=>{
      const original=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:original.call(this,type,...args);};
    });
    await webgl.goto('http://localhost:5178',{waitUntil:'networkidle'});
    await webgl.locator('#load-error').waitFor({state:'visible',timeout:10000});
    const fallback=await webgl.evaluate(()=>({poster:document.querySelector('#painting-fallback').naturalWidth,error:document.querySelector('#load-error-detail').textContent,loaderHidden:document.querySelector('#loader').hidden}));
    if(!fallback.poster||!fallback.loaderHidden||!/WebGL/i.test(fallback.error))throw new Error(`WebGL failure did not recover to a clear static-poster state: ${JSON.stringify(fallback)}`);
    await webgl.close();

    const module=await browser.newPage({viewport:{width:1100,height:760}});
    await module.route('**/src/main.js',route=>route.abort());
    await module.goto('http://localhost:5178',{waitUntil:'networkidle'});
    await module.locator('#load-error').waitFor({state:'visible',timeout:20000});
    const stalled=await module.evaluate(()=>({poster:document.querySelector('#painting-fallback').naturalWidth,error:document.querySelector('#load-error-detail').textContent,loaderHidden:document.querySelector('#loader').hidden}));
    if(!stalled.poster||!stalled.loaderHidden||!/15 秒/.test(stalled.error))throw new Error(`Module startup failure stayed on the loading seal: ${JSON.stringify(stalled)}`);
    await module.close();

    const good=await browser.newPage();
    await good.goto('http://localhost:5178',{waitUntil:'networkidle'});
    await good.waitForFunction(()=>window.__SHANSHUI?.state.ready,{timeout:30000});
    const ready=await good.evaluate(()=>({ready:window.__SHANSHUI.state.ready,errorHidden:document.querySelector('#load-error').hidden,poster:document.querySelector('#painting-fallback').naturalWidth}));
    if(!ready.ready||!ready.errorHidden||!ready.poster)throw new Error(`Normal WebGL startup was harmed by the fallback: ${JSON.stringify(ready)}`);
    console.log(JSON.stringify({result:'PASS',unsupportedWebGL:fallback,moduleFailure:stalled,normalStartup:ready}));
    await good.close();
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
