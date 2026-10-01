import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const outputPath = path.join(root, 'labs/algebra/inequality-review.html');
export async function buildStandalone() {
  const read = relative => readFile(path.join(root, relative), 'utf8');
  const [template, css, settingsCSS, ui, protocol, direct, dialog] = await Promise.all([
    read('assets/html/inequality-review-template.html'), read('assets/css/labs/inequality-review.css'),
    read('assets/css/labs/inequality-review-standalone.css'), read('assets/js/labs/inequality-review.js'),
    read('assets/js/labs/inequality-review-protocol.mjs'), read('assets/js/labs/inequality-review-standalone.js'),
    read('assets/html/inequality-review-settings.html')
  ]);
  // Only public UI sources and artwork are read. Credentials are never part of the bundle.
  let html = template
    .replace('<title>不等式评价卡 · MathRender</title>', '<title>李老师开心课堂 · 不等式评价卡</title>')
    .replace('<link rel="stylesheet" href="../../assets/css/labs/inequality-review.css">', `<style>\n${css}\n${settingsCSS}\n</style>`)
    .replace('  <script defer src="../../assets/js/labs/inequality-review.js"></script>\n', '')
    .replace('<span class="connection-label" id="connection-label" role="status">千问 · 检查配置中</span>', '<button class="connection-label" id="connection-label" type="button" aria-haspopup="dialog" aria-controls="api-settings">千问 · 设置密钥</button>');
  for (const match of [...html.matchAll(/src="(\.\.\/\.\.\/assets\/images\/[^\"]+)"/g)]) {
    const asset = path.resolve(root, 'labs/algebra', match[1]);
    const bytes = await readFile(asset);
    html = html.replace(match[0], `src="data:image/png;base64,${bytes.toString('base64')}"`);
  }
  const directScript = `(() => {\n'use strict';\n${protocol.replace(/^export /gm, '')}\n${direct}\n})();`;
  const safeScript = source => source.replace(/<\/script/gi, '<\\/script');
  html = html.replace('</body>', `${dialog}\n<script>\n${safeScript(directScript)}\n</script>\n<script>\n${safeScript(ui)}\n</script>\n</body>`);
  await writeFile(outputPath, html);
  return { outputPath, bytes: Buffer.byteLength(html) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildStandalone();
  console.log(`已生成 ${path.basename(result.outputPath)}（${(result.bytes / 1024 / 1024).toFixed(1)} MB）`);
}
