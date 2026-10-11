(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const dialog = $('history-dialog');
  const photoDialog = $('history-photo-dialog');
  const dimensions = ['scientific', 'rigor', 'creativity'];
  const labels = ['正确性', '严谨性', '创新性'];
  let database;
  let entries = [];
  let selectCard;
  let pendingDelete = null;
  let previewURL = null;
  let revision = 0;
  let visibleCount = 20, source = 'cloud', nextCursor = null, total = 0, latest = null, syncing = false;
  const cloudAvailable = () => /^https?:$/.test(window.location.protocol) && !window.inequalityLocalPreview && Boolean(window.ClassroomPhotos);
  const cloudReady = () => cloudAvailable() && window.inequalityReviewAPI?.classroomConfigured;
  const localCards = () => transaction(['cards'], 'readonly', (tx,done) => {
    const request = tx.objectStore('cards').getAll(); request.onsuccess = () => done(request.result);
  });
  async function markSynced(entry) {
    await transaction(['cards'],'readwrite',tx => {
      const store=tx.objectStore('cards'), request=store.get(entry.id);
      request.onsuccess=()=>{ if(request.result) store.put({...validateHistoryEntry(entry),cloudSynced:true}); };
    });
  }
  async function dataURL(photo) {
    if (!(photo instanceof Blob)) return null;
    const bytes = new Uint8Array(await photo.arrayBuffer());
    let binary = ''; for (let i=0;i<bytes.length;i+=32768) binary += String.fromCharCode(...bytes.subarray(i,i+32768));
    return `data:${photo.type};base64,${btoa(binary)}`;
  }
  async function uploadEntry(entry,photo) {
    return window.ClassroomPhotos.request('/history',{method:'POST',body:{entry:validateHistoryEntry(entry),image:await dataURL(photo)},timeout:60000});
  }
  async function removeLocal(ids) {
    await transaction(['cards','photos'],'readwrite',tx => {
      for (const id of ids) { tx.objectStore('cards').delete(id); tx.objectStore('photos').delete(id); }
    });
  }

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
  // HISTORY_RECORD_VALIDATION
  async function save(result, {photo, model = '', promptVersion = '', promptTitle = ''} = {}) {
    const entry = validateHistoryEntry({id:'card-' + crypto.randomUUID(), createdAt:new Date().toISOString(), result, model, promptVersion, promptTitle});
    if (!(photo instanceof Blob) || !['image/jpeg','image/png','image/webp'].includes(photo.type) || photo.size > 10 * 1024 * 1024) throw new Error('原图无法保存，评价卡仍可查看。');
    let local = false, localError;
    try {
      await transaction(['cards','photos'], 'readwrite', tx => {
        tx.objectStore('cards').add(entry); tx.objectStore('photos').add({id:entry.id, blob:photo});
      });
      local = true;
    } catch (error) { localError = error; }
    if (cloudReady()) {
      try {
        await uploadEntry(entry,photo);
        if (local) await markSynced(entry).catch(() => {});
        return {...entry,saveMessage:'已保存到云端历史，可跨设备查看'};
      } catch (error) {
        if (!local) throw new Error('云端保存失败，且本机存储不可用。请保留当前页面后重试。');
        return {...entry,pendingSync:true,saveMessage:'已保存在本机，云端暂未同步。可在历史记录中重试。'};
      }
    }
    if (!local) throw localError;
    return {...entry,pendingSync:cloudAvailable(),saveMessage:cloudAvailable() ? '已保存在本机，解锁课堂后可同步到云端历史。' : '已保存到本机历史'};
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
    pendingDelete = {ids:entry ? [entry.id] : entries.map(item=>item.id),source,through:latest,all:!entry};
    const where = source === 'cloud' ? '云端' : '本机';
    const retained = source === 'cloud' ? '本机备份' : '云端历史';
    $('history-confirm-text').textContent = (entry ? `删除这条${where}评价及其原图？` : `清空这 ${source === 'cloud' ? total : entries.length} 条${where}评价及其原图？`) + `${retained}和课堂相册中的照片会保留。`;
    $('confirm-history-delete').textContent = entry ? '确认删除' : '确认清空';
    $('history-confirm').hidden = false; $('cancel-history-delete').focus();
  }
  async function readPhoto(id) {
    if (source === 'local') return getPhoto(id);
    try { return await window.ClassroomPhotos.request('/history/'+encodeURIComponent(id)+'/image',{binary:true,timeout:30000}); }
    catch (error) { if (error.status === 404) return null; throw error; }
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
      let photo = null;
      try { photo = await readPhoto(entry.id); } catch { /* A saved card remains readable without its photo. */ }
      if (current !== revision || !dialog.open) return;
      dialog.close();
      selectCard?.(entry, photo);
    } catch (error) { if (current === revision) notice(error.message, true); }
  }
  async function showPhoto(entry) {
    const current = ++revision;
    try {
      const photo = await readPhoto(entry.id);
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
    $('history-count').textContent = (source === 'cloud' ? total : entries.length) ? `${source === 'cloud' ? total : entries.length} 条评价` : '暂无记录';
    $('history-empty').hidden = entries.length > 0;
    $('clear-history').disabled = entries.length === 0 || syncing;
    $('history-more').hidden = source === 'cloud' ? !nextCursor : entries.length <= visibleCount;
    for (const entry of entries.slice(0, source === 'cloud' ? entries.length : visibleCount)) {
      const row = make('article', 'history-entry');
      const content = make('div', 'history-entry-content');
      content.append(make('p', 'history-entry-meta', `${dateLabel(entry.createdAt)} · ${entry.model || 'AI 评价'}${source === 'local' ? (entry.cloudSynced ? ' · 本机备份' : ' · 待同步') : ''}`));
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
        button.type = 'button'; button.disabled = syncing; button.addEventListener('click', action); actions.append(button);
      }
      row.append(content, actions); list.append(row);
    }
  }
  function updateSource() {
    $('history-cloud-tab').hidden = !cloudAvailable();
    $('history-cloud-tab').setAttribute('aria-selected',String(source === 'cloud'));
    $('history-local-tab').setAttribute('aria-selected',String(source === 'local'));
    $('clear-history').textContent = source === 'cloud' ? '清空云端' : '清空本机';
    $('history-sync').hidden = !cloudAvailable();
    $('history-cloud-unlock').hidden = source !== 'cloud' || Boolean(cloudReady());
    $('history-storage-note').textContent = source === 'cloud'
      ? '云端历史跨设备共享 · 原有记录请在原浏览器、原网址中同步'
      : '本机记录仅属于当前浏览器和网址 · 云端删除不会移除本机备份';
  }
  async function refresh(append = false) {
    const current = ++revision;
    updateSource(); notice('正在读取历史记录…');
    try {
      if (source === 'cloud') {
        if (!cloudReady()) { entries=[]; total=0; nextCursor=null; renderList(); $('history-empty').hidden=true; notice(''); return; }
        const data = await window.ClassroomPhotos.request('/history'+(append && nextCursor ? '?before='+encodeURIComponent(nextCursor) : ''));
        if (current !== revision || !dialog.open) return;
        const incoming = data.entries.map(validateHistoryEntry);
        entries = append ? [...entries,...incoming.filter(item=>!entries.some(old=>old.id===item.id))] : incoming;
        total=data.total; latest=data.latest; nextCursor=data.nextCursor; renderList(); notice('');
      } else {
        const saved = await localCards();
        if (current !== revision || !dialog.open) return;
        let invalid = 0;
        entries = saved.flatMap(value => { try { return [{...validateHistoryEntry(value),cloudSynced:Boolean(value.cloudSynced)}]; } catch { invalid++; return []; } });
        entries.sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id));
        renderList(); notice(invalid ? `${invalid} 条记录格式异常，已暂时隐藏；原数据仍保留。` : '', invalid > 0);
      }
    } catch (error) {
      if (current !== revision || !dialog.open) return;
      if (error.status === 401) { window.inequalityReviewAPI.lockClassroom(); entries=[]; total=0; nextCursor=null; updateSource(); }
      renderList(); $('history-empty').hidden=true; notice(error.message+(source === 'cloud' ? ' 本机记录仍可单独查看。' : ''),true);
    }
  }
  async function unlockCloud() {
    if (!cloudAvailable()) throw new Error('请在正式网站中查看云端历史。');
    const result = await window.inequalityReviewAPI.ensureClassroom();
    return Boolean(result);
  }
  async function syncLocal() {
    if (syncing) return;
    syncing=true; cancelDelete();
    for (const id of ['history-sync','history-refresh','history-cloud-tab','history-local-tab','clear-history']) $(id).disabled=true;
    let completed=0, skipped=0;
    try {
      if (!await unlockCloud()) return;
      const saved=await localCards();
      for (const raw of saved) {
        if (raw.cloudSynced) continue;
        let entry;
        try { entry=validateHistoryEntry(raw); } catch { skipped++; continue; }
        notice(`正在同步本机历史 · 已完成 ${completed} 条`);
        try { await uploadEntry(entry,await getPhoto(entry.id)); await markSynced(entry); completed++; }
        catch (error) {
          if (error.status === 410) { await markSynced(entry); skipped++; continue; }
          throw error;
        }
      }
      source='cloud'; await refresh(); notice(`已同步 ${completed} 条本机历史${skipped ? `，${skipped} 条异常或已删除记录未上传` : ''}。换设备后输入课堂密码即可查看。`);
    } catch (error) { notice(`已同步 ${completed} 条。`+error.message+' 未同步的本机记录仍保留，可稍后重试。',true); }
    finally {
      syncing=false;
      for (const id of ['history-sync','history-refresh','history-cloud-tab','history-local-tab','clear-history']) $(id).disabled=false;
      if (dialog.open) renderList();
    }
  }
  async function open(onSelect) {
    selectCard=onSelect; visibleCount=20; source=cloudAvailable() ? 'cloud' : 'local';
    entries=[]; total=0; nextCursor=null; cancelDelete();
    if (!dialog.open) dialog.showModal();
    await refresh();
  }
  $('history-cloud-tab').addEventListener('click',()=>{if(!syncing){source='cloud';entries=[];nextCursor=null;cancelDelete();refresh();}});
  $('history-local-tab').addEventListener('click',()=>{if(!syncing){source='local';entries=[];visibleCount=20;cancelDelete();refresh();}});
  $('history-refresh').addEventListener('click',()=>refresh());
  $('history-sync').addEventListener('click',syncLocal);
  $('history-unlock').addEventListener('click',async()=>{try{if(await unlockCloud()) await refresh();}catch(error){notice(error.message,true);}});
  $('close-history').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { revision++; cancelDelete(); });
  $('history-more').addEventListener('click', async () => { $('history-more').disabled=true; try { if(source==='cloud') await refresh(true); else {visibleCount+=20;renderList();} } finally {$('history-more').disabled=false;} });
  $('clear-history').addEventListener('click', () => { if (entries.length) askDelete(); });
  $('cancel-history-delete').addEventListener('click', cancelDelete);
  $('confirm-history-delete').addEventListener('click', async () => {
    if (!pendingDelete || $('confirm-history-delete').disabled || syncing) return;
    const pending=pendingDelete;
    $('confirm-history-delete').disabled=true;
    try {
      if (pending.source === 'cloud') {
        if (pending.all) await window.ClassroomPhotos.request('/history/clear',{method:'POST',body:{through:pending.through},timeout:60000});
        else await window.ClassroomPhotos.request('/history/'+encodeURIComponent(pending.ids[0]),{method:'DELETE'});
      } else await removeLocal(pending.ids);
      cancelDelete(); await refresh();
    } catch (error) { notice(error.message,true); }
    finally { $('confirm-history-delete').disabled=false; }
  });
  $('close-history-photo').addEventListener('click', () => photoDialog.close());
  photoDialog.addEventListener('close', () => {
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = null; $('history-photo').removeAttribute('src');
  });
  window.inequalityReviewHistory = Object.freeze({save, open});
})();
