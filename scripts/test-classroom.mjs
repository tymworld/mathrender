import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {handleClassroom, cleanupDeleted} from '../cloudflare/classroom-api.mjs';
import {encryptKeyFile, decryptKeyFile} from '../assets/js/labs/inequality-review-keyfile.mjs';

const schema = (await Promise.all(['0001_classroom.sql','0002_classroom_credentials.sql','0003_review_history.sql','0004_photo_rotation.sql'].map(name => readFile(new URL('../cloudflare/migrations/'+name,import.meta.url),'utf8')))).join('\n');
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJFoAAAAASUVORK5CYII=';
const jpeg = 'data:image/jpeg;base64,'+Buffer.from([255,216,255,224,1,2,255,217]).toString('base64');
const origin = 'https://mathrender.test';
const payload = () => ({id:crypto.randomUUID(),label:'第 3 组',image:png,thumbnail:jpeg});
function environment() {
  const db = new DatabaseSync(':memory:'); db.exec(schema);
  const objects = new Map();
  const env = {CLASSROOM_ACCESS_CODE:'test-classroom-password',CLASSROOM_SECRET:'test-only-secret-for-classroom-at-least-32-characters',
    CLASSROOM_DB:{prepare(sql) {
      const statement = db.prepare(sql); let args = [];
      return {bind(...values) { args = values; return this; }, async first() { return statement.get(...args) || null; },
        async all() { return {results:statement.all(...args)}; }, async run() { return statement.run(...args); }};
    }},
    CLASSROOM_PHOTOS:{async put(key,bytes) { objects.set(key,bytes.slice()); },async get(key) { return objects.has(key) ? {body:objects.get(key)} : null; },
      async delete(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key); }}
  };
  const request = (path, {method='GET',body,token='',headers={}}={}) => handleClassroom(new Request(origin+'/api/classroom'+path,{
    method,headers:{...(token ? {Authorization:'Bearer '+token} : {}),...(body ? {'Content-Type':'application/json'} : {}), ...headers},body:body ? JSON.stringify(body) : undefined}),env);
  return {env,db,objects,request,async login() { const result = await request('/bootstrap',{method:'POST',body:{password:env.CLASSROOM_ACCESS_CODE}}); assert.equal(result.status,200); return result.json(); }};
}

test('requires a password and signed roles, and rejects unapproved origins',async () => {
  const app = environment();
  assert.equal((await app.request('/photos')).status,401);
  assert.equal((await app.request('/bootstrap',{method:'POST',body:{password:'wrong'}})).status,401);
  const {token,uploadToken} = await app.login();
  assert.match(token,/^teacher\./); assert.match(uploadToken,/^upload\./);
  assert.equal((await app.request('/photos',{token})).status,200);
  assert.equal((await app.request('/photos',{token:token+'x'})).status,401);
  assert.equal((await app.request('/photos',{token,headers:{Origin:'https://evil.test'}})).status,403);
  app.env.CLASSROOM_ALLOWED_ORIGINS = 'https://school.test';
  const preflight = await app.request('/photos',{method:'OPTIONS',headers:{Origin:'https://school.test'}});
  assert.equal(preflight.status,204); assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),'https://school.test');
});

test('phone upload becomes visible to a separate teacher session; objects stay private',async () => {
  const app = environment(), {token,uploadToken} = await app.login();
  const body = payload();
  const saved = await app.request('/photos',{method:'POST',body,token:uploadToken});
  assert.equal(saved.status,201); assert.equal(app.objects.size,2);
  const second = await app.login();
  const list = await (await app.request('/photos',{token:second.token})).json();
  assert.equal(list.photos.length,1); assert.equal(list.photos[0].label,'第 3 组');
  assert.equal('storage_key' in list.photos[0],false); assert.equal('digest' in list.photos[0],false);
  const image = await app.request('/photos/'+body.id+'/image',{token});
  assert.equal(image.status,200); assert.equal(image.headers.get('Content-Type'),'image/png');
  assert.equal(image.headers.get('Cache-Control'),'no-store');
  assert.equal((await app.request('/photos/'+body.id+'/image')).status,401);
  assert.equal((await app.request('/photos/'+body.id+'/reviewed',{method:'POST',token:uploadToken})).status,403);
  assert.equal((await app.request('/photos/'+body.id+'/reviewed',{method:'POST',token})).status,200);
  const reviewed = await (await app.request('/photos',{token})).json(); assert.ok(reviewed.photos[0].reviewedAt);
});

test('concurrent lost-response retries save one photo and clean only their own objects',async () => {
  const app = environment(), {uploadToken} = await app.login(), body = payload();
  const results = await Promise.all(Array.from({length:3},() => app.request('/photos',{method:'POST',body,token:uploadToken})));
  assert.deepEqual(results.map(r=>r.status),[201,201,201]); assert.equal(app.objects.size,2);
  const list = await (await app.request('/photos',{token:uploadToken})).json(); assert.equal(list.photos.length,1);
  const conflict = await app.request('/photos',{method:'POST',body:{...body,image:jpeg},token:uploadToken}); assert.equal(conflict.status,409);
  assert.equal(app.objects.size,2);
});

test('delete removes originals and thumbnails; late retry cannot recreate the image',async () => {
  const app = environment(), {token,uploadToken} = await app.login(), body = payload();
  await app.request('/photos',{method:'POST',body,token:uploadToken});
  assert.equal((await app.request('/photos/'+body.id,{method:'DELETE',token:uploadToken})).status,403);
  assert.equal((await app.request('/photos/'+body.id,{method:'DELETE',token})).status,200);
  assert.equal(app.objects.size,0);
  assert.equal((await app.request('/photos/'+body.id+'/image',{token})).status,404);
  assert.equal((await app.request('/photos',{method:'POST',body,token:uploadToken})).status,410);
  assert.equal((await (await app.request('/photos',{token})).json()).photos.length,0);
});

test('photo rotation is shared, teacher-only, retry-safe and preserves original image bytes',async()=>{
  const app=environment(), {token,uploadToken}=await app.login(), body=payload();
  await app.request('/photos',{method:'POST',body,token:uploadToken});
  const path='/photos/'+body.id;
  const rotate=(from,rotation,auth=token)=>app.request(path+'/rotation',{method:'POST',body:{from,rotation},token:auth});
  assert.equal((await rotate(0,90,uploadToken)).status,403);
  assert.equal((await rotate(0,45)).status,400);
  assert.equal((await rotate(0,90)).status,200);
  assert.equal((await rotate(0,90)).status,200,'retry of the same correction is idempotent');
  assert.equal((await rotate(0,270)).status,409,'stale correction cannot overwrite a newer direction');
  const image=await app.request(path+'/image',{token:uploadToken});
  assert.equal(image.headers.get('X-Photo-Rotation'),'90');
  assert.equal(Buffer.from(await image.arrayBuffer()).toString('base64'),png.split(',')[1]);
  assert.equal((await app.request(path+'/thumbnail',{token})).headers.get('X-Photo-Rotation'),'90');
  assert.equal((await (await app.request('/photos',{token})).json()).photos[0].rotation,90);
  assert.equal((await rotate(90,0)).status,200,'correction can be reversed');
  assert.equal(app.objects.size,2,'rotation does not create new copies');
  await app.request(path,{method:'DELETE',token});
  assert.equal((await rotate(0,90)).status,404);
});

test('storage failure never publishes an incomplete photo and a retry succeeds',async () => {
  const app = environment(), {token} = await app.login(), body = payload();
  const put = app.env.CLASSROOM_PHOTOS.put; let calls = 0;
  app.env.CLASSROOM_PHOTOS.put = async (...args) => { if (++calls === 2) throw new Error('disk failed'); return put(...args); };
  assert.equal((await app.request('/photos',{method:'POST',body,token})).status,503);
  assert.equal(app.objects.size,0); assert.equal((await (await app.request('/photos',{token})).json()).photos.length,0);
  app.env.CLASSROOM_PHOTOS.put = put;
  assert.equal((await app.request('/photos',{method:'POST',body,token})).status,201);
});

test('an ambiguous D1 commit cannot cause saved images to be removed',async () => {
  const app = environment(), {token} = await app.login(), body = payload();
  const prepare = app.env.CLASSROOM_DB.prepare;
  app.env.CLASSROOM_DB.prepare = sql => {
    const statement = prepare(sql);
    if (sql.startsWith('INSERT INTO classroom_photos')) {
      const run = statement.run; statement.run = async () => { await run(); throw new Error('response lost after commit'); };
    }
    return statement;
  };
  assert.equal((await app.request('/photos',{method:'POST',body,token})).status,503);
  assert.equal(app.objects.size,2);
  assert.equal((await app.request('/photos',{method:'POST',body,token})).status,201);
  assert.equal((await app.request('/photos/'+body.id+'/image',{token})).status,200);
});

test('invalid signatures, oversized images and path traversal cannot enter storage',async () => {
  const app = environment(), {token} = await app.login();
  for (const body of [{...payload(),id:'../../secret'}, {...payload(),image:'data:image/png;base64,eHl6'}, {...payload(),label:'x'.repeat(61)},
    {...payload(),image:'data:image/jpeg;base64,'+'A'.repeat(14*1024*1024)}, {...payload(),thumbnail:png}]) {
    const result = await app.request('/photos',{method:'POST',body,token}); assert.ok([400,413,415].includes(result.status));
  }
  assert.equal(app.objects.size,0);
});

test('quota checks are enforced atomically and do not leave failed-upload objects',async () => {
  const app = environment(), {token} = await app.login();
  app.db.prepare(`INSERT INTO classroom_photos(id,label,created_at,type,bytes,digest,storage_key) VALUES ('existing','','now','image/png',1073741824,'','fixture')`).run();
  assert.equal((await app.request('/photos',{method:'POST',body:payload(),token})).status,507);
  assert.equal(app.objects.size,0);
});

test('scheduled cleanup retries R2 deletion without restoring the visible photo',async () => {
  const app = environment(), {token} = await app.login(), body = payload();
  await app.request('/photos',{method:'POST',body,token});
  const remove = app.env.CLASSROOM_PHOTOS.delete; app.env.CLASSROOM_PHOTOS.delete = async () => {throw new Error('offline');};
  assert.equal((await app.request('/photos/'+body.id,{method:'DELETE',token})).status,503);
  assert.equal((await (await app.request('/photos',{token})).json()).photos.length,0);
  app.env.CLASSROOM_PHOTOS.delete = remove; await cleanupDeleted(app.env); assert.equal(app.objects.size,0);
});

test('login attempts are rate limited and tokens expire',async () => {
  const app = environment(), {token} = await app.login();
  for (let i=0;i<9;i++) await app.request('/bootstrap',{method:'POST',body:{password:'wrong'}});
  assert.equal((await app.request('/bootstrap',{method:'POST',body:{password:'wrong'}})).status,429);
  const now = Date.now; Date.now = () => now()+13*3600*1000;
  try { assert.equal((await app.request('/photos',{token})).status,401); } finally { Date.now = now; }
});

test('existing AI password initializes unified credentials once; password change revokes both roles without losing photos',async () => {
  const app = environment();
  const key = 'sk-unified-fixture-only', password = 'existing-ai-password', next = 'my-new-classroom-password';
  const proof = Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('mathrender-classroom-initialize-v1:'+key))).toString('hex');
  const keyFile = await encryptKeyFile(key,'https://example.com/chat/completions',password);
  app.env.CLASSROOM_UNIFIED_PROOF = proof;
  const post = (path,body,token) => app.request(path,{method:'POST',body,token});
  assert.equal((await post('/initialize',{password,proof:'wrong',keyFile})).status,401);
  assert.deepEqual(await (await post('/bootstrap',{password})).json(),{setupRequired:true});
  const initialized = await post('/initialize',{password,proof,keyFile}); assert.equal(initialized.status,200);
  const first = await initialized.json();
  assert.equal(await decryptKeyFile(first.keyFile,password),key);
  assert.equal((await post('/initialize',{password,proof,keyFile})).status,409);
  const work = payload(); assert.equal((await post('/photos',work,first.uploadToken)).status,201);
  assert.equal((await post('/password',{},first.uploadToken)).status,403);
  const newKeyFile = await encryptKeyFile(key,keyFile.endpoint,next);
  assert.equal((await post('/password',{currentPassword:'wrong',newPassword:next,keyFile:newKeyFile},first.token)).status,401);
  const changed = await post('/password',{currentPassword:password,newPassword:next,keyFile:newKeyFile},first.token);
  assert.equal(changed.status,200); const second = await changed.json();
  assert.equal((await app.request('/photos',{token:first.token})).status,401);
  assert.equal((await post('/photos',payload(),first.uploadToken)).status,401);
  assert.equal((await app.request('/photos',{token:second.token})).status,200);
  const photos = await (await app.request('/photos',{token:second.token})).json(); assert.equal(photos.photos[0].id,work.id);
  assert.equal(await decryptKeyFile(second.keyFile,next),key);
  await assert.rejects(decryptKeyFile(second.keyFile,password));
  const record = app.db.prepare('SELECT * FROM classroom_credentials').get();
  assert.ok(!JSON.stringify(record).includes(next)); assert.ok(!JSON.stringify(record).includes(key));
  app.db.exec('DELETE FROM classroom_limits');
  assert.equal((await post('/bootstrap',{password})).status,401);
  assert.equal((await post('/bootstrap',{password:app.env.CLASSROOM_ACCESS_CODE})).status,401);
  assert.equal((await post('/bootstrap',{password:next})).status,200);
});

test('concurrent password edits have one winner and reject malformed replacement configuration',async () => {
  const app = environment(), password = 'current-password';
  app.env.CLASSROOM_UNIFIED_PROOF = 'a'.repeat(64);
  const keyFile = await encryptKeyFile('sk-test','https://example.com/chat/completions',password);
  const first = await (await app.request('/initialize',{method:'POST',body:{password,proof:app.env.CLASSROOM_UNIFIED_PROOF,keyFile}})).json();
  const body = {currentPassword:password,newPassword:'replacement-password',keyFile};
  assert.equal((await app.request('/password',{method:'POST',body:{...body,keyFile:{}},token:first.token})).status,400);
  const results = await Promise.all([1,2].map(() => app.request('/password',{method:'POST',body,token:first.token})));
  assert.equal(results.filter(r => r.status === 200).length,1);
  assert.ok(results.some(r => [401,409].includes(r.status)));
});

const reviewPayload = (createdAt = new Date().toISOString()) => ({entry:{id:'card-'+crypto.randomUUID(),createdAt,model:'qwen3.8-max',promptVersion:'math-check-v2',promptTitle:'数学核验',result:{status:'valid',formula:'|a+b|≤|a|+|b|',verdict:'结论正确。',scientific:{grade:'A',comment:'恒成立。'},rigor:{grade:'A',comment:'推导完整。'},creativity:{grade:'B',comment:'有效变式。'},highlight:'代换清楚。',suggestion:'可尝试推广。'}},image:png});

test('cloud history is teacher-only, independently retains the image, and retries are idempotent',async () => {
  const app=environment(), first=await app.login(), body=reviewPayload();
  assert.equal((await app.request('/history')).status,401);
  for(const method of ['GET','POST']) assert.equal((await app.request('/history',{method,body:method==='POST'?body:undefined,token:first.uploadToken})).status,403);
  const results=await Promise.all([1,2].map(()=>app.request('/history',{method:'POST',body,token:first.token})));
  assert.deepEqual(results.map(r=>r.status),[201,201]); assert.equal(app.objects.size,1);
  const second=await app.login();
  const list=await (await app.request('/history',{token:second.token})).json();
  assert.equal(list.total,1); assert.deepEqual(list.entries,[body.entry]);
  assert.equal((await app.request('/history/'+body.entry.id+'/image',{token:second.token})).status,200);
  assert.equal((await app.request('/history/'+body.entry.id+'/image',{token:first.uploadToken})).status,403);
  const album=payload(); await app.request('/photos',{method:'POST',body:album,token:first.token});
  await app.request('/photos/'+album.id,{method:'DELETE',token:first.token});
  assert.equal((await app.request('/history/'+body.entry.id+'/image',{token:second.token})).status,200);
  assert.equal((await app.request('/history',{method:'POST',body:{...body,entry:{...body.entry,model:'another-model'}},token:first.token})).status,409);
});

test('history pagination follows evaluation time, clear preserves later saves, and deletion cannot resurrect on sync',async () => {
  const app=environment(),{token}=await app.login();
  const values=[];
  for(let i=0;i<25;i++) {
    const body=reviewPayload(new Date(Date.UTC(2026,9,1+(i%4),0,i)).toISOString()); values.push(body);
    assert.equal((await app.request('/history',{method:'POST',body,token})).status,201);
  }
  const first=await (await app.request('/history',{token})).json(); assert.equal(first.entries.length,20); assert.equal(first.total,25);
  const second=await (await app.request('/history?before='+encodeURIComponent(first.nextCursor),{token})).json(); assert.equal(second.entries.length,5); assert.equal(second.nextCursor,null);
  const ordered=[...first.entries,...second.entries]; assert.equal(new Set(ordered.map(x=>x.id)).size,25);
  assert.deepEqual(ordered.map(x=>x.createdAt),values.map(x=>x.entry.createdAt).sort().reverse());
  const newer=reviewPayload(); await app.request('/history',{method:'POST',body:newer,token});
  assert.equal((await app.request('/history/clear',{method:'POST',body:{through:first.latest},token})).status,200);
  const remaining=await (await app.request('/history',{token})).json(); assert.deepEqual(remaining.entries,[newer.entry]);
  assert.equal(app.objects.size,1);
  assert.equal((await app.request('/history',{method:'POST',body:values[0],token})).status,410);
  assert.equal((await app.request('/history/'+newer.entry.id,{method:'DELETE',token})).status,200);
  assert.equal((await app.request('/history/'+newer.entry.id+'/image',{token})).status,404);
  assert.equal(app.objects.size,0);
});

test('cloud history saves the card even when an older local record has no image, and rejects unsafe input',async () => {
  const app=environment(),{token}=await app.login(),body=reviewPayload(); body.image=null; body.entry.apiKey='never-store';
  assert.equal((await app.request('/history',{method:'POST',body,token})).status,201);
  const list=await (await app.request('/history',{token})).json(); assert.equal(list.entries[0].apiKey,undefined);
  assert.equal((await app.request('/history/'+body.entry.id+'/image',{token})).status,404);
  assert.equal(app.objects.size,0);
  for(const bad of [{...reviewPayload(),entry:{...body.entry,id:'../escape'}},{...reviewPayload(),image:'data:image/png;base64,eHl6'}]) {
    assert.ok([400,415].includes((await app.request('/history',{method:'POST',body:bad,token})).status));
  }
});

test('history storage failures preserve saved data and use the shared photo quota',async () => {
  const app=environment(),{token}=await app.login(),body=reviewPayload();
  const prepare=app.env.CLASSROOM_DB.prepare;
  app.env.CLASSROOM_DB.prepare=sql=>{const statement=prepare(sql); if(sql.startsWith('INSERT INTO classroom_reviews')) { const run=statement.run; statement.run=async()=>{await run();throw new Error('response lost');}; } return statement;};
  assert.equal((await app.request('/history',{method:'POST',body,token})).status,503); assert.equal(app.objects.size,1);
  app.env.CLASSROOM_DB.prepare=prepare;
  assert.equal((await app.request('/history',{method:'POST',body,token})).status,201);
  const remove=app.env.CLASSROOM_PHOTOS.delete; app.env.CLASSROOM_PHOTOS.delete=async()=>{throw new Error('unavailable');};
  assert.equal((await app.request('/history/'+body.entry.id,{method:'DELETE',token})).status,503);
  assert.equal((await (await app.request('/history',{token})).json()).total,0);
  app.env.CLASSROOM_PHOTOS.delete=remove; await cleanupDeleted(app.env); assert.equal(app.objects.size,0);
  app.db.prepare("INSERT INTO classroom_reviews (id,created_at,entry_json,type,bytes,digest,storage_key) VALUES ('quota','now','{}','',1073741824,'','')").run();
  assert.equal((await app.request('/history',{method:'POST',body:reviewPayload(),token})).status,507);
  assert.equal((await app.request('/photos',{method:'POST',body:payload(),token})).status,507);
});
