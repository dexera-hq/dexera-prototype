import { expect, test } from '@playwright/test';

test('home page renders draggable trading workspace', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /DEXERA/i })).toBeVisible();

  const moduleCards = page.getByTestId('module-card');

  await expect(moduleCards).toHaveCount(5);

  await page.getByRole('button', { name: 'Add Module' }).click();
  await expect(moduleCards).toHaveCount(6);

  await moduleCards.nth(0).getByRole('button', { name: /Remove/i }).click();
  await expect(moduleCards).toHaveCount(5);
});
