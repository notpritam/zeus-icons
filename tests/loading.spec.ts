import { test, expect } from '@playwright/test';

test('generated icons load without downloading the full audit catalogue or progress first', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(new URL(request.url()).pathname));
  await page.goto('/?style=duotone-rounded&selected=2nd-bracket&variant=duotone-rounded');
  await expect(page.getByTestId('icon-preview')).toBeVisible();
  expect(requests).toContain('/traced/catalog-v3.json');
  expect(requests).not.toContain('/traced/catalog-v2.json');
  expect(requests).not.toContain('/traced/progress.json');
  expect(requests).not.toContain('/traced/manifest.json');
});
