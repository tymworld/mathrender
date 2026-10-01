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

function generateDataset() {
  return Array.from({ length: 20 }, (_, classIndex) => {
    const classMean = 72 + randNormal(0, 4.8) + (classIndex - 9.5) * 0.18;
    const classSigma = clamp(8 + randNormal(0, 1.5), 5.5, 13.5);
    const scores = Array.from({ length: 100 }, () => {
      const score = Math.round(randNormal(classMean, classSigma));
      return clamp(score, 0, 100);
    });
    return {
      id: classIndex + 1,
      mean: classMean,
      sigma: classSigma,
      scores
    };
  });
}

function buildHistogram(values, binWidth) {
  const lo = 0;
  const hi = 100;
  const edges = [];
  for (let start = lo; start < hi; start += binWidth) {
    edges.push(start);
  }
  const counts = edges.map(() => 0);
  for (const value of values) {
    const rawIndex = Math.floor((value - lo) / binWidth);
    const index = clamp(rawIndex, 0, counts.length - 1);
    counts[index] += 1;
  }
  return edges.map((start, index) => {
    const end = Math.min(start + binWidth, hi);
    const count = counts[index];
    const probability = count / values.length;
    const density = probability / (end - start);
    return { start, end, count, probability, density };
  });
}

const classCountInput = document.getElementById('classCount');
const studentCountInput = document.getElementById('studentCount');
const binWidthInput = document.getElementById('binWidth');
const regenBtn = document.getElementById('regenBtn');

const classCountVal = document.getElementById('classCountVal');
const studentCountVal = document.getElementById('studentCountVal');
const binWidthVal = document.getElementById('binWidthVal');

const sampleN = document.getElementById('sampleN');
const sampleMean = document.getElementById('sampleMean');
const sampleSd = document.getElementById('sampleSd');
const binCount = document.getElementById('binCount');
const dataChip = document.getElementById('dataChip');
const caption = document.getElementById('caption');

const canvas = document.getElementById('chart');
const ctx = canvas.getContext('2d');

let dataset = generateDataset();

function getSubset() {
  const classCount = parseInt(classCountInput.value, 10);
  const studentCount = parseInt(studentCountInput.value, 10);
  const classes = dataset.slice(0, classCount);
  const values = classes.flatMap(item => item.scores.slice(0, studentCount));
  return { classes, values, classCount, studentCount };
}

function drawChart(histogram, subsetMean, overallMean) {
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.parentElement.clientWidth - 20;
  const cssHeight = 460;
  canvas.style.width = cssWidth + 'px';
  canvas.style.height = cssHeight + 'px';
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const pad = { top: 24, right: 26, bottom: 72, left: 76 };
  const plotWidth = cssWidth - pad.left - pad.right;
  const plotHeight = cssHeight - pad.top - pad.bottom;
  const yMax = Math.max(...histogram.map(item => item.density), 0.001) * 1.16;

  const toX = (x) => pad.left + (x / 100) * plotWidth;
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
    grad.addColorStop(0, 'rgba(15, 138, 112, 0.84)');
    grad.addColorStop(1, 'rgba(35, 95, 151, 0.30)');
    ctx.fillStyle = grad;
    ctx.fillRect(x + 1, y, Math.max(1, width - 2), height);
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
    ctx.fillText(label, x, pad.top - 6);
  };

  drawLine(subsetMean, '#d0712f', [7, 5], '样本均值');
  drawLine(overallMean, '#235f97', [4, 4], '总体均值');

  ctx.fillStyle = '#182431';
  ctx.font = 'bold 16px "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('分数', pad.left + plotWidth / 2, cssHeight - 18);

  ctx.save();
  ctx.translate(18, pad.top + plotHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('频率密度', 0, 0);
  ctx.restore();

  ctx.font = 'bold 16px "PingFang SC", sans-serif';
  for (let x = 0; x <= 100; x += 10) {
    ctx.fillStyle = '#27384a';
    ctx.textAlign = 'center';
    ctx.fillText(String(x), toX(x), pad.top + plotHeight + 22);
  }
}

function render() {
  const { classes, values, classCount, studentCount } = getSubset();
  const width = parseInt(binWidthInput.value, 10);
  const histogram = buildHistogram(values, width);
  const avg = meanOf(values);
  const sd = sampleSdOf(values, avg);
  const overallValues = dataset.flatMap(item => item.scores);
  const overallMean = meanOf(overallValues);
  const classMeans = classes.map(item => meanOf(item.scores.slice(0, studentCount)));
  const localMin = Math.min(...values);
  const localMax = Math.max(...values);

  classCountVal.textContent = classCount + ' 个';
  studentCountVal.textContent = studentCount + ' 人';
  binWidthVal.textContent = width + ' 分';

  sampleN.textContent = String(values.length);
  sampleMean.textContent = avg.toFixed(1);
  sampleSd.textContent = sd.toFixed(1);
  binCount.textContent = String(histogram.length);

  dataChip.innerHTML = '当前样本来自第 <strong>' + classes[0].id + '</strong> 班到第 <strong>' + classes[classes.length - 1].id + '</strong> 班，共 <strong>' + values.length + '</strong> 人；分数范围约在 <strong>' + localMin + '</strong> 到 <strong>' + localMax + '</strong> 分之间。';

  const classMeanSpread = Math.max(...classMeans) - Math.min(...classMeans);
  let message = '当 <span class="hl1">班级数增加</span> 或 <span class="hl1">每班样本数增加</span> 时，柱形通常会更稳定，整体轮廓更接近连续分布。';
  if (classMeanSpread > 4.5) {
    message = '这组班级之间的平均成绩差异较明显，所以直方图会显得更宽，甚至出现轻微偏斜。';
  } else if (width >= 12) {
    message = '当前 <span class="hl2">组距较大</span>，细节被合并了，整体趋势更容易看清，但局部起伏会被抹平。';
  } else if (width <= 4) {
    message = '当前 <span class="hl3">组距较小</span>，柱形更细，能看见更多随机波动，也更适合比较局部差异。';
  }

  caption.innerHTML = '已纳入 <span class="hl1">' + classCount + '</span> 个班、每班 <span class="hl1">' + studentCount + '</span> 名学生，样本均值约为 <span class="hl2">' + avg.toFixed(1) + '</span> 分，标准差约为 <span class="hl3">' + sd.toFixed(1) + '</span>。' + message;

  drawChart(histogram, avg, overallMean);
}

regenBtn.addEventListener('click', () => {
  dataset = generateDataset();
  render();
});

[classCountInput, studentCountInput, binWidthInput].forEach(input => {
  input.addEventListener('input', render);
});

window.addEventListener('resize', render);
render();
