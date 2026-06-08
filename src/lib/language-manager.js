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
}
