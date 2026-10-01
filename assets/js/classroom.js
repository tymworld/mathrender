/* Shared classroom navigation and presentation controls. */
(() => {
  'use strict';
  const site = window.MathRender;
  const lab = site.labs.find(item => item.id === document.body.dataset.labId);
  if (!lab) return;
  const category = site.categories.find(item => item.id === lab.category);
  const root = '../../';
  const body = document.body;
  body.classList.add('classroom');
  body.dataset.labPage = lab.legacy;
  const nativeTopbar = document.querySelector('.home-nav-bar, .shell > .topbar, body > .topbar');
  const tabs = nativeTopbar?.querySelector('.tabs');
  if (tabs) {
    tabs.classList.add('experiment-tabs');
    nativeTopbar.insertAdjacentElement('afterend', tabs);
  }
  if (nativeTopbar) nativeTopbar.classList.add('native-topbar');
  const originalTitle = document.querySelector('h1, .header .title');
  if (originalTitle) {
    originalTitle.classList.add('ui-original-title');
    const intro = originalTitle.closest('.hero');
    if (intro) {
      intro.classList.add('ui-intro');
      if (!intro.querySelector('p')) intro.classList.add('ui-empty-intro');
    }
  }
  document.querySelectorAll('#themeToggle, #themeBtn, #focusBtn, #captureBtn, #floatThemeBtn, #floatPrintBtn').forEach(el => {
    el.classList.add('ui-simplified-away');
    el.tabIndex = -1;
  });
  const nativeThemeSelect = document.getElementById('themeSelect');
  if (nativeThemeSelect) nativeThemeSelect.closest('label')?.classList.add('ui-simplified-away');

  const header = document.createElement('header');
  header.className = 'classroom-topbar';
  header.innerHTML = `
    <a class="classroom-back-link" href="${root}index.html#${category.id}"><span aria-hidden="true">←</span> 实验目录</a>
    <div class="classroom-heading"><a class="classroom-breadcrumb" href="${root}index.html#${category.id}">${category.name}</a><h1 class="classroom-page-title">${lab.title}</h1></div>
    <div class="classroom-tools">
      <button type="button" id="directoryButton" aria-haspopup="dialog">目录</button>
      <button type="button" id="largeTextButton" aria-pressed="false">大字</button>
      <button type="button" id="presentationButton" aria-pressed="false">聚焦</button>
      <button type="button" id="fullscreenButton">全屏</button>
      <button type="button" id="siteThemeButton" aria-pressed="false">深色</button>
    </div>`;
  body.prepend(header);

  const note = document.createElement('div');
  note.className = 'classroom-description';
  note.innerHTML = `<span class="classroom-topic-chip ${category.color}">${lab.type}</span><span>${lab.description}</span>`;
  nativeTopbar?.querySelectorAll('button').forEach(button => {
    if (['themeToggle','themeBtn','focusBtn','captureBtn'].includes(button.id)) return;
    note.append(button);
  });
  const main = document.querySelector('body > main, body > .app, body > .wrap, body > .shell');
  if (main) main.prepend(note);

  const dialog = document.createElement('dialog');
  dialog.className = 'directory-dialog';
  dialog.setAttribute('aria-labelledby', 'directoryTitle');
  dialog.innerHTML = `<div class="directory-heading"><div><span class="directory-eyebrow">MATHRENDER · 实验目录</span><h2 id="directoryTitle">今天，探索什么？</h2></div><button type="button" class="directory-close" aria-label="关闭实验目录">×</button></div>
    <div class="directory-groups">${site.categories.map(group => `<section><h3 class="${group.color}">${group.symbol} &nbsp;${group.name}</h3><div>${site.labs.filter(item => item.category === group.id).map(item => `<a href="${root}${item.path}" ${item.id === lab.id ? 'aria-current="page"' : ''}>${item.title}${item.id === lab.id ? '<span>当前</span>' : '<span aria-hidden="true">↗</span>'}</a>`).join('')}</div></section>`).join('')}</div>`;
  body.append(dialog);
  document.getElementById('directoryButton').addEventListener('click', () => dialog.showModal());
  dialog.querySelector('.directory-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });

  const storage = site.storage;
  const themeButton = document.getElementById('siteThemeButton');
  const lightTheme = lab.id === 'pascal-triangle' ? 'white' : 'light';
  function syncTheme() {
    const dark = body.dataset.theme === 'dark';
    themeButton.textContent = dark ? '浅色' : '深色';
    themeButton.setAttribute('aria-pressed', String(dark));
    body.style.colorScheme = dark ? 'dark' : 'light';
    storage.setItem('mathrender-theme', dark ? 'dark' : 'light');
  }
  body.dataset.theme = storage.getItem('mathrender-theme') === 'dark' ? 'dark' : lightTheme;
  syncTheme();
  themeButton.addEventListener('click', () => {
    const native = document.getElementById('themeToggle') || document.getElementById('themeBtn');
    if (native) native.click();
    else body.dataset.theme = body.dataset.theme === 'dark' ? lightTheme : 'dark';
    syncTheme();
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  });
  new MutationObserver(mutations => {
    if (mutations.some(item => item.attributeName === 'data-theme')) syncTheme();
  }).observe(body, { attributes: true, attributeFilter: ['data-theme'] });

  const largeButton = document.getElementById('largeTextButton');
  function setLarge(enabled) {
    body.classList.toggle('large-text', enabled);
    largeButton.setAttribute('aria-pressed', String(enabled));
    largeButton.textContent = enabled ? '标准字' : '大字';
    storage.setItem('mathrender-large-text', String(enabled));
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }
  setLarge(storage.getItem('mathrender-large-text') === 'true');
  largeButton.addEventListener('click', () => setLarge(!body.classList.contains('large-text')));

  const dock = document.createElement('div');
  dock.className = 'presentation-dock';
  dock.setAttribute('role', 'toolbar');
  dock.setAttribute('aria-label', '聚焦模式实验操作');
  const actions = ['playBtn','stepBtn','nextBtn','prevBtn','draw','runBtn','regenBtn','randomDemoBtn','autoBtn','sumToggleBtn','hintBtn','checkBtn','resetBtn','resetManualBtn'];
  actions.forEach(id => {
    const original = document.getElementById(id);
    if (!original) return;
    const clone = document.createElement('button');
    clone.type = 'button';
    const sync = () => { clone.textContent = original.textContent; clone.disabled = original.disabled; };
    sync();
    clone.addEventListener('click', () => { original.click(); sync(); });
    new MutationObserver(sync).observe(original, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled'] });
    dock.append(clone);
  });
  const exit = document.createElement('button');
  exit.type = 'button'; exit.className = 'dock-exit'; exit.textContent = '退出聚焦';
  dock.append(exit); body.append(dock);
  const focusButton = document.getElementById('presentationButton');
  site.togglePresentation = () => {
    const enabled = !body.classList.contains('presentation');
    body.classList.remove('focus', 'capture');
    body.classList.toggle('presentation', enabled);
    focusButton.textContent = enabled ? '退出聚焦' : '聚焦';
    focusButton.setAttribute('aria-pressed', String(enabled));
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  };
  focusButton.addEventListener('click', site.togglePresentation);
  exit.addEventListener('click', site.togglePresentation);
  const fullscreenButton = document.getElementById('fullscreenButton');
  if (!document.documentElement.requestFullscreen) fullscreenButton.hidden = true;
  fullscreenButton.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (_) {
      fullscreenButton.textContent = '全屏不可用';
    }
  });
  document.addEventListener('fullscreenchange', () => { fullscreenButton.textContent = document.fullscreenElement ? '退出全屏' : '全屏'; });
  window.addEventListener('keydown', event => {
    const interactive = event.target.closest('input, textarea, select, button, a, [contenteditable="true"]');
    if (event.key === 'Escape' && body.classList.contains('presentation')) site.togglePresentation();
    if (!event.defaultPrevented && !interactive && !dialog.open && event.key.toLowerCase() === 'f') { event.preventDefault(); site.togglePresentation(); }
  });

  // Associate existing labels and ensure canvas alternatives have a topic.
  document.querySelectorAll('label:not([for])').forEach(label => {
    const input = label.querySelector('input, select') || label.parentElement.querySelector('input, select');
    if (input?.id) label.htmlFor = input.id;
  });
  document.querySelectorAll('canvas:not([aria-label])').forEach(canvas => {
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${lab.title}：${canvas.closest('.card, .panel')?.querySelector('h2')?.textContent || '动态演示图'}。图形对应的数据与说明见本页。`);
  });
  document.querySelectorAll('.switch:not([role])').forEach(toggle => {
    toggle.setAttribute('role', 'switch');
    toggle.tabIndex = 0;
    toggle.setAttribute('aria-label', toggle.closest('.toggle')?.querySelector('span')?.textContent || '显示选项');
    const sync = () => toggle.setAttribute('aria-checked', String(toggle.classList.contains('on')));
    sync();
    new MutationObserver(sync).observe(toggle, { attributes: true, attributeFilter: ['class'] });
    toggle.addEventListener('keydown', event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); toggle.click(); } });
  });
  document.querySelectorAll('span, small, .hintline, .teacher, .prompt, .task, .status, .warn, .controls-note, .caption, .data-chip').forEach(el => {
    if (el.closest('svg, math, .classroom-topbar, .directory-dialog')) return;
    if (parseFloat(getComputedStyle(el).fontSize) < 18) el.classList.add('teaching-caption');
  });
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
})();
