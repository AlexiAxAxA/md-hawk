import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests/e2e', timeout: 120000, expect: { timeout: 12000 }, workers: 1, reporter: [['list'], ['json', { outputFile: '.verification/e2e-results.json' }]], use: { trace: 'retain-on-failure' } });
