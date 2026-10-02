// Bundled inside a closure with the shared rubric and response validator.
const DEFAULT_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const DEFAULT_SETTINGS = Object.freeze({ endpoint: DEFAULT_ENDPOINT, model: DEFAULT_QWEN_MODEL, promptVersion: DEFAULT_PROMPT_VERSION, temperature: 0.1, maxTokens: 2400 });
const availableModels = new Map(QWEN_VISION_MODELS.map(model => [model.id, model]));
const availablePrompts = new Map(PROMPT_VERSIONS.map(item => [item.id, item]));
const SETTINGS_STORAGE_KEY = 'mathrender-inequality-ai-settings-v1';
const field = id => document.getElementById(id);
const settings = field('api-settings');
const keyInput = field('api-key');
const settingsMessage = field('api-settings-message');
let sessionKey = '';
let storageAvailable = true;
let modelRestored = false;
let promptMigrationNote = '';
let legacyPrompt = '';
let siteKeyFile = null;
let siteKeyError = '';
let unlockPending = null;
let finishUnlock = null;
let unlockAttempt = 0;
const unlockDialog = field('key-unlock-dialog');
const unlockPassword = field('key-file-password');

function isBuiltinPrompt(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return PROMPT_VERSIONS.some(item => item.prompt === text) || BUILTIN_PROMPT_HISTORY.includes(text);
}

function retainLegacyPrompt(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 20000) return false;
  legacyPrompt = value.trim();
  availablePrompts.set('legacy-local', { id: 'legacy-local', title: '历史自定义（只读）', date: '',
    description: '从本浏览器旧设置保留的内容，仅供选择和查看。', prompt: legacyPrompt });
  return true;
}

function validateSettings(value) {
  if (!value || typeof value !== 'object') throw new Error('请填写模型与评价设置。');
  const model = typeof value.model === 'string' ? value.model.trim() : '';
  if (!availableModels.has(model)) throw new Error('请从下拉列表选择一个千问视觉模型。');
  const endpoint = typeof value.endpoint === 'string' ? value.endpoint.trim() : '';
  let url;
  try { url = new URL(endpoint); } catch { throw new Error('请填写完整的 HTTPS API 地址。'); }
  if (endpoint.length > 500 || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !url.pathname.endsWith('/chat/completions')) {
    throw new Error('API 地址需为 HTTPS，以 /chat/completions 结尾，不包含密钥或查询参数。');
  }
  const promptVersion = typeof value.promptVersion === 'string' ? value.promptVersion : '';
  if (!availablePrompts.has(promptVersion)) throw new Error('请从下拉列表选择一个 Prompt 版本。');
  const { temperature, maxTokens } = value;
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) throw new Error('随机性请填写 0–2 之间的数值。');
  if (!Number.isInteger(maxTokens) || maxTokens < 512 || maxTokens > 8192) throw new Error('输出上限请填写 512–8192 之间的整数。');
  return { endpoint: url.href, model, promptVersion, temperature, maxTokens };
}
function loadSettings() {
  let raw;
  try { raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY); }
  catch { storageAvailable = false; return { ...DEFAULT_SETTINGS }; }
  try {
    const saved = JSON.parse(raw || 'null');
    if (saved?.version === 1 || saved?.version === 2) {
      const supported = availableModels.has(saved.model);
      let promptVersion;
      if (saved.version === 1) {
        const match = isBuiltinPrompt(saved.prompt);
        promptVersion = match ? DEFAULT_PROMPT_VERSION : (retainLegacyPrompt(saved.prompt) ? 'legacy-local' : DEFAULT_PROMPT_VERSION);
        promptMigrationNote = promptVersion === 'legacy-local' ? '已保留你原来的 Prompt，可在“历史自定义（只读）”中查看。' : '已选择推荐版本；历史版本可从下拉列表选择。';
      } else {
        const oldBuiltin = isBuiltinPrompt(saved.legacyPrompt);
        if (!oldBuiltin) retainLegacyPrompt(saved.legacyPrompt);
        promptVersion = availablePrompts.has(saved.promptVersion) ? saved.promptVersion : DEFAULT_PROMPT_VERSION;
        if (oldBuiltin && saved.promptVersion === 'legacy-local') promptMigrationNote = '原内容是旧内置 Prompt，已更新为当前推荐版本。';
        else if (promptVersion !== saved.promptVersion) promptMigrationNote = '原 Prompt 版本已不可用，已选择当前推荐版本。';
      }
      const preferences = validateSettings({ ...saved, model: supported ? saved.model : DEFAULT_QWEN_MODEL, promptVersion });
      modelRestored = !supported;
      return preferences;
    }
  } catch { /* Discard corrupt preferences and start from the original rubric. */ }
  return { ...DEFAULT_SETTINGS };
}
let activeSettings = loadSettings();
function savePreferences() {
  try {
    // Explicit allowlist: credentials and uploaded work never enter browser storage.
    const { endpoint, model, promptVersion, temperature, maxTokens } = activeSettings;
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({version: 2, endpoint, model, promptVersion, temperature, maxTokens,
      ...(legacyPrompt ? {legacyPrompt} : {})}));
    storageAvailable = true;
  } catch { storageAvailable = false; }
}
function settingsFeedback(text, error = false) {
  settingsMessage.textContent = text;
  settingsMessage.dataset.error = String(error);
}
function updateDirectConnection() {
  field('connection-label').textContent = sessionKey ? 'AI 设置 · 已配置' : siteKeyFile ? 'AI 设置 · 待解锁' : 'AI 设置 · 待配置';
  field('connection-label').title = activeSettings.model;
  field('clear-api-key').hidden = !sessionKey;
  field('api-key-state').textContent = sessionKey ? '已设置。留空可继续使用当前密钥。' : siteKeyFile ? '仅在临时换用其他 Key 时填写，使用网站密钥无需填写。' : '密钥仅在当前页面使用，不会保存。';
  keyInput.placeholder = sessionKey ? '留空保留，输入新密钥可替换' : '粘贴完整密钥';
  field('api-storage-note').textContent = storageAvailable ? '模型和 Prompt 版本保存在当前浏览器。明文密钥与密码不保存，刷新后需重新解锁。' : '当前浏览器无法保存设置，本次页面内仍可使用。明文密钥与密码不保存。';
  field('key-file-settings').hidden = !siteKeyFile && !siteKeyError;
  field('key-file-status').textContent = siteKeyError || (sessionKey ? '当前页面已配置，可直接生成评价卡。' : '已自动读取密钥，无需填写 API Key。输入使用密码即可评价。');
  field('unlock-site-key').hidden = !siteKeyFile || Boolean(sessionKey);
  field('manual-key-summary').textContent = siteKeyFile ? '临时使用其他 API Key（可选）' : '临时填写 API Key（可选）';
}
function updatePromptPreview() {
  const selected = availablePrompts.get(field('api-prompt-version').value);
  field('api-prompt').value = selected?.prompt || '';
  field('prompt-count').textContent = (selected?.prompt.length || 0).toLocaleString() + ' 字符';
  field('prompt-version-description').textContent = selected ? [selected.date, selected.description].filter(Boolean).join(' · ') : '请选择 Prompt 版本。';
  field('api-prompt').scrollTop = 0;
}
function updateModelHint() { field('api-model-hint').textContent = availableModels.get(field('api-model').value)?.description || '请选择千问视觉模型。'; }
function populateSettings() {
  keyInput.value = '';
  field('manual-key-settings').open = false;
  field('api-model').value = activeSettings.model;
  updateModelHint();
  field('api-endpoint').value = activeSettings.endpoint;
  field('legacy-prompt-option').hidden = !legacyPrompt;
  field('legacy-prompt-option').disabled = !legacyPrompt;
  field('api-prompt-version').value = activeSettings.promptVersion;
  field('api-temperature').value = String(activeSettings.temperature);
  field('api-max-tokens').value = String(activeSettings.maxTokens);
  field('api-response-format').textContent = RESPONSE_CONTRACT;
  field('api-recognition-prompt').textContent = RECOGNITION_PROMPT;
  updatePromptPreview();
  settingsFeedback([
    modelRestored ? '原模型不在可选列表中，已恢复默认模型。' : '',
    promptMigrationNote,
    !modelRestored && !promptMigrationNote ? '保存后，下次生成评价卡时生效。' : ''
  ].filter(Boolean).join(' '));
  updateDirectConnection();
}
function configure() {
  populateSettings();
  if (!settings.open) settings.showModal();
  (siteKeyFile && !sessionKey ? field('unlock-site-key') : field('api-model')).focus();
}
function forgetKey() {
  unlockAttempt++;
  sessionKey = '';
  keyInput.value = '';
  unlockPassword.value = '';
  if (unlockDialog.open) unlockDialog.close();
  updateDirectConnection();
}
function normalizeKey(value) {
  // Remove copy/paste wrappers without guessing a provider's key format.
  let key = value.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').trim();
  const quotes = { '"': '"', "'": "'", '`': '`', '“': '”', '‘': '’' };
  const unwrap = text => text.length > 1 && quotes[text[0]] === text.at(-1) ? text.slice(1, -1).trim() : text;
  key = unwrap(key).replace(/^DASHSCOPE_API_KEY\s*=\s*/i, '');
  key = unwrap(key).replace(/^Bearer(?:\s+|$)/i, '');
  return unwrap(key).replace(/\s/g, '');
}
field('api-settings-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    const candidate = normalizeKey(keyInput.value);
    if (candidate && !/^[\x21-\x7E]+$/.test(candidate)) throw new Error('密钥中含有特殊字符，请使用控制台的“复制”按钮重新复制。');
    const next = validateSettings({ endpoint: field('api-endpoint').value, model: field('api-model').value, promptVersion: field('api-prompt-version').value,
      temperature: field('api-temperature').value.trim() ? Number(field('api-temperature').value) : NaN,
      maxTokens: field('api-max-tokens').value.trim() ? Number(field('api-max-tokens').value) : NaN });
    if (sessionKey && !candidate && new URL(next.endpoint).origin !== new URL(activeSettings.endpoint).origin) {
      throw new Error('API 服务地址已更换，请为新服务填写对应的密钥。');
    }
    activeSettings = next;
    modelRestored = false;
    promptMigrationNote = '';
    if (candidate) sessionKey = candidate;
    keyInput.value = '';
    savePreferences();
    updateDirectConnection();
    settings.close();
  } catch (error) { settingsFeedback(error.message, true); }
});
field('close-api-settings').addEventListener('click', () => settings.close());
field('clear-api-key').addEventListener('click', () => {
  forgetKey(); settingsFeedback('密钥已清除，其他设置保持不变。'); keyInput.focus();
});
field('reset-api-connection').addEventListener('click', () => {
  field('api-endpoint').value = DEFAULT_SETTINGS.endpoint;
  field('api-model').value = DEFAULT_SETTINGS.model;
  updateModelHint();
  settingsFeedback('已填入千问北京默认地址与模型，保存后生效。');
});
field('api-prompt-version').addEventListener('change', updatePromptPreview);
field('api-model').addEventListener('change', updateModelHint);
settings.addEventListener('close', () => { keyInput.value = ''; });
field('connection-label').addEventListener('click', configure);
field('review-settings-button').hidden = false;
field('review-settings-button').addEventListener('click', configure);
window.addEventListener('pagehide', forgetKey);
window.addEventListener('pageshow', updateDirectConnection);

// A portable encrypted copy also works on file:// without fetching neighbouring files.
// Builds without that copy can still read the fixed same-origin configuration file.
async function loadSiteKeyFile() {
  if (EMBEDDED_KEY_FILE) {
    try { siteKeyFile = parseKeyFile(JSON.stringify(EMBEDDED_KEY_FILE)); }
    catch { siteKeyError = '页面内的加密密钥配置无效，请更新评价页面。'; }
    updateDirectConnection();
    return;
  }
  if (!/^https?:$/.test(window.location?.protocol || '')) {
    siteKeyError = '此 HTML 尚未包含加密密钥，请更新为已配置密钥的完整评价页。';
    updateDirectConnection();
    return;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(new URL(KEY_FILE_NAME, window.location.href).href, {
      method: 'GET', credentials: 'same-origin', redirect: 'error', cache: 'no-store', signal: controller.signal
    });
    if (response.status === 404) {
      await response.body?.cancel();
      siteKeyError = `未找到网站密钥文件。请将 ${KEY_FILE_NAME} 与本页面放在同一网站目录。`;
      return;
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error('网站密钥文件读取失败，请检查文件是否可访问。'); }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = '', size = 0;
    try {
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > KEY_FILE_MAX_BYTES) { await reader.cancel(); throw new Error('网站密钥文件超过 16 KB。'); }
        text += decoder.decode(value, {stream: true});
      }
      text += decoder.decode();
    } finally { reader.releaseLock(); }
    siteKeyFile = parseKeyFile(text);
  } catch (error) {
    siteKeyError = error.name === 'AbortError' ? '网站密钥文件读取超时，请刷新重试。' : '无法读取加密密钥文件，请检查网站配置。';
  } finally { clearTimeout(timer); updateDirectConnection(); }
}
function requestUnlock() {
  if (sessionKey) return Promise.resolve(true);
  if (unlockPending) return unlockPending;
  unlockPassword.value = '';
  field('key-unlock-message').textContent = '本次打开只需解锁一次。';
  field('key-unlock-message').dataset.error = 'false';
  field('submit-key-unlock').disabled = false;
  unlockPassword.disabled = false;
  unlockPending = new Promise(resolve => { finishUnlock = resolve; });
  unlockDialog.showModal();
  unlockPassword.focus();
  return unlockPending;
}
unlockDialog.addEventListener('close', () => {
  unlockAttempt++;
  unlockPassword.value = '';
  const resolve = finishUnlock;
  finishUnlock = null;
  unlockPending = null;
  resolve?.(Boolean(sessionKey));
});
field('cancel-key-unlock').addEventListener('click', () => unlockDialog.close());
field('key-unlock-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!siteKeyFile || field('submit-key-unlock').disabled) return;
  const attempt = ++unlockAttempt;
  const password = unlockPassword.value;
  unlockPassword.value = '';
  unlockPassword.disabled = true;
  field('submit-key-unlock').disabled = true;
  field('key-unlock-message').textContent = '正在解锁…';
  field('key-unlock-message').dataset.error = 'false';
  try {
    const key = await decryptKeyFile(siteKeyFile, password);
    // Closing the dialog or leaving the page cancels a pending decryption.
    if (attempt !== unlockAttempt) return;
    activeSettings = {...activeSettings, endpoint: siteKeyFile.endpoint};
    sessionKey = key;
    savePreferences();
    updateDirectConnection();
    if (settings.open) populateSettings();
    unlockDialog.close();
  } catch (error) {
    if (attempt !== unlockAttempt) return;
    field('key-unlock-message').textContent = error.message;
    field('key-unlock-message').dataset.error = 'true';
  } finally {
    if (attempt === unlockAttempt) {
      unlockPassword.disabled = false;
      field('submit-key-unlock').disabled = false;
      unlockPassword.focus();
    }
  }
});
field('unlock-site-key').addEventListener('click', requestUnlock);
async function ensureConfigured() {
  if (sessionKey) return true;
  await siteKeyReady;
  if (sessionKey) return true;
  if (siteKeyFile) return requestUnlock();
  configure();
  return false;
}

function checkImage(bytes, type) {
  if (!bytes.length) throw new Error('请先上传作品图片。');
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error('图片超过 10 MB，请压缩后上传。');
  const starts = (signature, offset = 0) => signature.every((byte, i) => bytes[offset + i] === byte);
  const valid = type === 'image/png' ? starts([137, 80, 78, 71, 13, 10, 26, 10])
    : type === 'image/jpeg' ? starts([255, 216, 255])
      : type === 'image/webp' ? starts([82, 73, 70, 70]) && starts([87, 69, 66, 80], 8) : false;
  if (!valid) throw new Error('请上传有效的 JPG、PNG 或 WebP 图片。');
}
async function readReply(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '', size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 512 * 1024) {
        await reader.cancel();
        throw new Error('reply too large');
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('AI返回内容不完整，请重新生成。');
  } finally { reader.releaseLock(); }
}
async function evaluateDirect(file, { signal } = {}) {
  if (!sessionKey) throw new Error('请在“AI 设置”中填写 API Key。');
  const { endpoint, model, promptVersion, temperature, maxTokens } = activeSettings;
  const prompt = availablePrompts.get(promptVersion).prompt;
  const requestKey = sessionKey;
  const qwen = /(^|\.)dashscope(?:-intl|-us)?\.aliyuncs\.com$/.test(new URL(endpoint).hostname);
  if (file.size > MAX_IMAGE_BYTES) throw new Error('图片超过 10 MB，请压缩后上传。');
  const bytes = new Uint8Array(await file.arrayBuffer());
  signal?.throwIfAborted();
  checkImage(bytes, file.type);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  const imageURL = `data:${file.type};base64,${btoa(binary)}`;
  const complete = async (content, stage) => {
    let response;
    try {
      response = await fetch(endpoint, {
        method: 'POST', mode: 'cors', credentials: 'omit', redirect: 'error',
        referrerPolicy: 'no-referrer', cache: 'no-store', signal,
        headers: { Authorization: `Bearer ${requestKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model, ...(qwen ? { enable_thinking: false } : {}),
          temperature: stage === 'recognition' ? 0 : temperature, max_tokens: stage === 'recognition' ? 4096 : maxTokens,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content }]
        })
      });
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new Error('无法连接 AI，请检查 API 地址、网络及服务是否允许浏览器跨域调用。');
    }
    if (!response.ok) {
      await response.body?.cancel();
      const errors = {
        400: 'AI未接受这次请求，请检查图片及模型是否可用。',
        401: 'API Key 验证失败，请在“AI 设置”检查密钥与服务地域。',
        402: 'AI 账户额度不足，请检查账户余额。',
        403: 'AI 服务拒绝调用，请检查模型权限及账户状态。',
        404: '未找到模型或接口，请在“AI 设置”选择其他模型或检查 API 地址。',
        429: 'AI调用达到限额，请检查额度或稍后再试。'
      };
      throw new Error(errors[response.status] || 'AI服务暂时不可用，请稍后再试。');
    }
    const reply = await readReply(response);
    const choice = reply.choices?.[0];
    if (choice?.finish_reason !== 'stop' || typeof choice?.message?.content !== 'string') {
      throw new Error('AI未完成本次评价，请重新生成。');
    }
    let evaluation;
    try { evaluation = JSON.parse(choice.message.content); }
    catch { throw new Error('AI返回的评价格式不正确，请重新生成。'); }
    return evaluation;
  };
  return recognizeAndEvaluate({imageURL, prompt:prompt + '\n' + RESPONSE_CONTRACT, complete});
}
window.inequalityReviewAPI = Object.freeze({
  get configured() { return Boolean(sessionKey); },
  get model() { return activeSettings.model; },
  get reviewMetadata() { return {model:activeSettings.model, promptVersion:activeSettings.promptVersion, promptTitle:availablePrompts.get(activeSettings.promptVersion).title}; },
  configure, ensureConfigured, updateConnection: updateDirectConnection, evaluate: evaluateDirect
});
populateSettings();
const siteKeyReady = loadSiteKeyFile();
