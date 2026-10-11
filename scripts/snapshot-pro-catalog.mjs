import { load } from "cheerio";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
const root = ".cache/pro-catalog";
await mkdir(root, { recursive: true });
const allowed = new Set([
  "solid-sharp",
  "stroke-sharp",
  "bulk-rounded",
  "solid-rounded",
  "twotone-rounded",
  "duotone-rounded",
  "duotone-standard",
  "solid-standard",
  "stroke-standard",
]);
async function page(number) {
  const file = `${root}/page-${number}.json`;
  if (!process.argv.includes("--refresh"))
    try {
      return JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  const url = `https://hugeicons.com/icons?page=${number}`;
  let html;
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (response.status === 429 || response.status >= 500) {
      await delay(2000 * (attempt + 1));
      continue;
    }
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    html = await response.text();
    break;
  }
  if (!html) throw new Error(`Unable to fetch page ${number}`);
  const $ = load(html);
  const hydration = $("script")
    .toArray()
    .map((e) => $(e).text())
    .filter((s) => s.startsWith("self.__next_f.push("))
    .map((s) => JSON.parse(s.slice("self.__next_f.push(".length, -1))[1])
    .filter((s) => typeof s === "string")
    .join("");
  const icons = [...hydration.matchAll(/"icon":(\{[^}]+\})/g)].map((m) =>
    JSON.parse(m[1]),
  );
  const pagination = [
    ...hydration.matchAll(/"paginationData":(\{[^}]+\})/g),
  ].map((m) => JSON.parse(m[1]))[0];
  const cards = $('a[href^="/icon/"]').toArray();
  if (
    pagination?.page !== number ||
    !icons.length ||
    icons.length > 100 ||
    cards.length !== icons.length
  )
    throw new Error(`Invalid page ${number}`);
  const entries = icons.flatMap((icon, index) => {
    const card = $(cards[index]),
      style = `${icon.style}-${icon.type}`,
      paid = style !== "stroke-rounded";
    const previewUrl = card.find("img").attr("src"),
      preview = new URL(previewUrl);
    if (
      card.text().includes("PRO") !== paid ||
      decodeURIComponent(card.attr("href")) !== `/icon/${icon.name}` ||
      preview.origin !== "https://ico.hugeicons.com" ||
      decodeURIComponent(preview.pathname) !== `/${icon.uuid}@2x.webp`
    )
      throw new Error(`Metadata mismatch: ${icon.uuid}`);
    if (!paid) return [];
    if (!allowed.has(style)) throw new Error(`Unknown style ${style}`);
    return [
      {
        id: icon.uuid,
        name: icon.name,
        category: icon.category,
        style,
        sourcePage: number,
        sourcePosition: index + 1,
        sourceUrl: `https://hugeicons.com/icon/${icon.name}?style=${style}`,
        previewUrl,
      },
    ];
  });
  const result = {
    url,
    capturedAt: new Date().toISOString(),
    pagination,
    total: icons.length,
    entries,
  };
  await writeFile(`${file}.tmp`, JSON.stringify(result));
  await rename(`${file}.tmp`, file);
  await delay(200);
  return result;
}
const first = await page(1);
const totalPages = first.pagination.totalPages;
if (!Number.isInteger(totalPages) || totalPages < 1 || totalPages > 2000)
  throw new Error(`Unexpected pagination ${JSON.stringify(first.pagination)}`);
const pages = [first];
let next = 2;
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (next <= totalPages) {
      const n = next++;
      pages.push(await page(n));
      if (n % 20 === 0) console.log(`Captured ${n}/${totalPages} pages`);
    }
  }),
);
pages.sort((a, b) => a.pagination.page - b.pagination.page);
const entries = pages
  .flatMap((p) => p.entries)
  .map((e, i) => ({ ...e, number: i + 1 }));
if (new Set(entries.map((e) => e.id)).size !== entries.length)
  throw new Error("Duplicate variant IDs");
const names = new Map();
for (const e of entries) {
  if (!names.has(e.name)) names.set(e.name, new Set());
  names.get(e.name).add(e.style);
}
for (const [name, styles] of names)
  if (styles.size !== allowed.size)
    throw new Error(`Incomplete style inventory: ${name}`);
if (pages.reduce((n, p) => n + p.total, 0) !== first.pagination.total * 10)
  throw new Error("Catalogue total disagrees with pagination");
const counts = Object.fromEntries(
  [...allowed].map((style) => [
    style,
    entries.filter((e) => e.style === style).length,
  ]),
);
const snapshot = {
  batch: "pro-all",
  capturedAt: pages
    .map((page) => page.capturedAt)
    .sort()
    .at(-1),
  verifiedAt: new Date().toISOString(),
  pages: pages.map((p) => p.url),
  unit: "paid style variant",
  excludedStyle: "stroke-rounded",
  websiteTotal: pages.reduce((n, p) => n + p.total, 0),
  count: entries.length,
  uniqueNames: new Set(entries.map((e) => e.name)).size,
  styles: counts,
  entries,
};
await writeFile(
  `${root}/catalog.json.tmp`,
  JSON.stringify(snapshot, null, 2) + "\n",
);
await rename(`${root}/catalog.json.tmp`, `${root}/catalog.json`);
console.log(
  JSON.stringify({ ...snapshot, entries: undefined, pages: undefined }),
);
