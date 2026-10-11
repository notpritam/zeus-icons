import { readFile, writeFile, mkdir, rename, copyFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { load } from 'cheerio';
import { componentName, componentSource } from '../src/lib/component-source.ts';

const root = resolve(import.meta.dirname, '..');
const out = join(root, '.local/packages');
const reactDir = join(out, 'react');
const flutterDir = join(out, 'zeus_icons');
const catalog = JSON.parse(await readFile(join(root, 'public/catalog.json')));
const traced = JSON.parse(await readFile(join(root, 'public/traced/manifest.json')));
const sourceName = icon => decodeURIComponent(new URL(icon.sourceUrl).pathname.split('/').pop());
const freeByName = new Map(catalog.icons.map(icon => [sourceName(icon), icon]));
const notice = 'Generated artwork: Hugeicons public reference images. Inferred vectors, not original Pro source SVGs. Not covered by the MIT free-pack licence. See SOURCES.json for per-icon provenance and quality.';
const licence = await readFile(join(root, 'public/LICENSE-hugeicons.txt'), 'utf8');
const entries = [
  ...catalog.icons.map(icon => ({ name: sourceName(icon), style: 'stroke-rounded', svgUrl: icon.localUrl, sourceUrl: icon.sourceUrl, exportName: icon.exportName, status: 'original-free', free: true })),
  ...traced.entries.map(icon => ({ ...icon, exportName: freeByName.get(icon.name)?.exportName, free: false })),
];
await Promise.all([mkdir(join(reactDir, 'dist'), { recursive: true }), mkdir(join(flutterDir, 'lib'), { recursive: true }), mkdir(join(root, 'public/packages'), { recursive: true })]);
const styles = [...new Set(entries.map(icon => icon.style))];
for (const style of styles) {
  await mkdir(join(reactDir, 'dist', style), { recursive: true });
  await mkdir(join(flutterDir, 'lib', style.replaceAll('-', '_')), { recursive: true });
}
const runtime = `'use client';
import { createElement, forwardRef } from 'react';
function element([tag, attrs, children], key, strokeWidth) {
  const props = { ...attrs, key };
  if (strokeWidth !== undefined && 'strokeWidth' in props) props.strokeWidth = strokeWidth;
  return createElement(tag, props, ...children.map((node, i) => element(node, i, strokeWidth)));
}
export function createIcon(name, attrs, nodes) {
  const Icon = forwardRef(function Icon({ size = 24, color = 'currentColor', title, strokeWidth, children, ...props }, ref) {
    const labelled = title || props['aria-label'] || props['aria-labelledby'];
    return createElement('svg', { ...attrs, xmlns: 'http://www.w3.org/2000/svg', width: size, height: size, color, role: labelled ? 'img' : undefined, 'aria-hidden': labelled ? undefined : true, ...props, ref }, title ? createElement('title', null, title) : null, ...nodes.map((node, i) => element(node, i, strokeWidth)), children);
  });
  Icon.displayName = name;
  return Icon;
}
`;
await writeFile(join(reactDir, 'dist/runtime.js'), runtime);
await writeFile(join(reactDir, 'dist/runtime.d.ts'), "import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react';\nexport type IconProps = Omit<SVGProps<SVGSVGElement>, 'ref'> & { size?: number | string; title?: string };\nexport type IconComponent = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;\n");
const attrName = name => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const attrs = element => Object.fromEntries(Object.entries(element.attribs).map(([name, value]) => [attrName(name), value]));
function node(element) { return [element.name, attrs(element), (element.children ?? []).filter(child => child.type === 'tag').map(node)]; }
const names = new Set(); const sources = []; const indexes = new Map(styles.map(style => [style, []]));
let next = 0;
async function worker() {
  while (next < entries.length) {
    const entry = entries[next++];
    const name = componentName(entry.name, entry.style, entry.exportName);
    if (names.has(name)) throw new Error(`Component collision: ${name}`);
    names.add(name);
    const svg = await readFile(join(root, 'public', entry.svgUrl), 'utf8');
    const sha256 = createHash('sha256').update(svg).digest('hex');
    if (entry.svgSha256 && sha256 !== entry.svgSha256) throw new Error(`Source hash changed: ${entry.svgUrl}`);
    const document = load(svg, { xmlMode: true });
    const element = document('svg')[0];
    const rootAttrs = attrs(element);
    for (const key of ['width', 'height', 'color', 'opacity']) delete rootAttrs[key];
    const children = element.children.filter(child => child.type === 'tag').map(node);
    const attribution = entry.free ? licence : `${notice}\nSource: ${entry.sourceUrl}`;
    await Promise.all([
      writeFile(join(reactDir, 'dist', entry.style, `${name}.js`), `'use client';\n/* ${attribution.replaceAll('*/', '* /')} */\nimport { createIcon } from '../runtime.js';\nexport const ${name} = /*#__PURE__*/createIcon(${JSON.stringify(name)}, ${JSON.stringify(rootAttrs)}, ${JSON.stringify(children)});\nexport default ${name};\n`),
      writeFile(join(reactDir, 'dist', entry.style, `${name}.d.ts`), `import type { IconComponent } from '../runtime.js';\nexport declare const ${name}: IconComponent;\nexport default ${name};\n`),
      writeFile(join(flutterDir, 'lib', entry.style.replaceAll('-', '_'), `${name}.dart`), componentSource('Flutter', name, svg, attribution)),
    ]);
    indexes.get(entry.style).push(name);
    sources.push({ component: name, name: entry.name, style: entry.style, sourceUrl: entry.sourceUrl, sha256, status: entry.status, licence: entry.free ? 'MIT' : 'source-artwork-not-MIT' });
    if (sources.length % 5000 === 0) console.log(`${sources.length}/${entries.length} components built for React and Flutter`);
  }
}
await Promise.all(Array.from({ length: 16 }, worker));
const rootIndex = [];
for (const [style, list] of indexes) {
  list.sort();
  const index = list.map(name => `export { ${name} } from './${name}.js';`).join('\n') + '\n';
  await writeFile(join(reactDir, 'dist', `${style}.js`), index.replaceAll("from './", `from './${style}/`));
  await writeFile(join(reactDir, 'dist', `${style}.d.ts`), index.replaceAll("from './", `from './${style}/`));
  rootIndex.push(...list.map(name => `export { ${name} } from './${style}/${name}.js';`));
  await writeFile(join(flutterDir, 'lib', `${style.replaceAll('-', '_')}.dart`), list.map(name => `export '${style.replaceAll('-', '_')}/${name}.dart';`).join('\n') + '\n');
}
await writeFile(join(reactDir, 'dist/index.js'), rootIndex.join('\n') + '\n');
await writeFile(join(reactDir, 'dist/index.d.ts'), "export type { IconProps, IconComponent } from './runtime.js';\n" + rootIndex.join('\n') + '\n');
await writeFile(join(flutterDir, 'lib/zeus_icons.dart'), styles.map(style => `export '${style.replaceAll('-', '_')}.dart';`).join('\n') + '\n');
sources.sort((a, b) => a.component.localeCompare(b.component));
for (const dir of [reactDir, flutterDir]) {
  await writeFile(join(dir, 'SOURCES.json'), JSON.stringify({ count: sources.length, free: catalog.icons.length, generated: traced.entries.length, entries: sources }));
  await writeFile(join(dir, 'LICENSE'), `${notice}\n\nOnly the original Stroke Rounded artwork is MIT licensed:\n\n${licence}\n`);
}
await writeFile(join(reactDir, 'package.json'), JSON.stringify({ name: 'zeus-icons', version: '0.1.0', private: true, description: 'Named SVG React components for the Zeus Icons collection', type: 'module', sideEffects: false, license: 'SEE LICENSE IN LICENSE', main: './dist/index.js', types: './dist/index.d.ts', exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' }, './*': { types: './dist/*.d.ts', import: './dist/*.js' }, './package.json': './package.json' }, files: ['dist', 'SOURCES.json', 'LICENSE', 'README.md'], peerDependencies: { react: '>=18' } }, null, 2));
await writeFile(join(reactDir, 'README.md'), `# Zeus Icons React\n\n${sources.length} named components: ${catalog.icons.length} original free and ${traced.entries.length} generated variants. Not published to npm; install the downloaded tarball:\n\n\`npm install ./zeus-icons-0.1.0.tgz\`\n\n\`import { Home01SolidRoundedIcon } from 'zeus-icons/solid-rounded/Home01SolidRoundedIcon';\`\n\n\`<Home01SolidRoundedIcon size={32} color="#246348" opacity={0.8} title="Home" />\`\n\nSupports SVG props, refs, title/aria labels, CSS and per-icon imports. ESM with TypeScript declarations; unused icons are tree-shaken. strokeWidth changes original stroke SVGs; generated icons retain their filled contours. Use the site's component download for a custom contour weight. Original source names/styles are in SOURCES.json. Nine missing source images are absent; no empty components.\n\n${notice}\n`);
await writeFile(join(flutterDir, 'pubspec.yaml'), `name: zeus_icons\ndescription: Named SVG widgets for the Zeus Icons collection.\nversion: 0.1.0\npublish_to: none\nenvironment:\n  sdk: '>=3.6.0 <4.0.0'\ndependencies:\n  flutter:\n    sdk: flutter\n  flutter_svg: ^2.3.0\n`);
await writeFile(join(flutterDir, 'README.md'), `# Zeus Icons Flutter\n\n${sources.length} named StatelessWidget components. Extract zeus-icons-flutter-0.1.0.tar.gz and add a local path dependency:\n\n\`\`\`yaml\ndependencies:\n  zeus_icons:\n    path: ./zeus_icons\n\`\`\`\n\n\`import 'package:zeus_icons/solid_rounded/Home01SolidRoundedIcon.dart';\`\n\n\`const Home01SolidRoundedIcon(size: 32, color: Color(0xFF246348), semanticLabel: 'Home');\`\n\nWidgets support size, color, opacity and semanticLabel. Individual imports avoid loading the whole catalogue in the analyzer. Uses flutter_svg.\n\n${notice}\n`);
console.log('Packing artifacts…');
execFileSync('npm', ['pack', '--silent', '--pack-destination', out], { cwd: reactDir, stdio: 'inherit', maxBuffer: 1024 * 1024 });
execFileSync('tar', ['-czf', join(out, 'zeus-icons-flutter-0.1.0.tar.gz'), '--exclude=zeus_icons/.dart_tool', '--exclude=zeus_icons/build', '-C', out, 'zeus_icons'], { stdio: 'inherit' });
const packages = [];
for (const [framework, file] of [['React', 'zeus-icons-0.1.0.tgz'], ['Flutter', 'zeus-icons-flutter-0.1.0.tar.gz']]) {
  const bytes = await readFile(join(out, file));
  const staging = join(out, `${file}.publish`);
  await copyFile(join(out, file), staging);
  await rename(staging, join(root, 'public/packages', file));
  packages.push({ framework, file, url: `/packages/${file}`, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
await writeFile(join(root, 'public/packages/manifest.json'), JSON.stringify({ version: '0.1.0', count: sources.length, free: catalog.icons.length, generated: traced.entries.length, builtAt: new Date().toISOString(), packages }, null, 2));
console.log(JSON.stringify({ count: sources.length, packages }, null, 2));
