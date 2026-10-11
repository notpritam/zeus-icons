import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

// Produces and dry-runs a concrete release candidate. Never publishes.
const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(await readFile(join(root, 'public/packages/manifest.json')));
const entry = manifest.packages.find(item => item.framework === 'React');
const archive = join(root, 'public', entry.url);
const bytes = await readFile(archive);
if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error('Package archive checksum mismatch. Rebuild and audit packages first.');
const name = process.argv[2] ?? 'zeus-icons';
if (!/^(?:@[a-z0-9][a-z0-9-]*\/)?[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error('Pass a valid npm name, such as zeus-icons or @your-account/zeus-icons.');
const releases = join(root, '.local/releases');
await mkdir(releases, { recursive: true });
const directory = await mkdtemp(join(releases, 'react-'));
execFileSync('tar', ['-xzf', archive, '-C', directory]);
const candidate = join(directory, 'package');
const file = join(candidate, 'package.json');
const pkg = JSON.parse(await readFile(file));
const previousName = pkg.name;
pkg.name = name;
delete pkg.private;
pkg.publishConfig = { access: 'public', registry: 'https://registry.npmjs.org/' };
pkg.author = 'Pritam Raj';
pkg.keywords = ['icons', 'react', 'svg', 'typescript'];
await writeFile(file, JSON.stringify(pkg, null, 2) + '\n');
const readme = (await readFile(join(candidate, 'README.md'), 'utf8'))
  .replaceAll(previousName, name)
  .replace('Not published to npm; install the downloaded tarball:', 'Install from npm after this version is published:')
  .replace('npm install ./zeus-icons-0.1.0.tgz', `npm install ${name}`);
await writeFile(join(candidate, 'README.md'), readme);
const sources = JSON.parse(await readFile(join(candidate, 'SOURCES.json')));
if (sources.count !== manifest.count) throw new Error('Package icon count does not match the verified collection.');
const filename = execFileSync('npm', ['pack', '--silent', '--ignore-scripts', '--pack-destination', directory], { cwd: candidate, encoding: 'utf8' }).trim();
const tarball = join(directory, filename);
const dry = spawnSync('npm', ['publish', tarball, '--dry-run', '--access', 'public', '--ignore-scripts', '--json', '--registry', 'https://registry.npmjs.org/'], { cwd: candidate, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
await writeFile(join(directory, 'publish-dry-run.json'), dry.stdout ?? '');
await writeFile(join(directory, 'publish-dry-run.log'), dry.stderr ?? '');
if (dry.status !== 0) throw new Error(`Publish dry-run failed; see ${directory}/publish-dry-run.log`);
const response = JSON.parse(dry.stdout);
const packed = Array.isArray(response) ? response[0] : response[name] ?? response;
if (packed.name !== name || packed.version !== pkg.version) throw new Error('Dry-run package identity mismatch.');
const result = {
  name, version: pkg.version, count: sources.count, tarball, directory,
  sha256: createHash('sha256').update(await readFile(tarball)).digest('hex'),
  dryRun: 'passed', published: false,
  next: 'Sign in to npm and confirm ownership of the selected scope before the launch publish.',
};
await writeFile(join(releases, 'latest.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
