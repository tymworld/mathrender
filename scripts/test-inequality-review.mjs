import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { completionURL, validateEvaluation, validateImage, evaluateImage, createReviewServer, MAX_IMAGE_BYTES, EVALUATION_PROMPT } from '../server/inequality-review.mjs';

const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJFoAAAAASUVORK5CYII=', 'base64');
const config = { apiKey: 'test-only-secret', model: 'qwen3.5-plus', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1' };
const result = () => ({
  status: 'needs_revision', formula: '|2x−1|+|x+2|≥|3x+1|', verdict: '取等条件需要补充。',
  scientific: { grade: 'A', comment: '由三角不等式可知主结论成立。' },
  rigor: { grade: 'C', comment: '漏掉 x≤−2 的取等区间。' },
  creativity: { grade: 'C', comment: '一次式代入有意义。' },
  highlight: '有效使用母式构造不等式。', suggestion: '补上 x≤−2 的取等情形。', total: 999
});
const providerReply = value => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] }), { status: 200 });

test('accepts only A/B/C/D and never returns scores or a total', () => {
  for (const grade of ['A', 'B', 'C', 'D']) {
    const value = result(); value.scientific.grade = grade;
    value.scientific.score = 40;
    const normalized = validateEvaluation(value);
    assert.equal(normalized.scientific.grade, grade);
    assert.ok(!('score' in normalized.scientific));
    assert.ok(!('total' in normalized));
  }
  for (const grade of ['E', 'a', 40, '', null]) {
    const value = result(); value.scientific.grade = grade;
    assert.throws(() => validateEvaluation(value), /格式不完整/);
  }
});

test('uncertain responses never present fabricated grades', () => {
  for (const status of ['unreadable', 'undetermined', 'insufficient_information']) {
    const value = result(); value.status = status;
    const normalized = validateEvaluation(value);
    assert.equal(normalized.scientific.grade, null);
    assert.equal(normalized.rigor.grade, null);
    assert.equal(normalized.creativity.grade, null);
    assert.ok(!('total' in normalized));
  }
});

test('rejects missing feedback, unknown statuses, and excessive text', () => {
  const value = result(); delete value.rigor;
  assert.throws(() => validateEvaluation(value));
  assert.throws(() => validateEvaluation({ ...result(), status: 'fake' }));
  assert.throws(() => validateEvaluation({ ...result(), verdict: '字'.repeat(201) }));
});

test('preserves complete feedback when the model modestly exceeds prompt length targets', () => {
  const value = result();
  value.verdict = '字'.repeat(87);
  value.rigor.comment = '字'.repeat(109);
  const normalized = validateEvaluation(value);
  assert.equal(normalized.verdict.length, 87);
  assert.equal(normalized.rigor.comment.length, 109);
  assert.equal(normalized.scientific.grade, 'A');
});

test('requires supported image signatures and caps payload size', () => {
  validateImage(image, 'image/png');
  assert.throws(() => validateImage(Buffer.from('not a picture'), 'image/png'));
  assert.throws(() => validateImage(image, 'image/jpeg'));
  assert.throws(() => validateImage(Buffer.alloc(MAX_IMAGE_BYTES + 1), 'image/png'));
});

test('credentials only go to approved HTTPS Qwen endpoints', () => {
  assert.equal(completionURL(config.baseURL), config.baseURL + '/chat/completions');
  assert.match(completionURL('https://llm-example.cn-beijing.maas.aliyuncs.com/compatible-mode/v1'), /chat\/completions$/);
  for (const url of ['https://evil.example/compatible-mode/v1', 'http://dashscope.aliyuncs.com/compatible-mode/v1', 'https://dashscope.aliyuncs.com.evil.example/compatible-mode/v1', config.baseURL + '?token=x', 'https://user@dashscope.aliyuncs.com/compatible-mode/v1']) {
    assert.throws(() => completionURL(url));
  }
});

test('image and rubric reach the vision endpoint; response is normalized', async () => {
  const evaluated = await evaluateImage(image, 'image/png', config, { fetchImpl: async (url, options) => {
    assert.equal(url, config.baseURL + '/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer test-only-secret');
    assert.equal(options.redirect, 'error');
    const payload = JSON.parse(options.body);
    assert.equal(payload.model, 'qwen3.5-plus');
    assert.equal(payload.enable_thinking, false);
    assert.equal(payload.response_format.type, 'json_object');
    assert.equal(payload.messages[0].content[0].text, EVALUATION_PROMPT);
    assert.equal(payload.messages[0].content[1].image_url.url, 'data:image/png;base64,' + image.toString('base64'));
    return providerReply(result());
  } });
  assert.equal(evaluated.scientific.grade, 'A');
});

test('provider failures cannot leak the key or fabricate a result', async () => {
  await assert.rejects(evaluateImage(image, 'image/png', config, {
    fetchImpl: async () => new Response('test-only-secret', { status: 401 })
  }), error => /验证失败/.test(error.message) && !error.message.includes(config.apiKey));
  await assert.rejects(evaluateImage(image, 'image/png', config, {
    fetchImpl: async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] }))
  }), /未完成/);
});

async function withServer(options, task) {
  const server = createReviewServer(options);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  try { await task(url); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

test('HTTP route evaluates uploads; static server cannot serve secrets or backend code', async () => {
  let calls = 0;
  await withServer({ configLoader: async () => config, fetchImpl: async () => { calls++; return providerReply(result()); } }, async url => {
    const status = await (await fetch(url + '/api/status')).json();
    assert.deepEqual(status, { configured: true, model: 'qwen3.5-plus' });
    const response = await fetch(url + '/api/evaluate', { method: 'POST', headers: { 'Content-Type': 'image/png', Origin: url }, body: image });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).rigor.grade, 'C');
    assert.equal(calls, 1);
    for (const route of ['/.env.qwen', '/server/inequality-review.mjs', '/assets/../.env.qwen', '/assets/%2eenv.qwen', '/assets/']) {
      const denied = await fetch(url + route);
      assert.equal(denied.status, 404);
      assert.ok(!(await denied.text()).includes('DASHSCOPE_API_KEY='));
    }
    const page = await fetch(url + '/labs/algebra/inequality-review.html');
    assert.equal(page.status, 200);
    assert.match(await page.text(), /id="generate-button"/);
    const blocked = await fetch(url + '/api/evaluate', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'image/png' }, body: image });
    assert.equal(blocked.status, 403);
    assert.equal(calls, 1);
  });
});

test('missing key produces an actionable error without making a paid call', async () => {
  await withServer({ configLoader: async () => ({ ...config, apiKey: '' }), fetchImpl: async () => { assert.fail('must not call provider'); } }, async url => {
    assert.equal((await (await fetch(url + '/api/status')).json()).configured, false);
    const response = await fetch(url + '/api/evaluate', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: image });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /填写 API Key/);
  });
});

test('slow provider times out instead of hanging', async () => {
  await withServer({ configLoader: async () => config, timeoutMs: 40, fetchImpl: async (_, { signal }) => new Promise((resolve, reject) => {
    if (signal.aborted) reject(new Error('aborted'));
    else signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }) }, async url => {
    const response = await fetch(url + '/api/evaluate', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: image });
    assert.equal(response.status, 504);
  });
});

test('front-end bindings exist and model content is rendered as text', async () => {
  const source = await readFile(new URL('../assets/js/labs/inequality-review.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../labs/algebra/inequality-review.html', import.meta.url), 'utf8');
  new vm.Script(source);
  for (const match of source.matchAll(/\$\('([a-z-]+)'\)/g)) assert.ok(html.includes(`id="${match[1]}"`), match[1]);
  assert.ok(!source.includes('innerHTML'));
  assert.ok(!html.includes('固定示例'));
});

async function layoutHarness({ width = 1514, height = 614, measure }) {
  const source = await readFile(new URL('../assets/js/labs/inequality-review.js', import.meta.url), 'utf8');
  const elements = new Map();
  const listeners = {};
  const style = { value: 24, setProperty(name, value) { if (name === '--review-font') this.value = parseFloat(value); } };
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      hidden: false, dataset: {}, addEventListener() {},
      removeAttribute(name) { if (name === 'data-overflow') delete this.dataset.overflow; }
    });
    return elements.get(id);
  };
  const card = {
    dataset: {}, querySelectorAll: () => [{ clientWidth: 100, scrollWidth: 100 }],
    getBoundingClientRect: () => ({ height: measure(style.value, card.dataset.density) })
  };
  const win = { innerWidth: width, innerHeight: height, addEventListener(name, callback) { listeners[name] = callback; } };
  const context = {
    document: {
      getElementById: element, querySelector: selector => selector === '.evaluation-card' ? card : {},
      body: { style }, documentElement: { scrollWidth: width + 20 }
    },
    window: win, getComputedStyle: () => ({ paddingTop: '6px', paddingBottom: '10px' }),
    cancelAnimationFrame() {}, requestAnimationFrame(callback) { callback(); return 1; },
    fetch: async () => ({ ok: true, json: async () => ({ configured: true }) })
  };
  new vm.Script(source).runInNewContext(context);
  const resize = (nextWidth = win.innerWidth, nextHeight = win.innerHeight) => {
    win.innerWidth = nextWidth; win.innerHeight = nextHeight; listeners.resize();
    return { font: style.value, density: card.dataset.density, overflow: element('result-screen').dataset.overflow };
  };
  return resize;
}

test('short windows reclaim fixed layout space instead of reducing text to 8px', async () => {
  const resize = await layoutHarness({ measure: (font, density) => density === 'normal' ? 700 : 470 + font * 3 });
  const layout = resize();
  assert.equal(layout.font, 24);
  assert.equal(layout.density, 'compact');
  assert.equal(layout.overflow, undefined);
});

test('font fitting recovers the preferred size when the window becomes taller', async () => {
  const resize = await layoutHarness({ measure: (font, density) => density === 'normal' ? 820 : 420 + font * 8 });
  const short = resize();
  assert.ok(short.font >= 18 && short.font < 24);
  assert.equal(short.overflow, undefined);
  assert.deepEqual(resize(1514, 950), { font: 24, density: 'normal', overflow: undefined });
});

test('excessive content remains complete at a readable minimum instead of shrinking indefinitely', async () => {
  for (const [width, minimum] of [[1514, 18], [390, 16]]) {
    const resize = await layoutHarness({ width, measure: () => 1400 });
    assert.deepEqual(resize(), { font: minimum, density: 'minimal', overflow: 'true' });
  }
});
