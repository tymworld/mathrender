import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/js/catalog.js'), 'utf8'), context);
const { labs, categories } = context.window.MathRender;
assert.equal(labs.length, 20);
assert.equal(categories.length, 4);
assert.equal(new Set(labs.map(lab => lab.id)).size, labs.length);
const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pages = ['index.html', 'labs/algebra/inequality-upload.html', ...labs.map(lab => lab.path), ...fs.readdirSync(root).filter(file => file.endsWith('.html') && file !== 'index.html')];
const failures = [];
let links = 0;
for (const file of pages) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  if (new Set(ids).size !== ids.length) failures.push(`${file}: duplicate element IDs`);
  for (const match of source.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const target = match[1].split(/[?#]/)[0];
    if (!target || /^(https?:|data:|mailto:)/.test(target)) continue;
    links++;
    if (!fs.existsSync(path.resolve(root, path.dirname(file), target))) failures.push(`${file}: missing ${target}`);
  }
}
for (const lab of labs) {
  assert(home.includes(`href="${lab.path}"`), `${lab.id} is absent from the homepage`);
  assert(fs.existsSync(path.join(root, `assets/css/labs/${lab.id}.css`)));
  const source = fs.readFileSync(path.join(root, `assets/js/labs/${lab.id}.js`), 'utf8');
  new vm.Script(source, { filename: lab.id });
}
for (const name of ['catalog', 'home', 'classroom']) new vm.Script(fs.readFileSync(path.join(root, `assets/js/${name}.js`), 'utf8'), { filename: name });
for (const name of ['inequality-classroom-client','inequality-classroom-gallery','inequality-upload']) new vm.Script(fs.readFileSync(path.join(root, `assets/js/labs/${name}.js`), 'utf8'), {filename:name});
assert.deepEqual(failures, []);
console.log(`PASS: ${labs.length} activities, ${categories.length} categories, ${links} local references; JavaScript syntax and element IDs checked.`);
