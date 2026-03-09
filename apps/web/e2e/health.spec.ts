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
  await expect(page.getByRole('button', { name: 'Reset Layout' })).toBeVisible();
});

test('dropping a module onto another module keeps them in the same row', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('app-brand')).toBeVisible();

  const chartTitle = page.getByTestId('module-title').filter({ hasText: 'Price Chart' });
  const positionsTitle = page.getByTestId('module-title').filter({ hasText: 'Open Positions' });
  const chartCard = chartTitle.locator('xpath=ancestor::*[@data-testid="module-card"][1]');
  const positionsCard = positionsTitle.locator('xpath=ancestor::*[@data-testid="module-card"][1]');

  await expect(chartTitle).toBeVisible();
  await expect(positionsTitle).toBeVisible();

  const chartBox = await chartCard.boundingBox();

  expect(chartBox).not.toBeNull();
  await positionsCard.dragTo(chartCard, {
    targetPosition: {
      x: Math.round((chartBox?.width ?? 0) * 0.75),
      y: Math.round((chartBox?.height ?? 0) * 0.5),
    },
  });

  const nextChartBox = await chartCard.boundingBox();
  const positionsBox = await positionsCard.boundingBox();

  expect(nextChartBox).not.toBeNull();
  expect(positionsBox).not.toBeNull();
  expect(Math.abs((nextChartBox?.y ?? 0) - (positionsBox?.y ?? 0))).toBeLessThan(2);
});
