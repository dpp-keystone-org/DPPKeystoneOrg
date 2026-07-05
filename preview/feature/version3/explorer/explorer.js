import { loadHeader } from '../branding/header.js?v=1783267426364';
import { buildIndex } from '../lib/ontology-indexer.js?v=1783267426364';
import { LanguageManager } from '../lib/language-manager.js?v=1783267426364';

loadHeader('dpp-header-container', '..');

let fullIndex = [];

/**
 * Renders a list of ontology terms to the DOM.
 * @param {Array} items - The list of items to display.
 */
function renderResults(items) {
    const grid = document.getElementById('results-grid');
    const countLabel = document.getElementById('results-count');
    
    grid.innerHTML = '';
    
    if (items.length === 0) {
        countLabel.textContent = 'No matching terms found.';
        return;
    }

    countLabel.textContent = `Showing ${items.length} term${items.length !== 1 ? 's' : ''}`;

    // Limit display to 50 items to prevent DOM freezing on empty search
    const displayItems = items.slice(0, 50);

    displayItems.forEach(term => {
        const card = document.createElement('div');
        card.className = 'term-card';
        
        let metaHtml = '';
        if (term.contextLabel) {
            const contextContent = term.contextDocUrl 
                ? `<a href="${term.contextDocUrl}" target="_blank">${term.contextLabel}</a>` 
                : term.contextLabel;
            metaHtml += `<span class="meta-item"><strong>Context:</strong> ${contextContent}</span>`;
        }
        if (term.unit) metaHtml += `<span class="meta-item"><strong>Unit:</strong> ${term.unit}</span>`;
        if (term.range) metaHtml += `<span class="meta-item"><strong>Type:</strong> ${term.range}</span>`;
        
        if (term.domain) {
            const domainContent = term.domainDocUrl 
                ? `<a href="${term.domainDocUrl}" target="_blank">${term.domain}</a>` 
                : term.domain;
            metaHtml += `<span class="meta-item"><strong>Applies to:</strong> ${domainContent}</span>`;
        }
        
        const idHtml = term.docUrl 
            ? `<a href="${term.docUrl}" class="term-id" target="_blank" title="View Definition">${term.id}</a>`
            : `<span class="term-id">${term.id}</span>`;

        const badgeHtml = term.contextLabel 
            ? `<span class="context-badge">${term.contextLabel}</span>` 
            : '';

        const labelArray = Object.entries(term.labelMap || {}).map(([lang, val]) => ({ "@language": lang, "@value": val }));
        const commentArray = Object.entries(term.commentMap || {}).map(([lang, val]) => ({ "@language": lang, "@value": val }));

        // Escape JSON correctly by replacing quotes
        const labelHtml = labelArray.length > 0 
            ? `<span class="i18n-text" data-i18n="${JSON.stringify(labelArray).replace(/"/g, '&quot;')}">${term.label}</span>`
            : term.label;

        const commentHtml = commentArray.length > 0
            ? `<span class="i18n-text" data-i18n="${JSON.stringify(commentArray).replace(/"/g, '&quot;')}">${term.comment}</span>`
            : term.comment;

        card.innerHTML = `
            <div class="term-header">
                ${idHtml}
                ${badgeHtml}
            </div>
            <div class="term-label">${labelHtml}</div>
            <div class="term-comment">${commentHtml}</div>
            <div class="term-meta">
                ${metaHtml}
            </div>
        `;
        grid.appendChild(card);
    });

    if (items.length > 50) {
        const more = document.createElement('div');
        more.style.gridColumn = '1 / -1';
        more.style.textAlign = 'center';
        more.style.color = 'var(--text-light)';
        more.style.padding = '10px';
        more.textContent = `...and ${items.length - 50} more. Refine your search to see them.`;
        grid.appendChild(more);
    }
    
    // Apply current language to the newly rendered results
    LanguageManager.localizeDOM(LanguageManager.getPreferredLanguage());
}

/**
 * Filters the index based on the search query.
 * @param {string} query 
 */
function performSearch(query) {
    const lowerQuery = query.toLowerCase().trim();
    
    if (!lowerQuery) {
        renderResults(fullIndex);
        return;
    }

    const results = fullIndex.filter(item => {
        return (
            item.id.toLowerCase().includes(lowerQuery) ||
            item.label.toLowerCase().includes(lowerQuery) ||
            item.comment.toLowerCase().includes(lowerQuery)
        );
    });

    renderResults(results);
}

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    const searchBox = document.getElementById('search-box');
    const resultsArea = document.getElementById('results-area');
    
    // Show loading state
    document.getElementById('results-count').textContent = 'Loading ontology index...';
    searchBox.disabled = true;

    try {
        fullIndex = await buildIndex();
        searchBox.disabled = false;
        searchBox.focus();
        
        // Initial render (shows all or top 50)
        performSearch('');

        // Event listener
        searchBox.addEventListener('input', (e) => {
            performSearch(e.target.value);
        });

    } catch (error) {
        console.error(error);
        document.getElementById('results-count').textContent = 'Error loading ontology data. Check console.';
    }
});
