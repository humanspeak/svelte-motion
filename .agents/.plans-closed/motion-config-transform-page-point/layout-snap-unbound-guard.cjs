const { chromium } = require('/Users/jasonkummerl/Github/svelte-motion-transform-page-point/node_modules/@playwright/test');
const { compile } = require('/Users/jasonkummerl/Github/svelte-motion-transform-page-point/node_modules/svelte/compiler');
const host = 'http://127.0.0.1:5188';
const dist = host + '/@fs/Users/jasonkummerl/Github/svelte-motion-transform-page-point/dist/';
(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    for (const initial of [{x:0,y:0},{x:100,y:40}]) {
      const page = await browser.newPage({viewport:{width:1000,height:800}});
      await page.goto(host+'/examples/transform-page-point');
      const urls = await page.evaluate(()=>performance.getEntriesByType('resource').map(x=>x.name));
      const deps = {'@humanspeak/svelte-motion':dist+'index.js'};
      for (const [name,file] of Object.entries({'svelte':'svelte','svelte/internal/client':'svelte_internal_client','svelte/internal/disclose-version':'svelte_internal_disclose-version'})) {
        deps[name] = urls.find(u=>u.includes('/.vite/deps/'+file+'.js')) || host+'/node_modules/.vite/deps/'+file+'.js';
      }
      const source = `<script>import {motion,createDragControls} from '@humanspeak/svelte-motion';let shifted=$state(false);const controls=createDragControls();</script><div style="position:fixed;inset:0;background:white;z-index:999999"><button data-testid="snap" style="position:absolute;left:100px;top:100px;z-index:1" onpointerdown={e=>controls.start(e,{snapToCursor:true})}>Snap</button><button data-testid="shift" style="position:absolute;left:400px;top:50px" onclick={()=>shifted=!shifted}>Shift</button><div style:margin-left={shifted?'60px':'0px'} style="position:absolute;top:300px;left:300px"><motion.div layout drag dragControls={controls} dragListener={false} dragMomentum={false} initial={${JSON.stringify(initial)}} data-testid="probe" style="width:80px;height:80px;background:red"/></div></div>`;
      const code = compile(source,{generate:'client',dev:false}).js.code.replace(/(from\s*|import\s*)(['"])([^'"]+)\2/g,(full,p,q,path)=>p+q+(deps[path]||path)+q);
      await page.route('**/__layout_snap_guard.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:code}));
      await page.evaluate(async sv=>{const m=await import('/__layout_snap_guard.js'),s=await import(sv);const target=document.createElement('div');document.body.append(target);s.mount(m.default,{target});},deps.svelte);
      await page.waitForTimeout(500);
      const center=async id=>{const b=await page.getByTestId(id).boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2}};
      const pointer=await center('snap');
      const snaps=[];
      for (let i=0;i<3;i++) {
        const hit=await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.getAttribute('data-testid'),pointer);if(hit!=='snap')throw new Error('Snap control is obstructed');
        await page.mouse.move(pointer.x,pointer.y);await page.mouse.down();await page.waitForTimeout(80);
        snaps.push(await center('probe'));
        if(i===0) await page.mouse.move(pointer.x+150,pointer.y+50,{steps:8});
        await page.mouse.up();await page.waitForTimeout(300);
        if(i===0){await page.getByTestId('shift').click();await page.waitForTimeout(700);}
      }
      console.log(JSON.stringify({initial,pointer,snaps}));
      if(snaps.some(p=>Math.abs(p.x-pointer.x)>2||Math.abs(p.y-pointer.y)>2)) process.exitCode=1;
      await page.close();
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
