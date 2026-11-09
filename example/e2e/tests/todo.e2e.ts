import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';

describe('Todo app', { tags: ['smoke'] }, () => {
  test('opens the app', async ({ app, screen }) => {
    await app.open('/');
    await expect(screen.getByRole('heading', { name: 'Todos' })).toBeVisible();
  });

  test('adds an item @T1a2b3c4d', async ({ app, screen }) => {
    await app.open('/');
    await screen.getByLabel('New todo').fill('Buy milk');
    await screen.getByRole('button', { name: 'Add' }).click();
    await expect(screen.getByRole('status')).toHaveText('1 item');
  });

  test('shows a wrong counter', async ({ app, screen }) => {
    await app.open('/');
    await screen.getByLabel('New todo').fill('Buy bread');
    await screen.getByRole('button', { name: 'Add' }).click();
    await expect(screen.getByRole('status')).toHaveText('5 items', { timeout: 500 });
  });

  test('is skipped at runtime', async ({ app }) => {
    test.skip(true, 'feature flag is off');
    await app.open('/');
  });
});

test('is skipped by declaration', { skip: 'not implemented yet' }, async ({ app }) => {
  await app.open('/');
});
