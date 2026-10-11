/* Bake the camera's EXIF orientation once, then rotate in pixel coordinates. */
(() => {
  'use strict';
  async function transform(blob, rotation = 0, {edge = 4096, type = blob.type} = {}) {
    if (![0,90,180,270].includes(rotation)) throw new Error('图片旋转角度无效。');
    let bitmap, url;
    try {
      if (window.createImageBitmap) bitmap = await createImageBitmap(blob,{imageOrientation:'from-image'});
      else {
        url=URL.createObjectURL(blob); bitmap=new Image(); bitmap.src=url; await bitmap.decode();
      }
      const width=bitmap.naturalWidth || bitmap.width, height=bitmap.naturalHeight || bitmap.height;
      if (!width || !height || width*height>60e6) throw new Error('图片分辨率过大，请选择普通照片。');
      const scale=Math.min(1,edge/Math.max(width,height));
      const w=Math.max(1,Math.round(width*scale)), h=Math.max(1,Math.round(height*scale));
      const canvas=document.createElement('canvas'), swap=rotation%180!==0;
      canvas.width=swap?h:w; canvas.height=swap?w:h;
      const ctx=canvas.getContext('2d');
      if (!ctx) throw new Error('浏览器无法处理图片，请换用系统浏览器。');
      ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(rotation*Math.PI/180);
      ctx.drawImage(bitmap,-w/2,-h/2,w,h);
      const encode=media=>new Promise(resolve=>canvas.toBlob(resolve,media,.96));
      let output=await encode(type==='image/jpeg'?'image/jpeg':'image/png');
      if (output?.size>10*1024*1024) output=await encode('image/jpeg');
      canvas.width=canvas.height=1;
      if (!output || output.size>10*1024*1024) throw new Error('转正后的图片超过 10 MB，请选择较小的图片。');
      return output;
    } finally { bitmap?.close?.(); if(url) URL.revokeObjectURL(url); }
  }
  window.InequalityImages=Object.freeze({transform});
})();
