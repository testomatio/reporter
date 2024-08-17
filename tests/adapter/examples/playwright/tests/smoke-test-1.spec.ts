import { expect, test } from '@playwright/test';
test.describe('Smoke case-1', () => {
  test('has title', async () => {
    const title = 'Playwright';
    await expect(title).toEqual('Playwright');
  });
});