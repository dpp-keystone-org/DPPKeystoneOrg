import { test, expect } from '@playwright/test';

test.describe('API Documentation Sub-Page (/api/)', () => {
    test('renders OpenAPI 3.1 Swagger UI with working dropdowns and readable contrast', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', (err) => pageErrors.push(err.message));

        await page.goto('/api/index.html');

        // 1. Keystone header & intro card rendered
        await expect(page.locator('#dpp-header-container header')).toBeVisible();
        await expect(page.locator('.api-intro-card a[href="./openapi.yml"]')).toBeVisible();

        // 2. Swagger UI loaded cleanly with zero OpenAPI parser errors
        await expect(page.locator('#swagger-ui .info .title')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('#swagger-ui .errors-wrapper')).toHaveCount(0);

        // 3. Core endpoints are rendered
        const adaptOp = page.locator('#swagger-ui .opblock', { hasText: '/adapt' }).first();
        const validateOp = page.locator('#swagger-ui .opblock', { hasText: '/validate' }).first();
        await expect(adaptOp).toBeVisible();
        await expect(validateOp).toBeVisible();

        // 4. Expand /adapt and verify Try-It-Out dropdowns are enabled and interactive
        await adaptOp.locator('.opblock-summary').click();
        const targetSelect = adaptOp.locator('tr[data-param-name="target"] select');
        await expect(targetSelect).toBeVisible();
        await expect(targetSelect).toBeEnabled();
        await targetSelect.selectOption('raw');
        await expect(targetSelect).toHaveValue('raw');
        await targetSelect.selectOption('patched');
        await expect(targetSelect).toHaveValue('patched');

        // 5. Verify Schemas section renders and toggle buttons are NOT overridden by Keystone's deep blue button style
        const modelsSection = page.locator('#swagger-ui section.models');
        await expect(modelsSection).toBeVisible();

        const schemaButton = modelsSection.locator('button').first();
        await expect(schemaButton).toBeVisible();
        const btnBg = await schemaButton.evaluate((el) => getComputedStyle(el).backgroundColor);
        expect(btnBg).not.toBe('rgb(13, 110, 253)');

        // 6. Verify dark code blocks do NOT inherit keystone-style.css light-gray `code` background
        const preCode = adaptOp.locator('pre.microlight code').first();
        if (await preCode.count() > 0) {
            const codeBg = await preCode.evaluate((el) => getComputedStyle(el).backgroundColor);
            expect(codeBg).not.toBe('rgb(233, 236, 239)');
        }

        expect(pageErrors).toEqual([]);
    });
});
