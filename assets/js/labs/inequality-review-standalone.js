// Bundled inside a closure with the shared rubric and response validator.
const endpoint = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const model = 'qwen3.5-plus';
const settings = document.getElementById('api-settings');
const keyInput = document.getElementById('api-key');
const settingsMessage = document.getElementById('api-settings-message');
let sessionKey = '';

function settingsFeedback(text) {
  settingsMessage.textContent = text;
  settingsMessage.hidden = !text;
}
function updateDirectConnection() {
  document.getElementById('connection-label').textContent = sessionKey ? '千问 · 已设置' : '千问 · 设置密钥';
  document.getElementById('clear-api-key').hidden = !sessionKey;
}
function configure() {
  keyInput.value = '';
  settingsFeedback('');
  updateDirectConnection();
  if (!settings.open) settings.showModal();
  keyInput.focus();
}
function forgetKey() {
  sessionKey = '';
  keyInput.value = '';
  settingsFeedback('');
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
document.getElementById('api-settings-form').addEventListener('submit', event => {
  event.preventDefault();
  const candidate = normalizeKey(keyInput.value);
  if (!candidate) {
    settingsFeedback('请先粘贴百炼 API Key。');
    keyInput.focus();
    return;
  }
  // HTTP header compatibility only; authentication belongs to the Qwen API.
  if (!/^[\x21-\x7E]+$/.test(candidate)) {
    settingsFeedback('密钥中含有特殊字符，请使用百炼控制台的“复制”按钮重新复制。');
    keyInput.focus();
    return;
  }
  sessionKey = candidate;
  keyInput.value = '';
  updateDirectConnection();
  settings.close();
});
document.getElementById('close-api-settings').addEventListener('click', () => settings.close());
document.getElementById('clear-api-key').addEventListener('click', () => {
  forgetKey();
  settingsFeedback('密钥已清除，可输入新的密钥。');
  keyInput.focus();
});
settings.addEventListener('close', () => { keyInput.value = ''; });
document.getElementById('connection-label').addEventListener('click', configure);
window.addEventListener('pagehide', forgetKey);
window.addEventListener('pageshow', updateDirectConnection);

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
    throw new Error('千问返回内容不完整，请重新生成。');
  } finally { reader.releaseLock(); }
}
async function evaluateDirect(file, { signal } = {}) {
  if (!sessionKey) throw new Error('请点击右上角“设置密钥”，填写千问 API Key。');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('图片超过 10 MB，请压缩后上传。');
  const bytes = new Uint8Array(await file.arrayBuffer());
  signal?.throwIfAborted();
  checkImage(bytes, file.type);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  const imageURL = `data:${file.type};base64,${btoa(binary)}`;
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST', mode: 'cors', credentials: 'omit', redirect: 'error',
      referrerPolicy: 'no-referrer', cache: 'no-store', signal,
      headers: { Authorization: `Bearer ${sessionKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, enable_thinking: false, temperature: 0.1, max_tokens: 2400,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: [
          { type: 'text', text: EVALUATION_PROMPT },
          { type: 'image_url', image_url: { url: imageURL } }
        ] }]
      })
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('无法连接千问，请检查网络；也可尝试用最新版 Chrome 或 Edge 打开此 HTML 文件。');
  }
  if (!response.ok) {
    await response.body?.cancel();
    const errors = {
      400: '千问未接受这次请求，请检查图片及模型是否可用。',
      401: 'API Key 验证失败，请点击右上角重新设置北京地域的密钥。',
      402: '百炼账户额度不足，请检查账户余额。',
      403: '百炼拒绝调用，请检查模型权限及账户状态。',
      404: '未找到模型或接口，请确认百炼账户可使用 qwen3.5-plus。',
      429: '千问调用达到限额，请检查额度或稍后再试。'
    };
    throw new Error(errors[response.status] || '千问服务暂时不可用，请稍后再试。');
  }
  const reply = await readReply(response);
  const choice = reply.choices?.[0];
  if (choice?.finish_reason !== 'stop' || typeof choice?.message?.content !== 'string') {
    throw new Error('千问未完成本次评价，请重新生成。');
  }
  let evaluation;
  try { evaluation = JSON.parse(choice.message.content); }
  catch { throw new Error('千问返回的评价格式不正确，请重新生成。'); }
  return validateEvaluation(evaluation);
}
window.inequalityReviewAPI = Object.freeze({
  get configured() { return Boolean(sessionKey); },
  configure, updateConnection: updateDirectConnection, evaluate: evaluateDirect
});
configure();
