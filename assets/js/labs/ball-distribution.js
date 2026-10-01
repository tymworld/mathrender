const MAX_BALL_COUNT = 2000;
    const defaults = { white: 6, black: 4, draw: 5, whiteRatio: 3, blackRatio: 2, multiplier: 2 };
    let activeMode = "direct";

    const directModeBtn = document.getElementById("directModeBtn");
    const ratioModeBtn = document.getElementById("ratioModeBtn");
    const directControls = document.getElementById("directControls");
    const ratioControls = document.getElementById("ratioControls");
    const whiteInput = document.getElementById("whiteInput");
    const blackInput = document.getElementById("blackInput");
    const whiteRatioInput = document.getElementById("whiteRatioInput");
    const blackRatioInput = document.getElementById("blackRatioInput");
    const multiplierInput = document.getElementById("multiplierInput");
    const drawInput = document.getElementById("drawInput");
    const scaleBtn = document.getElementById("scaleBtn");

    const whiteValue = document.getElementById("whiteValue");
    const blackValue = document.getElementById("blackValue");
    const ratioWhiteCount = document.getElementById("ratioWhiteCount");
    const ratioBlackCount = document.getElementById("ratioBlackCount");
    const drawValue = document.getElementById("drawValue");
    const whiteRatioValue = document.getElementById("whiteRatioValue");
    const expectationValue = document.getElementById("expectationValue");
    const differenceValue = document.getElementById("differenceValue");
    const hyperFormula = document.getElementById("hyperFormula");
    const binomFormula = document.getElementById("binomFormula");
    const probabilityBody = document.getElementById("probabilityBody");
    const canvas = document.getElementById("chartCanvas");
    const ctx = canvas.getContext("2d");

    function gcd(a, b) {
      let x = Math.abs(a);
      let y = Math.abs(b);
      while (y !== 0) {
        const temp = x % y;
        x = y;
        y = temp;
      }
      return x || 1;
    }

    function combination(n, r) {
      if (!Number.isFinite(n) || !Number.isFinite(r)) return 0;
      if (r < 0 || r > n) return 0;
      if (r === 0 || r === n) return 1;
      const m = Math.min(r, n - r);
      let result = 1;
      for (let i = 1; i <= m; i += 1) {
        result = (result * (n - m + i)) / i;
      }
      return result;
    }

    function hypergeometricProbability(white, black, draw, k) {
      const total = white + black;
      if (draw > total) return 0;
      return (combination(white, k) * combination(black, draw - k)) / combination(total, draw);
    }

    function binomialProbability(draw, p, k) {
      return combination(draw, k) * (p ** k) * ((1 - p) ** (draw - k));
    }

    function formatProbability(value) {
      if (value === 0) return "0";
      if (value >= 0.001) return value.toFixed(4);
      return value.toExponential(2);
    }

    function formatTwoSignificantDecimal(value) {
      if (value === 0) return "0";
      const magnitude = Math.floor(Math.log10(Math.abs(value)));
      const decimals = Math.min(100, Math.max(0, 1 - magnitude));
      const rounded = value.toFixed(decimals);
      return Number(rounded) === 0 ? value.toFixed(Math.min(100, decimals + 2)) : rounded;
    }

    function formatRatio(numerator, denominator) {
      if (denominator === 0) return "0";
      const divisor = gcd(numerator, denominator);
      return `${numerator / divisor}/${denominator / divisor}`;
    }

    function clampNumber(value, min, max, fallback) {
      const numericValue = Math.round(Number(value));
      if (!Number.isFinite(numericValue)) return fallback;
      return Math.min(max, Math.max(min, numericValue));
    }

    function updateSliderLabels(white, black, draw) {
      whiteValue.textContent = String(white);
      blackValue.textContent = String(black);
      drawValue.textContent = String(draw);
    }

    function readDirectCounts() {
      let white = clampNumber(whiteInput.value, 0, MAX_BALL_COUNT, defaults.white);
      let black = clampNumber(blackInput.value, 0, MAX_BALL_COUNT, defaults.black);

      if (white + black === 0) {
        white = defaults.white;
        black = defaults.black;
      }

      whiteInput.value = String(white);
      blackInput.value = String(black);
      return { white, black };
    }

    function readRatioCounts() {
      let whiteRatio = clampNumber(whiteRatioInput.value, 0, MAX_BALL_COUNT, defaults.whiteRatio);
      let blackRatio = clampNumber(blackRatioInput.value, 0, MAX_BALL_COUNT, defaults.blackRatio);

      if (whiteRatio + blackRatio === 0) {
        whiteRatio = defaults.whiteRatio;
        blackRatio = defaults.blackRatio;
      }

      const largestRatio = Math.max(whiteRatio, blackRatio, 1);
      const maxMultiplier = Math.max(1, Math.floor(MAX_BALL_COUNT / largestRatio));
      const multiplier = clampNumber(multiplierInput.value, 1, maxMultiplier, defaults.multiplier);
      const white = whiteRatio * multiplier;
      const black = blackRatio * multiplier;

      whiteRatioInput.value = String(whiteRatio);
      blackRatioInput.value = String(blackRatio);
      multiplierInput.max = String(maxMultiplier);
      multiplierInput.value = String(multiplier);
      whiteInput.value = String(white);
      blackInput.value = String(black);
      ratioWhiteCount.textContent = String(white);
      ratioBlackCount.textContent = String(black);

      return { white, black };
    }

    function syncRatioFromDirect() {
      const { white, black } = readDirectCounts();
      const divisor = gcd(white, black);
      const whiteRatio = white / divisor;
      const blackRatio = black / divisor;
      const largestRatio = Math.max(whiteRatio, blackRatio, 1);
      const maxMultiplier = Math.max(1, Math.floor(MAX_BALL_COUNT / largestRatio));
      const multiplier = Math.min(divisor, maxMultiplier);

      whiteRatioInput.value = String(whiteRatio);
      blackRatioInput.value = String(blackRatio);
      multiplierInput.max = String(maxMultiplier);
      multiplierInput.value = String(multiplier);
      ratioWhiteCount.textContent = String(whiteRatio * multiplier);
      ratioBlackCount.textContent = String(blackRatio * multiplier);
    }

    function setMode(mode) {
      activeMode = mode;
      directControls.hidden = mode !== "direct";
      ratioControls.hidden = mode !== "ratio";
      directModeBtn.classList.toggle("active", mode === "direct");
      ratioModeBtn.classList.toggle("active", mode === "ratio");
      directModeBtn.setAttribute("aria-selected", mode === "direct" ? "true" : "false");
      ratioModeBtn.setAttribute("aria-selected", mode === "ratio" ? "true" : "false");

      if (mode === "ratio") {
        syncRatioFromDirect();
      }

      updateView();
    }

    function clampInputs() {
      const { white, black } = activeMode === "ratio" ? readRatioCounts() : readDirectCounts();
      let draw = clampNumber(drawInput.value, 1, 30, defaults.draw);
      const total = white + black;
      drawInput.max = String(Math.max(1, Math.min(30, total)));
      if (draw > total) {
        draw = total;
      }

      drawInput.value = String(draw);
      updateSliderLabels(white, black, draw);
      return { white, black, draw };
    }

    function buildRows(white, black, draw) {
      const total = white + black;
      const p = total === 0 ? 0 : white / total;
      const rows = [];
      let maxGap = 0;

      for (let k = 0; k <= draw; k += 1) {
        const hyper = hypergeometricProbability(white, black, draw, k);
        const binom = binomialProbability(draw, p, k);
        const gap = Math.abs(hyper - binom);
        if (gap > maxGap) maxGap = gap;
        rows.push({ k, hyper, binom, gap });
      }

      return { rows, maxGap, p };
    }

    function formulaCombination(top, bottom) {
      return `
        <msubsup>
          <mi>C</mi>
          <mrow>${top}</mrow>
          <mrow>${bottom}</mrow>
        </msubsup>
      `;
    }

    function renderFirstValues(rows, key) {
      return rows.slice(0, 3).map((row) => formatProbability(row[key])).join("，");
    }

    function formatCloseness(maxGap) {
      return `${(Math.max(0, 1 - maxGap) * 100).toFixed(1)}%`;
    }

    function renderFormulas(white, black, draw, p, rows) {
      const total = white + black;
      const blackRatio = total === 0 ? 0 : black / total;

      hyperFormula.innerHTML = `
        <math display="block">
          <mrow>
            <mi>P</mi><mo>(</mo><mi>X</mi><mo>=</mo><mi>k</mi><mo>)</mo><mo>=</mo>
            <mfrac>
              <mrow>
                ${formulaCombination("<mi>W</mi>", "<mi>k</mi>")}
                ${formulaCombination("<mi>B</mi>", "<mrow><mi>n</mi><mo>-</mo><mi>k</mi></mrow>")}
              </mrow>
              <mrow>
                ${formulaCombination("<mrow><mi>W</mi><mo>+</mo><mi>B</mi></mrow>", "<mi>n</mi>")}
              </mrow>
            </mfrac>
            <mo>=</mo>
            <mfrac>
              <mrow>
                ${formulaCombination(`<mn>${white}</mn>`, "<mi>k</mi>")}
                ${formulaCombination(`<mn>${black}</mn>`, `<mrow><mn>${draw}</mn><mo>-</mo><mi>k</mi></mrow>`)}
              </mrow>
              <mrow>${formulaCombination(`<mn>${total}</mn>`, `<mn>${draw}</mn>`)}</mrow>
            </mfrac>
            <mo>=</mo>
            <mtext>${renderFirstValues(rows, "hyper")}</mtext>
          </mrow>
        </math>
      `;

      binomFormula.innerHTML = `
        <math display="block">
          <mrow>
            <mi>P</mi><mo>(</mo><mi>Y</mi><mo>=</mo><mi>k</mi><mo>)</mo><mo>=</mo>
            ${formulaCombination("<mi>n</mi>", "<mi>k</mi>")}
            <msup>
              <mrow>
                <mo>(</mo>
                <mfrac><mi>W</mi><mrow><mi>W</mi><mo>+</mo><mi>B</mi></mrow></mfrac>
                <mo>)</mo>
              </mrow>
              <mi>k</mi>
            </msup>
            <msup>
              <mrow>
                <mo>(</mo>
                <mfrac><mi>B</mi><mrow><mi>W</mi><mo>+</mo><mi>B</mi></mrow></mfrac>
                <mo>)</mo>
              </mrow>
              <mrow><mi>n</mi><mo>-</mo><mi>k</mi></mrow>
            </msup>
            <mo>=</mo>
            ${formulaCombination(`<mn>${draw}</mn>`, "<mi>k</mi>")}
            <msup>
              <mrow><mo>(</mo><mn>${p.toFixed(4)}</mn><mo>)</mo></mrow>
              <mi>k</mi>
            </msup>
            <msup>
              <mrow><mo>(</mo><mn>${blackRatio.toFixed(4)}</mn><mo>)</mo></mrow>
              <mrow><mn>${draw}</mn><mo>-</mo><mi>k</mi></mrow>
            </msup>
            <mo>=</mo>
            <mtext>${renderFirstValues(rows, "binom")}</mtext>
          </mrow>
        </math>
      `;
    }

    function renderSummary(white, black, draw, p, maxGap) {
      const total = white + black;
      whiteRatioValue.textContent = `${white}:${black} | ${formatRatio(white, total)}`;
      expectationValue.textContent = (draw * p).toFixed(3);
      differenceValue.textContent = formatCloseness(maxGap);
    }

    function renderTable(rows, maxGap) {
      probabilityBody.innerHTML = rows.map((row) => `
        <tr class="${maxGap > 0 && row.gap === maxGap ? "max-gap-row" : ""}">
          <td>${row.k}</td>
          <td>${formatProbability(row.hyper)}</td>
          <td>${formatProbability(row.binom)}</td>
          <td class="gap-cell">
            <div class="gap-value">${formatTwoSignificantDecimal(row.gap)}</div>
          </td>
        </tr>
      `).join("");
    }

    function drawRoundedBar(x, y, width, height, color) {
      const radius = Math.min(10, width / 2, height / 2);
      ctx.beginPath();
      ctx.moveTo(x, y + height);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }

    function fitCanvasToDisplay() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = Math.max(320, Math.round(rect.width));
      const displayHeight = Math.max(300, Math.round(rect.height));
      const backingWidth = Math.round(displayWidth * dpr);
      const backingHeight = Math.round(displayHeight * dpr);

      if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
        canvas.width = backingWidth;
        canvas.height = backingHeight;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { width: displayWidth, height: displayHeight };
    }

    function renderChart(rows) {
      const { width, height } = fitCanvasToDisplay();
      const left = Math.min(120, Math.max(92, width * 0.1));
      const right = 28;
      const top = 28;
      const bottom = 98;
      const plotWidth = width - left - right;
      const plotHeight = height - top - bottom;
      const maxValue = Math.max(...rows.flatMap((row) => [row.hyper, row.binom]), 0.01);
      const groupWidth = plotWidth / rows.length;
      const barWidth = Math.min(34, groupWidth * 0.34);
      const xTickStep = Math.max(1, Math.ceil(28 / groupWidth));

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#fffdfa";
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = "rgba(22, 32, 45, 0.14)";
      ctx.lineWidth = 1.2;
      for (let i = 0; i <= 4; i += 1) {
        const y = top + (plotHeight / 4) * i;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(width - right, y);
        ctx.stroke();

        const labelValue = ((maxValue * (4 - i)) / 4).toFixed(2);
        ctx.fillStyle = "#111827";
        ctx.font = "700 20px 'Source Han Sans SC', sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(labelValue, left - 12, y + 7);
      }

      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(left, top);
      ctx.lineTo(left, height - bottom);
      ctx.lineTo(width - right, height - bottom);
      ctx.stroke();

      ctx.fillStyle = "#111827";
      ctx.font = "800 22px 'Source Han Sans SC', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("白球个数 k", left + plotWidth / 2, height - 28);

      ctx.save();
      ctx.translate(28, top + plotHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText("概率", 0, 0);
      ctx.restore();

      rows.forEach((row, index) => {
        const center = left + groupWidth * index + groupWidth / 2;
        const hyperHeight = (row.hyper / maxValue) * plotHeight;
        const binomHeight = (row.binom / maxValue) * plotHeight;
        const hyperX = center - barWidth - 6;
        const binomX = center + 6;

        drawRoundedBar(hyperX, top + plotHeight - hyperHeight, barWidth, hyperHeight, "#b25733");
        drawRoundedBar(binomX, top + plotHeight - binomHeight, barWidth, binomHeight, "#245e9d");

        ctx.fillStyle = "#111827";
        ctx.font = "700 20px 'Source Han Sans SC', sans-serif";
        ctx.textAlign = "center";
        if (row.k % xTickStep === 0 || index === rows.length - 1) {
          ctx.fillText(String(row.k), center, height - bottom + 34);
        }
      });
    }

    function updateView() {
      const { white, black, draw } = clampInputs();
      const { rows, maxGap, p } = buildRows(white, black, draw);
      renderFormulas(white, black, draw, p, rows);
      renderSummary(white, black, draw, p, maxGap);
      renderTable(rows, maxGap);
      renderChart(rows);
    }

    scaleBtn.addEventListener("click", () => {
      whiteInput.value = String(Math.min(MAX_BALL_COUNT, Math.round(Number(whiteInput.value) * 2)));
      blackInput.value = String(Math.min(MAX_BALL_COUNT, Math.round(Number(blackInput.value) * 2)));
      updateView();
    });

    directModeBtn.addEventListener("click", () => setMode("direct"));
    ratioModeBtn.addEventListener("click", () => setMode("ratio"));

    [whiteInput, blackInput, drawInput].forEach((input) => {
      input.addEventListener("input", updateView);
      input.addEventListener("change", updateView);
    });

    [whiteRatioInput, blackRatioInput, multiplierInput].forEach((input) => {
      input.addEventListener("change", updateView);
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          input.blur();
          updateView();
        }
      });
    });

    updateView();
    window.addEventListener("resize", updateView);
