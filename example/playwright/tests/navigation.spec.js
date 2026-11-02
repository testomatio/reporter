const { test, expect } = require('@playwright/test');

test('should fail after navigation', async ({ page }) => {
  await page.route('http://example.test/**', route =>
    route.fulfill({ contentType: 'text/html', body: '<h1>Checkout</h1>' }),
  );
  await page.goto('http://example.test/start');
  await page.goto('http://example.test/checkout?step=2');
  await expect(page.locator('h1')).toHaveText('Done', { timeout: 100 });
});
