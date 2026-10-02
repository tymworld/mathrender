// Password-protected, portable credentials. No password or plaintext key is persisted.
export const KEY_FILE_NAME = 'inequality-ai-key.json';
export const KEY_FILE_MAX_BYTES = 16 * 1024;
const KEY_FILE_FORMAT = 'mathrender-inequality-key';
const KEY_FILE_ITERATIONS = 600000;
const keyFileEncoder = new TextEncoder();

function requireKeyCrypto() {
  if (!globalThis.crypto?.subtle) throw new Error('当前环境不支持密码加密，请使用 HTTPS 网站、localhost 或本地 HTML 文件。');
  return globalThis.crypto;
}
function keyFileEndpoint(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('密钥文件中的 API 地址无效。'); }
  if (typeof value !== 'string' || value.length > 500 || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !url.pathname.endsWith('/chat/completions')) {
    throw new Error('密钥文件中的 API 地址无效。');
  }
  return url.href;
}
const keyFileBase64 = bytes => btoa(String.fromCharCode(...bytes));
function keyFileBytes(text, length) {
  if (typeof text !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(text)) throw new Error('密钥文件格式无效。');
  let bytes;
  try { bytes = Uint8Array.from(atob(text), char => char.charCodeAt(0)); }
  catch { throw new Error('密钥文件格式无效。'); }
  if ((length && bytes.length !== length) || keyFileBase64(bytes) !== text) throw new Error('密钥文件格式无效。');
  return bytes;
}
export function parseKeyFile(text) {
  if (typeof text !== 'string' || keyFileEncoder.encode(text).length > KEY_FILE_MAX_BYTES) throw new Error('密钥文件不能超过 16 KB。');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('请选择由本页面导出的加密密钥 JSON 文件。'); }
  if (!data || data.format !== KEY_FILE_FORMAT || data.version !== 1 || data.kdf !== 'PBKDF2-SHA256' || data.iterations !== KEY_FILE_ITERATIONS || data.cipher !== 'AES-256-GCM') {
    throw new Error('请选择由本页面导出的加密密钥 JSON 文件。');
  }
  const endpoint = keyFileEndpoint(data.endpoint);
  keyFileBytes(data.salt, 16);
  keyFileBytes(data.iv, 12);
  const ciphertext = keyFileBytes(data.ciphertext);
  if (ciphertext.length < 17 || ciphertext.length > 1040) throw new Error('密钥文件格式无效。');
  // Only validated ciphertext and metadata may be cached; discard arbitrary extra fields.
  return {format: KEY_FILE_FORMAT, version: 1, endpoint, kdf: 'PBKDF2-SHA256', iterations: KEY_FILE_ITERATIONS,
    cipher: 'AES-256-GCM', salt: data.salt, iv: data.iv, ciphertext: data.ciphertext};
}
function keyFileAAD(endpoint) { return keyFileEncoder.encode(`${KEY_FILE_FORMAT}:1:${endpoint}`); }
async function deriveFileKey(password, salt) {
  const subtle = requireKeyCrypto().subtle;
  if (typeof password !== 'string' || !password || password.length > 1024) throw new Error('请输入密钥文件的密码（不超过 1024 字符）。');
  const material = await subtle.importKey('raw', keyFileEncoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey({name: 'PBKDF2', hash: 'SHA-256', salt, iterations: KEY_FILE_ITERATIONS}, material,
    {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
}
export async function encryptKeyFile(apiKey, endpoint, password) {
  const crypto = requireKeyCrypto();
  if (typeof apiKey !== 'string' || !/^[\x21-\x7E]{1,1024}$/.test(apiKey)) throw new Error('请先填写有效的 API Key。');
  if (typeof password !== 'string' || password.trim().length < 8) throw new Error('请为密钥文件设置至少 8 个字符的密码。');
  endpoint = keyFileEndpoint(endpoint);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveFileKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt({name: 'AES-GCM', iv, additionalData: keyFileAAD(endpoint), tagLength: 128}, key, keyFileEncoder.encode(apiKey));
  return {format: KEY_FILE_FORMAT, version: 1, endpoint, kdf: 'PBKDF2-SHA256', iterations: KEY_FILE_ITERATIONS,
    cipher: 'AES-256-GCM', salt: keyFileBase64(salt), iv: keyFileBase64(iv), ciphertext: keyFileBase64(new Uint8Array(ciphertext))};
}
export async function decryptKeyFile(value, password) {
  const crypto = requireKeyCrypto();
  const data = parseKeyFile(JSON.stringify(value));
  const key = await deriveFileKey(password, keyFileBytes(data.salt, 16));
  try {
    const plaintext = await crypto.subtle.decrypt({name: 'AES-GCM', iv: keyFileBytes(data.iv, 12), additionalData: keyFileAAD(data.endpoint), tagLength: 128}, key, keyFileBytes(data.ciphertext));
    const apiKey = new TextDecoder().decode(plaintext);
    if (!/^[\x21-\x7E]{1,1024}$/.test(apiKey)) throw new Error('invalid key');
    return apiKey;
  } catch { throw new Error('密码不正确，或密钥文件已损坏。请重新输入密码或导入文件。'); }
}
