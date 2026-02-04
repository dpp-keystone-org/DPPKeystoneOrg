import Papa from '../lib/vendor/papaparse.js?v=1770217775596';
import { loadSchema, flattenSchema } from '../lib/schema-loader.js?v=1770217775596';
import { generateDPPsFromCsv, generateAutoMapping, findUsedIndices, generateIndexedSuggestions } from '../lib/csv-adapter-logic.js?v=1770217775596';

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

// Autocomplete Dropdown Singleton
let dropdownList = null;
let activeInputIndex = -1; // For keyboard navigation within list

// State
let csvData = [];
let csvHeaders = [];
let schemaFields = [];

// Initialize
(async function init() {
    createDropdown(); // Create the DOM element for the dropdown
    setupEventListeners();
    await updateSchema();
})();

function createDropdown() {
    dropdownList = document.createElement('ul');
    dropdownList.id = 'autocomplete-dropdown';
    dropdownList.className = 'autocomplete-dropdown';
    document.body.appendChild(dropdownList);

    // Global click listener to hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.autocomplete-dropdown') && !e.target.closest('.dpp-field-input')) {
            hideDropdown();
        }
    });
}

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

// --- Autocomplete Logic ---

function updateRowReviewState(input) {
    const row = input.closest('tr');
    const checkbox = row.querySelector('.review-checkbox');
    if (checkbox && !checkbox.checked) {
        checkbox.checked = true;
        row.classList.remove('needs-review');
        row.dataset.reviewed = "true";
        updateGenerateButtonState();
    }
}

function setupAutocomplete(input) {
    input.addEventListener('focus', () => {
        showDropdown(input);
    });

    input.addEventListener('input', () => {
        showDropdown(input);
        updateRowReviewState(input);
    });

    input.addEventListener('keydown', (e) => {
        if (!dropdownList.classList.contains('visible')) return;

        const items = dropdownList.querySelectorAll('li');
        if (items.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeInputIndex = (activeInputIndex + 1) % items.length;
            highlightItem(items, activeInputIndex);
            items[activeInputIndex].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeInputIndex = (activeInputIndex - 1 + items.length) % items.length;
            highlightItem(items, activeInputIndex);
            items[activeInputIndex].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeInputIndex >= 0 && activeInputIndex < items.length) {
                selectItem(input, items[activeInputIndex]);
            }
        } else if (e.key === 'Escape') {
            hideDropdown();
        }
    });
}

function highlightItem(items, index) {
    items.forEach(item => item.classList.remove('selected'));
    if (items[index]) {
        items[index].classList.add('selected');
    }
}

function selectItem(input, itemElement) {
    input.value = itemElement.dataset.value;
    hideDropdown();
    updateRowReviewState(input);
}

function hideDropdown() {
    dropdownList.classList.remove('visible');
    dropdownList.innerHTML = '';
    activeInputIndex = -1;
}

function showDropdown(input) {
    const rect = input.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const viewportHeight = window.innerHeight;

    // 1. Generate Suggestions
    const currentVal = input.value;
    const filterText = currentVal.toLowerCase();
    
    // Calculate global usage
    const currentMapping = {};
    const selectedPaths = new Set();
    document.querySelectorAll('.dpp-field-input').forEach(inp => {
        const val = inp.value;
        if (val) {
            currentMapping[inp.dataset.csvHeader] = val;
            if (val !== currentVal) { // Don't exclude our own value
                selectedPaths.add(val);
            }
        }
    });

    const suggestions = [];
    schemaFields.forEach(field => {
        if (field.isArray) {
            const root = field.path.split('.')[0];
            const usedIndices = findUsedIndices(currentMapping, root);
            const indexedSuggestions = generateIndexedSuggestions(field, usedIndices);
            indexedSuggestions.forEach(s => {
                if ((s.value === currentVal || !selectedPaths.has(s.value)) && 
                    s.value.toLowerCase().includes(filterText)) {
                    suggestions.push(s);
                }
            });
        } else {
            if ((field.path === currentVal || !selectedPaths.has(field.path)) && 
                field.path.toLowerCase().includes(filterText)) {
                suggestions.push({ value: field.path, type: 'scalar', index: null });
            }
        }
    });

    // 2. Render Items (populates DOM, determining height)
    renderDropdownItems(input, suggestions);
    
    if (suggestions.length === 0) return;

    // 3. Position Dropdown
    // Reset basic styles
    dropdownList.style.top = '';
    dropdownList.style.bottom = '';
    dropdownList.style.left = `${rect.left}px`;
    dropdownList.style.minWidth = `${rect.width}px`;
    dropdownList.style.width = 'auto';
    
    // Calculate Space
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const minSpaceRequired = 300; // Preferable space for list

    // Decision: Flip if tight below but spacious above
    if (spaceBelow < minSpaceRequired && spaceAbove > spaceBelow) {
        // Position Above
        const dropdownHeight = dropdownList.offsetHeight;
        dropdownList.style.top = `${(scrollTop + rect.top) - dropdownHeight}px`;
    } else {
        // Position Below
        dropdownList.style.top = `${rect.bottom + scrollTop}px`;
    }
}

function renderDropdownItems(input, suggestions) {
    dropdownList.innerHTML = '';
    
    if (suggestions.length === 0) {
        hideDropdown();
        return;
    }

    suggestions.forEach(s => {
        const li = document.createElement('li');
        li.className = 'autocomplete-item';
        li.dataset.value = s.value;
        
        let labelHTML = `<strong>${s.value}</strong>`;
        
        if (s.type === 'new') {
            li.classList.add('suggestion-new');
            if (s.index === 0) {
                labelHTML += ` <span class="autocomplete-meta">✨ START NEW ARRAY</span>`;
            } else {
                labelHTML += ` <span class="autocomplete-meta">✨ ADD NEW ITEM (Index ${s.index})</span>`;
            }
        } else if (s.type === 'existing') {
            li.classList.add('suggestion-join');
            labelHTML += ` <span class="autocomplete-meta">🔗 ADD TO EXISTING (Index ${s.index})</span>`;
        }

        li.innerHTML = labelHTML;
        
        li.addEventListener('mousedown', (e) => {
             e.preventDefault(); // Prevent blur on input
             selectItem(input, li);
        });

        dropdownList.appendChild(li);
    });

    dropdownList.classList.add('visible');
    activeInputIndex = -1;
}

// --- End Autocomplete Logic ---


function renderMappingTable() {
    console.log('Rendering Mapping Table...');
    mappingTbody.innerHTML = '';
    
    // Use schemaFields directly
    const availableFieldPaths = schemaFields.map(f => f.path);
    console.log(`Available Fields: ${availableFieldPaths.length}, CSV Headers: ${csvHeaders.length}`);

    try {
        console.log('Generating Auto Mapping...');
        const autoMapping = generateAutoMapping(csvHeaders, schemaFields);
        console.log('Auto Mapping Generated:', autoMapping);

        csvHeaders.forEach((header, index) => {
            const row = document.createElement('tr');
            row.dataset.reviewed = "false"; 
            row.classList.add('needs-review');
            
            // 1. CSV Header
            const headerCell = document.createElement('td');
            headerCell.textContent = header;
            row.appendChild(headerCell);

            // 2. Sample Value
            const sampleCell = document.createElement('td');
            const sampleVal = csvData.length > 0 ? csvData[0][header] : '';
            sampleCell.textContent = typeof sampleVal === 'string' && sampleVal.length > 50 
                ? sampleVal.substring(0, 50) + '...' 
                : sampleVal;
            sampleCell.style.color = '#666';
            sampleCell.style.fontStyle = 'italic';
            row.appendChild(sampleCell);

            // 3. Target Field Input (Custom Autocomplete)
            const targetCell = document.createElement('td');
            const input = document.createElement('input');
            input.type = 'text';
            // Removed list="..." attribute
            input.className = 'dpp-field-input';
            input.dataset.csvHeader = header;
            input.placeholder = 'Search target field...';
            input.style.width = '100%';
            input.autocomplete = "off"; // Disable browser native autocomplete
            
            // Setup custom autocomplete
            setupAutocomplete(input);

            // Apply Auto-Mapping
            if (autoMapping[header]) {
                input.value = autoMapping[header];
            }

            targetCell.appendChild(input);
            row.appendChild(targetCell);

            // 4. Review Checkbox
            const reviewCell = document.createElement('td');
            reviewCell.style.textAlign = 'center';
            reviewCell.style.cursor = 'pointer';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'review-checkbox';
            checkbox.title = "Confirm this mapping";
            
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

            checkbox.addEventListener('change', () => {
                toggleReview(checkbox.checked);
            });

            reviewCell.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    toggleReview(!checkbox.checked);
                }
            });

            reviewCell.appendChild(checkbox);
            row.appendChild(reviewCell);
            
            mappingTbody.appendChild(row);
        });

        // Add "Approve All" button
        const existingBtn = document.getElementById('approve-all-btn');
        if (existingBtn) existingBtn.remove();

        const approveAllBtn = document.createElement('button');
        approveAllBtn.id = 'approve-all-btn';
        approveAllBtn.textContent = 'Approve All';
        approveAllBtn.className = 'secondary-btn'; // Assuming this class exists or I'll style it
        approveAllBtn.style.marginTop = '1rem';
        approveAllBtn.style.marginBottom = '1rem';
        approveAllBtn.style.float = 'right';

        approveAllBtn.addEventListener('click', () => {
            document.querySelectorAll('.review-checkbox').forEach(cb => {
                cb.checked = true;
                const row = cb.closest('tr');
                if (row) {
                    row.classList.remove('needs-review');
                    row.dataset.reviewed = "true";
                }
            });
            updateGenerateButtonState();
        });

        mappingTbody.closest('table').after(approveAllBtn);
        
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