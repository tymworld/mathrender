const $=s=>document.querySelector(s),canvas=$('#board'),ctx=canvas.getContext('2d');
    const MAX_PIECES=12,nums=[1,1];
    while(nums.length<MAX_PIECES)nums.push(nums[nums.length-1]+nums[nums.length-2]);
    const colors=['#8066bd','#69a85d','#ed8a33','#3d86cf','#efbd3e','#16a187','#ef6955','#8d6e63','#6279c8','#c45f91','#4d9a9a','#d05b45'];
    function buildTargets(values){
      const result=[{x:0,y:0},{x:0,y:1}];
      let bounds={minX:0,minY:0,maxX:1,maxY:2};
      for(let i=2;i<values.length;i++){
        const n=values[i],direction=(i-2)%4;
        let next;
        if(direction===0)next={x:bounds.maxX,y:bounds.minY};
        else if(direction===1)next={x:bounds.minX,y:bounds.maxY};
        else if(direction===2)next={x:bounds.minX-n,y:bounds.minY};
        else next={x:bounds.minX,y:bounds.minY-n};
        result.push(next);
        bounds={minX:Math.min(bounds.minX,next.x),minY:Math.min(bounds.minY,next.y),maxX:Math.max(bounds.maxX,next.x+n),maxY:Math.max(bounds.maxY,next.y+n)};
      }
      return result;
    }
    const targets=buildTargets(nums);
    const view={zoom:26,baseZoom:26,panX:0,panY:0};
    let pieces=[],history=[],mode='free',pieceCount=7,gridOn=true,magnetOn=true,drag=null;
    let canvasSize={w:0,h:0,d:0};

    const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
    const screenPoint=(x,y)=>({x:view.panX+x*view.zoom,y:view.panY+y*view.zoom});
    const worldPoint=pt=>({x:(pt.x-view.panX)/view.zoom,y:(pt.y-view.panY)/view.zoom});

    function targetBounds(){
      const active=targets.slice(0,pieceCount);
      const minX=Math.min(...active.map(t=>t.x)),minY=Math.min(...active.map(t=>t.y));
      const maxX=Math.max(...active.map((t,i)=>t.x+nums[i])),maxY=Math.max(...active.map((t,i)=>t.y+nums[i]));
      return{minX,minY,maxX,maxY,w:maxX-minX,h:maxY-minY};
    }
    function boundsForPieces(){
      const minX=Math.min(...pieces.map(p=>p.x)),minY=Math.min(...pieces.map(p=>p.y));
      const maxX=Math.max(...pieces.map(p=>p.x+p.n)),maxY=Math.max(...pieces.map(p=>p.y+p.n));
      return{minX,minY,maxX,maxY,w:maxX-minX,h:maxY-minY};
    }
    function unionBounds(a,b){
      const minX=Math.min(a.minX,b.minX),minY=Math.min(a.minY,b.minY),maxX=Math.max(a.maxX,b.maxX),maxY=Math.max(a.maxY,b.maxY);
      return{minX,minY,maxX,maxY,w:maxX-minX,h:maxY-minY};
    }
    function currentBounds(){
      const pieceBounds=boundsForPieces();
      return mode==='guide'?unionBounds(pieceBounds,targetBounds()):pieceBounds;
    }
    function fitBounds(bounds){
      const w=canvas.clientWidth||600,h=canvas.clientHeight||650,pad=42;
      const zoom=clamp(Math.min((w-pad*2)/Math.max(bounds.w,1),(h-pad*2)/Math.max(bounds.h,1)),1.25,64);
      view.zoom=view.baseZoom=zoom;
      view.panX=(w-(bounds.minX+bounds.maxX)*zoom)/2;
      view.panY=(h-(bounds.minY+bounds.maxY)*zoom)/2;
      updateZoomControls();
    }
    function fitCurrentView(){if(pieces.length){fitBounds(currentBounds());draw()}}

    function layoutPieces(shuffle=false){
      const bounds=targetBounds(),gap=.75;
      const order=[...Array(pieceCount).keys()].sort((a,b)=>nums[b]-nums[a]);
      if(shuffle)for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]]}
      const maxRowWidth=Math.max(bounds.w,nums[pieceCount-1]+nums[Math.max(0,pieceCount-2)]+gap);
      let x=bounds.minX,y=mode==='guide'?bounds.maxY+2:bounds.minY,rowHeight=0;
      order.forEach(i=>{
        const n=nums[i];
        if(x>bounds.minX&&x+n>bounds.minX+maxRowWidth+.001){x=bounds.minX;y+=rowHeight+gap;rowHeight=0}
        pieces[i].x=x;pieces[i].y=y;pieces[i].homeX=x;pieces[i].homeY=y;
        x+=n+gap;rowHeight=Math.max(rowHeight,n);
      });
    }
    function snapshot(){
      history.push(pieces.map(p=>({x:p.x,y:p.y})));
      if(history.length>30)history.shift();
      $('#undoBtn').disabled=false;
    }
    function restore(state){
      pieces.forEach((p,i)=>Object.assign(p,state[i]));
      $('#undoBtn').disabled=history.length===0;
      draw();
    }
    function reset(shuffle=false){
      pieces=nums.slice(0,pieceCount).map((n,i)=>({n,color:colors[i],x:0,y:0,homeX:0,homeY:0,lastX:0,lastY:0}));
      layoutPieces(shuffle);
      history=[];
      $('#undoBtn').disabled=true;
      renderMeta();
      fitBounds(currentBounds());
      if(mode==='guide')updateStatus('引导拼图','方块尚未放入目标区。请拖到虚线位置，或点击“提示一步”。');
      else updateStatus('自由探索',`尝试用这 ${pieceCount} 个方块拼成一个长方形。`);
      draw();
    }
    function resize(){
      const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);
      const w=Math.round(r.width*d),h=Math.round(r.height*d);
      if(w===canvasSize.w&&h===canvasSize.h&&d===canvasSize.d){draw();return}
      canvasSize={w,h,d};canvas.width=w;canvas.height=h;ctx.setTransform(d,0,0,d,0,0);
      if(!pieces.length)reset();else fitCurrentView();
    }

    function drawGrid(){
      const w=canvas.clientWidth,h=canvas.clientHeight,dark=document.body.dataset.theme==='dark';
      const step=view.zoom>=16?1:view.zoom>=8?2:view.zoom>=4?5:view.zoom>=2?10:20,startX=Math.floor((-view.panX/view.zoom)/step)*step,endX=(-view.panX+w)/view.zoom;
      const startY=Math.floor((-view.panY/view.zoom)/step)*step,endY=(-view.panY+h)/view.zoom;
      ctx.save();ctx.beginPath();ctx.strokeStyle=dark?'rgba(173,202,235,.09)':'rgba(35,100,170,.08)';ctx.lineWidth=1;
      for(let x=startX;x<=endX;x+=step){const sx=Math.round(view.panX+x*view.zoom)+.5;ctx.moveTo(sx,0);ctx.lineTo(sx,h)}
      for(let y=startY;y<=endY;y+=step){const sy=Math.round(view.panY+y*view.zoom)+.5;ctx.moveTo(0,sy);ctx.lineTo(w,sy)}
      ctx.stroke();ctx.restore();
    }
    function draw(){
      const w=canvas.clientWidth,h=canvas.clientHeight;
      ctx.clearRect(0,0,w,h);drawGrid();
      if(mode==='guide'){
        const bounds=targetBounds(),corner=screenPoint(bounds.minX,bounds.minY);
        ctx.save();ctx.setLineDash([7,6]);ctx.strokeStyle='rgba(35,100,170,.55)';ctx.lineWidth=2;
        ctx.strokeRect(corner.x,corner.y,bounds.w*view.zoom,bounds.h*view.zoom);
        targets.slice(0,pieceCount).forEach((t,i)=>{
          const pt=screenPoint(t.x,t.y),size=nums[i]*view.zoom;
          ctx.strokeRect(pt.x,pt.y,size,size);
        });
        ctx.restore();
      }
      const order=pieces.map((_,i)=>i).filter(i=>!drag||drag.type!=='piece'||drag.index!==i);
      if(drag&&drag.type==='piece')order.push(drag.index);
      order.forEach(i=>{
        const p=pieces[i],pt=screenPoint(p.x,p.y),size=p.n*view.zoom;
        ctx.fillStyle=p.color;ctx.globalAlpha=drag&&drag.type==='piece'&&drag.index===i?.86:.96;
        ctx.fillRect(pt.x,pt.y,size,size);ctx.globalAlpha=1;ctx.strokeStyle='#fff';ctx.lineWidth=2;
        ctx.strokeRect(pt.x,pt.y,size,size);ctx.fillStyle=window.MathRender.contrastText(p.color);ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.font=`800 ${Math.max(16,Math.min(32,size*.28))}px Georgia`;
        ctx.fillText(p.n,pt.x+size/2,pt.y+size/2);
        ctx.fillStyle=window.MathRender.contrastText(p.color);ctx.font='16px system-ui';
        if(size>55)ctx.fillText(`F${i+1}`,pt.x+size/2,pt.y+size/2+23);
      });
    }

    function point(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
    function hit(pt){
      for(let i=pieces.length-1;i>=0;i--){
        const p=pieces[i],corner=screenPoint(p.x,p.y),size=p.n*view.zoom;
        if(pt.x>=corner.x&&pt.x<=corner.x+size&&pt.y>=corner.y&&pt.y<=corner.y+size)return i;
      }
      return-1;
    }
    function overlap(a,b){
      const epsilon=.04;
      return a.x<b.x+b.n-epsilon&&a.x+a.n>b.x+epsilon&&a.y<b.y+b.n-epsilon&&a.y+a.n>b.y+epsilon;
    }
    function snap(piece,index){
      if(gridOn){piece.x=Math.round(piece.x*2)/2;piece.y=Math.round(piece.y*2)/2}
      if(magnetOn){
        const threshold=Math.min(.75,12/view.zoom),near=(a,b)=>Math.abs(a-b)<threshold;
        const guides=pieces.filter((_,i)=>i!==index).map(p=>({x:p.x,y:p.y,n:p.n}));
        if(mode==='guide')targets.slice(0,pieceCount).forEach((t,i)=>guides.push({x:t.x,y:t.y,n:nums[i]}));
        guides.forEach(other=>{
          if(near(piece.x,other.x+other.n))piece.x=other.x+other.n;
          if(near(piece.x+piece.n,other.x))piece.x=other.x-piece.n;
          if(near(piece.y,other.y+other.n))piece.y=other.y+other.n;
          if(near(piece.y+piece.n,other.y))piece.y=other.y-piece.n;
          if(near(piece.x,other.x))piece.x=other.x;
          if(near(piece.y,other.y))piece.y=other.y;
        });
      }
      const topLeft=worldPoint({x:0,y:0}),bottomRight=worldPoint({x:canvas.clientWidth,y:canvas.clientHeight}),visible=20/view.zoom;
      piece.x=clamp(piece.x,topLeft.x-piece.n+visible,bottomRight.x-visible);
      piece.y=clamp(piece.y,topLeft.y-piece.n+visible,bottomRight.y-visible);
    }

    canvas.addEventListener('pointerdown',e=>{
      if(e.pointerType==='mouse'&&e.button!==0)return;
      e.preventDefault();
      const pt=point(e),index=hit(pt);
      if(index>=0){
        snapshot();
        const p=pieces[index],world=worldPoint(pt);
        p.lastX=p.x;p.lastY=p.y;
        drag={type:'piece',index,dx:world.x-p.x,dy:world.y-p.y,pointerId:e.pointerId};
      }else drag={type:'pan',startX:pt.x,startY:pt.y,startPanX:view.panX,startPanY:view.panY,pointerId:e.pointerId};
      canvas.classList.add('is-dragging');canvas.setPointerCapture(e.pointerId);draw();
    });
    canvas.addEventListener('pointermove',e=>{
      if(!drag||e.pointerId!==drag.pointerId)return;
      e.preventDefault();const pt=point(e);
      if(drag.type==='pan'){view.panX=drag.startPanX+pt.x-drag.startX;view.panY=drag.startPanY+pt.y-drag.startY}
      else{const p=pieces[drag.index],world=worldPoint(pt);p.x=world.x-drag.dx;p.y=world.y-drag.dy}
      draw();
    });
    function correctCount(){return pieces.filter((p,i)=>Math.hypot(p.x-targets[i].x,p.y-targets[i].y)<.08).length}
    function finishDrag(e,cancel=false){
      if(!drag||e.pointerId!==drag.pointerId)return;
      const activeDrag=drag,pointerId=e.pointerId;
      if(activeDrag.type==='piece'){
        const p=pieces[activeDrag.index];
        if(cancel){
          p.x=p.lastX;p.y=p.lastY;history.pop();$('#undoBtn').disabled=history.length===0;
          updateStatus('拖动已取消','方块已回到原位。');
        }else{
          snap(p,activeDrag.index);
          if(pieces.some((other,i)=>i!==activeDrag.index&&overlap(p,other))){
            p.x=p.lastX;p.y=p.lastY;history.pop();$('#undoBtn').disabled=history.length===0;
            updateStatus('发生重叠','方块已回到拖动前的位置。');
          }else if(mode==='guide')updateStatus('已放置',`已对齐 ${correctCount()} / ${pieceCount} 个目标位置。`);
          else updateStatus('已放置','继续调整，或点击“检查拼图”。');
        }
      }
      drag=null;canvas.classList.remove('is-dragging');
      if(canvas.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId);
      draw();
    }
    canvas.addEventListener('pointerup',e=>finishDrag(e));
    canvas.addEventListener('pointercancel',e=>finishDrag(e,true));
    canvas.addEventListener('lostpointercapture',e=>{if(drag&&e.pointerId===drag.pointerId)finishDrag(e,true)});

    function setZoom(next,anchor={x:canvas.clientWidth/2,y:canvas.clientHeight/2}){
      const old=view.zoom,newZoom=clamp(next,1.25,160);
      if(Math.abs(old-newZoom)<.001)return;
      const world=worldPoint(anchor);
      view.zoom=newZoom;view.panX=anchor.x-world.x*newZoom;view.panY=anchor.y-world.y*newZoom;
      updateZoomControls();draw();
    }
    canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(view.zoom*Math.exp(-e.deltaY*.0015),point(e))},{passive:false});
    function updateZoomControls(){
      const percent=Math.round(view.zoom/view.baseZoom*100);
      $('#zoomLevel').textContent=`${percent}%`;
      $('#zoomOutBtn').disabled=view.zoom<=1.251;$('#zoomInBtn').disabled=view.zoom>=159.99;
    }

    function updateStatus(title,text){$('#statusTitle').textContent=title;$('#statusText').textContent=text}
    function complete(){
      const bounds=boundsForPieces(),area=bounds.w*bounds.h;
      const sum=pieces.reduce((total,p)=>total+p.n*p.n,0);
      const noOverlap=!pieces.some((p,i)=>pieces.some((other,j)=>j>i&&overlap(p,other)));
      return noOverlap&&Math.abs(area-sum)<sum*.025;
    }
    function renderMeta(){
      const active=nums.slice(0,pieceCount),bounds=targetBounds();
      $('#countValue').textContent=`${pieceCount} 个`;$('#placed').textContent=`${pieceCount} 个方块`;
      $('#pieceCount').setAttribute('aria-valuetext',`${pieceCount} 个方块`);
      $('#sequence').innerHTML=active.map((n,i)=>`<span style="background:${colors[i]}">${n}</span>`).join('');
      $('#taskText').textContent=`任务：使用边长为 ${active.join('，')} 的 ${pieceCount} 个正方形，拼成一个 ${bounds.w}×${bounds.h} 的长方形。`;
    }

    $('#checkBtn').onclick=()=>{
      const bounds=targetBounds(),sum=pieces.reduce((total,p)=>total+p.n*p.n,0);
      complete()?updateStatus('拼图成功',`外框面积等于全部正方形面积之和：${bounds.w}×${bounds.h}=${sum}。`):updateStatus('还可以再调整','检查是否存在缝隙，并让所有方块共同组成一个长方形。');
    };
    $('#undoBtn').onclick=()=>{const state=history.pop();if(state)restore(state)};
    $('#shuffleBtn').onclick=()=>{mode='free';document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode==='free'));reset(true)};
    $('#resetBtn').onclick=()=>reset();
    $('#hintBtn').onclick=()=>{
      if(mode!=='guide'){
        mode='guide';document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode==='guide'));reset();
      }
      const index=pieces.findIndex((p,i)=>Math.hypot(p.x-targets[i].x,p.y-targets[i].y)>.08);
      if(index<0){updateStatus('引导完成','观察相邻正方形边长之间的关系。');return}
      const destination={x:targets[index].x,y:targets[index].y,n:pieces[index].n};
      if(pieces.some((p,i)=>i!==index&&overlap(destination,p))){
        updateStatus('目标位置被占用','请先移开虚线目标内不匹配的方块，再使用提示。');return;
      }
      snapshot();pieces[index].x=destination.x;pieces[index].y=destination.y;draw();
      updateStatus('提示一步',`已放置边长为 ${pieces[index].n} 的方块（${correctCount()} / ${pieceCount}）。`);
    };
    document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{
      mode=button.dataset.mode;document.querySelectorAll('[data-mode]').forEach(item=>item.classList.toggle('active',item===button));reset();
    });
    $('#pieceCount').oninput=e=>{pieceCount=Number(e.currentTarget.value);reset()};
    $('#zoomOutBtn').onclick=()=>setZoom(view.zoom/1.2);
    $('#zoomInBtn').onclick=()=>setZoom(view.zoom*1.2);
    $('#fitBtn').onclick=fitCurrentView;

    function toggle(el,key){
      el.classList.toggle('on');el.setAttribute('aria-checked',el.classList.contains('on'));
      if(key==='grid')gridOn=el.classList.contains('on');else magnetOn=el.classList.contains('on');
    }
    $('#gridToggle').onclick=()=>toggle($('#gridToggle'),'grid');
    $('#magnetToggle').onclick=()=>toggle($('#magnetToggle'),'magnet');
    $('#gridToggle').onkeydown=$('#magnetToggle').onkeydown=e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();e.currentTarget.click()}};
    $('#revealBtn').onclick=e=>{document.querySelectorAll('.prop').forEach(x=>x.classList.toggle('locked'));e.currentTarget.textContent=document.querySelector('.prop').classList.contains('locked')?'显示规律':'隐藏规律'};
    $('#focusBtn').onclick=()=>{document.body.classList.toggle('focus');setTimeout(resize,50)};
    $('#themeBtn').onclick=e=>{const dark=document.body.dataset.theme==='dark';document.body.dataset.theme=dark?'':'dark';e.currentTarget.textContent=dark?'深色':'浅色';draw()};
    addEventListener('resize',resize);new ResizeObserver(resize).observe(canvas);resize();
