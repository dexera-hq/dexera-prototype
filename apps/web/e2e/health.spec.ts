import { expect, test } from '@playwright/test';

test('home page renders trading workspace', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('app-brand')).toBeVisible();

  const moduleCards = page.getByTestId('module-card');
  const moduleHeaders = page.getByTestId('module-card-header');
  const moduleTitles = page.getByTestId('module-title');

  await expect(moduleCards).toHaveCount(6);
  await expect(moduleHeaders).toHaveCount(6);
  await expect(moduleTitles.nth(0)).toHaveText('Market Overview');
  await expect(moduleTitles.nth(3)).toHaveText('Perp Orders & Fills');
  await expect(moduleTitles.nth(5)).toHaveText('Open Positions');
  await expect(page.getByRole('button', { name: 'Reset Layout' })).toBeVisible();
});

test('price chart mounts and remounts cleanly after removal and reset', async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error);
  });

  await page.goto('/');
  await expect(page.getByTestId('candlestick-chart')).toHaveCount(1);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.getByRole('button', { name: 'Remove Price Chart' }).click();
    await expect(page.getByTestId('candlestick-chart')).toHaveCount(0);

    await page.getByRole('button', { name: 'Reset Layout' }).click();
    await expect(page.getByTestId('candlestick-chart')).toHaveCount(1);
  }

  expect(pageErrors).toEqual([]);
});
