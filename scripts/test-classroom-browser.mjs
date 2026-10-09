// Run against `wrangler dev` with .dev.vars test credentials. Never target production.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {encryptKeyFile} from '../assets/js/labs/inequality-review-keyfile.mjs';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.CLASSROOM_TEST_URL || 'http://127.0.0.1:8787';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname), 'Browser tests may only write to a local preview.');
const password = process.env.CLASSROOM_TEST_PASSWORD || 'classroom-local-check';
const browser = await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL || 'chrome'});
const errors = [], ids = [];
let auth = {}, currentPassword = password;
const fixtureKey = 'sk-unified-browser-fixture';
const keyFile = await encryptKeyFile(fixtureKey,'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',password);
try {
  await mkdir('docs/qa',{recursive:true});
  const desktop = await browser.newPage({viewport:{width:1440,height:950}});
  desktop.on('pageerror',e=>errors.push(e.message));
  await desktop.route('**/inequality-review.html',async route => {
    const response=await route.fetch();
    await route.fulfill({response,body:(await response.text()).replace(/^const EMBEDDED_KEY_FILE = .*;$/m,()=>`const EMBEDDED_KEY_FILE = ${JSON.stringify(keyFile)};`)});
  });
  const openAlbum = async () => {
    await desktop.locator('#classroom-photo-tab').click();
    await desktop.locator('#key-file-password').fill(currentPassword);
    await desktop.locator('#submit-key-unlock').click();
    await desktop.locator('#classroom-qr canvas').waitFor();
  };
  await desktop.goto(base+'/labs/algebra/inequality-review.html'); await openAlbum();
  assert.equal(await desktop.evaluate(()=>window.inequalityReviewAPI.configured),true);
  const loggedIn=await (await fetch(base+'/api/classroom/bootstrap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})})).json();
  auth={Authorization:'Bearer '+loggedIn.token};
  await desktop.screenshot({path:'docs/qa/classroom-empty-desktop.png',fullPage:true});
  const mobileContext = await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const mobile = await mobileContext.newPage(); mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.goto(await desktop.locator('#classroom-link-fallback').inputValue());
  await mobile.waitForFunction(()=>!document.getElementById('capture-camera-button').disabled);
  assert.equal(await mobile.locator('#capture-camera-input').getAttribute('capture'),'environment');
  const picture = await mobile.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width=1200; canvas.height=850;
    const c=canvas.getContext('2d'); c.fillStyle='#fffef9'; c.fillRect(0,0,1200,850);
    c.strokeStyle='#dce6f1'; c.lineWidth=2;
    for(let y=95;y<850;y+=90) {c.beginPath();c.moveTo(0,y);c.lineTo(1200,y);c.stroke();}
    c.fillStyle='#263f6a'; c.font='42px sans-serif';c.fillText('三角不等式 · 测试作品',65,75);
    c.font='italic 54px serif';c.fillText('|2x − 1| + |x + 2| ≥ |3x + 1|',65,235);
    c.font='38px sans-serif';c.fillText('由 |a| + |b| ≥ |a + b|，',65,410);c.fillText('令 a = 2x − 1，b = x + 2，即得。',65,500);
    c.fillText('当 (2x − 1)(x + 2) ≥ 0 时等号成立。',65,680);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  let loseResponse = true;
  await mobile.route('**/api/classroom/photos',async route => {
    if (route.request().method()==='POST' && loseResponse) {loseResponse=false;await route.fetch();await route.abort('failed');}
    else await route.continue();
  });
  for(let i=1;i<=6;i++) {
    await mobile.locator('#capture-label').fill(`测试第 ${i} 组`);
    await mobile.locator('#capture-album-input').setInputFiles({name:'classroom.png',mimeType:'image/png',buffer:Buffer.from(picture,'base64')});
    if(i===1) {await mobile.locator('#capture-retry').waitFor({state:'visible'}); await mobile.locator('#capture-retry').click();}
    await mobile.waitForFunction(index=>document.getElementById('capture-transfer').dataset.state==='success' && document.getElementById('capture-transfer-detail').textContent.includes(`测试第 ${index} 组`),i);
    await mobile.waitForFunction(()=>!document.getElementById('capture-camera-button').disabled);
  }
  const list = await (await fetch(base+'/api/classroom/photos',{headers:auth})).json();
  for(const p of list.photos) if(p.label.startsWith('测试第 ')) ids.push(p.id);
  assert.equal(ids.length,6,'retry must not create a duplicate');
  await mobile.screenshot({path:'docs/qa/classroom-upload-mobile.png',fullPage:true});
  await desktop.bringToFront();
  await desktop.waitForFunction(()=>document.querySelectorAll('.classroom-photo').length>=6);
  await desktop.locator('.classroom-photo').first().click();
  await desktop.waitForFunction(()=>!document.getElementById('generate-button').disabled);
  await desktop.screenshot({path:'docs/qa/classroom-gallery-desktop.png',fullPage:true});
  await desktop.locator('#classroom-preview').click(); await desktop.locator('#classroom-full-photo').waitFor({state:'visible'});
  assert.ok(await desktop.locator('#classroom-full-photo').evaluate(img=>img.complete && img.naturalWidth>0));
  await desktop.locator('#classroom-preview-close').click();
  let aiCalls=0;
  await desktop.route('https://dashscope.aliyuncs.com/**',async route => {
    aiCalls++;
    const value = aiCalls%2 ? {status:'readable',formula:'|2x−1|+|x+2|≥|3x+1|',reasoning:'由三角不等式得证。',issue:''} : {
      status:'valid',formula:'|2x−1|+|x+2|≥|3x+1|',verdict:'结论成立，论证清楚。',
      scientific:{grade:'A',comment:'正确运用了三角不等式。'},rigor:{grade:'A',comment:'推导完整，取等条件正确。'},creativity:{grade:'B',comment:'构造了有意义的变式。'},highlight:'变量代换清楚。',suggestion:'继续尝试三项之和。'};
    await route.fulfill({contentType:'application/json',body:JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]})});
  });
  assert.equal(await desktop.locator('#key-unlock-dialog').isVisible(),false);
  await desktop.locator('#generate-button').click();
  await desktop.locator('#result-screen').waitFor({state:'visible'});
  await desktop.waitForFunction(()=>!document.getElementById('history-button').disabled);
  assert.equal(aiCalls,2); assert.equal(await desktop.locator('#scientific-grade').textContent(),'A');
  const after = await (await fetch(base+'/api/classroom/photos',{headers:auth})).json(); assert.ok(after.photos[0].reviewedAt);
  await desktop.locator('#restart-button').click();
  await desktop.locator('#classroom-pending-only').check();
  await desktop.waitForFunction(()=>document.querySelectorAll('.classroom-photo').length===5);
  await desktop.locator('#classroom-pending-only').uncheck();
  for (const viewport of [{width:1280,height:720},{width:390,height:844}]) {
    await desktop.setViewportSize(viewport);
    await desktop.waitForFunction(()=>Array.from(document.querySelectorAll('.classroom-thumbnail img')).every(img=>img.complete && img.naturalWidth>0));
    assert.ok(await desktop.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'horizontal overflow');
    await desktop.screenshot({path:`docs/qa/classroom-gallery-${viewport.width}.png`,fullPage:true});
  }
  await desktop.setViewportSize({width:1440,height:950});
  await desktop.locator('.classroom-photo').first().click(); await desktop.waitForFunction(()=>!document.getElementById('classroom-preview').disabled);
  await desktop.locator('#classroom-delete-selected').click();
  await desktop.locator('#classroom-delete-confirm').waitFor({state:'visible'});
  await desktop.locator('#classroom-delete-cancel').click();
  assert.equal(await desktop.locator('#classroom-delete-confirm').isVisible(),false);
  await desktop.locator('#classroom-preview-close').click();
  assert.equal(await desktop.locator('.classroom-photo').count(),6);
  await desktop.locator('#classroom-delete-selected').click(); await desktop.locator('#classroom-delete-submit').click();
  await desktop.locator('#classroom-preview-dialog').waitFor({state:'hidden'});
  await desktop.reload(); await openAlbum(); await desktop.waitForFunction(()=>document.querySelectorAll('.classroom-photo').length===5);
  await mobileContext.setOffline(true);
  await mobile.locator('#capture-album-input').setInputFiles({name:'offline.png',mimeType:'image/png',buffer:Buffer.from(picture,'base64')});
  await mobile.locator('#capture-retry').waitFor({state:'visible'});
  assert.equal(await mobile.locator('#capture-camera-button').isDisabled(),true);
  await mobile.locator('#capture-discard').click(); await mobileContext.setOffline(false);
  const oldLink=await desktop.locator('#classroom-link-fallback').inputValue();
  await desktop.locator('#connection-label').click(); await desktop.locator('#change-classroom-password').click();
  await desktop.locator('#classroom-current-password').fill(password);
  await desktop.locator('#classroom-new-password').fill('classroom-custom-password');
  await desktop.locator('#classroom-confirm-password').fill('not-the-same-password');
  await desktop.locator('#save-classroom-password').click();
  await desktop.waitForFunction(()=>document.getElementById('classroom-password-message').textContent.includes('不一致'));
  await desktop.locator('#classroom-confirm-password').fill('classroom-custom-password');
  await desktop.screenshot({path:'docs/qa/classroom-password-desktop.png',fullPage:true});
  await desktop.setViewportSize({width:390,height:844});
  assert.ok(await desktop.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
  await desktop.screenshot({path:'docs/qa/classroom-password-mobile.png',fullPage:true});
  await desktop.locator('#save-classroom-password').click();
  await desktop.locator('#classroom-password-dialog').waitFor({state:'hidden'});
  currentPassword='classroom-custom-password';
  const login=async value => fetch(base+'/api/classroom/bootstrap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:value})});
  assert.equal((await login(password)).status,401);
  assert.equal((await fetch(base+'/api/classroom/photos',{headers:auth})).status,401);
  const newLogin=await login(currentPassword); assert.equal(newLogin.status,200);
  const newSession=await newLogin.json(); auth={Authorization:'Bearer '+newSession.token};
  assert.notEqual(await desktop.locator('#classroom-link-fallback').inputValue(),oldLink);
  assert.equal(await desktop.evaluate(()=>window.inequalityReviewAPI.configured),true);
  await desktop.reload();
  await desktop.locator('#connection-label').click(); await desktop.locator('#unlock-site-key').click();
  await desktop.locator('#key-file-password').fill(currentPassword); await desktop.locator('#submit-key-unlock').click();
  await desktop.locator('#key-unlock-dialog').waitFor({state:'hidden'}); await desktop.locator('#close-api-settings').click();
  await desktop.locator('#classroom-photo-tab').click(); await desktop.locator('#classroom-qr canvas').waitFor();
  assert.equal(await desktop.locator('#key-unlock-dialog').isVisible(),false);
  await desktop.waitForFunction(()=>document.querySelectorAll('.classroom-photo').length===5);
  // Restore fixture credentials for another run; no production endpoint is permitted.
  const restored=await fetch(base+'/api/classroom/password',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({currentPassword,newPassword:password,keyFile})});
  assert.equal(restored.status,200); auth={Authorization:'Bearer '+(await restored.json()).token};
  assert.deepEqual(errors,[]);
  console.log('PASS: separate phone/desktop sessions; lost-response retry; compression; auto-refresh; preview; mocked AI evaluation; reviewed filter; deletion; reload persistence; offline recovery; responsive layout; shared AI/album unlock; password mismatch; password rotation; old token revocation; fresh-page login with new password.');
} finally {
  for(const id of ids) await fetch(base+'/api/classroom/photos/'+id,{method:'DELETE',headers:auth});
  await browser.close();
}
