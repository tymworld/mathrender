// Real browser decoding verifies all eight EXIF orientations and pixel rotation.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
  const page=await browser.newPage();
  await page.goto(new URL('../labs/algebra/inequality-review.html',import.meta.url).href);
  const observations=await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=120;canvas.height=80;
    const ctx=canvas.getContext('2d');
    for(const [color,x,y] of [['#e00000',0,0],['#00b400',60,0],['#0000e0',0,40],['#e0e000',60,40]]) {ctx.fillStyle=color;ctx.fillRect(x,y,60,40);}
    const jpeg=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',1));
    const bytes=new Uint8Array(await jpeg.arrayBuffer()), rows=[];
    const observe=async blob=>{
      const image=await createImageBitmap(blob); const sample=document.createElement('canvas');sample.width=image.width;sample.height=image.height;
      const context=sample.getContext('2d');context.drawImage(image,0,0);const pixel=Array.from(context.getImageData(10,10,1,1).data).slice(0,3);
      const value={width:image.width,height:image.height,pixel};image.close();return value;
    };
    for(let orientation=1;orientation<=8;orientation++) {
      const exif=new Uint8Array([255,225,0,34,69,120,105,102,0,0,73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,orientation,0,0,0,0,0,0,0]);
      const blob=new Blob([bytes.slice(0,2),exif,bytes.slice(2)],{type:'image/jpeg'});
      const normalized=await window.InequalityImages.transform(blob);
      rows.push(await observe(normalized));
      // Re-decoding the normalized pixels must not apply EXIF a second time.
      rows.push(await observe(await window.InequalityImages.transform(normalized)));
    }
    rows.push(await observe(await window.InequalityImages.transform(jpeg,90)));
    rows.push(await observe(await window.InequalityImages.transform(await window.InequalityImages.transform(jpeg,90),270)));
    return rows;
  });
  const colors=[[224,0,0],[0,180,0],[224,224,0],[0,0,224],[224,0,0],[0,0,224],[224,224,0],[0,180,0]];
  for(let i=0;i<8;i++) for(let copy=0;copy<2;copy++) {
    const sample=observations[2*i+copy], swap=i>=4;
    assert.equal(sample.width,swap?80:120);assert.equal(sample.height,swap?120:80);
    assert(sample.pixel.every((value,channel)=>Math.abs(value-colors[i][channel])<15),`EXIF ${i+1} color ${sample.pixel}`);
  }
  assert.equal(observations[16].width,80);assert(observations[16].pixel[2]>200);
  assert.equal(observations[17].width,120);assert(observations[17].pixel[0]>200);
  console.log('PASS: 8 EXIF directions including mirrored photos; no double rotation; 90° rotation and undo preserve pixel positions.');
} finally { await browser.close(); }
