import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

// Exercise the actual built, lazily loaded vector converter in Chromium.
const base = process.argv[2] ?? 'http://127.0.0.1:8937';
const catalog = JSON.parse(await readFile('public/catalog.json', 'utf8'));
const chunk = (await readdir('dist/assets')).find(name => /^outline-svg-.*\.js$/.test(name));
if (!chunk) throw new Error('Run npm run build first.');
const inputs = await Promise.all(catalog.icons.map(async icon => ({ id: icon.id, svg: await readFile(`public${icon.localUrl}`, 'utf8') })));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(base);
  const result = await page.evaluate(async ({ inputs, chunk }) => {
    const { outlineSvg } = await import(`/assets/${chunk}`);
    async function raster(svg) {
      const image = new Image(); image.src = `data:image/svg+xml,${encodeURIComponent(svg)}`; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 96;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0, 96, 96);
      return context.getImageData(0, 0, 96, 96).data;
    }
    let checked = 0, worst = { id: '', overlap: 1 }, failures = [];
    for (let index = 0; index < inputs.length; index++) {
      const { id, svg } = inputs[index];
      // Every package icon at its default; primitives/transforms/opacity and a
      // distributed sample additionally cover minimum and maximum stroke presets.
      const widths = /<(?:circle|ellipse|rect)\b|transform=|opacity=/.test(svg) || index % 97 === 0 ? [0.5, 1.5, 3] : [1.5];
      for (const width of widths) {
        try {
          const source = svg.replace(/stroke-width="[^"]*"/g, `stroke-width="${width}"`);
          const outlined = await outlineSvg(source);
          if (/\bstroke(?:-width)?=/.test(outlined)) throw new Error('Output still contains strokes');
          const [a, b] = await Promise.all([raster(source), raster(outlined)]);
          let intersection = 0, union = 0;
          for (let i = 3; i < a.length; i += 4) { intersection += Math.min(a[i], b[i]); union += Math.max(a[i], b[i]); }
          const overlap = union ? intersection / union : 0;
          if (overlap < worst.overlap) worst = { id, width, overlap };
          if (overlap < .97) throw new Error(`Alpha overlap ${(100 * overlap).toFixed(3)}% < 97%`);
          checked++;
        } catch (error) { failures.push({ id, width, error: String(error) }); }
      }
    }
    return { checked, worst, failures };
  }, { inputs, chunk });
  await mkdir('.local/style-correction', { recursive: true });
  await writeFile('.local/style-correction/export-audit.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ icons: inputs.length, ...result, failures: result.failures.slice(0, 15) }, null, 2));
  if (result.failures.length) process.exitCode = 1;
} finally { await browser.close(); }
