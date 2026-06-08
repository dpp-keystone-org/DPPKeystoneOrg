/**
 * @jest-environment jsdom
 */

import { LanguageManager } from '../../../src/lib/language-manager.js';

describe('LanguageManager', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should return default language "en" when localStorage is empty', () => {
        expect(LanguageManager.getPreferredLanguage()).toBe('en');
    });

    it('should return stored language when a valid 2-letter code is present', () => {
        localStorage.setItem('dpp_keystone_preferred_language', 'de');
        expect(LanguageManager.getPreferredLanguage()).toBe('de');
    });

    it('should return default language "en" if stored value is invalid', () => {
        localStorage.setItem('dpp_keystone_preferred_language', 'invalid_code');
        expect(LanguageManager.getPreferredLanguage()).toBe('en');
    });

    it('should set preferred language in localStorage when given a valid code', () => {
        LanguageManager.setPreferredLanguage('fr');
        expect(localStorage.getItem('dpp_keystone_preferred_language')).toBe('fr');
    });

    it('should not set preferred language if code is invalid', () => {
        LanguageManager.setPreferredLanguage('invalid');
        expect(localStorage.getItem('dpp_keystone_preferred_language')).toBeNull();
    });

    it('should export 24 supported official EU languages', () => {
        expect(LanguageManager.SUPPORTED_LANGUAGES).toHaveLength(24);
        expect(LanguageManager.SUPPORTED_LANGUAGES).toContainEqual({ code: 'en', label: 'English' });
        expect(LanguageManager.SUPPORTED_LANGUAGES).toContainEqual({ code: 'de', label: 'Deutsch (German)' });
    });

    it('should render a select widget pre-selected with the preferred language', () => {
        localStorage.setItem('dpp_keystone_preferred_language', 'fr');
        const select = LanguageManager.renderSelectorWidget();
        
        expect(select.tagName).toBe('SELECT');
        expect(select.options.length).toBe(24);
        expect(select.value).toBe('fr');
    });

    it('should update localStorage and trigger callback when selector value changes', () => {
        const mockCallback = jest.fn();
        const select = LanguageManager.renderSelectorWidget(mockCallback);
        
        select.value = 'es';
        select.dispatchEvent(new Event('change'));
        
        expect(localStorage.getItem('dpp_keystone_preferred_language')).toBe('es');
        expect(mockCallback).toHaveBeenCalledWith('es');
    });
});
