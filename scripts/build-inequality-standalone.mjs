import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { QWEN_VISION_MODELS, DEFAULT_QWEN_MODEL, QWEN_MODELS_CHECKED_ON } from '../assets/js/labs/inequality-review-models.mjs';
import { PROMPT_VERSIONS } from '../assets/js/labs/inequality-review-prompts.mjs';
import {KEY_FILE_NAME, parseKeyFile} from '../assets/js/labs/inequality-review-keyfile.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const outputPath = path.join(root, 'labs/algebra/inequality-review.html');
export async function buildStandalone() {
  const read = relative => readFile(path.join(root, relative), 'utf8');
  const [template, css, settingsCSS, ui, protocol, direct, dialog, prompts, promptHistory, keyfile] = await Promise.all([
    read('assets/html/inequality-review-template.html'), read('assets/css/labs/inequality-review.css'),
    read('assets/css/labs/inequality-review-standalone.css'), read('assets/js/labs/inequality-review.js'),
    read('assets/js/labs/inequality-review-protocol.mjs'), read('assets/js/labs/inequality-review-standalone.js'),
    read('assets/html/inequality-review-settings.html'), read('assets/js/labs/inequality-review-prompts.mjs'),
    read('assets/js/labs/inequality-review-prompt-history.json'), read('assets/js/labs/inequality-review-keyfile.mjs')
  ]);
  // Embed only the validated, password-encrypted file. Never read .env or plaintext credentials.
  let encryptedKeyFile = null;
  try { encryptedKeyFile = parseKeyFile(await read('labs/algebra/' + KEY_FILE_NAME)); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const keyConfigScript = `const EMBEDDED_KEY_FILE = ${JSON.stringify(encryptedKeyFile)};`;
  let html = template
    .replace('<title>不等式评价卡 · MathRender</title>', '<title>李老师开心课堂 · 不等式评价卡</title>')
    .replace('<link rel="stylesheet" href="../../assets/css/labs/inequality-review.css">', `<style>\n${css}\n${settingsCSS}\n</style>`)
    .replace('  <script defer src="../../assets/js/labs/inequality-review.js"></script>\n', '')
    .replace('<span class="connection-label" id="connection-label" role="status">千问 · 检查配置中</span>', '<button class="connection-label" id="connection-label" type="button" aria-haspopup="dialog" aria-controls="api-settings">AI 设置 · 待配置</button>');
  for (const match of [...html.matchAll(/src="(\.\.\/\.\.\/assets\/images\/[^\"]+)"/g)]) {
    const asset = path.resolve(root, 'labs/algebra', match[1]);
    const bytes = await readFile(asset);
    html = html.replace(match[0], `src="data:image/png;base64,${bytes.toString('base64')}"`);
  }
  const modelOptions = [...new Set(QWEN_VISION_MODELS.map(model => model.group))].map(group =>
    `<optgroup label="${group}">` + QWEN_VISION_MODELS.filter(model => model.group === group).map(model =>
      `<option value="${model.id}">${model.id}${model.id === DEFAULT_QWEN_MODEL ? ' · 默认' : ''}</option>`).join('') + '</optgroup>'
  ).join('\n');
  const escapeHTML = value => value.replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const promptOptions = PROMPT_VERSIONS.map(item => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.title)}</option>`).join('\n');
  const settingsDialog = dialog.replace('<!-- QWEN_MODEL_OPTIONS -->', modelOptions)
    .replace('<!-- PROMPT_VERSION_OPTIONS -->', promptOptions)
    .replace('<!-- QWEN_MODELS_CHECKED_ON -->', QWEN_MODELS_CHECKED_ON);
  const modelScript = `const QWEN_VISION_MODELS = ${JSON.stringify(QWEN_VISION_MODELS)};\nconst DEFAULT_QWEN_MODEL = ${JSON.stringify(DEFAULT_QWEN_MODEL)};`;
  // Archived built-in text is used only to migrate old text-based preferences.
  // It is never selectable or sent as the current version's evaluation prompt.
  const historyScript = `const BUILTIN_PROMPT_HISTORY = ${JSON.stringify(JSON.parse(promptHistory))};`;
  const bundledProtocol = protocol.replace(/^import \{ DEFAULT_EVALUATION_PROMPT \} from '\.\/inequality-review-prompts\.mjs';\n/m, '').replace(/^export /gm, '');
  const directScript = `(() => {\n'use strict';\n${prompts.replace(/^export /gm, '')}\n${bundledProtocol}\n${modelScript}\n${historyScript}\n${keyConfigScript}\n${keyfile.replace(/^export /gm, '')}\n${direct}\n})();`;
  const safeScript = source => source.replace(/<\/script/gi, '<\\/script');
  html = html.replace('</body>', `${settingsDialog}\n<script>\n${safeScript(directScript)}\n</script>\n<script>\n${safeScript(ui)}\n</script>\n</body>`);
  await writeFile(outputPath, html);
  return { outputPath, bytes: Buffer.byteLength(html) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildStandalone();
  console.log(`已生成 ${path.basename(result.outputPath)}（${(result.bytes / 1024 / 1024).toFixed(1)} MB）`);
}
