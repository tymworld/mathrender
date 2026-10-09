// Pictures stay in a private R2 bucket; D1 publishes a photo only after
// both image writes succeed.
const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_BODY = 15 * 1024 * 1024;
const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const encoder = new TextEncoder();
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const json = (value, status = 200) => new Response(JSON.stringify(value), {status, headers:{'Content-Type':'application/json; charset=utf-8'}});
const hex = bytes => Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2,'0')).join('');
const digest = async value => hex(await crypto.subtle.digest('SHA-256', typeof value === 'string' ? encoder.encode(value) : value));
async function mac(secret, value) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}
function equal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let mismatch = 0; for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
async function capability(env, role, lifetime) {
  const value = `${role}.${Math.floor(Date.now()/1000) + lifetime}`;
  return value + '.' + await mac(env.CLASSROOM_SECRET, value);
}
async function authorize(request, env) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '') || '';
  const match = /^(teacher|upload)\.(\d{10})\.([a-f0-9]{64})$/.exec(token);
  if (!match || Number(match[2]) <= Date.now()/1000 || !equal(match[3], await mac(env.CLASSROOM_SECRET, match[1]+'.'+match[2]))) {
    throw new HttpError(401, '连接已过期或链接无效，请在电脑端重新打开相册并扫描二维码。');
  }
  return match[1];
}
async function readJSON(request, limit = MAX_BODY) {
  if (Number(request.headers.get('Content-Length')) > limit) throw new HttpError(413, '照片过大，请压缩后上传。');
  if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') throw new HttpError(415, '上传格式不正确。');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, '上传内容为空。');
  const chunks = []; let length = 0;
  while (true) {
    const {value, done} = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > limit) { await reader.cancel(); throw new HttpError(413, '照片过大，请压缩后上传。'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new HttpError(400, '上传内容不完整，请重试。'); }
}
function imageData(value, maxBytes) {
  const match = typeof value === 'string' && /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4) throw new HttpError(415, '请选择 JPG、PNG 或 WebP 图片。');
  if (match[2].length > Math.ceil(maxBytes/3)*4) throw new HttpError(413, '照片过大，请压缩后上传。');
  const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
  if (bytes.length > maxBytes) throw new HttpError(413, '照片过大，请压缩后上传。');
  const ascii = (start,end) => String.fromCharCode(...bytes.slice(start,end));
  const valid = match[1] === 'image/jpeg' ? bytes.length > 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes.at(-2) === 255 && bytes.at(-1) === 217
    : match[1] === 'image/png' ? bytes.length >= 33 && hex(bytes.slice(0,8)) === '89504e470d0a1a0a' && ascii(12,16) === 'IHDR'
      : bytes.length > 20 && ascii(0,4) === 'RIFF' && ascii(8,12) === 'WEBP';
  if (!valid) throw new HttpError(415, '图片文件不完整，请重新选择。');
  return {bytes, type:match[1]};
}
const photo = row => ({id:row.id, label:row.label || `作品 ${String(row.serial).padStart(2,'0')}`, createdAt:row.created_at, reviewedAt:row.reviewed_at, type:row.type, bytes:row.bytes});
const rowById = (env,id) => env.CLASSROOM_DB.prepare('SELECT * FROM classroom_photos WHERE id = ?').bind(id).first();
async function rateLimit(request, env, kind, maximum) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const key = kind + ':' + (await mac(env.CLASSROOM_SECRET, ip)).slice(0,32);
  const now = Math.floor(Date.now()/1000);
  const record = await env.CLASSROOM_DB.prepare(`INSERT INTO classroom_limits (key,count,reset_at) VALUES (?,1,?)
    ON CONFLICT(key) DO UPDATE SET count = CASE WHEN reset_at <= ? THEN 1 ELSE count+1 END,
    reset_at = CASE WHEN reset_at <= ? THEN ? ELSE reset_at END RETURNING count`).bind(key,now+60,now,now,now+60).first();
  if (record.count > maximum) throw new HttpError(429, '操作较频繁，请一分钟后重试。');
}

async function route(request, env, url) {
  if (!env.CLASSROOM_PHOTOS || !env.CLASSROOM_DB || !env.CLASSROOM_ACCESS_CODE || env.CLASSROOM_SECRET?.length < 32 || !env.CLASSROOM_SECRET) {
    throw new HttpError(503, '课堂相册尚未启用，请完成 Cloudflare 存储绑定与相册密码配置。');
  }
  const path = url.pathname;
  if (path === '/api/classroom/bootstrap' && request.method === 'POST') {
    const body = await readJSON(request, 4096);
    if (!body?.password) throw new HttpError(401, '请输入课堂相册密码。');
    await rateLimit(request, env, 'login', 10);
    if (!equal(await digest(String(body.password)), await digest(env.CLASSROOM_ACCESS_CODE))) throw new HttpError(401, '相册密码不正确，请重试。');
    await env.CLASSROOM_DB.prepare('DELETE FROM classroom_limits WHERE reset_at < ?').bind(Math.floor(Date.now()/1000)-3600).run();
    return json({token:await capability(env,'teacher',12*3600), uploadToken:await capability(env,'upload',7*86400)});
  }
  const role = await authorize(request, env);
  const base = '/api/classroom/photos';
  if (path === base && request.method === 'GET') {
    const result = await env.CLASSROOM_DB.prepare('SELECT * FROM classroom_photos WHERE deleted_at IS NULL ORDER BY serial DESC LIMIT 1000').all();
    return json({photos:result.results.map(photo)});
  }
  if (path === base && request.method === 'POST') {
    await rateLimit(request, env, 'upload', 40);
    const body = await readJSON(request);
    if (!body || !ID.test(body.id) || typeof body.label !== 'string' || body.label.length > 60) throw new HttpError(400, '照片编号或备注不正确。');
    const image = imageData(body.image, MAX_IMAGE);
    const thumbnail = imageData(body.thumbnail, 160*1024);
    if (thumbnail.type !== 'image/jpeg') throw new HttpError(415, '缩略图格式不正确。');
    const hash = await digest(image.bytes);
    const existing = await rowById(env, body.id);
    const checkExisting = row => {
      if (row.deleted_at) throw new HttpError(410, '这张照片已被删除。如需重新上传，请重新选择图片。');
      if (row.digest !== hash) throw new HttpError(409, '这次上传的编号已被使用，请重新选择照片。');
      return json({photo:photo(row)}, 201);
    };
    if (existing) return checkExisting(existing);
    // Unique object keys let simultaneous retries clean up only their own work.
    const key = 'photos/' + body.id + '/' + crypto.randomUUID();
    let published = false, commitAttempted = false;
    try {
      await env.CLASSROOM_PHOTOS.put(key+'/image', image.bytes, {httpMetadata:{contentType:image.type}});
      await env.CLASSROOM_PHOTOS.put(key+'/thumbnail', thumbnail.bytes, {httpMetadata:{contentType:'image/jpeg'}});
      const bytes = image.bytes.length + thumbnail.bytes.length;
      commitAttempted = true;
      await env.CLASSROOM_DB.prepare(`INSERT INTO classroom_photos (id,label,created_at,type,bytes,digest,storage_key)
        SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM classroom_photos WHERE deleted_at IS NULL) < 1000
        AND (SELECT COALESCE(SUM(bytes),0) FROM classroom_photos WHERE deleted_at IS NULL) + ? <= 1073741824
        ON CONFLICT(id) DO NOTHING`).bind(body.id, body.label.trim().replace(/[\u0000-\u001f]/g,''),new Date().toISOString(),image.type,bytes,hash,key,bytes).run();
      const saved = await rowById(env, body.id);
      if (!saved) throw new HttpError(507, '课堂相册已满，请在电脑端删除不需要的照片后重试。');
      published = saved.storage_key === key;
      return checkExisting(saved);
    } finally {
      // A transport failure can happen AFTER D1 committed. Recheck ownership;
      // if D1 is still unreachable, retain the objects rather than break a row.
      let safeToClean = !commitAttempted;
      if (!published && commitAttempted) {
        try { safeToClean = (await rowById(env,body.id))?.storage_key !== key; } catch {}
      }
      if (!published && safeToClean) await env.CLASSROOM_PHOTOS.delete([key+'/image',key+'/thumbnail']).catch(() => {});
    }
  }
  const match = /^\/api\/classroom\/photos\/([^/]+)(?:\/(image|thumbnail|reviewed))?$/.exec(path);
  if (!match || !ID.test(match[1])) throw new HttpError(404, '未找到这张照片。');
  const [,id, action] = match;
  const row = await rowById(env,id);
  if (!row || (row.deleted_at && request.method !== 'DELETE')) throw new HttpError(404, '这张照片已被删除，请刷新相册。');
  if (request.method === 'GET' && ['image','thumbnail'].includes(action)) {
    const object = await env.CLASSROOM_PHOTOS.get(row.storage_key+'/'+action);
    if (!object) throw new HttpError(404, '照片文件不可用，请重新上传。');
    return new Response(object.body, {headers:{'Content-Type':action === 'thumbnail' ? 'image/jpeg' : row.type}});
  }
  if (role !== 'teacher') throw new HttpError(403, '请在电脑端管理课堂照片。');
  if (request.method === 'POST' && action === 'reviewed') {
    await env.CLASSROOM_DB.prepare('UPDATE classroom_photos SET reviewed_at = ? WHERE id = ? AND deleted_at IS NULL').bind(new Date().toISOString(),id).run();
    return json({ok:true});
  }
  if (request.method === 'DELETE' && !action) {
    // Keep a tombstone so a late retry cannot recreate a deleted photo.
    await env.CLASSROOM_DB.prepare('UPDATE classroom_photos SET deleted_at = COALESCE(deleted_at,?) WHERE id = ?').bind(new Date().toISOString(),id).run();
    if (row.storage_key) await env.CLASSROOM_PHOTOS.delete([row.storage_key+'/image',row.storage_key+'/thumbnail']);
    await env.CLASSROOM_DB.prepare("UPDATE classroom_photos SET storage_key = '' WHERE id = ? AND deleted_at IS NOT NULL").bind(id).run();
    return json({ok:true});
  }
  throw new HttpError(405, '不支持的请求方式。');
}

export async function cleanupDeleted(env) {
  if (!env.CLASSROOM_DB || !env.CLASSROOM_PHOTOS) return;
  const {results} = await env.CLASSROOM_DB.prepare("SELECT id,storage_key FROM classroom_photos WHERE deleted_at IS NOT NULL AND storage_key <> '' LIMIT 10").all();
  for (const row of results) {
    await env.CLASSROOM_PHOTOS.delete([row.storage_key+'/image',row.storage_key+'/thumbnail']);
    await env.CLASSROOM_DB.prepare("UPDATE classroom_photos SET storage_key = '' WHERE id = ? AND deleted_at IS NOT NULL").bind(row.id).run();
  }
  await env.CLASSROOM_DB.prepare('DELETE FROM classroom_limits WHERE reset_at < ?').bind(Math.floor(Date.now()/1000)-3600).run();
}

export async function handleClassroom(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const allowed = [url.origin, ...(env.CLASSROOM_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)];
  let response;
  try {
    if (origin && !allowed.includes(origin)) throw new HttpError(403, '请从已配置的网站发起请求。');
    if (request.headers.get('Sec-Fetch-Site') === 'cross-site' && !origin) throw new HttpError(403, '请从课堂页面发起请求。');
    if (request.method === 'OPTIONS') response = new Response(null, {status:204});
    else response = await route(request, env, url);
  } catch (error) {
    response = json({error:error instanceof HttpError ? error.message : '课堂相册暂时不可用，请稍后重试。'}, error instanceof HttpError ? error.status : 503);
  }
  response.headers.set('Cache-Control','no-store');
  response.headers.set('X-Content-Type-Options','nosniff');
  response.headers.set('Referrer-Policy','no-referrer');
  if (origin && allowed.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin',origin); response.headers.set('Vary','Origin');
    response.headers.set('Access-Control-Allow-Methods','GET, POST, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers','Authorization, Content-Type');
  }
  return response;
}
