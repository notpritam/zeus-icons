import { test, expect } from '@playwright/test';

test('React usage is short, complete framework components copy and download separately', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/?selected=home-01&variant=solid-rounded');
  await expect(page.getByTestId('icon-preview')).toBeVisible();
  const code = page.getByTestId('component-usage');
  await expect(code).toContainText("zeus-icons/solid-rounded/Home01SolidRoundedIcon");
  await expect(code).not.toContainText('<path');
  await expect(page.getByTestId('package-install')).toHaveText('npm install ./zeus-icons-0.1.0.tgz');
  await expect(page.getByTestId('component-source')).not.toBeVisible();
  await page.getByRole('button', { name: 'Copy usage', exact: true }).click();
  await expect(page.getByText('Usage copied.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("zeus-icons/solid-rounded/Home01SolidRoundedIcon");
  await page.getByRole('button', { name: 'Copy install', exact: true }).click();
  await expect(page.getByText('Install command copied.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('npm install ./zeus-icons-0.1.0.tgz');
  await page.getByText('Component source', { exact: true }).click();
  await page.getByRole('button', { name: 'Copy component', exact: true }).click();
  await expect(page.getByText('React component copied.', { exact: true })).toBeVisible();
  const react = await page.evaluate(() => navigator.clipboard.readText());
  expect(react).toContain('export default function Home01SolidRoundedIcon');
  expect(react).toContain('width={size}'); expect(react).toContain('color={color}');
  for (const [framework, extension, marker] of [['React native', 'tsx', 'SvgXml'], ['Vue', 'vue', '<script setup'], ['Svelte', 'svelte', '$props()'], ['Angular', 'ts', '@Component'], ['Flutter', 'dart', 'extends StatelessWidget']] as const) {
    await page.getByRole('tab', { name: framework, exact: true }).click();
    await expect(code).not.toContainText('<path');
    if (framework === 'Flutter') await page.getByText('Component source', { exact: true }).click();
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download component', exact: true }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe(`Home01SolidRoundedIcon.${extension}`);
    const chunks: Buffer[] = []; for await (const chunk of await download.createReadStream()) chunks.push(chunk);
    expect(Buffer.concat(chunks).toString()).toContain(marker);
  }
  await page.getByRole('tab', { name: 'React', exact: true }).click();
  await page.getByRole('combobox', { name: 'Stroke', exact: true }).click();
  await page.getByRole('option', { name: '3', exact: true }).click();
  await expect(code).toContainText("from './Home01SolidRoundedIcon'");
  await expect(code).not.toContainText('zeus-icons');
  await page.getByRole('button', { name: 'Use Stroke Rounded style', exact: true }).click();
  await expect(code).toContainText('zeus-icons/stroke-rounded/Home01StrokeRoundedIcon');
  await expect(code).toContainText('strokeWidth={3}');
  await expect(page.getByTestId('package-install')).toBeVisible();
});

test('package downloads are available and contain the actual built icon count', async ({ page, request }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Packages', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('60,331 components');
  const manifest = await (await request.get('/packages/manifest.json')).json();
  expect(manifest.count).toBe(manifest.free + manifest.generated);
  for (const item of manifest.packages) {
    await expect(page.getByRole('link', { name: new RegExp(`Download ${item.framework}`) })).toHaveAttribute('href', item.url);
    const response = await request.head(item.url);
    expect(response.ok()).toBe(true);
    expect(Number(response.headers()['content-length'])).toBe(item.bytes);
    expect(response.headers()['content-type']).toBe('application/gzip');
    expect(response.headers()['content-encoding']).toBeUndefined();
  }
});
