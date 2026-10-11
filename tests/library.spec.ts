import { test, expect, type Download, type Page } from '@playwright/test';

async function bytes(download: Download): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  return Buffer.concat(chunks);
}
async function exportFile(page: Page, format: string): Promise<Buffer> {
  await page.getByRole('button', { name: 'Download format', exact: true }).click();
  await page.getByRole('menuitemradio', { name: format, exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: `Download ${format}`, exact: true }).click();
  return bytes(await download);
}
async function openIcon(page: Page, id = 'home-01') {
  await page.goto(`/?library=1&selected=${id}&variant=stroke-rounded`);
  await expect(page.getByTestId('icon-preview')).toBeVisible();
}

test('original taxonomy, real free count, filters, pagination and deep links', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.library-results-heading')).toContainText('6,025 icons');
  await expect(page.locator('.library-card')).toHaveCount(80);
  for (const [family, names] of [['Rounded', ['Bulk', 'Solid', 'Twotone', 'Duotone', 'StrokeFree']], ['Standard', ['Duotone', 'Solid', 'Stroke']], ['Sharp', ['Solid', 'Stroke']]] as const) {
    expect((await page.getByRole('group', { name: family, exact: true }).getByRole('button').allTextContents()).map(text => text.replace(/\s/g, ''))).toEqual(names);
  }
  await expect(page.getByRole('button', { name: 'Offset', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Next collection page' }).click();
  await expect(page.locator('.library-pagination')).toContainText('81–160');
  await page.getByRole('group', { name: 'Sharp', exact: true }).getByRole('button', { name: 'Solid', exact: true }).click();
  await expect(page.locator('.library-results-heading h1')).toHaveText('Solid Sharp icons');
  await expect(page.locator('.library-results-heading')).toContainText('Pro styles');
  await page.getByLabel('Search collection').fill('home-01');
  await expect(page.locator('.library-card')).toHaveCount(2);
  await page.reload();
  await expect(page.getByLabel('Search collection')).toHaveValue('home-01');
  await expect(page.getByRole('group', { name: 'Sharp', exact: true }).getByRole('button', { name: 'Solid', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Search collection').fill('does-not-exist-xyz');
  await expect(page.getByText('No matching icons', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await page.getByRole('button', { name: 'Categories', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Home / }).click();
  await expect(page.locator('.library-results-heading h1')).toHaveText('Home');
  await expect(page.locator('.library-results-heading')).toContainText('24 icons');
  await expect(page.getByRole('link', { name: 'Download free icons' })).toHaveAttribute('href', '/free-icons.zip');
});

test('exact presets, editable Hex/RGBA, reset and exported customization', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openIcon(page);
  await expect(page.getByRole('combobox', { name: 'Stroke', exact: true })).toHaveText('1.5 ⌄');
  await expect(page.getByTestId('icon-preview')).toHaveAttribute('width', '24');
  await page.getByRole('combobox', { name: 'Stroke', exact: true }).click();
  await expect(page.getByRole('option')).toHaveText(['0.5', '1', '1.5✓', '2', '3']);
  await page.getByRole('option', { name: '3', exact: true }).click();
  await page.getByRole('button', { name: 'Icon color', exact: true }).click();
  await page.getByLabel('Hex', { exact: true }).fill('3456ab');
  await page.getByLabel('Hex', { exact: true }).press('Enter');
  await expect(page.getByRole('spinbutton', { name: 'R', exact: true })).toHaveValue('52');
  await page.getByRole('spinbutton', { name: 'G', exact: true }).fill('100');
  await page.getByRole('spinbutton', { name: 'G', exact: true }).press('Enter');
  await page.getByRole('spinbutton', { name: 'A', exact: true }).fill('50');
  await page.getByRole('spinbutton', { name: 'A', exact: true }).press('Enter');
  await page.keyboard.press('Escape');
  const svg = (await exportFile(page, 'svg stroked')).toString();
  expect(svg).toContain('width="24"'); expect(svg).toContain('stroke="#3464ab"'); expect(svg).toContain('stroke-width="3"'); expect(svg).toContain('opacity="0.5"');
  expect(svg).toContain('MIT License'); expect(svg).toContain('2025 Hugeicons');
  await page.getByRole('button', { name: 'Copy svg stroked', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('SVG STROKED copied.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(svg);
  const png = await exportFile(page, 'png');
  expect(png.subarray(1, 4).toString()).toBe('PNG'); expect(png.readUInt32BE(16)).toBe(24); expect(png.readUInt32BE(20)).toBe(24);
  const react = (await exportFile(page, 'react')).toString();
  expect(react).toContain('function Home01StrokeRoundedIcon('); expect(react).toContain('strokeWidth="3"'); expect(react).toContain('{...props}');
  expect(react).toContain('color = "#3464ab"'); expect(react).toContain('stroke="currentColor"');
  await page.getByRole('button', { name: 'Copy format', exact: true }).click();
  await expect(page.getByRole('menuitemradio')).toHaveText(['svg stroked✓', 'svg outlined', 'png', 'jsx', 'react', 'flutter']);
  await page.getByRole('menuitemradio', { name: 'jsx', exact: true }).click();
  await page.getByRole('button', { name: 'Copy jsx', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('JSX copied.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('strokeLinecap="round"');
  await page.getByRole('button', { name: 'Copy format', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'png', exact: true }).click();
  await page.getByRole('button', { name: 'Copy png', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('PNG copied.');
  const clipboardPng = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    const image = await createImageBitmap(await items[0].getType('image/png'));
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0); image.close();
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let maxAlpha = 0, pixel = [0, 0, 0];
    for (let i = 3; i < data.length; i += 4) if (data[i] > maxAlpha) { maxAlpha = data[i]; pixel = [data[i-3], data[i-2], data[i-1]]; }
    return { width: canvas.width, maxAlpha, pixel };
  });
  expect(clipboardPng.width).toBe(24); expect(clipboardPng.maxAlpha).toBe(128);
  for (const [i, channel] of [52, 100, 171].entries()) expect(Math.abs(clipboardPng.pixel[i] - channel)).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Copy format', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'flutter', exact: true }).click();
  await page.getByRole('button', { name: 'Copy flutter', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('FLUTTER copied.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('class Home01StrokeRoundedIcon extends StatelessWidget');
  await page.getByRole('button', { name: 'Reset to default', exact: true }).click();
  await expect(page.getByTestId('icon-preview')).toHaveAttribute('width', '24');
  await expect(page.getByRole('button', { name: 'Icon color', exact: true })).toHaveText('currentColor');
  await expect(page.getByRole('combobox', { name: 'Stroke', exact: true })).toHaveText('1.5 ⌄');
});

test('outlined SVG contains filled paths and matches the stroked preview', async ({ page }) => {
  await openIcon(page);
  const source = decodeURIComponent((await page.getByTestId('icon-preview').getAttribute('src'))!.split(',')[1]);
  const outlined = (await exportFile(page, 'svg outlined')).toString();
  expect(outlined).not.toContain('stroke='); expect(outlined).not.toContain('stroke-width='); expect(outlined).toContain('<path');
  const overlap = await page.evaluate(async ([left, right]) => {
    async function render(svg: string) {
      const img = new Image(); img.src = `data:image/svg+xml,${encodeURIComponent(svg)}`; await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0, 256, 256); return ctx.getImageData(0, 0, 256, 256).data;
    }
    const [a, b] = await Promise.all([render(left), render(right)]); let intersection = 0, union = 0;
    for (let i = 3; i < a.length; i += 4) { intersection += Math.min(a[i], b[i]); union += Math.max(a[i], b[i]); }
    return intersection / union;
  }, [source, outlined]);
  expect(overlap).toBeGreaterThan(.985);
});

test('all nine generated Pro styles keep controls, vector previews and original names', async ({ page }) => {
  await openIcon(page);
  const labels = ['Stroke Standard', 'Solid Standard', 'Duotone Standard', 'Duotone Rounded', 'Twotone Rounded', 'Solid Rounded', 'Bulk Rounded', 'Stroke Sharp', 'Solid Sharp'];
  await expect(page.getByLabel('Choose icon style').getByRole('button')).toHaveCount(10);
  for (const name of labels) {
    await page.getByRole('button', { name: `Use ${name} style`, exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Generated SVG');
    await expect(page.getByRole('combobox', { name: 'Stroke', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Download svg outlined', exact: true })).toBeEnabled();
    await expect(page.getByTestId('icon-preview')).toBeVisible();
    await expect(page.getByRole('link', { name: 'View on Hugeicons' })).toHaveAttribute('href', `https://hugeicons.com/icon/home-01?style=${name.toLowerCase().replace(' ', '-')}`);
  }
  await expect(page).toHaveURL(/variant=solid-sharp/);
  await page.reload();
  await expect(page.getByRole('dialog')).toContainText('Solid Sharp');
  await page.getByRole('button', { name: 'Use Stroke Rounded style', exact: true }).click();
  await expect(page.getByTestId('icon-preview')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download svg stroked', exact: true })).toBeEnabled();
});

test('mobile controls and fitted preview work without a workbench', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/'); await expect(page.locator('.library-card')).toHaveCount(80);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Categories', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Home / }).click();
  await page.locator('.library-card').first().click();
  const dialog = page.getByRole('dialog');
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.getByRole('button', { name: 'Icon color', exact: true }).click();
  await expect(page.getByLabel('Hex', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toHaveCount(0);
  expect((await page.getByTestId('icon-preview').boundingBox())!.height).toBeGreaterThan(190);
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(page.locator('.library-results-heading h1')).toHaveText('Home');
});

test('retired links normalize, missing SVG responses recover, retired artifacts are 404', async ({ page, request }) => {
  await page.route('**/icons/home-01.svg', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<html>Missing</html>' }));
  await page.goto('/?library=1&selected=home-01&variant=offset&style=halo');
  await expect(page.getByRole('alert')).toContainText('The SVG could not be loaded.');
  await expect(page).toHaveURL(/variant=stroke-rounded/);
  await page.unroute('**/icons/home-01.svg');
  await page.getByRole('button', { name: 'Retry SVG' }).click();
  await expect(page.getByTestId('icon-preview')).toBeVisible();
  for (const url of ['/variants/offset/home-01.svg', '/downloads/free-icons-all.zip', '/library.json', '/variants-manifest.json']) expect((await request.get(url)).status()).toBe(404);
});


test('a failed remote style preview keeps its source and switching back restores the free SVG', async ({ page }) => {
  await page.route('https://ico.hugeicons.com/**', route => route.fulfill({ status: 404, body: '' }));
  await page.goto('/?library=1&selected=bash&variant=duotone-standard');
  await expect(page.getByRole('dialog')).toContainText('SVG not generated yet');
  await expect(page.getByRole('button', { name: 'Download svg stroked', exact: true })).toBeDisabled();
  await expect(page.locator('.library-stage')).toContainText('Preview unavailable');
  await expect(page.getByRole('link', { name: 'View on Hugeicons' })).toBeVisible();
  await page.getByRole('button', { name: 'Use Stroke Rounded style', exact: true }).click();
  await expect(page.getByTestId('icon-preview')).toBeVisible();
});
