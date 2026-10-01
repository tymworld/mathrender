// ---- Box-Muller 正态随机数 ----
function randNormal(mu, sigma) {
  let u, v;
  do { u = Math.random(); } while (u === 0);
  do { v = Math.random(); } while (v === 0);
  return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ---- 正态PDF ----
function normalPDF(x, mu, sigma) {
  const coeff = 1 / (sigma * Math.sqrt(2 * Math.PI));
  return coeff * Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
}

// ---- State ----
let selectedN = 200;
let chartInstance = null;

// ---- UI refs ----
const meanInput = document.getElementById('mean');
const varInput  = document.getElementById('variance');
const binsSlider = document.getElementById('bins');
const binsVal    = document.getElementById('binsVal');
const runBtn     = document.getElementById('runBtn');
const statsBar   = document.getElementById('statsBar');
const emptyState = document.getElementById('emptyState');
const insight    = document.getElementById('insight');
const canvas     = document.getElementById('chart');
const ctx        = canvas.getContext('2d');

// ---- Bins slider live update ----
binsSlider.addEventListener('input', () => {
  binsVal.textContent = binsSlider.value;
  if (lastSamples.length > 0) reRender();
});

// ---- Trial buttons ----
document.querySelectorAll('.trial-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.trial-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedN = parseInt(btn.dataset.n);
  });
});

// ---- Run experiment ----
let lastSamples = [];
let simulationParams = { mu: 0, sigma2: 1 };

runBtn.addEventListener('click', runExperiment);

function runExperiment() {
  const meanValue = meanInput.value.trim() === '' ? NaN : Number(meanInput.value);
  const varianceValue = varInput.value.trim() === '' ? NaN : Number(varInput.value);
  const mu = Number.isFinite(meanValue) ? Math.min(1e6, Math.max(-1e6, meanValue)) : 0;
  const sigma2 = Number.isFinite(varianceValue) ? Math.min(1e12, Math.max(0.01, varianceValue)) : 1;
  meanInput.value = mu;
  varInput.value = sigma2;
  simulationParams = { mu, sigma2 };
  const sigma = Math.sqrt(sigma2);
  const n = selectedN;

  // Generate samples
  lastSamples = Array.from({ length: n }, () => randNormal(mu, sigma));
  reRender(mu, sigma);
}

function reRender(mu, sigma) {
  if (lastSamples.length === 0) return;

  const muVal = simulationParams.mu;
  const sig2 = simulationParams.sigma2;
  if (mu === undefined) mu = muVal;
  if (sigma === undefined) sigma = Math.sqrt(sig2);

  const n = lastSamples.length;
  const bins = parseInt(binsSlider.value);

  const min_ = Math.min(...lastSamples);
  const max_ = Math.max(...lastSamples);
  // Pad slightly
  const pad = (max_ - min_) * 0.05 || sigma;
  const lo = min_ - pad;
  const hi = max_ + pad;
  const width = (hi - lo) / bins;

  // Histogram counts
  const counts = new Array(bins).fill(0);
  for (const x of lastSamples) {
    const i = Math.min(bins - 1, Math.floor((x - lo) / width));
    counts[i]++;
  }
  // Normalize to density
  const densities = counts.map(c => c / (n * width));

  // Bin centers for labels
  const labels = counts.map((_, i) => {
    const center = lo + (i + 0.5) * width;
    return center.toFixed(1);
  });

  // Normal curve overlay (sample at bin centers + fine points)
  const curvePoints = 300;
  const curveStep = (hi - lo) / curvePoints;
  const curveX = Array.from({ length: curvePoints + 1 }, (_, i) => lo + i * curveStep);
  const curveY = curveX.map(x => normalPDF(x, mu, sigma));

  // Map curve to bar chart "x index" space using fractional positions
  const curveData = curveX.map(x => ({
    x: (x - lo) / width,
    y: normalPDF(x, mu, sigma)
  }));

  // Compute stats
  const sampleMean = lastSamples.reduce((a, b) => a + b, 0) / n;
  const sampleVar  = lastSamples.reduce((a, b) => a + (b - sampleMean) ** 2, 0) / (n - 1);

  // Update stat boxes
  document.getElementById('statN').textContent = n.toLocaleString('zh-CN');
  document.getElementById('statMean').textContent = sampleMean.toFixed(3);
  document.getElementById('statVar').textContent = sampleVar.toFixed(3);
  document.getElementById('statThMean').textContent = mu.toFixed(2);
  document.getElementById('statThVar').textContent = sig2.toFixed(3);
  statsBar.style.display = 'flex';

  // Destroy old chart
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
  emptyState.style.display = 'none';

  // Draw using Canvas API
  drawChart(densities, labels, curveData, bins, lo, hi, width, mu, sigma);

  // Insight text
  insight.style.display = 'block';
  let level, color;
  if (n <= 30)       { level = '较少'; color = 'highlight2'; }
  else if (n <= 200) { level = '中等'; color = 'highlight2'; }
  else               { level = '大量'; color = 'highlight'; }

  insight.innerHTML = `
    本次抽取了 <span class="${color}">${n}</span> 个样本（${level}数据）——
    本实验从正态总体抽样；固定分组时，样本更多通常使频率密度更稳定。
    橙色曲线是理论正态密度。单次结果仍有随机波动，增加样本不会把任意总体变成正态分布。
  `;
}

// ---- Animated Canvas Chart ----
let animFrame = null;

function drawChart(densities, labels, curveData, bins, lo, hi, width, mu, sigma) {
  if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }

  const dpr = window.devicePixelRatio || 1;
  const W_CSS = canvas.parentElement.clientWidth - 40;
  const H_CSS = 420;
  canvas.style.width  = W_CSS + 'px';
  canvas.style.height = H_CSS + 'px';
  canvas.width  = W_CSS * dpr;
  canvas.height = H_CSS * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const pad = { top: 28, right: 28, bottom: 72, left: 76 };
  const W = W_CSS - pad.left - pad.right;
  const H = H_CSS - pad.top  - pad.bottom;
  const maxDensity = Math.max(...densities, ...curveData.map(p => p.y));
  const yMax = maxDensity * 1.12;

  const toX  = (i)  => pad.left + (i / bins) * W;
  const toXc = (fi) => pad.left + (fi / bins) * W;
  const toY  = (d)  => pad.top + H - (d / yMax) * H;

  const DURATION = 600; // ms
  const start = performance.now();

  function frame(now) {
    const t = Math.min(1, (now - start) / DURATION);
    // ease out cubic
    const ease = 1 - Math.pow(1 - t, 3);

    ctx.clearRect(0, 0, W_CSS, H_CSS);

    // Grid lines + Y labels
    ctx.strokeStyle = 'rgba(22,32,45,0.07)';
    ctx.lineWidth = 1;
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const y = pad.top + (i / yTicks) * H;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + W, y);
      ctx.stroke();
      const val = yMax * (1 - i / yTicks);
      ctx.fillStyle = '#1a2636';
      ctx.font = `bold 18px "PingFang SC", sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(2), pad.left - 10, y + 6);
    }

    // Bars (animated height)
    const barW = W / bins;
    for (let i = 0; i < bins; i++) {
      const x = toX(i);
      const fullH = (densities[i] / yMax) * H;
      const barH  = fullH * ease;
      const y = pad.top + H - barH;
      const grad = ctx.createLinearGradient(x, y, x, pad.top + H);
      grad.addColorStop(0, 'rgba(36,94,157,0.80)');
      grad.addColorStop(1, 'rgba(36,94,157,0.28)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x + 1, y, barW - 2, barH, [5, 5, 0, 0]);
      ctx.fill();
    }

    // Normal curve (fade in)
    ctx.globalAlpha = ease;
    ctx.strokeStyle = '#b25733';
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let first = true;
    for (const pt of curveData) {
      const cx = toXc(pt.x);
      const cy = toY(pt.y);
      if (cx < pad.left - 2 || cx > pad.left + W + 2) continue;
      if (first) { ctx.moveTo(cx, cy); first = false; }
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Mean dashed line
    const meanFrac = (mu - lo) / (hi - lo);
    const meanXpx = pad.left + meanFrac * W;
    if (meanXpx >= pad.left && meanXpx <= pad.left + W) {
      ctx.globalAlpha = ease;
      ctx.strokeStyle = 'rgba(178,87,51,0.55)';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.moveTo(meanXpx, pad.top);
      ctx.lineTo(meanXpx, pad.top + H);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#b25733';
      ctx.font = `bold 17px "PingFang SC",sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`μ = ${mu.toFixed(1)}`, meanXpx, pad.top - 6);
      ctx.globalAlpha = 1;
    }

    // Axes
    ctx.strokeStyle = 'rgba(22,32,45,0.22)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, pad.top + H);
    ctx.lineTo(pad.left + W, pad.top + H);
    ctx.stroke();

    // X labels
    ctx.fillStyle = '#1a2636';
    ctx.font = `bold 18px "PingFang SC",sans-serif`;
    ctx.textAlign = 'center';
    const step = Math.max(1, Math.round(bins / 10));
    for (let i = 0; i <= bins; i += step) {
      const xVal = lo + i * width;
      ctx.fillText(xVal.toFixed(1), toX(i), pad.top + H + 24);
    }

    // Axis titles
    ctx.fillStyle = '#16202d';
    ctx.font = `bold 19px "PingFang SC",sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('数值', pad.left + W / 2, H_CSS - 6);
    ctx.save();
    ctx.translate(18, pad.top + H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('频率密度', 0, 0);
    ctx.restore();

    // Legend
    const lx = pad.left + W - 200;
    const ly = pad.top + 14;
    ctx.fillStyle = 'rgba(36,94,157,0.70)';
    ctx.fillRect(lx, ly, 24, 16);
    ctx.fillStyle = '#16202d';
    ctx.font = `bold 16px "PingFang SC",sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('样本频率直方图', lx + 30, ly + 13);
    ctx.strokeStyle = '#b25733';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(lx, ly + 32);
    ctx.lineTo(lx + 24, ly + 32);
    ctx.stroke();
    ctx.fillStyle = '#16202d';
    ctx.fillText('理论正态曲线', lx + 30, ly + 36);

    if (t < 1) animFrame = requestAnimationFrame(frame);
  }

  animFrame = requestAnimationFrame(frame);
}

// ---- Resize redraw ----
window.addEventListener('resize', () => {
  if (lastSamples.length > 0) reRender();
});
