import { load } from 'cheerio';
import { mkdir, writeFile } from 'node:fs/promises';

// Public listing metadata only. Pro source packages/SVGs are never requested.
const entries = [];
const pages = [];
const allowed = new Set(['solid-sharp', 'stroke-sharp', 'bulk-rounded', 'solid-rounded', 'twotone-rounded', 'duotone-rounded', 'duotone-standard', 'solid-standard', 'stroke-standard']);
for (let page = 1; entries.length < 100; page++) {
  if (page > 3) throw new Error('Unexpected listing structure; inspect upstream before continuing.');
  const url = `https://hugeicons.com/icons${page === 1 ? '' : `?page=${page}`}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Listing returned ${response.status}: ${url}`);
  const $ = load(await response.text());
  const hydration = $('script').toArray().map(element => $(element).text())
    .filter(script => script.startsWith('self.__next_f.push('))
    .map(script => JSON.parse(script.slice('self.__next_f.push('.length, -1))[1])
    .filter(value => typeof value === 'string').join('');
  const icons = [...hydration.matchAll(/"icon":(\{[^}]+\})/g)].map(match => JSON.parse(match[1]));
  const pagination = [...hydration.matchAll(/"paginationData":(\{[^}]+\})/g)].map(match => JSON.parse(match[1]))[0];
  const cards = $('a[href^="/icon/"]').toArray();
  if (pagination?.page !== page || icons.length !== 100 || cards.length !== icons.length) throw new Error(`Unexpected page ${page} metadata/card count.`);
  pages.push(url);
  for (const [index, icon] of icons.entries()) {
    const card = $(cards[index]);
    const style = `${icon.style}-${icon.type}`;
    const paid = style !== 'stroke-rounded';
    const previewUrl = card.find('img').attr('src');
    const preview = new URL(previewUrl);
    if (card.text().includes('PRO') !== paid || card.attr('href') !== `/icon/${icon.name}` || preview.origin !== 'https://ico.hugeicons.com' || preview.pathname !== `/${icon.uuid}@2x.webp`) throw new Error(`Card and metadata disagree: ${icon.uuid}`);
    if (!paid) continue;
    if (!allowed.has(style)) throw new Error(`Unknown paid style: ${style}`);
    if (entries.length === 100) break;
    entries.push({ number: entries.length + 1, id: icon.uuid, name: icon.name, category: icon.category, style, sourcePage: page, sourcePosition: index + 1, sourceUrl: `https://hugeicons.com/icon/${icon.name}?style=${style}`, previewUrl });
  }
}
if (new Set(entries.map(entry => entry.id)).size !== 100) throw new Error('Duplicate variants in batch.');
const snapshot = { batch: 'pro-001', capturedAt: new Date().toISOString(), pages, unit: 'paid style variant', excludedStyle: 'stroke-rounded', count: entries.length, uniqueNames: new Set(entries.map(entry => entry.name)).size, entries };
await mkdir(new URL('../src/data/', import.meta.url), { recursive: true });
await writeFile(new URL('../src/data/pro-review.json', import.meta.url), JSON.stringify(snapshot, null, 2) + '\n');
console.log(`Captured ${snapshot.count} paid variants / ${snapshot.uniqueNames} names. ${entries[0].id} → ${entries.at(-1).id}. No Pro source artwork downloaded.`);
