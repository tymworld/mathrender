// Visual layout regression with local synthetic records; no cloud or AI calls.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({headless:true,channel:'chrome'});
const viewports = [[1920,1080],[1440,900],[1366,768],[1280,720],[1024,600],[960,540],[820,600],[390,844]];
const result = {status:'valid',formula:'|2x − 1| + |x + 2| ≥ |3x + 1|\n等号成立当且仅当 x ≤ −2 或 x ≥ 1/2。',verdict:'结论与取等条件成立。',
  scientific:{grade:'A',comment:'由三角不等式可知结论对任意实数成立，取等条件也与原式一致。'},
  rigor:{grade:'A',comment:'写出了代换、推导及取等条件，论证完整。注意明确说明两个代数式同号或至少一个为零。'},
  creativity:{grade:'B',comment:'通过两个一次式构造了新的不等式，体现了有效的变式意识。'},
  highlight:'将含绝对值的一次式与三角不等式联系起来，表达清楚，推导有依据。',
  suggestion:'尝试把两个一次式换为 ax+b 与 cx+d，讨论不同参数下等号成立的范围，并说明所得结论与本题之间的联系。'};
try {
  await mkdir('docs/qa',{recursive:true});
  const page=await browser.newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.route(/^https?:/,route=>route.abort());
  const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  async function check(name,selectors,desktop=true) {
    await settle();
    const size=page.viewportSize();
    const layout=await page.evaluate(selectors=>({
      width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,
      boxes:selectors.map(selector=>{const el=document.querySelector(selector);return {selector,...el.getBoundingClientRect().toJSON()};})
    }),selectors);
    assert(layout.width<=size.width+1,`${name} horizontal overflow at ${size.width}: ${layout.width}`);
    if(desktop && size.width>760) {
      assert(layout.height<=size.height+1,`${name} page height ${layout.height} exceeds ${size.height} at ${size.width}`);
      for(const box of layout.boxes) assert(box.top>=-1&&box.bottom<=size.height+1&&box.left>=-1&&box.right<=size.width+1,`${name} clipped ${box.selector} at ${size.width}×${size.height}: ${JSON.stringify(box)}`);
    }
    if(['upload-1280','upload-390','review-1280','review-390','review-960','review-long-960','album-1280','album-960'].includes(`${name}-${size.width}`)) await page.screenshot({path:`docs/qa/inequality-${name}-${size.width}.png`,fullPage:true});
  }
  for(const [width,height] of viewports) {
    await page.setViewportSize({width,height});
    await page.goto(new URL('../labs/algebra/inequality-review.html',import.meta.url).href);
    await check('upload',['#upload-title','#upload-button','#generate-button','.dimension-legend','.privacy-note','.upload-footer']);
    const picture=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=600;c.height=400;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,600,400);x.fillStyle='#28588b';x.font='30px serif';x.fillText('|a| + |b| ≥ |a+b|',100,190);return c.toDataURL('image/png');});
    await page.locator('#photo-input').setInputFiles({name:'手写作品.png',mimeType:'image/png',buffer:Buffer.from(picture.split(',')[1],'base64')});
    await check('selected',['#photo-preview','#generate-button','.privacy-note']);
    await page.evaluate(async ({result,picture})=>{
      const photo=await (await fetch(picture)).blob();
      await window.inequalityReviewHistory.save(result,{photo,model:'qwen3.8-max'});
    },{result,picture});
    await page.locator('#history-button').click();
    await page.locator('.history-entry').first().getByRole('button',{name:'查看评价',exact:true}).click();
    await check('review',['.evaluation-card','#card-title','#formula','#scientific-comment','#suggestion','#restart-button']);
    if(width>760) {
      await page.locator('#review-reading-toggle').click();
      assert.equal(await page.locator('#review-reading-toggle').textContent(),'一屏显示');
      await page.locator('#review-reading-toggle').click();
      await check('review',['.evaluation-card']);
      // Exercise supported maximum-size feedback without cutting off any text.
      await page.evaluate(()=>{
        for(const id of ['scientific-comment','rigor-comment','creativity-comment','highlight']) document.getElementById(id).textContent='保留全部数学依据与原文条件，逐步核验论证。'.repeat(14);
        document.getElementById('suggestion').textContent='请写出完整的代数推导，检查所有变量的定义域和取等条件，并用新的例子验证推广的适用范围。'.repeat(17);
        dispatchEvent(new Event('resize'));
      });
      await check('review-long',['.evaluation-card','#suggestion','#review-reading-toggle']);
    }
    await page.locator('#restart-button').click();
    await page.locator('#classroom-photo-tab').click();
    // Local file mode has no backend: populate only the gallery layout fixture.
    await page.evaluate(picture=>{
      document.getElementById('classroom-unavailable').hidden=true;
      document.getElementById('classroom-workspace').hidden=false;
      document.getElementById('classroom-empty').hidden=true;
      document.getElementById('classroom-photo-grid').hidden=false;
      document.getElementById('classroom-sync').hidden=true;
      document.getElementById('classroom-total').textContent='24 张作品';
      const grid=document.getElementById('classroom-photo-grid');grid.replaceChildren();
      for(let i=0;i<24;i++) {
        const button=document.createElement('button');button.className='classroom-photo';
        const thumb=document.createElement('span');thumb.className='classroom-thumbnail';
        const img=document.createElement('img');img.src=picture;thumb.append(img);
        const meta=document.createElement('span');meta.className='classroom-photo-meta';meta.textContent=`作品 ${i+1} · 刚刚上传`;button.append(thumb,meta);grid.append(button);
      }
    },picture);
    await check('album',['.classroom-qr','#classroom-copy-link','#classroom-photo-grid','.upload-actions']);
    if(width>760) {
      assert(await page.locator('#classroom-photo-grid').evaluate(el=>el.scrollHeight>el.clientHeight),'Long album must scroll within the gallery');
      assert(await page.evaluate(()=>document.querySelector('.classroom-pairing').getBoundingClientRect().bottom <= document.querySelector('.upload-actions').getBoundingClientRect().top+1),'QR panel must not overlap generation controls');
    }
    console.log(`PASS: ${width}×${height} upload, selected photo, review, long review and album layout.`);
  }
  assert.deepEqual(errors,[]);
} finally { await browser.close(); }
