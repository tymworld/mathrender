(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const api = window.ClassroomPhotos;
  let active = false, locked = false, connected = false, connecting = false, selected = null;
  let photos = [], visibleCount = 12, timer = 0, selectionRevision = 0, renderRevision = 0, sessionRevision = 0, refreshing = false;
  let selectFile, clearFile, link = '', pairingToken = '', fullURL = '', lastSnapshot = '';
  let showPast = false;
  const thumbnails = new Map();
  function notice(text, error = false) {
    $('classroom-message').textContent = text; $('classroom-message').hidden = !text;
    $('classroom-message').dataset.error = String(error);
  }
  function releaseSelection() {
    selectionRevision++; selected = null;
    if (fullURL) URL.revokeObjectURL(fullURL); fullURL = '';
    $('classroom-full-photo').removeAttribute('src');
    $('classroom-selected-label').textContent = '选择一张作品，开始评价';
    $('classroom-preview').disabled = true;
    $('classroom-delete-selected').disabled = true;
    clearFile?.();
  }
  function switchTab(next) {
    if (locked || active === next) return;
    active = next; releaseSelection();
    document.body.classList.toggle('classroom-mode', active);
    $('local-photo-panel').hidden = active;
    $('classroom-photo-panel').hidden = !active;
    $('classroom-selection').hidden = !active;
    for (const [id, state] of [['local-photo-tab', !active], ['classroom-photo-tab', active]]) {
      $(id).setAttribute('aria-selected', String(state)); $(id).tabIndex = state ? 0 : -1;
    }
    $('generate-label').textContent = active ? '用这张生成评价卡' : '上传并生成评价卡';
    clearTimeout(timer);
    if (active) { if (connected) { render(); refresh(); } else connect(); }
  }
  function qr() {
    const origin = window.location.origin;
    const box = $('classroom-qr'); box.replaceChildren();
    $('classroom-copy-link').disabled = !origin;
    if (!origin) return;
    link = origin + '/labs/algebra/inequality-upload.html#key=' + pairingToken;
    const code = qrcodegen.QrCode.encodeText(link, qrcodegen.QrCode.Ecc.MEDIUM);
    const canvas = document.createElement('canvas');
    const border = 4, scale = 5; canvas.width = canvas.height = (code.size + border * 2) * scale;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#142157';
    for (let y = 0; y < code.size; y++) for (let x = 0; x < code.size; x++) if (code.getModule(x,y)) ctx.fillRect((x+border)*scale,(y+border)*scale,scale,scale);
    box.append(canvas); $('classroom-link-fallback').value = link;
  }
  function acceptSession(result) {
    sessionRevision++;
    pairingToken = result.uploadToken; api.setToken(result.token); connected = true;
    qr();
    $('classroom-unavailable').hidden = true; $('classroom-workspace').hidden = false;
    refresh();
  }
  async function connect() {
    if (connecting) return;
    connecting = true;
    try {
      if (!/^https?:$/.test(window.location.protocol)) throw new Error('请从已部署的网站打开评价卡，连接云端课堂相册。单独打开 HTML 时可以使用“本机上传”。');
      const result = await window.inequalityReviewAPI.ensureClassroom();
      if (!result) throw new Error('输入一次课堂密码，即可使用相册与 AI 评价。');
      if (!connected || pairingToken !== result.uploadToken) acceptSession(result);
      await refresh();
    } catch (error) {
      $('classroom-unavailable-text').textContent = error.message;
      $('classroom-unavailable').hidden = false; $('classroom-workspace').hidden = true;
    } finally { connecting = false; }
  }
  function schedule() {
    clearTimeout(timer);
    if (active && connected && !document.hidden && !$('upload-screen').hidden) timer = setTimeout(refresh, 3000);
  }
  async function refresh() {
    if (!connected || refreshing) { schedule(); return; }
    if (!active || document.hidden || $('upload-screen').hidden) return;
    if (locked) { schedule(); return; }
    refreshing = true;
    const revision = sessionRevision;
    try {
      const data = await api.request('/photos');
      if (!active || locked || revision !== sessionRevision) return;
      for (const previous of photos) {
        if (data.photos.find(p=>p.id===previous.id)?.rotation !== previous.rotation && thumbnails.has(previous.id)) {
          URL.revokeObjectURL(thumbnails.get(previous.id)); thumbnails.delete(previous.id);
        }
      }
      photos = data.photos;
      const snapshot = api.dayKey(Date.now()) + JSON.stringify(photos);
      if (snapshot !== lastSnapshot) {
        lastSnapshot = snapshot;
        if (selected && !photos.some(p => p.id === selected.id)) { releaseSelection(); notice('所选照片已被删除，请选择另一张作品。'); }
        else if (selected && photos.find(p => p.id === selected.id)?.rotation !== selected.rotation) {
          releaseSelection(); notice('照片方向已在另一台设备更新，请重新选择这张作品。');
        }
        render();
      }
      if ($('classroom-message').dataset.error === 'true') notice('');
    } catch (error) {
      if (revision !== sessionRevision) return;
      notice(error.message + ' 已显示的照片会保留。', true);
      if (error.status === 401) { connected = false; window.inequalityReviewAPI.lockClassroom(); await connect(); }
    } finally { refreshing = false; schedule(); }
  }
  function render() {
    const version = ++renderRevision;
    const list = $('classroom-photo-grid');
    const focused = document.activeElement?.dataset.photoId;
    list.replaceChildren();
    const today = api.dayKey(Date.now());
    const days = [...new Set(photos.map(p=>api.dayKey(p.createdAt)).filter(day=>day<today))].sort().reverse();
    const dateSelect = $('classroom-date'), chosenDate = dateSelect.value;
    const allDates = api.make('option','','全部往日'); allDates.value = '';
    dateSelect.replaceChildren(allDates,...days.map(day=>{const option=api.make('option','',day);option.value=day;return option;}));
    dateSelect.value = days.includes(chosenDate) ? chosenDate : '';
    $('classroom-date-control').hidden = !showPast;
    $('classroom-past-toggle').textContent = showPast ? '返回今天' : '查看往日照片';
    $('classroom-past-toggle').setAttribute('aria-expanded',String(showPast));
    const inPeriod = photos.filter(p=>{
      const day=api.dayKey(p.createdAt);
      return showPast ? day<today && (!dateSelect.value || day===dateSelect.value) : day===today;
    });
    const filtered = inPeriod.filter(p => !$('classroom-pending-only').checked || !p.reviewedAt);
    $('classroom-count').textContent = String(photos.filter(p=>api.dayKey(p.createdAt)===today).length);
    $('classroom-total').textContent = `${showPast ? dateSelect.value || '往日' : '今天'} ${filtered.length} 张`;
    if(selected && !filtered.some(p=>p.id===selected.id)) releaseSelection();
    const visible = filtered.slice(0, visibleCount);
    $('classroom-empty').hidden = filtered.length > 0;
    $('classroom-photo-grid').hidden = filtered.length === 0;
    $('classroom-empty').querySelector('h3').textContent = inPeriod.length ? '待评价的作品都看完了' : showPast ? '暂无往日照片' : '今天还没有上传作品';
    $('classroom-empty').querySelector('p').textContent = inPeriod.length ? '取消“只看待评价”，可以回看这些作品。' : showPast ? '换一个日期，或返回今天继续评价。' : '手机扫码拍照后，作品会自动出现在这里。\n以前的作品可从“查看往日照片”进入。';
    $('classroom-more').hidden = filtered.length <= visibleCount;
    for (const [id, url] of thumbnails) if (!visible.some(p => p.id === id)) { URL.revokeObjectURL(url); thumbnails.delete(id); }
    for (const photo of visible) {
      const button = api.make('button', 'classroom-photo'); button.type = 'button'; button.dataset.photoId = photo.id;
      button.setAttribute('aria-pressed', String(selected?.id === photo.id)); button.disabled = locked;
      button.setAttribute('aria-label', `${photo.label}，${api.dateLabel(photo.createdAt)}，${photo.reviewedAt ? '已评价' : '待评价'}`);
      const frame = api.make('span', 'classroom-thumbnail');
      const img = document.createElement('img'); img.alt = photo.label; img.loading = 'lazy'; frame.append(img);
      if (thumbnails.has(photo.id)) img.src = thumbnails.get(photo.id);
      else api.photo(photo.id, true).then(blob => {
        if (version !== renderRevision) return;
        const url = URL.createObjectURL(blob); thumbnails.set(photo.id, url); img.src = url;
      }).catch(() => { if (version === renderRevision) { img.remove(); frame.append(api.make('span', '', '预览暂不可用')); } });
      const meta = api.make('span', 'classroom-photo-meta');
      meta.append(api.make('strong', '', photo.label), api.make('time', '', api.dateLabel(photo.createdAt)));
      const badge = api.make('span', 'classroom-photo-badge', photo.reviewedAt ? '已评价' : '待评价'); badge.dataset.reviewed = String(Boolean(photo.reviewedAt));
      frame.append(badge, api.make('span', 'classroom-photo-check', '✓'));
      button.append(frame, meta); button.addEventListener('click', () => choose(photo)); list.append(button);
      if (focused === photo.id) button.focus({preventScroll:true});
    }
  }
  async function choose(photo) {
    if (locked) return;
    releaseSelection(); const revision = selectionRevision;
    notice('正在读取这张作品…');
    $('classroom-selected-label').textContent = '正在读取照片…';
    try {
      const blob = await api.photo(photo.id);
      if (revision !== selectionRevision || !active) return;
      const file = new File([blob], photo.label + ({'image/png':'.png', 'image/webp':'.webp'}[blob.type] || '.jpg'), {type:blob.type});
      file.classroomRotation=blob.classroomRotation || 0;
      file.classroomPhotoKey=blob.classroomPhotoKey || '';
      const accepted = await selectFile(file, photo.id);
      if (revision !== selectionRevision || !active) return;
      if (!accepted) { $('classroom-selected-label').textContent = '图片无法读取，请重新上传'; notice('图片无法读取，请重新拍照上传。', true); return; }
      selected = photo; fullURL = URL.createObjectURL(blob);
      $('classroom-selected-label').textContent = '已选择：' + photo.label;
      $('classroom-preview').disabled = false; $('classroom-delete-selected').disabled = false; notice(''); render();
    } catch (error) {
      if (revision !== selectionRevision) return;
      $('classroom-selected-label').textContent = '选择一张作品，开始评价'; notice(error.message, true);
    }
  }
  function setBusy(value) {
    locked = value;
    for (const id of ['local-photo-tab','classroom-photo-tab','classroom-pending-only','classroom-delete','classroom-refresh','classroom-past-toggle','classroom-date']) $(id).disabled = value;
    $('classroom-preview').disabled = value || !selected;
    $('classroom-delete-selected').disabled = value || !selected;
    for (const button of $('classroom-photo-grid').querySelectorAll('button')) button.disabled = value;
  }
  $('local-photo-tab').addEventListener('click', () => switchTab(false));
  $('classroom-photo-tab').addEventListener('click', () => switchTab(true));
  for (const id of ['local-photo-tab','classroom-photo-tab']) $(id).addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault(); switchTab(event.key === 'Home' ? false : event.key === 'End' ? true : !active);
    $(active ? 'classroom-photo-tab' : 'local-photo-tab').focus();
  });
  $('classroom-refresh').addEventListener('click', () => { lastSnapshot = ''; refresh(); });
  $('classroom-reconnect').addEventListener('click', async () => {
    $('classroom-reconnect').disabled = true;
    try { await connect(); } finally { $('classroom-reconnect').disabled = false; }
  });
  $('classroom-pending-only').addEventListener('change', () => { visibleCount = 12; render(); });
  $('classroom-past-toggle').addEventListener('click',()=>{if(locked)return;showPast=!showPast;visibleCount=12;releaseSelection();render();});
  $('classroom-date').addEventListener('change',()=>{visibleCount=12;releaseSelection();render();});
  $('classroom-more').addEventListener('click', () => { visibleCount += 12; render(); });
  $('classroom-copy-link').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(link); $('classroom-link-message').textContent = '链接已复制'; }
    catch { $('classroom-link-fallback').hidden = false; $('classroom-link-fallback').select(); $('classroom-link-message').textContent = '请复制下方链接'; }
  });
  function openPreview(confirmDelete = false) {
    if (!selected || !fullURL || locked) return;
    $('classroom-preview-title').textContent = selected.label; $('classroom-full-photo').src = fullURL;
    $('classroom-preview-message').textContent = ''; $('classroom-delete-confirm').hidden = !confirmDelete;
    $('classroom-preview-dialog').showModal();
    if (confirmDelete) $('classroom-delete-cancel').focus();
  }
  $('classroom-preview').addEventListener('click', () => openPreview());
  $('classroom-delete-selected').addEventListener('click', () => openPreview(true));
  $('classroom-preview-close').addEventListener('click', () => $('classroom-preview-dialog').close());
  $('classroom-delete').addEventListener('click', () => { $('classroom-delete-confirm').hidden = false; $('classroom-delete-cancel').focus(); });
  $('classroom-delete-cancel').addEventListener('click', () => { $('classroom-delete-confirm').hidden = true; });
  $('classroom-delete-submit').addEventListener('click', async () => {
    if (!selected || $('classroom-delete-submit').disabled) return;
    $('classroom-delete-submit').disabled = true;
    try {
      await api.request('/photos/' + selected.id, {method:'DELETE'});
      $('classroom-preview-dialog').close(); releaseSelection(); await refresh();
    } catch (error) { $('classroom-preview-message').textContent = error.message; }
    finally { $('classroom-delete-submit').disabled = false; }
  });
  window.addEventListener('focus', () => { if (active && connected) refresh(); });
  window.addEventListener('pagehide', () => clearTimeout(timer));
  window.inequalityClassroom = Object.freeze({
    acceptSession,
    disconnect() { sessionRevision++; connected = false; clearTimeout(timer); api.setToken(''); pairingToken = ''; $('classroom-workspace').hidden = true; $('classroom-unavailable').hidden = false; },
    init({onSelect, onClear}) { selectFile = onSelect; clearFile = onClear; },
    get active() { return active; }, setBusy,
    reset() { if (active) { releaseSelection(); render(); refresh(); } },
    async markReviewed(id) { await api.request('/photos/' + id + '/reviewed', {method:'POST'}); },
    async saveRotation(id,from,rotation,blob) {
      const data=await api.request('/photos/'+id+'/rotation',{method:'POST',body:{from,rotation}});
      photos=photos.map(p=>p.id===id?data.photo:p);
      if (thumbnails.has(id)) { URL.revokeObjectURL(thumbnails.get(id)); thumbnails.delete(id); }
      if (selected?.id===id) {
        selected=data.photo;
        if(fullURL) URL.revokeObjectURL(fullURL);
        fullURL=URL.createObjectURL(blob); $('classroom-full-photo').src=fullURL;
      }
      render();
    },
    resume() { if (active && connected) refresh(); }
  });
})();
