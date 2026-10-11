import { test, expect } from '@playwright/test';

test('legacy workbench links open the same modal without sidebars or comparison modes', async ({ page }) => {
  await page.goto('/?workspace=compare&icon=home-01&view=overlay');
  await expect(page.getByTestId('icon-preview')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('Home 01');
  await expect(page.locator('.sidebar, .inspector, .library-categories')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^(Overlay|Side by side)$/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /workbench/i })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(page.locator('.library-card')).toHaveCount(80);
  await expect(page).not.toHaveURL(/workspace=|view=|icon=/);
});

test('preview automatically fills its padded box without exposing size or zoom controls', async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/?selected=1st-bracket-circle&variant=solid-rounded');
    const image = page.getByTestId('icon-preview');
    await expect(image).toBeVisible();
    await expect(page.getByRole('button', { name: /^(Zoom in|Zoom out|Reset zoom)$/ })).toHaveCount(0);
    await expect(page.locator('.library-stage')).not.toContainText('px');
    const original = await image.boundingBox();
    expect(original!.height).toBeGreaterThan(190);
    const stage = await page.locator('.library-stage').boundingBox();
    expect(original!.x - stage!.x).toBeGreaterThan(24);
    expect(original!.y - stage!.y).toBeGreaterThan(24);
    await expect(page.getByRole('combobox', { name: 'Size', exact: true })).toHaveCount(0);
    await expect(image).toHaveAttribute('width', '24');
    expect(decodeURIComponent((await image.getAttribute('src'))!)).toContain('width="24"');
    expect(await page.locator('.library-stage').evaluate(el => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight)).toBe(true);
  }
});
