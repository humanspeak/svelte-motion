const { chromium } = require('/Users/jasonkummerl/Github/svelte-motion-transform-page-point/node_modules/@playwright/test');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({headless:true});
  const report = {};
  try {
    for (const [name,url] of Object.entries({svelte:'http://127.0.0.1:4198/tests/drag/controls?@isPlaywright=true',react:'http://127.0.0.1:4299/controls.html'})) {
      const page = await browser.newPage({viewport:{width:1280,height:720}});
      await page.goto(url);
      const el=page.getByTestId('drag-controls-initial');
      const h=page.getByTestId('initial-handle');
      await el.waitFor();
      await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      const sessions=[];
      for(let i=0;i<3;i++) {
        const handle=await h.boundingBox();
        const start={x:handle.x+handle.width/2,y:handle.y+handle.height/2};
        const hit=await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.getAttribute('data-testid'),start);
        if(hit!=='initial-handle')throw Error(`${name} session ${i} input occluded by ${hit}`);
        const before=await el.boundingBox();
        await page.mouse.move(start.x,start.y); await page.mouse.down();
        await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
        const snapped=await el.boundingBox();
        await page.mouse.move(start.x+150,start.y+50,{steps:5});
        await page.waitForTimeout(50);
        const active=await el.boundingBox();
        await page.mouse.up(); await page.waitForTimeout(100);
        sessions.push({start,hit,before,snapped,active,ended:await el.boundingBox()});
      }
      report[name]=sessions;
      await page.close();
    }
    fs.writeFileSync('/tmp/controls-repeat-red-input-probe.json',JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
