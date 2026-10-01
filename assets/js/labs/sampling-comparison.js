const $ = (id) => document.getElementById(id);

    const els = {
      aInput: $("aInput"),
      bInput: $("bInput"),
      nInput: $("nInput"),
      speedSelect: $("speedSelect"),
      autoBatchSelect: $("autoBatchSelect"),
      histHeightInput: $("histHeightInput"),
      singleBtn: $("singleBtn"),
      autoBtn: $("autoBtn"),
      pauseBtn: $("pauseBtn"),
      resetBtn: $("resetBtn"),
      randomBtn: $("randomBtn"),
      scale10Btn: $("scale10Btn"),
      scale100Btn: $("scale100Btn"),
      showTheory: $("showTheory"),
      showExp: $("showExp"),
      showDiff: $("showDiff"),
      highlightRatio: $("highlightRatio"),
      showMiniStats: $("showMiniStats"),
      useBatchAuto: $("useBatchAuto"),
      sequentialMode: $("sequentialMode"),
      ratioMetric: $("ratioMetric"),
      ratioText: $("ratioText"),
      ratioHint: $("ratioHint"),
      judgeMetric: $("judgeMetric"),
      judgeText: $("judgeText"),
      judgeHint: $("judgeHint"),
      expCount: $("expCount"),
      tvText: $("tvText"),
      maxDiffText: $("maxDiffText"),
      pText: $("pText"),
      withoutBag: $("withoutBag"),
      withBag: $("withBag"),
      withoutCurrentBall: $("withoutCurrentBall"),
      withCurrentBall: $("withCurrentBall"),
      withoutStepText: $("withoutStepText"),
      withStepText: $("withStepText"),
      withoutSample: $("withoutSample"),
      withSample: $("withSample"),
      withoutCurrentText: $("withoutCurrentText"),
      withCurrentText: $("withCurrentText"),
      withoutWhiteCount: $("withoutWhiteCount"),
      withWhiteCount: $("withWhiteCount"),
      withoutWhiteRemain: $("withoutWhiteRemain"),
      withoutBlackRemain: $("withoutBlackRemain"),
      withWhiteRemain: $("withWhiteRemain"),
      withBlackRemain: $("withBlackRemain"),
      withoutStatsGrid: $("withoutStatsGrid"),
      withStatsGrid: $("withStatsGrid"),
      withoutPanel: $("withoutPanel"),
      withPanel: $("withPanel"),
      observationText: $("observationText"),
      lastResultText: $("lastResultText"),
      mechanismText: $("mechanismText"),
      ratioExplainText: $("ratioExplainText"),
      conclusionText: $("conclusionText"),
      histCanvas: $("histCanvas"),
      theoryCanvas: $("theoryCanvas"),
      diffCanvas: $("diffCanvas"),
      resultBody: $("resultBody"),
      messageBar: $("messageBar")
    };

    const state = {
      a: 10,
      b: 10,
      n: 5,
      speed: "中",
      showTheory: false,
      showExp: true,
      showDiff: false,
      highlightRatio: false,
      showMiniStats: false,
      useBatchAuto: false,
      sequentialMode: true,
      experiments: 0,
      withoutCounts: [],
      withCounts: [],
      running: false,
      paused: false,
      autoRemaining: 0,
      histHeight: 340,
      timers: [],
      display: null,
      lastRound: null
    };

    function clampInt(v, min, max, fallback) {
      const n = Number(v);
      if (!Number.isFinite(n)) return fallback;
      return Math.min(max, Math.max(min, Math.round(n)));
    }

    function speedDelay() {
      if (state.speed === "极快") return 80;
      if (state.speed === "慢") return 540;
      if (state.speed === "快") return 160;
      return 300;
    }

    function batchPause() {
      if (state.speed === "极快") return 70;
      if (state.speed === "慢") return 360;
      if (state.speed === "快") return 130;
      return 220;
    }

    function schedule(fn, delay) {
      const id = setTimeout(fn, delay);
      state.timers.push(id);
      return id;
    }

    function clearAllTimers() {
      state.timers.forEach(clearTimeout);
      state.timers = [];
    }

    function showMessage(text) {
      els.messageBar.textContent = text;
      els.messageBar.classList.add("show");
      clearTimeout(showMessage._timer);
      showMessage._timer = setTimeout(() => {
        els.messageBar.classList.remove("show");
      }, 2200);
    }

    function createCounts() {
      state.withoutCounts = Array(state.n + 1).fill(0);
      state.withCounts = Array(state.n + 1).fill(0);
    }

    function createInitialDisplay() {
      state.display = {
        without: {
          step: 0,
          current: null,
          sample: [],
          whiteCount: 0,
          bagWhite: state.a,
          bagBlack: state.b
        },
        with: {
          step: 0,
          current: null,
          sample: [],
          whiteCount: 0,
          bagWhite: state.a,
          bagBlack: state.b
        }
      };
    }

    function resetStats() {
      clearAllTimers();
      state.running = false;
      state.paused = false;
      state.autoRemaining = 0;
      state.experiments = 0;
      state.lastRound = null;
      createCounts();
      createInitialDisplay();
      renderAll();
    }

    function syncParamsFromInputs() {
      clearAllTimers();
      state.running = false;
      state.paused = false;
      state.autoRemaining = 0;

      const a = clampInt(els.aInput.value, 1, 3000, state.a);
      const b = clampInt(els.bInput.value, 1, 3000, state.b);
      let n = clampInt(els.nInput.value, 1, 30, state.n);
      const total = a + b;
      if (n > total) {
        n = Math.min(total, 30);
        showMessage("已自动修正：不放回抽样要求 n ≤ a+b。");
      }

      state.a = a;
      state.b = b;
      state.n = n;
      state.speed = els.speedSelect.value;
      state.showTheory = els.showTheory.checked;
      state.showExp = els.showExp.checked;
      state.showDiff = els.showDiff.checked;
      state.highlightRatio = els.highlightRatio.checked;
      state.showMiniStats = els.showMiniStats.checked;
      state.useBatchAuto = els.useBatchAuto.checked;
      state.sequentialMode = els.sequentialMode.checked;
      state.histHeight = clampInt(els.histHeightInput.value, 220, 700, state.histHeight);

      els.aInput.value = state.a;
      els.bInput.value = state.b;
      els.nInput.value = state.n;
      els.histHeightInput.value = state.histHeight;

      resetStats();
    }

    function syncHistHeightOnly() {
      state.histHeight = clampInt(els.histHeightInput.value, 220, 700, state.histHeight);
      els.histHeightInput.value = state.histHeight;
      renderAll();
    }

    function setParams(a, b, n) {
      els.aInput.value = a;
      els.bInput.value = b;
      els.nInput.value = n;
      syncParamsFromInputs();
    }

    function randomizeParams() {
      const total = Math.floor(12 + Math.random() * 180);
      const p = [0.2, 0.3, 0.4, 0.5, 0.6][Math.floor(Math.random() * 5)];
      let a = Math.max(1, Math.round(total * p));
      let b = Math.max(1, total - a);
      if (b === 0) b = 1;
      const n = Math.min(30, Math.max(2, Math.floor(2 + Math.random() * Math.min(10, total - 1))));
      setParams(a, b, n);
      showMessage("已随机生成一组参数，可直接开始演示。");
    }

    function scalePopulation(factor) {
      let a = state.a * factor;
      let b = state.b * factor;
      const cap = 3000;
      if (a > cap || b > cap) {
        const scale = Math.min(cap / a, cap / b);
        a = Math.max(1, Math.floor(a * scale));
        b = Math.max(1, Math.floor(b * scale));
        showMessage("已按上限自动缩放，避免参数过大。理论计算仍然有效。");
      }
      setParams(a, b, state.n);
    }

    function chooseColor(probWhite) {
      return Math.random() < probWhite ? "W" : "B";
    }

    function countWhite(arr) {
      return arr.reduce((s, x) => s + (x === "W" ? 1 : 0), 0);
    }

    function simulateRound() {
      let bagWhite = state.a;
      let bagBlack = state.b;
      const without = [];
      const withRep = [];
      const steps = [];
      const p = state.a / (state.a + state.b);

      for (let i = 1; i <= state.n; i++) {
        const noReplace = chooseColor(bagWhite / (bagWhite + bagBlack));
        without.push(noReplace);
        if (noReplace === "W") bagWhite -= 1;
        else bagBlack -= 1;

        const withColor = chooseColor(p);
        withRep.push(withColor);

        steps.push({
          step: i,
          withoutCurrent: noReplace,
          withCurrent: withColor,
          withoutSample: without.slice(),
          withSample: withRep.slice(),
          withoutWhiteCount: countWhite(without),
          withWhiteCount: countWhite(withRep),
          withoutBagWhite: bagWhite,
          withoutBagBlack: bagBlack,
          withBagWhite: state.a,
          withBagBlack: state.b
        });
      }

      return {
        steps,
        withoutTotalWhite: countWhite(without),
        withTotalWhite: countWhite(withRep),
        without,
        withRep
      };
    }

    function loadStep(stepData) {
      state.display.without = {
        step: stepData.step,
        current: stepData.withoutCurrent,
        sample: stepData.withoutSample,
        whiteCount: stepData.withoutWhiteCount,
        bagWhite: stepData.withoutBagWhite,
        bagBlack: stepData.withoutBagBlack
      };
      state.display.with = {
        step: stepData.step,
        current: stepData.withCurrent,
        sample: stepData.withSample,
        whiteCount: stepData.withWhiteCount,
        bagWhite: stepData.withBagWhite,
        bagBlack: stepData.withBagBlack
      };
    }

    function commitRound(round, options = {}) {
      const { showFinalStep = true } = options;
      state.experiments += 1;
      state.withoutCounts[round.withoutTotalWhite] += 1;
      state.withCounts[round.withTotalWhite] += 1;
      state.lastRound = {
        without: round.withoutTotalWhite,
        with: round.withTotalWhite,
        withoutSeq: round.without.slice(),
        withSeq: round.withRep.slice()
      };
      if (showFinalStep) {
        loadStep(round.steps[round.steps.length - 1]);
      }
    }

    function loadRoundSummary(round) {
      state.display.without = {
        step: 0,
        current: null,
        sample: [],
        whiteCount: round.withoutTotalWhite,
        bagWhite: state.a - round.withoutTotalWhite,
        bagBlack: state.b - (state.n - round.withoutTotalWhite)
      };
      state.display.with = {
        step: 0,
        current: null,
        sample: [],
        whiteCount: round.withTotalWhite,
        bagWhite: state.a,
        bagBlack: state.b
      };
    }

    function finishSingleRound(round, callback) {
      commitRound(round);
      state.running = false;
      state.paused = false;
      renderAll();
      if (callback) callback();
    }

    function animateRoundSequential(round, callback) {
      clearAllTimers();
      state.running = true;
      state.paused = false;
      createInitialDisplay();
      renderAll();
      let index = 0;

      const nextWith = () => {
        if (!state.running || state.paused) return;
        if (index >= round.steps.length) {
          finishSingleRound(round, callback);
          return;
        }
        const stepData = round.steps[index];
        state.display.with = {
          step: stepData.step,
          current: stepData.withCurrent,
          sample: stepData.withSample,
          whiteCount: stepData.withWhiteCount,
          bagWhite: stepData.withBagWhite,
          bagBlack: stepData.withBagBlack
        };
        renderAll();
        index += 1;
        schedule(nextWith, speedDelay());
      };

      const nextWithout = () => {
        if (!state.running || state.paused) return;
        if (index >= round.steps.length) {
          // 左侧完成，重置索引，启动右侧动画
          const finalStep = round.steps[round.steps.length - 1];
          state.display.without = {
            step: finalStep.step,
            current: null,
            sample: finalStep.withoutSample,
            whiteCount: finalStep.withoutWhiteCount,
            bagWhite: finalStep.withoutBagWhite,
            bagBlack: finalStep.withoutBagBlack
          };
          state.display.with = {
            step: 0,
            current: null,
            sample: [],
            whiteCount: 0,
            bagWhite: state.a,
            bagBlack: state.b
          };
          index = 0;
          renderAll();
          schedule(nextWith, speedDelay());
          return;
        }
        const stepData = round.steps[index];
        state.display.without = {
          step: stepData.step,
          current: stepData.withoutCurrent,
          sample: stepData.withoutSample,
          whiteCount: stepData.withoutWhiteCount,
          bagWhite: stepData.withoutBagWhite,
          bagBlack: stepData.withoutBagBlack
        };
        renderAll();
        index += 1;
        schedule(nextWithout, speedDelay());
      };

      schedule(nextWithout, speedDelay());
    }

    function animateRound(round, callback) {
      if (state.sequentialMode) {
        animateRoundSequential(round, callback);
        return;
      }
      clearAllTimers();
      state.running = true;
      state.paused = false;
      createInitialDisplay();
      renderAll();
      let index = 0;

      const next = () => {
        if (!state.running || state.paused) return;
        if (index >= round.steps.length) {
          finishSingleRound(round, callback);
          return;
        }
        loadStep(round.steps[index]);
        renderAll();
        index += 1;
        schedule(next, speedDelay());
      };

      schedule(next, speedDelay());
    }

    function runSingleDemo() {
      if (state.running) return;
      const round = simulateRound();
      animateRound(round, null);
    }

    function fastBatchSize() {
      if (state.autoRemaining > 500) return 40;
      if (state.autoRemaining > 200) return 20;
      if (state.autoRemaining > 80) return 8;
      if (state.autoRemaining > 25) return 3;
      return 1;
    }

    function runAuto() {
      if (state.running) return;
      state.autoRemaining = clampInt(els.autoBatchSelect.value, 1, 1000, 100);
      state.running = true;
      state.paused = false;
      stepAuto();
    }

    function batchChunkSize() {
      if (state.speed === "慢") return 20;
      if (state.speed === "中") return 60;
      if (state.speed === "快") return 120;
      if (state.speed === "极快") return 220;
      return 60;
    }

    function stepAuto() {
      if (!state.running || state.paused) return;
      if (state.autoRemaining <= 0) {
        state.running = false;
        renderAll();
        return;
      }

      if (state.useBatchAuto) {
        const round = simulateRound();
        commitRound(round, { showFinalStep: false });
        loadRoundSummary(round);
        state.autoRemaining -= 1;
        renderAll();
        if (state.autoRemaining > 0) {
          schedule(stepAuto, batchPause());
        } else {
          state.running = false;
          renderAll();
        }
        return;
      }

      const round = simulateRound();
      animateRound(round, () => {
        state.autoRemaining -= 1;
        state.running = true;
        stepAuto();
      });
    }

    function togglePause() {
      if (state.running) {
        state.paused = true;
        state.running = false;
        clearAllTimers();
        renderAll();
      } else if (state.paused && state.autoRemaining > 0) {
        state.paused = false;
        state.running = true;
        stepAuto();
        renderAll();
      }
    }

    function renderBag(container, whiteCount, blackCount, highlightColor) {
      const total = whiteCount + blackCount;
      const showCount = Math.min(total, 90);
      let whiteShown = total === 0 ? 0 : Math.round((whiteCount / total) * showCount);
      if (whiteCount > 0 && whiteShown === 0) whiteShown = 1;
      if (whiteShown > showCount) whiteShown = showCount;
      let blackShown = showCount - whiteShown;
      if (blackCount > 0 && blackShown === 0 && showCount > whiteShown) blackShown = 1;
      whiteShown = Math.min(whiteShown, showCount - blackShown);

      const hasWhiteHighlight = highlightColor === "W" && whiteShown > 0;
      const hasBlackHighlight = highlightColor === "B" && blackShown > 0;

      container.innerHTML = [
        ...Array.from({ length: whiteShown }, (_, idx) => `<div class="ball white${hasWhiteHighlight && idx === 0 ? " drawn" : ""}"></div>`),
        ...Array.from({ length: blackShown }, (_, idx) => `<div class="ball black${hasBlackHighlight && idx === 0 ? " drawn" : ""}"></div>`)
      ].join("");
      return total > showCount;
    }

    function renderSample(container, sample, currentStep) {
      const html = [];
      for (let i = 0; i < state.n; i++) {
        const val = sample[i];
        let cls = "draw-chip pending";
        let text = i + 1;
        if (val === "W") {
          cls = "draw-chip white";
          text = "";
        } else if (val === "B") {
          cls = "draw-chip black";
          text = "";
        }
        if (i === currentStep - 1 && val) cls += " active";
        html.push(`<div class="${cls}">${text}</div>`);
      }
      container.innerHTML = html.join("");
    }

    function renderCurrentBall(el, current) {
      if (!current) {
        el.className = "current-ball idle";
        el.textContent = "?";
        return;
      }
      el.className = current === "W" ? "current-ball white" : "current-ball black";
      el.textContent = current === "W" ? "白" : "黑";
    }

    function fmt(x) {
      return Number(x).toFixed(4);
    }

    function getExpProb(counts) {
      if (!state.experiments) return counts.map(() => 0);
      return counts.map((x) => x / state.experiments);
    }

    function logGamma(z) {
      const p = [
        676.5203681218851,
        -1259.1392167224028,
        771.32342877765313,
        -176.61502916214059,
        12.507343278686905,
        -0.13857109526572012,
        9.9843695780195716e-6,
        1.5056327351493116e-7
      ];
      if (z < 0.5) {
        return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
      }
      z -= 1;
      let x = 0.99999999999980993;
      for (let i = 0; i < p.length; i++) x += p[i] / (z + i + 1);
      const t = z + p.length - 0.5;
      return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
    }

    function logChoose(n, k) {
      if (k < 0 || k > n) return -Infinity;
      return logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
    }

    function normalizeLogProbs(logs) {
      const finite = logs.filter((x) => Number.isFinite(x));
      if (!finite.length) return logs.map(() => 0);
      const maxLog = Math.max(...finite);
      const vals = logs.map((x) => Number.isFinite(x) ? Math.exp(x - maxLog) : 0);
      const sum = vals.reduce((a, b) => a + b, 0);
      return vals.map((x) => x / sum);
    }

    function theoryHypergeometric() {
      const logs = [];
      for (let k = 0; k <= state.n; k++) {
        if (k > state.a || state.n - k > state.b) {
          logs.push(-Infinity);
        } else {
          logs.push(logChoose(state.a, k) + logChoose(state.b, state.n - k) - logChoose(state.a + state.b, state.n));
        }
      }
      return normalizeLogProbs(logs);
    }

    function theoryBinomial() {
      const p = state.a / (state.a + state.b);
      const q = 1 - p;
      const logs = [];
      for (let k = 0; k <= state.n; k++) {
        let v;
        if (p === 0) v = (k === 0 ? 0 : -Infinity);
        else if (q === 0) v = (k === state.n ? 0 : -Infinity);
        else v = logChoose(state.n, k) + k * Math.log(p) + (state.n - k) * Math.log(q);
        logs.push(v);
      }
      return normalizeLogProbs(logs);
    }

    function getTheoryBundle() {
      const hg = theoryHypergeometric();
      const bin = theoryBinomial();
      const diff = hg.map((x, i) => Math.abs(x - bin[i]));
      return { hg, bin, diff };
    }

    function prepCanvas(canvas) {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(300, Math.floor(rect.width * dpr));
      canvas.height = Math.max(220, Math.floor(rect.height * dpr));
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);
      return { ctx, width: rect.width, height: rect.height };
    }

    const chartTheme = {
      ink: "#101010",
      text: "#161616",
      grid: "#d7dde8",
      axis: "#232323",
      expHg: "rgba(58, 112, 255, 0.9)",
      expBin: "rgba(255, 136, 64, 0.9)",
      thHg: "rgba(23, 74, 188, 0.86)",
      thBin: "rgba(210, 108, 28, 0.86)",
      diff: "#555c67"
    };

    function drawAxes(ctx, width, height, maxY, labelY) {
      const pad = { left: 72, right: 28, top: 72, bottom: 58 };
      const plotW = width - pad.left - pad.right;
      const plotH = height - pad.top - pad.bottom;
      ctx.strokeStyle = chartTheme.grid;
      ctx.lineWidth = 1.2;
      for (let i = 0; i <= 5; i++) {
        const y = pad.top + (plotH * i) / 5;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(width - pad.right, y);
        ctx.stroke();

        const tickVal = maxY * (1 - i / 5);
        ctx.fillStyle = chartTheme.text;
        ctx.font = "600 16px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(tickVal.toFixed(2), pad.left - 8, y + 4);
      }
      ctx.strokeStyle = chartTheme.axis;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(pad.left, pad.top);
      ctx.lineTo(pad.left, height - pad.bottom);
      ctx.lineTo(width - pad.right, height - pad.bottom);
      ctx.stroke();
      ctx.fillStyle = chartTheme.ink;
      ctx.font = "700 18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("白球个数 k", pad.left + plotW / 2, height - 16);
      ctx.save();
      ctx.translate(24, pad.top + plotH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(labelY, 0, 0);
      ctx.restore();
      return { pad, plotW, plotH };
    }

    function toY(value, maxY, pad, plotH) {
      return pad.top + plotH * (1 - value / maxY);
    }

    function drawLegend(ctx, items, width) {
      let x = 18;
      let y = 28;
      const rowH = 30;
      ctx.font = "600 16px sans-serif";
      ctx.textAlign = "left";
      items.forEach((item) => {
        const textW = ctx.measureText(item.label).width;
        const itemW = 18 + 8 + textW + 20;
        if (x + itemW > width - 16) {
          x = 18;
          y += rowH;
        }

        ctx.fillStyle = item.color;
        if (item.type === "line") {
          ctx.lineWidth = 3;
          ctx.strokeStyle = item.color;
          ctx.beginPath();
          ctx.moveTo(x, y - 6);
          ctx.lineTo(x + 18, y - 6);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x + 9, y - 6, 3.1, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(x, y - 12, 18, 10);
        }
        ctx.fillStyle = chartTheme.ink;
        ctx.fillText(item.label, x + 26, y - 1);
        x += itemW;
      });
    }

    function drawRoundedBar(ctx, x, y, w, h, r) {
      if (h <= 0) return;
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      ctx.lineTo(x, y + rr);
      ctx.quadraticCurveTo(x, y, x + rr, y);
      ctx.lineTo(x + w - rr, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
      ctx.fill();
    }

    function drawBars(ctx, data, color, borderColor, width, height, pad, plotW, plotH, maxY, seriesIndex, seriesCount) {
      const groupW = plotW / data.length;
      const gap = 3;
      const usable = Math.max(10, groupW * 0.86);
      const barW = Math.max(4, (usable - gap * (seriesCount - 1)) / seriesCount);
      for (let i = 0; i < data.length; i++) {
        const centerX = pad.left + groupW * (i + 0.5);
        const startX = centerX - usable / 2;
        const x = startX + seriesIndex * (barW + gap);
        const h = plotH * (data[i] / maxY);
        ctx.fillStyle = color;
        drawRoundedBar(ctx, x, height - pad.bottom - h, barW, h, 6);
        if (borderColor) {
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, height - pad.bottom - h + 0.5, Math.max(0, barW - 1), Math.max(0, h - 1));
        }
      }
    }

    function drawLine(ctx, data, color, width, pad, plotW, plotH, maxY) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      data.forEach((v, i) => {
        const x = pad.left + plotW * ((i + 0.5) / data.length);
        const y = toY(v, maxY, pad, plotH);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      data.forEach((v, i) => {
        const x = pad.left + plotW * ((i + 0.5) / data.length);
        const y = toY(v, maxY, pad, plotH);
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(x, y, 4.4, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    function drawHistogram() {
      const { ctx, width, height } = prepCanvas(els.histCanvas);
      const expHg = getExpProb(state.withoutCounts);
      const expBin = getExpProb(state.withCounts);
      const { hg, bin } = getTheoryBundle();
      const maxY = Math.max(0.12, ...expHg, ...expBin, ...hg, ...bin) * 1.15;
      const { pad, plotW, plotH } = drawAxes(ctx, width, height, maxY, "概率 / 频率");

      for (let i = 0; i <= state.n; i++) {
        const centerX = pad.left + plotW * ((i + 0.5) / (state.n + 1));
        ctx.fillStyle = chartTheme.ink;
        ctx.font = "600 16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(String(i), centerX, height - pad.bottom + 22);
      }

      const series = [];
      if (state.showExp) {
        series.push({ label: "不放回实验", color: chartTheme.expHg, border: "rgba(26,74,202,0.9)", data: expHg, type: "bar" });
        series.push({ label: "放回实验", color: chartTheme.expBin, border: "rgba(177,88,22,0.9)", data: expBin, type: "bar" });
      }
      if (state.showTheory) {
        series.push({ label: "超几何理论值", color: chartTheme.thHg, border: "rgba(13,53,150,0.95)", data: hg, type: "bar" });
        series.push({ label: "二项理论值", color: chartTheme.thBin, border: "rgba(152,75,18,0.95)", data: bin, type: "bar" });
      }

      series.forEach((s, idx) => {
        drawBars(ctx, s.data, s.color, s.border, width, height, pad, plotW, plotH, maxY, idx, series.length);
      });

      const legend = [];
      if (state.showExp) {
        legend.push({ label: "不放回实验", color: chartTheme.expHg, type: "bar" });
        legend.push({ label: "放回实验", color: chartTheme.expBin, type: "bar" });
      }
      if (state.showTheory) {
        legend.push({ label: "超几何理论值", color: chartTheme.thHg, type: "bar" });
        legend.push({ label: "二项理论值", color: chartTheme.thBin, type: "bar" });
      }
      drawLegend(ctx, legend, width);
    }

    function drawTheory() {
      const { ctx, width, height } = prepCanvas(els.theoryCanvas);
      const { hg, bin } = getTheoryBundle();
      const maxY = Math.max(0.12, ...hg, ...bin) * 1.15;
      const { pad, plotW, plotH } = drawAxes(ctx, width, height, maxY, "理论概率");
      for (let i = 0; i <= state.n; i++) {
        const x = pad.left + plotW * ((i + 0.5) / (state.n + 1));
        ctx.fillStyle = chartTheme.ink;
        ctx.font = "600 16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(String(i), x, height - pad.bottom + 22);
      }
      drawLine(ctx, hg, "#2258d6", width, pad, plotW, plotH, maxY);
      drawLine(ctx, bin, "#d97221", width, pad, plotW, plotH, maxY);
      drawLegend(ctx, [
        { label: "超几何理论值", color: "#2258d6", type: "line" },
        { label: "二项理论值", color: "#d97221", type: "line" }
      ], width);
    }

    function drawDiff() {
      const { ctx, width, height } = prepCanvas(els.diffCanvas);
      if (!state.showDiff) {
        ctx.fillStyle = chartTheme.ink;
        ctx.font = "600 16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("已关闭差值图显示", width / 2, height / 2);
        return;
      }
      const { diff } = getTheoryBundle();
      const maxY = Math.max(0.03, ...diff) * 1.18;
      const { pad, plotW, plotH } = drawAxes(ctx, width, height, maxY, "|ΔP|");
      const groupW = plotW / (state.n + 1);
      const barW = Math.min(34, groupW * 0.55);
      for (let i = 0; i <= state.n; i++) {
        const centerX = pad.left + groupW * (i + 0.5);
        const h = plotH * (diff[i] / maxY);
        const grad = ctx.createLinearGradient(0, height - pad.bottom - h, 0, height - pad.bottom);
        grad.addColorStop(0, "rgba(95,105,120,0.92)");
        grad.addColorStop(1, "rgba(146,156,170,0.55)");
        ctx.fillStyle = grad;
        drawRoundedBar(ctx, centerX - barW / 2, height - pad.bottom - h, barW, h, 6);
        ctx.fillStyle = chartTheme.ink;
        ctx.font = "600 16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(String(i), centerX, height - pad.bottom + 22);
      }
      drawLegend(ctx, [{ label: "|P_HG - P_Bin|", color: chartTheme.diff, type: "bar" }], width);
    }

    function ratioClass(ratio) {
      if (ratio <= 0.08) return { cls: "good", text: "非常接近", hint: "n 相对总体很小，不放回造成的组成变化很弱，两种分布通常已很接近。" };
      if (ratio <= 0.18) return { cls: "mid", text: "较为接近", hint: "已经可以看出近似趋势，但局部仍可能有可见差异。" };
      return { cls: "warn", text: "差异较明显", hint: "抽取次数占总体比例不小，不放回对后续概率的影响更明显。" };
    }

    function renderMetrics(theory) {
      const ratio = state.n / (state.a + state.b);
      els.ratioText.textContent = `n / (a+b) = ${ratio.toFixed(4)}`;
      const rc = ratioClass(ratio);
      els.ratioMetric.className = `metric ${state.highlightRatio ? rc.cls : ""}`;
      els.ratioHint.textContent = state.highlightRatio
        ? rc.hint
        : "勾选“高亮 n / (a+b) 指标”后，会根据比例自动给出颜色提示。";

      els.judgeMetric.className = `metric ${rc.cls}`;
      els.judgeText.textContent = rc.text;
      els.judgeHint.textContent = rc.hint;
      els.expCount.textContent = String(state.experiments);
      els.pText.textContent = `p = ${(state.a / (state.a + state.b)).toFixed(4)}`;

      const tv = theory.diff.reduce((a, b) => a + b, 0);
      const maxDiff = Math.max(...theory.diff);
      els.tvText.textContent = `Σ|ΔP| = ${fmt(tv)}`;
      els.maxDiffText.textContent = `max|ΔP| = ${fmt(maxDiff)}`;
    }

    function renderPanels() {
      const wd = state.display.without;
      const wr = state.display.with;
      renderBag(els.withoutBag, wd.bagWhite, wd.bagBlack, wd.current);
      renderBag(els.withBag, wr.bagWhite, wr.bagBlack, wr.current);

      renderCurrentBall(els.withoutCurrentBall, wd.current);
      renderCurrentBall(els.withCurrentBall, wr.current);
      renderSample(els.withoutSample, wd.sample, wd.step);
      renderSample(els.withSample, wr.sample, wr.step);

      els.withoutStepText.textContent = `第 ${wd.step} / ${state.n} 次`;
      els.withStepText.textContent = `第 ${wr.step} / ${state.n} 次`;
      els.withoutCurrentText.textContent = wd.current ? (wd.current === "W" ? "白球" : "黑球") : "—";
      els.withCurrentText.textContent = wr.current ? (wr.current === "W" ? "白球" : "黑球") : "—";
      els.withoutWhiteCount.textContent = String(wd.whiteCount);
      els.withWhiteCount.textContent = String(wr.whiteCount);
      els.withoutWhiteRemain.textContent = String(wd.bagWhite);
      els.withoutBlackRemain.textContent = String(wd.bagBlack);
      els.withWhiteRemain.textContent = String(state.a);
      els.withBlackRemain.textContent = String(state.b);

      const miniStatsDisplay = state.showMiniStats ? "grid" : "none";
      els.withoutStatsGrid.style.display = miniStatsDisplay;
      els.withStatsGrid.style.display = miniStatsDisplay;

      const panelMinHeight = state.showMiniStats ? "560px" : "auto";
      els.withoutPanel.style.minHeight = panelMinHeight;
      els.withPanel.style.minHeight = panelMinHeight;
    }

    function renderSummary(theory) {
      const ratio = state.n / (state.a + state.b);
      const tv = theory.diff.reduce((a, b) => a + b, 0);
      const judgement = ratioClass(ratio).text;
      els.observationText.textContent = state.experiments === 0
        ? "先通过单次演示观察“袋中组成是否变化”，再通过自动实验比较两种分布的频率图。"
        : `当前已经完成 ${state.experiments} 轮实验。继续增加实验轮数，可以看到实验频率更稳定地贴近理论分布。`;

      els.lastResultText.textContent = state.lastRound
        ? `最近一轮：不放回得到 ${state.lastRound.without} 个白球，放回得到 ${state.lastRound.with} 个白球。`
        : "本轮尚未开始。";

      els.mechanismText.textContent = ratio > 0.18
        ? "当前参数下，不放回每抽一次都会更明显地改变袋中组成，因此后续概率与放回情形差别较大。"
        : "当前参数下，虽然不放回仍会改变袋中组成，但这种扰动相对较弱，因此两种分布开始靠近。";

      els.ratioExplainText.textContent = `现在 n / (a+b) = ${ratio.toFixed(4)}，对应的理论判断是“${judgement}”。`;
      els.conclusionText.textContent = tv <= 0.08
        ? "当前参数下，两种理论分布已经非常接近，可将超几何分布视为二项分布的良好近似。"
        : tv <= 0.18
          ? "当前参数下，两种理论分布已有明显接近趋势，但局部仍可观察到差异。"
          : "当前参数下，两种理论分布差异仍较明显，更适合先强调抽样机制的本质区别。";
    }

    function renderTable(theory) {
      const expHg = getExpProb(state.withoutCounts);
      const expBin = getExpProb(state.withCounts);
      const rows = [];
      for (let k = 0; k <= state.n; k++) {
        rows.push(`
          <tr>
            <td>${k}</td>
            <td>${fmt(theory.hg[k])}</td>
            <td>${fmt(theory.bin[k])}</td>
            <td>${fmt(theory.diff[k])}</td>
            <td>${fmt(expHg[k])}</td>
            <td>${fmt(expBin[k])}</td>
          </tr>
        `);
      }
      els.resultBody.innerHTML = rows.join("");
    }

    function renderButtons() {
      els.singleBtn.disabled = state.running;
      els.autoBtn.disabled = state.running;
      if (state.paused && state.autoRemaining > 0) {
        els.pauseBtn.textContent = "继续";
        els.pauseBtn.disabled = false;
      } else if (state.running && state.autoRemaining > 0) {
        els.pauseBtn.textContent = "暂停";
        els.pauseBtn.disabled = false;
      } else {
        els.pauseBtn.textContent = "暂停";
        els.pauseBtn.disabled = true;
      }
    }

    function renderAll() {
      els.histCanvas.style.height = `${state.histHeight}px`;
      const theory = getTheoryBundle();
      renderMetrics(theory);
      renderPanels();
      renderSummary(theory);
      renderTable(theory);
      drawHistogram();
      drawTheory();
      drawDiff();
      renderButtons();
    }

    function bindEvents() {
      [els.aInput, els.bInput, els.nInput, els.speedSelect].forEach((el) => {
        el.addEventListener("change", syncParamsFromInputs);
      });
      els.histHeightInput.addEventListener("change", syncHistHeightOnly);
      [els.showTheory, els.showExp, els.showDiff, els.highlightRatio, els.showMiniStats, els.useBatchAuto, els.sequentialMode].forEach((el) => {
        el.addEventListener("change", () => {
          state.showTheory = els.showTheory.checked;
          state.showExp = els.showExp.checked;
          state.showDiff = els.showDiff.checked;
          state.highlightRatio = els.highlightRatio.checked;
          state.showMiniStats = els.showMiniStats.checked;
          state.useBatchAuto = els.useBatchAuto.checked;
          state.sequentialMode = els.sequentialMode.checked;
          renderAll();
        });
      });
      els.singleBtn.addEventListener("click", runSingleDemo);
      els.autoBtn.addEventListener("click", runAuto);
      els.pauseBtn.addEventListener("click", togglePause);
      els.resetBtn.addEventListener("click", resetStats);
      els.randomBtn.addEventListener("click", randomizeParams);
      els.scale10Btn.addEventListener("click", () => scalePopulation(10));
      els.scale100Btn.addEventListener("click", () => scalePopulation(100));
      document.querySelectorAll(".preset").forEach((btn) => {
        btn.addEventListener("click", () => {
          setParams(btn.dataset.a, btn.dataset.b, btn.dataset.n);
        });
      });
      window.addEventListener("resize", renderAll);
    }

    function init() {
      createCounts();
      createInitialDisplay();
      bindEvents();
      renderAll();
    }

    init();
