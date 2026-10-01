import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { buildStandalone } from './build-inequality-standalone.mjs';
import { EVALUATION_PROMPT } from '../assets/js/labs/inequality-review-protocol.mjs';

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

function harness(fetchImpl = async () => providerReply(fixture())) {
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
    innerWidth: 1280, innerHeight: 720, scrollTo() {},
    addEventListener(name, callback) { if (!events.has(name)) events.set(name, []); events.get(name).push(callback); }
  };
  const context = vm.createContext({
    window: win, document: { getElementById: node, querySelector: node, body: node('body') },
    getComputedStyle: () => ({paddingTop:'0',paddingBottom:'0'}),
    requestAnimationFrame: callback => {callback(); return 1;}, cancelAnimationFrame() {},
    URL: { createObjectURL: () => 'blob:test-picture', revokeObjectURL() {} },
    Image: class { async decode() {} },
    TextDecoder, Uint8Array, DOMException, AbortController, setTimeout, clearTimeout,
    btoa: value => Buffer.from(value, 'binary').toString('base64'), fetch: fetchImpl
  });
  for (const script of scripts) vm.runInContext(script, context);
  return {
    node, api: win.inequalityReviewAPI,
    async submitKey(key = demoKey) { node('api-key').value = key; await node('api-settings-form').dispatch('submit'); },
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
  assert.doesNotMatch(scripts.join('\n'), /localStorage|sessionStorage|indexedDB|document\.cookie/);
  assert.ok(html.includes(EVALUATION_PROMPT));
  assert.ok(artifact.bytes < 6 * 1024 * 1024);
});

test('opening the standalone page makes no backend requests and prompts for a key', () => {
  let calls = 0;
  const app = harness(async () => { calls++; throw new Error('must not fetch at startup'); });
  assert.equal(calls, 0);
  assert.equal(app.api.configured, false);
  assert.equal(app.node('api-settings').open, true);
  assert.equal(app.node('connection-label').textContent, '千问 · 设置密钥');
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

test('empty keys and characters unsafe for HTTP headers cannot start a request', async () => {
  const app = harness(async () => { throw new Error('must not call'); });
  await assert.rejects(app.api.evaluate(file()), /设置密钥/);
  for (const input of ['', ' \u200b\n\t', 'Bearer ', '“”', 'sk-abc\u0000def', '含中文的密钥']) {
    await app.submitKey(input);
    assert.equal(app.api.configured, false);
    assert.equal(app.node('api-settings').open, true);
    assert.match(app.node('api-settings-message').textContent, /粘贴|特殊字符/);
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

test('browser request sends exact rubric and photo only to the Beijing endpoint', async () => {
  let calls = 0;
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
    assert.equal(body.messages[0].content[0].text, EVALUATION_PROMPT);
    assert.equal(body.messages[0].content[1].image_url.url, 'data:image/png;base64,'+Buffer.from(picture).toString('base64'));
    return providerReply(fixture());
  });
  await app.submitKey();
  const value = await app.api.evaluate(file());
  assert.equal(calls, 1);
  assert.equal(value.scientific.grade, 'A');
  assert.ok(!('total' in value));
});

test('invalid images and oversized files are rejected before any network call', async () => {
  const app = harness(async () => { throw new Error('must not call'); });
  await app.submitKey();
  await assert.rejects(app.api.evaluate(new File(['wrong'], 'fake.png', {type:'image/png'})), /有效/);
  await assert.rejects(app.api.evaluate(new File([new Uint8Array(10*1024*1024+1)], 'big.png', {type:'image/png'})), /10 MB/);
});

test('provider errors are sanitized; timeout and network failures remain actionable', async () => {
  for (const status of [400,401,402,403,404,429,500]) {
    const app = harness(async () => new Response(`error containing ${demoKey}`, {status}));
    await app.submitKey();
    await assert.rejects(app.api.evaluate(file()), error => !error.message.includes(demoKey) && /千问|密钥|百炼/.test(error.message));
  }
  const network = harness(async () => {throw new TypeError('Failed to fetch '+demoKey);});
  await network.submitKey();
  await assert.rejects(network.api.evaluate(file()), /检查网络/);
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
  await app.submitKey();
  await app.node('photo-input').dispatch('change', { target:{files:[file()]} });
  const generation = app.node('generate-button').dispatch('click');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.node('generate-label').textContent, '千问正在评价…');
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
