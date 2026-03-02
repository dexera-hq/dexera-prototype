import { expect, test } from '@playwright/test';

test('home page renders the wallet shell and workspace snapshot', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Connect a wallet without leaving your custody.' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Contracts are wired into the frontend.' })).toBeVisible();
  await expect(page.getByText('/health')).toBeVisible();
});
