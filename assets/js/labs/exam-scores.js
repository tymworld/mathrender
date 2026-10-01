// Box-Muller
function randNormal(mu, sigma) {
  let u, v;
  do { u = Math.random(); } while (u === 0);
  do { v = Math.random(); } while (v === 0);
  return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function normalPDF(x, mu, sigma) {
  return (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
}

// Clamp scores to [0,100]
function genClass(mu, sigma, size) {
  return Array.from({ length: size }, () => Math.min(100, Math.max(0, Math.round(randNormal(mu, sigma)))));
}

// State
let selectedClassSet = new Set([1]); // multi-select
let animFrame = null;
let classData = {}; // class number -> fixed scores for this simulation
let simulationParams = { mu: 75, sigma: 10, size: 40 };
let showCurve = true;

// UI refs
const meanInput      = document.getElementById('mean');
const sigmaInput     = document.getElementById('sigma');
const classSizeInput = document.getElementById('classSize');
const binsSlider     = document.getElementById('bins');
const binsVal        = document.getElementById('binsVal');
const runBtn         = document.getElementById('runBtn');
const statsBar       = document.getElementById('statsBar');
const bodyGrid       = document.getElementById('bodyGrid');
const initChart      = document.getElementById('initChart');
const emptyState     = document.getElementById('emptyState');
const insight        = document.getElementById('insight');
const canvas         = document.getElementById('chart');
const ctx            = canvas.getContext('2d');
const classTableBody = document.getElementById('classTableBody');

binsSlider.addEventListener('input', () => {
  binsVal.textContent = binsSlider.value;
  if (Object.keys(classData).length > 0) reRender();
});

document.querySelectorAll('.class-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const n = parseInt(btn.dataset.n);
    if (selectedClassSet.has(n)) {
      // Always keep at least one selected
      if (selectedClassSet.size > 1) {
        selectedClassSet.delete(n);
        btn.classList.remove('active');
      }
    } else {
      selectedClassSet.add(n);
      btn.classList.add('active');
    }
    btn.setAttribute('aria-pressed', String(selectedClassSet.has(n)));
    if (Object.keys(classData).length > 0) reRender();
  });
});

runBtn.addEventListener('click', runExperiment);

document.getElementById('curveBtn').addEventListener('click', () => {
  showCurve = !showCurve;
  document.getElementById('curveBtn').classList.toggle('active', showCurve);
  if (Object.keys(classData).length > 0) reRender();
});

function runExperiment() {
  const numeric = (input, fallback, min, max) => {
    const value = input.value.trim() === '' ? NaN : Number(input.value);
    const valid = Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
    input.value = valid;
    return valid;
  };
  const mu = numeric(meanInput, 75, 0, 100);
  const sigma = numeric(sigmaInput, 10, 1, 30);
  const size = Math.round(numeric(classSizeInput, 40, 10, 60));
  classSizeInput.value = size;
  simulationParams = { mu, sigma, size };

  // classData is a Map: classNumber -> scores array
  classData = {};
  for (let cn = 1; cn <= 10; cn++) {
    classData[cn] = genClass(mu, sigma, size);
  }

  reRender();
}

function reRender() {
  if (Object.keys(classData).length === 0) return;

  const { mu, sigma } = simulationParams;
  const bins  = parseInt(binsSlider.value);
  const classNums = [...selectedClassSet].sort((a, b) => a - b);
  const nClasses  = classNums.length;

  // Flatten all scores
  const allScores = classNums.flatMap(cn => classData[cn]);
  const n = allScores.length;

  // Stats
  const sampleMean = allScores.reduce((a, b) => a + b, 0) / n;
  const sampleSd   = Math.sqrt(allScores.reduce((a, b) => a + (b - sampleMean) ** 2, 0) / (n - 1));
  const minScore   = Math.min(...allScores);
  const maxScore   = Math.max(...allScores);

  // Update stats bar
  document.getElementById('statN').textContent    = n.toLocaleString('zh-CN');
  document.getElementById('statMean').textContent = sampleMean.toFixed(1);
  document.getElementById('statSd').textContent   = sampleSd.toFixed(1);
  document.getElementById('statMin').textContent  = minScore;
  document.getElementById('statMax').textContent  = maxScore;
  statsBar.style.display = 'flex';

  // Class table
  classTableBody.innerHTML = '';
  for (const cn of classNums) {
    const cls = classData[cn];
    const exactMean = cls.reduce((a, b) => a + b, 0) / cls.length;
    const cm = exactMean.toFixed(1);
    const csd = Math.sqrt(cls.reduce((a, b) => a + (b - exactMean) ** 2, 0) / (cls.length - 1)).toFixed(1);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="highlight">${cn}</td>
      <td>${cls.length}</td>
      <td>${cm}</td>
      <td>${csd}</td>
    `;
    classTableBody.appendChild(tr);
  }
  // Total row
  const totTr = document.createElement('tr');
  totTr.style.background = 'rgba(29,122,79,0.07)';
  totTr.innerHTML = `
    <td class="highlight" style="font-size:17px">∑</td>
    <td class="highlight">${n}</td>
    <td class="highlight">${sampleMean.toFixed(1)}</td>
    <td class="highlight">${sampleSd.toFixed(1)}</td>
  `;
  classTableBody.appendChild(totTr);

  // Show body grid, hide init chart
  bodyGrid.style.display = 'grid';
  initChart.style.display = 'none';
  emptyState.style.display = 'none';

  // Histogram: scores 0-100
  const lo = 0, hi = 100;
  const binWidth = (hi - lo) / bins;
  const counts = new Array(bins).fill(0);
  for (const s of allScores) {
    const i = Math.min(bins - 1, Math.floor((s - lo) / binWidth));
    counts[i]++;
  }
  const densities = counts.map(c => c / (n * binWidth));

  // Normal curve
  const curvePoints = 400;
  const curveData = Array.from({ length: curvePoints + 1 }, (_, i) => {
    const x = lo + (i / curvePoints) * (hi - lo);
    return { x: (x - lo) / binWidth, y: normalPDF(x, mu, sigma) };
  });

  drawChart(densities, curveData, bins, lo, hi, binWidth, mu, sigma, n, nClasses, classNums);

  // Insight
  insight.style.display = 'block';
  let level, col;
  if (nClasses <= 2)      { level = '较少'; col = 'hl2'; }
  else if (nClasses <= 5) { level = '中等'; col = 'hl2'; }
  else                    { level = '大量'; col = 'hl'; }
  const classLabel = classNums.join('、');

  insight.innerHTML = `
    已选第 <span class="${col}">${classLabel}</span> 班（共 ${nClasses} 个班，${level}数据，合计 <span class="${col}">${n}</span> 人）——
    本实验从同一正态模型生成成绩，再取整并限制到 0–100 分。
    样本更多时随机波动通常减小，但真实成绩不一定服从正态分布；边界截断会改变分布形态。
  `;
}

function drawChart(densities, curveData, bins, lo, hi, binWidth, mu, sigma, n, nClasses, classNums) {
  if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }

  const dpr   = window.devicePixelRatio || 1;
  const W_CSS = canvas.parentElement.clientWidth - 40;
  const H_CSS = 420;
  canvas.style.width  = W_CSS + 'px';
  canvas.style.height = H_CSS + 'px';
  canvas.width  = W_CSS * dpr;
  canvas.height = H_CSS * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const pad = { top: 28, right: 28, bottom: 72, left: 96 };
  const W = W_CSS - pad.left - pad.right;
  const H = H_CSS - pad.top  - pad.bottom;

  const maxDensity = Math.max(...densities, ...curveData.map(p => p.y));
  const yMax = maxDensity * 1.12;

  const toX  = (i)  => pad.left + (i / bins) * W;
  const toXc = (fi) => pad.left + (fi / bins) * W;
  const toY  = (d)  => pad.top + H - (d / yMax) * H;

  const DURATION = 600;
  const start = performance.now();

  function frame(now) {
    const t    = Math.min(1, (now - start) / DURATION);
    const ease = 1 - Math.pow(1 - t, 3);

    ctx.clearRect(0, 0, W_CSS, H_CSS);

    // Grid + Y labels
    ctx.strokeStyle = 'rgba(22,32,45,0.07)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y   = pad.top + (i / 5) * H;
      const val = yMax * (1 - i / 5);
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + W, y); ctx.stroke();
      ctx.fillStyle = '#1a2636';
      ctx.font = `bold 18px "PingFang SC",sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(3), pad.left - 10, y + 6);
    }

    // Bars (colored by class contribution)
    const barW = W / bins;
    // Grade-color palette per class (up to 10)
    const palette = [
      'rgba(29,122,79,', 'rgba(36,94,157,', 'rgba(178,87,51,',
      'rgba(130,60,160,', 'rgba(200,140,20,', 'rgba(20,140,160,',
      'rgba(180,40,80,',  'rgba(60,160,80,',  'rgba(100,80,180,', 'rgba(160,100,40,'
    ];

    // Stack bars by class
    for (let b = 0; b < bins; b++) {
      const x = toX(b);
      let yBottom = pad.top + H;

      for (let ci = 0; ci < nClasses; ci++) {
        const cn   = classNums[ci];
        const lo_b = lo + b * binWidth;
        const hi_b = lo_b + binWidth;
        const classScores = classData[cn];
        const cnt = classScores.filter(s => s >= lo_b && (b === bins - 1 ? s <= hi : s < hi_b)).length;
        const clsDensity = cnt / (n * binWidth);
        const barH = (clsDensity / yMax) * H * ease;
        if (barH < 0.5) continue;
        const col = palette[ci % palette.length];
        ctx.fillStyle = col + '0.72)';
        ctx.beginPath();
        ctx.rect(x + 1, yBottom - barH, barW - 2, barH);
        ctx.fill();
        yBottom -= barH;
      }

      // Rounded top on topmost segment
      if (yBottom < pad.top + H) {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.roundRect(x + 1, yBottom, barW - 2, 6, [3, 3, 0, 0]);
        ctx.fill();
      }
    }

    // Normal curve
    if (showCurve) {
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
    }

    if (showCurve) {
      // Mean dashed line
      const meanFrac = (mu - lo) / (hi - lo);
      const meanXpx  = pad.left + meanFrac * W;
      ctx.globalAlpha = ease;
      ctx.strokeStyle = 'rgba(178,87,51,0.55)';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 5]);
      ctx.beginPath(); ctx.moveTo(meanXpx, pad.top); ctx.lineTo(meanXpx, pad.top + H); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#b25733';
      ctx.font = `bold 17px "PingFang SC",sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`μ = ${mu}`, meanXpx, pad.top - 6);
      ctx.globalAlpha = 1;
    }

    // Axes
    ctx.strokeStyle = 'rgba(22,32,45,0.22)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top); ctx.lineTo(pad.left, pad.top + H); ctx.lineTo(pad.left + W, pad.top + H);
    ctx.stroke();

    // X labels (scores)
    ctx.fillStyle = '#1a2636';
    ctx.font = `bold 18px "PingFang SC",sans-serif`;
    ctx.textAlign = 'center';
    const step = Math.max(1, Math.round(bins / 10));
    for (let i = 0; i <= bins; i += step) {
      const score = lo + i * binWidth;
      ctx.fillText(score.toFixed(0), toX(i), pad.top + H + 24);
    }

    // Axis titles
    ctx.fillStyle = '#16202d';
    ctx.font = `bold 19px "PingFang SC",sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('成绩（分）', pad.left + W / 2, H_CSS - 4);
    ctx.save();
    ctx.translate(pad.left - 74, pad.top + H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('频率密度', 0, 0);
    ctx.restore();

    // Legend — stacked bar colors
    const lx = pad.left + 10;
    const ly = pad.top + 12;
    for (let ci = 0; ci < nClasses; ci++) {
      const cn      = classNums[ci];
      const col     = palette[ci % palette.length];
      const col_str = ci < 5 ? (lx + ci * 72) : (lx + (ci - 5) * 72);
      const row_y   = ci < 5 ? ly : ly + 26;
      ctx.fillStyle = col + '0.80)';
      ctx.fillRect(col_str, row_y, 18, 14);
      ctx.fillStyle = '#16202d';
      ctx.font = `bold 16px "PingFang SC",sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(`第${cn}班`, col_str + 22, row_y + 12);
    }

    // Curve legend
    if (showCurve) {
      const curveLx = pad.left + W - 200;
      ctx.strokeStyle = '#b25733';
      ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(curveLx, ly + 8); ctx.lineTo(curveLx + 24, ly + 8); ctx.stroke();
      ctx.fillStyle = '#16202d';
      ctx.font = `bold 16px "PingFang SC",sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText('理论正态曲线', curveLx + 28, ly + 13);
    }

    if (t < 1) animFrame = requestAnimationFrame(frame);
  }

  animFrame = requestAnimationFrame(frame);
}

window.addEventListener('resize', () => {
  if (Object.keys(classData).length > 0) reRender();
});
