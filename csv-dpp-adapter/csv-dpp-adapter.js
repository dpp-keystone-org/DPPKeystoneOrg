import Papa from '../lib/vendor/papaparse.js?v=1770749483538';
import { loadSchema, flattenSchema } from '../lib/schema-loader.js?v=1770749483538';
import { loadOntology } from '../lib/ontology-loader.js?v=1770749483538';
import { generateDPPsFromCsv, generateAutoMapping, findUsedIndices, generateIndexedSuggestions, analyzeColumnData, isTypeCompatible, enrichSchemaWithOntology, validateMappingConstraints, getMissingRequiredFields, validateValue } from '../lib/csv-adapter-logic.js?v=1770749483538';

console.log('CSV Adapter Initialized');

// Wrap the entire script in a DOMContentLoaded listener to ensure elements are present
document.addEventListener('DOMContentLoaded', async () => {

    // DOM Elements
    const fileInput = document.getElementById('csv-file-input');
    const dropArea = document.getElementById('drop-area');
    const fileInfo = document.getElementById('file-info');
    const fileNameDisplay = document.getElementById('file-name');
    const rowCountDisplay = document.getElementById('row-count');
    const mappingSection = document.getElementById('mapping-section');
    const mappingTbody = document.getElementById('mapping-tbody');
    const actionSection = document.getElementById('action-section');
    const generateBtn = document.getElementById('generate-btn');
    const loadConfigBtn = document.getElementById('load-config-btn');
    const saveConfigBtn = document.getElementById('save-config-btn');
    const configFileInput = document.getElementById('config-file-input');
    const showIncompatibleToggle = document.getElementById('show-incompatible-toggle');
    const outputArea = document.getElementById('output-area');
    let showErrorsBtn;
    let errorCountBadge;

    // Autocomplete Dropdown Singleton
    let dropdownList = null;
    let activeInputIndex = -1;

    // State
    let csvData = [];
    let csvHeaders = [];
    let csvColumnTypes = new Map();
    let schemaFields = [];
    let schemaFieldMap = new Map();
    let validationErrors = [];

    function createDropdown() {
        dropdownList = document.createElement('ul');
        dropdownList.id = 'autocomplete-dropdown';
        dropdownList.className = 'autocomplete-dropdown';
        document.body.appendChild(dropdownList);

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.autocomplete-dropdown') && !e.target.closest('.dpp-field-input')) {
                hideDropdown();
            }
        });
    }

    function createValidationUI() {
        showErrorsBtn = document.createElement('button');
        showErrorsBtn.id = 'show-errors-btn';
        showErrorsBtn.className = 'btn-danger';
        showErrorsBtn.hidden = true;
        showErrorsBtn.innerHTML = 'Show Errors (<span id="error-count-badge">0</span>)';
        
        errorCountBadge = showErrorsBtn.querySelector('#error-count-badge');

        if (generateBtn.parentElement) {
            generateBtn.parentElement.insertBefore(showErrorsBtn, generateBtn);
        }

        showErrorsBtn.addEventListener('click', showErrorsModal);
    }

    function setupEventListeners() {
        fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
        
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

        document.querySelectorAll('input[name="sector"]').forEach(checkbox => {
            checkbox.addEventListener('change', updateSchema);
        });

        saveConfigBtn.addEventListener('click', exportMappingConfig);
        loadConfigBtn.addEventListener('click', () => configFileInput.click());
        configFileInput.addEventListener('change', (e) => importMappingConfig(e.target.files[0]));

        showIncompatibleToggle.addEventListener('change', () => {
            const active = document.activeElement;
            if (active && active.classList.contains('dpp-field-input')) {
                showDropdown(active);
            }
        });

        generateBtn.addEventListener('click', generateDPPs);
    }

    function getSelectedSectors() {
        return Array.from(document.querySelectorAll('input[name="sector"]:checked')).map(cb => cb.value);
    }

    async function updateSchema() {
        const sectors = getSelectedSectors();
        const schemasToLoad = new Set(['dpp', 'general-product', ...sectors]);

        try {
            console.log(`Loading schemas for: ${Array.from(schemasToLoad).join(', ')}...`);
            let allFields = new Map();
            
            for (const sector of schemasToLoad) {
                const [schema, ontology] = await Promise.all([
                    loadSchema(sector),
                    loadOntology(sector)
                ]);
                
                const fields = flattenSchema(schema, '', false, true);
                if (ontology) {
                    enrichSchemaWithOntology(fields, ontology);
                }
                fields.forEach(f => allFields.set(f.path, f));
            }
            
            schemaFields = Array.from(allFields.values()).sort((a, b) => a.path.localeCompare(b.path));
            schemaFieldMap = allFields;
            console.log(`Loaded ${schemaFields.length} unique fields.`);
            
            if (csvHeaders.length > 0) {
                renderMappingTable();
            }
            window.dppSchemaLoaded = true;
        } catch (err) {
            console.error('Error loading schema:', err);
            alert('Failed to load schemas.');
        }
    }

    function handleFile(file) {
        if (!file) return;

        if (file.name.endsWith('.json')) {
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
                
                csvColumnTypes.clear();
                csvHeaders.forEach(header => {
                    const info = analyzeColumnData(csvData, header);
                    csvColumnTypes.set(header, info);
                });

                rowCountDisplay.textContent = csvData.length;
                fileInfo.classList.remove('hidden');
                mappingSection.classList.remove('hidden');
                actionSection.classList.remove('hidden');

                renderMappingTable();
            }
        });
    }

    function runAllValidations() {
        updateAllRowValidations();
        updateGlobalValidationStatus();
        updateGenerateButtonState();
    }

    function updateGlobalValidationStatus() {
        const currentMapping = getMappingConfig();

        const oneOfConflicts = validateMappingConstraints(currentMapping, schemaFieldMap);
        const missingRequired = getMissingRequiredFields(currentMapping, schemaFields);

        validationErrors = [];
        if (missingRequired.length > 0) {
            validationErrors.push(...missingRequired.map(f => `Missing required field: ${f}`));
        }
        if (oneOfConflicts.length > 0) {
            oneOfConflicts.forEach(group => {
                validationErrors.push(`Conflict: The following fields are mutually exclusive and cannot be mapped at the same time: ${group.map(p => `
${p}
`).join(', ')}`);
            });
        }

        // Check for type-incompatibility errors across all rows
        for (const [header, mappedPath] of Object.entries(currentMapping)) {
            if (!mappedPath) continue;

            const schemaPath = mappedPath.replace(/[\[\]\d+]/g, '');
            const targetField = schemaFieldMap.get(schemaPath);
            const columnType = csvColumnTypes.get(header);

            if (targetField && columnType && !isTypeCompatible(columnType, targetField)) {
                const errorMsg = `Type Mismatch on row \`${header}\`: Column is type \`${columnType.type}\` but field \`${targetField.path}\` requires type \`${targetField.type || 'ontology-defined'}\`.`;
                validationErrors.push(errorMsg);
            } else if (targetField) {
                // Check all non-empty values in the column for other validity constraints
                for (const csvRow of csvData) {
                    const value = csvRow[header];
                    if (!validateValue(value, targetField)) {
                        const errorMsg = `Invalid Value in column \`${header}\`: The value \`${value}\` is not valid for field \`${targetField.path}\`. Allowed values: ${targetField.enum.join(', ')}.`;
                        validationErrors.push(errorMsg);
                        break; // Just one error per column is enough for the modal
                    }
                }
            }
        }

        const hasErrors = validationErrors.length > 0;
        
        generateBtn.hidden = hasErrors;
        showErrorsBtn.hidden = !hasErrors;

        if (hasErrors) {
            errorCountBadge.textContent = validationErrors.length;
        }

        saveConfigBtn.disabled = hasErrors;
        saveConfigBtn.title = hasErrors ? "Please fix validation errors before saving" : "Save Mapping Config";
    }

    function showErrorsModal() {
        const existingModal = document.querySelector('.error-summary-modal-overlay');
        if (existingModal) existingModal.remove();

        const overlay = document.createElement('div');
        overlay.className = 'error-summary-modal-overlay';
        const modal = document.createElement('div');
        modal.className = 'error-summary-modal';
        const h3 = document.createElement('h3');
        h3.textContent = 'Validation Errors';
        modal.appendChild(h3);
        const list = document.createElement('ul');
        validationErrors.forEach(errText => {
            const listItem = document.createElement('li');
            listItem.innerHTML = errText.replace(/`([^`]+)`/g, '<code>$1</code>');
            list.appendChild(listItem);
        });
        modal.appendChild(list);
        
        const closeButton = document.createElement('button');
        closeButton.className = 'modal-close-btn';
        closeButton.innerHTML = '&times;';
        
        const closeModal = () => overlay.remove();
        closeButton.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        modal.appendChild(closeButton);
        overlay.appendChild(modal)
        document.body.appendChild(overlay);

        const styleId = 'error-modal-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .error-summary-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
                .error-summary-modal { background: white; padding: 20px; border-radius: 8px; max-width: 600px; width: 90%; position: relative; box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
                .error-summary-modal ul { padding-left: 20px; margin-top: 10px; }
                .error-summary-modal li { margin-bottom: 10px; }
                .error-summary-modal code { background: #eee; padding: 2px 4px; border-radius: 4px; font-family: monospace; }
                .modal-close-btn { position: absolute; top: 10px; right: 10px; background: none; border: none; font-size: 1.5rem; cursor: pointer; }
            `;
            document.head.appendChild(style);
        }
    }

    function updateAllRowValidations() {
        document.querySelectorAll('#mapping-tbody tr.conflict-row').forEach(row => {
            row.classList.remove('conflict-row');
            const input = row.querySelector('.dpp-field-input');
            if (input && input.title.startsWith('Conflict:')) {
                input.title = '';
            }
        });

        const currentMapping = getMappingConfig();
        const conflicts = validateMappingConstraints(currentMapping, schemaFieldMap);

        if (conflicts.length > 0) {
            for (const conflictGroup of conflicts) {
                const otherFields = conflictGroup.slice(1).map(p => `
${p}
`).join(', ');
                const groupMessage = `Conflict: This field is mutually exclusive with ${otherFields}.`;

                document.querySelectorAll('#mapping-tbody .dpp-field-input').forEach(input => {
                    if (conflictGroup.includes(input.value)) {
                        const row = input.closest('tr');
                        row.classList.add('conflict-row');
                        input.title = groupMessage;
                    }
                });
            }
        }
    }

    function validateRow(input) {
        const row = input.closest('tr');
        if (!row) return;
        const mappedPath = input.value;
        row.classList.remove('error-row');
        if (!input.title.startsWith('Conflict:')) {
            input.title = '';
        }
        if (!mappedPath) return;

        const header = input.dataset.csvHeader;
        const schemaPath = mappedPath.replace(/[\[\]\d+]/g, '');
        const targetField = schemaFieldMap.get(schemaPath);
        const columnType = csvColumnTypes.get(header);
        let typeError = null;

        if (targetField && columnType && !isTypeCompatible(columnType, targetField)) {
            typeError = `Type Mismatch: Column is '${columnType.type}' but Field requires '${targetField.type}'`;
        }

        // Also check for enum validity using a sample value.
        if (!typeError && targetField) {
            const sampleRow = csvData.find(d => d[header] !== null && d[header] !== undefined && String(d[header]).trim() !== '');
            if (sampleRow) {
                const sampleValue = sampleRow[header];
                if (!validateValue(sampleValue, targetField)) {
                    typeError = `Invalid Value: Sample value '${sampleValue}' is not allowed for field '${targetField.path}'. Allowed: ${targetField.enum.join(', ')}`;
                }
            }
        }

        if (typeError) {
            row.classList.add('error-row');
            input.title = typeError;
        }
    }

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
        input.addEventListener('focus', () => showDropdown(input));
        input.addEventListener('input', () => {
            showDropdown(input);
            validateRow(input);
            runAllValidations();
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
        validateRow(input);
        runAllValidations();
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
        const currentVal = input.value;
        const filterText = currentVal.toLowerCase();
        const currentHeader = input.dataset.csvHeader;
        const currentColumnType = csvColumnTypes.get(currentHeader);
        const currentMapping = getMappingConfig();
        const selectedPaths = new Set(Object.values(currentMapping).filter(Boolean));
        const suggestions = [];
        const showIncompatible = showIncompatibleToggle.checked;

        schemaFields.forEach(field => {
            const isCompatible = isTypeCompatible(currentColumnType, field);
            if (!isCompatible && !showIncompatible) return;

            if (field.isArray) {
                const root = field.path.split('.')[0];
                const usedIndices = findUsedIndices(currentMapping, root);
                const indexedSuggestions = generateIndexedSuggestions(field, usedIndices);
                indexedSuggestions.forEach(s => {
                    if ((s.value === currentVal || !selectedPaths.has(s.value)) && s.value.toLowerCase().includes(filterText)) {
                        s.schemaField = field;
                        s.incompatible = !isCompatible;
                        suggestions.push(s);
                    }
                });
            } else {
                if ((field.path === currentVal || !selectedPaths.has(field.path)) && field.path.toLowerCase().includes(filterText)) {
                    suggestions.push({ value: field.path, type: 'scalar', index: null, schemaField: field, incompatible: !isCompatible });
                }
            }
        });

        renderDropdownItems(input, suggestions, currentMapping);
        if (suggestions.length === 0) {
            hideDropdown();
            return;
        }

        dropdownList.style.top = '';
        dropdownList.style.bottom = '';
        dropdownList.style.left = `${rect.left}px`;
        dropdownList.style.minWidth = `${rect.width}px`;
        dropdownList.style.width = 'auto';
        const spaceBelow = viewportHeight - rect.bottom;
        const minSpaceRequired = 300;
        if (spaceBelow < minSpaceRequired && rect.top > spaceBelow) {
            const dropdownHeight = dropdownList.offsetHeight;
            dropdownList.style.top = `${(scrollTop + rect.top) - dropdownHeight}px`;
        } else {
            dropdownList.style.top = `${rect.bottom + scrollTop}px`;
        }
    }

    function renderDropdownItems(input, suggestions, currentMapping) {
        dropdownList.innerHTML = '';
        if (suggestions.length === 0) {
            hideDropdown();
            return;
        }
        const showIncompatible = showIncompatibleToggle.checked;
        suggestions.forEach(s => {
            const tempMapping = { ...currentMapping, [input.dataset.csvHeader]: s.value };
            const conflicts = validateMappingConstraints(tempMapping, schemaFieldMap);
            let conflictError = null;
            if (conflicts.length > 0) {
                const relevantConflict = conflicts.find(group => group.includes(s.value));
                if (relevantConflict) {
                    const otherField = relevantConflict.find(p => p !== s.value);
                    s.incompatible = true;
                    conflictError = `oneOf conflict with mapped field: '${otherField}'`;
                }
            }
            if (s.incompatible && !showIncompatible) return;

            const li = document.createElement('li');
            li.className = 'autocomplete-item';
            li.dataset.value = s.value;
            let labelHTML = `<strong>${s.value}</strong>`;
            let tooltipText = '';
            if (s.schemaField) {
                let typeLabel = s.schemaField.ontology?.range?.replace('xsd:', '') || s.schemaField.format || s.schemaField.type;
                if (typeLabel) labelHTML += ` <span class="type-badge">${typeLabel}</span>`;
                if (s.schemaField.ontology?.description) tooltipText = s.schemaField.ontology.description;
            }
            if (conflictError) {
                li.classList.add('suggestion-incompatible');
                labelHTML += ` <span class="autocomplete-meta">(Incompatible)</span>`;
                li.title = tooltipText ? `${tooltipText}\n\nConflict: ${conflictError}` : `Conflict: ${conflictError}`;
            } else if (s.incompatible) {
                li.classList.add('suggestion-incompatible');
                labelHTML += ` <span class="autocomplete-meta">(Incompatible Type)</span>`;
                li.title = tooltipText;
            } else if (s.type === 'new') {
                labelHTML += ` <span class="autocomplete-meta">${s.index === 0 ? '✨ START NEW ARRAY' : `✨ ADD NEW ITEM (Index ${s.index})`}</span>`;
                li.title = tooltipText;
            } else if (s.type === 'existing') {
                labelHTML += ` <span class="autocomplete-meta">🔗 ADD TO EXISTING (Index ${s.index})</span>`;
                li.title = tooltipText;
            } else {
                li.title = tooltipText;
            }
            li.innerHTML = labelHTML;
            li.addEventListener('mousedown', (e) => {
                e.preventDefault();
                selectItem(input, li);
            });
            dropdownList.appendChild(li);
        });
        dropdownList.classList.add('visible');
        activeInputIndex = -1;
    }

    function renderMappingTable() {
        mappingTbody.innerHTML = '';
        try {
            const autoMapping = generateAutoMapping(csvHeaders, schemaFields);
            csvHeaders.forEach((header) => {
                const row = document.createElement('tr');
                row.dataset.reviewed = "false";
                row.classList.add('needs-review');
                
                const headerCell = document.createElement('td');
                headerCell.textContent = header;
                row.appendChild(headerCell);

                const sampleCell = document.createElement('td');
                const sampleVal = csvData.length > 0 ? csvData[0][header] : '';
                sampleCell.textContent = typeof sampleVal === 'string' && sampleVal.length > 50 ? sampleVal.substring(0, 50) + '...' : sampleVal;
                sampleCell.className = 'sample-data';
                row.appendChild(sampleCell);

                const targetCell = document.createElement('td');
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'dpp-field-input';
                input.dataset.csvHeader = header;
                input.placeholder = 'Search target field...';
                input.autocomplete = "off";
                setupAutocomplete(input);
                if (autoMapping[header]) {
                    input.value = autoMapping[header];
                    validateRow(input);
                }
                targetCell.appendChild(input);
                row.appendChild(targetCell);

                const reviewCell = document.createElement('td');
                reviewCell.className = 'review-cell';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'review-checkbox';
                checkbox.title = "Confirm this mapping";
                const toggleReview = (newState) => {
                    checkbox.checked = newState;
                    row.classList.toggle('needs-review', !newState);
                    row.dataset.reviewed = String(newState);
                    updateGenerateButtonState();
                };
                checkbox.addEventListener('change', () => toggleReview(checkbox.checked));
                reviewCell.addEventListener('click', (e) => {
                    if (e.target !== checkbox) toggleReview(!checkbox.checked);
                });
                reviewCell.appendChild(checkbox);
                row.appendChild(reviewCell);
                mappingTbody.appendChild(row);
            });

            const existingBtn = document.getElementById('approve-all-btn');
            if (existingBtn) existingBtn.remove();
            const approveAllBtn = document.createElement('button');
            approveAllBtn.id = 'approve-all-btn';
            approveAllBtn.textContent = 'Approve All';
            approveAllBtn.className = 'secondary-btn';
            approveAllBtn.style.marginTop = '1rem';
            approveAllBtn.style.marginBottom = '1rem';
            approveAllBtn.style.float = 'right';
            approveAllBtn.addEventListener('click', () => {
                document.querySelectorAll('.review-checkbox:not(:checked)').forEach(cb => cb.click());
            });
            mappingTbody.closest('table').after(approveAllBtn);
            
            // Run validation after a timeout to ensure the DOM is fully updated
            // and avoid a race condition that was causing the page to freeze.
            setTimeout(runAllValidations, 0);
            updateGenerateButtonState();
        } catch (e) {
            console.error('Error in renderMappingTable:', e);
        }
    }

    function updateGenerateButtonState() {
        const allRows = document.querySelectorAll('#mapping-tbody tr');
        const checkedRows = document.querySelectorAll('.review-checkbox:checked');
        const allChecked = allRows.length > 0 && allRows.length === checkedRows.length;
        
        if (!generateBtn.hidden) {
            generateBtn.disabled = !allChecked;
            generateBtn.title = allChecked ? "Generate DPPs" : "Please review and check all rows first";
        }
        // The save button's state should also be updated based on the 'allChecked' status,
        // using the same condition as the generate button.
        if (!generateBtn.hidden) {
            saveConfigBtn.disabled = !allChecked;
            saveConfigBtn.title = allChecked ? "Save Mapping Config" : "Please review and check all rows first";
        }
    }

    function getMappingConfig() {
        const mapping = {};
        document.querySelectorAll('.dpp-field-input').forEach(input => {
            mapping[input.dataset.csvHeader] = input.value || "";
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
        document.querySelectorAll('.dpp-field-input').forEach(input => {
            const header = input.dataset.csvHeader;
            if (Object.prototype.hasOwnProperty.call(config, header)) {
                input.value = config[header] || '';
                validateRow(input);
                const row = input.closest('tr');
                if (row) {
                    const checkbox = row.querySelector('.review-checkbox');
                    if (checkbox && !checkbox.checked) checkbox.click();
                }
            } else {
                input.value = '';
            }
        });
        runAllValidations();
        updateGenerateButtonState();
    }

    function generateDPPs() {
        if (validationErrors.length > 0) {
            alert('Please fix all validation errors before generating.');
            showErrorsModal();
            return;
        }
        if (document.querySelectorAll('.review-checkbox:not(:checked)').length > 0) {
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
        const blob = new Blob([JSON.stringify(generatedDocs, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dpp-batch-export-${sectors.join('-')}.json`;
        a.click();
        URL.revokeObjectURL(url);
        outputArea.innerHTML = `<p class="success">Successfully generated ${generatedDocs.length} DPPs!</p>`;
    }
    
    // --- Initial Run ---
    // This is where the script execution starts
    (async () => {
        createDropdown();
        createValidationUI();
        setupEventListeners();
        await updateSchema();
    })();
});
