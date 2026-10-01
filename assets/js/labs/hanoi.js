(() => {
  const PEG_NAMES = ['A','B','C'];
  const DISC_COLORS = ['#6366f1','#0ea5e9','#14b8a6','#22c55e','#f59e0b','#f97316','#ef4444','#ec4899'];
  const speedMap = {1:1200, 2:850, 3:600, 4:380, 5:220};
  const animDurationMap = {1:1250, 2:980, 3:760, 4:560, 5:400};
  const speedText = {1:'很慢', 2:'较慢', 3:'中', 4:'较快', 5:'很快'};

  const els = {
    themeToggle: document.getElementById('themeToggle'),
    diskCount: document.getElementById('diskCount'),
    diskCountLabel: document.getElementById('diskCountLabel'),
    gameMode: document.getElementById('gameMode'),
    allowance: document.getElementById('allowance'),
    maxErrors: document.getElementById('maxErrors'),
    strategy: document.getElementById('strategy'),
    speed: document.getElementById('speed'),
    speedLabel: document.getElementById('speedLabel'),
    animSpeed: document.getElementById('animSpeed'),
    animSpeedLabel: document.getElementById('animSpeedLabel'),
    resetBtn: document.getElementById('resetBtn'),
    undoBtn: document.getElementById('undoBtn'),
    hintBtn: document.getElementById('hintBtn'),
    rulesBtn: document.getElementById('rulesBtn'),
    autoBtn: document.getElementById('autoBtn'),
    stepBtn: document.getElementById('stepBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    stopBtn: document.getElementById('stopBtn'),
    toggleMoveStatBtn: document.getElementById('toggleMoveStatBtn'),
    toggleExtraStatsBtn: document.getElementById('toggleExtraStatsBtn'),
    toggleBottomInfoBtn: document.getElementById('toggleBottomInfoBtn'),
    board: document.getElementById('board'),
    pegs: document.getElementById('pegs'),
    moveStat: document.getElementById('moveStat'),
    extraStats: Array.from(document.querySelectorAll('.extra-stat')),
    bottomTeachingContent: document.getElementById('bottomTeachingContent'),
    moveCount: document.getElementById('moveCount'),
    optimalCount: document.getElementById('optimalCount'),
    errorCount: document.getElementById('errorCount'),
    remainCount: document.getElementById('remainCount'),
    banner: document.getElementById('banner'),
    teachingTip: document.getElementById('teachingTip'),
    stateCode: document.getElementById('stateCode'),
    limitCount: document.getElementById('limitCount'),
    history: document.getElementById('history'),
    compareBox: document.getElementById('compareBox'),
    alertOverlay: document.getElementById('alertOverlay'),
    toast: document.getElementById('toast')
  };

  const game = {
    n:4,
    positions:[],
    selectedPeg:null,
    moveHistory:[],
    errors:0,
    mode:'practice',
    allowance:2,
    maxErrors:3,
    autoPlan:[],
    autoIndex:0,
    autoTimer:null,
    autoPaused:false,
    demoName:'',
    locked:false,
    animating:false,
    hiddenDiskDuringAnimation:null,
    toastTimer:null,
    overlayTimer:null,
  };

  function init(){
    initTheme();
    bindEvents();
    rebuildGame(true);
  }

  function initTheme(){
    const KEY = 'edu-theme';
    const saved = window.MathRender.storage.getItem(KEY);
    const initial = saved === 'dark' || saved === 'light' ? saved : 'light';
    function applyTheme(mode){
      document.body.setAttribute('data-theme', mode);
      window.MathRender.storage.setItem(KEY, mode);
      els.themeToggle.textContent = mode === 'dark' ? '切换浅色' : '切换深色';
    }
    applyTheme(initial);
    els.themeToggle.addEventListener('click', () => {
      const cur = document.body.getAttribute('data-theme') || 'light';
      applyTheme(cur === 'dark' ? 'light' : 'dark');
    });
  }

  function bindEvents(){
    els.diskCount.addEventListener('input', () => {
      els.diskCountLabel.textContent = els.diskCount.value;
      rebuildGame(true);
    });
    els.gameMode.addEventListener('change', () => rebuildGame(false));
    els.allowance.addEventListener('input', () => refreshInfo());
    els.maxErrors.addEventListener('input', () => refreshInfo());
    els.strategy.addEventListener('change', () => refreshCompareBox());
    els.speed.addEventListener('input', () => {
      els.speedLabel.textContent = speedText[els.speed.value];
      if (game.autoTimer) {
        pauseAuto(true);
        resumeAuto();
      }
    });
    els.animSpeed.addEventListener('input', () => {
      els.animSpeedLabel.textContent = speedText[els.animSpeed.value];
    });
    els.speedLabel.textContent = speedText[els.speed.value];
    els.animSpeedLabel.textContent = speedText[els.animSpeed.value];

    els.resetBtn.addEventListener('click', () => rebuildGame(false));
    els.undoBtn.addEventListener('click', undoMove);
    els.hintBtn.addEventListener('click', showHint);
    els.rulesBtn.addEventListener('click', () => {
      setBanner('📘', '<b>规则：</b>每次只能移动一个圆盘；大盘不能压在小盘上；目标是把所有圆盘从 A 柱移到 C 柱。');
      showToast('已显示规则。', 'warn');
    });

    els.autoBtn.addEventListener('click', startAutoDemo);
    els.stepBtn.addEventListener('click', playOneAutoStep);
    els.pauseBtn.addEventListener('click', () => {
      if (!game.autoPlan.length) return showToast('当前没有正在准备的自动演示。', 'warn');
      if (game.autoPaused) resumeAuto();
      else pauseAuto(false);
    });
    els.stopBtn.addEventListener('click', stopAuto);
    els.toggleMoveStatBtn.addEventListener('click', () => {
      const shouldShow = els.moveStat.classList.contains('is-hidden');
      els.moveStat.classList.toggle('is-hidden', !shouldShow);
      els.toggleMoveStatBtn.textContent = shouldShow ? '隐藏当前步数' : '显示当前步数';
    });
    els.toggleExtraStatsBtn.addEventListener('click', () => {
      const shouldShow = els.extraStats.some(stat => stat.classList.contains('is-hidden'));
      els.extraStats.forEach(stat => stat.classList.toggle('is-hidden', !shouldShow));
      els.toggleExtraStatsBtn.textContent = shouldShow ? '隐藏其余统计' : '显示其余统计';
    });
    els.toggleBottomInfoBtn.addEventListener('click', () => {
      const shouldShow = els.bottomTeachingContent.classList.contains('is-hidden');
      els.bottomTeachingContent.classList.toggle('is-hidden', !shouldShow);
      els.toggleBottomInfoBtn.textContent = shouldShow ? '隐藏教学信息' : '显示教学信息';
    });

    els.alertOverlay.addEventListener('click', hideAlert);
    els.alertOverlay.addEventListener('touchstart', hideAlert, {passive:true});
    document.addEventListener('keydown', (e) => {
      if (!els.alertOverlay.classList.contains('show')) return;
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
        hideAlert();
      }
    });
  }

  function rebuildGame(resetN=false){
    stopAuto();
    if (resetN) game.n = Number(els.diskCount.value);
    game.mode = els.gameMode.value;
    game.allowance = Math.max(0, Number(els.allowance.value) || 0);
    game.maxErrors = Math.max(1, Number(els.maxErrors.value) || 3);
    game.positions = Array(game.n).fill(0);
    game.selectedPeg = null;
    game.moveHistory = [];
    game.errors = 0;
    game.locked = false;
    game.animating = false;
    game.hiddenDiskDuringAnimation = null;
    hideAlert();
    setBanner('🧩', '请开始操作：先点选起点柱，再点选目标柱。你也可以直接使用自动演示。');
    render();
    refreshCompareBox();
    showToast('新的汉诺塔任务已就绪。', 'good');
  }

  function encodeState(positions){
    let code = 0;
    let base = 1;
    for(let i=0;i<positions.length;i++){
      code += positions[i] * base;
      base *= 3;
    }
    return code;
  }

  function decodeState(code, n){
    const arr = [];
    for(let i=0;i<n;i++){
      arr.push(code % 3);
      code = Math.floor(code / 3);
    }
    return arr;
  }

  function topDiskOnPeg(positions, peg){
    for(let i=0;i<positions.length;i++){
      if (positions[i] === peg) return i + 1;
    }
    return null;
  }

  function getLegalMoves(positions){
    const tops = [0,1,2].map(p => topDiskOnPeg(positions, p));
    const moves = [];
    for(let from=0; from<3; from++){
      const disk = tops[from];
      if (!disk) continue;
      for(let to=0; to<3; to++){
        if (to === from) continue;
        const targetTop = tops[to];
        if (!targetTop || targetTop > disk){
          const next = positions.slice();
          next[disk - 1] = to;
          moves.push({
            from, to, disk,
            next,
            nextCode: encodeState(next)
          });
        }
      }
    }
    return moves;
  }

  function getPegsFromPositions(positions){
    const pegs = [[],[],[]];
    for(let disk = positions.length; disk >= 1; disk--){
      const peg = positions[disk - 1];
      pegs[peg].push(disk);
    }
    return pegs;
  }

  function shortestPath(startCode, goalCode, n){
    if (startCode === goalCode) return {moves:[], distance:0};
    const total = Math.pow(3, n);
    const visited = new Uint8Array(total);
    const prev = new Int32Array(total).fill(-1);
    const prevMove = new Array(total);
    const q = new Int32Array(total);
    let head = 0, tail = 0;
    q[tail++] = startCode;
    visited[startCode] = 1;

    while(head < tail){
      const code = q[head++];
      const positions = decodeState(code, n);
      const moves = getLegalMoves(positions);
      for(const move of moves){
        const nextCode = move.nextCode;
        if (visited[nextCode]) continue;
        visited[nextCode] = 1;
        prev[nextCode] = code;
        prevMove[nextCode] = {from:move.from, to:move.to, disk:move.disk};
        if (nextCode === goalCode){
          const out = [];
          let cur = goalCode;
          while(prev[cur] !== -1){
            out.push(prevMove[cur]);
            cur = prev[cur];
          }
          out.reverse();
          return {moves:out, distance:out.length};
        }
        q[tail++] = nextCode;
      }
    }
    return {moves:[], distance:Infinity};
  }

  function secondShortestPath(startCode, goalCode, n){
    const optimal = shortestPath(startCode, goalCode, n);
    if (optimal.distance === 0) return {moves:[], distance:0};
    const startPos = decodeState(startCode, n);
    const legal = getLegalMoves(startPos);
    for(const first of legal){
      const oneToGoal = shortestPath(first.nextCode, goalCode, n);
      if (oneToGoal.distance !== optimal.distance - 1) {
        return {moves:[{from:first.from,to:first.to,disk:first.disk}, ...oneToGoal.moves], distance:1 + oneToGoal.distance};
      }
    }
    const first = optimal.moves[0];
    const temp = startPos.slice();
    temp[first.disk - 1] = first.to;
    const back = getLegalMoves(temp).find(m => m.to === first.from && m.disk === first.disk);
    if (back){
      const tail = shortestPath(back.nextCode, goalCode, n);
      return {moves:[first,{from:back.from,to:back.to,disk:back.disk}, ...tail.moves], distance:2 + tail.distance};
    }
    return optimal;
  }

  function randomSolution(startCode, goalCode, n){
    let current = decodeState(startCode, n);
    let currentCode = startCode;
    const out = [];
    let lastReverse = null;
    const optimalNow = shortestPath(startCode, goalCode, n).distance;
    const wanderSteps = Math.min(18, Math.max(4, optimalNow));
    for(let i=0;i<wanderSteps && currentCode !== goalCode;i++){
      let legal = getLegalMoves(current);
      if (lastReverse){
        const filtered = legal.filter(m => !(m.from === lastReverse.from && m.to === lastReverse.to && m.disk === lastReverse.disk));
        if (filtered.length) legal = filtered;
      }
      legal.sort(() => Math.random() - 0.5);
      const pick = legal.find(m => shortestPath(m.nextCode, goalCode, n).distance <= optimalNow + 8) || legal[0];
      if (!pick) break;
      out.push({from:pick.from, to:pick.to, disk:pick.disk});
      current = pick.next.slice();
      currentCode = pick.nextCode;
      lastReverse = {from:pick.to, to:pick.from, disk:pick.disk};
      if (Math.random() < 0.18 && i > 1) break;
    }
    const tail = shortestPath(currentCode, goalCode, n);
    return {moves:[...out, ...tail.moves], distance:out.length + tail.distance};
  }

  function currentCode(){ return encodeState(game.positions); }
  function goalCode(){ return encodeState(Array(game.n).fill(2)); }
  function getChallengeLimit(){ return Math.pow(2, game.n) - 1 + game.allowance; }

  function refreshCompareBox(){
    const start = currentCode();
    const goal = goalCode();
    const opt = shortestPath(start, goal, game.n).distance;
    const second = secondShortestPath(start, goal, game.n).distance;
    const rand = randomSolution(start, goal, game.n).distance;

    const entries = [
      ['当前状态到终点：最优', opt, '用于讲解最少步数'],
      ['当前状态到终点：次快', second, '严格慢于最优，可比较效率'],
      ['当前状态到终点：随机方案', rand, '合法但通常更慢']
    ];


    els.compareBox.innerHTML = entries.map(([name, count, note]) => `
      <div class="history-item">
        <div><strong>${name}</strong><div style="color:var(--muted);margin-top:4px;">${note}</div></div>
        <div style="font-weight:800;font-size:18px;">${count}</div>
      </div>
    `).join('');
  }

  function render(){
    renderBoard();
    refreshInfo();
    renderHistory();
    renderTeachingTip();
    refreshCompareBox();
  }

  function refreshInfo(){
    game.mode = els.gameMode.value;
    game.allowance = Math.max(0, Number(els.allowance.value) || 0);
    game.maxErrors = Math.max(1, Number(els.maxErrors.value) || 3);
    els.moveCount.textContent = game.moveHistory.length;
    els.optimalCount.textContent = Math.pow(2, game.n) - 1;
    els.errorCount.textContent = game.errors;
    els.remainCount.textContent = shortestPath(currentCode(), goalCode(), game.n).distance;
    els.stateCode.textContent = game.positions.join('');
    els.limitCount.textContent = getChallengeLimit();
    els.undoBtn.disabled = game.moveHistory.length === 0 || game.locked || game.animating;
    els.hintBtn.disabled = game.locked || game.animating;
  }

  function getDiscEl(disk){ return els.pegs.querySelector(`.disc[data-disk="${disk}"]`); }
  function getPegEl(pegIndex){ return els.pegs.querySelector(`.peg[data-peg="${pegIndex}"]`); }

  function flashBoardError(pegs=[]){
    els.board.classList.remove('error-shake');
    void els.board.offsetWidth;
    els.board.classList.add('error-shake');
    setTimeout(() => els.board.classList.remove('error-shake'), 450);
    pegs.forEach(idx => {
      const pegEl = getPegEl(idx);
      if (!pegEl) return;
      pegEl.classList.add('error-mark');
      setTimeout(() => pegEl.classList.remove('error-mark'), 850);
    });
  }

  function showAlert(text, title='操作不允许', icon='⛔'){
    clearTimeout(game.overlayTimer);
    els.alertOverlay.innerHTML = `
      <div class="alert-panel">
        <div class="alert-icon">${icon}</div>
        <div class="alert-main">
          <div class="alert-title">${title}</div>
          <div class="alert-text">${text}</div>
          <div class="alert-hint">点击屏幕任意处，或按 Esc / Enter / 空格 可立即关闭</div>
        </div>
      </div>
    `;
    els.alertOverlay.classList.add('show');
    game.overlayTimer = setTimeout(hideAlert, 3950);
  }

  function hideAlert(){
    clearTimeout(game.overlayTimer);
    els.alertOverlay.classList.remove('show');
  }

  async function animateMove(move){
    const sourceDisc = getDiscEl(move.disk);
    if (!sourceDisc) return;
    const boardRect = els.board.getBoundingClientRect();
    const sourceRect = sourceDisc.getBoundingClientRect();
    const flying = sourceDisc.cloneNode(true);
    flying.classList.remove('final-hidden');
    flying.classList.add('flying-disc');
    flying.style.width = sourceRect.width + 'px';
    flying.style.height = sourceRect.height + 'px';
    flying.style.left = (sourceRect.left - boardRect.left) + 'px';
    flying.style.top = (sourceRect.top - boardRect.top) + 'px';
    flying.style.transform = 'translate(0px, 0px)';
    els.board.appendChild(flying);

    game.hiddenDiskDuringAnimation = move.disk;
    render();

    const finalDisc = getDiscEl(move.disk);
    if (!finalDisc){
      flying.remove();
      game.hiddenDiskDuringAnimation = null;
      return;
    }
    const finalRect = finalDisc.getBoundingClientRect();
    const dx = finalRect.left - sourceRect.left;
    const dy = finalRect.top - sourceRect.top;
    const sourceTop = sourceRect.top - boardRect.top;
    const clearanceTop = 46;
    const liftY = Math.min(-78, clearanceTop - sourceTop);
    const duration = animDurationMap[els.animSpeed.value];

    const animation = flying.animate([
      { transform:'translate(0px, 0px) scale(1)', filter:'brightness(1)', offset:0 },
      { transform:`translate(0px, ${liftY}px) scale(1.035)`, filter:'brightness(1.07)', offset:0.27 },
      { transform:`translate(${dx * .5}px, ${liftY - 5}px) scale(1.045)`, filter:'brightness(1.09)', offset:0.5 },
      { transform:`translate(${dx}px, ${liftY}px) scale(1.035)`, filter:'brightness(1.07)', offset:0.72 },
      { transform:`translate(${dx}px, ${dy - 7}px) scale(1.01)`, filter:'brightness(1.02)', offset:0.91 },
      { transform:`translate(${dx}px, ${dy + 2}px) scale(.998)`, filter:'brightness(1)', offset:0.97 },
      { transform:`translate(${dx}px, ${dy}px) scale(1)`, filter:'brightness(1)', offset:1 }
    ], {
      duration,
      easing:'cubic-bezier(.36,.02,.2,1)',
      fill:'forwards'
    });

    try{ await animation.finished; }catch(e){}
    flying.remove();
    finalDisc.classList.remove('final-hidden');
    game.hiddenDiskDuringAnimation = null;
  }

  function renderBoard(){
    const pegs = getPegsFromPositions(game.positions);
    const selected = game.selectedPeg;
    const legalTargets = selected === null ? [] : getLegalMoves(game.positions).filter(m => m.from === selected).map(m => m.to);
    els.pegs.innerHTML = '';
    pegs.forEach((stack, pegIndex) => {
      const peg = document.createElement('div');
      peg.className = 'peg';
      peg.dataset.peg = pegIndex;
      if (selected === pegIndex) peg.classList.add('selected');
      if (legalTargets.includes(pegIndex)) peg.classList.add('legal');
      peg.innerHTML = `
        <div class="peg-name">${PEG_NAMES[pegIndex]}</div>
        <div class="pole"></div>
        <div class="base-slot"></div>
        <div class="peg-footer">${stack.length ? '共有 ' + stack.length + ' 个盘' : '空柱'}</div>
      `;
      peg.addEventListener('click', () => onPegClick(pegIndex));
      stack.forEach((disk, idx) => {
        const disc = document.createElement('div');
        disc.className = 'disc';
        if (idx === stack.length - 1) disc.classList.add('top-disc');
        disc.dataset.disk = disk;
        disc.setAttribute('aria-label', `第 ${disk} 号圆盘`);
        if (game.hiddenDiskDuringAnimation === disk) disc.classList.add('final-hidden');
        const width = 58 + (disk - 1) * 24 + Math.max(0, (8 - game.n) * 6);
        disc.style.width = width + 'px';
        disc.style.bottom = (77 + idx * 32) + 'px';
        const discColor = DISC_COLORS[(disk-1)%DISC_COLORS.length];
        disc.style.setProperty('--disc-color', discColor);
        disc.style.setProperty('--disc-light', shade(discColor, 18));
        disc.style.setProperty('--disc-dark', shade(discColor, -22));
        disc.innerHTML = `<span class="disc-label">${disk}</span>`;
        peg.appendChild(disc);
      });
      els.pegs.appendChild(peg);
    });
  }

  function shade(hex, percent){
    const num = parseInt(hex.replace('#',''), 16);
    let r = (num >> 16) + percent;
    let g = ((num >> 8) & 0x00FF) + percent;
    let b = (num & 0x0000FF) + percent;
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return '#' + (r << 16 | g << 8 | b).toString(16).padStart(6,'0');
  }

  function onPegClick(pegIndex){
    if (game.locked || game.animating) return;
    if (game.autoTimer && !game.autoPaused) return showToast('自动演示进行中，暂停后再手动操作。', 'warn');

    const legal = getLegalMoves(game.positions);
    if (game.selectedPeg === null){
      const hasSource = legal.some(m => m.from === pegIndex);
      if (!hasSource){
        const sourceTop = topDiskOnPeg(game.positions, pegIndex);
        if (!sourceTop){
          feedbackError('这根柱子当前不能作为起点，因为这根柱子是空的。', {pegs:[pegIndex]});
          return;
        }
        const blockers = [0,1,2]
          .filter(p => p !== pegIndex)
          .map(p => topDiskOnPeg(game.positions, p))
          .filter(d => d && d < sourceTop)
          .sort((a,b) => a - b);
        let reason = '因为当前没有合法目标柱。';
        if (blockers.length >= 2) reason = `因为${sourceTop}>${blockers[0]}且${sourceTop}>${blockers[1]}...`;
        else if (blockers.length === 1) reason = `因为${blockers[0]}<${sourceTop}。`;
        feedbackError(`这根柱子的顶盘(${sourceTop})当前不能作为起点, ${reason}`, {pegs:[pegIndex]});
        return;
      }
      game.selectedPeg = pegIndex;
      setBanner('🎯', `<b>已选择起点 ${PEG_NAMES[pegIndex]}。</b> 请再点击一个合法的目标柱。`);
      renderBoard();
      return;
    }

    if (game.selectedPeg === pegIndex){
      game.selectedPeg = null;
      setBanner('↩️', '已取消选择。请重新选择起点柱。');
      renderBoard();
      return;
    }

    const move = legal.find(m => m.from === game.selectedPeg && m.to === pegIndex);
    if (!move){
      const fromName = PEG_NAMES[game.selectedPeg];
      const fromPeg = game.selectedPeg;
      const sourceTop = topDiskOnPeg(game.positions, fromPeg);
      const targetTop = topDiskOnPeg(game.positions, pegIndex);
      game.selectedPeg = null;
      const reason = (targetTop && sourceTop)
        ? `因为${sourceTop}>${targetTop}...`
        : '因为目标柱不符合移动规则。';
      feedbackError(`不能把${fromName}柱的顶盘(${sourceTop})移到${PEG_NAMES[pegIndex]}柱(${targetTop}), ${reason}`, {pegs:[fromPeg, pegIndex]});
      renderBoard();
      return;
    }

    game.selectedPeg = null;
    doMove(move, 'manual');
  }

  async function doMove(move, origin='manual'){
    if (game.animating) return;
    game.animating = true;
    const before = game.positions.slice();
    game.positions[move.disk - 1] = move.to;
    game.moveHistory.push({ from:move.from, to:move.to, disk:move.disk, origin, before });

    const praise = origin === 'manual'
      ? `很好，已把第 ${move.disk} 号盘从 ${PEG_NAMES[move.from]} 移到 ${PEG_NAMES[move.to]}。`
      : `自动演示：第 ${move.disk} 号盘 ${PEG_NAMES[move.from]}→${PEG_NAMES[move.to]}。`;

    setBanner(origin === 'manual' ? '✅' : '🤖', `<b>${praise}</b>`);
    await animateMove(move);
    render();
    game.animating = false;
    if (checkWin()) return;
    checkChallengeFailure();
  }

  function undoMove(){
    if (!game.moveHistory.length || game.locked || game.animating) return;
    const last = game.moveHistory.pop();
    game.positions = last.before.slice();
    game.selectedPeg = null;
    setBanner('↩️', `<b>已撤销：</b>第 ${last.disk} 号盘 ${PEG_NAMES[last.to]}→${PEG_NAMES[last.from]}。`);
    render();
    showToast('已撤销一步。', 'warn');
  }

  function showHint(){
    if (game.locked || game.animating) return;
    const path = shortestPath(currentCode(), goalCode(), game.n);
    if (!path.moves.length){
      showToast('当前已经完成，无需提示。', 'good');
      return;
    }
    const next = path.moves[0];
    game.selectedPeg = next.from;
    renderBoard();
    setBanner('💡', `<b>提示：</b>下一步可尝试把第 ${next.disk} 号盘从 ${PEG_NAMES[next.from]} 移到 ${PEG_NAMES[next.to]}。这样做仍保持最优。`);
    els.teachingTip.innerHTML = `当前状态下，从这里继续到终点至少还需 <b>${path.distance}</b> 步。最优下一步是 <b>${PEG_NAMES[next.from]}→${PEG_NAMES[next.to]}</b>。`;
    showToast('已给出下一步提示。', 'good');
  }

  function renderTeachingTip(){
    const remain = shortestPath(currentCode(), goalCode(), game.n).distance;
    const n = game.n;
    const solved = currentCode() === goalCode();
    const path = shortestPath(currentCode(), goalCode(), game.n);
    const next = path.moves[0];
    if (solved){
      els.teachingTip.innerHTML = `你已经完成了任务。对于 <b>${n}</b> 个盘，理论最少步数是 <b>${Math.pow(2,n)-1}</b>。可引导学生总结“每增加一个盘，最少步数几乎翻倍”。`;
      return;
    }
    let decomposition = `若把整塔看成“把 ${n} 个盘从 A 移到 C”，最优策略的核心仍是：先转移 <b>n-1</b> 个，再移动最大盘，最后再转移 <b>n-1</b> 个。`;
    if (next) decomposition += ` 当前最优路径的下一步是 <b>${PEG_NAMES[next.from]}→${PEG_NAMES[next.to]}</b>。`;
    decomposition += ` 从当前状态继续，至少还需要 <b>${remain}</b> 步。`;
    els.teachingTip.innerHTML = decomposition;
  }

  function renderHistory(){
    if (!game.moveHistory.length){
      els.history.innerHTML = `<div class="history-item"><div><strong>尚未开始</strong><div style="color:var(--muted);margin-top:4px;">请手动操作或启动自动演示。</div></div><div>—</div></div>`;
      return;
    }
    els.history.innerHTML = game.moveHistory.slice().reverse().map((item, idx) => `
      <div class="history-item">
        <div>
          <strong>第 ${game.moveHistory.length - idx} 步</strong>
          <div style="color:var(--muted);margin-top:4px;">${item.origin === 'manual' ? '手动' : '自动'}：第 ${item.disk} 号盘 ${PEG_NAMES[item.from]}→${PEG_NAMES[item.to]}</div>
        </div>
        <div>${item.disk}</div>
      </div>
    `).join('');
  }

  function setBanner(icon, html){
    els.banner.innerHTML = `<span>${icon}</span><div>${html}</div>`;
  }

  function showToast(text, type=''){
    clearTimeout(game.toastTimer);
    els.toast.className = `toast ${type}`;
    els.toast.textContent = text;
    requestAnimationFrame(() => els.toast.classList.add('show'));
    game.toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1800);
  }

  function feedbackError(text, options={}){
    game.errors += 1;
    setBanner('⚠️', `<b>操作无效：</b> ${text}`);
    refreshInfo();
    flashBoardError(options.pegs || []);
    showAlert(text, '这个动作不符合规则', '⛔');
    showToast(text, 'bad');
    checkChallengeFailure();
  }

  function checkWin(){
    if (currentCode() !== goalCode()) return false;
    game.locked = true;
    stopAuto();
    const best = Math.pow(2, game.n) - 1;
    const moves = game.moveHistory.length;
    const msg = moves === best ? `完美完成！你用了最优步数 ${moves} 步。` : `成功完成！你用了 ${moves} 步，最优是 ${best} 步。`;
    setBanner('🎉', `<b>${msg}</b>`);
    els.teachingTip.innerHTML = `任务已完成。现在可以追问：<b>为什么最少一定是 ${best} 步？</b> 这正是递归证明与数学归纳思想的切入点。`;
    showToast(msg, 'good');
    return true;
  }

  function checkChallengeFailure(){
    if (game.mode !== 'challenge' || game.locked) return false;
    const limit = getChallengeLimit();
    if (game.moveHistory.length > limit){
      game.locked = true;
      stopAuto();
      const text = `挑战失败：步数已超过上限 ${limit}。可重开后再尝试更优策略。`;
      setBanner('❌', `<b>${text}</b>`);
      showAlert(text, '挑战失败', '❌');
      showToast(text, 'bad');
      return true;
    }
    if (game.errors > game.maxErrors){
      game.locked = true;
      stopAuto();
      const text = `挑战失败：错误次数已超过 ${game.maxErrors} 次。`;
      setBanner('❌', `<b>${text}</b>`);
      showAlert(text, '挑战失败', '❌');
      showToast(text, 'bad');
      return true;
    }
    return false;
  }

  function buildAutoPlan(){
    const start = currentCode();
    const goal = goalCode();
    const strategy = els.strategy.value;
    let path;
    if (strategy === 'optimal') {
      path = shortestPath(start, goal, game.n);
      game.demoName = '最优方案';
    } else if (strategy === 'second') {
      path = secondShortestPath(start, goal, game.n);
      game.demoName = '次快方案';
    } else {
      path = randomSolution(start, goal, game.n);
      game.demoName = '随机方案';
    }
    game.autoPlan = path.moves.slice();
    game.autoIndex = 0;
    game.autoPaused = false;
    return path;
  }

  function startAutoDemo(){
    if (game.animating) return;
    if (game.locked && currentCode() === goalCode()){
      showToast('已经完成，可点击“重新开始”。', 'warn');
      return;
    }
    stopAuto();
    const path = buildAutoPlan();
    if (!path.moves.length){
      showToast('当前状态已经完成，或没有可执行的自动方案。', 'warn');
      return;
    }
    setBanner('🤖', `<b>${game.demoName}</b> 已准备，共 ${path.distance} 步。程序将开始自动播放。`);
    runAuto();
  }

  async function playOneAutoStep(){
    if (game.locked && currentCode() === goalCode()) return;
    if (!game.autoPlan.length || game.autoIndex >= game.autoPlan.length){
      const path = buildAutoPlan();
      if (!path.moves.length){
        showToast('当前状态已经完成。', 'warn');
        return;
      }
      setBanner('⏭️', `<b>${game.demoName}</b> 已准备。你可以逐步讲解每一步。`);
    }
    await executeAutoStep();
  }

  function runAuto(){
    if (!game.autoPlan.length || game.autoPaused) return;
    clearTimeout(game.autoTimer);
    game.autoTimer = setTimeout(async () => {
      const ok = await executeAutoStep();
      if (!ok) return;
      runAuto();
    }, speedMap[els.speed.value]);
  }

  async function executeAutoStep(){
    if (game.autoIndex >= game.autoPlan.length){
      stopAuto();
      return false;
    }
    const move = game.autoPlan[game.autoIndex++];
    await doMove(move, 'auto');
    if (game.locked) {
      stopAuto();
      return false;
    }
    if (game.autoIndex >= game.autoPlan.length){
      stopAuto();
      return false;
    }
    return true;
  }

  function pauseAuto(silent=false){
    clearTimeout(game.autoTimer);
    game.autoTimer = null;
    game.autoPaused = true;
    if (!silent){
      setBanner('⏸️', `<b>自动演示已暂停。</b> 你可以继续播放，也可以切换成手动讲解。`);
      showToast('自动演示已暂停。', 'warn');
    }
  }

  function resumeAuto(){
    if (!game.autoPlan.length) return;
    game.autoPaused = false;
    setBanner('▶️', `<b>继续播放 ${game.demoName}</b>。剩余 ${game.autoPlan.length - game.autoIndex} 步。`);
    runAuto();
  }

  function stopAuto(){
    clearTimeout(game.autoTimer);
    game.autoTimer = null;
    game.autoPaused = false;
    game.autoPlan = [];
    game.autoIndex = 0;
  }

  init();
})();
