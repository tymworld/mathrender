(() => {
      const $ = selector => document.querySelector(selector);
      const $$ = selector => [...document.querySelectorAll(selector)];
      const aRange = $('#aRange');
      const bRange = $('#bRange');
      const aInput = $('#aInput');
      const bInput = $('#bInput');
      const numberCanvas = $('#numberLine');
      const planeCanvas = $('#signPlane');
      const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const state = { a: 4, b: 3, stage: 0, animation: 0 };

      function css(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
      function clamp(value,min,max){ return Math.min(max,Math.max(min,value)); }
      function clean(value){ return Math.abs(value) < 1e-9 ? 0 : Math.round(value * 10) / 10; }
      function fmt(value){
        const n = clean(value);
        return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/,'');
      }

      function values(){
        const a = clean(state.a);
        const b = clean(state.b);
        const sum = clean(a + b);
        const product = clean(a * b);
        const direct = Math.abs(sum);
        const path = Math.abs(a) + Math.abs(b);
        const gap = clean(path - direct);
        const equal = product >= 0;
        return {a,b,sum,product,direct,path,gap,equal};
      }

      function fitCanvas(canvas,cssHeight){
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(2,window.devicePixelRatio || 1);
        canvas.width = Math.max(1,Math.round(rect.width * dpr));
        canvas.height = Math.max(1,Math.round(cssHeight * dpr));
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr,0,0,dpr,0,0);
        return {ctx,width:rect.width,height:cssHeight};
      }

      function roundedRect(ctx,x,y,w,h,r){
        const radius = Math.min(r,w/2,h/2);
        ctx.beginPath();
        ctx.roundRect(x,y,w,h,radius);
      }

      function drawArrow(ctx,x1,y1,x2,y2,color,width,label,labelY){
        const direction = x2 >= x1 ? 1 : -1;
        const length = Math.abs(x2-x1);
        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        if(length < 2){
          ctx.beginPath();
          ctx.arc(x1,y1,5.5,0,Math.PI*2);
          ctx.fill();
        }else{
          const head = Math.min(14,Math.max(8,length*.18));
          ctx.beginPath();
          ctx.moveTo(x1,y1);
          ctx.lineTo(x2-direction*head*.72,y2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x2,y2);
          ctx.lineTo(x2-direction*head,y2-head*.56);
          ctx.lineTo(x2-direction*head,y2+head*.56);
          ctx.closePath();
          ctx.fill();
        }
        ctx.font = '800 18px Georgia,"Times New Roman",serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label,(x1+x2)/2,labelY);
        ctx.restore();
      }

      function drawNumberLine(){
        const mobile = innerWidth <= 760;
        const cssHeight = mobile ? 430 : 485;
        const {ctx,width:w,height:h} = fitCanvas(numberCanvas,cssHeight);
        const v = values();
        const ink = css('--ink');
        const muted = css('--muted');
        const line = css('--line');
        const card = css('--card');
        const blue = css('--blue');
        const orange = css('--orange');
        const teal = css('--teal');
        const rose = css('--rose');
        const left = mobile ? 42 : 58;
        const right = mobile ? 28 : 42;
        const axisY = mobile ? 252 : 282;
        const min = -16;
        const max = 16;
        const X = value => left + (value-min)/(max-min)*(w-left-right);
        const x0 = X(0);
        const xa = X(v.a);
        const xs = X(v.sum);

        ctx.clearRect(0,0,w,h);

        ctx.fillStyle = muted;
        ctx.font = '700 16px system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('分两步走过的路程：|a| + |b|',left,34);

        if(v.product < 0){
          const lo = Math.max(Math.min(0,v.a),Math.min(v.a,v.sum));
          const hi = Math.min(Math.max(0,v.a),Math.max(v.a,v.sum));
          if(hi > lo){
            const rx = X(lo);
            const rw = X(hi)-rx;
            ctx.save();
            ctx.fillStyle = 'rgba(197,75,104,.13)';
            roundedRect(ctx,rx,62,rw,axisY-43,10);
            ctx.fill();
            ctx.strokeStyle = 'rgba(197,75,104,.5)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6,5]);
            ctx.stroke();
            ctx.setLineDash([]);
            if(rw > 68){
              ctx.fillStyle = rose;
              ctx.font = '800 16px system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('折返区',rx+rw/2,82);
            }
            ctx.restore();
          }
        }

        const yA = mobile ? 118 : 130;
        const yB = mobile ? 184 : 202;
        drawArrow(ctx,x0,yA,xa,yA,blue,7,`a = ${fmt(v.a)}`,yA-27);
        drawArrow(ctx,xa,yB,xs,yB,orange,7,`b = ${fmt(v.b)}`,yB-27);

        ctx.save();
        ctx.strokeStyle = line;
        ctx.lineWidth = 1.4;
        ctx.setLineDash([5,5]);
        [x0,xa,xs].forEach(x=>{
          ctx.beginPath();
          ctx.moveTo(x,Math.min(yA,yB)+14);
          ctx.lineTo(x,axisY-10);
          ctx.stroke();
        });
        ctx.restore();

        ctx.strokeStyle = muted;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(left,axisY);
        ctx.lineTo(w-right,axisY);
        ctx.stroke();

        ctx.fillStyle = muted;
        ctx.strokeStyle = muted;
        ctx.font = '700 16px system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for(let tick=-16;tick<=16;tick+=2){
          const x = X(tick);
          ctx.lineWidth = tick===0 ? 2.4 : 1.1;
          ctx.beginPath();
          ctx.moveTo(x,axisY-(tick===0?9:6));
          ctx.lineTo(x,axisY+(tick===0?9:6));
          ctx.stroke();
          if(tick%4===0) ctx.fillText(String(tick),x,axisY+13);
        }

        const pointData = [
          {x:x0,label:'0',color:muted,offset:-1},
          {x:xa,label:`a=${fmt(v.a)}`,color:blue,offset:1},
          {x:xs,label:`a+b=${fmt(v.sum)}`,color:teal,offset:1}
        ];
        pointData.sort((p,q)=>p.x-q.x).forEach((p,index,arr)=>{
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x,axisY,5.5,0,Math.PI*2);
          ctx.fill();
          let labelX = p.x;
          let align = 'center';
          const sameBefore = arr.slice(0,index).filter(q=>Math.abs(q.x-p.x)<2).length;
          const near = arr.some((q,i)=>i!==index && Math.abs(q.x-p.x)<58 && Math.abs(q.x-p.x)>=2);
          if(near && !sameBefore){
            labelX += p.offset*9;
            align = p.offset<0 ? 'right' : 'left';
          }
          ctx.font = '800 16px system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
          ctx.textAlign = align;
          ctx.textBaseline = 'bottom';
          ctx.fillText(p.label,labelX,axisY-13-sameBefore*20);
        });

        const resultY = mobile ? 365 : 405;
        ctx.fillStyle = muted;
        ctx.font = '700 16px system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('从起点直接到终点的距离：|a+b|',left,resultY-43);
        drawArrow(ctx,x0,resultY,xs,resultY,teal,8,`a+b = ${fmt(v.sum)}`,resultY-26);

        if(v.product < 0 && state.stage >= 1){
          const text = `发生折返：差值 Δ = ${fmt(v.gap)} = 2×min(|a|, |b|)`;
          ctx.font = '800 16px system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const boxW = Math.min(w-36,ctx.measureText(text).width+28);
          const boxX = (w-boxW)/2;
          const boxY = h-34;
          ctx.fillStyle = card;
          roundedRect(ctx,boxX,boxY-16,boxW,31,10);
          ctx.fill();
          ctx.strokeStyle = line;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = rose;
          ctx.fillText(text,w/2,boxY);
        }

        numberCanvas.setAttribute('aria-label',`数轴演示：a 等于 ${fmt(v.a)}，b 等于 ${fmt(v.b)}，直接距离为 ${fmt(v.direct)}，分步路程为 ${fmt(v.path)}`);
      }

      function drawSignPlane(){
        if(state.stage < 1 || $('#planeBlock').hidden) return;
        const {ctx,width:w,height:h} = fitCanvas(planeCanvas,258);
        const v = values();
        const ink = css('--ink');
        const muted = css('--muted');
        const line = css('--line');
        const card = css('--card');
        const blue = css('--blue');
        const teal = css('--teal');
        const orange = css('--orange');
        const pad = {l:42,r:28,t:22,b:34};
        const X = value => pad.l+(value+8)/16*(w-pad.l-pad.r);
        const Y = value => pad.t+(8-value)/16*(h-pad.t-pad.b);
        const x0 = X(0), y0 = Y(0);

        ctx.clearRect(0,0,w,h);
        ctx.fillStyle = card;
        ctx.fillRect(0,0,w,h);
        ctx.fillStyle = 'rgba(15,138,112,.13)';
        ctx.fillRect(x0,pad.t,w-pad.r-x0,y0-pad.t);
        ctx.fillRect(pad.l,y0,x0-pad.l,h-pad.b-y0);
        ctx.fillStyle = 'rgba(208,113,47,.13)';
        ctx.fillRect(pad.l,pad.t,x0-pad.l,y0-pad.t);
        ctx.fillRect(x0,y0,w-pad.r-x0,h-pad.b-y0);

        ctx.strokeStyle = line;
        ctx.lineWidth = 1;
        for(let tick=-8;tick<=8;tick+=2){
          if(tick===0) continue;
          ctx.beginPath();ctx.moveTo(X(tick),pad.t);ctx.lineTo(X(tick),h-pad.b);ctx.stroke();
          ctx.beginPath();ctx.moveTo(pad.l,Y(tick));ctx.lineTo(w-pad.r,Y(tick));ctx.stroke();
        }

        ctx.strokeStyle = muted;
        ctx.lineWidth = 2;
        ctx.beginPath();ctx.moveTo(pad.l,y0);ctx.lineTo(w-pad.r,y0);ctx.stroke();
        ctx.beginPath();ctx.moveTo(x0,pad.t);ctx.lineTo(x0,h-pad.b);ctx.stroke();
        ctx.fillStyle = muted;
        ctx.font = '700 16px Georgia,"Times New Roman",serif';
        ctx.textAlign = 'right';ctx.fillText('a',w-pad.r,h-pad.b+21);
        ctx.textAlign = 'left';ctx.fillText('b',x0+7,pad.t+3);

        ctx.font = '800 16px system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = teal;
        ctx.fillText('ab ≥ 0',X(4.2),Y(5.4));
        ctx.fillText('等号成立',X(4.2),Y(4.1));
        ctx.fillText('ab ≥ 0',X(-4.2),Y(-4.1));
        ctx.fillText('等号成立',X(-4.2),Y(-5.4));
        ctx.fillStyle = orange;
        ctx.fillText('ab < 0',X(-4.2),Y(5.4));
        ctx.fillText('严格小于',X(-4.2),Y(4.1));
        ctx.fillText('ab < 0',X(4.2),Y(-4.1));
        ctx.fillText('严格小于',X(4.2),Y(-5.4));

        const px = X(v.a), py = Y(v.b);
        ctx.save();
        ctx.strokeStyle = blue;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5,4]);
        ctx.beginPath();ctx.moveTo(px,y0);ctx.lineTo(px,py);ctx.lineTo(x0,py);ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowColor = 'rgba(22,50,79,.28)';
        ctx.shadowBlur = 9;
        ctx.fillStyle = blue;
        ctx.beginPath();ctx.arc(px,py,7,0,Math.PI*2);ctx.fill();
        ctx.restore();

        const label = `(${fmt(v.a)}, ${fmt(v.b)})`;
        ctx.font = '800 16px system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
        ctx.textAlign = px>w-105 ? 'right' : 'left';
        ctx.textBaseline = py<42 ? 'top' : 'bottom';
        ctx.fillStyle = ink;
        ctx.fillText(label,px+(ctx.textAlign==='right'?-10:10),py+(ctx.textBaseline==='top'?9:-9));
        planeCanvas.setAttribute('aria-label',`符号分区图：点 ${label} 位于 ${v.equal?'ab 大于等于零的等号区域':'ab 小于零的严格不等区域'}`);
      }

      function updateUI(){
        const v = values();
        const ratioMax = Math.max(1,v.path);
        $('#directBar').style.width = `${v.direct/ratioMax*100}%`;
        $('#pathBar').style.width = `${v.path/ratioMax*100}%`;
        $('#directValue').textContent = fmt(v.direct);
        $('#pathValue').textContent = fmt(v.path);
        $('#productValue').textContent = state.stage===0 ? '—' : fmt(v.product);
        $('#relationValue').textContent = state.stage===0 ? '?' : (v.equal ? '=' : '<');
        $('#relationValue').style.color = state.stage===0 ? css('--muted') : (v.equal ? css('--teal') : css('--orange'));
        $('#gapValue').textContent = state.stage===0 ? '—' : fmt(v.gap);
        $('#visualHint').textContent = state.stage===0 ? '先比较两个长度' : (v.equal?'方向一致，没有折返':'方向相反，发生折返');

        aRange.value = v.a;
        bRange.value = v.b;
        aInput.value = fmt(v.a);
        bInput.value = fmt(v.b);

        const stateBox = $('#stateBox');
        stateBox.classList.remove('equal','strict');
        if(state.stage===0){
          $('#stageLabel').textContent = '观察阶段';
          $('#stateTitle').textContent = '先观察箭头方向';
          $('#stateBadge').textContent = '待分类';
          $('#stateText').textContent = '尝试改变 a、b 的正负，比较两种长度是否始终相等。';
          $('#stageLocked').hidden = false;
          $('#planeBlock').hidden = true;
          $('#proofBlock').hidden = true;
          $('#theoremBlock').hidden = true;
          $('#nextStageBtn').textContent = '进入分类讨论 →';
        }else{
          stateBox.classList.add(v.equal?'equal':'strict');
          $('#stageLabel').textContent = state.stage===1?'分类阶段':'归纳阶段';
          $('#stateTitle').textContent = `ab = ${fmt(v.product)} ${v.product>=0?'≥':'<'} 0`;
          $('#stateBadge').textContent = v.equal?'等号成立':'严格小于';
          $('#stateText').textContent = v.equal
            ? 'a、b 同号或至少一个为 0，两步运动方向一致，没有发生折返。'
            : `a、b 异号，第二步向相反方向折返，抵消量为 ${fmt(v.gap)}。`;
          $('#stageLocked').hidden = true;
          $('#planeBlock').hidden = false;
          $('#proofBlock').hidden = false;
          $('#theoremBlock').hidden = state.stage<2;
          $('#sameSignProof').classList.toggle('current',v.equal);
          $('#oppositeSignProof').classList.toggle('current',!v.equal);
          $('#nextStageBtn').textContent = state.stage===1?'归纳最终结论 →':'重新观察 ↺';
        }

        $$('[data-stage-button]').forEach(button=>button.classList.toggle('active',+button.dataset.stageButton===state.stage));
        document.body.dataset.stage = state.stage;
        drawNumberLine();
        requestAnimationFrame(drawSignPlane);
      }

      function setValues(a,b,animate=true){
        cancelAnimationFrame(state.animation);
        const targetA = clamp(clean(+a),-8,8);
        const targetB = clamp(clean(+b),-8,8);
        const startA = state.a;
        const startB = state.b;
        const duration = reduceMotion || !animate ? 0 : 620;
        const started = performance.now();
        const ease = p => 1-Math.pow(1-p,3);
        function frame(now){
          const p = duration ? Math.min(1,(now-started)/duration) : 1;
          const e = ease(p);
          state.a = startA+(targetA-startA)*e;
          state.b = startB+(targetB-startB)*e;
          updateUI();
          if(p<1) state.animation=requestAnimationFrame(frame);
          else{
            state.a=targetA;
            state.b=targetB;
            updateUI();
          }
        }
        state.animation=requestAnimationFrame(frame);
      }

      function clearPresetSelection(){ $$('[data-a][data-b]').forEach(button=>button.classList.remove('active')); }
      function readInput(input,fallback){
        const value = Number(input.value);
        return Number.isFinite(value) ? clamp(clean(value),-8,8) : fallback;
      }

      aRange.addEventListener('input',()=>{ clearPresetSelection(); setValues(+aRange.value,state.b,false); });
      bRange.addEventListener('input',()=>{ clearPresetSelection(); setValues(state.a,+bRange.value,false); });
      aInput.addEventListener('change',()=>{ clearPresetSelection(); setValues(readInput(aInput,state.a),state.b,false); });
      bInput.addEventListener('change',()=>{ clearPresetSelection(); setValues(state.a,readInput(bInput,state.b),false); });

      $$('[data-a][data-b]').forEach(button=>button.addEventListener('click',()=>{
        $$('[data-a][data-b]').forEach(item=>item.classList.toggle('active',item===button));
        setValues(+button.dataset.a,+button.dataset.b,true);
      }));

      $('#randomBtn').addEventListener('click',()=>{
        clearPresetSelection();
        const options = [];
        for(let n=-8;n<=8;n+=.5) options.push(n);
        const pick = () => options[Math.floor(Math.random()*options.length)];
        setValues(pick(),pick(),true);
      });
      $('#resetBtn').addEventListener('click',()=>{
        $$('[data-a][data-b]').forEach((button,index)=>button.classList.toggle('active',index===0));
        setValues(4,3,true);
      });

      function setStage(stage){ state.stage=clamp(stage,0,2); updateUI(); }
      $$('[data-stage-button]').forEach(button=>button.addEventListener('click',()=>setStage(+button.dataset.stageButton)));
      $('#nextStageBtn').addEventListener('click',()=>setStage(state.stage===2?0:state.stage+1));

      $('#focusBtn').addEventListener('click',event=>{
        document.body.classList.toggle('focus');
        event.currentTarget.textContent = document.body.classList.contains('focus')?'退出聚焦':'聚焦';
        setTimeout(updateUI,50);
      });

      const THEME_KEY = 'edu-theme';
      function applyTheme(mode){
        document.body.dataset.theme=mode;
        window.MathRender.storage.setItem(THEME_KEY,mode);
        $('#themeBtn').textContent=mode==='dark'?'浅色':'深色';
        updateUI();
      }
      $('#themeBtn').addEventListener('click',()=>applyTheme(document.body.dataset.theme==='dark'?'light':'dark'));

      const savedTheme = window.MathRender.storage.getItem(THEME_KEY);
      document.body.dataset.theme = savedTheme==='dark'?'dark':'light';
      addEventListener('resize',updateUI);
      if('ResizeObserver' in window) new ResizeObserver(()=>updateUI()).observe(numberCanvas);
      updateUI();
    })();
