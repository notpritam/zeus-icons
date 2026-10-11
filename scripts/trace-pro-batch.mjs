import { basename } from "node:path";
import { gzipSync } from "node:zlib";
import { Worker } from "node:worker_threads";
import { browserCatalog } from './browser-catalog.mjs';
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  access,
  copyFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
const input = process.argv[2] ?? "src/data/pro-review.json";
const batch = JSON.parse(await readFile(input, "utf8"));
const cache = ".cache/generated";
await mkdir(cache, { recursive: true });
await mkdir(`${cache}/staging`, { recursive: true });
const key = (e) =>
  /^[a-z\d-]+$/.test(e.id)
    ? e.id
    : `variant-${createHash("sha256").update(e.id).digest("hex").slice(0, 24)}`;
const algorithm = "geometry-first-v4",
  merged = new Map(),
  failures = [];
let previous;
try {
  previous = JSON.parse(await readFile("public/traced/manifest.json", "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const inventory = new Set(batch.entries.map((entry) => entry.id));
for (const e of previous?.entries ?? []) {
  if (batch.batch !== "pro-all" || inventory.has(e.id)) merged.set(e.id, e);
}
const queue = [];
for (const e of batch.entries) {
  let cached;
  try {
    cached = JSON.parse(await readFile(`${cache}/${key(e)}.json`, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const old = cached ?? merged.get(e.id);
  if (
    old &&
    (old.algorithm === algorithm || old.geometry?.method === "shape-model") &&
    !process.argv.includes("--force")
  ) {
    try {
      await access(`public${old.svgUrl}`);
      await access(`public${old.imageUrl}`);
      merged.set(e.id, old);
      continue;
    } catch {
      /* Regenerate missing assets. */
      merged.delete(e.id);
    }
  }
  queue.push(e);
}
let done = 0,
  next = 0,
  lastCheckpoint = 0;
const publish = process.argv.includes("--publish");
await mkdir("public/traced", { recursive: true });
if (publish) {
  await mkdir("dist/traced/svg", { recursive: true });
  await mkdir("dist/traced/images", { recursive: true });
  for (const e of merged.values())
    for (const url of [e.svgUrl, e.imageUrl]) {
      try {
        await access(`dist${url}`);
      } catch {
        await copyFile(`public${url}`, `dist${url}`);
      }
    }
}
async function atomic(file, value) {
  const temporary = `${cache}/staging/${basename(file)}.tmp`;
  await writeFile(temporary, JSON.stringify(value) + "\n");
  await rename(temporary, file);
}
async function checkpoint() {
  const entries = [...merged.values()].sort(
    (a, b) => (a.number ?? 0) - (b.number ?? 0),
  );
  const unresolved = new Map(
    (previous?.failures ?? [])
      .filter((f) => !inventory.has(f.id))
      .map((f) => [f.id, f]),
  );
  for (const failure of failures) unresolved.set(failure.id, failure);
  const manifest = {
    version: 3,
    batch: previous?.batch === "pro-all" ? "pro-all" : batch.batch,
    lastBatch: batch.batch,
    algorithm,
    generatedAt: new Date().toISOString(),
    requested: Math.max(previous?.requested ?? 0, batch.entries.length),
    count: entries.length,
    ready: entries.filter((e) => e.status === "ready").length,
    failures: [...unresolved.values()],
    entries,
  };
  await atomic("public/traced/manifest.json", manifest);
  const catalog = {
    packed: 1,
    count: manifest.count,
    requested: manifest.requested,
    ready: manifest.ready,
    entries: entries.map((e) => [
      e.name,
      e.style,
      e.category,
      key(e),
      e.overlap,
      e.paths,
      e.status,
      e.geometry?.method ?? "pixel-trace",
      e.sourceWidth,
      e.sourceHeight,
      e.imageUrl,
      e.svgSha256,
    ]),
  };
  // Keep v1 for open tabs. New clients avoid repeated image URL strings and
  // receive only the short revision needed to invalidate their SVG cache.
  const compactCatalog = {
    ...catalog,
    packed: 2,
    entries: catalog.entries.map((row) => {
      const compact = [...row];
      if (String(compact[10]).endsWith(`${compact[3]}-reference.webp`))
        compact[10] = ":";
      compact[11] = String(compact[11]).slice(0, 12);
      return compact;
    }),
  };
  const progress = {
    count: manifest.count,
    requested: manifest.requested,
    ready: manifest.ready,
    failed: manifest.failures.length,
    finished: done === queue.length,
    complete: done === queue.length && manifest.failures.length === 0,
    remaining: queue.length - done,
    generatedAt: manifest.generatedAt,
  };
  await atomic("public/traced/catalog.json", catalog);
  await writeFile(
    `${cache}/staging/catalog.json.gz.tmp`,
    gzipSync(JSON.stringify(catalog) + "\n"),
  );
  await rename(
    `${cache}/staging/catalog.json.gz.tmp`,
    "public/traced/catalog.json.gz",
  );
  await atomic("public/traced/catalog-v2.json", compactCatalog);
  const browser = browserCatalog(manifest);
  await atomic('public/traced/catalog-v3.json', browser);
  await writeFile('public/traced/catalog-v3.json.gz', gzipSync(JSON.stringify(browser)));
  await writeFile(
    `${cache}/staging/catalog-v2.json.gz.tmp`,
    gzipSync(JSON.stringify(compactCatalog) + "\n"),
  );
  await rename(
    `${cache}/staging/catalog-v2.json.gz.tmp`,
    "public/traced/catalog-v2.json.gz",
  );
  await atomic("public/traced/progress.json", progress);
  if (publish) {
    for (const name of [
      "catalog.json",
      "catalog.json.gz",
      "catalog-v2.json",
      "catalog-v2.json.gz",
      "catalog-v3.json",
      "catalog-v3.json.gz",
      "progress.json",
    ]) {
      await copyFile(`public/traced/${name}`, `dist/traced/${name}.tmp`);
      await rename(`dist/traced/${name}.tmp`, `dist/traced/${name}`);
    }
  }
  if (publish) {
    await copyFile(
      "public/traced/manifest.json",
      "dist/traced/manifest.json.tmp",
    );
    await rename("dist/traced/manifest.json.tmp", "dist/traced/manifest.json");
  }
  console.log(
    JSON.stringify({
      time: new Date().toISOString(),
      requested: batch.entries.length,
      built: entries.length,
      ready: manifest.ready,
      remaining: queue.length - done,
      failures: failures.length,
    }),
  );
}
console.log(
  `Resuming ${merged.size} outputs; processing ${queue.length} variants`,
);
// Serialize publication independently of workers; a checkpoint never advertises
// a file before that file has been durably written and copied to the preview.
let writes = Promise.resolve();
await Promise.all(
  Array.from(
    { length: Math.min(Number(process.env.TRACE_WORKERS ?? 8), queue.length) },
    () =>
      new Promise((resolve, reject) => {
        const worker = new Worker(
          new URL("./trace-pro-worker.mjs", import.meta.url),
        );
        const dispatch = () => {
          if (next >= queue.length) {
            void worker.terminate().then(resolve);
            return;
          }
          worker.postMessage(queue[next++]);
        };
        worker.on("error", reject);
        worker.on("message", (message) => {
          writes = writes.then(async () => {
            if (message.result) {
              const e = message.result;
              await atomic(`${cache}/${key(e)}.json`, e);
              if (publish) {
                for (const url of [e.svgUrl, e.imageUrl]) {
                  const temporary = `${cache}/staging/dist-${basename(url)}.tmp`;
                  await copyFile(`public${url}`, temporary);
                  await rename(temporary, `dist${url}`);
                }
              }
              merged.set(e.id, e);
            } else {
              failures.push(message.failure);
              console.error(JSON.stringify(message.failure));
            }
            done++;
            if (done - lastCheckpoint >= 250) {
              lastCheckpoint = done;
              await checkpoint();
            }
          });
          writes.then(dispatch, reject);
        });
        dispatch();
      }),
  ),
);
await writes;
await checkpoint();
if (failures.length) process.exitCode = 1;
