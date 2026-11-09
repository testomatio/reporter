import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';

// The module is re-imported for every retry, so the first attempt leaves a marker on disk.
const marker = path.join(os.tmpdir(), 'testomatio-e2e-flaky.marker');

describe('Checkout flow', { serial: true, tags: ['checkout'] }, () => {
  test('adds the first item', async ({ app, screen }) => {
    await app.open('/');
    await screen.getByLabel('New todo').fill('Pay invoice');
    await screen.getByRole('button', { name: 'Add' }).click();
    await expect(screen.getByRole('status')).toHaveText('1 item');
  });

  test('adds the second item', async ({ screen }) => {
    await screen.getByLabel('New todo').fill('Send receipt');
    await screen.getByRole('button', { name: 'Add' }).click();
    await expect(screen.getByRole('status')).toHaveText('2 items');
  });
});

test('passes on retry', { retries: 1 }, async ({ app, screen }) => {
  await app.open('/');
  if (!fs.existsSync(marker)) {
    fs.writeFileSync(marker, '');
    await expect(screen.getByRole('status')).toHaveText('never', { timeout: 300 });
  }
  fs.rmSync(marker, { force: true });
  await expect(screen.getByRole('status')).toHaveText('0 items');
});
