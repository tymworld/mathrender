const ROWS = 12;
const BINS = ROWS + 1;

let selectedTrials = 500;
let counts = new Array(BINS).fill(0);
let completed = 0;
let animFrame = null;
let emitted = 0;
let activeBalls = [];
let impactBursts = [];
let lastFrameTime = 0;
let showTheoryCurve = true;

const runBtn = document.getElementById('runBtn');
const curveBtn = document.getElementById('curveBtn');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const emptyState = document.getElementById('emptyState');

const statProgress = document.getElementById('statProgress');
const statPeak = document.getElementById('statPeak');
const statRows = document.getElementById('statRows');
const statBins = document.getElementById('statBins');
const insight = document.getElementById('insight');

statRows.textContent = String(ROWS);
statBins.textContent = String(BINS);

function chooseOneBall() {
  let right = 0;
  for (let i = 0; i < ROWS; i++) {
    if (Math.random() < 0.5) right++;
  }
  return right;
}

function makeBallPath() {
  const decisions = [];
  const prefixRights = [0];
  let rights = 0;
  for (let i = 0; i < ROWS; i++) {
    const goRight = Math.random() < 0.5;
    decisions.push(goRight);
    if (goRight) rights++;
    prefixRights.push(rights);
  }
  return {
    x: (Math.random() - 0.5) * 0.04,
    y: -0.76 - Math.random() * 0.28,
    vx: (Math.random() - 0.5) * 0.004,
    vy: 0.016 + Math.random() * 0.01,
    nextPeg: 0,
    decisions,
    prefixRights,
    bin: rights,
    squash: 0,
    size: 0.92 + Math.random() * 0.16,
    trail: []
  };
}

function deterministicNoise(a, b) {
  const value = Math.sin((a + 1) * 91.733 + (b + 1) * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function comb(n, k) {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result = (result * (n - k + i)) / i;
  }
  return result;
}

function peakBin() {
  let p = 0;
  for (let i = 1; i < BINS; i++) {
    if (counts[i] > counts[p]) p = i;
  }
  return p;
}

function drawScene() {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.parentElement.clientWidth - 36;
  const cssH = 520;
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const pad = { top: 18, right: 24, bottom: 34, left: 24 };
  const W = cssW - pad.left - pad.right;
  const H = cssH - pad.top - pad.bottom;
  const gap = 24;
  const boardW = W * 0.55;
  const histW = W - boardW - gap;

  ctx.clearRect(0, 0, cssW, cssH);

  const left = pad.left + 34;
  const right = pad.left + boardW - 34;
  const top = pad.top + 78;
  const troughTop = pad.top + H - 112;
  const troughBottom = pad.top + H - 28;

  const histLeft = pad.left + boardW + gap;
  const histRight = pad.left + boardW + gap + histW;
  const histTop = pad.top + 42;
  const histBottom = pad.top + H - 42;
  const histH = histBottom - histTop;

  const boardSpan = right - left;
  const binStep = boardSpan / ROWS;
  const centerX = (left + right) / 2;
  const outerLeft = left - binStep / 2;
  const outerRight = right + binStep / 2;
  const lastPegY = troughTop - 28;
  const rowGap = (lastPegY - top) / (ROWS - 1);

  const panelX = outerLeft - 9;
  const panelY = top - 24;
  const panelW = outerRight - outerLeft + 18;
  const panelH = troughBottom - panelY + 9;

  // Clear acrylic plate: soft shadow, blue-tinted thickness and diagonal reflections.
  ctx.save();
  ctx.shadowColor = 'rgba(19,45,70,0.2)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 7;
  ctx.fillStyle = 'rgba(219,235,247,0.42)';
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelW, panelH, 9);
  ctx.fill();
  ctx.restore();

  const glassGrad = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY + panelH);
  glassGrad.addColorStop(0, 'rgba(238,248,255,0.7)');
  glassGrad.addColorStop(0.42, 'rgba(218,237,250,0.22)');
  glassGrad.addColorStop(0.72, 'rgba(255,255,255,0.46)');
  glassGrad.addColorStop(1, 'rgba(189,216,235,0.48)');
  ctx.fillStyle = glassGrad;
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelW, panelH, 9);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(panelX + 2, panelY + 2, panelW - 4, panelH - 4, 7);
  ctx.clip();
  const reflection = ctx.createLinearGradient(panelX, panelY, outerRight, troughBottom);
  reflection.addColorStop(0, 'rgba(255,255,255,0)');
  reflection.addColorStop(0.34, 'rgba(255,255,255,0.34)');
  reflection.addColorStop(0.47, 'rgba(255,255,255,0.05)');
  reflection.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = reflection;
  ctx.beginPath();
  ctx.moveTo(panelX + panelW * 0.08, panelY);
  ctx.lineTo(panelX + panelW * 0.35, panelY);
  ctx.lineTo(panelX + panelW * 0.7, troughBottom);
  ctx.lineTo(panelX + panelW * 0.48, troughBottom);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Brushed-metal outer rails and entry funnel.
  const metalGrad = ctx.createLinearGradient(panelX, 0, panelX + panelW, 0);
  metalGrad.addColorStop(0, '#516b7f');
  metalGrad.addColorStop(0.16, '#dbe7ee');
  metalGrad.addColorStop(0.5, '#8399aa');
  metalGrad.addColorStop(0.84, '#eef6fa');
  metalGrad.addColorStop(1, '#4d6679');
  ctx.save();
  ctx.strokeStyle = metalGrad;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(14,35,52,0.24)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  ctx.moveTo(outerLeft, top - 5);
  ctx.lineTo(outerLeft, troughBottom + 1);
  ctx.lineTo(outerRight, troughBottom + 1);
  ctx.lineTo(outerRight, top - 5);
  ctx.moveTo(centerX - 32, top - 59);
  ctx.lineTo(centerX - 8, top - 15);
  ctx.moveTo(centerX + 32, top - 59);
  ctx.lineTo(centerX + 8, top - 15);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = 'rgba(255,255,255,0.72)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(outerLeft + 2, top - 3);
  ctx.lineTo(outerLeft + 2, troughBottom - 2);
  ctx.moveTo(outerRight - 2, top - 3);
  ctx.lineTo(outerRight - 2, troughBottom - 2);
  ctx.stroke();

  const drawScrew = (x, y) => {
    ctx.save();
    ctx.shadowColor = 'rgba(18,39,55,0.3)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1.5;
    const screwGrad = ctx.createRadialGradient(x - 1.4, y - 1.4, 0.4, x, y, 5.8);
    screwGrad.addColorStop(0, '#ffffff');
    screwGrad.addColorStop(0.38, '#b9cbd6');
    screwGrad.addColorStop(0.76, '#687e8e');
    screwGrad.addColorStop(1, '#30495d');
    ctx.fillStyle = screwGrad;
    ctx.beginPath();
    ctx.arc(x, y, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(35,54,69,0.72)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - 2.1, y + 1.2);
    ctx.lineTo(x + 2.1, y - 1.2);
    ctx.stroke();
  };

  drawScrew(panelX + 13, panelY + 14);
  drawScrew(panelX + panelW - 13, panelY + 14);
  drawScrew(panelX + 13, troughBottom - 10);
  drawScrew(panelX + panelW - 13, troughBottom - 10);

  // Pegs
  for (let r = 0; r < ROWS; r++) {
    const y = top + r * rowGap;
    const cols = r + 1;
    const rowLeft = centerX - (cols - 1) * (binStep / 2);
    for (let c = 0; c < cols; c++) {
      const x = rowLeft + c * binStep;
      ctx.fillStyle = 'rgba(25,52,72,0.22)';
      ctx.beginPath();
      ctx.ellipse(x + 1.8, y + 2.3, 5.2, 4.1, 0, 0, Math.PI * 2);
      ctx.fill();
      const pegGrad = ctx.createRadialGradient(x - 1.8, y - 1.9, 0.35, x, y, 5.4);
      pegGrad.addColorStop(0, '#ffffff');
      pegGrad.addColorStop(0.3, '#e5eef3');
      pegGrad.addColorStop(0.62, '#8da4b4');
      pegGrad.addColorStop(0.86, '#536c7e');
      pegGrad.addColorStop(1, '#263f52');
      ctx.fillStyle = pegGrad;
      ctx.beginPath();
      ctx.arc(x, y, 5.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.arc(x - 0.8, y - 0.8, 2.5, Math.PI * 1.05, Math.PI * 1.65);
      ctx.stroke();
    }
  }

  // Deep receiving trough with thick acrylic partitions.
  const troughGrad = ctx.createLinearGradient(0, troughTop, 0, troughBottom);
  troughGrad.addColorStop(0, 'rgba(183,211,230,0.18)');
  troughGrad.addColorStop(1, 'rgba(91,132,162,0.2)');
  ctx.fillStyle = troughGrad;
  ctx.fillRect(outerLeft + 3, troughTop, outerRight - outerLeft - 6, troughBottom - troughTop);
  for (let i = 0; i <= BINS; i++) {
    const x = outerLeft + i * binStep;
    ctx.strokeStyle = 'rgba(45,72,91,0.3)';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(x, troughTop);
    ctx.lineTo(x, troughBottom - 1);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(245,251,255,0.82)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 1, troughTop + 1);
    ctx.lineTo(x - 1, troughBottom - 2);
    ctx.stroke();
  }

  const baseGrad = ctx.createLinearGradient(0, troughBottom - 4, 0, troughBottom + 5);
  baseGrad.addColorStop(0, '#eaf2f6');
  baseGrad.addColorStop(0.35, '#788e9d');
  baseGrad.addColorStop(1, '#344e61');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(outerLeft - 1, troughBottom - 3, outerRight - outerLeft + 2, 7);

  // Settled balls use close packing with tiny deterministic imperfections.
  for (let i = 0; i < BINS; i++) {
    const radius = 3.25;
    const spacingX = radius * 2.02;
    const spacingY = radius * 1.72;
    const chipsPerRow = Math.max(2, Math.floor((binStep - 5) / spacingX));
    const maxRows = Math.max(1, Math.floor((troughBottom - troughTop - 7) / spacingY));
    const chipCount = Math.min(counts[i], chipsPerRow * maxRows);
    const centerOrder = Array.from({ length: chipsPerRow }, (_, index) => index)
      .sort((a, b) => Math.abs(a - (chipsPerRow - 1) / 2) - Math.abs(b - (chipsPerRow - 1) / 2));
    for (let n = 0; n < chipCount; n++) {
      const row = Math.floor(n / chipsPerRow);
      const position = n % chipsPerRow;
      const col = centerOrder[position];
      const jitterX = (deterministicNoise(i, n) - 0.5) * 0.7;
      const jitterY = (deterministicNoise(n, i + 19) - 0.5) * 0.35;
      const stagger = row % 2 ? spacingX * 0.22 : 0;
      const x = left + i * binStep + (col - (chipsPerRow - 1) / 2) * spacingX + stagger + jitterX;
      const y = troughBottom - radius - 2 - row * spacingY + jitterY;
      ctx.fillStyle = `hsla(${17 + deterministicNoise(i + 7, n) * 8}, 58%, ${48 + deterministicNoise(n + 3, i) * 8}%, 0.9)`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const toScreen = (x, y) => {
    const screenX = centerX + x * binStep;
    let screenY;
    if (y <= ROWS - 1) {
      screenY = top + y * rowGap;
    } else {
      screenY = lastPegY + (y - (ROWS - 1)) * (troughBottom - radiusForBall() - lastPegY);
    }
    return { x: screenX, y: screenY };
  };

  // Short-lived rings make each peg collision legible without obscuring the board.
  for (const burst of impactBursts) {
    const point = toScreen(burst.x, burst.y);
    ctx.strokeStyle = `rgba(224,132,79,${burst.life * 0.42})`;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5 + (1 - burst.life) * 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Active balls now accelerate, deflect at each peg and briefly squash on impact.
  const detailedBalls = activeBalls.length < 420;
  for (const ball of activeBalls) {
    const point = toScreen(ball.x, ball.y);
    if (detailedBalls && ball.trail.length > 1) {
      ctx.strokeStyle = 'rgba(178,87,51,0.13)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ball.trail.forEach((trailPoint, index) => {
        const trail = toScreen(trailPoint.x, trailPoint.y);
        if (index === 0) ctx.moveTo(trail.x, trail.y);
        else ctx.lineTo(trail.x, trail.y);
      });
      ctx.stroke();
    }

    const radius = radiusForBall() * ball.size;
    if (detailedBalls) {
      const ballGrad = ctx.createRadialGradient(
        point.x - radius * 0.35,
        point.y - radius * 0.4,
        radius * 0.2,
        point.x,
        point.y,
        radius * 1.1
      );
      ballGrad.addColorStop(0, '#ffd7b9');
      ballGrad.addColorStop(0.32, '#df7a49');
      ballGrad.addColorStop(1, '#883817');
      ctx.fillStyle = ballGrad;
      ctx.shadowColor = 'rgba(83,35,14,0.32)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
    } else {
      ctx.fillStyle = 'rgba(198,91,48,0.9)';
    }
    const stretchX = 1 + ball.squash * 0.22;
    const stretchY = 1 - ball.squash * 0.18;
    ctx.beginPath();
    ctx.ellipse(point.x, point.y, radius * stretchX, radius * stretchY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
  }

  // Histogram axes
  ctx.strokeStyle = 'rgba(22,32,45,0.26)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(histLeft, histBottom);
  ctx.lineTo(histRight, histBottom);
  ctx.moveTo(histLeft, histTop);
  ctx.lineTo(histLeft, histBottom);
  ctx.stroke();

  const maxCount = Math.max(1, ...counts);
  const theoryPeak = completed * comb(ROWS, Math.floor(ROWS / 2)) / Math.pow(2, ROWS);
  const verticalMax = showTheoryCurve && completed > 0 ? Math.max(maxCount, theoryPeak) : maxCount;
  const histBinStep = (histRight - histLeft) / BINS;

  // Bars
  for (let i = 0; i < BINS; i++) {
    const x = histLeft + i * histBinStep + histBinStep * 0.08;
    const w = histBinStep * 0.84;
    const h = (counts[i] / verticalMax) * (histH - 10);
    const y = histBottom - h;
    const grad = ctx.createLinearGradient(x, y, x, histBottom);
    grad.addColorStop(0, 'rgba(36,94,157,0.82)');
    grad.addColorStop(1, 'rgba(36,94,157,0.26)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, [4, 4, 0, 0]);
    ctx.fill();
  }

  // Theoretical binomial curve (scaled)
  if (completed > 0 && showTheoryCurve) {
    ctx.strokeStyle = '#b25733';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let k = 0; k < BINS; k++) {
      const prob = comb(ROWS, k) / Math.pow(2, ROWS);
      const expect = completed * prob;
      const x = histLeft + (k + 0.5) * histBinStep;
      const y = histBottom - (expect / verticalMax) * (histH - 10);
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // x labels
  ctx.fillStyle = '#1a2636';
  ctx.font = 'bold 16px "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  const tickStep = 2;
  for (let i = 0; i < BINS; i += tickStep) {
    ctx.fillText(String(i), histLeft + (i + 0.5) * histBinStep, histBottom + 22);
  }

  // section labels
  ctx.fillStyle = 'rgba(22,32,45,0.58)';
  ctx.font = 'bold 17px "PingFang SC", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('高尔顿板钉阵', left, top - 14);
  ctx.fillText('落点分布直方图', histLeft, histTop - 10);

  // legend
  ctx.fillStyle = 'rgba(36,94,157,0.75)';
  ctx.fillRect(histRight - 214, histTop - 26, 20, 12);
  ctx.fillStyle = '#16202d';
  ctx.font = 'bold 16px "PingFang SC", sans-serif';
  ctx.fillText('模拟分布', histRight - 188, histTop - 16);

  if (showTheoryCurve) {
    ctx.strokeStyle = '#b25733';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(histRight - 214, histTop - 2);
    ctx.lineTo(histRight - 194, histTop - 2);
    ctx.stroke();
    ctx.fillStyle = '#16202d';
    ctx.fillText('理论二项曲线', histRight - 188, histTop + 2);
  }
}

function radiusForBall() {
  return 3.8;
}

function updateStats() {
  statProgress.textContent = `${completed.toLocaleString('zh-CN')} / ${selectedTrials.toLocaleString('zh-CN')}`;
  if (completed === 0) {
    statPeak.textContent = '—';
    return;
  }
  const p = peakBin();
  statPeak.textContent = `${p} 号槽`;
}

function finishInsight() {
  const p = peakBin();
  const distance = Math.abs(p - ROWS / 2);
  const level = selectedTrials >= 3000 ? '更稳定' : '仍有波动';
  const central = distance <= 1.5 ? '非常靠近中间槽' : '与中间槽有偏差';
  insight.innerHTML = `
    已完成 <span class="hl">${selectedTrials.toLocaleString('zh-CN')}</span> 次试验，峰值在 <span class="hl2">${p} 号槽</span>。
    当前分布 <span class="hl">${level}</span>，并且 <span class="hl2">${central}</span>。
  `;
}

function stepSimulation(timestamp) {
  const elapsed = lastFrameTime ? timestamp - lastFrameTime : 1000 / 60;
  const baseFrameScale = Math.min(2.2, Math.max(0.45, elapsed / (1000 / 60)));
  const speedMultiplier =
    selectedTrials >= 10000 ? 2.25 :
    selectedTrials >= 3000 ? 1.75 :
    selectedTrials >= 1000 ? 1.3 : 1;
  const frameScale = baseFrameScale * speedMultiplier;
  lastFrameTime = timestamp;

  const spawnPerFrame = Math.max(1, Math.ceil(selectedTrials / 360));
  const activeLimit = selectedTrials >= 10000 ? 2400 : selectedTrials >= 3000 ? 1800 : 1000;
  const spawnCount = Math.min(spawnPerFrame, selectedTrials - emitted, activeLimit - activeBalls.length);
  for (let i = 0; i < spawnCount; i++) {
    activeBalls.push(makeBallPath());
    emitted++;
  }

  for (let i = activeBalls.length - 1; i >= 0; i--) {
    const ball = activeBalls[i];
    ball.trail.unshift({ x: ball.x, y: ball.y });
    if (ball.trail.length > 4) ball.trail.pop();

    const substeps = Math.ceil(frameScale);
    const substepScale = frameScale / substeps;
    for (let step = 0; step < substeps; step++) {
      ball.vy += 0.0115 * substepScale;
      ball.x += ball.vx * substepScale;
      ball.y += ball.vy * substepScale;

      if (ball.nextPeg < ROWS && ball.y >= ball.nextPeg) {
        const peg = ball.nextPeg;
        const pegX = ball.prefixRights[peg] - peg / 2;
        const direction = ball.decisions[peg] ? 1 : -1;
        ball.x = pegX + direction * (0.11 + Math.random() * 0.025);
        ball.y = peg + 0.012;
        ball.vx = direction * (0.04 + Math.random() * 0.008);
        ball.vy = 0.024 + Math.random() * 0.01;
        ball.squash = 1;
        if (activeBalls.length < 420 && impactBursts.length < 28 && Math.random() < 0.18) {
          impactBursts.push({ x: pegX, y: peg, life: 1 });
        }
        ball.nextPeg++;
      }
    }
    ball.vx *= Math.pow(0.998, frameScale);
    ball.squash *= Math.pow(0.68, frameScale);

    if (ball.y >= ROWS) {
      counts[ball.bin]++;
      completed++;
      activeBalls.splice(i, 1);
    }
  }

  for (let i = impactBursts.length - 1; i >= 0; i--) {
    impactBursts[i].life -= 0.075 * frameScale;
    if (impactBursts[i].life <= 0) impactBursts.splice(i, 1);
  }

  updateStats();
  drawScene();

  if (completed < selectedTrials || activeBalls.length > 0 || emitted < selectedTrials) {
    animFrame = requestAnimationFrame(stepSimulation);
  } else {
    animFrame = null;
    finishInsight();
    runBtn.disabled = false;
    runBtn.textContent = '▶ 重新模拟';
  }
}

function startSimulation() {
  if (animFrame) cancelAnimationFrame(animFrame);
  counts = new Array(BINS).fill(0);
  completed = 0;
  emitted = 0;
  activeBalls = [];
  impactBursts = [];
  lastFrameTime = 0;

  emptyState.style.display = 'none';
  runBtn.disabled = true;
  runBtn.textContent = '模拟中...';

  updateStats();
  drawScene();
  insight.textContent = '模拟进行中：小球正在不断落入各槽位。';
  animFrame = requestAnimationFrame(stepSimulation);
}

document.querySelectorAll('.trial-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.trial-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedTrials = parseInt(btn.dataset.n);
    updateStats();
    if (!animFrame && completed === 0) {
      drawScene();
    }
  });
});

runBtn.addEventListener('click', startSimulation);

curveBtn.addEventListener('click', () => {
  showTheoryCurve = !showTheoryCurve;
  curveBtn.classList.toggle('active', showTheoryCurve);
  drawScene();
});

window.addEventListener('resize', () => {
  if (!emptyState || emptyState.style.display === 'none') drawScene();
});

updateStats();
drawScene();
