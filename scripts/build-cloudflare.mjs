import {mkdir, readdir, copyFile, cp, rm, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
// The committed standalone HTML preserves the encrypted key on cloud builds.
// Rebuilding it on CI without the private key file would remove that config.
const html = await readFile(path.join(root,'labs/algebra/inequality-review.html'),'utf8');
if (!html.includes('id="classroom-photo-tab"')) throw new Error('先运行 build-inequality-standalone.mjs 并提交生成后的 HTML。');
await rm(output, {recursive:true, force:true, maxRetries:5, retryDelay:100});
await mkdir(output, {recursive:true});
for (const file of await readdir(root)) if (file.endsWith('.html') && !file.startsWith('._')) await copyFile(path.join(root,file),path.join(output,file));
for (const folder of ['assets','labs']) await cp(path.join(root,folder),path.join(output,folder),{
  recursive:true, filter:source => !path.basename(source).startsWith('.') && !['@eaDir','inequality-ai-key.json'].includes(path.basename(source))
});
// Some mounted macOS volumes create AppleDouble files during copying.
await writeFile(path.join(output,'.assetsignore'), '**/.*\n**/@eaDir/**\n');
console.log('Cloudflare 网站资源已生成到 dist；不包含后台源码和本地配置，发布时排除系统元数据。');
