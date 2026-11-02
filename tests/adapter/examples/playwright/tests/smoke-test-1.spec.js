import { expect, test } from '@playwright/test';
test.describe('Smoke case-1', () => {
  test('has title', async () => {
    const title = 'Playwright';
    expect(title).toEqual('Playwright');
  });
});
