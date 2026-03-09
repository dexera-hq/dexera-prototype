import { expect, test } from '@playwright/test';

test('home page renders draggable trading workspace', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('app-brand')).toBeVisible();

  const moduleCards = page.getByTestId('module-card');
  const moduleTitles = page.getByTestId('module-title');

  await expect(moduleCards).toHaveCount(6);
  await expect(moduleTitles.nth(0)).toHaveText('Market Overview');
  await expect(moduleTitles.nth(3)).toHaveText('Perp Orders & Fills');
  await expect(moduleTitles.nth(5)).toHaveText('Open Positions');
  await expect(moduleCards.nth(0)).toHaveAttribute('draggable', 'true');

  await page.getByRole('button', { name: 'Add Module' }).click();
  await expect(moduleCards).toHaveCount(7);

  await moduleCards
    .nth(0)
    .getByRole('button', { name: /Remove/i })
    .click();
  await expect(moduleCards).toHaveCount(6);
});
