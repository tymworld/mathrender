(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const dialog = $('history-dialog');
  const photoDialog = $('history-photo-dialog');
  const dimensions = ['scientific', 'rigor', 'creativity'];
  const labels = ['科学性', '严谨性', '创新性'];
  let database;
  let entries = [];
  let selectCard;
  let pendingDelete = null;
  let previewURL = null;
  let revision = 0;
  let visibleCount = 20;

  const storageError = () => new Error('当前浏览器无法保存历史记录，请检查是否禁用了网站存储，或存储空间已满。');
  function openDatabase() {
    if (database) return database;
    database = new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(storageError()); return; }
      const request = window.indexedDB.open('mathrender-inequality-history', 1);
      let settled = false;
      const timeout = setTimeout(() => { settled = true; reject(storageError()); }, 5000);
      const fail = () => { clearTimeout(timeout); settled = true; reject(storageError()); };
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('cards', {keyPath: 'id'});
        db.createObjectStore('photos', {keyPath: 'id'});
      };
      request.onsuccess = () => {
        clearTimeout(timeout);
        if (settled) { request.result.close(); return; }
        const db = request.result;
        db.onversionchange = () => { db.close(); database = null; };
        resolve(db);
      };
      request.onerror = fail;
      request.onblocked = fail;
    }).catch(error => { database = null; throw error; });
    return database;
  }
  async function transaction(stores, mode, run) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      let value;
      tx.oncomplete = () => resolve(value);
      tx.onabort = tx.onerror = () => reject(storageError());
      try { run(tx, result => { value = result; }); }
      catch (error) { tx.abort(); reject(error); }
    });
  }
  function text(value, max, allowEmpty = false) {
    if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim())) throw new Error('这条历史记录不完整，无法打开。');
    return value;
  }
  function copyResult(value) {
    if (!value || !['valid', 'needs_revision', 'counterexample', 'insufficient_information', 'undetermined'].includes(value.status)) throw new Error('这条历史记录不完整，无法打开。');
    const result = {status:value.status, formula:text(value.formula, 1200, true), verdict:text(value.verdict, 200)};
    for (const dimension of dimensions) {
      const item = value[dimension];
      if (!item || !['A','B','C','D',null].includes(item.grade)) throw new Error('这条历史记录的等级无效。');
      result[dimension] = {grade:item.grade, comment:text(item.comment, 300)};
    }
    result.highlight = text(value.highlight, 300);
    result.suggestion = text(value.suggestion, 800);
    return result;
  }
  function copyEntry(entry) {
    const id = text(entry?.id, 100);
    if (!/^[a-zA-Z0-9-]+$/.test(id) || !Number.isFinite(Date.parse(entry.createdAt))) throw new Error('历史记录格式无效。');
    return {id, createdAt:entry.createdAt, result:copyResult(entry.result), model:text(entry.model,100,true),
      promptVersion:text(entry.promptVersion,100,true), promptTitle:text(entry.promptTitle,200,true)};
  }
  async function save(result, {photo, model = '', promptVersion = '', promptTitle = ''} = {}) {
    const entry = copyEntry({id:'card-' + crypto.randomUUID(), createdAt:new Date().toISOString(), result, model, promptVersion, promptTitle});
    if (!(photo instanceof Blob) || !['image/jpeg','image/png','image/webp'].includes(photo.type) || photo.size > 10 * 1024 * 1024) throw new Error('原图无法保存，评价卡仍可查看。');
    // Both stores commit together. Only whitelisted evaluation fields and the image are retained.
    await transaction(['cards','photos'], 'readwrite', tx => {
      tx.objectStore('cards').add(entry);
      tx.objectStore('photos').add({id:entry.id, blob:photo});
    });
    return entry;
  }
  const dateLabel = value => new Date(value).toLocaleString('zh-CN', {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  function notice(value, error = false) {
    $('history-message').textContent = value;
    $('history-message').dataset.error = String(error);
    $('history-message').hidden = !value;
  }
  function make(tag, className, content) {
    const node = document.createElement(tag);
    node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }
  function cancelDelete() {
    pendingDelete = null;
    $('history-confirm').hidden = true;
  }
  function askDelete(entry) {
    pendingDelete = entry ? [entry.id] : entries.map(item => item.id);
    $('history-confirm-text').textContent = entry ? '删除这条评价及其原图？' : `清空这 ${pendingDelete.length} 条评价及其原图？`;
    $('confirm-history-delete').textContent = entry ? '确认删除' : '确认清空';
    $('history-confirm').hidden = false;
    $('cancel-history-delete').focus();
  }
  async function getPhoto(id) {
    return transaction(['photos'], 'readonly', (tx, done) => {
      const request = tx.objectStore('photos').get(id);
      request.onsuccess = () => done(request.result?.blob || null);
    });
  }
  async function showEntry(entry) {
    const current = ++revision;
    try {
      const photo = await getPhoto(entry.id);
      if (current !== revision || !dialog.open) return;
      dialog.close();
      selectCard?.(entry, photo);
    } catch (error) { if (current === revision) notice(error.message, true); }
  }
  async function showPhoto(entry) {
    const current = ++revision;
    try {
      const photo = await getPhoto(entry.id);
      if (current !== revision || !dialog.open) return;
      if (!(photo instanceof Blob)) throw new Error('这条记录的原图不可用，仍可查看评价卡。');
      if (previewURL) URL.revokeObjectURL(previewURL);
      previewURL = URL.createObjectURL(photo);
      $('history-photo').src = previewURL;
      $('history-photo-date').textContent = dateLabel(entry.createdAt);
      photoDialog.showModal();
    } catch (error) { if (current === revision) notice(error.message, true); }
  }
  function renderList() {
    const list = $('history-list');
    list.replaceChildren();
    $('history-count').textContent = entries.length ? `${entries.length} 条评价` : '暂无记录';
    $('history-empty').hidden = entries.length > 0;
    $('clear-history').disabled = entries.length === 0;
    $('history-more').hidden = entries.length <= visibleCount;
    for (const entry of entries.slice(0, visibleCount)) {
      const row = make('article', 'history-entry');
      const content = make('div', 'history-entry-content');
      content.append(make('p', 'history-entry-meta', `${dateLabel(entry.createdAt)} · ${entry.model || 'AI 评价'}`));
      const open = make('button', 'history-formula', entry.result.formula || '待补充的作品');
      open.type = 'button'; open.addEventListener('click', () => showEntry(entry));
      content.append(open);
      const grades = make('div', 'history-grades');
      dimensions.forEach((key, i) => grades.append(make('span', `history-grade ${key}`, `${labels[i]} ${entry.result[key].grade || '待完善'}`)));
      content.append(grades);
      content.append(make('p', 'history-prompt', entry.promptTitle || entry.promptVersion || '默认评价规则'));
      const actions = make('div', 'history-entry-actions');
      for (const [label, action] of [['查看评价',() => showEntry(entry)], ['查看原图',() => showPhoto(entry)], ['删除',() => askDelete(entry)]]) {
        const button = make('button', label === '删除' ? 'history-delete' : '', label);
        button.type = 'button'; button.addEventListener('click', action); actions.append(button);
      }
      row.append(content, actions); list.append(row);
    }
  }
  async function refresh() {
    const current = ++revision;
    notice('正在读取历史记录…');
    try {
      const saved = await transaction(['cards'], 'readonly', (tx, done) => {
        const request = tx.objectStore('cards').getAll(); request.onsuccess = () => done(request.result);
      });
      if (current !== revision || !dialog.open) return;
      let invalid = 0;
      entries = saved.flatMap(value => { try { return [copyEntry(value)]; } catch { invalid++; return []; } });
      entries.sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id));
      renderList();
      notice(invalid ? `${invalid} 条记录格式异常，已暂时隐藏；其余记录可正常查看。` : '', invalid > 0);
    } catch (error) {
      if (current !== revision || !dialog.open) return;
      entries = []; renderList(); $('history-empty').hidden = true; notice(error.message, true);
    }
  }
  async function open(onSelect) {
    selectCard = onSelect;
    visibleCount = 20;
    cancelDelete();
    if (!dialog.open) dialog.showModal();
    await refresh();
  }
  $('close-history').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { revision++; cancelDelete(); });
  $('history-more').addEventListener('click', () => { visibleCount += 20; renderList(); });
  $('clear-history').addEventListener('click', () => { if (entries.length) askDelete(); });
  $('cancel-history-delete').addEventListener('click', cancelDelete);
  $('confirm-history-delete').addEventListener('click', async () => {
    if (!pendingDelete || $('confirm-history-delete').disabled) return;
    const ids = [...pendingDelete];
    $('confirm-history-delete').disabled = true;
    try {
      await transaction(['cards','photos'], 'readwrite', tx => {
        for (const id of ids) { tx.objectStore('cards').delete(id); tx.objectStore('photos').delete(id); }
      });
      cancelDelete();
      await refresh();
    } catch (error) { notice(error.message, true); }
    finally { $('confirm-history-delete').disabled = false; }
  });
  $('close-history-photo').addEventListener('click', () => photoDialog.close());
  photoDialog.addEventListener('close', () => {
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = null; $('history-photo').removeAttribute('src');
  });
  window.inequalityReviewHistory = Object.freeze({save, open});
})();
