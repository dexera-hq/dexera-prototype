import { expect, test } from '@playwright/test';

test('home page renders draggable trading workspace', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /DEXERA/i })).toBeVisible();

  const moduleCards = page.getByTestId('module-card');
  const moduleTitles = page.getByTestId('module-title');

  await expect(moduleCards).toHaveCount(5);
  await expect(moduleTitles.nth(0)).toHaveText('Market Overview');
  await expect(moduleTitles.nth(4)).toHaveText('Open Positions');

  await moduleCards.nth(4).dragTo(moduleCards.nth(0));
  await expect(moduleTitles.nth(0)).toHaveText('Open Positions');
  await expect(moduleTitles.nth(1)).toHaveText('Market Overview');

  await page.getByRole('button', { name: 'Add Module' }).click();
  await expect(moduleCards).toHaveCount(6);

  await moduleCards.nth(0).getByRole('button', { name: /Remove/i }).click();
  await expect(moduleCards).toHaveCount(5);
});
