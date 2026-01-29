// testing/integration/playwright/wizard-html-generator.spec.js
import { test, expect } from '@playwright/test';
import { fillRequiredFields } from '../test-helpers.mjs';

const WIZARD_URL = 'http://localhost:8080/wizard/index.html';

test.describe('Wizard HTML Generator Integration', () => {

  /**
   * Helper to populate minimal valid data for Battery to enable generation.
   */
  async function populateBatteryData(page) {
    // 1. Select Battery Sector
    await page.click('button[data-sector="battery"]');
    
    // Wait for the form to be rendered
    await expect(page.locator('#sector-form-battery')).toBeVisible();
    await expect(page.locator('input[name="batteryCategory"]')).toBeVisible();

    // 2. Fill core fields (using test helper logic concept)
    await fillRequiredFields(page, 'dpp');

    // 3. Fill Battery specific mandatory fields
    await fillRequiredFields(page, 'battery');
  }
  
  /**
   * Helper to populate General Product data (Brand, Model).
   */
  async function populateGeneralProductData(page, brand, model) {
      const btn = page.locator('button[data-sector="general-product"]');
      if (await btn.isVisible() && await btn.textContent() !== 'Remove General Product Information') {
          await btn.click();
      }
      
      // Fill Brand & Model
      await page.fill('input[name="brand"]', brand);
      await page.fill('input[name="model"]', model);
  }


  test('Test Case 1: Button Visibility Logic', async ({ page }) => {
    await page.goto(WIZARD_URL);

    // Verify buttons are hidden initially
    await expect(page.locator('#preview-schema-btn')).toBeHidden();
    await expect(page.locator('#preview-no-schema-btn')).toBeHidden();
    await expect(page.locator('#schema-btn')).toBeHidden();

    // Populate minimal valid data (Core + Battery)
    await populateBatteryData(page);

    // Verify buttons become visible
    // Wait a bit for validation logic
    await expect(page.locator('#preview-schema-btn')).toBeVisible();
    await expect(page.locator('#preview-no-schema-btn')).toBeVisible();
    await expect(page.locator('#schema-btn')).toBeVisible();
  });

  test('Test Case 2: Preview HTML With Schema.org (Battery)', async ({ page, context }) => {
    await page.goto(WIZARD_URL);
    await populateBatteryData(page);
    await populateGeneralProductData(page, 'TestBrand', 'TestModel');

    // Generate HTML
    const pagePromise = context.waitForEvent('page');
    await page.click('#preview-schema-btn');
    const newPage = await pagePromise;
    await newPage.waitForLoadState();

    // Verify Hero Title matches "Brand Model"
    const h1 = await newPage.textContent('h1');
    expect(h1).toBe('TestBrand TestModel');

    // Verify JSON-LD Exists and is valid
    const jsonLd = await newPage.getAttribute('script[type="application/ld+json"]', 'type');
    expect(jsonLd).toBe('application/ld+json');
    const jsonLdContent = JSON.parse(await newPage.textContent('script[type="application/ld+json"]'));
    // Adapter returns an array [Product]
    const product = Array.isArray(jsonLdContent) ? jsonLdContent[0] : jsonLdContent;
    expect(product['@type']).toBe('Product');
    expect(product['brand']).toBe('TestBrand');

    await newPage.close();
  });

  test('Test Case 3: Preview HTML Without Schema (Battery)', async ({ page, context }) => {
    await page.goto(WIZARD_URL);
    await populateBatteryData(page);
    await populateGeneralProductData(page, 'NoSchemaBrand', 'NoSchemaModel');

    // Generate HTML
    const pagePromise = context.waitForEvent('page');
    await page.click('#preview-no-schema-btn');
    const newPage = await pagePromise;
    await newPage.waitForLoadState();

    // Verify Title
    expect(await newPage.textContent('h1')).toBe('NoSchemaBrand NoSchemaModel');

    // Verify JSON-LD does NOT exist
    const scriptCount = await newPage.locator('script[type="application/ld+json"]').count();
    expect(scriptCount).toBe(0);

    await newPage.close();
  });

  test('Test Case 4: Preview Schema.org JSON-LD', async ({ page, context }) => {
    await page.goto(WIZARD_URL);
    await populateBatteryData(page);
    await populateGeneralProductData(page, 'SchemaBrand', 'SchemaModel');

    // Generate Schema
    const pagePromise = context.waitForEvent('page');
    await page.click('#schema-btn');
    const newPage = await pagePromise;
    await newPage.waitForLoadState();

    // Verify Content is JSON
    const content = await newPage.locator('body').textContent();
    expect(content).toContain('http://schema.org');
    expect(content).toContain('Product');
    expect(content).toContain('SchemaBrand');

    await newPage.close();
  });

  test('Test Case 5: Custom CSS URL in HTML Preview', async ({ page, context }) => {
    await page.goto(WIZARD_URL);
    await populateBatteryData(page);
    await populateGeneralProductData(page, 'CSSBrand', 'CSSModel');

    // Enter Custom CSS URL
    const customCssUrl = 'http://localhost:8080/examples/css/dark-theme.css';
    await page.fill('#custom-css-url', customCssUrl);

    // Generate HTML (With Schema)
    const pagePromise = context.waitForEvent('page');
    await page.click('#preview-schema-btn');
    const newPage = await pagePromise;
    await newPage.waitForLoadState();

    // Verify Custom CSS Link
    const linkHref = await newPage.getAttribute('link[rel="stylesheet"]:last-of-type', 'href');
    expect(linkHref).toBe(customCssUrl);
    
    await newPage.close();
  });

});