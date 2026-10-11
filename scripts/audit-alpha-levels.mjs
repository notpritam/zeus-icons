import { readFile, writeFile, mkdir } from "node:fs/promises";
import sharp from "sharp";
import { alphaLevels } from "./alpha-levels.mjs";
sharp.concurrency(1);
const manifest = JSON.parse(
  await readFile("public/traced/manifest.json", "utf8"),
);
const mismatches = [];
let next = 0;
await Promise.all(
  Array.from({ length: 12 }, async () => {
    while (next < manifest.entries.length) {
      const e = manifest.entries[next++];
      if (e.geometry?.method === "shape-model") continue;
      const data = await sharp(`public${e.imageUrl}`)
        .ensureAlpha()
        .raw()
        .toBuffer();
      const actual = alphaLevels(data);
      if (JSON.stringify(actual) !== JSON.stringify(e.alphaLevels))
        mismatches.push({ ...e, expectedAlphaLevels: actual });
    }
  }),
);
await mkdir(".local/tracing", { recursive: true });
await writeFile(
  ".local/tracing/alpha-repairs.json",
  JSON.stringify(
    { batch: "alpha-repair", count: mismatches.length, entries: mismatches },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    checked: manifest.entries.length,
    affected: mismatches.length,
    examples: mismatches
      .slice(0, 12)
      .map((e) => ({
        id: e.id,
        was: e.alphaLevels,
        expected: e.expectedAlphaLevels,
      })),
  }),
);
