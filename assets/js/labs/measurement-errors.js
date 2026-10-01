function randNormal(mu, sigma) {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function meanOf(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleSdOf(values, avg) {
  if (values.length <= 1) return 0;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function roundTo(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function generateDataset(baseSigma) {
  return Array.from({ length: 20 }, (_, index) => {
    const groupBias = randNormal(0, baseSigma * 0.12);
    const groupSigma = clamp(baseSigma * (0.92 + Math.abs(randNormal(0, 0.18))), baseSigma * 0.55, baseSigma * 1.75);
    const errors = Array.from({ length: 100 }, () => roundTo(randNormal(groupBias, groupSigma), 3));
    return {
      id: index + 1,
      bias: groupBias,
      sigma: groupSigma,
      errors
    };
  });
}

function getDomain(groups) {
  const allValues = groups.flatMap(item => item.errors);
  const maxAbs = Math.max(...allValues.map(value => Math.abs(value)), 0.35);
  return roundTo(Math.ceil(maxAbs * 1.2 * 20) / 20, 2);
}

function buildHistogram(values, binWidth, domain) {
  const lo = -domain;
  const hi = domain;
  const edges = [];
  for (let start = lo; start < hi - 1e-9; start += binWidth) {
    edges.push(roundTo(start, 4));
  }
  const counts = edges.map(() => 0);
  for (const value of values) {
    const rawIndex = Math.floor((value - lo) / binWidth);
    const index = clamp(rawIndex, 0, counts.length - 1);
    counts[index] += 1;
  }
  return edges.map((start, index) => {
    const end = Math.min(roundTo(start + binWidth, 4), hi);
    const count = counts[index];
    const probability = count / values.length;
    const density = probability / (end - start);
    return { start, end, count, probability, density };
  });
}

const groupCountInput = document.getElementById('groupCount');
const measureCountInput = document.getElementById('measureCount');
const sigmaQuickInput = document.getElementById('sigmaQuick');
const binWidthInput = document.getElementById('binWidth');
const regenBtn = document.getElementById('regenBtn');
const toggleMeanBtn = document.getElementById('toggleMean');
const toggleCenterBtn = document.getElementById('toggleCenter');
const toggleFitBtn = document.getElementById('toggleFit');

const groupCountVal = document.getElementById('groupCountVal');
const measureCountVal = document.getElementById('measureCountVal');
const sigmaQuickVal = document.getElementById('sigmaQuickVal');
const binWidthVal = document.getElementById('binWidthVal');

const sampleN = document.getElementById('sampleN');
const sampleMean = document.getElementById('sampleMean');
const sampleSd = document.getElementById('sampleSd');
const binCount = document.getElementById('binCount');
const dataChip = document.getElementById('dataChip');
const caption = document.getElementById('caption');
const rawDataBody = document.getElementById('rawDataBody');

const canvas = document.getElementById('chart');
const ctx = canvas.getContext('2d');

let dataset = generateDataset(parseFloat(sigmaQuickInput.value));
const displayOptions = {
  showMean: true,
  showCenter: true,
  showFit: true
};

function normalPDF(x, mu, sigma) {
  const safeSigma = Math.max(sigma, 1e-6);
  const coeff = 1 / (safeSigma * Math.sqrt(2 * Math.PI));
  return coeff * Math.exp(-0.5 * ((x - mu) / safeSigma) ** 2);
}

function syncSigmaControls(value) {
  const clamped = clamp(roundTo(value, 2), 0.05, 0.30);
  sigmaQuickInput.value = clamped.toFixed(2);
  sigmaQuickVal.textContent = clamped.toFixed(2) + ' cm';
  return clamped;
}

function renderRawDataTable(groupCount, measureCount) {
  rawDataBody.innerHTML = '';
  dataset.forEach((group, index) => {
    const isActiveGroup = index < groupCount;
    const row = document.createElement('tr');
    row.className = isActiveGroup ? 'active-row' : 'inactive-row';
    const chunks = [];
    for (let chunk = 0; chunk < 10; chunk++) {
      const start = chunk * 10;
      const text = group.errors.slice(start, start + 10).map((value, offset) => {
        const activeValue = isActiveGroup && start + offset < measureCount;
        return activeValue ? '<strong>' + value.toFixed(3) + '</strong>' : value.toFixed(3);
      }).join(' , ');
      chunks.push('<td>' + text + '</td>');
    }
    row.innerHTML = '<td>' + group.id + '</td>' +
      '<td><span class="flag ' + (isActiveGroup ? 'active">已纳入' : 'inactive">未纳入') + '</span></td>' +
      '<td>' + meanOf(group.errors).toFixed(3) + '</td>' +
      '<td>' + group.sigma.toFixed(3) + '</td>' +
      chunks.join('');
    rawDataBody.appendChild(row);
  });
}

function getSubset() {
  const groupCount = parseInt(groupCountInput.value, 10);
  const measureCount = parseInt(measureCountInput.value, 10);
  const classes = dataset.slice(0, groupCount);
  const values = classes.flatMap(item => item.errors.slice(0, measureCount));
  return { classes, values, groupCount, measureCount };
}

function drawChart(histogram, subsetMean, subsetSd, domain) {
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.parentElement.clientWidth - 20;
  const cssHeight = 460;
  canvas.style.width = cssWidth + 'px';
  canvas.style.height = cssHeight + 'px';
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const pad = { top: 24, right: 26, bottom: 72, left: 78 };
  const plotWidth = cssWidth - pad.left - pad.right;
  const plotHeight = cssHeight - pad.top - pad.bottom;
  const fitPeak = displayOptions.showFit ? normalPDF(subsetMean, subsetMean, subsetSd) : 0;
  const yMax = Math.max(...histogram.map(item => item.density), fitPeak, 0.001) * 1.16;

  const toX = (x) => pad.left + ((x + domain) / (2 * domain)) * plotWidth;
  const toY = (y) => pad.top + plotHeight - (y / yMax) * plotHeight;

  ctx.clearRect(0, 0, cssWidth, cssHeight);

  ctx.strokeStyle = 'rgba(24,36,49,0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = pad.top + (i / 5) * plotHeight;
    const value = yMax * (1 - i / 5);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotWidth, y);
    ctx.stroke();

    ctx.fillStyle = '#27384a';
    ctx.font = 'bold 16px "PingFang SC", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(value.toFixed(3), pad.left - 8, y + 4);
  }

  ctx.strokeStyle = 'rgba(24,36,49,0.24)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, pad.top + plotHeight);
  ctx.lineTo(pad.left + plotWidth, pad.top + plotHeight);
  ctx.stroke();

  for (const item of histogram) {
    const x = toX(item.start);
    const width = toX(item.end) - toX(item.start);
    const y = toY(item.density);
    const height = pad.top + plotHeight - y;
    const grad = ctx.createLinearGradient(0, y, 0, pad.top + plotHeight);
    grad.addColorStop(0, 'rgba(37, 103, 168, 0.84)');
    grad.addColorStop(1, 'rgba(15, 138, 112, 0.28)');
    ctx.fillStyle = grad;
    ctx.fillRect(x + 1, y, Math.max(1, width - 2), height);
  }

  if (displayOptions.showFit && subsetSd > 0) {
    ctx.save();
    ctx.strokeStyle = '#a0522d';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    for (let i = 0; i <= 360; i++) {
      const xValue = -domain + (i / 360) * domain * 2;
      const yValue = normalPDF(xValue, subsetMean, subsetSd);
      const x = toX(xValue);
      const y = toY(yValue);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  const drawLine = (xValue, color, dash, label) => {
    const x = toX(xValue);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, pad.top + plotHeight);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = color;
    ctx.font = 'bold 16px "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    if (label) ctx.fillText(label, x, pad.top - 6);
  };

  if (displayOptions.showCenter) drawLine(0, '#0f8a70', [4, 4], '');
  if (displayOptions.showMean) drawLine(subsetMean, '#c86d2d', [7, 5], '样本均值');

  ctx.fillStyle = '#182431';
  ctx.font = 'bold 20px "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('误差值 / cm', pad.left + plotWidth / 2, cssHeight - 18);

  ctx.save();
  ctx.translate(20, pad.top + plotHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.font = 'bold 18px "PingFang SC", sans-serif';
  ctx.fillText('频率密度 / (1/cm)', 0, 0);
  ctx.restore();

  ctx.font = 'bold 16px "PingFang SC", sans-serif';
  const tickStep = domain <= 0.5 ? 0.1 : 0.2;
  for (let x = -domain; x <= domain + 1e-9; x += tickStep) {
    ctx.fillStyle = '#27384a';
    ctx.textAlign = 'center';
    ctx.fillText(String(roundTo(x, 2)), toX(x), pad.top + plotHeight + 22);
  }
}

function render() {
  const { classes, values, groupCount, measureCount } = getSubset();
  const binWidth = parseFloat(binWidthInput.value);
  const sigma = parseFloat(sigmaQuickInput.value);
  const domain = getDomain(dataset);
  const histogram = buildHistogram(values, binWidth, domain);
  const avg = meanOf(values);
  const sd = sampleSdOf(values, avg);
  const localMin = Math.min(...values);
  const localMax = Math.max(...values);
  const biases = classes.map(item => meanOf(item.errors.slice(0, measureCount)));
  const biasSpread = Math.max(...biases) - Math.min(...biases);

  groupCountVal.textContent = groupCount + ' 班';
  measureCountVal.textContent = measureCount + ' 次';
  binWidthVal.textContent = binWidth.toFixed(2) + ' cm';

  sampleN.textContent = String(values.length);
  sampleMean.textContent = avg.toFixed(3);
  sampleSd.textContent = sd.toFixed(3);
  binCount.textContent = String(histogram.length);

  dataChip.innerHTML = '当前样本来自第 <strong>' + classes[0].id + '</strong> 班到第 <strong>' + classes[classes.length - 1].id + '</strong> 班，共 <strong>' + values.length + '</strong> 次测量；设定测量偏差程度为 <strong>' + sigma.toFixed(2) + ' cm</strong>，误差大致落在 <strong>' + localMin.toFixed(3) + ' cm</strong> 到 <strong>' + localMax.toFixed(3) + ' cm</strong> 之间。';

  let message = '理想情况下误差应围绕 <span class="hl3">0</span> 对称分布，样本均值越接近 0，说明整体系统偏差越小。';
  if (Math.abs(avg) > sigma * 0.35) {
    message = '当前样本均值离 0 略有偏移，说明这批测量里可能混入了轻微的系统误差。';
  } else if (binWidth >= 0.06) {
    message = '当前 <span class="hl2">组距较大</span>，更容易看出“以 0 为中心”的总体轮廓，但细节波动会被压平。';
  } else if (binWidth <= 0.02) {
    message = '当前 <span class="hl1">组距较小</span>，你能看见更多随机起伏，也更容易比较左右两侧是否真正对称。';
  } else if (biasSpread > sigma * 0.45) {
    message = '不同班级之间的均值略有差异，所以合并后直方图会出现一点点偏斜或扩散。';
  }

  caption.innerHTML = '已纳入 <span class="hl1">' + groupCount + '</span> 个班级、每班 <span class="hl1">' + measureCount + '</span> 次测量，测量偏差程度为 <span class="hl1">' + sigma.toFixed(2) + ' cm</span>，样本均值约为 <span class="hl2">' + avg.toFixed(3) + ' cm</span>，标准差约为 <span class="hl3">' + sd.toFixed(3) + ' cm</span>。' + message;

  renderRawDataTable(groupCount, measureCount);
  drawChart(histogram, avg, sd, domain);
}

function regenerateDatasetAndRender() {
  const sigma = syncSigmaControls(parseFloat(sigmaQuickInput.value));
  dataset = generateDataset(sigma);
  render();
}

regenBtn.addEventListener('click', () => {
  regenerateDatasetAndRender();
});

[groupCountInput, measureCountInput, binWidthInput].forEach(input => {
  input.addEventListener('input', render);
});

sigmaQuickInput.addEventListener('input', () => {
  const sigma = syncSigmaControls(parseFloat(sigmaQuickInput.value));
  dataset = generateDataset(sigma);
  render();
});

[
  [toggleMeanBtn, 'showMean'],
  [toggleCenterBtn, 'showCenter'],
  [toggleFitBtn, 'showFit']
].forEach(([button, key]) => {
  button.addEventListener('click', () => {
    displayOptions[key] = !displayOptions[key];
    button.classList.toggle('active', displayOptions[key]);
    render();
  });
});

window.addEventListener('resize', render);
syncSigmaControls(parseFloat(sigmaQuickInput.value));
render();
