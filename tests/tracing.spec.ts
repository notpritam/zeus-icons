import { test, expect } from '@playwright/test';

test('built image traces are separately browseable with original names and downloadable vector code', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const snapshot = await (await page.request.get('/traced/catalog-v3.json')).json();
  await page.route('**/traced/catalog-v3.json', route => route.fulfill({ json: snapshot }));
  await page.goto('/?library=1&built=1');
  const response = await page.request.get('/traced/progress.json');
  const count = snapshot.count as number;
  expect(response.ok()).toBe(true);
  await expect(page.locator('.library-results-heading')).toContainText(`${count.toLocaleString()} icons`);
  await expect(page.locator('.library-card')).toHaveCount(80);
  await page.getByRole('button', { name: 'Next collection page' }).click();
  await expect(page.locator('.library-card')).toHaveCount(Math.min(80, count - 80));
  await page.getByLabel('Search collection').fill('1st-bracket-circle');
  await expect(page.locator('.library-card')).toHaveCount(9);
  await page.getByRole('button', { name: 'Preview 1st Bracket Circle, Duotone Rounded', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Generated SVG · Geometric reconstruction');
  await expect(page.getByTestId('icon-preview')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'React', exact: true })).toBeVisible();
  await expect(page.locator('.trace-quality')).toContainText('default alpha overlap');
  await expect(page.getByRole('combobox', { name: 'Size', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Icon color', exact: true }).click();
  await page.getByLabel('Hex', { exact: true }).fill('bc2418');
  await page.getByLabel('Hex', { exact: true }).press('Enter');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Copy svg outlined', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('SVG OUTLINED copied.');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('Generated image trace'); expect(copied).not.toContain('MIT License');
  expect(copied).toContain('width="24"'); expect(copied).toContain('color="#bc2418"');
  expect(copied).toContain('<path'); expect(copied).not.toContain('<image'); expect(copied).toContain('opacity="0.4"');
  await page.getByRole('button', { name: 'Download format', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'react', exact: true }).click();
  const promise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download react', exact: true }).click();
  const download = await promise;
  expect(download.suggestedFilename()).toBe('1st-bracket-circle-duotone-rounded.tsx');
  const chunks: Buffer[] = []; for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  const code = Buffer.concat(chunks).toString();
  expect(code).toContain('SVGProps<SVGSVGElement>'); expect(code).toContain('fill="currentColor"'); expect(code).not.toContain('<HugeiconsIcon');
  await page.reload(); await expect(page.getByRole('dialog')).toContainText('Generated SVG · Geometric reconstruction');
});

test('trace contour weight changes geometry and reset restores it', async ({ page }) => {
  await page.goto('/?library=1&selected=1st-bracket&variant=stroke-sharp');
  const image = page.getByTestId('icon-preview'); await expect(image).toBeVisible();
  const original = await image.getAttribute('src');
  await page.getByRole('combobox', { name: 'Stroke', exact: true }).click();
  await page.getByRole('option', { name: '3', exact: true }).click();
  await expect(image).not.toHaveAttribute('src', original!);
  await expect.poll(() => image.evaluate(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0)).toBe(true);
  const expanded = await image.getAttribute('src');
  const alpha = await page.evaluate(async ([original, expanded]) => {
    const sums = [];
    for (const src of [original, expanded]) { const img = new Image(); img.src = src!; await img.decode(); const canvas = document.createElement('canvas'); canvas.width = canvas.height = 96; const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0, 96, 96); const data = ctx.getImageData(0,0,96,96).data; let sum=0;for(let i=3;i<data.length;i+=4)sum+=data[i];sums.push(sum); }
    return sums;
  }, [original, expanded]);
  expect(alpha[1]).toBeGreaterThan(alpha[0] * 1.3);
  await page.getByRole('button', { name: 'Reset to default', exact: true }).click();
  await expect(image).toHaveAttribute('src', original!);
  await expect(page.getByRole('button', { name: 'Overlay', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Use Stroke Rounded style', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Free · Stroke Rounded');
  await expect(page.getByRole('button', { name: 'Copy svg stroked', exact: true })).toBeEnabled();
});

test('traces remain usable on phone; HTML asset failures cannot export another style', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/traced/svg/1st-bracket-solid-sharp.svg*', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<html>missing</html>' }));
  await page.goto('/?library=1&selected=1st-bracket&variant=solid-sharp');
  await expect(page.getByRole('alert')).toContainText('The SVG could not be loaded');
  await expect(page.getByRole('button', { name: 'Download svg outlined', exact: true })).toBeDisabled();
  await page.unroute('**/traced/svg/1st-bracket-solid-sharp.svg*'); await page.getByRole('button', { name: 'Retry SVG', exact: true }).click();
  await expect(page.getByTestId('icon-preview')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toHaveCount(0);
  expect(await page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.getByRole('tab', { name: 'React', exact: true }).click();
  await expect(page.getByTestId('component-usage')).toContainText('zeus-icons/solid-sharp/FirstBracketSolidSharpIcon');
  await expect(page.getByTestId('component-usage')).not.toContainText('<path');
  await page.getByText('Component source', { exact: true }).click();
  await expect(page.getByTestId('component-source')).toContainText('export default function FirstBracketSolidSharpIcon');
});

test('contour weight preserves even-odd cutouts in generated SVG exports', async ({ page }) => {
  await page.route('**/traced/svg/1st-bracket-circle-solid-rounded.svg*', route => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="M2 2H22V22H2Z M8 8H16V16H8Z"/></svg>' }));
  await page.goto('/?library=1&selected=1st-bracket-circle&variant=solid-rounded');
  const preview = page.getByTestId('icon-preview');
  await expect(preview).toBeVisible();
  const initial = await preview.getAttribute('src');
  await page.getByRole('combobox', { name: 'Stroke', exact: true }).click();
  await page.getByRole('option', { name: '3', exact: true }).click();
  await expect(preview).not.toHaveAttribute('src', initial!);
  const alpha = await preview.evaluate(async el => {
    const img = new Image(); img.src = (el as HTMLImageElement).src; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 96;
    const context = canvas.getContext('2d')!; context.drawImage(img, 0, 0, 96, 96);
    return context.getImageData(48,48,1,1).data[3];
  });
  expect(alpha).toBe(0);
});

test('distinct source names preserve Pro artwork without substituting a free alias', async ({ page }) => {
  await page.goto('/?library=1&built=1&q=c%2B%2B&selected=c%2B%2B&variant=solid-rounded');
  await expect(page.getByRole('dialog')).toContainText('C++ Icon');
  await expect(page.getByTestId('icon-preview')).toBeVisible();
  await page.getByRole('button', { name: 'Use Stroke Rounded style', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Free SVG unavailable for this source name');
  await expect(page.getByRole('button', { name: 'Download svg stroked', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Use Solid Rounded style', exact: true }).click();
  await expect(page.getByTestId('icon-preview')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download svg outlined', exact: true })).toBeEnabled();
});
