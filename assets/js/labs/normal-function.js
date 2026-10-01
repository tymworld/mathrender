function normalPDF(x, mu, sigma) {
  const coeff = 1 / (sigma * Math.sqrt(2 * Math.PI));
  return coeff * Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
}

const muInput = document.getElementById('mu');
const sigmaInput = document.getElementById('sigma');
const ampInput = document.getElementById('amp');
const xRangeInput = document.getElementById('xRange');

const muVal = document.getElementById('muVal');
const sigmaVal = document.getElementById('sigmaVal');
const ampVal = document.getElementById('ampVal');
const rangeVal = document.getElementById('rangeVal');

const formulaText = document.getElementById('formulaText');
const peakX = document.getElementById('peakX');
const peakY = document.getElementById('peakY');
const inflect = document.getElementById('inflect');
const tipText = document.getElementById('tipText');

const canvas = document.getElementById('chart');
const ctx = canvas.getContext('2d');

function draw() {
  const mu = parseFloat(muInput.value);
  const sigma = parseFloat(sigmaInput.value);
  const amp = parseFloat(ampInput.value);
  const L = parseFloat(xRangeInput.value);
  const coeff = amp / (sigma * Math.sqrt(2 * Math.PI));
  const twoSigma2 = 2 * sigma * sigma;

  muVal.textContent = mu.toFixed(2);
  sigmaVal.textContent = sigma.toFixed(2);
  ampVal.textContent = amp.toFixed(2);
  rangeVal.textContent = L.toFixed(1);

  formulaText.innerHTML = `
    <div class="eq-title">代入当前参数</div>
    <div class="eq-main eq-sub">
      <math display="block">
        <mrow>
          <mi>f</mi><mo>(</mo><mi>x</mi><mo>)</mo><mo>=</mo>
          <mn>${coeff.toFixed(4)}</mn>
          <mo>&#x2062;</mo>
          <msup>
            <mi>e</mi>
            <mrow>
              <mo>-</mo>
              <mfrac>
                <msup><mrow><mi>x</mi><mo>-</mo><mn>${mu.toFixed(2)}</mn></mrow><mn>2</mn></msup>
                <mn>${twoSigma2.toFixed(4)}</mn>
              </mfrac>
            </mrow>
          </msup>
        </mrow>
      </math>
    </div>
  `;

  const peak = amp * normalPDF(mu, mu, sigma);
  peakX.textContent = `x = ${mu.toFixed(2)}`;
  peakY.textContent = peak.toFixed(4);
  inflect.textContent = `${(mu - sigma).toFixed(2)} , ${(mu + sigma).toFixed(2)}`;

  const shapeHint = sigma < 0.7 ? 'σ 变小：曲线更窄更高。' : sigma > 1.7 ? 'σ 变大：曲线更宽更矮。' : '';
  tipText.textContent = `${shapeHint}曲线在整个实数轴下的面积为 A = ${amp.toFixed(2)}。${Math.abs(amp - 1) < 1e-9 ? 'A=1 时，这是正态概率密度。' : 'A≠1 时，这是缩放的正态函数，不是概率密度。'}`;
  tipText.style.display = 'block';

  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.parentElement.clientWidth - 16;
  const cssH = 450;
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const pad = { top: 20, right: 22, bottom: 58, left: 66 };
  const W = cssW - pad.left - pad.right;
  const H = cssH - pad.top - pad.bottom;

  const xMin = -L;
  const xMax = L;
  const ampMax = parseFloat(ampInput.max);
  // Keep vertical scale independent from current A so changing A visibly stretches/shrinks the curve.
  const yMax = Math.max(ampMax * normalPDF(mu, mu, sigma) * 1.12, 0.12);

  const toX = (x) => pad.left + ((x - xMin) / (xMax - xMin)) * W;
  const toY = (y) => pad.top + H - (y / yMax) * H;

  ctx.clearRect(0, 0, cssW, cssH);

  // grid
  ctx.strokeStyle = 'rgba(22,32,45,0.07)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 6; i++) {
    const y = pad.top + (i / 6) * H;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + W, y);
    ctx.stroke();

    const yVal = yMax * (1 - i / 6);
    ctx.fillStyle = '#1a2636';
    ctx.font = 'bold 16px "PingFang SC",sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(yVal.toFixed(2), pad.left - 8, y + 4);
  }

  // axes
  ctx.strokeStyle = 'rgba(22,32,45,0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, pad.top + H);
  ctx.lineTo(pad.left + W, pad.top + H);
  ctx.stroke();

  // curve area fill
  ctx.beginPath();
  for (let i = 0; i <= 420; i++) {
    const x = xMin + (i / 420) * (xMax - xMin);
    const y = amp * normalPDF(x, mu, sigma);
    const px = toX(x);
    const py = toY(y);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.lineTo(toX(xMax), toY(0));
  ctx.lineTo(toX(xMin), toY(0));
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + H);
  grad.addColorStop(0, 'rgba(31,111,178,0.28)');
  grad.addColorStop(1, 'rgba(31,111,178,0.06)');
  ctx.fillStyle = grad;
  ctx.fill();

  // curve line
  ctx.strokeStyle = '#1f6fb2';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  for (let i = 0; i <= 420; i++) {
    const x = xMin + (i / 420) * (xMax - xMin);
    const y = amp * normalPDF(x, mu, sigma);
    const px = toX(x);
    const py = toY(y);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // mu / mu ± sigma lines
  const drawDashed = (x, color) => {
    const px = toX(x);
    if (px < pad.left || px > pad.left + W) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(px, pad.top);
    ctx.lineTo(px, pad.top + H);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  drawDashed(mu, 'rgba(178,87,51,0.7)');
  drawDashed(mu - sigma, 'rgba(31,111,178,0.45)');
  drawDashed(mu + sigma, 'rgba(31,111,178,0.45)');

  // axis labels
  ctx.fillStyle = '#16202d';
  ctx.font = 'bold 16px "PingFang SC",sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('x', pad.left + W / 2, cssH - 14);

  ctx.save();
  ctx.translate(20, pad.top + H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('f(x)', 0, 0);
  ctx.restore();

  // x ticks
  ctx.fillStyle = '#1a2636';
  ctx.font = 'bold 16px "PingFang SC",sans-serif';
  ctx.textAlign = 'center';
  const step = Math.max(0.5, Math.round((xMax - xMin) / 10));
  for (let x = Math.ceil(xMin / step) * step; x <= xMax + 1e-8; x += step) {
    ctx.fillText(x.toFixed(1), toX(x), pad.top + H + 20);
  }

  // legend
  ctx.fillStyle = '#1f6fb2';
  ctx.fillRect(pad.left + W - 210, pad.top + 10, 20, 12);
  ctx.fillStyle = '#16202d';
  ctx.font = 'bold 16px "PingFang SC",sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('正态分布函数', pad.left + W - 184, pad.top + 20);
}

[muInput, sigmaInput, ampInput, xRangeInput].forEach(el => {
  el.addEventListener('input', draw);
});

window.addEventListener('resize', draw);
draw();
