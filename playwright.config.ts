import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests', timeout: 45000, expect: { timeout: 15000 }, use: { baseURL: process.env.FREE_ICONS_TEST_URL ?? 'http://127.0.0.1:8937', browserName: 'chromium', viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure' }, reporter: 'list' });
