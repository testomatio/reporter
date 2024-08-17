import { expect, test } from '@playwright/test';

test('this test expects to fail', async () => {
  await expect(false).toBe(true);
});
