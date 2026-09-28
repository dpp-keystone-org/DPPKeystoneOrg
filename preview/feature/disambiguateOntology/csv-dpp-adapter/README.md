# DPP CSV Generator

This utility allows you to generate Digital Product Passport (DPP) JSON files from a CSV database dump entirely within your browser.

## Features
- **Offline Processing:** No data is uploaded to any server. All processing happens locally.
- **Schema Mapping:** Map your CSV column headers to valid DPP schema fields.
- **Configuration:** Save your mapping configuration to reuse later.
- **Batch Export:** Generate a single JSON file containing all your product records.

## Usage
1.  **Select Sector:** Choose the target industry sector (e.g., Battery, Construction).
2.  **Load Data:** Drag & drop your CSV file. The first row must contain headers.
3.  **Map Fields:** 
    - The tool will list all CSV columns.
    - Select the corresponding DPP field for each column.
    - Select `-- Ignore --` to skip a column.
    - The tool attempts to auto-match columns based on name similarity.
4.  **Generate:** Click "Generate DPPs" to download the result.

## Configuration
You can save your mapping by clicking "Save Mapping Config". This downloads a `.json` file that you can load next time to restore your column-to-field associations.
