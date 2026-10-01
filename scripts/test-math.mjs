import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(root, `assets/js/labs/${name}.js`), 'utf8');

// Exercise the actual expression parser, including precedence and signed powers.
const parser = read('iteration');
const mathContext = vm.createContext({});
vm.runInContext(parser.slice(parser.indexOf('function tokenize'), parser.indexOf('function currentExpr')), mathContext);
for (const [expression, x, expected] of [['-x^2',3,-9],['(-x)^2',3,9],['2^-2',0,.25],['2^3^2',0,512],['(x+2/x)/2',2,1.5],['sqrt(2)',0,Math.SQRT2]]) {
  assert.equal(vm.runInContext(`compile(${JSON.stringify(expression)})(${x})`, mathContext), expected, expression);
}
assert.throws(() => vm.runInContext('compile("alert(1)")', mathContext));

const pascalSource = read('pascal-triangle');
const pascalContext = vm.createContext({ toggleBinomial: { checked: true }, binomialCard: { style: {} }, varAInput: { value:'a' }, varBInput: { value:'b' }, binomialTitle: {}, polyBox: {}, selectedRow: 0, triangleData: [[1],[1,1],[1,2,1]], formatSup: p => `<sup>${p}</sup>` });
vm.runInContext(pascalSource.slice(pascalSource.indexOf('function updateBinomialPanel'), pascalSource.indexOf('async function copyPoly')), pascalContext);
vm.runInContext('updateBinomialPanel()', pascalContext);
assert.equal(pascalContext.polyBox.innerHTML, '(a+b)<sup>0</sup> = 1');
vm.runInContext('selectedRow=2; updateBinomialPanel()', pascalContext);
assert.equal(pascalContext.polyBox.innerHTML, '(a+b)<sup>2</sup> = a<sup>2</sup> + 2·ab + b<sup>2</sup>');

const geometricSource = read('geometric-limits');
const geometricContext = vm.createContext({ state: { a:2, q:.5 } });
vm.runInContext(geometricSource.slice(geometricSource.indexOf('function term'), geometricSource.indexOf('function setupCanvas')), geometricContext);
assert.equal(vm.runInContext('partial(3)', geometricContext), 3.5);
vm.runInContext('state.q=1', geometricContext);
assert.equal(vm.runInContext('partial(50)', geometricContext), 100);
vm.runInContext('state.q=-1', geometricContext);
assert.equal(vm.runInContext('partial(2)', geometricContext), 0);
assert.equal(vm.runInContext('partial(3)', geometricContext), 2);

function mockPage(values) {
  const elements = new Map();
  const frames = [];
  const rects = [];
  const ctx = new Proxy({ rect: (...args) => rects.push(args) }, { get: (target,key) => target[key] ?? (() => {}) });
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      id, _value: values[id] ?? '', get value() { return this._value; }, set value(value) { this._value = String(value); }, textContent: '', innerHTML: '', style: {}, dataset: {}, listeners: {}, children: [],
      parentElement: { clientWidth: 900 },
      classList: { add() {}, remove() {}, toggle() {} },
      addEventListener(type,fn) { this.listeners[type] = fn; },
      appendChild(el) { this.children.push(el); }, setAttribute() {}, getContext: () => ctx
    });
    return elements.get(id);
  }
  const math = Object.create(Math); let draws = 0;
  // Every generated exam score rounds to its chosen mean, for deterministic boundaries.
  math.random = () => ++draws % 2 ? .5 : .25;
  const sandbox = { Math: math, console, performance: { now: () => 0 },
    document: { getElementById: element, querySelectorAll: () => [], createElement: () => element(`row-${elements.size}`) },
    requestAnimationFrame(fn) { frames.push(fn); return frames.length; }, cancelAnimationFrame() {},
    window: { devicePixelRatio: 1, addEventListener() {} }
  };
  const context = vm.createContext(sandbox);
  return { context, element, frames, rects };
}

const normal = mockPage({ mean:'0', variance:'1', bins:'20' });
vm.runInContext(read('normal-sampling'), normal.context);
vm.runInContext('runExperiment()', normal.context);
assert.equal(normal.element('statN').textContent, '200');
assert.equal(normal.element('statThMean').textContent, '0.00');
const initialFrames = normal.frames.length;
normal.element('bins').value = '30'; normal.element('bins').listeners.input();
assert(normal.frames.length > initialFrames, 'normal grouping slider must redraw');
normal.element('mean').value = '20'; normal.element('variance').value = '9';
normal.element('bins').listeners.input();
assert.equal(normal.element('statThMean').textContent, '0.00', 'old samples retain the model that generated them');
assert.equal(normal.element('statThVar').textContent, '1.000');
normal.element('variance').value = '-2'; vm.runInContext('runExperiment()', normal.context);
assert.equal(normal.element('variance').value, '0.01');

const exam = mockPage({ mean:'0', sigma:'1', classSize:'40', bins:'15' });
vm.runInContext(read('exam-scores'), exam.context);
vm.runInContext('runExperiment()', exam.context);
assert.equal(exam.element('statMean').textContent, '0.0', 'mean 0 must not fall back to 75');
const examFrames = exam.frames.length;
exam.element('bins').value = '20'; exam.element('bins').listeners.input();
assert(exam.frames.length > examFrames, 'exam grouping slider must redraw');
exam.element('mean').value = '100'; vm.runInContext('runExperiment()', exam.context);
assert.equal(exam.element('statMax').textContent, 100);
exam.frames.at(-1)(1000);
assert(exam.rects.some(([, , ,height]) => height > 0), 'scores of 100 must appear in the last histogram bin');
vm.runInContext('selectedClassSet.add(2); reRender()', exam.context);
assert.equal(exam.element('statN').textContent, '80');
exam.element('classSize').value = '1000000'; vm.runInContext('runExperiment()', exam.context);
assert.equal(exam.element('classSize').value, '60', 'out-of-range size is bounded');
console.log('PASS: expression precedence, geometric boundaries, binomial exponents, grouping redraws, zero mean, full marks, model snapshots, fixed class selection, input limits.');
