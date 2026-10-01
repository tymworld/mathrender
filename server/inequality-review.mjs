import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
import { MAX_IMAGE_BYTES, PublicError, EVALUATION_PROMPT, validateEvaluation } from '../assets/js/labs/inequality-review-protocol.mjs';
export { MAX_IMAGE_BYTES, PublicError, EVALUATION_PROMPT, validateEvaluation };

export async function loadConfig() {
  const values = {};
  try {
    const source = await readFile(path.join(ROOT, '.env.qwen'), 'utf8');
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (!match) continue;
      let value = match[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      values[match[1]] = value;
    }
  } catch (error) { if (error.code !== 'ENOENT') throw new PublicError(503, '无法读取千问配置文件。'); }
  const get = key => (process.env[key] ?? values[key] ?? '').trim();
  return {
    apiKey: get('DASHSCOPE_API_KEY'),
    baseURL: get('QWEN_BASE_URL') || DEFAULT_BASE_URL,
    model: get('QWEN_MODEL') || 'qwen3.5-plus'
  };
}

export function completionURL(baseURL) {
  let url;
  try { url = new URL(baseURL); } catch { throw new PublicError(503, '千问调用地址格式不正确，请检查 QWEN_BASE_URL。'); }
  const allowed = new Set(['dashscope.aliyuncs.com', 'dashscope-intl.aliyuncs.com', 'dashscope-us.aliyuncs.com', 'cn-hongkong.dashscope.aliyuncs.com']);
  const workspace = /^[a-z0-9-]+\.(cn-beijing|ap-southeast-1|us-east-1|cn-hongkong|ap-northeast-1|eu-central-1)\.maas\.aliyuncs\.com$/;
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash ||
      (!allowed.has(url.hostname) && !workspace.test(url.hostname)) || url.pathname.replace(/\/$/, '') !== '/compatible-mode/v1') {
    throw new PublicError(503, '请填写百炼官方的 OpenAI 兼容 Base URL，并确认地域与 API Key 一致。');
  }
  return url.href.replace(/\/$/, '') + '/chat/completions';
}

export function validateImage(bytes, type) {
  if (!bytes.length) throw new PublicError(400, '请先上传作品图片。');
  if (bytes.length > MAX_IMAGE_BYTES) throw new PublicError(413, '图片超过 10 MB，请压缩后上传。');
  const valid = type === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : type === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : type === 'image/webp' ? bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' : false;
  if (!valid) throw new PublicError(415, '请上传有效的 JPG、PNG 或 WebP 图片。');
}


export async function evaluateImage(bytes, type, config, { fetchImpl = fetch, signal } = {}) {
  if (!config.apiKey || /[\r\n]/.test(config.apiKey) || config.apiKey === '在这里粘贴你的APIKey') throw new PublicError(503, '请先在 .env.qwen 中填写 API Key 并保存。');
  validateImage(bytes, type);
  const endpoint = completionURL(config.baseURL);
  const response = await fetchImpl(endpoint, {
    method: 'POST', redirect: 'error', signal,
    headers: { 'Authorization': `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model, enable_thinking: false, temperature: 0.1, max_tokens: 2400,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: [
        { type: 'text', text: EVALUATION_PROMPT },
        { type: 'image_url', image_url: { url: `data:${type};base64,${bytes.toString('base64')}` } }
      ] }]
    })
  });
  if (!response.ok) {
    // Never send raw provider errors back to the browser: they can contain request data.
    await response.body?.cancel();
    const errors = {
      400: '千问未接受这次请求，请检查图片、模型名和调用地址。',
      401: 'API Key 验证失败，请检查密钥及其所属地域。',
      402: '百炼账户额度不足，请检查账户余额。',
      403: '百炼拒绝调用，请检查模型权限及账户状态。',
      404: '未找到模型或接口，请检查模型名和调用地址。',
      429: '千问调用达到限额，请检查额度或稍后再试。'
    };
    throw new PublicError(502, errors[response.status] || '千问服务暂时不可用，请稍后再试。');
  }
  let body;
  try {
    const reader = response.body.getReader();
    const chunks = []; let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 512 * 1024) { await reader.cancel(); throw new Error('oversize'); }
      chunks.push(Buffer.from(value));
    }
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { throw new PublicError(502, '千问返回内容不完整，请重新生成。'); }
  const choice = body.choices?.[0];
  if (choice?.finish_reason !== 'stop' || typeof choice?.message?.content !== 'string') throw new PublicError(502, '千问未完成本次评价，请重新生成。');
  let evaluation;
  try { evaluation = JSON.parse(choice.message.content); }
  catch { throw new PublicError(502, '千问返回的评价格式不正确，请重新生成。'); }
  return validateEvaluation(evaluation);
}

function sendJSON(res, status, value) {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}

async function readImage(req) {
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > MAX_IMAGE_BYTES) throw new PublicError(413, '图片超过 10 MB，请压缩后上传。');
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_IMAGE_BYTES) throw new PublicError(413, '图片超过 10 MB，请压缩后上传。');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function createReviewServer({ configLoader = loadConfig, fetchImpl = fetch, timeoutMs = 90000 } = {}) {
  let active = 0;
  let requests = [];
  const server = http.createServer(async (req, res) => {
    try {
      const port = server.address()?.port;
      const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
      if (!hosts.has(req.headers.host)) throw new PublicError(403, '请通过本机预览地址打开页面。');
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) throw new PublicError(403, '请从本页面发起请求。');
      if (req.headers['sec-fetch-site'] === 'cross-site') throw new PublicError(403, '请从本页面发起请求。');
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (req.method === 'GET' && url.pathname === '/api/status') {
        const config = await configLoader();
        completionURL(config.baseURL);
        return sendJSON(res, 200, { configured: Boolean(config.apiKey), model: config.model });
      }
      if (req.method === 'POST' && url.pathname === '/api/evaluate') {
        const config = await configLoader();
        if (!config.apiKey) throw new PublicError(503, '请先在 .env.qwen 中填写 API Key 并保存。');
        const now = Date.now();
        requests = requests.filter(time => now - time < 60000);
        if (active >= 2 || requests.length >= 12) throw new PublicError(429, '当前请求较多，请稍后再试。');
        active++; requests.push(now);
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), timeoutMs);
        const disconnect = () => { if (!res.writableEnded) abort.abort(); };
        res.on('close', disconnect);
        try {
          const bytes = await readImage(req);
          const type = (req.headers['content-type'] || '').split(';')[0];
          const result = await evaluateImage(bytes, type, config, { fetchImpl, signal: abort.signal });
          return sendJSON(res, 200, result);
        } catch (error) {
          if (abort.signal.aborted) throw new PublicError(504, '评价超时，请稍后重试。');
          throw error;
        } finally { active--; clearTimeout(timer); res.off('close', disconnect); }
      }
      if (!['GET', 'HEAD'].includes(req.method)) throw new PublicError(405, '不支持的请求方式。');
      let resource;
      try { resource = decodeURIComponent(url.pathname); } catch { throw new PublicError(400, '路径不正确。'); }
      if (resource === '/') resource = '/labs/algebra/inequality-review.html';
      // Only public front-end files are served. Configuration, server code, and directories are never exposed.
      const allowedPath = resource === '/index.html' || resource.startsWith('/assets/') || resource.startsWith('/labs/');
      if (!allowedPath || resource.split('/').some(segment => segment.startsWith('.')) || resource.includes('\\')) throw new PublicError(404, '未找到页面。');
      const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
      const mime = types[path.extname(resource)];
      if (!mime) throw new PublicError(404, '未找到页面。');
      let target;
      try {
        target = await realpath(path.join(ROOT, resource));
        const root = await realpath(ROOT);
        if (!target.startsWith(root + path.sep) || !(await stat(target)).isFile()) throw new Error('not a file');
        const canonical = path.relative(root, target);
        if ((canonical !== 'index.html' && !/^(assets|labs)\//.test(canonical)) || canonical.split(path.sep).some(segment => segment.startsWith('.')) || path.extname(target) !== path.extname(resource)) throw new Error('private target');
      } catch { throw new PublicError(404, '未找到页面。'); }
      const data = await readFile(target);
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY' });
      return res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) {
      sendJSON(res, error instanceof PublicError ? error.status : 502, { error: error instanceof PublicError ? error.message : '连接千问失败，请检查网络后重试。' });
    }
  });
  server.requestTimeout = 120000;
  server.headersTimeout = 15000;
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createReviewServer();
  const port = Number(process.env.PORT || 8767);
  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE' ? `端口 ${port} 已在使用，请打开已有页面，或设置 PORT 后重新启动。` : '启动失败，请检查运行环境。');
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => console.log(`MathRender 本机预览：http://127.0.0.1:${port}/index.html\n评价卡在网页内设置 API Key，无需评价后台。按 Ctrl+C 停止预览。`));
}
