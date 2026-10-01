const BASE = { flyMs: 560, flyStaggerMs: 120, arrowMs: 520, cellGapMs: 160, rowCollapseMs: 650, compactRowCollapseMs: 260 };

    let totalRows = 5;              // ✅ 默认 5
    let triangleData = [];
    let currentShown = 0;
    let playing = false;
    let animLock = false;
    let token = 0;

    let expandedKey = null;
    let selectedRow = null;

    const triangleWrap = document.getElementById('triangleWrap');
    const triangleEl   = document.getElementById('triangle');
    const overlayEl    = document.getElementById('overlay');
    const errBox       = document.getElementById('errBox');
    const tipEl        = document.getElementById('tip');

    const rowsInput = document.getElementById('rowsInput');
    const buildBtn  = document.getElementById('buildBtn');
    const nextBtn   = document.getElementById('nextBtn');
    const playBtn   = document.getElementById('playBtn');
    const resetBtn  = document.getElementById('resetBtn');

    const modeSelect = document.getElementById('modeSelect');
    const densitySelect = document.getElementById('densitySelect');
    const speedRange = document.getElementById('speedRange');
    const speedText  = document.getElementById('speedText');

    const toggleLabels = document.getElementById('toggleLabels');
    const toggleSum = document.getElementById('toggleSum');
    const toggleLog = document.getElementById('toggleLog'); // 默认不勾选
    const toggleBinomial = document.getElementById('toggleBinomial');

    const varAInput = document.getElementById('varA');
    const varBInput = document.getElementById('varB');

    const shownCountEl = document.getElementById('shownCount');
    const totalCountEl = document.getElementById('totalCount');
    const stateDot = document.getElementById('stateDot');
    const stateText = document.getElementById('stateText');
    const selectedRowText = document.getElementById('selectedRowText');

    const sidePanel = document.getElementById('sidePanel');
    const logCard = document.getElementById('logCard');
    const logList = document.getElementById('logList');
    const clearLogBtn = document.getElementById('clearLogBtn');

    const binomialCard = document.getElementById('binomialCard');
    const binomialTitle = document.getElementById('binomialTitle');
    const polyBox = document.getElementById('polyBox');
    const copyPolyBtn = document.getElementById('copyPolyBtn');

    const focusBtn = document.getElementById('focusBtn');
    const captureBtn = document.getElementById('captureBtn');
    const themeSelect = document.getElementById('themeSelect');
    const themeToggle = document.getElementById('themeToggle');
    const printBtn = document.getElementById('printBtn');

    const exitBtn = document.getElementById('exitBtn');
    const floatNextBtn = document.getElementById('floatNextBtn');
    const floatPlayBtn = document.getElementById('floatPlayBtn');
    const floatResetBtn = document.getElementById('floatResetBtn');
    const floatThemeBtn = document.getElementById('floatThemeBtn');
    const floatPrintBtn = document.getElementById('floatPrintBtn');

    const THEME_KEY = 'edu-theme';

    function showErr(msg){ errBox.style.display = 'block'; errBox.textContent = msg; }
    function clearErr(){ errBox.style.display = 'none'; errBox.textContent = ''; }
    window.addEventListener('error', (e) => {
      showErr("发生错误：\n" + (e?.message || "未知错误") + (e?.error?.stack ? ("\n\n" + e.error.stack) : ""));
    });

    const clamp = (n,a,b)=>Math.max(a, Math.min(b, n));

    function buildTriangle(rows){
      const data = [];
      for (let i=0;i<rows;i++){
        const row = new Array(i+1).fill(1);
        for (let j=1;j<i;j++) row[j] = data[i-1][j-1] + data[i-1][j];
        data.push(row);
      }
      return data;
    }

    function combBigInt(n, k){
      k = Math.min(k, n-k);
      let num = 1n, den = 1n;
      for (let i=1; i<=k; i++){
        num *= BigInt(n - (k - i));
        den *= BigInt(i);
      }
      return num / den;
    }

    function updateOverlaySize(){
      const w = triangleWrap.clientWidth;
      const h = triangleWrap.clientHeight;
      overlayEl.setAttribute('width', w);
      overlayEl.setAttribute('height', h);
      overlayEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
    }

    function clearOverlay(){
      const arrowA2 = getComputedStyle(document.body).getPropertyValue('--arrowA2').trim() || 'rgba(255,216,106,.9)';
      const arrowB2 = getComputedStyle(document.body).getPropertyValue('--arrowB2').trim() || 'rgba(122,167,255,.9)';
      overlayEl.innerHTML = `
        <defs>
          <marker id="arrowA" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <path d="M0,0 L10,3 L0,6 Z" fill="${arrowA2}"></path>
          </marker>
          <marker id="arrowB" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <path d="M0,0 L10,3 L0,6 Z" fill="${arrowB2}"></path>
          </marker>
        </defs>
      `;
      if (!document.getElementById('dashStyle')){
        const st = document.createElement('style');
        st.id = 'dashStyle';
        st.textContent = `@keyframes dash { to { stroke-dashoffset: 0; } }`;
        document.head.appendChild(st);
      }
    }

    function relPointToWrap(el){
      const r1 = triangleWrap.getBoundingClientRect();
      const r2 = el.getBoundingClientRect();
      const x = (r2.left - r1.left) + r2.width/2 + triangleWrap.scrollLeft;
      const y = (r2.top  - r1.top ) + r2.height/2 + triangleWrap.scrollTop;
      return {x, y};
    }

    function drawArrow(from, to, kind, arrowMs){
      const arrowA = getComputedStyle(document.body).getPropertyValue('--arrowA').trim() || 'rgba(255,216,106,.75)';
      const arrowB = getComputedStyle(document.body).getPropertyValue('--arrowB').trim() || 'rgba(122,167,255,.75)';

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const dx = (to.x - from.x);
      const dy = (to.y - from.y);
      const mx = from.x + dx*0.5;
      const my = from.y + dy*0.5 - 18;
      path.setAttribute("d", `M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", kind === 'A' ? arrowA : arrowB);
      path.setAttribute("stroke-width", "2");
      path.setAttribute("marker-end", `url(#arrow${kind})`);
      path.setAttribute("stroke-linecap", "round");
      const len = 5000;
      path.style.strokeDasharray = `${len}`;
      path.style.strokeDashoffset = `${len}`;
      path.style.animation = `dash ${arrowMs}ms ease forwards`;
      overlayEl.appendChild(path);
    }

    function makeFly(label, kind){
      const div = document.createElement('div');
      div.className = `fly ${kind === 'A' ? 'a' : 'b'}`;
      div.textContent = label;
      triangleWrap.appendChild(div);
      return div;
    }

    function animateFly(flyEl, from, to, duration, myToken){
      return new Promise(resolve => {
        flyEl.style.left = `${from.x}px`;
        flyEl.style.top  = `${from.y}px`;
        flyEl.style.opacity = "1";

        const start = performance.now();
        const ease = (t)=>1-Math.pow(1-t,3);

        function step(now){
          if (myToken !== token){ flyEl.remove(); resolve(); return; }
          const p = Math.min(1, (now - start)/duration);
          const e = ease(p);
          flyEl.style.left = `${from.x + (to.x - from.x)*e}px`;
          flyEl.style.top  = `${from.y + (to.y - from.y)*e}px`;
          flyEl.style.transform = `translate(-50%, -50%) scale(${0.9 + 0.1*e})`;
          if (p < 1) requestAnimationFrame(step);
          else { flyEl.remove(); resolve(); }
        }
        requestAnimationFrame(step);
      });
    }

    function getCell(n,k){ return triangleEl.querySelector(`.cell[data-n="${n}"][data-k="${k}"]`); }

    function removeAllParentHighlights(){
      triangleEl.querySelectorAll('.cell.parentHotA, .cell.parentHotB').forEach(c=>{
        c.classList.remove('parentHotA');
        c.classList.remove('parentHotB');
      });
    }

    function hardClear(){
      // ✅ Esc 清理：箭头 + 提示 + 父格高亮 + 展开推导
      clearOverlay();
      tipEl.style.display = "none";
      removeAllParentHighlights();

      if (expandedKey){
        const [pn, pk] = expandedKey.split(",").map(Number);
        const cell = getCell(pn, pk);
        if (cell){
          // 收回为纯数字
          const valueEl = cell.querySelector('.value');
          if (valueEl) valueEl.style.display = 'none';
          let res = cell.querySelector('.resultOnly');
          if (!res){
            res = document.createElement('div');
            res.className = 'resultOnly';
            cell.appendChild(res);
          }
          res.textContent = String(cell.dataset.c ?? "");
          cell.dataset.expanded = "0";
        }
        expandedKey = null;
      }
    }

    function appendLog(n, kHuman, a, b, c){
      if (!toggleLog.checked) return;
      const item = document.createElement('div');
      item.className = 'logItem';
      item.innerHTML = `第 <b>${n}</b> 行，第 <b>${kHuman}</b> 个： ${a} + ${b} = <b>${c}</b> <span class="dim">(C(${n},${kHuman-1}))</span>`;
      logList.prepend(item);
    }

    function setSelectedRow(n){
      selectedRow = n;
      selectedRowText.textContent = (n == null ? "—" : String(n));
      updateBinomialPanel();
    }

    const formatSup = (p)=>`<sup>${p}</sup>`;

    function updateBinomialPanel(){
      const show = toggleBinomial.checked;
      binomialCard.style.display = show ? "block" : "none";
      if (!show) return;

      const escapeText = value => value.replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
      const aVar = escapeText((varAInput.value || "a").trim() || "a");
      const bVar = escapeText((varBInput.value || "b").trim() || "b");
      binomialTitle.innerHTML = `(${aVar}+${bVar})<sup>n</sup>`;

      if (selectedRow == null){ polyBox.textContent = "—"; return; }
      const n = selectedRow;
      if (n < 0 || n >= triangleData.length){ polyBox.textContent = "—"; return; }

      const coeffs = triangleData[n];
      const terms = [];
      for (let k=0; k<=n; k++){
        const c = coeffs[k];
        const powA = n-k, powB = k;
        let coef = (c !== 1) ? String(c) : "";
        let partA = powA > 0 ? aVar + (powA > 1 ? formatSup(powA) : "") : "";
        let partB = powB > 0 ? bVar + (powB > 1 ? formatSup(powB) : "") : "";
        let mono = (partA && partB) ? (partA + partB) : (partA || partB || "1");
        terms.push(coef ? `${coef}${mono==="1" ? "" : "·"}${mono}` : mono);
      }
      polyBox.innerHTML = `(${aVar}+${bVar})${n !== 1 ? formatSup(n) : ""} = ` + terms.join(" + ");
    }

    async function copyPoly(){
      const text = polyBox.innerText || polyBox.textContent || "";
      if (!text || text === "—") return;
      try{
        await navigator.clipboard.writeText(text);
        copyPolyBtn.textContent = "已复制";
        setTimeout(()=>copyPolyBtn.textContent="复制", 800);
      }catch{
        copyPolyBtn.textContent = "失败";
        setTimeout(()=>copyPolyBtn.textContent="复制", 800);
      }
    }

    function showTip(html, x, y){
      tipEl.innerHTML = html;
      tipEl.style.display = "block";
      const pad = 14;
      const w = tipEl.offsetWidth;
      const h = tipEl.offsetHeight;
      let left = x + 14;
      let top  = y + 14;
      const maxX = window.innerWidth - w - pad;
      const maxY = window.innerHeight - h - pad;
      if (left > maxX) left = x - w - 14;
      if (top  > maxY) top  = y - h - 14;
      tipEl.style.left = left + "px";
      tipEl.style.top  = top + "px";
    }
    function hideTip(){ tipEl.style.display = "none"; }

    const getSpeed = ()=>clamp(parseFloat(speedRange.value || "1"), 0.5, 2.0);

    function calcTimings(){
      const s = getSpeed();
      const flyMs = Math.round(BASE.flyMs / s);
      const arrowMs = Math.round(BASE.arrowMs / s);
      const cellGapMs = Math.round(BASE.cellGapMs / s);
      const flyStaggerMs = Math.round(BASE.flyStaggerMs / s);
      const mode = modeSelect.value;
      let rowCollapseMs = Math.round((mode === "compact" ? BASE.compactRowCollapseMs : BASE.rowCollapseMs) / s);
      if (mode === "static") rowCollapseMs = 0;
      return { flyMs, flyStaggerMs, arrowMs, cellGapMs, rowCollapseMs, mode };
    }

    function applyDensity(){
      // 简洁/详细目前只影响标签，不强制改“记录”
      toggleLabels.checked = (densitySelect.value === "detailed");
      renderVisibility();
    }

    function renderVisibility(){
      const showLabels = toggleLabels.checked;
      triangleEl.querySelectorAll(".cellMeta").forEach(el => el.style.display = showLabels ? "block" : "none");
      triangleEl.querySelectorAll(".rowLabel").forEach(el => el.style.display = showLabels ? "block" : "none");

      const showSum = toggleSum.checked;
      triangleEl.querySelectorAll(".rowSum").forEach(el => el.style.display = showSum ? "block" : "none");

      logCard.style.display = toggleLog.checked ? "block" : "none";
      binomialCard.style.display = toggleBinomial.checked ? "block" : "none";
      updateBinomialPanel();

      const anySide = (toggleLog.checked || toggleBinomial.checked);
      sidePanel.style.display = anySide ? "flex" : "none";
    }

    function updateUI(){
      shownCountEl.textContent = String(currentShown);
      totalCountEl.textContent = String(totalRows);
      nextBtn.disabled = (currentShown >= totalRows) || animLock;

      stateDot.classList.toggle('pause', !playing);
      stateText.textContent = playing ? '播放中' : '暂停';
      playBtn.textContent = playing ? '暂停' : '播放';

      // 同步浮动按钮文本
      floatPlayBtn.textContent = playing ? "暂停" : "播放";

      speedText.textContent = getSpeed().toFixed(2) + "×";
    }

    function collapseRow(n, myToken){
      if (myToken !== token) return;
      const cells = triangleEl.querySelectorAll(`.cell[data-n="${n}"]`);
      cells.forEach(cell => {
        const k = Number(cell.dataset.k);
        if (!(k > 0 && k < n)) return;
        const c = cell.dataset.c;
        if (c == null) return;

        const valueEl = cell.querySelector('.value');
        if (valueEl) valueEl.style.display = 'none';

        let res = cell.querySelector('.resultOnly');
        if (!res){
          res = document.createElement('div');
          res.className = 'resultOnly';
          cell.appendChild(res);
        }
        res.textContent = String(c);
      });
    }

    function collapseCellToResult(cell){
      const c = cell.dataset.c;
      const valueEl = cell.querySelector(".value");
      if (valueEl) valueEl.style.display = "none";
      let res = cell.querySelector(".resultOnly");
      if (!res){
        res = document.createElement("div");
        res.className = "resultOnly";
        cell.appendChild(res);
      }
      res.textContent = String(c ?? "");
      cell.dataset.expanded = "0";
    }

    function expandCellToExpr(cell){
      const a = cell.dataset.a, b = cell.dataset.b, c = cell.dataset.c;
      const valueEl = cell.querySelector(".value");
      if (!valueEl) return;

      const res = cell.querySelector(".resultOnly");
      if (res) res.remove();

      valueEl.style.display = 'flex';
      valueEl.innerHTML = `<span class="lhs">${a} + ${b}</span><span class="eq">=</span><span class="rhs">${c}</span>`;
      valueEl.classList.add("pop");
      setTimeout(()=>valueEl.classList.remove("pop"), 240);
      cell.dataset.expanded = "1";
    }

    function highlightParentsAndArrows(n, k, myToken){
      if (myToken !== token) return;
      const pA = getCell(n-1, k-1);
      const pB = getCell(n-1, k);
      const child = getCell(n, k);
      if (!pA || !pB || !child) return;

      updateOverlaySize();
      clearOverlay();

      pA.classList.add("parentHotA");
      pB.classList.add("parentHotB");

      const { arrowMs } = calcTimings();
      drawArrow(relPointToWrap(pA), relPointToWrap(child), "A", arrowMs);
      drawArrow(relPointToWrap(pB), relPointToWrap(child), "B", arrowMs);

      setTimeout(()=>{
        pA.classList.remove("parentHotA");
        pB.classList.remove("parentHotB");
      }, Math.max(400, Math.round(900 / getSpeed())));
    }

    async function animateOneCell(n, k, myToken){
      if (myToken !== token) return;
      const parentA = getCell(n-1, k-1);
      const parentB = getCell(n-1, k);
      const child   = getCell(n, k);
      if (!parentA || !parentB || !child) return;

      const t = calcTimings();
      updateOverlaySize();
      clearOverlay();

      const pA = relPointToWrap(parentA);
      const pB = relPointToWrap(parentB);
      const pc = relPointToWrap(child);

      parentA.classList.add('parentHotA');
      parentB.classList.add('parentHotB');

      drawArrow(pA, pc, 'A', t.arrowMs);
      drawArrow(pB, pc, 'B', t.arrowMs);

      const a = triangleData[n-1][k-1];
      const b = triangleData[n-1][k];
      const c = triangleData[n][k];

      child.dataset.a = String(a);
      child.dataset.b = String(b);
      child.dataset.c = String(c);

      const oldRes = child.querySelector('.resultOnly');
      if (oldRes) oldRes.remove();

      const valueEl = child.querySelector('.value');
      if (!valueEl) return;
      valueEl.style.display = 'flex';
      valueEl.textContent = "";

      const flyA = makeFly(String(a), 'A');
      const flyB = makeFly(String(b), 'B');

      await Promise.all([
        animateFly(flyA, pA, pc, t.flyMs, myToken),
        new Promise(r => setTimeout(r, t.flyStaggerMs)).then(() => animateFly(flyB, pB, pc, t.flyMs, myToken))
      ]);

      if (myToken !== token) return;

      valueEl.innerHTML = `<span class="lhs">${a} + ${b}</span><span class="eq">=</span><span class="rhs">${c}</span>`;
      valueEl.classList.add('pop');
      setTimeout(()=>valueEl.classList.remove('pop'), 260);

      appendLog(n, k+1, a, b, c);

      setTimeout(() => {
        parentA.classList.remove('parentHotA');
        parentB.classList.remove('parentHotB');
      }, Math.max(350, Math.round(700 / getSpeed())));
    }

    function cellTipHTML(n,k){
      const isEdge = (k===0 || k===n);
      const cnk = combBigInt(n,k).toString();
      let html = `<div><b>组合数</b>：C(${n},${k}) = <b>${cnk}</b></div>`;
      if (!isEdge){
        const a = triangleData[n-1][k-1];
        const b = triangleData[n-1][k];
        const c = triangleData[n][k];
        html += `<div class="dim">来源：C(${n-1},${k-1}) + C(${n-1},${k})</div>`;
        html += `<div>${a} + ${b} = <b>${c}</b></div>`;
      }else{
        html += `<div class="dim">边界：两侧恒为 1</div>`;
      }
      html += `<div class="dim">对称：C(${n},${k}) = C(${n},${n-k})</div>`;
      return html;
    }

    function onCellHover(ev, cell){
      const n = Number(cell.dataset.n);
      const k = Number(cell.dataset.k);
      showTip(cellTipHTML(n,k), ev.clientX, ev.clientY);
    }

    function onCellClick(ev, cell){
      const n = Number(cell.dataset.n);
      const k = Number(cell.dataset.k);
      setSelectedRow(n);

      if (k === 0 || k === n) return;
      if (n <= 0) return;

      const myToken = token;
      const key = `${n},${k}`;
      const alreadyExpanded = (cell.dataset.expanded === "1");

      if (expandedKey && expandedKey !== key){
        const [pn, pk] = expandedKey.split(",").map(Number);
        const prev = getCell(pn, pk);
        if (prev) collapseCellToResult(prev);
      }

      if (alreadyExpanded){
        collapseCellToResult(cell);
        expandedKey = null;
        clearOverlay();
        removeAllParentHighlights();
      }else{
        if (cell.dataset.a == null || cell.dataset.b == null){
          const a = triangleData[n-1][k-1];
          const b = triangleData[n-1][k];
          const c = triangleData[n][k];
          cell.dataset.a = String(a);
          cell.dataset.b = String(b);
          cell.dataset.c = String(c);
          appendLog(n, k+1, a, b, c);
        }
        expandCellToExpr(cell);
        expandedKey = key;
        highlightParentsAndArrows(n, k, myToken);
      }
    }

    async function renderNextRow(){
      if (animLock) return;
      if (currentShown >= totalRows) return;

      clearErr();
      animLock = true;
      updateUI();

      const myToken = token;

      try{
        const n = currentShown;
        const rowVals = triangleData[n];

        const rowEl = document.createElement('div');
        rowEl.className = 'row';
        rowEl.dataset.n = String(n);

        const rowLabel = document.createElement("div");
        rowLabel.className = "rowLabel";
        rowLabel.textContent = `n=${n}`;
        rowEl.appendChild(rowLabel);

        for (let k=0; k<=n; k++){
          const cell = document.createElement('div');
          cell.className = 'cell';
          cell.tabIndex = 0;
          cell.dataset.n = String(n);
          cell.dataset.k = String(k);

          const meta = document.createElement("div");
          meta.className = "cellMeta";
          meta.textContent = `k=${k}`;
          cell.appendChild(meta);

          const value = document.createElement('div');
          value.className = 'value';

          const c = rowVals[k];
          cell.dataset.c = String(c);

          if (k === 0 || k === n){
            cell.classList.add('edge');
            value.innerHTML = `<span class="rhs">1</span>`;
          }else{
            value.textContent = "";
          }

          cell.appendChild(value);

          cell.addEventListener("click", (ev) => onCellClick(ev, cell));
          cell.addEventListener("mousemove", (ev) => onCellHover(ev, cell));
          cell.addEventListener("mouseleave", () => hideTip());
          cell.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onCellClick(ev, cell); }
          });

          rowEl.appendChild(cell);
        }

        const rowSum = document.createElement("div");
        rowSum.className = "rowSum";
        const sum = (1n << BigInt(n)).toString();
        rowSum.innerHTML = `<span class="badge">Σ = <span class="mono">2^${n}</span> = <b>${sum}</b></span>`;
        rowEl.appendChild(rowSum);

        triangleEl.appendChild(rowEl);
        currentShown++;

        setSelectedRow(n);
        renderVisibility();
        updateUI();

        rowEl.scrollIntoView({ behavior: 'smooth', block: 'end' });

        const t = calcTimings();

        // n=0、n=1 没有内部推导，直接结束
        if (t.mode === "static"){
          for (let k=1; k<n; k++){
            const cell = getCell(n, k);
            if (!cell) continue;
            const valueEl = cell.querySelector(".value");
            if (!valueEl) continue;
            valueEl.style.display = "none";
            let res = cell.querySelector(".resultOnly");
            if (!res){
              res = document.createElement("div");
              res.className = "resultOnly";
              cell.appendChild(res);
            }
            res.textContent = cell.dataset.c || "";
          }
          clearOverlay();
          return;
        }

        if (n >= 2){
          for (let k = 1; k < n; k++){
            if (myToken !== token) break;
            await animateOneCell(n, k, myToken);
            await new Promise(r => setTimeout(r, t.cellGapMs));
          }

          setTimeout(() => {
            collapseRow(n, myToken);
            if (expandedKey && expandedKey.startsWith(n + ",")){
              const parts = expandedKey.split(",");
              const kk = Number(parts[1]);
              const cell = getCell(n, kk);
              if (cell && cell.dataset.expanded === "1"){
                expandCellToExpr(cell);
              }
            }
          }, t.rowCollapseMs);
        }

        setTimeout(() => clearOverlay(), Math.max(200, Math.round(420 / getSpeed())));
      }catch(err){
        showErr("发生错误：\n" + (err?.message || String(err)) + (err?.stack ? ("\n\n" + err.stack) : ""));
      }finally{
        animLock = false;
        updateUI();
      }
    }

    function stopPlay(){ playing = false; updateUI(); }
    async function startPlay(){
      if (playing) return;
      playing = true;
      updateUI();

      const myToken = token;
      while (playing && currentShown < totalRows && myToken === token){
        await renderNextRow();
        await new Promise(r => setTimeout(r, Math.max(180, Math.round(260 / getSpeed()))));
      }
      playing = false;
      updateUI();
    }
    function togglePlay(){ playing ? stopPlay() : startPlay(); }

    function resetAll(){
      token++;
      playing = false;
      animLock = false;
      expandedKey = null;
      selectedRow = null;

      triangleEl.innerHTML = '';
      clearOverlay();
      currentShown = 0;

      clearErr();
      setSelectedRow(null);
      updateUI();
      renderVisibility();

      // ✅ 重置后也自动显示第 0 行
      renderNextRow();
    }

    function applyRows(){
      stopPlay();
      token++;
      animLock = false;
      expandedKey = null;

      const n = clamp(parseInt(rowsInput.value || '5', 10), 1, 30);
      rowsInput.value = String(n);
      totalRows = n;
      triangleData = buildTriangle(totalRows);
      totalCountEl.textContent = String(totalRows);

      triangleEl.innerHTML = '';
      clearOverlay();
      currentShown = 0;
      setSelectedRow(null);
      updateUI();
      renderVisibility();
      clearErr();

      // ✅ 应用行数后自动显示第 0 行
      renderNextRow();
    }

    function enterFocus(){
      document.body.classList.remove('capture');
      document.body.classList.add('focus');
      hardClear();
      updateOverlaySize();
    }
    function enterCapture(){
      document.body.classList.remove('focus');
      document.body.classList.add('capture');
      hardClear();
      updateOverlaySize();
    }
    function exitFocusCapture(){
      document.body.classList.remove('focus');
      document.body.classList.remove('capture');
      hardClear();
      updateOverlaySize();
    }
    function toggleFocus(){ window.MathRender.togglePresentation(); }
    function toggleCapture(){ document.body.classList.contains('capture') ? exitFocusCapture() : enterCapture(); }

    function setTheme(theme){
      document.body.setAttribute('data-theme', theme);
      themeSelect.value = theme;
      window.MathRender.storage.setItem(THEME_KEY, theme === 'dark' ? 'dark' : 'light');
      themeToggle.textContent = theme === 'dark' ? '切换浅色' : '切换深色';
      clearOverlay();
    }
    function toggleTheme(){
      const cur = document.body.getAttribute('data-theme') || 'dark';
      setTheme(cur === 'dark' ? 'white' : 'dark');
    }

    /* ===== 绑定 ===== */
    buildBtn.addEventListener('click', applyRows);
    nextBtn.addEventListener('click', renderNextRow);
    playBtn.addEventListener('click', togglePlay);
    resetBtn.addEventListener('click', resetAll);

    // 浮动课堂控件（只在 focus 模式显示）
    floatNextBtn.addEventListener('click', renderNextRow);
    floatPlayBtn.addEventListener('click', togglePlay);
    floatResetBtn.addEventListener('click', resetAll);

    clearLogBtn.addEventListener('click', () => { logList.innerHTML = ''; });

    speedRange.addEventListener('input', () => updateUI());
    modeSelect.addEventListener('change', () => updateUI());
    densitySelect.addEventListener('change', applyDensity);

    toggleLabels.addEventListener('change', renderVisibility);
    toggleSum.addEventListener('change', renderVisibility);
    toggleLog.addEventListener('change', renderVisibility);
    toggleBinomial.addEventListener('change', renderVisibility);

    varAInput.addEventListener('input', updateBinomialPanel);
    varBInput.addEventListener('input', updateBinomialPanel);
    copyPolyBtn.addEventListener('click', copyPoly);

    rowsInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyRows(); });
    window.addEventListener('resize', () => updateOverlaySize());

    focusBtn.addEventListener('click', toggleFocus);
    captureBtn.addEventListener('click', toggleCapture);
    themeSelect.addEventListener('change', () => setTheme(themeSelect.value));
    themeToggle.addEventListener('click', toggleTheme);
    printBtn.addEventListener('click', () => {
      if ((document.body.getAttribute('data-theme') || 'dark') !== 'white') setTheme('white');
      window.print();
    });

    exitBtn.addEventListener('click', exitFocusCapture);
    floatThemeBtn.addEventListener('click', toggleTheme);
    floatPrintBtn.addEventListener('click', () => {
      if ((document.body.getAttribute('data-theme') || 'dark') !== 'white') setTheme('white');
      window.print();
    });

    // ✅ Esc 清理（不再强制退出聚焦/截图）
    window.addEventListener('keydown', (e) => {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      const inInput = ['INPUT','TEXTAREA','SELECT','BUTTON','A'].includes(tag) || document.activeElement?.isContentEditable;

      if (e.key === 'Escape'){
        e.preventDefault();
        hardClear();
        return;
      }

      if (e.key === 'Enter' && !inInput){ e.preventDefault(); renderNextRow(); }
      if (e.code === 'Space' && !inInput){ e.preventDefault(); togglePlay(); }
      if ((e.key === 'r' || e.key === 'R') && !inInput){ e.preventDefault(); resetAll(); }
      if (!inInput && (e.key === 'f' || e.key === 'F')){ e.preventDefault(); toggleFocus(); }
      if (!inInput && (e.key === 't' || e.key === 'T')){ e.preventDefault(); toggleTheme(); }
    }, { capture: true });

    window.addEventListener("mousemove", (ev) => {
      if (tipEl.style.display === "block"){
        showTip(tipEl.innerHTML, ev.clientX, ev.clientY);
      }
    });

    function init(){
      const saved = window.MathRender.storage.getItem(THEME_KEY);
      setTheme(saved === 'dark' ? 'dark' : 'white');
      updateOverlaySize();
      clearOverlay();

      triangleData = buildTriangle(totalRows);
      totalCountEl.textContent = String(totalRows);

      applyDensity();
      updateUI();
      renderVisibility();

      // ✅ 打开页面自动显示第 0 行
      renderNextRow();
    }
    init();
