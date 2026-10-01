(() => {
  "use strict";

  const fileName = decodeURIComponent(location.pathname.split("/").pop() || "");
  const pageKey = fileName.replace(/\.html$/i, "");
  const topics = {
    "ball-lab": "概率实验",
    "balllab-draw-lab": "概率实验",
    "class-score-histogram-lab": "统计实验",
    "distribution-comparison": "分布对比",
    "distribution-lab": "分布对比",
    "exam-normal-lab": "正态分布",
    "galton-board-lab": "正态分布",
    "hanoi-tower": "递归思想",
    "measurement-error-histogram-lab": "统计实验",
    "normal-distribution-lab": "正态分布",
    "normal-function-lab": "正态分布",
    "pascal-lab": "二项式定理",
    "pascal-triangle": "二项式定理",
    "pass-probability": "递推概率",
    "passing-model": "递推概率",
    "tower-of-hanoi": "递归思想"
  };

  function hideElement(element) {
    if (!element) return;
    element.classList.add("legacy-simplified-away");
    element.setAttribute("aria-hidden", "true");
    if ("tabIndex" in element) element.tabIndex = -1;
  }

  function hideById(id, parentSelector) {
    const element = document.getElementById(id);
    if (!element) return;
    hideElement(parentSelector ? element.closest(parentSelector) || element : element);
  }

  function titleText() {
    const h1 = document.querySelector("h1");
    const alternate = document.querySelector(".header .title");
    const source = h1 || alternate;
    const value = (source?.textContent || document.title.split(/[|｜]/)[0] || "数学实验")
      .replace(/（教学增强版）/g, "")
      .replace(/教学小程序/g, "实验室")
      .trim();
    return { source, value };
  }

  function buildTopbar(title) {
    let topbar = document.querySelector(".home-nav-bar, .shell > .topbar, body > .topbar");
    if (!topbar) {
      topbar = document.createElement("header");
      document.body.prepend(topbar);
    } else if (topbar.parentElement !== document.body) {
      document.body.prepend(topbar);
    }
    topbar.classList.add("unified-topbar");

    let back = topbar.querySelector('a[href="index.html"], a[href$="/index.html"]');
    if (!back) {
      back = document.createElement("a");
      back.href = "index.html";
      topbar.prepend(back);
    }
    back.classList.add("unified-back-link");
    back.textContent = "← 实验室";

    const heading = document.createElement("div");
    heading.className = "unified-page-title";
    heading.textContent = title;
    back.insertAdjacentElement("afterend", heading);

    const chip = document.createElement("span");
    chip.className = "unified-topic-chip";
    chip.textContent = topics[pageKey] || "课堂实验";
    heading.insertAdjacentElement("afterend", chip);

    const originalThemeButton = document.getElementById("themeToggle");
    if (originalThemeButton) hideElement(originalThemeButton);

    const existingAction = Array.from(topbar.children).find(element =>
      element !== back &&
      element !== heading &&
      element !== chip &&
      element !== originalThemeButton &&
      !element.classList.contains("home-nav-meta")
    );
    if (existingAction) existingAction.classList.add("unified-existing-action");

    const themeButton = document.createElement("button");
    themeButton.type = "button";
    themeButton.className = "unified-theme-toggle";
    themeButton.setAttribute("aria-label", "切换页面明暗主题");
    topbar.append(themeButton);

    const storageKey = "mathrender-unified-theme";
    let storedTheme = "";
    try {
      storedTheme = localStorage.getItem(storageKey) || "";
    } catch (_) {
      storedTheme = "";
    }
    const initialTheme = storedTheme === "dark" ? "dark" : "light";
    const lightThemeValue =
      pageKey === "pascal-lab" || pageKey === "pascal-triangle" ? "white" : "light";

    function applyTheme(theme) {
      document.body.dataset.theme = theme === "light" ? lightThemeValue : theme;
      themeButton.textContent = theme === "dark" ? "浅色" : "深色";
      themeButton.setAttribute("aria-pressed", String(theme === "dark"));
      try {
        localStorage.setItem(storageKey, theme);
      } catch (_) {
        // 本地文件环境可能禁用存储；不影响当前页面切换。
      }
      requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    }

    themeButton.addEventListener("click", () => {
      applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
    });
    applyTheme(initialTheme);
  }

  function simplifyControls() {
    [
      "toggleBagBalls",
      "scaleBtn",
      "randomBtn",
      "scale10Btn",
      "scale100Btn",
      "focusBtn",
      "captureBtn",
      "printBtn",
      "copyPolyBtn",
      "clearLogBtn",
      "rulesBtn",
      "toggleMoveStatBtn",
      "toggleExtraStatsBtn",
      "toggleBottomInfoBtn",
      "optimalExplainBtn"
    ].forEach(id => hideById(id));

    ["seed", "enumOrder", "enumSpeed"].forEach(id => hideById(id, ".field"));

    if (pageKey === "pass-probability" || pageKey === "passing-model") {
      hideById("animSpeed", "label");
    }

    if (pageKey === "hanoi-tower" || pageKey === "tower-of-hanoi") {
      hideById("animSpeed", "label");
    }

    if (pageKey === "measurement-error-histogram-lab") {
      hideById("toggleMean");
      hideById("toggleCenter");
    }

    if (pageKey === "pascal-lab" || pageKey === "pascal-triangle") {
      const hint = document.querySelector(".hint");
      if (hint) hint.innerHTML = "快捷键：<span class=\"kbd\">Enter</span> 下一行，<span class=\"kbd\">Space</span> 播放或暂停，<span class=\"kbd\">R</span> 重置。";
    }

    const applyButton = document.getElementById("apply");
    if (applyButton) applyButton.textContent = "应用并重置";
    const regenButton = document.getElementById("regenBtn");
    if (regenButton && pageKey === "class-score-histogram-lab") regenButton.textContent = "重新生成成绩";
  }

  function prepareIntro(source) {
    if (!source) return;
    const hero = source.closest(".hero");
    const sourceText = source.textContent.trim();
    if (hero) {
      const heroText = hero.textContent.trim();
      hero.classList.add("legacy-intro");
      if (heroText === sourceText) hero.classList.add("legacy-empty-intro");
    }
    source.classList.add("legacy-original-title");
  }

  function init() {
    document.body.classList.add("legacy-unified");
    document.body.dataset.labPage = pageKey;
    const title = titleText();
    buildTopbar(title.value);
    prepareIntro(title.source);
    simplifyControls();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
