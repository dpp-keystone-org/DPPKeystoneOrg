// src/lib/language-manager.js

export class LanguageManager {
    static STORAGE_KEY = 'dpp_keystone_preferred_language';
    static DEFAULT_LANGUAGE = 'en';

    static SUPPORTED_LANGUAGES = [
        { code: 'bg', label: 'Български (Bulgarian)' },
        { code: 'hr', label: 'Hrvatski (Croatian)' },
        { code: 'cs', label: 'Čeština (Czech)' },
        { code: 'da', label: 'Dansk (Danish)' },
        { code: 'nl', label: 'Nederlands (Dutch)' },
        { code: 'en', label: 'English' },
        { code: 'et', label: 'Eesti (Estonian)' },
        { code: 'fi', label: 'Suomi (Finnish)' },
        { code: 'fr', label: 'Français (French)' },
        { code: 'de', label: 'Deutsch (German)' },
        { code: 'el', label: 'Ελληνικά (Greek)' },
        { code: 'hu', label: 'Magyar (Hungarian)' },
        { code: 'ga', label: 'Gaeilge (Irish)' },
        { code: 'it', label: 'Italiano (Italian)' },
        { code: 'lv', label: 'Latviešu (Latvian)' },
        { code: 'lt', label: 'Lietuvių (Lithuanian)' },
        { code: 'mt', label: 'Malti (Maltese)' },
        { code: 'pl', label: 'Polski (Polish)' },
        { code: 'pt', label: 'Português (Portuguese)' },
        { code: 'ro', label: 'Română (Romanian)' },
        { code: 'sk', label: 'Slovenčina (Slovak)' },
        { code: 'sl', label: 'Slovenščina (Slovenian)' },
        { code: 'es', label: 'Español (Spanish)' },
        { code: 'sv', label: 'Svenska (Swedish)' }
    ];

    /**
     * Retrieves the user's persistent preferred language from localStorage.
     * @returns {string} The 2-letter language code (e.g., 'en', 'de').
     */
    static getPreferredLanguage() {
        if (typeof localStorage !== 'undefined') {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored && /^[a-z]{2}$/.test(stored)) {
                return stored;
            }
        }
        return this.DEFAULT_LANGUAGE;
    }

    /**
     * Persists the user's preferred language to localStorage.
     * @param {string} lang The 2-letter language code.
     */
    static setPreferredLanguage(lang) {
        if (typeof localStorage !== 'undefined' && lang && /^[a-z]{2}$/.test(lang)) {
            localStorage.setItem(this.STORAGE_KEY, lang);
        }
    }

    /**
     * Renders a standardized <select> dropdown populated with all EU languages.
     * Automatically binds to localStorage and invokes onChangeCallback.
     * @param {Function} [onChangeCallback] Invoked with new language code on change.
     * @returns {HTMLSelectElement}
     */
    static renderSelectorWidget(onChangeCallback) {
        const select = document.createElement('select');
        select.id = 'language-selector';
        select.className = 'keystone-language-selector';
        const current = this.getPreferredLanguage();

        this.SUPPORTED_LANGUAGES.forEach(lang => {
            const option = document.createElement('option');
            option.value = lang.code;
            option.textContent = lang.label;
            if (lang.code === current) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        select.addEventListener('change', (event) => {
            this.setPreferredLanguage(event.target.value);
            if (typeof onChangeCallback === 'function') {
                onChangeCallback(event.target.value);
            }
        });

        return select;
    }

    /**
     * Internal generic function to find the right language string from a JSON-LD array
     */
    static getBestTranslation(dataArray, targetLang) {
        if (!Array.isArray(dataArray)) return null;
        const match = dataArray.find(t => t['@language'] === targetLang);
        if (match) return match['@value'];
        const fallback = dataArray.find(t => t['@language'] === 'en');
        if (fallback) return fallback['@value'];
        return dataArray[0]?.['@value'] || null;
    }

    /**
     * Translates all elements on the page based on the current language.
     * Handles both inline JSON (`data-i18n`) and external keys (`data-i18n-key`).
     */
    static localizeDOM(lang, externalTranslations = {}) {
        // 1. Process inline JSON-LD translations (used by generated spec docs)
        document.querySelectorAll('.i18n-text[data-i18n]').forEach(el => {
            try {
                const data = JSON.parse(el.dataset.i18n);
                const translatedText = this.getBestTranslation(data, lang);
                if (translatedText) el.innerHTML = translatedText;
            } catch (err) {
                console.warn('Failed to parse inline i18n data', err);
            }
        });

        // 2. Process external key-based translations (used by static UI HTML)
        document.querySelectorAll('[data-i18n-key]').forEach(el => {
            const key = el.getAttribute('data-i18n-key');
            if (externalTranslations && externalTranslations[key]) {
                const translatedText = this.getBestTranslation(externalTranslations[key], lang);
                if (translatedText) {
                    if (el.tagName === 'INPUT' && el.hasAttribute('placeholder')) {
                        el.setAttribute('placeholder', translatedText);
                    } else {
                        el.innerHTML = translatedText;
                    }
                }
            }
        });
    }

    /**
     * Initializes LanguageManager on a page.
     * Looks for an element with ID 'language-widget-wrapper' and appends the widget.
     * Dispatches a custom 'languageChanged' event on document when the language changes.
     * @param {string} [resourcePath] Optional path to a ui-translations JSON file to fetch.
     */
    static async init(resourcePath = null) {
        let externalTranslations = {};
        if (resourcePath) {
            try {
                const response = await fetch(resourcePath);
                if (response.ok) {
                    externalTranslations = await response.json();
                }
            } catch (err) {
                console.warn(`Failed to fetch translations from ${resourcePath}`, err);
            }
        }

        const wrapper = document.getElementById('language-widget-wrapper');
        if (wrapper) {
            wrapper.appendChild(this.renderSelectorWidget((lang) => {
                document.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
            }));
        }

        // Global listener that handles all DOM updates
        document.addEventListener('languageChanged', (e) => {
            this.localizeDOM(e.detail.language, externalTranslations);
        });

        // Fire it initially so the page can localize itself on load
        document.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: this.getPreferredLanguage() } }));
    }
}
