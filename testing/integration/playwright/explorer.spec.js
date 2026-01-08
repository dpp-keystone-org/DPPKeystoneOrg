import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/explorer/index.html');
  await expect(page).toHaveTitle(/DPP Ontology Explorer/);
});

test('loads ontology index and performs search', async ({ page }) => {
  await page.goto('/explorer/index.html');

  // Wait for loading to finish (results-count changes from "Loading..." to "Showing X terms")
  const countLabel = page.locator('#results-count');
  await expect(countLabel).not.toContainText('Loading', { timeout: 10000 });
  await expect(countLabel).toContainText('Showing');

  // Search for a known term
  const searchBox = page.locator('#search-box');
  await searchBox.fill('Product');

  // Verify results grid is populated
  const resultsGrid = page.locator('#results-grid');
  await expect(resultsGrid).not.toBeEmpty();

  // Check the first result card
  const firstCard = resultsGrid.locator('.term-card').first();
  await expect(firstCard).toBeVisible();

  // Verify it has the new Context Badge
  const badge = firstCard.locator('.context-badge');
  await expect(badge).toBeVisible();
  // We expect "Core / Product" or similar for the term "Product"
  // But searching "Product" matches many things.
  // Let's check that *some* badge exists and has text.
  const badgeText = await badge.textContent();
  expect(badgeText).not.toBe('');

  // Verify the ID is a link to documentation
  const idLink = firstCard.locator('a.term-id');
  await expect(idLink).toBeVisible();
  await expect(idLink).toHaveAttribute('href', /\.\.\/spec\/ontology\/v1\//);
});
