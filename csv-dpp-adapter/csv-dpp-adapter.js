import Papa from '../lib/vendor/papaparse.js?v=1770142271452';
import { loadSchema, flattenSchema } from '../lib/schema-loader.js?v=1770142271452';
import { generateDPPsFromCsv, generateAutoMapping } from '../lib/csv-adapter-logic.js?v=1770142271452';

console.log('CSV Adapter Initialized');

// DOM Elements
const fileInput = document.getElementById('csv-file-input');
const dropArea = document.getElementById('drop-area');
const fileInfo = document.getElementById('file-info');
const fileNameDisplay = document.getElementById('file-name');
const rowCountDisplay = document.getElementById('row-count');
const mappingSection = document.getElementById('mapping-section');
const mappingTbody = document.getElementById('mapping-tbody');
const sectorSelect = document.getElementById('sector-select');
const actionSection = document.getElementById('action-section');
const generateBtn = document.getElementById('generate-btn');
const loadConfigBtn = document.getElementById('load-config-btn');
const saveConfigBtn = document.getElementById('save-config-btn');
const configFileInput = document.getElementById('config-file-input');
const outputArea = document.getElementById('output-area');

// State
let csvData = [];
let csvHeaders = [];
let schemaFields = [];

// Initialize
(async function init() {
    setupEventListeners();
    await updateSchema();
})();

function setupEventListeners() {
    // File Input
    fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
    
    // Drag & Drop
    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.classList.add('dragover');
    });
    dropArea.addEventListener('dragleave', () => dropArea.classList.remove('dragover'));
    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.classList.remove('dragover');
        handleFile(e.dataTransfer.files[0]);
    });

    // Sector Selection
    document.querySelectorAll('input[name="sector"]').forEach(checkbox => {
        checkbox.addEventListener('change', updateSchema);
    });

    // Config Buttons
    saveConfigBtn.addEventListener('click', exportMappingConfig);
    loadConfigBtn.addEventListener('click', () => configFileInput.click());
    configFileInput.addEventListener('change', (e) => importMappingConfig(e.target.files[0]));

    // Generate Button
    generateBtn.addEventListener('click', generateDPPs);
}

function getSelectedSectors() {
    return Array.from(document.querySelectorAll('input[name="sector"]:checked')).map(cb => cb.value);
}

async function updateSchema() {
    const sectors = getSelectedSectors();
    // Always include 'dpp' (Core) and 'general-product' schema
    const schemasToLoad = new Set(['dpp', 'general-product', ...sectors]);

    try {
        console.log(`Loading schemas for: ${Array.from(schemasToLoad).join(', ')}...`);
        let allFields = new Map(); // Use Map to deduplicate by path
        
        for (const sector of schemasToLoad) {
            const schema = await loadSchema(sector);
            const fields = flattenSchema(schema);
            fields.forEach(f => allFields.set(f.path, f));
        }
        
        // Store full objects, sorted by path
        schemaFields = Array.from(allFields.values()).sort((a, b) => a.path.localeCompare(b.path));
        console.log(`Loaded ${schemaFields.length} unique fields.`);
        
        // If we already have data, re-render to update dropdown options
        if (csvHeaders.length > 0) {
            renderMappingTable();
        }
    } catch (err) {
        console.error('Error loading schema:', err);
        alert('Failed to load schemas.');
    }
}

function handleFile(file) {
    if (!file) return;

    if (file.name.endsWith('.json')) {
        // Assume config file if dropped
        importMappingConfig(file);
        return;
    }

    fileNameDisplay.textContent = file.name;
    
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            if (results.errors.length > 0) {
                console.warn('CSV Parse errors:', results.errors);
            }
            
            csvData = results.data;
            csvHeaders = results.meta.fields || [];
            
            rowCountDisplay.textContent = csvData.length;
            fileInfo.classList.remove('hidden');
            mappingSection.classList.remove('hidden');
            actionSection.classList.remove('hidden');

            renderMappingTable();
        }
    });
}

function renderMappingTable() {
    console.log('Rendering Mapping Table...');
    mappingTbody.innerHTML = '';
    
    // Create/Update Shared Datalist
    let dataList = document.getElementById('schema-fields-list');
    if (!dataList) {
        dataList = document.createElement('datalist');
        dataList.id = 'schema-fields-list';
        document.body.appendChild(dataList);
    }
    
    // Helper to rebuild datalist based on current context
    const rebuildDatalist = (currentInputValue) => {
        dataList.innerHTML = ''; 
        
        // precise tracking of selected fields across all inputs
        const selectedPaths = new Set();
        document.querySelectorAll('.dpp-field-input').forEach(inp => {
            if (inp.value && inp.value !== currentInputValue) {
                selectedPaths.add(inp.value);
            }
        });

        schemaFields.forEach(field => {
            if (field.isArray || field.path === currentInputValue || !selectedPaths.has(field.path)) {
                const opt = document.createElement('option');
                opt.value = field.path;
                if (field.isArray) {
                    opt.label = "(Array)";
                }
                dataList.appendChild(opt);
            }
        });
    };

    // Initial build (full list)
    rebuildDatalist(null);

    // Prepare string list for matching logic (still useful if needed, but generateAutoMapping now takes objects)
    const availableFieldPaths = schemaFields.map(f => f.path);
    console.log(`Available Fields: ${availableFieldPaths.length}, CSV Headers: ${csvHeaders.length}`);

    // --- Generate Auto-Mappings (Global Greedy Strategy) ---
    // Instead of calling findBestMatch per header, we generate a global mapping first.
    // We pass schemaFields directly so it knows which fields are arrays.
    try {
        console.log('Generating Auto Mapping...');
        const autoMapping = generateAutoMapping(csvHeaders, schemaFields);
        console.log('Auto Mapping Generated:', autoMapping);

        csvHeaders.forEach((header, index) => {
            const row = document.createElement('tr');
            row.dataset.reviewed = "false"; // State tracking
            row.classList.add('needs-review');
            
            // 1. CSV Header
            const headerCell = document.createElement('td');
            headerCell.textContent = header;
            row.appendChild(headerCell);

            // 2. Sample Value (from first row)
            const sampleCell = document.createElement('td');
            const sampleVal = csvData.length > 0 ? csvData[0][header] : '';
            sampleCell.textContent = typeof sampleVal === 'string' && sampleVal.length > 50 
                ? sampleVal.substring(0, 50) + '...' 
                : sampleVal;
            sampleCell.style.color = '#666';
            sampleCell.style.fontStyle = 'italic';
            row.appendChild(sampleCell);

            // 3. Target Field Input with Datalist
            const targetCell = document.createElement('td');
            const input = document.createElement('input');
            input.type = 'text';
            input.setAttribute('list', 'schema-fields-list');
            input.className = 'dpp-field-input';
            input.dataset.csvHeader = header;
            input.placeholder = 'Search target field...';
            input.style.width = '100%';
            
            // Dynamic Datalist Filtering on Focus
            input.addEventListener('focus', () => {
                rebuildDatalist(input.value);
            });

            // Auto-check logic on manual input
            input.addEventListener('input', () => {
                // If user types something, assume they are reviewing it
                if (!checkbox.checked) {
                    checkbox.checked = true;
                    row.classList.remove('needs-review');
                    row.dataset.reviewed = "true";
                    updateGenerateButtonState();
                }
            });

            // Apply Auto-Mapping
            if (autoMapping[header]) {
                input.value = autoMapping[header];
            }

            targetCell.appendChild(input);
            row.appendChild(targetCell);

            // 4. Review Checkbox
            const reviewCell = document.createElement('td');
            reviewCell.style.textAlign = 'center'; // Center the checkbox
            reviewCell.style.cursor = 'pointer'; // Indicate clickability
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'review-checkbox';
            checkbox.title = "Confirm this mapping";
            
            // Function to toggle state
            const toggleReview = (newState) => {
                checkbox.checked = newState;
                if (checkbox.checked) {
                    row.classList.remove('needs-review');
                    row.dataset.reviewed = "true";
                } else {
                    row.classList.add('needs-review');
                    row.dataset.reviewed = "false";
                }
                updateGenerateButtonState();
            };

            // Checkbox change event (handles clicks on the box AND keyboard interaction)
            checkbox.addEventListener('change', () => {
                toggleReview(checkbox.checked);
            });

            // Cell click event (handles clicks on the empty space in the cell)
            reviewCell.addEventListener('click', (e) => {
                // Only toggle if the click was NOT on the checkbox itself
                // (because the checkbox click is handled natively + 'change' event)
                if (e.target !== checkbox) {
                    toggleReview(!checkbox.checked);
                }
            });

            reviewCell.appendChild(checkbox);
            row.appendChild(reviewCell);
            
            mappingTbody.appendChild(row);
        });
        
        updateGenerateButtonState();
        console.log('Rendering Complete.');
    } catch (e) {
        console.error('Error in renderMappingTable:', e);
    }
}

function updateGenerateButtonState() {
    const allRows = document.querySelectorAll('#mapping-tbody tr');
    const checkedRows = document.querySelectorAll('.review-checkbox:checked');
    const allChecked = allRows.length > 0 && allRows.length === checkedRows.length;
    
    generateBtn.disabled = !allChecked;
    generateBtn.title = allChecked ? "Generate DPPs" : "Please review and check all rows first";

    // Also block saving until reviewed (as requested)
    saveConfigBtn.disabled = !allChecked;
    saveConfigBtn.title = allChecked ? "Save Mapping Config" : "Please review and check all rows first";
}

function getMappingConfig() {
    const mapping = {};
    const inputs = document.querySelectorAll('.dpp-field-input');
    inputs.forEach(input => {
        if (input.value) {
            mapping[input.dataset.csvHeader] = input.value;
        }
    });
    return mapping;
}

function exportMappingConfig() {
    const config = getMappingConfig();
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dpp-mapping-config.json';
    a.click();
    URL.revokeObjectURL(url);
}

function importMappingConfig(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const config = JSON.parse(e.target.result);
            applyMappingConfig(config);
            alert('Mapping configuration loaded!');
        } catch (err) {
            console.error(err);
            alert('Invalid configuration file.');
        }
    };
    reader.readAsText(file);
}

function applyMappingConfig(config) {
    const inputs = document.querySelectorAll('.dpp-field-input');
    inputs.forEach(input => {
        const header = input.dataset.csvHeader;
        if (config[header]) {
            input.value = config[header];
        } else {
            input.value = '';
        }
        
        const row = input.closest('tr');
        if (row) {
            const checkbox = row.querySelector('.review-checkbox');
            if (checkbox) {
                checkbox.checked = true;
                row.classList.remove('needs-review');
                row.dataset.reviewed = "true";
            }
        }
    });
    updateGenerateButtonState();
}

function generateDPPs() {
    // Final validation check
    const unchecked = document.querySelectorAll('.review-checkbox:not(:checked)');
    if (unchecked.length > 0) {
        alert('Please review all mappings and check the boxes to confirm.');
        return;
    }

    const mapping = getMappingConfig();
    if (Object.keys(mapping).length === 0) {
        alert('Please map at least one field.');
        return;
    }


    const sectors = getSelectedSectors();
    if (sectors.length === 0) {
        alert('Please select at least one sector.');
        return;
    }

    const generatedDocs = generateDPPsFromCsv(csvData, mapping, sectors);

    // Download as JSON file
    const blob = new Blob([JSON.stringify(generatedDocs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dpp-batch-export-${sectors.join('-')}.json`;
    a.click();
    URL.revokeObjectURL(url);

    outputArea.innerHTML = `<p class="success">Successfully generated ${generatedDocs.length} DPPs!</p>`;
}
