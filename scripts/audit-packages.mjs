import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { load } from 'cheerio';
import { build } from 'vite';

const root = resolve(import.meta.dirname, '..');
const consumer = join(root, '.local/package-consumer');
const require = createRequire(join(consumer, 'package.json'));
const { createElement } = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const installed = join(consumer, 'node_modules/zeus-icons');
const sources = JSON.parse(await readFile(join(installed, 'SOURCES.json')));
const manifest = JSON.parse(await readFile(join(root, 'public/packages/manifest.json')));
assert.equal(sources.count, manifest.count);
for (const item of manifest.packages) {
  const bytes = await readFile(join(root, 'public', item.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256);
  assert.equal(bytes.length, item.bytes);
}
const sourceCatalog = JSON.parse(await readFile(join(root, 'public/catalog.json')));
const traced = JSON.parse(await readFile(join(root, 'public/traced/manifest.json')));
const sourcesById = new Map([
  ...sourceCatalog.icons.map(icon => [`${decodeURIComponent(new URL(icon.sourceUrl).pathname.split('/').pop())}:stroke-rounded`, icon.localUrl]),
  ...traced.entries.map(icon => [`${icon.name}:${icon.style}`, icon.svgUrl]),
]);
function artwork(svg) {
  const doc = load(svg, { xmlMode: true });
  function node(element) { return [element.name, Object.entries(element.attribs).sort(([a], [b]) => a.localeCompare(b)), element.children.filter(child => child.type === 'tag').map(node)]; }
  return doc('svg')[0].children.filter(child => child.type === 'tag' && child.name !== 'title').map(node);
}
let checked = 0; let next = 0;
async function worker() {
  while (next < sources.entries.length) {
    const entry = sources.entries[next++];
    const component = await import(pathToFileURL(join(installed, 'dist', entry.style, `${entry.component}.js`)));
    assert.equal(component.default, component[entry.component]);
    const output = renderToStaticMarkup(createElement(component.default, { size: 48, color: '#246348', opacity: 0.6, title: 'Test icon', 'data-audit': entry.component }));
    const parsed = load(output, { xmlMode: true });
    assert.equal(parsed('svg').attr('width'), '48');
    assert.equal(parsed('svg').attr('height'), '48');
    assert.equal(parsed('svg').attr('color'), '#246348');
    assert.equal(parsed('svg').attr('opacity'), '0.6');
    assert.equal(parsed('svg').attr('role'), 'img');
    assert.equal(parsed('svg').attr('aria-hidden'), undefined);
    assert.equal(parsed('title').text(), 'Test icon');
    const original = await readFile(join(root, 'public', sourcesById.get(`${entry.name}:${entry.style}`)), 'utf8');
    assert.equal(createHash('sha256').update(original).digest('hex'), entry.sha256);
    assert.deepEqual(artwork(output), artwork(original), `Geometry changed in ${entry.component}`);
    const dart = await readFile(join(root, '.local/packages/zeus_icons/lib', entry.style.replaceAll('-', '_'), `${entry.component}.dart`), 'utf8');
    assert(dart.includes(`class ${entry.component} extends StatelessWidget`));
    assert.deepEqual(artwork(dart.match(/r'''([\s\S]*?)'''/)[1]), artwork(original), `Flutter geometry changed in ${entry.component}`);
    checked++;
    if (checked % 5000 === 0) console.log(`Verified ${checked}/${sources.count} React renders and Flutter sources`);
  }
}
await Promise.all(Array.from({ length: 16 }, worker));
const sample = "import { Home01SolidRoundedIcon } from 'zeus-icons/solid-rounded/Home01SolidRoundedIcon';\nexport { Home01SolidRoundedIcon };\n";
await writeFile(join(consumer, 'one-icon.js'), sample);
await build({ configFile: false, root: consumer, logLevel: 'error', build: { outDir: 'bundle', lib: { entry: join(consumer, 'one-icon.js'), formats: ['es'], fileName: () => 'one-icon.js' }, rolldownOptions: { external: ['react'] } } });
const bundled = await readFile(join(consumer, 'bundle/one-icon.js'), 'utf8');
assert(bundled.length < 10000, `A single icon bundled ${bundled.length} bytes`);
assert(!bundled.includes('FirstBracketIcon'));
await mkdir(join(root, '.local/package-audit'), { recursive: true });
await writeFile(join(root, '.local/package-audit/results.json'), JSON.stringify({ checked, reactRendered: checked, flutterSources: checked, singleIconBundleBytes: Buffer.byteLength(bundled), failures: [] }, null, 2));
console.log(JSON.stringify({ checked, singleIconBundleBytes: Buffer.byteLength(bundled), failures: [] }));
