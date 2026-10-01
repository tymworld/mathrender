(() => {
  const PLAYERS = ['甲','乙','丙'];
  const PLAYER_IDS = { '甲':'playerA', '乙':'playerB', '丙':'playerC' };
  const demoSpeedMap = {1:1300,2:950,3:650,4:420,5:240};
  const animSpeedMap = {1:1000,2:760,3:550,4:360,5:220};
  const speedText = {1:'很慢',2:'较慢',3:'中',4:'较快',5:'很快'};

  const els = {
    themeToggle: document.getElementById('themeToggle'),
    passCount: document.getElementById('passCount'),
    passCountLabel: document.getElementById('passCountLabel'),
    animSpeed: document.getElementById('animSpeed'),
    animSpeedLabel: document.getElementById('animSpeedLabel'),
    demoSpeed: document.getElementById('demoSpeed'),
    demoSpeedLabel: document.getElementById('demoSpeedLabel'),
    showAnswer: document.getElementById('showAnswer'),
    sampleMode: document.getElementById('sampleMode'),
    formulaMode: document.getElementById('formulaMode'),
    resetManualBtn: document.getElementById('resetManualBtn'),
    undoBtn: document.getElementById('undoBtn'),
    autoDemoCount: document.getElementById('autoDemoCount'),
    randomDemoBtn: document.getElementById('randomDemoBtn'),
    optimalExplainBtn: document.getElementById('optimalExplainBtn'),
    clearExpBtn: document.getElementById('clearExpBtn'),
    targetStat: document.getElementById('targetStat'),
    stepStat: document.getElementById('stepStat'),
    holderStat: document.getElementById('holderStat'),
    freqStat: document.getElementById('freqStat'),
    banner: document.getElementById('banner'),
    arenaInner: document.getElementById('arenaInner'),
    passTrack: document.getElementById('passTrack'),
    playerA: document.getElementById('playerA'),
    playerB: document.getElementById('playerB'),
    playerC: document.getElementById('playerC'),
    statusA: document.getElementById('statusA'),
    statusB: document.getElementById('statusB'),
    statusC: document.getElementById('statusC'),
    ball: document.getElementById('ball'),
    answerBox: document.getElementById('answerBox'),
    samplePanel: document.getElementById('samplePanel'),
    sampleSummary: document.getElementById('sampleSummary'),
    routeList: document.getElementById('routeList'),
    formulaPanel: document.getElementById('formulaPanel'),
    formulaBox: document.getElementById('formulaBox'),
    logList: document.getElementById('logList'),
    overlay: document.getElementById('overlay'),
    toast: document.getElementById('toast')
  };

  const state = {
    n: 4,
    currentHolder: '甲',
    step: 0,
    path: ['甲'],
    history: [],
    log: [],
    experiment: { total: 0, success: 0 },
    demoTimer: null,
    demoRunning: false,
    animating: false,
    toastTimer: null,
    overlayTimer: null,
  };

  function init(){
    initTheme();
    bindEvents();
    updateSpeedLabels();
    resetManual();
    refreshEverything();
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
    els.passCount.addEventListener('input', () => {
      state.n = Number(els.passCount.value);
      els.passCountLabel.textContent = state.n;
      resetManual();
      refreshEverything();
    });
    els.animSpeed.addEventListener('input', updateSpeedLabels);
    els.demoSpeed.addEventListener('input', updateSpeedLabels);
    els.showAnswer.addEventListener('change', refreshAnswerBox);
    els.sampleMode.addEventListener('change', refreshRoutes);
    els.formulaMode.addEventListener('change', refreshFormulaVisibility);
    els.resetManualBtn.addEventListener('click', () => {
      resetManual();
      refreshEverything();
      showToast('已重置手动传球。', 'good');
    });
    els.undoBtn.addEventListener('click', undoStep);
    els.randomDemoBtn.addEventListener('click', startRandomDemo);
    els.optimalExplainBtn.addEventListener('click', () => {
      els.formulaMode.value = 'show';
      refreshFormulaVisibility();
      buildFormulaSteps(true);
      showToast('已展开递推讲解。', 'good');
    });
    els.clearExpBtn.addEventListener('click', () => {
      state.experiment = { total: 0, success: 0 };
      appendLog('已清空随机实验统计。');
      refreshStats();
      showToast('实验统计已清空。', 'warn');
    });

    document.querySelectorAll('[data-trials]').forEach(btn => {
      btn.addEventListener('click', () => runExperiments(Number(btn.dataset.trials)));
    });

    [els.playerA, els.playerB, els.playerC].forEach(el => {
      el.addEventListener('click', () => onPlayerClick(el.dataset.player));
    });

    els.overlay.addEventListener('click', hideOverlay);
    document.addEventListener('keydown', (e) => {
      if (els.overlay.classList.contains('show') && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ' || e.code === 'Space')) {
        hideOverlay();
      }
    });
    const syncArenaGeometry = () => {
      positionBall(false);
      drawGuideLines();
    };
    const syncAfterPageStyles = () => {
      requestAnimationFrame(() => requestAnimationFrame(syncArenaGeometry));
    };
    window.addEventListener('resize', () => requestAnimationFrame(syncArenaGeometry));
    window.addEventListener('load', syncAfterPageStyles, { once: true });
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', syncAfterPageStyles, { once: true });
    } else {
      syncAfterPageStyles();
    }
    if ('ResizeObserver' in window) {
      const arenaObserver = new ResizeObserver(() => requestAnimationFrame(syncArenaGeometry));
      [els.arenaInner, els.playerA, els.playerB, els.playerC].forEach(el => arenaObserver.observe(el));
    }
    if ('MutationObserver' in window) {
      const themeObserver = new MutationObserver(syncAfterPageStyles);
      themeObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ['class', 'data-theme', 'data-lab-page']
      });
    }
  }

  function updateSpeedLabels(){
    els.animSpeedLabel.textContent = speedText[Number(els.animSpeed.value)];
    els.demoSpeedLabel.textContent = speedText[Number(els.demoSpeed.value)];
  }

  function resetManual(clearLog = true){
    clearTimeout(state.demoTimer);
    state.currentHolder = '甲';
    state.step = 0;
    state.path = ['甲'];
    state.history = [];
    state.animating = false;
    setBanner('👋', `第一次由甲开始持球。请完成 <b>${state.n}</b> 次传球。`);
    positionBall(false);
    drawGuideLines();
    updatePlayerStyles();
    appendLog(`重置：从甲开始，目标是观察 ${state.n} 次传球后球是否回到甲。`, clearLog);
  }

  function refreshEverything(){
    refreshStats();
    refreshAnswerBox();
    refreshRoutes();
    buildFormulaSteps(false);
    refreshFormulaVisibility();
    renderLog();
    positionBall(false);
    updatePlayerStyles();
    drawGuideLines();
  }

  function setBanner(icon, html){
    els.banner.innerHTML = `<span>${icon}</span><div>${html}</div>`;
  }

  function showToast(text, type=''){
    clearTimeout(state.toastTimer);
    els.toast.className = `toast ${type}`;
    els.toast.textContent = text;
    requestAnimationFrame(() => els.toast.classList.add('show'));
    state.toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1800);
  }

  function showOverlay(title, text, icon='✓', color='var(--accent)'){
    clearTimeout(state.overlayTimer);
    els.overlay.innerHTML = `
      <div class="overlay-card" style="border-left-color:${color};">
        <div class="overlay-icon" style="background:linear-gradient(135deg, ${color}, #0ea5e9);">${icon}</div>
        <div>
          <div class="overlay-title">${title}</div>
          <div class="overlay-text">${text}</div>
        </div>
      </div>
    `;
    els.overlay.classList.add('show');
    state.overlayTimer = setTimeout(hideOverlay, 1400);
  }

  function hideOverlay(){
    clearTimeout(state.overlayTimer);
    els.overlay.classList.remove('show');
  }

  function appendLog(text, reset = false){
    if (reset) state.log = [];
    state.log.unshift({ text, t: new Date().toLocaleTimeString('zh-CN', { hour12:false }) });
    if (state.log.length > 28) state.log.pop();
    renderLog();
  }

  function renderLog(){
    if (!state.log.length){
      els.logList.innerHTML = `<div class="log-item"><div><b>暂无记录</b><div style="color:var(--muted);margin-top:4px;">进行一次手动传球或随机实验即可看到记录。</div></div><div>—</div></div>`;
      return;
    }
    els.logList.innerHTML = state.log.map(item => `
      <div class="log-item">
        <div><b>${item.text}</b></div>
        <div>${item.t}</div>
      </div>
    `).join('');
  }

  function legalTargets(holder){
    return PLAYERS.filter(x => x !== holder);
  }

  function onPlayerClick(player){
    if (state.animating || state.demoRunning || state.step >= state.n) return;
    const legal = legalTargets(state.currentHolder);
    if (!legal.includes(player)){
      markInvalid(player);
      showToast('持球者不能传给自己。', 'bad');
      return;
    }
    manualPass(player);
  }

  async function manualPass(target, options = {}){
    const from = state.currentHolder;
    state.history.push({ holder: state.currentHolder, step: state.step, path: state.path.slice() });
    state.currentHolder = target;
    state.step += 1;
    state.path.push(target);
    appendLog(`手动：第 ${state.step} 次传球，${from} → ${target}`);
    setBanner('🏀', `<b>第 ${state.step} 次传球：</b>${from} 把球传给了 ${target}。`);
    await positionBall(true);
    refreshStats();
    updatePlayerStyles();
    if (state.step === state.n) finishManual(options);
  }

  function undoStep(){
    if (!state.history.length || state.animating || state.demoRunning) return;
    const last = state.history.pop();
    state.currentHolder = last.holder;
    state.step = last.step;
    state.path = last.path.slice();
    positionBall(false);
    refreshStats();
    updatePlayerStyles();
    setBanner('↩️', `<b>已撤销。</b> 回到第 ${state.step} 次传球之前。`);
    appendLog('撤销了一步手动传球。');
    showToast('已撤销一步。', 'warn');
  }

  function finishManual(options = {}){
    const success = state.currentHolder === '甲';
    const routeText = state.path.join(' → ');
    state.experiment.total += 1;
    if (success) state.experiment.success += 1;
    refreshStats();

    const roundText = options.totalRounds && options.totalRounds > 1
      ? `（第 ${options.round}/${options.totalRounds} 次）`
      : '';

    if (success){
      setBanner('🎉', `<b>完成！</b> ${state.n} 次传球后，球回到了甲手上${roundText}。`);
      if (!options.quiet) {
        showOverlay('回到了甲手上', `路径：${routeText}`, '✓', '#16a34a');
        showToast('这是一条“成功路径”，已计入实验统计。', 'good');
      }
      appendLog(`结果：${state.n} 次传球后回到甲。路径为 ${routeText}。已计入实验：${state.experiment.success}/${state.experiment.total}${roundText}`);
    } else {
      setBanner('📌', `<b>完成！</b> ${state.n} 次传球后，球没有回到甲手上${roundText}。`);
      if (!options.quiet) {
        showOverlay('没有回到甲手上', `路径：${routeText}`, '×', '#dc2626');
        showToast('这是一条“未返回甲”的路径，已计入实验统计。', 'warn');
      }
      appendLog(`结果：${state.n} 次传球后没有回到甲。路径为 ${routeText}。已计入实验：${state.experiment.success}/${state.experiment.total}${roundText}`);
    }
  }

  function markInvalid(player){
    const el = document.getElementById(PLAYER_IDS[player]);
    if (!el) return;
    el.classList.add('invalid');
    setTimeout(() => el.classList.remove('invalid'), 650);
  }

  function refreshStats(){
    els.targetStat.textContent = state.n;
    els.stepStat.textContent = state.step;
    els.holderStat.textContent = state.currentHolder;
    els.freqStat.innerHTML = state.experiment.total
      ? `${(state.experiment.success / state.experiment.total * 100).toFixed(1)}%<div style="font-size:16px;font-weight:700;color:var(--muted);margin-top:4px;">${state.experiment.success}/${state.experiment.total}</div>`
      : '—';
    els.undoBtn.disabled = !state.history.length || state.animating || state.demoRunning;
  }

  function updatePlayerStyles(){
    [els.playerA, els.playerB, els.playerC].forEach(el => {
      el.classList.remove('current','legal');
    });
    const currentEl = document.getElementById(PLAYER_IDS[state.currentHolder]);
    currentEl.classList.add('current');
    if (state.step < state.n){
      legalTargets(state.currentHolder).forEach(p => {
        document.getElementById(PLAYER_IDS[p]).classList.add('legal');
      });
    }
    const statusText = player => {
      if (state.currentHolder === player) return '当前持球';
      return state.step < state.n ? '点击接球' : '本轮结束';
    };
    els.statusA.textContent = statusText('甲');
    els.statusB.textContent = statusText('乙');
    els.statusC.textContent = statusText('丙');
  }

  function playerCenter(player){
    const arenaRect = els.arenaInner.getBoundingClientRect();
    const el = document.getElementById(PLAYER_IDS[player]);
    const anchor = el.querySelector('.ball-anchor');
    const rect = (anchor || el).getBoundingClientRect();
    return {
      x: rect.left - arenaRect.left + rect.width / 2,
      y: rect.top - arenaRect.top + rect.height / 2
    };
  }

  function positionBall(animated = true){
    return new Promise(resolve => {
      const { x, y } = playerCenter(state.currentHolder);
      const ball = els.ball;
      ball.style.transitionDuration = `${animSpeedMap[Number(els.animSpeed.value)]}ms`;
      if (!animated){
        const oldTransition = ball.style.transition;
        ball.style.transition = 'none';
        ball.style.left = `${x - 24}px`;
        ball.style.top = `${y - 24}px`;
        void ball.offsetWidth;
        ball.style.transition = oldTransition || '';
        resolve();
        return;
      }
      state.animating = true;
      ball.classList.add('moving');
      ball.style.left = `${x - 24}px`;
      ball.style.top = `${y - 24}px`;
      setTimeout(() => {
        ball.classList.remove('moving');
        state.animating = false;
        resolve();
      }, animSpeedMap[Number(els.animSpeed.value)] + 40);
    });
  }

  function drawGuideLines(){
    const pairs = [['甲','乙'],['甲','丙'],['乙','丙']];
    els.passTrack.innerHTML = '';
    pairs.forEach(([a,b]) => {
      const p1 = playerCenter(a);
      const p2 = playerCenter(b);
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      const line = document.createElement('div');
      line.className = 'pass-line';
      line.style.left = `${p1.x}px`;
      line.style.top = `${p1.y}px`;
      line.style.width = `${len}px`;
      line.style.transform = `rotate(${angle}deg)`;
      els.passTrack.appendChild(line);
    });
  }

  async function startRandomDemo(){
    if (state.animating || state.demoRunning) return;
    clearTimeout(state.demoTimer);
    hideOverlay();
    const repeat = Number(els.autoDemoCount.value || 1);
    state.demoRunning = true;

    try {
      if (repeat === 1) {
        resetManual();
        refreshEverything();
        const route = generateRandomRoute(state.n);
        setBanner('🤖', `<b>自动随机演示：</b> 程序将随机完成 ${state.n} 次传球。`);
        for (let i = 1; i < route.length; i++) {
          const to = route[i];
          await manualPass(to, { quiet: false, round: 1, totalRounds: 1 });
          if (i < route.length - 1) {
            await sleep(demoSpeedMap[Number(els.demoSpeed.value)]);
          }
        }
      } else {
        appendLog(`开始连续自动演示 ${repeat} 次。`, false);
        for (let round = 1; round <= repeat; round++) {
          resetManual(false);
          refreshEverything();
          const route = generateRandomRoute(state.n);
          setBanner('🤖', `<b>自动随机演示进行中：</b> 第 ${round}/${repeat} 次。`);
          for (let i = 1; i < route.length; i++) {
            const to = route[i];
            await manualPass(to, { quiet: true, round, totalRounds: repeat });
            if (i < route.length - 1) {
              await sleep(Math.max(80, demoSpeedMap[Number(els.demoSpeed.value)] * 0.55));
            }
          }
          if (round < repeat) {
            await sleep(Math.max(120, demoSpeedMap[Number(els.demoSpeed.value)] * 0.4));
          }
        }
        setBanner('✅', `<b>自动随机演示完成。</b> 已连续完成 ${repeat} 次，实验统计已同步更新。`);
        showToast(`已连续自动演示 ${repeat} 次。`, 'good');
      }
    } finally {
      state.demoRunning = false;
      refreshStats();
    }
  }

  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

  function generateRandomRoute(n){
    const path = ['甲'];
    let holder = '甲';
    for(let i=0;i<n;i++){
      const options = legalTargets(holder);
      holder = options[Math.floor(Math.random() * 2)];
      path.push(holder);
    }
    return path;
  }

  function runExperiments(trials){
    let success = 0;
    for(let i=0;i<trials;i++){
      const path = generateRandomRoute(state.n);
      if (path[path.length - 1] === '甲') success++;
    }
    state.experiment.total += trials;
    state.experiment.success += success;
    appendLog(`随机实验 ${trials} 次：其中回到甲 ${success} 次，频率约 ${(success / trials * 100).toFixed(1)}%。`);
    refreshStats();
    showToast(`已完成 ${trials} 次随机实验。`, 'good');
  }

  function enumerateRoutes(n){
    const out = [];
    function dfs(holder, step, path){
      if (step === n){
        out.push({ path: path.slice(), success: holder === '甲' });
        return;
      }
      legalTargets(holder).forEach(next => {
        path.push(next);
        dfs(next, step + 1, path);
        path.pop();
      });
    }
    dfs('甲', 0, ['甲']);
    return out;
  }

  function refreshRoutes(){
    const routes = enumerateRoutes(state.n);
    const total = routes.length;
    const success = routes.filter(r => r.success).length;

    if (els.sampleMode.value === 'hide') {
      els.samplePanel.style.display = 'none';
      return;
    }

    els.samplePanel.style.display = '';
    els.sampleSummary.className = 'exact';
    els.sampleSummary.innerHTML = `共有 <b>${total}</b> 条等可能路径，其中回到甲手上 <b>${success}</b> 条，所以概率应为 <b>${formatFraction(success, total)}</b>。`;

    if (els.sampleMode.value === 'summary' || total > 128) {
      els.routeList.innerHTML = `<div class="route-item"><div><b>已切换为汇总视图</b><div style="color:var(--muted);margin-top:4px;">当前共有 ${total} 条路径，成功 ${success} 条。</div></div><div>${formatFraction(success, total)}</div></div>`;
      return;
    }

    els.routeList.innerHTML = routes.map((r, idx) => `
      <div class="route-item ${r.success ? 'good' : 'bad'}">
        <div>
          <b>路径 ${idx + 1}</b>
          <div style="margin-top:4px;color:${r.success ? '#166534' : '#7f1d1d'};">${r.path.join(' → ')}</div>
        </div>
        <div>${r.success ? '回到甲' : '未回到甲'}</div>
      </div>
    `).join('');
  }

  function refreshAnswerBox(){
    const routes = enumerateRoutes(state.n);
    const success = routes.filter(r => r.success).length;
    const total = routes.length;
    const prob = success / total;
    if (els.showAnswer.value === 'hide'){
      els.answerBox.className = 'exact hidden-answer';
      els.answerBox.innerHTML = `当前设置为“先隐藏”。可先让学生猜想、实验、列递推，再显示答案。`;
      return;
    }
    els.answerBox.className = 'exact';
    els.answerBox.innerHTML = `传球 ${state.n} 次后球回到甲手上的概率为 <b>${formatFraction(success, total)}</b>，约为 <b>${(prob * 100).toFixed(1)}%</b>。${state.n === 4 ? '本题答案就是 3/8。' : ''}`;
  }

  function buildFormulaSteps(expanded){
    const fracList = probabilitySequence(state.n);
    const lines = [];
    lines.push(`<div class="step"><b>设</b> 第 n 次传球后球在甲手中的概率为 <b>p<sub>n</sub></b>。</div>`);
    lines.push(`<div class="step"><b>初值：</b>第一次传球后球一定不在甲手里，所以 <b>p<sub>1</sub> = 0</b>。</div>`);
    lines.push(`<div class="step"><b>递推：</b>要想第 n 次后球在甲手里，那么第 n-1 次后球必须不在甲手里；而此时球在乙或丙手中，下一次传给甲的概率都为 <b>1/2</b>，所以 <b>p<sub>n</sub> = (1 - p<sub>n-1</sub>) / 2</b>。</div>`);
    lines.push(`<div class="step"><b>逐步计算：</b> ${fracList.map((x, i) => `p<sub>${i + 1}</sub> = ${x}`).join('，')}</div>`);
    if (expanded){
      lines.push(`<div class="step"><b>本题：</b>所以 <b>p<sub>${state.n}</sub> = ${fracList[state.n - 1]}</b>。这与样本空间枚举及随机实验的结果是一致的。</div>`);
    }
    els.formulaBox.innerHTML = lines.join('');
  }

  function refreshFormulaVisibility(){
    if (els.formulaMode.value === 'hide') {
      els.formulaPanel.style.display = 'none';
    } else {
      els.formulaPanel.style.display = '';
    }
  }

  function probabilitySequence(n){
    let num = 0, den = 1;
    const arr = [formatFraction(num, den)];
    for(let k = 2; k <= n; k++){
      const newNum = den - num;
      const newDen = 2 * den;
      const g = gcd(newNum, newDen);
      num = newNum / g;
      den = newDen / g;
      arr.push(formatFraction(num, den));
    }
    return arr;
  }

  function formatFraction(a, b){
    const g = gcd(a, b);
    a /= g; b /= g;
    return b === 1 ? `${a}` : `${a}/${b}`;
  }

  function gcd(a, b){
    a = Math.abs(a); b = Math.abs(b);
    while(b){ const t = a % b; a = b; b = t; }
    return a || 1;
  }

  init();
})();
