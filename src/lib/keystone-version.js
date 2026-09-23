export const KEYSTONE_VERSION = 'v3';
export const CANONICAL_SPEC_URL = 'https://dpp-keystone.org/spec/';

/**
 * Regex matching any Keystone spec URL (canonical or branch preview).
 * Group 1 captures the subpath after `/spec/`.
 */
export const SPEC_URL_REGEX = /^https:\/\/dpp-keystone\.org(?:\/preview\/.+?)?\/spec\/(.*)$/;

/**
 * Checks if a URL points to the Keystone spec (canonical or branch preview).
 * @param {string} url
 * @returns {boolean}
 */
export function isSpecUrl(url) {
    return typeof url === 'string' && SPEC_URL_REGEX.test(url);
}

/**
 * Strips any `/preview/<branch>` prefix to return the canonical `https://dpp-keystone.org/spec/...` URL.
 * @param {string} url
 * @returns {string}
 */
export function normalizeSpecUrl(url) {
    if (typeof url !== 'string') return url;
    return url.replace(/^https:\/\/dpp-keystone\.org\/preview\/.+?\/spec\//, CANONICAL_SPEC_URL);
}

/**
 * Converts a canonical or preview spec URL into a local relative path.
 * @param {string} url
 * @param {string} [prefix='../spec/']
 * @returns {string}
 */
export function specUrlToRelativePath(url, prefix = '../spec/') {
    if (typeof url !== 'string') return url;
    const match = url.match(SPEC_URL_REGEX);
    return match ? prefix + match[1] : url;
}

/**
 * Injects a preview branch prefix into a canonical spec URL if previewBranch is provided.
 * @param {string} url
 * @param {string} [previewBranch='']
 * @returns {string}
 */
export function specUrlToPreviewUrl(url, previewBranch = '') {
    if (typeof url !== 'string' || !previewBranch) return url;
    const canonical = normalizeSpecUrl(url);
    return canonical.replace(CANONICAL_SPEC_URL, `https://dpp-keystone.org/preview/${previewBranch}/spec/`);
}

/**
 * Rewrites all spec URLs (contexts, ontology, validation, examples, terms#, etc.)
 * to include the preview chunk if a preview branch/chunk is active, and replaces
 * {{VERSION}} with KEYSTONE_VERSION.
 * @param {string} content
 * @param {string} [previewBranchOrChunk='']
 * @returns {string}
 */
export function rewriteSpecUrls(content, previewBranchOrChunk = '') {
    if (typeof content !== 'string') return content;
    if (previewBranchOrChunk) {
        const chunk = previewBranchOrChunk.startsWith('/preview/')
            ? previewBranchOrChunk
            : `/preview/${previewBranchOrChunk}`;
        content = content.replace(
            /https:\/\/dpp-keystone\.org\/spec\//g,
            `https://dpp-keystone.org${chunk}/spec/`
        );
    }
    return content.replace(/\{\{VERSION\}\}/g, KEYSTONE_VERSION);
}

// Backward-compatible alias
export const rewriteSpecFileUrls = rewriteSpecUrls;
