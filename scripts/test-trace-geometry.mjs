import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { test } from "node:test";
import { load } from "cheerio";
import CanvasKitInit from "canvaskit-wasm";
import sharp from "sharp";
const kit = await CanvasKitInit();
const root = process.env.TRACE_GEOMETRY_ROOT ?? "public/traced/svg";
// A high image-overlap score previously hid chips in the circle. Check the
// actual high-resolution outline, independent of the image-match metric.
test("bracket circle has a constant radius without chips at any zoom", async () => {
  const svg = await readFile(
    `${root}/2nd-bracket-circle-solid-rounded.svg`,
    "utf8",
  );
  const $ = load(svg, { xmlMode: true });
  let maxDeviation = 0,
    found = false;
  for (const el of $("path").toArray()) {
    const path = kit.Path.MakeFromSVGString($(el).attr("d"));
    const iter = new kit.ContourMeasureIter(path, true, 4);
    for (let contour = iter.next(); contour; contour = iter.next()) {
      if (contour.length() > 60) {
        found = true;
        const radii = [];
        for (let s = 0; s < contour.length(); s += 0.025) {
          const p = contour.getPosTan(s);
          radii.push(Math.hypot(p[0] - 12, p[1] - 12));
        }
        maxDeviation = Math.max(
          maxDeviation,
          Math.max(...radii) - Math.min(...radii),
        );
      }
      contour.delete();
    }
    iter.delete();
    path.delete();
  }
  assert.ok(found, "circle outline must exist");
  assert.ok(
    maxDeviation < 0.012,
    `circle radius varies by ${maxDeviation.toFixed(4)} units: visible chips`,
  );
});
test("paired brackets remain symmetric in the circle", async () => {
  const svg = await readFile(
    `${root}/2nd-bracket-circle-solid-rounded.svg`,
    "utf8",
  );
  const { data, info } = await sharp(Buffer.from(svg), { density: 2304 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let mismatch = 0,
    total = 0;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      const a = data[(y * info.width + x) * 4 + 3],
        b = data[(y * info.width + info.width - 1 - x) * 4 + 3];
      mismatch += Math.abs(a - b);
      total += a;
    }
  assert.ok(
    mismatch / total < 0.001,
    `left/right mismatch ${((100 * mismatch) / total).toFixed(3)}%`,
  );
});

test("all bracket circles retain circular outer edges, including opacity variants", async () => {
  const manifest = JSON.parse(
    await readFile("public/traced/manifest.json", "utf8"),
  );
  let checked = 0;
  for (const entry of manifest.entries.filter((e) =>
    /^(1st|2nd)-bracket-circle$/.test(e.name),
  )) {
    const $ = load(await readFile(`${root}/${entry.id}.svg`, "utf8"), {
      xmlMode: true,
    });
    let found = false;
    for (const el of $("path").toArray()) {
      const path = kit.Path.MakeFromSVGString($(el).attr("d")),
        iter = new kit.ContourMeasureIter(path, true, 4);
      for (let contour = iter.next(); contour; contour = iter.next()) {
        if (contour.length() > 60) {
          found = true;
          const radii = [];
          for (let d = 0; d < contour.length(); d += 0.03) {
            const p = contour.getPosTan(d);
            radii.push(Math.hypot(p[0] - 12, p[1] - 12));
          }
          assert.ok(
            Math.max(...radii) - Math.min(...radii) < 0.012,
            `${entry.id}: circle is not round`,
          );
        }
        contour.delete();
      }
      iter.delete();
      path.delete();
    }
    assert.ok(found, `${entry.id}: missing circle`);
    checked++;
  }
  assert.equal(checked, 18);
});

test("printer body has straight, aligned edges and circular cutouts", async () => {
  const svg = await readFile(`${root}/3d-printer-solid-rounded.svg`, "utf8");
  const { data, info } = await sharp(Buffer.from(svg), { density: 2304 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alpha = (x, y) =>
    data[
      (Math.round((y * info.height) / 24) * info.width +
        Math.round((x * info.width) / 24)) *
        4 +
        3
    ];
  for (const y of [2, 4, 6, 8, 9]) {
    assert.ok(
      alpha(7.15, y) < 10 && alpha(7.35, y) > 245,
      `left edge bends at ${y}`,
    );
    assert.ok(
      alpha(16.65, y) > 245 && alpha(16.85, y) < 10,
      `right edge bends at ${y}`,
    );
  }
  for (const y of [5, 7.5]) {
    assert.equal(alpha(14, y), 0, "circular hole filled in");
    assert.ok(alpha(14.85, y) > 245, "hole extends beyond intended radius");
  }
});

test("sharp view frame retains square corners and straight edges", async () => {
  const svg = await readFile(`${root}/3-d-view-solid-sharp.svg`, "utf8");
  const { data, info } = await sharp(Buffer.from(svg), { density: 2304 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alpha = (x, y) =>
    data[
      (Math.round((y * info.height) / 24) * info.width +
        Math.round((x * info.width) / 24)) *
        4 +
        3
    ];
  assert.ok(alpha(1.6, 1.6) > 245, "outer square corner was rounded");
  assert.ok(alpha(3.6, 3.6) < 10, "inner square corner was rounded");
  for (const y of [4, 6, 8])
    assert.ok(
      alpha(1.4, y) < 10 && alpha(1.6, y) > 245,
      "vertical edge is uneven",
    );
});

test("every current batch entry has a reviewed shape model and independently matches its raster", async () => {
  const manifest = JSON.parse(
    await readFile("public/traced/manifest.json", "utf8"),
  );
  const batch = JSON.parse(await readFile("src/data/pro-review.json", "utf8"));
  const entries = batch.entries.map(expected => manifest.entries.find(entry => entry.id === expected.id));
  assert.equal(entries.length, 100);
  for (const entry of entries) {
    assert.ok(entry, "Missing approved first-batch icon");
    assert.equal(entry.geometry?.method, "shape-model", entry.id);
    const a = await sharp(`public${entry.imageUrl}`)
      .ensureAlpha()
      .raw()
      .toBuffer();
    const b = await sharp(await readFile(`${root}/${entry.id}.svg`))
      .resize(96, 96)
      .ensureAlpha()
      .raw()
      .toBuffer();
    let sum = 0,
      total = 0;
    for (let i = 3; i < a.length; i += 4) {
      sum += Math.min(a[i], b[i]);
      total += Math.max(a[i], b[i]);
    }
    assert.ok(
      sum / total >= 0.95,
      `${entry.id} lost significant source geometry`,
    );
  }
});
