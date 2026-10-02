(() => {
  'use strict';
  const { categories, labs, storage } = window.MathRender;
  const search = document.getElementById('experimentSearch');
  const clear = document.getElementById('clearSearch');
  const buttons = [...document.querySelectorAll('[data-category]')];
  const cards = [...document.querySelectorAll('[data-lab]')];
  const groups = [...document.querySelectorAll('[data-group]')];
  let selected = 'all';
  const normalize = value => value.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
  function applyFilters() {
    const query = normalize(search.value.trim());
    let count = 0;
    cards.forEach(card => {
      const lab = labs.find(item => item.id === card.dataset.lab);
      const visible = (selected === 'all' || selected === lab.category) && (!query || normalize([lab.title, lab.description, lab.type, lab.keywords, categories.find(c => c.id === lab.category).name].join(' ')).includes(query));
      card.hidden = !visible;
      if (visible) count++;
    });
    groups.forEach(group => { group.hidden = ![...group.querySelectorAll('[data-lab]')].some(card => !card.hidden); });
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === selected)));
    document.getElementById('catalogTitle').textContent = selected === 'all' ? '全部实验' : categories.find(c => c.id === selected).name;
    document.getElementById('resultCount').textContent = query ? `找到 ${count} 个实验` : `${count} 个互动实验，点击即可开始探索`;
    document.getElementById('emptyResults').hidden = count > 0;
    clear.hidden = !search.value;
  }
  function readHash() {
    const hash = location.hash.slice(1);
    selected = categories.some(c => c.id === hash) ? hash : 'all';
    applyFilters();
    if (selected !== 'all' || hash === 'experiments') document.getElementById('experiments').scrollIntoView({ behavior: 'auto' });
  }
  buttons.forEach(button => button.addEventListener('click', () => {
    selected = button.dataset.category;
    history.replaceState(null, '', selected === 'all' ? '#experiments' : `#${selected}`);
    applyFilters();
  }));
  document.querySelectorAll('.topic-card').forEach(link => link.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    history.replaceState(null, '', link.hash);
    readHash();
  }));
  search.addEventListener('input', applyFilters);
  clear.addEventListener('click', () => { search.value = ''; applyFilters(); search.focus(); });
  search.addEventListener('keydown', event => { if (event.key === 'Escape') { search.value = ''; applyFilters(); } });
  document.getElementById('resetFilters').addEventListener('click', () => {
    selected = 'all'; search.value = ''; history.replaceState(null, '', '#experiments'); applyFilters(); search.focus();
  });
  window.addEventListener('hashchange', readHash);
  readHash();

  const theme = document.getElementById('themeToggle');
  function setTheme(dark) {
    document.body.dataset.theme = dark ? 'dark' : 'light';
    theme.textContent = dark ? '浅色' : '深色';
    theme.setAttribute('aria-pressed', String(dark));
    storage.setItem('mathrender-theme', dark ? 'dark' : 'light');
  }
  setTheme(storage.getItem('mathrender-theme') === 'dark');
  theme.addEventListener('click', () => setTheme(document.body.dataset.theme !== 'dark'));
  const large = document.getElementById('largeTextButton');
  function setLarge(enabled) {
    document.body.classList.toggle('large-text', enabled);
    large.setAttribute('aria-pressed', String(enabled));
    large.textContent = enabled ? '标准字' : '大字';
    storage.setItem('mathrender-large-text', String(enabled));
  }
  setLarge(storage.getItem('mathrender-large-text') === 'true');
  large.addEventListener('click', () => setLarge(!document.body.classList.contains('large-text')));
  const fullscreen = document.getElementById('fullscreenButton');
  if (!document.documentElement.requestFullscreen) fullscreen.hidden = true;
  fullscreen.addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch (_) { fullscreen.textContent = '全屏不可用'; }
  });
  document.addEventListener('fullscreenchange', () => { fullscreen.textContent = document.fullscreenElement ? '退出全屏' : '全屏'; });
})();
