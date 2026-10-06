# Wizard `oneOf` Primitive Alternative Support

## Summary
Fix the DPP Generation Wizard (`src/wizard/form-builder.js`) so that `oneOf` fields containing a primitive type alternative (such as `careInstructions`, `safeUseInstructions`, `endOfLifeInstructions`, and `repairInstructions` in `src/validation/v3/json-schema/sector/textile.schema.json`, which allow either `RelatedResource` or `{"type": "string"}`) properly display a localized type option (`Text` instead of `Option 2`) and render a corresponding data entry field when selected.

---

## Implementation Plan

### STEP 1: Verify & Complete `epd` and `dopc` `oneOf` Test Coverage (Object Alternatives)
- [x] **1.1** Audit existing unit tests in `testing/unit/wizard.test.js` and Playwright tests in `testing/integration/playwright/wizard.spec.js`:
  - `testing/unit/wizard.test.js` previously had no unit tests for `oneOf` in `buildForm` (existing `epd` tests used plain `type: "object"` schemas without `oneOf`).
  - `testing/integration/playwright/wizard.spec.js` tested only one branch of `epd` and `dopc` in `construction`, and did not test switching between the specific subschema (`EPD` / `DoPC`) and the `Related Resource` alternative on `iron-steel`.
- [x] **1.2** Add unit tests in `testing/unit/wizard.test.js` covering object-vs-object `oneOf` selections (`epd` and `dopc` vs `Related Resource`):
  - Verify clicking "Add" renders `select.type-selector` with titled options (`DPP EPD (Environmental Product Declaration) Data Block`, `DPP DoPC (Declaration of Performance) Data Block`, `Related Resource`).
  - Verify selecting the first branch renders its object fields (`epd.gwp`, `dopc.declarationCode`), replaces the selector with a `Remove` button, and populates `generateDpp` output.
  - Verify clicking `Remove` clears the fields and restores the `Add` button, and selecting the second branch (`Related Resource`) renders `url` and `resourceTitle` fields instead.
- [x] **1.3** Add Playwright test assertions in `testing/integration/playwright/wizard.spec.js` (under `iron-steel`) verifying both branches (`EPD` / `DoPC` data block and `Related Resource`) for `epd` and `dopc`, including removing and switching options.

### STEP 2: Add Failing Tests for Primitive Type `oneOf` Alternatives
- [x] **2.1** Add unit tests in `testing/unit/wizard.test.js` for a `oneOf` property with a `Related Resource` object and a primitive `{"type": "string"}` alternative (matching `careInstructions` in `textile.schema.json`):
  - Assert that the dropdown option for `{"type": "string"}` displays `"Text"` (with `data-i18n-key="type-text"`) instead of `"Option 2"`.
  - Assert that selecting the primitive string option renders an `<input type="text" name="careInstructions">` field.
  - Assert that `generateDpp` outputs `careInstructions` as a primitive string when populated.
  - Assert that clicking `Remove` removes the primitive input field and restores the `Add` button.
- [x] **2.2** Update Playwright test in `testing/integration/playwright/wizard.spec.js` (under `textile` sector) to test removing the `Related Resource` selection on `careInstructions`, re-adding `careInstructions`, selecting the `"Text"` option, verifying `input[name="careInstructions"]` is visible with `type="text"`, and filling it with a string value.
- [ ] **2.3** Ask user to run unit and Playwright tests to confirm the new primitive `oneOf` tests fail as expected while the `epd`/`dopc` tests pass.

### STEP 3: Implement Primitive `oneOf` Support in `src/wizard/form-builder.js`
- [x] **3.1** In `createOptionalObjectPlaceholderRow` (`src/wizard/form-builder.js`), map untitled primitive `oneOf` options to their localized type labels and `data-i18n-key` attributes (`string` -> `Text` / `type-text`, `number`/`integer` -> `Number` / `type-number`, `boolean` -> `True/False` / `type-boolean`).
- [x] **3.2** In `expandRow` (`src/wizard/form-builder.js`), when `schemaToUse` has no `properties` but defines a primitive `type` or `enum`, call `renderSimpleInputProperty` to render the primitive data entry row bound to `dynamicPath`.
- [ ] **3.3** Ask user to run `npm run build` and `npm test` to verify all unit and Playwright tests pass.
