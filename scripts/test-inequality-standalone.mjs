import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {encryptKeyFile, decryptKeyFile, parseKeyFile, KEY_FILE_NAME} from '../assets/js/labs/inequality-review-keyfile.mjs';
import { readFile } from 'node:fs/promises';
import { buildStandalone } from './build-inequality-standalone.mjs';
import { EVALUATION_PROMPT, RECOGNITION_PROMPT } from '../assets/js/labs/inequality-review-protocol.mjs';
import { PROMPT_VERSIONS, DEFAULT_PROMPT_VERSION, RESPONSE_CONTRACT } from '../assets/js/labs/inequality-review-prompts.mjs';
import { QWEN_VISION_MODELS, DEFAULT_QWEN_MODEL, QWEN_MODELS_CHECKED_ON } from '../assets/js/labs/inequality-review-models.mjs';

const artifact = await buildStandalone();
const html = await readFile(artifact.outputPath, 'utf8');
const scripts = [...html.matchAll(/<script>\s*([\s\S]*?)<\/script>/g)].map(match => match[1]);
const picture = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJFoAAAAASUVORK5CYII=', 'base64'));
const file = () => new File([picture], 'classroom.png', { type: 'image/png' });
const fixture = () => ({
  status: 'needs_revision', formula: '|2x−1|+|x+2|≥|3x+1|', verdict: '取等条件需要补充。',
  scientific: { grade: 'A', comment: '主结论可由三角不等式证明。' },
  rigor: { grade: 'C', comment: '取等条件遗漏 x≤−2。' },
  creativity: { grade: 'C', comment: '完成了对母式的代换。' },
  highlight: '正确代换母式。', suggestion: '补充 x≤−2 的取等情形。', total: 999
});
const providerReply = value => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] }));
const demoKey = 'sk-unit-test-only-do-not-use';
const transcription = () => ({status:'readable', formula:fixture().formula, reasoning:'', issue:''});

// Settings tests mock transcription automatically; pass null to test both API requests.
function harness(fetchImpl = async () => providerReply(fixture()), stored = new Map(), denyStorage = false, mockTranscription = transcription(), location = {protocol:'file:',href:'file:///test/inequality-review.html'}, embeddedKeyFile = null, classroomClient = null) {
  const elements = new Map();
  const events = new Map();
  const node = id => {
    if (elements.has(id)) return elements.get(id);
    const handlers = new Map();
    const attrs = new Map();
    const element = {
      value: '', textContent: '', hidden: ['result-screen','message'].includes(id), disabled: false, open: false,
      dataset: {}, style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {} },
      addEventListener(name, handler) { handlers.set(name, handler); },
      dispatch(name, event = {}) { return handlers.get(name)?.({ preventDefault() {}, ...event }); },
      setAttribute(name, value) { attrs.set(name, value); },
      getAttribute(name) { return attrs.get(name); }, removeAttribute(name) { attrs.delete(name); },
      focus() {}, showModal() { this.open = true; }, close() { this.open = false; this.dispatch('close'); },
      getBoundingClientRect() { return { height: 500 }; }, querySelectorAll() { return []; }
    };
    elements.set(id, element);
    return element;
  };
  for (const match of html.matchAll(/\bid="([^"]+)"/g)) node(match[1]);
  for (const dimension of ['scientific', 'rigor', 'creativity']) node(dimension+'-grade').parentElement = node(dimension+'-badge');
  const win = {
    innerWidth: 1280, innerHeight: 720, scrollTo() {}, location,
    localStorage: { getItem(key) { if (denyStorage) throw new Error("blocked"); return stored.get(key) ?? null; }, setItem(key, value) { if (denyStorage) throw new Error("blocked"); stored.set(key,value); } },
    addEventListener(name, callback) { if (!events.has(name)) events.set(name, []); events.get(name).push(callback); }
  };
  const context = vm.createContext({
    window: win, document: { getElementById: node, querySelector: node, body: node('body') },
    getComputedStyle: () => ({paddingTop:'0',paddingBottom:'0'}),
    requestAnimationFrame: callback => {callback(); return 1;}, cancelAnimationFrame() {},
    URL: class extends URL { static createObjectURL() { return 'blob:test-picture'; } static revokeObjectURL() {} },
    Image: class { async decode() {} },
    TextDecoder, TextEncoder, Uint8Array, DOMException, AbortController, Blob, setTimeout, clearTimeout, crypto: webcrypto, atob,
    btoa: value => Buffer.from(value, 'binary').toString('base64'),
    fetch: (url, options) => mockTranscription && options?.body && JSON.parse(options.body).messages[0].content[0].text === RECOGNITION_PROMPT
      ? providerReply(mockTranscription) : fetchImpl(url, options)
  });
  // Never use the teacher's actual encrypted key in fixtures; exercise the same bundled code.
  for (const script of scripts) vm.runInContext(script.replace(/^const EMBEDDED_KEY_FILE = .*;$/m,
    () => `const EMBEDDED_KEY_FILE = ${JSON.stringify(embeddedKeyFile)};`), context);
  // Isolate direct AI tests from the cloud service; unified-auth cases inject it.
  win.ClassroomPhotos = classroomClient;
  win.inequalityClassroom = {acceptSession() {}, disconnect() {}};
  return {
    node, stored, api: win.inequalityReviewAPI,
    async submitKey(key = demoKey) { node('api-settings').showModal(); node('api-key').value = key; await node('api-settings-form').dispatch('submit'); },
    emit(name) { events.get(name)?.forEach(callback => callback()); }
  };
}

test('single HTML embeds styles, executable scripts, and both illustrations', () => {
  assert.equal(scripts.length, 2);
  scripts.forEach(script => new vm.Script(script));
  assert.equal([...html.matchAll(/src="data:image\/png;base64,/g)].length, 2);
  assert.doesNotMatch(html, /<(?:script|link)\b[^>]*(?:src|href)=/);
  assert.doesNotMatch(html, /src="\.\.\//);
  assert.match(html, /href="\.\.\/\.\.\/index.html#algebra"/);
  assert.ok(artifact.outputPath.endsWith("labs/algebra/inequality-review.html"));
  assert.doesNotMatch(scripts[0], /sessionStorage|indexedDB|document\.cookie/);
  assert.doesNotMatch(scripts[1], /sessionStorage|document\.cookie/);
  assert.equal(harness().node('api-prompt').value, PROMPT_VERSIONS[0].prompt);
  assert.ok(html.includes(RESPONSE_CONTRACT));
  assert.ok(artifact.bytes < 6 * 1024 * 1024);
});

test('opening the standalone page keeps settings closed and makes no AI requests', () => {
  let calls = 0;
  const app = harness(async () => { calls++; throw new Error('must not fetch at startup'); });
  assert.equal(calls, 0);
  assert.equal(app.api.configured, false);
  assert.equal(app.node('api-settings').open, false);
  assert.equal(app.node('connection-label').textContent, 'AI 设置 · 待配置');
});

test('key exists only in this page session; input clears after use, dismissal and pagehide', async () => {
  const app = harness();
  await app.submitKey();
  assert.equal(app.api.configured, true);
  assert.equal(app.node('api-key').value, '');
  assert.equal(app.node('api-settings').open, false);
  app.api.configure();
  app.node('api-key').value = 'unfinished';
  app.node('close-api-settings').dispatch('click');
  assert.equal(app.node('api-key').value, '');
  app.node('clear-api-key').dispatch('click');
  assert.equal(app.api.configured, false);
  await app.submitKey();
  app.emit('pagehide');
  assert.equal(app.api.configured, false);
  assert.equal(app.node('api-key').value, '');
  assert.equal(harness().api.configured, false);
});

test('settings can be saved without a key, while generation still requires one', async () => {
  const app = harness(async () => { throw new Error('must not call'); });
  for (const input of ['', ' \u200b\n\t', 'Bearer ', '“”']) {
    app.api.configure(); await app.submitKey(input);
    assert.equal(app.api.configured, false);
    assert.equal(app.node('api-settings').open, false);
    await assert.rejects(app.api.evaluate(file()), /AI 设置/);
  }
});

test('characters unsafe for authorization headers are rejected', async () => {
  const app = harness();
  for (const input of ['sk-abc\u0000def', '含中文的密钥']) {
    await app.submitKey(input);
    assert.equal(app.api.configured, false);
    assert.equal(app.node('api-settings').open, true);
    assert.match(app.node('api-settings-message').textContent, /特殊字符/);
  }
});

test('pasted whitespace, invisible characters and common wrappers preserve the intended key', async () => {
  for (const input of [
    `  ${demoKey}\n`, `\u200B${demoKey}\u2060`, demoKey.replace('test', '\u200Dtest'),
    `"${demoKey}"`, `‘${demoKey}’`, `Bearer ${demoKey}`,
    `DASHSCOPE_API_KEY="${demoKey}"`, `Bearer "${demoKey}"`, demoKey.replace('test', '\n test')
  ]) {
    let authorization;
    const app = harness(async (_url, options) => {
      authorization = options.headers.Authorization;
      return providerReply(fixture());
    });
    await app.submitKey(input);
    assert.equal(app.api.configured, true);
    assert.equal(app.node('api-key').value, '');
    await app.api.evaluate(file());
    assert.equal(authorization, `Bearer ${demoKey}`);
  }
});

test('client does not invent prefix, length or character-set requirements for opaque keys', async () => {
  for (const token of ['opaque-test-token', 'sk-x', 'sk-test.with+printable/characters=']) {
    let calls = 0;
    const app = harness(async (_url, options) => {
      calls++;
      assert.equal(options.headers.Authorization, `Bearer ${token}`);
      return new Response('unauthorized', {status:401});
    });
    await app.submitKey(token);
    assert.equal(app.api.configured, true);
    await assert.rejects(app.api.evaluate(file()), /验证失败/);
    assert.equal(calls, 1);
  }
});

test('browser separates image transcription from grading and renders the fixed original', async () => {
  let calls = 0;
  const original = {...transcription(), formula:'|a−1|+|a−2|≥|2a−3|\n当且仅当 (a−1)(a−2)≥0 时等号成立'};
  const app = harness(async (url, options) => {
    calls++;
    assert.equal(url, 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
    assert.equal(options.headers.Authorization, `Bearer ${demoKey}`);
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    assert.equal(options.mode, 'cors');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'qwen3.5-plus');
    assert.equal(body.enable_thinking, false);
    const content = body.messages[0].content;
    if (calls === 1) {
      assert.equal(content[0].text, RECOGNITION_PROMPT);
      assert.equal(content[1].image_url.url, 'data:image/png;base64,'+Buffer.from(picture).toString('base64'));
      assert.equal(body.temperature, 0);
      return providerReply(original);
    }
    assert.equal(content[0].text, EVALUATION_PROMPT);
    assert.equal(content.some(part => part.type === 'image_url'), false);
    assert.ok(content[1].text.includes(JSON.stringify({formula:original.formula,reasoning:''})));
    // A grading reply containing a different formula must never replace the OCR original.
    return providerReply(fixture());
  }, new Map(), false, null);
  await app.submitKey();
  await app.node('photo-input').dispatch('change', {target:{files:[file()]}});
  await app.node('generate-button').dispatch('click');
  assert.equal(calls, 2);
  assert.equal(app.node('formula').textContent, original.formula);
  assert.equal(app.node('scientific-grade').textContent, 'A');
  assert.equal(app.node('api-recognition-prompt').textContent, RECOGNITION_PROMPT);
});

test('invalid images and oversized files are rejected before any network call', async () => {
  const app = harness(async () => { throw new Error('must not call'); }, new Map(), false, null);
  await app.submitKey();
  await assert.rejects(app.api.evaluate(new File(['wrong'], 'fake.png', {type:'image/png'})), /有效/);
  await assert.rejects(app.api.evaluate(new File([new Uint8Array(10*1024*1024+1)], 'big.png', {type:'image/png'})), /10 MB/);
});

test('provider errors are sanitized; timeout and network failures remain actionable', async () => {
  for (const status of [400,401,402,403,404,429,500]) {
    const app = harness(async () => new Response(`error containing ${demoKey}`, {status}));
    await app.submitKey();
    await assert.rejects(app.api.evaluate(file()), error => !error.message.includes(demoKey) && /AI|密钥/.test(error.message));
  }
  const network = harness(async () => {throw new TypeError('Failed to fetch '+demoKey);});
  await network.submitKey();
  await assert.rejects(network.api.evaluate(file()), /网络/);
  const abort = new AbortController(); abort.abort();
  await assert.rejects(network.api.evaluate(file(),{signal:abort.signal}), {name:'AbortError'});
});

test('partial, oversized and invalid model replies are rejected; uncertainty has no grades', async () => {
  for (const response of [new Response('not json'), new Response('x'.repeat(512*1024+1)),
    new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:'{}'}}]})),
    providerReply({...fixture(), scientific:{grade:99,comment:'invalid'}})]) {
    const app = harness(async () => response);
    await app.submitKey();
    await assert.rejects(app.api.evaluate(file()), /重新生成/);
  }
  const app = harness(async () => providerReply({...fixture(),status:'insufficient_information'}));
  await app.submitKey();
  const value = await app.api.evaluate(file());
  assert.equal(value.scientific.grade, null);
  assert.equal(value.rigor.grade, null);
});

test('select, generate, render and restart use direct API without adding a loading message', async () => {
  let resolveReply;
  const app = harness(() => new Promise(resolve => {resolveReply=resolve;}));
  app.node('api-model').value = 'qwen3.7-flash';
  await app.submitKey();
  await app.node('photo-input').dispatch('change', { target:{files:[file()]} });
  const generation = app.node('generate-button').dispatch('click');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.node('generate-label').textContent, '正在采用 qwen3.7-flash AI模型评价');
  assert.equal(app.node('message').hidden, true);
  assert.equal(app.node('connection-label').disabled, true);
  resolveReply(providerReply(fixture()));
  await generation;
  assert.equal(app.node('result-screen').hidden, false);
  assert.equal(app.node('scientific-grade').textContent, 'A');
  assert.equal(app.node('rigor-grade').textContent, 'C');
  assert.equal(app.node('connection-label').disabled, false);
  app.node('restart-button').dispatch('click');
  assert.equal(app.node('result-screen').hidden, true);
  assert.equal(app.node('upload-screen').hidden, false);
  assert.equal(app.node('generate-button').disabled, true);
  assert.equal(app.api.configured, true);
});

const storageKey = 'mathrender-inequality-ai-settings-v1';
const defaultPrompt = EVALUATION_PROMPT.slice(0, EVALUATION_PROMPT.indexOf('只返回一个JSON对象')).trimEnd();
const contract = EVALUATION_PROMPT.slice(EVALUATION_PROMPT.indexOf('只返回一个JSON对象'));
const previousDefaults = JSON.parse(await readFile(new URL('../assets/js/labs/inequality-review-prompt-history.json', import.meta.url), 'utf8'));

test('old built-in text preferences upgrade to the recommended version while preserving other settings', async () => {
  for (const prompt of [...PROMPT_VERSIONS.map(preset => preset.prompt), ...previousDefaults]) {
    const preferences = {version:1,model:'qwen3.8-flash',prompt,temperature:0.3,maxTokens:3200,
      endpoint:'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'};
    const stored = new Map([[storageKey, JSON.stringify(preferences)]]);
    let sent;
    const app = harness(async (_url, request) => { sent = JSON.parse(request.body); return providerReply(fixture()); }, stored);
    assert.equal(app.node('api-prompt-version').value, DEFAULT_PROMPT_VERSION);
    assert.equal(app.node('api-prompt').value, defaultPrompt);
    assert.equal(app.node('api-model').value, preferences.model);
    await app.submitKey(); await app.api.evaluate(file());
    assert.equal(sent.messages[0].content[0].text, EVALUATION_PROMPT);
    assert.equal(sent.temperature, 0.3);
    assert.equal(sent.max_tokens, 3200);
    const saved = JSON.parse(stored.get(storageKey));
    assert.equal(saved.version, 2);
    assert.equal(saved.promptVersion, DEFAULT_PROMPT_VERSION);
    assert.ok(!('prompt' in saved));
  }
});

test('a past teacher edit survives as a read-only historical option across version changes', async () => {
  const custom = previousDefaults[0] + '\n教师补充：重点看取等分析。';
  const stored = new Map([[storageKey, JSON.stringify({version:1,model:'qwen3.5-plus',prompt:custom,temperature:0.1,maxTokens:2400,
    endpoint:'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'})]]);
  const app = harness(undefined, stored);
  assert.equal(app.node('api-prompt-version').value, 'legacy-local');
  assert.equal(app.node('api-prompt').value, custom);
  assert.equal(app.node('legacy-prompt-option').hidden, false);
  assert.equal(app.node('legacy-prompt-option').disabled, false);
  app.node('api-prompt-version').value = DEFAULT_PROMPT_VERSION;
  app.node('api-prompt-version').dispatch('change'); await app.submitKey('');
  const reopened = harness(undefined, stored);
  assert.equal(reopened.node('api-prompt-version').value, DEFAULT_PROMPT_VERSION);
  reopened.node('api-prompt-version').value = 'legacy-local';
  reopened.node('api-prompt-version').dispatch('change');
  assert.equal(reopened.node('api-prompt').value, custom);
});

test('the original twelve rubric clauses are retained verbatim', () => {
  const original = previousDefaults[0].split('【正式评价标准】')[1].split('【执行量表时的判定规则】')[0].trim();
  for (const {prompt} of PROMPT_VERSIONS) {
    const updated = prompt.split('\n【正式评价标准】\n')[1].split('【量表边界与证据要求】')[0].trim();
    assert.equal(updated, original);
    assert.equal(updated.match(/^[ABCD]：/gm).length, 12);
  }
});

test('every revised built-in uses the transcription input and the same grading boundaries', () => {
  const boundaries = prompt => prompt.split('【量表边界与证据要求】')[1].split('【数学核验】')[0].trim();
  assert.equal(boundaries(PROMPT_VERSIONS[0].prompt), boundaries(PROMPT_VERSIONS[1].prompt));
  for (const {prompt} of PROMPT_VERSIONS) {
    assert.ok(prompt.startsWith('你是高中数学课堂的辅助评价教师。请依据本次请求中下文【正式评价标准】'));
    assert.doesNotMatch(prompt, /《活动2记录单与评价量表》|仔细识别实际图片|formula 只转写|在formula中保留|先辨明手写/);
    assert.match(prompt, /独立识别阶段提供的 JSON/);
  }
});

test('saved built-in version choices resolve to revised text, not archived text', () => {
  for (const preset of PROMPT_VERSIONS) {
    const saved = {version:2,model:DEFAULT_QWEN_MODEL,promptVersion:preset.id,temperature:0.1,maxTokens:2400,
      endpoint:'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'};
    const app = harness(undefined, new Map([[storageKey, JSON.stringify(saved)]]));
    assert.equal(app.node('api-prompt-version').value, preset.id);
    assert.equal(app.node('api-prompt').value, preset.prompt);
    assert.equal(app.node('legacy-prompt-option').hidden, true);
  }
});

test('archived built-in text saved as legacy does not remain an outdated selectable prompt', () => {
  for (const prompt of previousDefaults) {
    const saved = {version:2,model:DEFAULT_QWEN_MODEL,promptVersion:'legacy-local',legacyPrompt:prompt,temperature:0.1,maxTokens:2400,
      endpoint:'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'};
    const app = harness(undefined, new Map([[storageKey, JSON.stringify(saved)]]));
    assert.equal(app.node('api-prompt-version').value, DEFAULT_PROMPT_VERSION);
    assert.equal(app.node('api-prompt').value, defaultPrompt);
    assert.equal(app.node('legacy-prompt-option').hidden, true);
    assert.match(app.node('api-settings-message').textContent, /旧内置 Prompt/);
  }
});

test('grade decorations do not claim correct equality conditions are incomplete or invent a proof', async () => {
  const evaluation = {...fixture(), formula:'|a−1|+|b|≥|a+b−1|，等号当且仅当(a−1)b≥0',
    rigor:{grade:'C',comment:'取等条件正确；本次提交未展示推导。'}};
  const app = harness(async () => providerReply(evaluation));
  await app.submitKey();
  await app.node('photo-input').dispatch('change', {target:{files:[file()]}});
  await app.node('generate-button').dispatch('click');
  assert.equal(app.node('rigor-comment').textContent, evaluation.rigor.comment);
  assert.doesNotMatch(app.node('rigor-note').textContent, /取等情形要全|等号条件错误/);
  assert.doesNotMatch(app.node('scientific-note').textContent, /推理|推导/);
});

test('selected model, prompt version and parameters are actually used; only preferences persist', async () => {
  let request;
  const app = harness(async (url, options) => { request = {url, options, body: JSON.parse(options.body)}; return providerReply(fixture()); });
  app.node('api-model').value = 'qwen3.8-flash';
  app.node('api-endpoint').value = 'https://vision.example.test/v1/chat/completions';
  app.node('api-prompt-version').value = 'rubric-v1';
  app.node('api-prompt-version').dispatch('change');
  app.node('api-temperature').value = '0.3';
  app.node('api-max-tokens').value = '3200';
  await app.submitKey();
  await app.api.evaluate(file());
  assert.equal(request.url, 'https://vision.example.test/v1/chat/completions');
  assert.equal(request.body.model, 'qwen3.8-flash');
  assert.equal(request.body.temperature, 0.3);
  assert.equal(request.body.max_tokens, 3200);
  assert.ok(!('enable_thinking' in request.body));
  assert.equal(request.body.messages[0].content[0].text, PROMPT_VERSIONS.find(item => item.id === 'rubric-v1').prompt + '\n' + contract);
  const saved = JSON.parse(app.stored.get(storageKey));
  assert.deepEqual(Object.keys(saved).sort(), ['version','endpoint','model','promptVersion','temperature','maxTokens'].sort());
  assert.ok(!app.stored.get(storageKey).includes(demoKey));
  const reopened = harness(undefined, app.stored);
  assert.equal(reopened.node('api-model').value, 'qwen3.8-flash');
  assert.equal(reopened.node('api-prompt-version').value, saved.promptVersion);
  assert.equal(reopened.node('api-prompt').value, PROMPT_VERSIONS.find(item => item.id === saved.promptVersion).prompt);
  assert.equal(reopened.api.configured, false);
  assert.equal(reopened.node('api-key').value, '');
});

test('prompt version previews are read-only, and draft selection is applied only after saving', async () => {
  assert.match(html, /<textarea[^>]*id="api-prompt"[^>]*readonly/);
  assert.ok(!html.includes('reset-api-prompt'));
  const select = html.match(/<select[^>]*id="api-prompt-version"[^>]*>([\s\S]*?)<\/select>/)?.[1];
  assert.ok(select);
  for (const preset of PROMPT_VERSIONS) assert.ok(select.includes('value="' + preset.id + '"'));
  let prompt;
  const app = harness(async (_url, options) => {prompt=JSON.parse(options.body).messages[0].content[0].text; return providerReply(fixture());});
  assert.equal(app.node('legacy-prompt-option').hidden, true);
  await app.submitKey(); app.api.configure();
  const historical = PROMPT_VERSIONS.find(item => item.id === 'rubric-v1');
  app.node('api-prompt-version').value = historical.id;
  app.node('api-prompt-version').dispatch('change');
  assert.equal(app.node('api-prompt').value, historical.prompt);
  assert.ok(app.node('prompt-version-description').textContent.includes(historical.description));
  app.node('close-api-settings').dispatch('click');
  await app.api.evaluate(file()); assert.equal(prompt, EVALUATION_PROMPT);
  app.api.configure(); assert.equal(app.node('api-prompt-version').value, DEFAULT_PROMPT_VERSION);
  // Even an out-of-band alteration of the preview cannot change the request text.
  app.node('api-prompt').value = '不应发送的临时文字';
  await app.submitKey(''); await app.api.evaluate(file());
  assert.equal(prompt, EVALUATION_PROMPT);
  for (const preset of PROMPT_VERSIONS) {
    app.api.configure(); app.node('api-prompt-version').value = preset.id;
    app.node('api-prompt-version').dispatch('change'); await app.submitKey('');
    await app.api.evaluate(file()); assert.equal(prompt, preset.prompt + '\n' + RESPONSE_CONTRACT);
  }
});

test('changed API hosts require a fresh key instead of forwarding the current credential', async () => {
  let destination;
  const app = harness(async url => { destination=url; return providerReply(fixture()); });
  await app.submitKey(); app.api.configure();
  app.node('api-endpoint').value = 'https://other.example.test/v1/chat/completions';
  await app.submitKey('');
  assert.equal(app.node('api-settings').open, true);
  assert.match(app.node('api-settings-message').textContent, /新服务/);
  await app.api.evaluate(file()); assert.match(destination, /dashscope.aliyuncs.com/);
  await app.submitKey('new-service-test-key');
  await app.api.evaluate(file()); assert.match(destination, /other.example.test/);
});

test('invalid addresses, prompts and numeric limits cannot overwrite active settings', async () => {
  const app = harness(); await app.submitKey();
  for (const [id,value] of [
    ['api-model',''], ['api-model','model with space'], ['api-model','qwen-plus'], ['api-model','invented-vision-model'], ['api-prompt-version',''], ['api-prompt-version','not-a-version'], ['api-prompt-version','legacy-local'],
    ['api-temperature',''], ['api-temperature','3'], ['api-max-tokens','0'], ['api-max-tokens','8193'], ['api-max-tokens','800.5'],
    ['api-endpoint','http://vision.example.test/v1/chat/completions'],
    ['api-endpoint','https://user:secret@example.test/v1/chat/completions'],
    ['api-endpoint','https://example.test/v1/chat/completions?api_key=secret'],
    ['api-endpoint','https://example.test/v1']
  ]) {
    app.api.configure(); app.node(id).value=value; await app.submitKey('');
    assert.equal(app.node('api-settings').open, true, id + ': ' + value.slice(0,70));
    assert.equal(app.node('api-settings-message').dataset.error, 'true');
  }
});

test('blocked storage and corrupt saved preferences retain usable defaults', async () => {
  for (const app of [harness(undefined, new Map(), true), harness(undefined,new Map([[storageKey,'bad json']]))]) {
    assert.equal(app.node('api-model').value, 'qwen3.5-plus');
    await app.submitKey();
    assert.equal((await app.api.evaluate(file())).scientific.grade, 'A');
  }
});

test('model control is a fixed select, and every published option sends the selected ID', async () => {
  const select = html.match(/<select\b[^>]*id="api-model"[^>]*>([\s\S]*?)<\/select>/)?.[1];
  assert.ok(select);
  assert.doesNotMatch(html, /<input\b[^>]*id="api-model"/);
  const options = [...select.matchAll(/<option value="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(options, QWEN_VISION_MODELS.map(model => model.id));
  assert.equal(new Set(options).size, options.length);
  assert.ok(html.includes('核对于 ' + QWEN_MODELS_CHECKED_ON));
  let sent;
  const app = harness(async (_url, request) => { sent = JSON.parse(request.body); return providerReply(fixture()); });
  for (const model of QWEN_VISION_MODELS) {
    app.api.configure(); app.node('api-model').value = model.id;
    app.node('api-model').dispatch('change');
    assert.equal(app.node('api-model-hint').textContent, model.description);
    await app.submitKey(); await app.api.evaluate(file());
    assert.equal(sent.model, model.id);
    assert.equal(sent.enable_thinking, false);
    assert.deepEqual(sent.response_format, {type:'json_object'});
    assert.equal(sent.messages[0].content[1].type, 'text');
  }
  app.api.configure(); app.node('reset-api-connection').dispatch('click');
  assert.equal(app.node('api-model').value, DEFAULT_QWEN_MODEL);
  assert.equal(app.node('api-model-hint').textContent, QWEN_VISION_MODELS.find(model => model.id === DEFAULT_QWEN_MODEL).description);
});

test('old unsupported model IDs migrate without losing the saved rubric or other settings', async () => {
  const preferences = {version:1,model:'former-free-text-id',prompt:'老师已经修改好的完整量表',temperature:0.3,maxTokens:3200,
    endpoint:'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'};
  const stored = new Map([[storageKey,JSON.stringify(preferences)]]);
  const app = harness(undefined, stored);
  assert.equal(app.node('api-model').value, DEFAULT_QWEN_MODEL);
  assert.equal(app.node('api-prompt').value, preferences.prompt);
  assert.equal(app.node('api-temperature').value, '0.3');
  assert.equal(app.node('api-max-tokens').value, '3200');
  assert.match(app.node('api-settings-message').textContent, /已保留你原来的 Prompt/);
  await app.submitKey('');
  const saved = JSON.parse(stored.get(storageKey));
  assert.equal(saved.model, DEFAULT_QWEN_MODEL);
  assert.equal(saved.promptVersion, 'legacy-local');
  assert.equal(saved.legacyPrompt, preferences.prompt);
  assert.equal(saved.temperature, preferences.temperature);
  app.api.configure(); assert.doesNotMatch(app.node('api-settings-message').textContent, /原模型/);
});

 test('unavailable saved versions fall back without losing model or generation settings', () => {
  const preferences = {version:2,model:'qwen3.8-flash',promptVersion:'removed-version',temperature:0.4,maxTokens:3100,
    endpoint:'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'};
  const app = harness(undefined, new Map([[storageKey, JSON.stringify(preferences)]]));
  assert.equal(app.node('api-prompt-version').value, DEFAULT_PROMPT_VERSION);
  assert.equal(app.node('api-model').value, preferences.model);
  assert.equal(app.node('api-temperature').value, '0.4');
  assert.equal(app.node('api-max-tokens').value, '3100');
  assert.match(app.node('api-settings-message').textContent, /原 Prompt 版本已不可用/);
});


const siteLocation = {protocol:'https:', href:'https://classroom.example/labs/algebra/inequality-review.html'};
const keyEndpoint = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const testPassword = 'unit-test-password-only';
const encryptedFixture = await encryptKeyFile(demoKey, keyEndpoint, testPassword);
const settle = () => new Promise(resolve => setImmediate(resolve));

test('encrypted file round-trips without plaintext and authenticates password, address and ciphertext', async () => {
  const text = JSON.stringify(encryptedFixture);
  assert.ok(!text.includes(demoKey));
  assert.ok(!text.includes(testPassword));
  assert.equal(await decryptKeyFile(parseKeyFile(text), testPassword), demoKey);
  await assert.rejects(decryptKeyFile(encryptedFixture, 'wrong-password'), /密码不正确/);
  await assert.rejects(decryptKeyFile({...encryptedFixture,endpoint:'https://other.example/v1/chat/completions'}, testPassword), /密码不正确/);
  const bytes = Buffer.from(encryptedFixture.ciphertext, 'base64'); bytes[0] ^= 1;
  await assert.rejects(decryptKeyFile({...encryptedFixture,ciphertext:bytes.toString('base64')}, testPassword), /密码不正确/);
  assert.throws(() => parseKeyFile(JSON.stringify({...encryptedFixture,iterations:1})), /加密密钥/);
  assert.throws(() => parseKeyFile('x'.repeat(17*1024)), /16 KB/);
  assert.ok(!JSON.stringify(parseKeyFile(JSON.stringify({...encryptedFixture,apiKey:demoKey,password:testPassword}))).includes(demoKey));
});

test('website loads its fixed key file without a popup or AI request, then unlocks on demand', async () => {
  const calls = [];
  const app = harness(async (url, options) => {
    calls.push({url,options});
    return new Response(JSON.stringify(encryptedFixture));
  }, new Map(), false, transcription(), siteLocation);
  await settle();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, new URL(KEY_FILE_NAME, siteLocation.href).href);
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.headers, undefined);
  assert.equal(app.node('api-settings').open, false);
  assert.equal(app.node('key-unlock-dialog').open, false);
  assert.equal(app.node('connection-label').textContent, 'AI 设置 · 待解锁');
  app.api.configure();
  assert.equal(app.node('manual-key-settings').open, false);
  assert.equal(app.node('unlock-site-key').hidden, false);
  assert.match(app.node('key-file-status').textContent, /课堂密码/);
  app.node('close-api-settings').dispatch('click');
  const configured = app.api.ensureConfigured(); await settle();
  assert.equal(app.node('key-unlock-dialog').open, true);
  app.node('key-file-password').value = testPassword;
  await app.node('key-unlock-form').dispatch('submit');
  assert.equal(await configured, true);
  assert.equal(app.api.configured, true);
  assert.equal(app.node('key-file-password').value, '');
  assert.equal(app.node('key-unlock-dialog').open, false);
  assert.equal(calls.length, 1);
  assert.ok(!JSON.stringify([...app.stored]).includes(demoKey));
  assert.ok(!JSON.stringify([...app.stored]).includes(testPassword));
  app.emit('pagehide'); assert.equal(app.api.configured, false);
});

test('wrong password stays locked, cancel aborts pending unlock, and retry succeeds', async () => {
  const app = harness(async () => new Response(JSON.stringify(encryptedFixture)), new Map(), false, transcription(), siteLocation);
  const ready = app.api.ensureConfigured(); await settle();
  app.node('key-file-password').value = 'wrong-password';
  await app.node('key-unlock-form').dispatch('submit');
  assert.equal(app.api.configured, false);
  assert.equal(app.node('key-unlock-dialog').open, true);
  assert.match(app.node('key-unlock-message').textContent, /密码不正确/);
  app.node('key-file-password').value = testPassword;
  const decryption = app.node('key-unlock-form').dispatch('submit');
  app.node('cancel-key-unlock').dispatch('click');
  assert.equal(await ready, false);
  await decryption; assert.equal(app.api.configured, false);
  const retry = app.api.ensureConfigured(); await settle();
  app.node('key-file-password').value = testPassword;
  await app.node('key-unlock-form').dispatch('submit');
  assert.equal(await retry, true);
});

test('unlock continues the selected upload exactly once, using the file key and chosen model', async () => {
  let aiCalls = 0;
  const app = harness(async (url, options) => {
    if (options.method === 'GET') return new Response(JSON.stringify(encryptedFixture));
    aiCalls++;
    assert.equal(options.headers.Authorization, `Bearer ${demoKey}`);
    assert.equal(url, keyEndpoint);
    assert.equal(JSON.parse(options.body).model, 'qwen3.7-flash');
    return providerReply(fixture());
  }, new Map(), false, transcription(), siteLocation);
  await settle();
  app.node('api-model').value = 'qwen3.7-flash'; await app.submitKey('');
  await app.node('photo-input').dispatch('change', {target:{files:[file()]}});
  const first = app.node('generate-button').dispatch('click');
  const second = app.node('generate-button').dispatch('click');
  await settle();
  app.node('key-file-password').value = testPassword;
  await app.node('key-unlock-form').dispatch('submit');
  await Promise.all([first,second]);
  assert.equal(aiCalls, 1);
  assert.equal(app.node('result-screen').hidden, false);
});

test('missing or invalid website key files retain manual setup without opening dialogs at startup', async () => {
  for (const response of [new Response('',{status:404}),new Response('not json'),new Response('x'.repeat(17*1024))]) {
    const app = harness(async () => response, new Map(), false, transcription(), siteLocation);
    await settle();
    assert.equal(app.node('api-settings').open, false);
    assert.equal(app.node('key-unlock-dialog').open, false);
    assert.equal(app.node('key-file-settings').hidden, false);
    assert.match(app.node('key-file-status').textContent, /密钥文件/);
    assert.equal(await app.api.ensureConfigured(), false);
    assert.equal(app.node('api-settings').open, true);
    await app.submitKey(); assert.equal(app.api.configured, true);
  }
});


test('embedded encrypted key unlocks on file URLs and websites without configuration fetches or startup dialogs', async () => {
  for (const location of [{protocol:'file:',href:'file:///classroom/inequality-review.html'}, siteLocation]) {
    let requests = 0;
    const app = harness(async (_url, options) => {
      requests++;
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.Authorization, `Bearer ${demoKey}`);
      return providerReply(fixture());
    }, new Map(), true, transcription(), location, encryptedFixture);
    assert.equal(app.node('connection-label').textContent, 'AI 设置 · 待解锁');
    assert.equal(app.node('api-settings').open, false);
    assert.equal(app.node('key-unlock-dialog').open, false);
    assert.match(app.node('key-file-status').textContent, /课堂密码/);
    assert.equal(requests, 0);
    await app.node('photo-input').dispatch('change', {target:{files:[file()]}});
    const generation = app.node('generate-button').dispatch('click'); await settle();
    assert.equal(app.node('key-unlock-dialog').open, true);
    app.node('key-file-password').value = testPassword;
    await app.node('key-unlock-form').dispatch('submit');
    await generation;
    assert.equal(requests, 1);
    assert.equal(app.node('result-screen').hidden, false);
    assert.equal(app.node('api-key').value, '');
    assert.equal(app.node('key-file-password').value, '');
    app.emit('pagehide'); assert.equal(app.api.configured, false);
    assert.equal(app.stored.size, 0);
  }
});

test('a corrupted embedded configuration is reported without external fetch or a fabricated key', async () => {
  const app = harness(async () => assert.fail('must not fetch'), new Map(), false, transcription(), undefined, {...encryptedFixture,version:999});
  assert.equal(app.api.configured, false);
  assert.match(app.node('key-file-status').textContent, /配置无效/);
  assert.equal(app.node('api-settings').open, false);
  assert.equal(await app.api.ensureConfigured(), false);
  assert.equal(app.node('api-settings').open, true);
});


test('history storage failure never discards a completed card or reports it as saved', async () => {
  const app = harness();
  await app.submitKey();
  await app.node('photo-input').dispatch('change', {target:{files:[file()]}});
  await app.node('generate-button').dispatch('click');
  assert.equal(app.node('result-screen').hidden, false);
  assert.equal(app.node('scientific-grade').textContent, 'A');
  assert.match(app.node('history-save-note').textContent, /历史未保存/);
  assert.equal(app.node('history-save-note').hidden, false);
  assert.equal(app.node('history-save-note').dataset.error, 'true');
  assert.equal(app.node('history-button').disabled, false);
  app.node('restart-button').dispatch('click');
  assert.equal(app.node('history-save-note').hidden, true);
});


test('one classroom unlock initializes from the existing AI password and also unlocks evaluation', async () => {
  const calls = [];
  let currentToken = '';
  const token = `teacher.${Math.floor(Date.now()/1000)+3600}.fixture.signature`;
  const client = {setToken(value) { currentToken = value; }, async request(path, {body}) {
    calls.push(path);
    assert.equal(body.password,testPassword);
    if (path === '/bootstrap') return {setupRequired:true};
    assert.equal(path,'/initialize');
    const proof = Buffer.from(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode('mathrender-classroom-initialize-v1:'+demoKey))).toString('hex');
    assert.equal(body.proof,proof); assert.equal(await decryptKeyFile(body.keyFile,testPassword),demoKey);
    return {token,uploadToken:'upload-fixture',keyFile:encryptedFixture};
  }};
  const app = harness(undefined,new Map(),false,transcription(),{protocol:'https:',href:'https://classroom.test/review.html'},encryptedFixture,client);
  const pending = app.api.ensureClassroom(); await new Promise(resolve=>setImmediate(resolve));
  assert.equal(app.node('key-unlock-dialog').open,true);
  app.node('key-file-password').value=testPassword; await app.node('key-unlock-form').dispatch('submit');
  assert.equal((await pending).token,token); assert.equal(currentToken,token);
  assert.equal(await app.api.ensureConfigured(),true); assert.equal((await app.api.ensureClassroom()).token,token);
  assert.deepEqual(calls,['/bootstrap','/initialize']);
  assert.equal(app.node('change-classroom-password').hidden,false);
  assert.equal(app.node('key-file-password').value,'');
  assert.ok(!JSON.stringify([...app.stored]).includes(testPassword));
});

test('password change validates confirmation, re-encrypts the original cloud key, and retains one unlocked session', async () => {
  let password=testPassword, encrypted=encryptedFixture, changes=0;
  const token=()=>`teacher.${Math.floor(Date.now()/1000)+3600}.version-${changes}.signature`;
  const client={setToken() {}, async request(path,{body}) {
    if(path==='/bootstrap') { assert.equal(body.password,password); return {token:token(),uploadToken:'upload',keyFile:encrypted}; }
    assert.equal(path,'/password'); assert.equal(body.currentPassword,password);
    assert.equal(await decryptKeyFile(body.keyFile,body.newPassword),demoKey);
    password=body.newPassword; encrypted=body.keyFile; changes++;
    return {token:token(),uploadToken:'upload-new',keyFile:encrypted};
  }};
  const app=harness(undefined,new Map(),false,transcription(),{protocol:'https:',href:'https://classroom.test/review.html'},encryptedFixture,client);
  const pending=app.api.ensureConfigured(); await new Promise(resolve=>setImmediate(resolve));
  app.node('key-file-password').value=testPassword; await app.node('key-unlock-form').dispatch('submit'); await pending;
  app.node('change-classroom-password').dispatch('click');
  app.node('classroom-current-password').value=testPassword;
  app.node('classroom-new-password').value='my-new-password'; app.node('classroom-confirm-password').value='mismatch';
  await app.node('classroom-password-form').dispatch('submit'); assert.equal(changes,0);
  assert.match(app.node('classroom-password-message').textContent,/不一致/);
  app.node('classroom-confirm-password').value='my-new-password'; await app.node('classroom-password-form').dispatch('submit');
  assert.equal(changes,1); assert.equal(app.node('classroom-password-dialog').open,false);
  assert.equal(app.api.configured,true); assert.equal((await app.api.ensureClassroom()).token,token());
  for(const id of ['classroom-current-password','classroom-new-password','classroom-confirm-password']) assert.equal(app.node(id).value,'');
  assert.ok(!JSON.stringify([...app.stored]).includes('my-new-password'));
});
