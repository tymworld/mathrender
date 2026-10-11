// Local-only integration: real history storage, synthetic photo-date fixtures, no AI calls.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.CLASSROOM_TEST_URL || 'http://127.0.0.1:8788';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const browser=await chromium.launch({headless:true,channel:'chrome'});
const ids=[],errors=[];
let headers;
try {
  const login=await fetch(base+'/api/classroom/bootstrap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'classroom-local-check'})});
  assert.equal(login.status,200);headers={Authorization:'Bearer '+(await login.json()).token,'Content-Type':'application/json'};
  const context=await browser.newContext({viewport:{width:1440,height:950},timezoneId:'America/Los_Angeles'});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-10-11T00:30:00+08:00'));
  let aiCalls=0;await page.route('https://dashscope.aliyuncs.com/**',route=>{aiCalls++;return route.abort();});
  const images=await page.evaluate(()=>['#fefdf8','#eaf2ff'].map(color=>{
    const canvas=document.createElement('canvas');canvas.width=700;canvas.height=420;
    const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,700,420);
    ctx.fillStyle='#285184';ctx.font='36px serif';ctx.fillText('|a| + |b| ≥ |a + b|',70,180);
    return canvas.toDataURL('image/png');
  }));
  const makeEntry=(i,model='qwen3.8-max')=>({id:'card-'+crypto.randomUUID(),createdAt:new Date(Date.UTC(2026,9,10,12,i)).toISOString(),model,promptTitle:'V2 · 数学核验加强版',promptVersion:'math-check-v2',result:{status:'valid',formula:'|a| + |b| ≥ |a + b|',verdict:`第 ${i+1} 次评价。`,scientific:{grade:'A',comment:'结论正确。'},rigor:{grade:i%2?'B':'A',comment:'核对推导与取等条件。'},creativity:{grade:'B',comment:'有效变式。'},highlight:'表达清楚。',suggestion:'补充完整推导。'}});
  const models=['qwen3.8-max','qwen3.8-max','qwen3.8-flash','qwen3.7-plus','qwen3.8-max'];
  const records=[];
  for(let i=0;i<7;i++) {
    const entry=makeEntry(i,models[i] || 'qwen3.8-max');
    if(i>=5) entry.createdAt=new Date(Date.UTC(2026,9,9,12,i)).toISOString();
    records.push(entry);ids.push(entry.id);
    const response=await fetch(base+'/api/classroom/history',{method:'POST',headers,body:JSON.stringify({entry,image:i===6?null:images[i===5?1:0]})});assert.equal(response.status,201);
  }
  await page.goto(base+'/labs/algebra/inequality-review');
  await page.locator('#history-button').click();await page.locator('#history-unlock').click();
  await page.locator('#key-file-password').fill('classroom-local-check');await page.locator('#submit-key-unlock').click();
  await page.waitForFunction(()=>document.querySelectorAll('.history-group').length===3);
  assert.equal(await page.locator('#history-count').textContent(),'3 组作品 · 7 次评价');
  const group=page.locator('.history-group').filter({hasText:'同图评价 · 5 次'});
  assert.equal(await group.locator('.history-entry').count(),3);
  assert.deepEqual(await group.locator('.history-model').allTextContents(),['qwen3.8-max','qwen3.7-plus','qwen3.8-flash']);
  await page.screenshot({path:'docs/qa/history-grouped-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert(await page.locator('#history-list').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await page.screenshot({path:'docs/qa/history-grouped-mobile.png',fullPage:true});
  await group.getByRole('button',{name:'展开其余 2 次评价'}).click();assert.equal(await group.locator('.history-entry').count(),5);
  const chosen=page.locator(`[data-entry-id="${records[3].id}"]`);
  await chosen.getByRole('button',{name:'查看评价',exact:true}).click();
  await page.locator('#result-screen').waitFor({state:'visible'});
  assert.equal(await page.locator('#verdict').textContent(),'第 4 次评价。');
  assert((await page.locator('.card-model').textContent()).includes('qwen3.7-plus'));
  await page.locator('#review-history-button').click();await page.locator('.history-group-more').waitFor();
  await page.locator('.history-group-more').click();
  await page.locator(`[data-entry-id="${records[1].id}"]`).getByRole('button',{name:'删除',exact:true}).click();await page.locator('#confirm-history-delete').click();
  await page.waitForFunction(()=>document.getElementById('history-count').textContent==='3 组作品 · 6 次评价');
  assert.equal(await group.count(),0);
  assert.equal(await page.locator('.history-group').filter({hasText:'同图评价 · 4 次'}).count(),1);
  // Raw old local records have no fingerprint and must be grouped on first read.
  const local=[makeEntry(20),makeEntry(21),makeEntry(22)];
  await page.evaluate(async ({entries,images})=>{
    const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('mathrender-inequality-history',1);req.onupgradeneeded=()=>{req.result.createObjectStore('cards',{keyPath:'id'});req.result.createObjectStore('photos',{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const blobs=await Promise.all(images.map(async image=>(await fetch(image)).blob()));
    await new Promise((resolve,reject)=>{const tx=db.transaction(['cards','photos'],'readwrite');entries.forEach((entry,i)=>{tx.objectStore('cards').put(entry);tx.objectStore('photos').put({id:entry.id,blob:blobs[i===2?1:0]});});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
  },{entries:local,images});
  await page.locator('#history-local-tab').click();
  await page.waitForFunction(()=>document.getElementById('history-count').textContent==='2 组作品 · 3 次评价');
  await page.locator('#close-history').click();await page.locator('#restart-button').click();
  const dates=['2026-10-11T00:15:00+08:00','2026-10-11T00:05:00+08:00','2026-10-10T23:59:00+08:00','2026-10-09T16:00:00+08:00'];
  const photos=dates.map((createdAt,i)=>({id:crypto.randomUUID(),label:'日期测试作品 '+(i+1),createdAt,reviewedAt:i===2?'2026-10-10T16:01:00Z':null,rotation:0}));
  await page.route('**/api/classroom/photos',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({photos})}));
  await page.route(/\/api\/classroom\/photos\/[^/]+\/(thumbnail|image)$/,route=>route.fulfill({contentType:'image/png',body:Buffer.from(images[0].split(',')[1],'base64')}));
  await page.setViewportSize({width:1440,height:950});await page.locator('#classroom-photo-tab').click();
  await page.waitForFunction(()=>document.querySelectorAll('.classroom-photo').length===2);
  assert.equal(await page.locator('#classroom-total').textContent(),'今天 2 张');
  assert.deepEqual(await page.locator('.classroom-photo-meta strong').allTextContents(),['日期测试作品 1','日期测试作品 2']);
  assert(!(await page.locator('.classroom-gallery').innerText()).includes('每一个数学想法'));
  assert(!(await page.locator('.classroom-gallery').innerText()).includes('自动更新'));
  await page.screenshot({path:'docs/qa/classroom-today-desktop.png',fullPage:true});
  await page.locator('#classroom-past-toggle').click();
  assert.equal(await page.locator('#classroom-total').textContent(),'往日 2 张');
  await page.locator('#classroom-date').selectOption('2026-10-09');
  assert.deepEqual(await page.locator('.classroom-photo-meta strong').allTextContents(),['日期测试作品 4']);
  await page.locator('#classroom-date').selectOption('2026-10-10');await page.locator('#classroom-pending-only').check();
  assert.equal(await page.locator('.classroom-photo').count(),0);assert(await page.locator('#classroom-empty').isVisible());
  await page.locator('#classroom-pending-only').uncheck();
  await page.locator('.classroom-photo').click();await page.waitForFunction(()=>!document.getElementById('generate-button').disabled);
  await page.locator('#classroom-past-toggle').click();assert(await page.locator('#generate-button').isDisabled());
  assert.equal(await page.locator('.classroom-photo').count(),2);
  await page.setViewportSize({width:390,height:844});await page.locator('#classroom-past-toggle').click();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('.classroom-thumbnail img')).every(img=>img.complete&&img.naturalWidth>0));
  await page.screenshot({path:'docs/qa/classroom-past-mobile.png',fullPage:true});
  assert.equal(aiCalls,0);assert.deepEqual(errors,[]);
  console.log('PASS: grouped cloud and legacy local histories; model labels; expand/collapse; independent view/delete; distinct images and missing originals; desktop/mobile layout; Shanghai today boundary; past date filter; pending-only filter; selection cleared when changing days; no AI calls.');
} finally {
  if(headers) for(const id of ids) await fetch(base+'/api/classroom/history/'+id,{method:'DELETE',headers});
  await browser.close();
}
