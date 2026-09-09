const {chromium}=require('/Users/jasonkummerl/Github/svelte-motion-transform-page-point/node_modules/@playwright/test');
(async()=>{
 const b=await chromium.launch({headless:true});
 try {
  const p=await b.newPage({viewport:{width:900,height:700}});
  await p.addInitScript(()=>{let now=1000,next=1;const callbacks=new Map();Object.defineProperty(performance,'now',{configurable:true,value:()=>now});window.requestAnimationFrame=fn=>{const id=next++;callbacks.set(id,fn);return id};window.cancelAnimationFrame=id=>callbacks.delete(id);window.__READOUT_ADVANCE__=()=>{now+=16;const queued=[...callbacks.values()];callbacks.clear();queued.forEach(fn=>fn(now));};});
  await p.goto('http://127.0.0.1:4198/tests/transform-page-point/drag?case=drag-layout-snap-correction&@isPlaywright=true');
  await p.waitForFunction(()=>document.querySelector('[data-testid="fixture"]')?.dataset.ready==='true');
  const advance=async(n=1)=>{for(let i=0;i<n;i++){await p.evaluate(()=>window.__READOUT_ADVANCE__());await p.evaluate(()=>Promise.resolve());}};
  await advance(4);
  const center=async id=>{const r=await p.getByTestId(id).boundingBox();return {x:r.x+r.width/2,y:r.y+r.height/2};};
  const read=()=>p.getByTestId('layout-snap-readout').evaluate(e=>({status:e.dataset.status,horizontal:Number(e.dataset.horizontalDistance),vertical:Number(e.dataset.verticalDistance),text:e.textContent}));
  const h=await center('handle');
  await p.mouse.move(h.x,h.y);await p.mouse.down();await p.mouse.move(h.x+100,h.y+35);await advance(2);
  const immediateDrag=await read();
  await p.mouse.up();await advance(2);
  const shift=await center('layout-shift-button');await p.mouse.move(shift.x,shift.y);await p.mouse.down();await p.mouse.up();await advance(50);
  const slot=await p.getByTestId('slot').evaluate(e=>e.offsetLeft);
  await p.mouse.move(h.x,h.y);await p.mouse.down();await advance(2);const afterLayout=await read();await p.mouse.up();await advance(2);
  const handleStillClickable=await p.getByTestId('handle').evaluate(e=>{const r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e;});
  await p.mouse.move(h.x,h.y);await p.mouse.down();await advance(2);const third=await read();await p.mouse.up();await advance(2);
  console.log(JSON.stringify({slot,immediateDrag,afterLayout,handleStillClickable,third}));
  await p.screenshot({path:'/tmp/layout-snap-verified-page.png'});
  if(slot!==360||immediateDrag.status!=='pass'||afterLayout.status!=='pass'||!handleStillClickable||third.status!=='pass'||!third.text.includes('Snap 3:'))process.exitCode=1;
 } finally {await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
