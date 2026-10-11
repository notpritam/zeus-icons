import { test, expect } from '@playwright/test';

test('the previously deleted outline URL loads the engine and exports', async ({ page }) => {
  await page.goto('/?library=1&built=1&selected=2nd-bracket-circle&variant=solid-rounded');
  const result = await page.evaluate(async () => {
    const url = '/assets/outline-svg-BuQc-UMe.js';
    const module = await import(/* @vite-ignore */ url);
    const kit = await module.getEngine();
    const path = kit.Path.MakeFromSVGString('M0 0L10 0L10 10Z');
    const valid = !!path;
    path?.delete();
    return { valid, outline: typeof module.outlineSvg };
  });
  expect(result).toEqual({ valid: true, outline: 'function' });
});

test('a failed lazy module recovers once and keeps the selected icon URL', async ({ page }) => {
  let fail = true;
  let requests = 0;
  await page.route('**/assets/LibraryBrowser-*.js', async route => {
    requests++;
    if (fail) { fail = false; await route.abort('failed'); }
    else await route.continue();
  });
  await page.goto('/?library=1&selected=home-01&variant=stroke-rounded');
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(requests).toBeGreaterThanOrEqual(2);
  expect(new URL(page.url()).searchParams.get('selected')).toBe('home-01');
  let navigations = 0;
  page.on('framenavigated', () => navigations++);
  const result = await page.evaluate(() => {
    const event = new Event('vite:preloadError', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(result).toBe(false);
  expect(navigations).toBe(0);
});
