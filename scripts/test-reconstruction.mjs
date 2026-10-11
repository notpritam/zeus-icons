import assert from "node:assert/strict";
import { test } from "node:test";
import CanvasKitInit from "canvaskit-wasm";
import sharp from "sharp";
import { fitCircle, regularizePath } from "./primitive-fit.mjs";
import { alphaLevels } from "./alpha-levels.mjs";
import { matchedCentrelines } from "./geometric-candidates.mjs";
import { traceSmooth } from "./trace-smooth.mjs";
const kit = await CanvasKitInit();
test("circle fitting repairs small raster dents with a constant analytic radius", () => {
  const points = Array.from({ length: 360 }, (_, i) => {
    const t = (i * Math.PI) / 180,
      r = 8 + (i > 70 && i < 76 ? -0.13 : 0.008 * Math.cos(24 * t));
    return [12 + r * Math.cos(t), 12 + r * Math.sin(t)];
  });
  const circle = fitCircle(points);
  assert.ok(circle);
  assert.equal(circle.r, 8);
  assert.equal(circle.x, 12);
  assert.equal(circle.y, 12);
  assert.match(circle.d, /A8 8/);
});
test("primitive fitting preserves opposite winding for circular cutouts and exact box corners", () => {
  const d = regularizePath(
    "M22 12A10 10 0 1 1 2 12A10 10 0 1 1 22 12Z M18 12A6 6 0 1 0 6 12A6 6 0 1 0 18 12Z M1 1H3V3H1Z",
    kit,
  );
  assert.equal(d.primitives.filter((p) => p.kind === "circle").length, 2);
  assert.match(d.d, /A10 10 0 1 1/);
  assert.match(d.d, /A6 6 0 1 0/);
  assert.match(d.d, /M1 1H3V3H1Z/);
});
test("squares and partial arcs are not falsely recognised as circles", () => {
  const p = [];
  for (let i = 0; i < 100; i++)
    p.push([i / 10, 0], [10, i / 10], [10 - i / 10, 10], [0, 10 - i / 10]);
  assert.equal(fitCircle(p), undefined);
  assert.equal(
    fitCircle(
      Array.from({ length: 100 }, (_, i) => [
        12 + 8 * Math.cos(i / 500),
        12 + 8 * Math.sin(i / 500),
      ]),
    ),
    undefined,
  );
});
test("50% arrow opacity is retained even when no opaque plateau exists", () => {
  const b = Buffer.alloc(96 * 96 * 4);
  for (let i = 0; i < 900; i++) b[i * 4 + 3] = 128;
  for (let i = 900; i < 1028; i++) b[i * 4 + 3] = i - 900;
  assert.deepEqual(alphaLevels(b), [128]);
});
test("centreline reuse rejects a visually different target reference", async () => {
  const data = await sharp(
    Buffer.from(
      '<svg width="96" height="96"><circle cx="48" cy="48" r="36"/></svg>',
    ),
  )
    .ensureAlpha()
    .raw()
    .toBuffer();
  const candidate = await matchedCentrelines(
    { style: "stroke-standard" },
    kit,
    [["path", { d: "M3 3L21 21", stroke: "currentColor", strokeWidth: 1.5 }]],
    data,
    96,
  );
  assert.equal(candidate, undefined);
});
test("sharp rectangular apertures survive the native curve fitter", async () => {
  const dimension = 384;
  const raw = await sharp(
    Buffer.from(
      '<svg width="384" height="384" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M2 2H22V22H2Z M6 6H18V18H6Z"/></svg>',
    ),
  )
    .ensureAlpha()
    .raw()
    .toBuffer();
  const fitted = await traceSmooth(raw, dimension, 127, kit, "solid-sharp");
  assert.equal(fitted.primitives.length, 2);
  const b = await sharp(
    Buffer.from(
      `<svg width="240" height="240" viewBox="0 0 24 24">${fitted.paths}</svg>`,
    ),
  )
    .ensureAlpha()
    .raw()
    .toBuffer();
  assert.equal(b[(120 * 240 + 120) * 4 + 3], 0);
  assert.equal(b[(25 * 240 + 25) * 4 + 3], 255);
});
test("signal bands are reconstructed as exact arcs joined to straight cuts", async () => {
  const raw = await sharp(
    Buffer.from(
      '<svg width="512" height="512" viewBox="0 0 24 24"><path d="M12 2A10 10 0 0 1 22 12H20A8 8 0 0 0 12 4Z"/></svg>',
    ),
  )
    .ensureAlpha()
    .raw()
    .toBuffer();
  const fitted = await traceSmooth(raw, 512, 127, kit, "stroke-sharp");
  const band = fitted.primitives.find((p) => p.kind === "arc-polygon");
  assert.ok(band, "arc-and-line model is missing");
  assert.equal(band.arcs, 2);
  assert.equal(band.lines, 2);
});
test("30% and 50% fills are separated from repeated antialiasing values", () => {
  const b = Buffer.alloc(96 * 96 * 4);
  for (let i = 0; i < 5000; i++) b[i * 4 + 3] = 76;
  for (let i = 5000; i < 5500; i++) b[i * 4 + 3] = 255;
  for (let i = 5500; i < 5521; i++) b[i * 4 + 3] = 171;
  assert.deepEqual(alphaLevels(b), [76, 255]);
});
test("small 64% overlap regions survive beside a much larger opaque region", () => {
  const b = Buffer.alloc(96 * 96 * 4);
  for (let i = 0; i < 6000; i++) b[i * 4 + 3] = 255;
  for (let y = 75; y < 81; y++)
    for (let x = 20; x < 30; x++) b[(y * 96 + x) * 4 + 3] = 163;
  assert.deepEqual(alphaLevels(b), [163, 255]);
});
