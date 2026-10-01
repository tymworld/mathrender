const canvas=document.querySelector('#board'),ctx=canvas.getContext('2d');
    const ui={stageNum:document.querySelector('#stageNum'),stageInline:document.querySelector('#stageInline'),range:document.querySelector('#stageRange'),rangeValue:document.querySelector('#rangeValue'),orientation:document.querySelector('#orientation'),sum:document.querySelector('#sumValue'),rest:document.querySelector('#restValue'),sumDecimal:document.querySelector('#sumDecimal'),restDecimal:document.querySelector('#restDecimal'),bar:document.querySelector('#sumbar'),play:document.querySelector('#playBtn'),status:document.querySelector('#status'),zoom:document.querySelector('#zoomBtn'),restoreView:document.querySelector('#restoreViewBtn')};
    const colors=['#1f5aa6','#126e58','#9b4d19','#a23555','#644699','#22667e','#397032','#855018','#72418b','#245c52'];
    const MIN_ZOOM=.35,MAX_ZOOM=1600;
    let stage=0,speed=1,timer=null,pieceProgress=1,pieceFrame=0,cameraFrame=0,drag=null;
    const camera={zoom:1,x:.5,y:.5};
    function fraction(k){if(k===0)return'0';const d=2**k;return`${d-1}/${d}`}
    function decimal(value,k){const digits=Math.min(8,Math.max(4,Math.ceil(k*.31)+2));return value.toFixed(digits)}
    function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);ctx.setTransform(d,0,0,d,0,0);draw()}
    function viewMetrics(){const w=canvas.clientWidth,h=canvas.clientHeight,size=Math.max(80,Math.min(w-90,h-105));return{w,h,size,ox:(w-size)/2,oy:(h-size)/2-10,screenX:w/2,screenY:h/2-10}}
    function geometry(n){let rem={x:0,y:0,w:1,h:1},pieces=[];for(let i=1;i<=n;i++){let piece;if(i%2===1){piece={x:rem.x,y:rem.y,w:rem.w/2,h:rem.h};rem={x:rem.x+rem.w/2,y:rem.y,w:rem.w/2,h:rem.h}}else{piece={x:rem.x,y:rem.y,w:rem.w,h:rem.h/2};rem={x:rem.x,y:rem.y+rem.h/2,w:rem.w,h:rem.h/2}}pieces.push(piece)}return{pieces,rem}}
    function draw(){
      const {w,h,size,ox,oy,screenX,screenY}=viewMetrics();
      ctx.clearRect(0,0,w,h);ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--card');ctx.fillRect(0,0,w,h);
      const {pieces,rem}=geometry(stage),z=camera.zoom,cameraX=ox+camera.x*size,cameraY=oy+camera.y*size;
      ctx.save();ctx.translate(screenX,screenY);ctx.scale(z,z);ctx.translate(-cameraX,-cameraY);ctx.translate(ox,oy);
      ctx.fillStyle='#fffdf1';ctx.fillRect(0,0,size,size);
      pieces.forEach((p,i)=>{
        ctx.globalAlpha=i===pieces.length-1?pieceProgress:1;ctx.fillStyle=colors[i%colors.length];ctx.fillRect(p.x*size,p.y*size,p.w*size,p.h*size);ctx.globalAlpha=1;
        ctx.strokeStyle='#fff';ctx.lineWidth=2/z;ctx.strokeRect(p.x*size,p.y*size,p.w*size,p.h*size);
        const pw=p.w*size,ph=p.h*size,screenMin=Math.min(pw,ph)*z;
        if(screenMin>46){const fontPx=Math.min(34,Math.max(17,screenMin*.27));ctx.fillStyle='#fff';ctx.font=`700 ${fontPx/z}px Georgia`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(`1/${2**(i+1)}`,p.x*size+pw/2,p.y*size+ph/2)}
      });
      ctx.fillStyle='#fff8d6';ctx.fillRect(rem.x*size,rem.y*size,rem.w*size,rem.h*size);ctx.strokeStyle='#d0712f';ctx.lineWidth=3/z;ctx.strokeRect(rem.x*size,rem.y*size,rem.w*size,rem.h*size);
      const remScreenMin=Math.min(rem.w,rem.h)*size*z;
      if(remScreenMin>48){const fontPx=Math.min(28,Math.max(18,remScreenMin*.24));ctx.fillStyle='#8b4b19';ctx.font=`700 ${fontPx/z}px Georgia`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(`R=${stage?`1/${2**stage}`:'1'}`,rem.x*size+rem.w*size/2,rem.y*size+rem.h*size/2)}
      ctx.strokeStyle='#16324f';ctx.lineWidth=3/z;ctx.strokeRect(0,0,size,size);
      if(stage<20){const next=stage+1;ctx.setLineDash([7/z,7/z]);ctx.strokeStyle='#2364aa';ctx.lineWidth=2/z;if(next%2===1){const x=(rem.x+rem.w/2)*size;ctx.beginPath();ctx.moveTo(x,rem.y*size);ctx.lineTo(x,(rem.y+rem.h)*size);ctx.stroke()}else{const y=(rem.y+rem.h/2)*size;ctx.beginPath();ctx.moveTo(rem.x*size,y);ctx.lineTo((rem.x+rem.w)*size,y);ctx.stroke()}ctx.setLineDash([])}
      ctx.restore();
    }
    function update(){const taken=1-2**(-stage),rest=2**(-stage);ui.stageNum.textContent=ui.stageInline.textContent=ui.rangeValue.textContent=stage;ui.range.value=stage;ui.orientation.textContent=stage===0?'准备第一次竖切':stage%2?'竖着取半':'横着取半';ui.sum.textContent=fraction(stage);ui.rest.textContent=stage?`1/${2**stage}`:'1';ui.sumDecimal.textContent=decimal(taken,stage);ui.restDecimal.textContent=decimal(rest,stage);ui.bar.style.width=`${taken*100}%`;draw()}
    function animatePiece(){cancelAnimationFrame(pieceFrame);const start=performance.now();function frame(t){const p=Math.min(1,(t-start)/420);pieceProgress=1-Math.pow(1-p,3);draw();if(p<1)pieceFrame=requestAnimationFrame(frame)}pieceFrame=requestAnimationFrame(frame)}
    function setStage(n,doAnimate=false){stage=Math.max(0,Math.min(20,n));pieceProgress=doAnimate&&stage>0?0:1;update();if(pieceProgress===0)animatePiece()}
    function cancelCameraAnimation(){cancelAnimationFrame(cameraFrame);cameraFrame=0}
    function animateCamera(target,duration=680){cancelCameraAnimation();const from={zoom:camera.zoom,x:camera.x,y:camera.y};if(matchMedia('(prefers-reduced-motion: reduce)').matches){Object.assign(camera,target);draw();return}const start=performance.now();function frame(t){const p=Math.min(1,(t-start)/duration),e=1-Math.pow(1-p,3);camera.zoom=Math.exp(Math.log(from.zoom)+(Math.log(target.zoom)-Math.log(from.zoom))*e);camera.x=from.x+(target.x-from.x)*e;camera.y=from.y+(target.y-from.y)*e;draw();if(p<1)cameraFrame=requestAnimationFrame(frame);else{Object.assign(camera,target);cameraFrame=0;draw()}}cameraFrame=requestAnimationFrame(frame)}
    function zoomToRemainder(){const {rem}=geometry(stage),{w,h,size}=viewMetrics(),availableW=Math.max(140,w-150),availableH=Math.max(140,h-170),fitZoom=Math.min(availableW/(rem.w*size),availableH/(rem.h*size));animateCamera({zoom:Math.min(MAX_ZOOM,Math.max(2,fitZoom)),x:rem.x+rem.w/2,y:rem.y+rem.h/2})}
    function restoreView(){animateCamera({zoom:1,x:.5,y:.5})}
    function beginDrag(e){if(e.button!==0)return;cancelCameraAnimation();drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);canvas.classList.add('dragging')}
    function moveDrag(e){if(!drag||drag.id!==e.pointerId)return;const {size}=viewMetrics(),dx=e.clientX-drag.x,dy=e.clientY-drag.y;camera.x-=dx/(camera.zoom*size);camera.y-=dy/(camera.zoom*size);drag.x=e.clientX;drag.y=e.clientY;draw()}
    function endDrag(e){if(!drag||drag.id!==e.pointerId)return;drag=null;canvas.classList.remove('dragging');if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId)}
    function wheelZoom(e){e.preventDefault();cancelCameraAnimation();const {size,screenX,screenY}=viewMetrics(),r=canvas.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top,unit=e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1,oldZoom=camera.zoom,newZoom=Math.min(MAX_ZOOM,Math.max(MIN_ZOOM,oldZoom*Math.exp(-e.deltaY*unit*.0015)));if(newZoom===oldZoom)return;camera.x+=(px-screenX)*(1/oldZoom-1/newZoom)/size;camera.y+=(py-screenY)*(1/oldZoom-1/newZoom)/size;camera.zoom=newZoom;draw()}
    function stop(){clearInterval(timer);timer=null;ui.play.textContent='▶ 播放';ui.status.textContent='已暂停'}function play(){if(timer){stop();return}if(stage>=20)setStage(0);ui.play.textContent='Ⅱ 暂停';ui.status.textContent='播放中';timer=setInterval(()=>{if(stage>=20){stop();return}setStage(stage+1,true)},950/speed)}
    ui.play.addEventListener('click',play);document.querySelector('#nextBtn').addEventListener('click',()=>{stop();setStage(stage+1,true)});document.querySelector('#prevBtn').addEventListener('click',()=>{stop();setStage(stage-1)});document.querySelector('#resetBtn').addEventListener('click',()=>{stop();setStage(0)});ui.range.addEventListener('input',e=>{stop();setStage(+e.target.value)});
    ui.zoom.addEventListener('click',zoomToRemainder);ui.restoreView.addEventListener('click',restoreView);canvas.addEventListener('pointerdown',beginDrag);canvas.addEventListener('pointermove',moveDrag);canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);canvas.addEventListener('wheel',wheelZoom,{passive:false});document.querySelectorAll('[data-speed]').forEach(b=>b.addEventListener('click',()=>{speed=+b.dataset.speed;document.querySelectorAll('[data-speed]').forEach(x=>x.classList.toggle('active',x===b));if(timer){stop();play()}}));
    document.querySelector('#revealBtn').addEventListener('click',e=>{document.querySelector('#conclusion').classList.toggle('hidden-conclusion');e.currentTarget.textContent=document.querySelector('#conclusion').classList.contains('hidden-conclusion')?'显示结论':'隐藏结论'});document.querySelector('#focusBtn').addEventListener('click',()=>{document.body.classList.toggle('focus');setTimeout(resize,50)});document.querySelector('#themeBtn').addEventListener('click',e=>{const dark=document.body.dataset.theme==='dark';document.body.dataset.theme=dark?'':'dark';e.currentTarget.textContent=dark?'深色':'浅色';resize()});
    addEventListener('resize',resize);new ResizeObserver(resize).observe(canvas);update();
