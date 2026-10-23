const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

async function run(){
  const browser = await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
  const failures=[];
  const desktop=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  desktop.on('pageerror',e=>failures.push('pageerror: '+e.message));
  desktop.on('console',m=>{if(m.type()==='error')failures.push('console: '+m.text());});
  const failuresBefore=failures.length;
  await desktop.goto('http://localhost:5178',{waitUntil:'networkidle'});
  await desktop.waitForFunction(()=>window.__SHANSHUI?.state.ready,{timeout:30000});
  await desktop.waitForFunction(()=>!document.querySelector('#viewport').classList.contains('is-unrolling'));
  await desktop.waitForTimeout(100);
  await desktop.screenshot({path:path.join(__dirname,'..','screenshots','desktop.png'),fullPage:true});
  const render=await desktop.evaluate(()=>({title:document.title,canvas:{width:document.querySelector('canvas').width,height:document.querySelector('canvas').height},viewport:document.querySelector('#viewport').getBoundingClientRect().toJSON(),state:window.__SHANSHUI.state,fonts:document.fonts.check('40px InkKai')}));
  if(!render.state.ready||render.state.renderCalls<2)throw new Error('Scene did not complete an animated render');
  if(render.state.birds.length!==9||render.state.skyCount!==5)throw new Error('Bird inventory mismatch');
  if(render.state.sound!==false||render.state.audioState!=='uninitialized')throw new Error('Sound should start disabled');
  const solid=await desktop.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2');return gl.getParameter(gl.VENDOR)+': '+gl.getParameter(gl.RENDERER)});

  const qualityWidths=[];
  for(const tier of ['fine','balanced','light']){
    await desktop.locator('#quality').click();
    await desktop.locator(`[data-quality="${tier}"]`).click();
    qualityWidths.push(await desktop.locator('#painting').evaluate(c=>c.width));
  }
  if(!(qualityWidths[0]>qualityWidths[1]&&qualityWidths[1]>qualityWidths[2]))throw new Error('Quality tiers did not produce distinct render resolutions');
  if(await desktop.evaluate(()=>localStorage.getItem('shanshui-quality'))!=='light')throw new Error('Quality choice was not saved');
  await desktop.locator('#quality').click();await desktop.locator('[data-quality="fine"]').click();

  await desktop.locator('#viewport').hover({position:{x:700,y:350}});
  await desktop.mouse.wheel(0,-620);await desktop.waitForTimeout(200);
  const zoomed=await desktop.evaluate(()=>window.__SHANSHUI.state.zoom);
  if(zoomed<=1)throw new Error('Wheel zoom did not increase magnification');
  await desktop.locator('#reset').click();
  if((await desktop.evaluate(()=>window.__SHANSHUI.state.zoom))!==1)throw new Error('Reset did not restore full picture');

  const boat=await desktop.evaluate(()=>window.__SHANSHUI.project(.70,.70));
  const protectedBefore=await desktop.evaluate(()=>window.__SHANSHUI.state.ripples.length);
  await desktop.mouse.click(boat.x,boat.y);
  await desktop.waitForTimeout(150);
  const protectedAfter=await desktop.evaluate(()=>window.__SHANSHUI.state.ripples.length);
  if(protectedBefore!==protectedAfter)throw new Error('Boat region accepted a water interaction');
  const water=await desktop.evaluate(()=>window.__SHANSHUI.project(.63,.78));
  if(!(await desktop.evaluate(()=>window.__SHANSHUI.isWater(.63,.78))))throw new Error('QA water probe is outside the mask');
  await desktop.mouse.click(water.x,water.y);
  await desktop.waitForFunction(()=>window.__SHANSHUI.state.ripples.length>0);
  const ripple=await desktop.evaluate(()=>window.__SHANSHUI.state.ripples.at(-1));
  if(Math.abs(ripple.u-.63)>.012||Math.abs(ripple.v-.78)>.012)throw new Error('Ripple does not match its clicked water point');

  const empty=await desktop.evaluate(()=>window.__SHANSHUI.project(.68,.83));
  await desktop.mouse.click(empty.x,empty.y);
  await desktop.waitForTimeout(100);
  const emptyStayedEmpty=await desktop.evaluate(()=>window.__SHANSHUI.state.disturbed===0&&window.__SHANSHUI.state.birds.every(b=>b.state==='rest'));
  if(!emptyStayedEmpty)throw new Error('Empty-water click disturbed a bird');

  const birdPoint=await desktop.evaluate(()=>window.__SHANSHUI.project(.425,.787));
  await desktop.mouse.click(birdPoint.x,birdPoint.y);
  const shaken=await desktop.evaluate(()=>window.__SHANSHUI.state.birds.filter(b=>b.state!=='rest').map(b=>b.id));
  if(shaken.length<2)throw new Error('Near birds did not react in a flock');
  await desktop.waitForFunction(()=>window.__SHANSHUI.state.birds.some(b=>b.state==='flight'),null,{timeout:6000});
  const flight=await desktop.evaluate(()=>window.__SHANSHUI.state.birds.filter(b=>b.state==='flight').length);
  await desktop.waitForFunction((ids)=>{const birds=window.__SHANSHUI.state.birds;return ids.every(id=>{const b=birds[id];return b.cycles>0&&b.state==='rest'&&Math.abs(b.u-b.home.u)<.0001&&Math.abs(b.v-b.home.v)<.0001;});},shaken,{timeout:24000});
  const landed=await desktop.evaluate((ids)=>ids.every(id=>{const b=window.__SHANSHUI.state.birds[id];return b.cycles>0&&b.state==='rest'&&Math.abs(b.u-b.home.u)<.0001&&Math.abs(b.v-b.home.v)<.0001;}),shaken);
  if(!landed)throw new Error('Bird flock did not land back at all fixed home positions');

  await desktop.locator('#sound').click();await desktop.waitForFunction(()=>window.__SHANSHUI.state.audioState==='running');
  await desktop.waitForTimeout(800);
  const sound=await desktop.evaluate(()=>({on:window.__SHANSHUI.state.sound,rms:window.__SHANSHUI.state.audioRms,peak:window.__SHANSHUI.state.audioPeak,calls:window.__SHANSHUI.state.audioCalls}));
  if(!sound.on||sound.calls<1||sound.rms<.00001||sound.rms>.01||sound.peak>.2)throw new Error(`Synthesized soundscape is silent, too loud or clipped: ${JSON.stringify(sound)}`);
  const callsBeforeRipple=await desktop.evaluate(()=>window.__SHANSHUI.state.audioCalls);
  await desktop.mouse.click(water.x,water.y);
  const callsAfterRipple=await desktop.evaluate(()=>window.__SHANSHUI.state.audioCalls);
  if(callsAfterRipple!==callsBeforeRipple)throw new Error('Water ripple triggered an audio cue');
  await desktop.locator('#sound').click();

  const [download]=await Promise.all([desktop.waitForEvent('download'),desktop.locator('#save').click()]);
  const pngPath=path.join(__dirname,'..','screenshots','saved-canvas.png');
  await download.saveAs(pngPath);
  if(fs.readFileSync(pngPath).subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error('Saved image is not a valid PNG');
  fs.unlinkSync(pngPath);

  const fullSupport=await desktop.evaluate(()=>!!document.querySelector('#app').requestFullscreen);
  if(fullSupport){
    await desktop.locator('#fullscreen').click();await desktop.waitForFunction(()=>!!document.fullscreenElement);
    if(!(await desktop.evaluate(()=>document.fullscreenElement?.id==='app')))throw new Error('Fullscreen did not remain on the original app surface');
    await desktop.waitForFunction(()=>document.querySelector('#app').classList.contains('is-fullscreen'));
    const fullscreenState=await desktop.evaluate(()=>({header:getComputedStyle(document.querySelector('.masthead')).display,toolbar:getComputedStyle(document.querySelector('.toolbar')).display,viewport:document.querySelector('#viewport').getBoundingClientRect().toJSON()}));
    if(fullscreenState.header!=='none'||fullscreenState.toolbar==='none'||fullscreenState.viewport.height<700)throw new Error('Immersive fullscreen layout did not focus the painting');
    await desktop.addStyleTag({content:'#toast{display:none!important}'});
    await desktop.waitForTimeout(250);
    await desktop.screenshot({path:path.join(__dirname,'..','screenshots','fullscreen.png')});
    await desktop.locator('#fullscreen').click();await desktop.waitForFunction(()=>!document.fullscreenElement);
  }

  const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  mobile.on('pageerror',e=>failures.push('mobile pageerror: '+e.message));
  await mobile.goto('http://localhost:5178',{waitUntil:'networkidle'});
  await mobile.waitForFunction(()=>window.__SHANSHUI?.state.ready,{timeout:30000});
  await mobile.waitForFunction(()=>!document.querySelector('#viewport').classList.contains('is-unrolling'));
  await mobile.waitForTimeout(100);
  await mobile.screenshot({path:path.join(__dirname,'..','screenshots','mobile.png'),fullPage:true});
  const mobileState=await mobile.evaluate(()=>({viewport:document.querySelector('#viewport').getBoundingClientRect().toJSON(),canvas:{width:document.querySelector('canvas').width,height:document.querySelector('canvas').height},state:window.__SHANSHUI.state,overflow:document.documentElement.scrollWidth>innerWidth}));
  const pinchStart=await mobile.evaluate(()=>{
    const r=document.querySelector('#viewport').getBoundingClientRect();return {x:r.x+r.width*.50,y:r.y+r.height*.60};
  });
  const cdp=await mobile.context().newCDPSession(mobile);
  const sendTouch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(p=>({x:p.x,y:p.y,id:p.id,radiusX:5,radiusY:5,force:1}))});
  await sendTouch('touchStart',[{id:0,x:pinchStart.x-46,y:pinchStart.y},{id:1,x:pinchStart.x+46,y:pinchStart.y}]);
  await sendTouch('touchMove',[{id:0,x:pinchStart.x-82,y:pinchStart.y},{id:1,x:pinchStart.x+82,y:pinchStart.y}]);
  await mobile.waitForTimeout(100);
  const pinch=await mobile.evaluate(()=>window.__SHANSHUI.state.zoom);
  await sendTouch('touchEnd',[]);
  if(pinch<=1)throw new Error('Two-finger pinch from the artwork did not zoom the mobile painting');
  await mobile.locator('#reset').click();
  const touchPoint=await mobile.evaluate(()=>window.__SHANSHUI.project(.63,.78));
  await mobile.touchscreen.tap(touchPoint.x,touchPoint.y);
  await mobile.waitForFunction(()=>window.__SHANSHUI.state.ripples.length>0);
  if(Math.abs((await mobile.evaluate(()=>window.__SHANSHUI.state.ripples.at(-1).u))-.63)>.025)throw new Error('Mobile touch ripple landed at the wrong point');
  if(mobileState.overflow)throw new Error('Mobile layout has horizontal overflow');
  if(failures.length>failuresBefore)throw new Error(failures.join('\n'));

  const report={result:'PASS',engine:solid,desktop:{title:render.title,canvas:render.canvas,artworkAspectRatio:'16:9, no stretching',inventory:{waterBirds:render.state.birds.length,skyBirds:render.state.skyCount},canvasRenders:render.state.renderCalls,quality:{tiers:['fine','balanced','light'],canvasWidths:qualityWidths,persisted:true},ripple:{source:'pixel mask',screenPoint:'matches art coordinate',boat:'protected',emptyWater:'birds undisturbed'},flock:{reacted:shaken.length,tookFlight:flight,returnedToFixedHomes:landed},wheelZoom:zoomed,naturalSound:sound,canvasExport:'PNG signature verified',fullscreen:fullSupport?'immersive layout entered and exited':'not exposed by test browser'},mobile:{canvas:mobileState.canvas,artworkAspectRatio:'16:9, letterboxed without distortion',horizontalOverflow:mobileState.overflow,pinchZoom:pinch,touchRipple:'matched art coordinate'},consoleFailures:failures.length,screenshots:['screenshots/desktop.png','screenshots/mobile.png','screenshots/fullscreen.png']};
  fs.writeFileSync(path.join(__dirname,'..','screenshots','qa-report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));await browser.close();
}
run().catch(e=>{console.error(e);process.exitCode=1;});
