(() => {
  'use strict';
  const $ = id => document.getElementById(id), api = window.ClassroomPhotos;
  const token = new URLSearchParams(window.location.hash.slice(1)).get('key') || '';
  let busy = false, connected = false, pending = null, previewURL = '', version = 0;
  const recentURLs = [];
  api.setToken(token);
  function message(text) { $('capture-message').textContent = text; $('capture-message').hidden = !text; }
  function buttons() {
    $('capture-camera-button').disabled = $('capture-album-button').disabled = !connected || busy || Boolean(pending);
    $('capture-label').disabled = busy || Boolean(pending);
    $('capture-retry').disabled = $('capture-discard').disabled = busy;
  }
  function status(title, detail, state) {
    $('capture-transfer').hidden = false; $('capture-transfer').dataset.state = state;
    $('capture-transfer-title').textContent = title; $('capture-transfer-detail').textContent = detail;
    $('capture-progress').hidden = state !== 'busy';
    $('capture-retry').hidden = $('capture-discard').hidden = state !== 'error';
  }
  async function recent(data) {
    const current = ++version;
    recentURLs.splice(0).forEach(url => URL.revokeObjectURL(url));
    $('capture-recent-list').replaceChildren();
    $('capture-count').textContent = `${data.photos.length} 张`;
    $('capture-list-note').hidden = data.photos.length > 0;
    for (const photo of data.photos.slice(0,5)) {
      const row = api.make('article', 'capture-recent-row');
      const img = document.createElement('img'); img.alt = photo.label;
      const content = document.createElement('div'); content.append(api.make('strong','',photo.label),api.make('p','','✓ 已保存到课堂相册'));
      row.append(img,content,api.make('time','',api.dateLabel(photo.createdAt))); $('capture-recent-list').append(row);
      api.photo(photo.id, true).then(blob => {
        if (current !== version) return;
        const url = URL.createObjectURL(blob); recentURLs.push(url); img.src = url;
      }).catch(() => { img.alt = '作品预览暂不可用'; });
    }
  }
  async function connect() {
    if (!token) {
      $('capture-connection').dataset.state = 'offline'; $('capture-connection-text').textContent = '请扫描电脑端“课堂照片”中的二维码';
      message('从二维码进入后，照片就会自动送到对应的课堂相册。'); return;
    }
    $('capture-reconnect').disabled = true;
    try {
      const data = await api.request('/photos'); connected = true;
      $('capture-connection').dataset.state = 'online'; $('capture-connection-text').textContent = '已连接云端课堂相册';
      $('capture-reconnect').hidden = true; message(''); await recent(data);
    } catch (error) {
      connected = false; $('capture-connection').dataset.state = 'offline'; $('capture-connection-text').textContent = '暂未连接课堂相册';
      $('capture-reconnect').hidden = false; message(error.message);
    } finally { $('capture-reconnect').disabled = false; buttons(); }
  }
  function draw(img, edge, quality) {
    const ratio = Math.min(1,edge/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1,Math.round(img.naturalWidth*ratio)); canvas.height = Math.max(1,Math.round(img.naturalHeight*ratio));
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('浏览器无法处理照片，请换用系统浏览器。');
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const value = canvas.toDataURL('image/jpeg',quality); canvas.width = canvas.height = 1;
    if (!value.startsWith('data:image/jpeg;base64,')) throw new Error('无法处理这张照片，请重新拍摄。');
    return value;
  }
  async function choose(file) {
    if (!file || busy || pending) return;
    message('');
    if (file.size > 40*1024*1024) { message('照片超过 40 MB，请选择较小的图片。'); return; }
    if (file.type && !file.type.startsWith('image/')) { message('请选择作品照片。'); return; }
    busy = true; buttons();
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = URL.createObjectURL(file); $('capture-preview').src = previewURL;
    status('正在整理照片…','自动调整方向和尺寸，保留手写细节','busy');
    try {
      const img = new Image(); img.src = previewURL;
      try { await img.decode(); } catch { throw new Error('无法读取这张图片。若是 HEIC，请转换为 JPG，或直接使用“拍照上传”。'); }
      if (img.naturalWidth*img.naturalHeight > 60e6) throw new Error('图片分辨率过大，请选择普通照片。');
      let image = draw(img,2560,.92);
      if (image.length > 13*1024*1024) image = draw(img,2200,.82);
      pending = {id:api.uuid(), label:$('capture-label').value.trim(), image, thumbnail:draw(img,360,.78)};
      await upload();
    } catch (error) {
      $('capture-transfer').hidden = true; message(error.message);
    } finally { busy = false; buttons(); }
  }
  async function upload() {
    if (!pending) return;
    busy = true; buttons();
    status('正在保存到课堂相册…','请保持本页打开，保存完成后会显示确认','busy');
    try {
      const result = await api.request('/photos',{method:'POST',body:pending,timeout:60000});
      pending = null;
      status('✓ 照片已保存',result.photo.label + ' · 电脑端可以选择评价了','success');
      $('capture-label').value = ''; message('');
      try { await recent(await api.request('/photos')); }
      catch { message('照片已保存，最近上传列表暂时无法更新。'); }
    } catch (error) {
      status('暂未确认保存',error.message,'error');
      message('照片暂存在本页，请点“重试上传”。重试不会重复保存，请勿刷新或关闭本页。');
    } finally { busy = false; buttons(); }
  }
  for (const name of ['camera','album']) {
    $('capture-'+name+'-button').addEventListener('click', () => { $('capture-'+name+'-input').value = ''; $('capture-'+name+'-input').click(); });
    $('capture-'+name+'-input').addEventListener('change', event => choose(event.target.files[0]));
  }
  $('capture-retry').addEventListener('click', () => { if (!busy) upload(); });
  $('capture-discard').addEventListener('click', () => { if (busy) return; pending = null; $('capture-transfer').hidden = true; message(''); buttons(); });
  $('capture-reconnect').addEventListener('click', connect);
  window.addEventListener('beforeunload', event => { if (busy || pending) { event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('online', () => { if (!busy) connect(); });
  connect();
})();
