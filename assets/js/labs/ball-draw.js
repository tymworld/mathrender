(() => {
  // RNG (optional)
  function mulberry32(seed){
    let a = seed >>> 0;
    return function(){
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
  }

  // Helpers
  function hslColor(h, s=80, l=52){ return `hsl(${Math.round(h)%360} ${s}% ${l}%)`; }
  function normalizeColorToken(s){ return String(s || "").trim().toLowerCase(); }

  function uniqPreserve(arr){
    const seen = new Set(); const out = [];
    for (const x of arr){
      const k = normalizeColorToken(x);
      if (k && !seen.has(k)){ seen.add(k); out.push(String(x).trim()); }
    }
    return out;
  }
  function clampInt(x, lo, hi, fallback){
    const n = Number(x);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(lo, Math.min(hi, Math.floor(n)));
  }

  // index -> label: 0->a ... 25->z, 26->aa...
  function indexToLabel(idx){
    idx = Math.max(0, Math.floor(idx));
    let s = "";
    while (true){
      s = String.fromCharCode(97 + (idx % 26)) + s;
      idx = Math.floor(idx / 26) - 1;
      if (idx < 0) break;
    }
    return s;
  }
  function buildColorToLabelMap(template){
    const map = new Map();
    template.forEach((c, i) => map.set(normalizeColorToken(c), indexToLabel(i)));
    return map;
  }

  // ✅ 成分分组：colors -> groupKey / display title
  function groupKeyFromColors(resultColors){
    const M = state.bagTemplate.length;
    const counts = new Array(M).fill(0);

    for (const c of resultColors){
      const key = normalizeColorToken(c);
      let idx = -1;
      for (let i=0;i<M;i++){
        if (normalizeColorToken(state.bagTemplate[i]) === key){ idx = i; break; }
      }
      if (idx >= 0) counts[idx] += 1;
    }
    return counts.join(",");
  }
  function groupTitleFromKey(groupKey){
    const counts = groupKey.split(",").map(Number);
    const parts = [];
    for (let i=0;i<counts.length;i++){
      if (counts[i] > 0){
        parts.push(`${counts[i]}${indexToLabel(i)}`);
      }
    }
    return parts.length ? parts.join(", ") : "（未知成分）";
  }

  function countArrangementsFromGroupKey(groupKey){
    // groupKey: "0,1,2,0,..."  counts sum = N
    const counts = groupKey.split(",").map(x => Math.max(0, Number(x) || 0));
    const N = counts.reduce((a,b)=>a+b, 0);

    // N <= 10 (你界面限制)，用普通整数就足够；也可用 BigInt 更保险
    function fact(n){
      let r = 1;
      for (let i=2;i<=n;i++) r *= i;
      return r;
    }

    let denom = 1;
    for (const c of counts) denom *= fact(c);
    return Math.round(fact(N) / denom);
  }


  // High contrast palette
  const HIGH_CONTRAST_PALETTE = [
    "#ef4444", "#f59e0b", "#3b82f6", "#22c55e", "#a855f7", "#06b6d4",
    "#ec4899", "#84cc16", "#f97316", "#14b8a6", "#8b5cf6", "#0ea5e9",
    "#e11d48", "#facc15", "#1d4ed8", "#16a34a", "#7c3aed", "#0891b2"
  ];

  function genDistinctColorsAvoid(existingColors, k){
    const existing = new Set(existingColors.map(normalizeColorToken));
    const out = [];

    for (const c of HIGH_CONTRAST_PALETTE){
      if (out.length >= k) break;
      const key = normalizeColorToken(c);
      if (!existing.has(key)){
        out.push(c);
        existing.add(key);
      }
    }

    let i = 0;
    const golden = 137.50776405;
    while (out.length < k && i < 800){
      const c = hslColor(30 + i*golden, 82, 52);
      const key = normalizeColorToken(c);
      if (!existing.has(key)){
        out.push(c);
        existing.add(key);
      }
      i += 1;
    }
    return out;
  }

  // Canvas
  const themeToggle = document.getElementById("themeToggle");
  const canvas = document.getElementById("cv");
  const ctx = canvas.getContext("2d");
  let W=0, H=0, DPR=1;

  function resize(){
    const r = canvas.getBoundingClientRect();
    DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    W = Math.floor(r.width * DPR);
    H = Math.floor(r.height * DPR);
    canvas.width = W;
    canvas.height = H;
  }
  window.addEventListener("resize", () => { resize(); drawStatic(); });

  // Easing
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const easeInOutCubic = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
  const easeOutBack = (t, s=1.7) => 1 + (s+1)*Math.pow(t-1,3) + s*Math.pow(t-1,2);
  const easeOutQuad = t => 1 - (1-t)*(1-t);

  // UI refs
  const elNumBags = document.getElementById("numBags");
  const elBallsPerBag = document.getElementById("ballsPerBag");
  const elColors = document.getElementById("colors");
  const elMode = document.getElementById("mode");
  const elSeed = document.getElementById("seed");
  const elMsg = document.getElementById("msg");
  const elEnumOrder = document.getElementById("enumOrder");
  const elEnumSpeed = document.getElementById("enumSpeed");

  const btnApply = document.getElementById("apply");
  const btnDraw = document.getElementById("draw");
  const btnAutoEnum = document.getElementById("autoEnum");

  const recordsEl = document.getElementById("records");
  const emptyTipEl = document.getElementById("emptyTip");
  const btnClearRecords = document.getElementById("clearRecords");
  const btnToggleBagBalls = document.getElementById("toggleBagBalls");
  const btnToggleNoRepeat = document.getElementById("toggleNoRepeat");

  function setMsg(text, warn=false){
    elMsg.textContent = text;
    elMsg.style.color = warn ? "#b91c1c" : "var(--muted)";
  }

  // Config & state
  const CFG = {
    mixTime: 0.54,
    revealTime: 0.42,
    flightTime: 0.68,
    bounceTime: 0.42,
    staggerTime: 0.075,

    showBallsInBag: true,

    drawBallR: 23,
    bagBallR: 13,

    enumLimit: 50000, // guardrail

    // ✅ 字体缩放：袋内更大；抽出的大球稍大
    labelScaleInBag: 1.95,
    labelScaleDrawn: 1.85,
  };

  let state = {
    numBags: 3,
    ballsPerBag: 2,
    colors: ["#ef4444","#f59e0b","#3b82f6"],
    mode: "with",
    rng: Math.random,

    bagContents: [],
    bagTemplate: [],

    // color -> label
    colorLabelMap: new Map(),

    noRepeatWithReplacement: false,

    // Auto enumeration
    autoEnumRunning: false,
    enumIndex: 0,
    enumTotal: 0,
    enumOrder: "lex",          // "lex" | "comp" | "random"
    randomEnumOrder: null,     // array of indices (shuffled)
    compEnumOrder: null,       // array of indices (composition-grouped)
    enumTimer: null,

    // ✅ 分组显示状态（右侧记录）
    lastGroupKey: null,
    groupCounts: null,         // Map(groupKey -> count)

    lastResult: null,
    anim: null,
  };

  function getEnumDelayMs(){
    const v = elEnumSpeed.value;
    if (v === "fast") return 70;
    if (v === "slow") return 320;
    return 150;
  }

  // Records
  let recordCount = 0;

  function appendGroupHeaderIfNeeded(resultColors){
    const shouldGroup = (state.mode==="with" && state.noRepeatWithReplacement && state.enumOrder==="comp");
    if (!shouldGroup){
      state.lastGroupKey = null;
      return;
    }

    const gk = groupKeyFromColors(resultColors);
    if (state.lastGroupKey === gk) return;

    state.lastGroupKey = gk;

    const header = document.createElement("div");
    header.className = "groupHeader";

    const left = document.createElement("div");
    left.className = "groupTitle";
    left.textContent = `成分：${groupTitleFromKey(gk)}`;

    const right = document.createElement("div");
    right.className = "groupHint";
    const cnt = state.groupCounts?.get(gk);
    const ways = (cnt != null) ? cnt : countArrangementsFromGroupKey(gk);
    right.innerHTML = `<span class="groupBadge">共 ${ways} 种</span>`;



    header.appendChild(left);
    header.appendChild(right);
    recordsEl.appendChild(header);
  }

  function addRecordRow(resultColors){
    recordCount += 1;
    if (emptyTipEl) emptyTipEl.style.display = "none";

    // ✅ 分组头（仅 comp 枚举时）
    appendGroupHeaderIfNeeded(resultColors);

    const row = document.createElement("div");
    row.className = "recordRow";

    const meta = document.createElement("div");
    meta.className = "recordMeta";
    meta.textContent = `#${recordCount}`;

    const balls = document.createElement("div");
    balls.className = "recordBalls";
    resultColors.forEach((c, idx) => {
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.backgroundColor = c;

      const lab = state.colorLabelMap.get(normalizeColorToken(c)) || "";
      dot.textContent = lab;

      dot.title = `袋 ${idx+1}: ${lab ? (lab + " / ") : ""}${c}`;
      balls.appendChild(dot);
    });

    const right = document.createElement("div");
    right.className = "recordRight";
    const extra = (state.mode==="with" && state.noRepeatWithReplacement) ? "·不重复" : "";
    right.textContent = `${state.mode==="with"?"放回":"不放回"}${extra}`;

    row.appendChild(meta);
    row.appendChild(balls);
    row.appendChild(right);

    recordsEl.appendChild(row);
    recordsEl.scrollTop = recordsEl.scrollHeight;
  }

  function clearRecords(){
    [...recordsEl.querySelectorAll(".recordRow, .groupHeader")].forEach(n => n.remove());
    recordCount = 0;
    if (emptyTipEl) emptyTipEl.style.display = "block";
    recordsEl.scrollTop = 0;

    // ✅ reset grouping state
    state.lastGroupKey = null;
    state.groupCounts = null;
  }
  btnClearRecords.addEventListener("click", clearRecords);

  // Toggles
  function updateToggleBtn(){
    btnToggleBagBalls.classList.toggle("on", CFG.showBallsInBag);
    btnToggleBagBalls.textContent = `袋内球：${CFG.showBallsInBag ? "开" : "关"}`;
  }
  btnToggleBagBalls.addEventListener("click", () => {
    CFG.showBallsInBag = !CFG.showBallsInBag;
    updateToggleBtn();
    drawStatic();
  });

  function stopAutoEnum(silent=false){
    if (state.enumTimer){
      clearTimeout(state.enumTimer);
      state.enumTimer = null;
    }
    if (state.autoEnumRunning){
      state.autoEnumRunning = false;
      updateAutoEnumAvailability();
      if (!silent) setMsg("已停止自动枚举。");
    }
  }

  function setNoRepeatEnabled(enabled){
    state.noRepeatWithReplacement = !!enabled;
    btnToggleNoRepeat.classList.toggle("on", state.noRepeatWithReplacement);
    btnToggleNoRepeat.textContent = `放回不重复：${state.noRepeatWithReplacement ? "开" : "关"}`;

    if (!state.noRepeatWithReplacement) stopAutoEnum(true);

    prepareEnumPlan();
    updateAutoEnumAvailability();
  }

  function updateNoRepeatBtnAvailability(){
    const active = (state.mode === "with");
    btnToggleNoRepeat.classList.toggle("disabled", !active);
    btnToggleNoRepeat.disabled = !active;
    if (!active) setNoRepeatEnabled(false);
  }

  btnToggleNoRepeat.addEventListener("click", () => {
    if (btnToggleNoRepeat.disabled) return;
    setNoRepeatEnabled(!state.noRepeatWithReplacement);
    if (state.noRepeatWithReplacement){
      setMsg(`放回不重复已开启：可用“自动枚举”。`);
    } else {
      setMsg(`放回不重复已关闭。`);
    }
  });

  // Layout
  function layout(){
    const n = state.numBags;
    const sidePadding = 45*DPR;
    const usableW = Math.max(220*DPR,W-sidePadding*2);
    const maxGap = n <= 3 ? 220*DPR : (n <= 5 ? 155*DPR : (n <= 7 ? 112*DPR : usableW/Math.max(1,n-1)));
    const gap = n === 1 ? 0 : Math.min(maxGap,usableW/(n-1));
    const groupW = gap*(n-1);
    const startX = W*.5-groupW*.5;
    const cellW = n === 1 ? Math.min(180*DPR,usableW) : Math.min(gap,usableW/n);
    const bagW = Math.min(136*DPR,Math.max(58*DPR,cellW*.78));
    const bagH = bagW*1.29;
    const topY = Math.min(116*DPR,H*.31);

    const bags = [];
    for (let i=0;i<n;i++){
      const x = n === 1 ? W*.5 : startX+gap*i;
      bags.push({ cx:x, cy:topY, w:bagW, h:bagH, _i:i });
    }

    const slotY = Math.min(292*DPR,H*.75);
    const slotW = Math.min(84*DPR,Math.max(46*DPR,cellW*.47));
    const slots = [];
    for (let i=0;i<n;i++) slots.push({ x: bags[i].cx, y: slotY, w:slotW });
    const ballR = Math.min(CFG.drawBallR*DPR, slotW*.27);
    return { bags, slots, ballR };
  }

  // Draw primitives
  function drawBg(){
    const dark = document.body.getAttribute("data-theme") === "dark";
    const bg = ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0, dark ? "#111d33" : "#fafdff");
    bg.addColorStop(.58, dark ? "#17243a" : "#f2f8fb");
    bg.addColorStop(1, dark ? "#0d1729" : "#e8f0f3");
    ctx.fillStyle = bg;
    ctx.fillRect(0,0,W,H);

    ctx.save();
    const glow = ctx.createRadialGradient(W*.5,H*.06,0,W*.5,H*.12,W*.68);
    glow.addColorStop(0, dark ? "rgba(96,165,250,.14)" : "rgba(255,255,255,.94)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0,0,W,H*.72);

    const horizonY = Math.min(225*DPR,H*.56);
    ctx.strokeStyle = dark ? "rgba(148,163,184,.10)" : "rgba(100,116,139,.10)";
    ctx.lineWidth = 1*DPR;
    ctx.beginPath();
    ctx.moveTo(0,horizonY);
    ctx.lineTo(W,horizonY);
    ctx.stroke();

    const floorCenterY = horizonY+(H-horizonY)*.48;
    const floorGlow = ctx.createRadialGradient(W*.5,floorCenterY,0,W*.5,floorCenterY,W*.52);
    floorGlow.addColorStop(0, dark ? "rgba(56,189,248,.055)" : "rgba(255,255,255,.65)");
    floorGlow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = floorGlow;
    ctx.fillRect(0,horizonY,W,H-horizonY);
    ctx.restore();
  }

  function drawSlots(slots){
    ctx.save();
    const dark = document.body.getAttribute("data-theme") === "dark";
    for (const s of slots){
      const rw = s.w*.56;
      const rh = Math.max(9*DPR,s.w*.12);

      ctx.beginPath();
      ctx.ellipse(s.x + 3*DPR, s.y + 15*DPR, rw*1.07, rh*1.22, 0, 0, Math.PI*2);
      ctx.fillStyle = "rgba(15,23,42,.15)";
      ctx.fill();

      const tray = ctx.createLinearGradient(0,s.y-rh,0,s.y+rh);
      tray.addColorStop(0, dark ? "#718096" : "#ffffff");
      tray.addColorStop(.48, dark ? "#2d3b52" : "#dfe8ed");
      tray.addColorStop(1, dark ? "#121d2e" : "#aebdc5");
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 8*DPR, rw, rh, 0, 0, Math.PI*2);
      ctx.fillStyle = tray;
      ctx.fill();
      ctx.strokeStyle = dark ? "rgba(203,213,225,.38)" : "rgba(71,85,105,.28)";
      ctx.lineWidth = 1.5*DPR;
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 5*DPR, rw*.82, rh*.55, 0, 0, Math.PI*2);
      ctx.fillStyle = dark ? "rgba(8,15,27,.68)" : "rgba(148,163,184,.20)";
      ctx.fill();
    }
    ctx.restore();
  }

  // 球体：球面渐变、环境反光、接触阴影和印刷字母
  function drawBall(x, y, r, color, label=null, fontScale=1, options={}){
    const scaleX = options.scaleX ?? 1;
    const scaleY = options.scaleY ?? 1;
    const rotation = options.rotation ?? 0;
    const alpha = options.alpha ?? 1;

    ctx.save();
    ctx.globalAlpha = alpha;

    if (options.shadow !== false){
      const shadowLift = Math.max(0, options.lift ?? 0);
      const shadowScale = Math.max(.34, 1-shadowLift/180);
      const shadowY = options.shadowY ?? (y + r*.82 + shadowLift*.06);
      ctx.beginPath();
      ctx.ellipse(x + 5*DPR, shadowY, r*1.02*shadowScale, r*.34*shadowScale, 0, 0, Math.PI*2);
      ctx.fillStyle = `rgba(15,23,42,${.19*shadowScale})`;
      ctx.fill();
    }

    ctx.translate(x,y);
    ctx.rotate(rotation);
    ctx.scale(scaleX,scaleY);

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI*2);
    ctx.fillStyle = color;
    ctx.fill();

    const shade = ctx.createRadialGradient(-r*.42,-r*.48,r*.04,-r*.08,-r*.12,r*1.18);
    shade.addColorStop(0,"rgba(255,255,255,.66)");
    shade.addColorStop(.26,"rgba(255,255,255,.12)");
    shade.addColorStop(.68,"rgba(15,23,42,.04)");
    shade.addColorStop(1,"rgba(2,6,23,.43)");
    ctx.fillStyle = shade;
    ctx.fill();

    ctx.strokeStyle = "rgba(15,23,42,.48)";
    ctx.lineWidth = Math.max(1.2*DPR,r*.07);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(-r*.37,-r*.43,r*.20,r*.11,-.55,0,Math.PI*2);
    ctx.fillStyle = "rgba(255,255,255,.78)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(r*.31,r*.34,r*.08,0,Math.PI*2);
    ctx.fillStyle = "rgba(255,255,255,.16)";
    ctx.fill();

    const key = normalizeColorToken(color);
    const txt = (label != null) ? String(label) : (state.colorLabelMap?.get(key) || "");
    if (txt){
      // luminance check for hex
      let textColor = "rgba(255,255,255,.92)";
      if (typeof color === "string" && color.startsWith("#") && color.length === 7){
        const rr = parseInt(color.slice(1,3),16);
        const gg = parseInt(color.slice(3,5),16);
        const bb = parseInt(color.slice(5,7),16);
        const lum = (0.2126*rr + 0.7152*gg + 0.0722*bb) / 255;
        textColor = lum > 0.65 ? "rgba(17,24,39,.92)" : "rgba(255,255,255,.92)";
      }

      const px = Math.max(12, r*0.95) * fontScale / DPR;
      ctx.font = `950 ${px}px ui-sans-serif, system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // outline
      ctx.lineWidth = 4*DPR;
      ctx.strokeStyle = "rgba(15,23,42,.35)";
      ctx.strokeText(txt, 0, 0.5*DPR);

      ctx.fillStyle = textColor;
      ctx.fillText(txt, 0, 0.5*DPR);
    }

    ctx.restore();
  }

  function traceBagBody(w,h){
    const topY = -h*.37;
    const botY = h*.40;
    const mouthW = w*.69;
    ctx.beginPath();
    ctx.moveTo(-mouthW*.5,topY+4*DPR);
    ctx.bezierCurveTo(-w*.43,-h*.16,-w*.53,h*.17,-w*.39,botY-8*DPR);
    ctx.bezierCurveTo(-w*.20,botY+12*DPR,w*.20,botY+12*DPR,w*.39,botY-8*DPR);
    ctx.bezierCurveTo(w*.53,h*.17,w*.43,-h*.16,mouthW*.5,topY+4*DPR);
    ctx.closePath();
  }

  // 袋内球随混匀轻微碰撞；统一在袋体剪裁区内绘制
  function drawMiniBallsInBag(bag, colors, mix=0){
    if (!CFG.showBallsInBag) return;
    if (!colors || colors.length === 0) return;

    const {w,h} = bag;
    const cols = w < 95*DPR ? 2 : 3;
    const r = Math.min(CFG.bagBallR*DPR,w/(cols*2.7));
    const innerW = w*.57;
    const gapX = cols === 1 ? 0 : innerW/(cols-1);
    const gapY = r*1.95;
    const shownMax = cols*4;
    const energy = Math.sin(Math.PI*Math.min(1,mix));

    for (let i=0;i<Math.min(colors.length, shownMax);i++){
      const col = i%cols;
      const row = Math.floor(i/cols);
      const x0 = -innerW*.5 + gapX*col + (row%2 ? r*.35 : 0);
      const y0 = h*.28 - row*gapY;
      const jitterX = Math.sin(mix*Math.PI*11+i*2.17)*energy*5*DPR;
      const jitterY = Math.cos(mix*Math.PI*9+i*1.61)*energy*4*DPR;
      drawBall(x0+jitterX,y0+jitterY,r,colors[i],null,CFG.labelScaleInBag,{shadow:false});
    }

    const remain = colors.length - shownMax;
    if (remain > 0){
      ctx.save();
      ctx.font = `800 ${11*DPR}px ui-sans-serif, system-ui`;
      ctx.fillStyle = "rgba(15,23,42,.78)";
      ctx.textAlign = "right";
      ctx.fillText(`+${remain}`, w*.33, h*.35);
      ctx.restore();
    }
  }

  // 开口帆布袋：后层、内腔、球、半透明前层、布纹与袋口依次叠放
  function drawBag(bag, mix=0){
    const {cx, cy, w, h} = bag;
    const energy = Math.sin(Math.PI*Math.min(1,mix));
    const wave = Math.sin(mix*Math.PI*10 + bag._i*.72)*energy;
    const dx = wave*7*DPR;
    const dy = Math.cos(mix*Math.PI*8 + bag._i*.45)*energy*2.2*DPR;
    const rot = wave*.045;
    const dark = document.body.getAttribute("data-theme") === "dark";

    ctx.save();
    ctx.translate(cx + dx, cy + dy);
    ctx.rotate(rot);

    const mouthW = w*.69;
    const topY = -h*.37;
    const botY = h*.40;

    ctx.beginPath();
    ctx.ellipse(5*DPR,botY+14*DPR,w*.45,h*.075,0,0,Math.PI*2);
    ctx.fillStyle = dark ? "rgba(0,0,0,.36)" : "rgba(15,23,42,.17)";
    ctx.fill();

    const g = ctx.createLinearGradient(-w*.5,topY,w*.48,botY);
    g.addColorStop(0,dark ? "#25677d" : "#7dd7df");
    g.addColorStop(.42,dark ? "#3189a0" : "#66c7d4");
    g.addColorStop(1,dark ? "#17485d" : "#258da6");
    traceBagBody(w,h);
    ctx.fillStyle = g;
    ctx.shadowColor = "rgba(15,23,42,.22)";
    ctx.shadowBlur = 10*DPR;
    ctx.shadowOffsetY = 6*DPR;
    ctx.fill();
    ctx.shadowColor = "transparent";

    // 袋口内腔
    const cavity = ctx.createRadialGradient(-mouthW*.14,topY-3*DPR,1*DPR,0,topY,mouthW*.58);
    cavity.addColorStop(0,dark ? "#183647" : "#245f70");
    cavity.addColorStop(1,dark ? "#07121d" : "#102d39");
    ctx.beginPath();
    ctx.ellipse(0,topY,mouthW*.52,12*DPR,0,0,Math.PI*2);
    ctx.fillStyle = cavity;
    ctx.fill();

    // 球只显示在袋体范围内
    ctx.save();
    traceBagBody(w,h);
    ctx.clip();
    const inside = (state.mode === "without") ? (state.bagContents[bag._i] || []) : (state.bagTemplate || []);
    drawMiniBallsInBag(bag,inside,mix);

    // 半透明前片让袋内情况可观察，同时保留布料质感
    const veil = ctx.createLinearGradient(0,topY,0,botY);
    veil.addColorStop(0,dark ? "rgba(37,113,133,.30)" : "rgba(129,224,231,.30)");
    veil.addColorStop(.55,dark ? "rgba(24,91,112,.48)" : "rgba(52,166,184,.43)");
    veil.addColorStop(1,dark ? "rgba(10,49,67,.72)" : "rgba(24,112,137,.68)");
    traceBagBody(w,h);
    ctx.fillStyle = veil;
    ctx.fill();

    // 细密斜纹
    ctx.strokeStyle = dark ? "rgba(218,244,250,.055)" : "rgba(255,255,255,.12)";
    ctx.lineWidth = .75*DPR;
    for (let x=-w; x<w; x+=9*DPR){
      ctx.beginPath();
      ctx.moveTo(x,botY+8*DPR);
      ctx.lineTo(x+w*.72,topY-6*DPR);
      ctx.stroke();
    }
    ctx.restore();

    // 外轮廓与侧缝
    traceBagBody(w,h);
    ctx.strokeStyle = dark ? "rgba(153,225,236,.42)" : "rgba(20,91,108,.54)";
    ctx.lineWidth = 2*DPR;
    ctx.stroke();

    ctx.save();
    ctx.setLineDash([4*DPR,4*DPR]);
    ctx.strokeStyle = dark ? "rgba(203,243,248,.22)" : "rgba(11,92,109,.34)";
    ctx.lineWidth = 1*DPR;
    ctx.beginPath();
    ctx.moveTo(-w*.36,topY+17*DPR);
    ctx.bezierCurveTo(-w*.42,-h*.05,-w*.44,h*.22,-w*.32,botY-3*DPR);
    ctx.moveTo(w*.36,topY+17*DPR);
    ctx.bezierCurveTo(w*.42,-h*.05,w*.44,h*.22,w*.32,botY-3*DPR);
    ctx.stroke();
    ctx.restore();

    // 自然褶皱与高光
    const foldColor = dark ? "rgba(220,248,252,.15)" : "rgba(255,255,255,.30)";
    [-.23,-.07,.11,.27].forEach((f,i) => {
      ctx.beginPath();
      ctx.moveTo(mouthW*f,topY+8*DPR);
      ctx.bezierCurveTo(w*(f*.72),-h*.02,w*(f*.9),h*.20,w*(f*.74),botY-8*DPR);
      ctx.strokeStyle = i%2 ? (dark ? "rgba(3,20,30,.13)" : "rgba(12,89,107,.15)") : foldColor;
      ctx.lineWidth = (i%2 ? 2.2 : 3)*DPR;
      ctx.stroke();
    });

    // 加厚袋口：完整椭圆 + 前沿高光，产生遮挡关系
    ctx.beginPath();
    ctx.ellipse(0,topY,mouthW*.52,12*DPR,0,0,Math.PI*2);
    ctx.strokeStyle = dark ? "#5aa9b8" : "#267f91";
    ctx.lineWidth = 7*DPR;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(0,topY+1*DPR,mouthW*.52,12*DPR,0,0,Math.PI);
    ctx.strokeStyle = dark ? "rgba(190,238,245,.52)" : "rgba(213,249,251,.82)";
    ctx.lineWidth = 2*DPR;
    ctx.stroke();

    // 布质标签，强化袋子编号
    const tagY = botY+24*DPR;
    ctx.font = `800 ${Math.max(9,Math.min(12,w/DPR*.078))*DPR}px ui-sans-serif,system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = dark ? "rgba(226,232,240,.76)" : "rgba(51,65,85,.70)";
    ctx.fillText(`${bag._i+1} 号袋`,0,tagY);

    // remain text (without replacement)
    if (state.mode === "without"){
      const remain = state.bagContents?.[bag._i]?.length ?? state.ballsPerBag;
      ctx.font = `750 ${10*DPR}px ui-sans-serif,system-ui`;
      ctx.fillStyle = dark ? "rgba(191,219,254,.70)" : "rgba(37,99,235,.72)";
      ctx.fillText(`剩余 ${remain} 个`,0,tagY+14*DPR);
    }

    ctx.restore();
  }

  // Build template colors (per-bag)
  function buildTemplateColors(userColors, M){
    const uniq = uniqPreserve(userColors);
    if (uniq.length < M){
      const need = M - uniq.length;
      const extra = genDistinctColorsAvoid(uniq, need);
      return { template: uniq.concat(extra), autoAdded: need };
    }
    return { template: uniq.slice(0, M), autoAdded: 0 };
  }

  // Lex expansion: treat index as base-M number -> N digits (bag1..bagN)
  function enumTupleFromIndex(index){
    const M = state.bagTemplate.length;
    const N = state.numBags;
    const idxs = new Array(N).fill(0);
    let x = index;
    for (let pos = N - 1; pos >= 0; pos--){
      idxs[pos] = x % M;
      x = Math.floor(x / M);
    }
    return idxs;
  }

  // Enumeration plan (lex OR comp OR random)
  function prepareEnumPlan(){
    const v = elEnumOrder.value;
    state.enumOrder = (v === "random") ? "random" : (v === "comp" ? "comp" : "lex");
    state.enumIndex = 0;
    state.randomEnumOrder = null;
    state.compEnumOrder = null;
    state.groupCounts = null;
    state.lastGroupKey = null;

    if (!(state.mode === "with" && state.noRepeatWithReplacement)){
      state.enumTotal = 0;
      return;
    }

    const M = state.bagTemplate.length;
    const N = state.numBags;
    const total = Math.pow(M, N);
    state.enumTotal = total;

    if (total > CFG.enumLimit){
      setMsg(`组合总数 ${total} 过大（>${CFG.enumLimit}），为避免卡顿请减少袋子/球数。`, true);
      return;
    }

    // 1) Random order
    if (state.enumOrder === "random"){
      state.randomEnumOrder = Array.from({length: total}, (_, i) => i);
      for (let i = total - 1; i > 0; i--){
        const j = Math.floor(state.rng() * (i + 1));
        [state.randomEnumOrder[i], state.randomEnumOrder[j]] =
        [state.randomEnumOrder[j], state.randomEnumOrder[i]];
      }
      return;
    }

    // 2) Composition grouped order
    if (state.enumOrder === "comp"){
      const groups = new Map(); // countsKey -> indices[]
      for (let idx = 0; idx < total; idx++){
        const digits = enumTupleFromIndex(idx);
        const counts = new Array(M).fill(0);
        for (const d of digits) counts[d]++;

        const key = counts.join(",");
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(idx);
      }

      // ✅ 记录每个成分组的大小（用于右侧标题显示）
      state.groupCounts = new Map();
      for (const [k, arr] of groups.entries()){
        state.groupCounts.set(k, arr.length);
      }

      // within group: lex (by index)
      for (const arr of groups.values()){
        arr.sort((a,b) => a-b);
      }

      // between groups: prefer more of first color, then second...
      const keys = Array.from(groups.keys());
      keys.sort((ka, kb) => {
        const A = ka.split(",").map(Number);
        const B = kb.split(",").map(Number);
        for (let i=0;i<Math.min(A.length, B.length);i++){
          if (A[i] !== B[i]) return B[i] - A[i]; // desc
        }
        return 0;
      });

      const order = [];
      for (const k of keys) order.push(...groups.get(k));
      state.compEnumOrder = order;
      return;
    }

    // 3) Lex: no table needed
  }

  function nextEnumColors(){
    if (!(state.mode === "with" && state.noRepeatWithReplacement)) return null;
    if (state.enumIndex >= state.enumTotal) return null;

    let index;
    if (state.enumOrder === "random"){
      index = state.randomEnumOrder[state.enumIndex];
    } else if (state.enumOrder === "comp"){
      index = state.compEnumOrder[state.enumIndex];
    } else {
      index = state.enumIndex; // lex
    }

    state.enumIndex += 1;
    const idxs = enumTupleFromIndex(index);
    return idxs.map(i => state.bagTemplate[i]);
  }

  // Reset bags
  function resetBags(){
    stopAutoEnum(true);

    const n = state.numBags;
    const M = state.ballsPerBag;
    const { template, autoAdded } = buildTemplateColors(state.colors, M);
    state.bagTemplate = template;

    // build label map
    state.colorLabelMap = buildColorToLabelMap(state.bagTemplate);

    state.bagContents = Array.from({length:n}, () => template.slice());
    state.lastResult = null;
    state.anim = null;

    prepareEnumPlan();
    updateAutoEnumAvailability();

    if (autoAdded > 0){
      setMsg(`颜色不足：已自动补足 ${autoAdded} 种颜色（保证每袋 ${M} 个颜色尽量不同）。`);
    } else {
      const extra = (state.mode === "with" && state.noRepeatWithReplacement && state.enumTotal > 0)
        ? `（组合总数=${state.enumTotal}，${state.enumOrder==="lex"?"字典序":(state.enumOrder==="comp"?"按成分":"随机")}枚举）` : "";
      setMsg(`已重置。${extra}`);
    }

    drawStatic();
  }

  // Sampling
  function pickOneFromBag(bagIdx){
    const rng = state.rng;
    if (state.mode === "with"){
      const template = state.bagTemplate || [];
      if (!template.length) return null;
      return { color: template[Math.floor(rng() * template.length)] };
    } else {
      const arr = state.bagContents[bagIdx];
      if (!arr || arr.length === 0) return null;
      const j = Math.floor(rng() * arr.length);
      const color = arr[j];
      arr.splice(j, 1);
      return { color };
    }
  }

  // Static draw
  function drawStatic(){
    const {bags, slots, ballR} = layout();
    ctx.clearRect(0,0,W,H);
    drawBg();
    drawSlots(slots);
    bags.forEach(b => drawBag(b, 0));

    if (state.lastResult){
      state.lastResult.forEach((res, i) =>
        drawBall(slots[i].x, slots[i].y, ballR, res.color, null, CFG.labelScaleDrawn)
      );
    }
  }

  // Animation utils
  function interp(a,b,t){ return { x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t }; }
  function cubicPoint(a,b,c,d,t){
    const mt = 1-t;
    return {
      x: mt*mt*mt*a.x + 3*mt*mt*t*b.x + 3*mt*t*t*c.x + t*t*t*d.x,
      y: mt*mt*mt*a.y + 3*mt*mt*t*b.y + 3*mt*t*t*c.y + t*t*t*d.y,
    };
  }

  function getBallVisual(item, elapsed){
    const local = elapsed - item.delay;
    if (local < CFG.mixTime) return {hidden:true};

    const afterMix = local-CFG.mixTime;
    if (afterMix <= CFG.revealTime){
      const u = Math.max(0,afterMix/CFG.revealTime);
      const k = Math.min(1,easeOutBack(u,1.28));
      const p = interp(item.start,item.pop,k);
      p.x += Math.sin(u*Math.PI*2+item.phase)*5*DPR*(1-u);
      return {
        hidden:false,p,
        scaleX:.82+.18*u,
        scaleY:1.16-.16*u,
        rotation:(1-u)*item.spin*.34,
        shadow:false,
        lift:Math.max(0,item.end.y-p.y),
      };
    }

    const afterReveal = afterMix-CFG.revealTime;
    if (afterReveal <= CFG.flightTime){
      const u = Math.max(0,afterReveal/CFG.flightTime);
      const k = easeInOutCubic(u);
      const p = cubicPoint(item.pop,item.control1,item.control2,item.end,k);
      return {
        hidden:false,p,
        scaleX:1,
        scaleY:1,
        rotation:item.spin*(.34+u*1.25),
        shadow:true,
        lift:Math.max(0,item.end.y-p.y),
      };
    }

    const u = Math.min(1,Math.max(0,(afterReveal-CFG.flightTime)/CFG.bounceTime));
    const decay = 1-u;
    const bounce = Math.abs(Math.sin(u*Math.PI*2.35))*decay*21*DPR;
    const impact = Math.exp(-u*18);
    return {
      hidden:false,
      p:{x:item.end.x,y:item.end.y-bounce},
      scaleX:1+impact*.22,
      scaleY:1-impact*.18,
      rotation:item.spin*1.59,
      shadow:true,
      lift:bounce,
      landing:u,
    };
  }

  function drawLandingRipple(item,u){
    if (u == null || u > .72) return;
    const k = easeOutQuad(u/.72);
    ctx.save();
    ctx.globalAlpha = (1-k)*.34;
    ctx.strokeStyle = document.body.getAttribute("data-theme") === "dark" ? "#a5dff1" : "#52798a";
    ctx.lineWidth = 1.5*DPR;
    ctx.beginPath();
    ctx.ellipse(item.end.x,item.end.y+11*DPR,item.r*(.55+k*1.15),item.r*(.13+k*.22),0,0,Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }

  // Auto enum availability
  function canAutoEnum(){
    if (!(state.mode === "with" && state.noRepeatWithReplacement)) return false;
    if (!Number.isFinite(state.enumTotal) || state.enumTotal <= 0) return false;
    if (state.enumTotal > CFG.enumLimit) return false;
    return true;
  }

  function updateAutoEnumAvailability(){
    const ok = canAutoEnum();
    btnAutoEnum.disabled = !ok;
    btnAutoEnum.classList.toggle("enum", !state.autoEnumRunning);
    btnAutoEnum.classList.toggle("enumStop", state.autoEnumRunning);
    btnAutoEnum.textContent = state.autoEnumRunning ? "停止自动枚举" : "自动枚举";
  }

  function scheduleNextAutoEnum(){
    if (!state.autoEnumRunning) return;

    if (!canAutoEnum()){
      stopAutoEnum(true);
      setMsg("无法继续自动枚举：请确认“放回抽样 + 放回不重复”且组合数量不过大。", true);
      return;
    }

    if (state.enumIndex >= state.enumTotal){
      stopAutoEnum(true);
      setMsg(`自动枚举完成：共 ${state.enumTotal} 种组合已全部枚举。`);
      return;
    }

    const delay = getEnumDelayMs();
    state.enumTimer = setTimeout(() => {
      if (!state.autoEnumRunning) return;
      startDraw(true);
    }, delay);
  }

  // Start draw (normal or enum)
  function startDraw(fromEnum=false){
    if (state.anim) return;

    if (state.mode === "without"){
      for (let i=0;i<state.numBags;i++){
        if (!state.bagContents[i] || state.bagContents[i].length === 0){
          setMsg(`第 ${i+1} 个袋子已抽空：请重置或改为放回抽样。`, true);
          stopAutoEnum(true);
          return;
        }
      }
    }

    btnDraw.disabled = true;
    btnApply.disabled = true;
    if (!fromEnum) setMsg("正在抽取…");

    const {bags, slots, ballR} = layout();

    let pickedColors = null;

    if (state.mode === "with" && state.noRepeatWithReplacement){
      pickedColors = nextEnumColors();
      if (!pickedColors){
        btnDraw.disabled = false;
        btnApply.disabled = false;
        if (fromEnum){
          stopAutoEnum(true);
          setMsg(`自动枚举完成：共 ${state.enumTotal} 种组合。`);
        } else {
          setMsg("放回不重复：所有组合已枚举完。请重置或关闭不重复。", true);
        }
        return;
      }
    } else {
      pickedColors = [];
      for (let i=0;i<state.numBags;i++){
        const picked = pickOneFromBag(i);
        if (!picked){
          setMsg(`第 ${i+1} 个袋子没有可抽取的小球。`, true);
          btnDraw.disabled = false;
          btnApply.disabled = false;
          stopAutoEnum(true);
          return;
        }
        pickedColors.push(picked.color);
      }
    }

    const results = pickedColors.map(c => ({color:c}));
    const items = bags.map((bag, i) => {
      const mouthY = bag.cy - bag.h*.37;
      const start = { x: bag.cx, y: mouthY + 2*DPR };
      const pop   = { x: bag.cx, y: Math.max(ballR+5*DPR,mouthY - 38*DPR) };
      const end   = { x: slots[i].x, y: slots[i].y };
      const arcDir = (i%2===0) ? -1 : 1;
      const control1 = {x:pop.x+arcDir*(30+(i%3)*7)*DPR,y:pop.y-14*DPR};
      const control2 = {x:end.x+arcDir*20*DPR,y:end.y-118*DPR};
      return {
        color:results[i].color,
        r:ballR,
        start,pop,end,control1,control2,
        delay:i*CFG.staggerTime,
        phase:i*.83,
        spin:arcDir*(.46+i*.07),
      };
    });

    state.lastResult = results;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    let timeScale = reducedMotion ? .18 : 1;
    if (fromEnum && !reducedMotion){
      timeScale = elEnumSpeed.value === "fast" ? .28 : (elEnumSpeed.value === "slow" ? .65 : .45);
    }
    state.anim = { startTs: performance.now(), items, fromEnum, timeScale };
    requestAnimationFrame(tick);
  }

  function tick(ts){
    const {bags, slots} = layout();
    ctx.clearRect(0,0,W,H);
    drawBg();
    drawSlots(slots);

    const elapsed = (ts-state.anim.startTs)/1000/state.anim.timeScale;
    const maxDelay = state.anim.items.length ? state.anim.items[state.anim.items.length-1].delay : 0;
    const total = CFG.mixTime+CFG.revealTime+CFG.flightTime+CFG.bounceTime+maxDelay;
    const mix = elapsed < CFG.mixTime ? Math.max(0,elapsed/CFG.mixTime) : 0;
    const visuals = state.anim.items.map(item => getBallVisual(item,elapsed));

    state.anim.items.forEach((item,i) => drawLandingRipple(item,visuals[i].landing));
    bags.forEach(b => drawBag(b,mix));
    state.anim.items.forEach((item,i) => {
      const s = visuals[i];
      if (!s.hidden){
        drawBall(s.p.x,s.p.y,item.r,item.color,null,CFG.labelScaleDrawn,{
          scaleX:s.scaleX,
          scaleY:s.scaleY,
          rotation:s.rotation,
          shadow:s.shadow,
          lift:s.lift,
          shadowY:item.end.y+14*DPR,
        });
      }
    });

    if (elapsed >= total){
      addRecordRow(state.lastResult.map(x => x.color));
      const fromEnum = state.anim.fromEnum;

      state.anim = null;
      btnDraw.disabled = false;
      btnApply.disabled = false;

      if (state.mode === "with" && state.noRepeatWithReplacement){
        const left = Math.max(0, state.enumTotal - state.enumIndex);
        if (!fromEnum){
          setMsg(`抽取完成（放回不重复）。剩余组合：${left}。`);
        } else {
          setMsg(`自动枚举中… 已完成 ${state.enumIndex}/${state.enumTotal}（剩余 ${left}）`);
        }
      } else {
        if (!fromEnum) setMsg("抽取完成。");
      }

      drawStatic();

      if (fromEnum) scheduleNextAutoEnum();
      return;
    }
    requestAnimationFrame(tick);
  }

  // Apply params
  function applyParams(){
    const n = clampInt(elNumBags.value, 1, 10, 3);
    const m = clampInt(elBallsPerBag.value, 1, 12, 2);

    let colors = uniqPreserve(elColors.value.split(",").map(x => x.trim()).filter(Boolean));
    if (colors.length === 0){
      setMsg("颜色列表为空：请至少输入一个颜色。", true);
      return;
    }

    state.numBags = n;
    state.ballsPerBag = m;
    state.colors = colors;
    state.mode = elMode.value === "without" ? "without" : "with";

    const seedStr = String(elSeed.value).trim();
    if (seedStr !== ""){
      const seed = Number(seedStr);
      if (!Number.isFinite(seed)){
        setMsg("随机种子必须是数字或留空。", true);
        return;
      }
      state.rng = mulberry32(Math.floor(seed));
    } else {
      state.rng = Math.random;
    }

    updateNoRepeatBtnAvailability();
    resetBags();
  }

  // Auto enum button
  const btnAutoEnumEl = document.getElementById("autoEnum");
  btnAutoEnumEl.addEventListener("click", () => {
    if (state.autoEnumRunning){
      stopAutoEnum(false);
      return;
    }
    if (!canAutoEnum()){
      setMsg("自动枚举不可用：请切换为“放回抽样”并开启“放回不重复”，且组合数量不要太大。", true);
      updateAutoEnumAvailability();
      return;
    }

    // Rebuild plan (especially for random / comp order)
    prepareEnumPlan();
    state.enumIndex = 0;

    clearRecords();
    state.autoEnumRunning = true;
    updateAutoEnumAvailability();

    const modeName = (state.enumOrder === "random") ? "随机顺序" : (state.enumOrder==="comp" ? "按成分分组" : "字典序");
    setMsg(`开始自动枚举（${modeName}）：共 ${state.enumTotal} 种组合。`);
    scheduleNextAutoEnum();
  });

  // Bind
  btnApply.addEventListener("click", applyParams);
  btnDraw.addEventListener("click", () => startDraw(false));
  elMode.addEventListener("change", () => applyParams());
  elEnumOrder.addEventListener("change", () => {
    stopAutoEnum(true);
    prepareEnumPlan();
    updateAutoEnumAvailability();

    const name = (elEnumOrder.value === "random") ? "随机顺序" : (elEnumOrder.value==="comp" ? "按成分分组" : "字典序");
    if (state.mode === "with" && state.noRepeatWithReplacement){
      setMsg(`已切换枚举顺序：${name}。点击“自动枚举”从头开始。`);
    } else {
      setMsg(`枚举顺序已设为：${name}（需放回+放回不重复才生效）。`);
    }
  });

  // Clear records
  btnClearRecords.addEventListener("click", () => {
    clearRecords();
    setMsg("记录已清空。");
  });

  // Auto enum availability / noRepeat toggle availability
  function canAutoEnum(){
    if (!(state.mode === "with" && state.noRepeatWithReplacement)) return false;
    if (!Number.isFinite(state.enumTotal) || state.enumTotal <= 0) return false;
    if (state.enumTotal > CFG.enumLimit) return false;
    return true;
  }

  function updateAutoEnumAvailability(){
    const ok = canAutoEnum();
    btnAutoEnum.disabled = !ok;
    btnAutoEnum.classList.toggle("enum", !state.autoEnumRunning);
    btnAutoEnum.classList.toggle("enumStop", state.autoEnumRunning);
    btnAutoEnum.textContent = state.autoEnumRunning ? "停止自动枚举" : "自动枚举";
  }

  // Init
  function init(){
    initTheme();
    resize();
    updateToggleBtn();

    // Default: noRepeat off
    setNoRepeatEnabled(false);

    // Default parameters
    applyParams();
    updateAutoEnumAvailability();
  }

  function initTheme(){
    const KEY = "edu-theme";
    const saved = window.MathRender.storage.getItem(KEY);
    const initial = saved === "dark" || saved === "light" ? saved : "light";
    function applyTheme(mode){
      document.body.setAttribute("data-theme", mode);
      window.MathRender.storage.setItem(KEY, mode);
      themeToggle.textContent = mode === "dark" ? "切换浅色" : "切换深色";
    }
    applyTheme(initial);
    themeToggle.addEventListener("click", () => {
      const cur = document.body.getAttribute("data-theme") || "light";
      applyTheme(cur === "dark" ? "light" : "dark");
    });
  }

  init();
})();
