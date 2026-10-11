import { alphaLevels } from "./alpha-levels.mjs";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import sharp from "sharp";
import { traceSmooth } from "./trace-smooth.mjs";
import { matchedCentrelines } from "./geometric-candidates.mjs";
import CanvasKitInit from "canvaskit-wasm";
import { load } from "cheerio";
import { constructBrackets } from "./geometric-brackets.mjs";
import { constructSymbol } from "./geometric-symbols.mjs";

// Produces reviewable approximations from public rasters. No original Pro SVG
// packages are accessed. Generated artwork is NOT part of the MIT free pack.
const root = "public/traced";
await mkdir(`${root}/images`, { recursive: true });
await mkdir(`${root}/svg`, { recursive: true });
await mkdir(".cache/generated/staging", { recursive: true });
sharp.concurrency(1);
const kit = await CanvasKitInit();
const hash = (buffer) => createHash("sha256").update(buffer).digest("hex");
export const algorithm = "geometry-first-v4";
export const assetKey = (entry) =>
  /^[a-z\d-]+$/.test(entry.id)
    ? entry.id
    : `variant-${hash(entry.id).slice(0, 24)}`;
async function imageBytes(entry) {
  const file = `${root}/images/${assetKey(entry)}-reference.webp`;
  try {
    return await readFile(file);
  } catch {
    /* First download. */
  }
  const source = new URL(entry.previewUrl);
  if (source.origin !== "https://ico.hugeicons.com")
    throw new Error("Unexpected reference host");
  source.pathname = source.pathname.replace("@2x.webp", "-512.webp");
  source.search = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    let response = await fetch(source, {
      signal: AbortSignal.timeout(30000),
    });
    if (response.status === 404) {
      const fallback = new URL(entry.previewUrl);
      fallback.pathname = fallback.pathname.replace("@2x.webp", "@3x.webp");
      response = await fetch(fallback, { signal: AbortSignal.timeout(30000) });
    }
    if (response.status === 429 || response.status >= 500) {
      await delay(1000 * (attempt + 1));
      continue;
    }
    if (
      !response.ok ||
      !response.headers.get("content-type")?.startsWith("image/")
    )
      throw new Error(`Image returned ${response.status}: ${entry.id}`);
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length > 2_000_000)
      throw new Error("Unexpectedly large reference");
    await sharp(data).metadata();
    const temporary = `.cache/generated/staging/${assetKey(entry)}.webp.tmp`;
    await writeFile(temporary, data);
    await rename(temporary, file);
    await delay(100);
    return data;
  }
  throw new Error(`Reference unavailable: ${entry.id}`);
}
async function trace(entry, bytes) {
  const { data: original, info } = await sharp(bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== info.height || info.width < 48 || info.width > 1024)
    throw new Error("Unexpected reference dimensions");
  const levels = alphaLevels(original);
  // Upsampling reduces short-segment curve fitting artifacts; it adds no detail.
  const dimension = info.width >= 256 ? info.width : info.width * 4;
  const raw = await sharp(bytes)
    .resize(dimension, dimension, { kernel: "cubic" })
    .ensureAlpha()
    .raw()
    .toBuffer();
  let nodes;
  try {
    nodes = JSON.parse(
      await readFile(`public/reference/${entry.name}.json`, "utf8"),
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  let model = constructBrackets(entry, kit);
  if (!model) {
    model = constructSymbol(entry, kit, nodes);
  }
  if (!model) {
    try {
      model = await matchedCentrelines(entry, kit, nodes, original, info.width);
    } catch {
      /* A candidate is optional; reconstruct from this reference instead. */
    }
  }
  const groups = model?.groups ?? [];
  const primitives = [];
  let unmodelled = 0;
  for (let index = 0; index < (model ? 0 : levels.length); index++) {
    const previous = levels[index - 1] ?? 0,
      level = levels[index];
    const cutoff = (previous + level) / 2;
    const fitted = await traceSmooth(raw, dimension, cutoff, kit, entry.style);
    primitives.push(...fitted.primitives);
    unmodelled += fitted.unmodelled;
    const opacity = (level - previous) / (255 - previous);
    groups.push(
      `<g fill="currentColor" opacity="${Number(opacity.toFixed(5))}">${fitted.paths}</g>`,
    );
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${groups.join("")}</svg>`;
  const rendered = await sharp(Buffer.from(svg))
    .resize(info.width, info.height)
    .ensureAlpha()
    .raw()
    .toBuffer();
  let intersection = 0,
    union = 0;
  for (let i = 3; i < original.length; i += 4) {
    intersection += Math.min(original[i], rendered[i]);
    union += Math.max(original[i], rendered[i]);
  }
  const overlap = Number(((100 * intersection) / union).toFixed(3));
  if (model && overlap < 90)
    throw new Error(
      `Geometric model diverges from reference: ${entry.id} (${overlap}%)`,
    );
  const geometry = model?.geometry ?? {
    method: "fitted-contours",
    primitives,
    unmodelledContours: unmodelled,
    constraints: [
      "corner-aware-curves",
      "complete-circle-fitting",
      "straight-rectangular-edges",
    ],
    reviewReason:
      "Unrecognised contours need review; image overlap alone does not validate intended geometry.",
  };
  const notice = `Generated image trace; not the original Hugeicons Pro SVG.\nSource: ${entry.sourceUrl}\nReference artwork: Hugeicons. Not covered by the application's MIT license.\nAlgorithm: ${algorithm}; method: ${geometry.method}; source ${info.width}x${info.height}; alpha overlap ${overlap}%.`;
  const document = `<!-- ${notice} -->\n${svg}\n`;
  const temporary = `.cache/generated/staging/${assetKey(entry)}.svg.tmp`;
  await writeFile(temporary, document);
  await rename(temporary, `${root}/svg/${assetKey(entry)}.svg`);
  return {
    ...entry,
    svgUrl: `/traced/svg/${assetKey(entry)}.svg`,
    imageUrl: `/traced/images/${assetKey(entry)}-reference.webp`,
    sourceWidth: info.width,
    sourceHeight: info.height,
    alphaLevels: levels,
    sourceSha256: hash(bytes),
    svgSha256: hash(document),
    overlap,
    paths: groups.join("").match(/<path/g).length,
    geometry,
    algorithm,
    generatedAt: new Date().toISOString(),
    status: model && overlap >= 95 ? "ready" : "needs-review",
  };
}
export async function generateIcon(entry) {
  if (
    entry.style === "stroke-rounded" ||
    /[\/\\\0]/.test(entry.id) ||
    /[\/\\\0]/.test(entry.name)
  )
    throw new Error("Invalid Pro variant identity");
  return trace(entry, await imageBytes(entry));
}
