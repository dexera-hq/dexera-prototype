import { expect, test } from '@playwright/test';

test('home page renders workspace bootstrap status', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dexera workspace bootstrap' })).toBeVisible();
  await expect(page.getByText('/health')).toBeVisible();
});
