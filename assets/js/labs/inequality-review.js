(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const directAPI = window.inequalityReviewAPI;
  const history = window.inequalityReviewHistory;
  const classroom = window.inequalityClassroom;
  // A grade alone cannot tell which proof step or equality case is missing.
  // Keep margin notes neutral; the actual diagnosis belongs in the AI comment.
  const gradeNotes = {
    scientific: { A: '结论成立\n继续探索！', B: '结论正确\n表达再打磨！', C: '局部需要调整\n请看具体建议', D: '结论存在问题\n请看具体建议' },
    rigor: { A: '推导与取等\n清楚、完整！', B: '补齐细节\n论证更周全！', C: '论证尚需完善\n继续补充依据', D: '论证存在问题\n请看具体建议' },
    creativity: { A: '推广有意义\n变化有说明！', B: '有效变式\n拓展新思路！', C: '从模仿出发\n再向前一步！', D: '试着改变原式\n创作新不等式' }
  };
  let photoURL = null;
  let selectedFile = null;
  let selectedClassroomId = null;
  let sequence = 0;
  let busy = false;
  let serverModel = '千问';
  let controller = null;
  let fitFrame = 0;
  let historyPhotoURL = null;

  function releaseHistoryPhoto() {
    if (historyPhotoURL) URL.revokeObjectURL(historyPhotoURL);
    historyPhotoURL = null;
  }
  function historyNote(text, error = false) {
    $('history-save-note').textContent = text;
    $('history-save-note').hidden = !text;
    $('history-save-note').dataset.error = String(error);
    scheduleFit();
  }

  function fitCard() {
    const screen = $('result-screen');
    if (screen.hidden) return;
    const card = document.querySelector('.evaluation-card');
    const mainStyle = getComputedStyle(document.querySelector('main'));
    const availableHeight = window.innerHeight - parseFloat(mainStyle.paddingTop) - parseFloat(mainStyle.paddingBottom);
    const content = card.querySelectorAll('.formula, .score-heading, .score-comment, .feedback>div, .verdict');
    const fits = () => card.getBoundingClientRect().height <= availableHeight + 1 &&
      [...content].every(element => element.scrollWidth <= element.clientWidth + 1);
    const setFont = size => document.body.style.setProperty('--review-font', size + 'px');
    const mobile = window.innerWidth < 761;
    const preferred = mobile ? 18 : window.innerWidth >= 1400 ? 24 : 22;
    const minimum = mobile ? 16 : 18;
    screen.removeAttribute('data-overflow');

    // Fixed row heights and decorations cannot be fixed by shrinking text.
    // Reclaim that space first, then search only within readable font sizes.
    for (const density of ['normal', 'compact', 'minimal']) {
      card.dataset.density = density;
      setFont(preferred);
      if (fits()) return;
    }
    setFont(minimum);
    if (!fits()) {
      // Unusually long feedback must remain readable and complete.
      screen.dataset.overflow = 'true';
      return;
    }
    let low = minimum;
    let high = preferred;
    while (high - low > .25) {
      const mid = (low + high) / 2;
      setFont(mid);
      if (fits()) low = mid;
      else high = mid;
    }
    setFont(Math.floor(low * 4) / 4);
  }

  function scheduleFit() {
    cancelAnimationFrame(fitFrame);
    fitFrame = requestAnimationFrame(fitCard);
  }

  function message(text) {
    $('message').textContent = text;
    $('message').hidden = !text;
  }

  async function updateConnection() {
    if (directAPI) {
      directAPI.updateConnection();
      return;
    }
    try {
      const response = await fetch('/api/status', { cache: 'no-store' });
      if (!response.ok) throw new Error('unavailable');
      const status = await response.json();
      serverModel = status.model || '千问';
      $('connection-label').textContent = status.configured ? '千问 · 已配置' : '千问 · 待配置';
    } catch { $('connection-label').textContent = '千问 · 服务未启动'; }
  }

  function clearPhoto() {
    if (photoURL) URL.revokeObjectURL(photoURL);
    photoURL = null;
    selectedFile = null;
    selectedClassroomId = null;
    $('photo-preview').removeAttribute('src');
    $('result-photo').removeAttribute('src');
    $('result-photo').hidden = true;
    $('photo-preview').hidden = true;
    $('replace-hint').hidden = true;
    $('upload-placeholder').hidden = false;
    $('file-name').textContent = 'JPG、PNG、WebP · 最大 10 MB';
    $('generate-button').disabled = true;
  }

  async function choosePhoto(file, classroomId = null) {
    if (!file || busy) return;
    const request = ++sequence;
    clearPhoto();
    message('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      message('请选择 JPG、PNG 或 WebP 图片。'); return;
    }
    if (file.size > 10 * 1024 * 1024) {
      message('图片超过 10 MB，请压缩后上传。'); return;
    }
    const candidate = URL.createObjectURL(file);
    const probe = new Image();
    probe.src = candidate;
    try { await probe.decode(); }
    catch {
      URL.revokeObjectURL(candidate);
      if (request === sequence) message('无法读取图片，请重新上传。');
      return;
    }
    if (request !== sequence) { URL.revokeObjectURL(candidate); return; }
    photoURL = candidate;
    selectedFile = file;
    selectedClassroomId = classroomId;
    $('photo-preview').src = photoURL;
    $('photo-preview').hidden = false;
    $('replace-hint').hidden = false;
    $('upload-placeholder').hidden = true;
    $('file-name').textContent = file.name;
    $('generate-button').disabled = false;
    return true;
  }

  function setBusy(value) {
    busy = value;
    $('upload-button').disabled = value;
    $('generate-button').disabled = value || !selectedFile;
    $('generate-button').setAttribute('aria-busy', String(value));
    $('generate-label').textContent = value ? `正在采用 ${directAPI?.model || serverModel} AI模型评价` : classroom?.active ? '用这张生成评价卡' : '上传并生成评价卡';
    classroom?.setBusy(value);
    $('generate-arrow').hidden = value;
    $('history-button').disabled = value;
    $('review-history-button').disabled = value;
    if (directAPI) {
      $('connection-label').disabled = value;
      $('review-settings-button').disabled = value;
    }
  }

  function renderCard(result, sourcePhoto = photoURL) {
    if (sourcePhoto) $('result-photo').src = sourcePhoto;
    else $('result-photo').removeAttribute('src');
    $('result-photo').hidden = !sourcePhoto;
    $('verdict').textContent = result.verdict;
    $('formula').textContent = result.formula || '图片中的公式尚不能可靠识别';
    const pending = ['scientific', 'rigor', 'creativity'].some(key => result[key].grade === null);
    for (const key of ['scientific', 'rigor', 'creativity']) {
      const item = result[key];
      const grade = $(key + '-grade');
      grade.textContent = item.grade === null ? '待完善' : item.grade;
      grade.parentElement.classList.toggle('pending', item.grade === null);
      $(key + '-level').textContent = ({ A: '优秀', B: '良好', C: '合格', D: '须努力' })[item.grade] || '待补充';
      $(key + '-comment').textContent = item.comment;
      $(key + '-note').textContent = gradeNotes[key][item.grade] || '先补全信息\n再来一起探索';
    }
    $('highlight').textContent = result.highlight;
    $('suggestion').textContent = result.suggestion;
    $('result-state').textContent = pending ? '请补充条件' : '评价已完成';
    $('upload-screen').hidden = true;
    $('result-screen').hidden = false;
    document.body.classList.add('review-mode');
    fitCard();
    window.scrollTo({ top: 0, behavior: 'instant' });
    $('card-title').focus({ preventScroll: true });
  }

  $('upload-button').addEventListener('click', () => {
    if (busy) return;
    $('photo-input').value = '';
    $('photo-input').click();
  });
  $('photo-input').addEventListener('change', event => choosePhoto(event.target.files[0]));
  $('upload-button').addEventListener('dragover', event => {
    event.preventDefault();
    if (!busy) $('upload-button').classList.add('dragging');
  });
  $('upload-button').addEventListener('dragleave', () => $('upload-button').classList.remove('dragging'));
  $('upload-button').addEventListener('drop', event => {
    event.preventDefault(); $('upload-button').classList.remove('dragging');
    choosePhoto(event.dataTransfer.files[0]);
  });
  const openHistory = () => {
    if (busy) return;
    return history.open((entry, photo) => {
      releaseHistoryPhoto();
      historyPhotoURL = photo instanceof Blob ? URL.createObjectURL(photo) : null;
      historyNote('');
      renderCard(entry.result, historyPhotoURL);
      historyNote(`历史评价 · ${new Date(entry.createdAt).toLocaleString('zh-CN')} · ${entry.model || 'AI'} · ${entry.promptTitle || entry.promptVersion || '默认评价规则'}`);
    });
  };
  $('history-button').addEventListener('click', openHistory);
  $('review-history-button').addEventListener('click', openHistory);
  $('generate-button').addEventListener('click', async () => {
    if (!selectedFile || busy) return;
    if (directAPI && !directAPI.configured) {
      if (!await directAPI.ensureConfigured()) return;
      if (!selectedFile || busy) return;
    }
    setBusy(true);
    const metadata = directAPI?.reviewMetadata || {model:serverModel, promptVersion:'server-default', promptTitle:'服务默认评价规则'};
    const submittedPhoto = selectedFile;
    const submittedClassroomId = selectedClassroomId;
    message('');
    controller = new AbortController();
    const timer = setTimeout(() => controller?.abort(), 105000);
    try {
      let result;
      if (directAPI) {
        result = await directAPI.evaluate(selectedFile, { signal: controller.signal });
      } else {
        const response = await fetch('/api/evaluate', {
          method: 'POST', headers: { 'Content-Type': selectedFile.type },
          body: selectedFile, signal: controller.signal
        });
        try { result = await response.json(); }
        catch { throw new Error('评价服务未启动，请使用“启动评价卡”打开页面。'); }
        if (!response.ok) throw new Error(result.error || '评价失败，请稍后重试。');
      }
      if (result.status === 'unreadable') {
        message(result.suggestion || '图片中的公式看不清，请拍清楚后重新上传。');
      } else {
        releaseHistoryPhoto();
        historyNote('');
        renderCard(result);
        message('');
        try {
          await history.save(result, {...metadata, photo:submittedPhoto});
          historyNote('已保存到历史记录');
        } catch (error) {
          historyNote('评价卡已生成，但历史未保存。' + error.message, true);
        }
        if (submittedClassroomId) {
          try { await classroom.markReviewed(submittedClassroomId); }
          catch { historyNote($('history-save-note').textContent + ' · 云端“已评价”标记未同步，照片仍保留。', true); }
        }
      }
    } catch (error) {
      message(error.name === 'AbortError' ? '评价超时，请稍后重试。' : error.message === 'Failed to fetch' ? '连接失败，请确认评价服务已启动。' : error.message);
    } finally {
      clearTimeout(timer);
      controller = null;
      setBusy(false);
      updateConnection();
    }
  });
  $('restart-button').addEventListener('click', () => {
    sequence++;
    releaseHistoryPhoto();
    historyNote('');
    clearPhoto();
    $('photo-input').value = '';
    $('result-screen').hidden = true;
    document.body.classList.remove('review-mode');
    $('upload-screen').hidden = false;
    classroom?.reset();
    message('');
    window.scrollTo({ top: 0, behavior: 'instant' });
    $(classroom?.active ? 'classroom-photo-tab' : 'upload-button').focus({ preventScroll: true });
  });
  window.addEventListener('focus', updateConnection);
  window.addEventListener('resize', scheduleFit);
  window.visualViewport?.addEventListener('resize', scheduleFit);
  document.fonts?.ready.then(scheduleFit);
  window.addEventListener('pagehide', () => controller?.abort());
  classroom?.init({onSelect:choosePhoto, onClear:() => { sequence++; clearPhoto(); message(''); }});
  updateConnection();
})();
