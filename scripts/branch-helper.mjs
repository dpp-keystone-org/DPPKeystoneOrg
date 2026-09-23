/**
 * @file branch-helper.mjs
 * @description Helper utility to resolve the active preview branch name.
 * 
 * Logic:
 * 1. If `process.env.PREVIEW_BRANCH` is explicitly set (even as an empty string ""),
 *    use that value. Setting `PREVIEW_BRANCH=""` forces canonical production mode.
 * 2. If `process.env.PREVIEW_BRANCH` is undefined, inspect git to auto-detect the current branch:
 *    - Ignores production/release branches ('main', 'master', 'gh-pages', 'legacy/*', 'HEAD').
 *    - Returns the active branch name (e.g. 'feature/version3') if on a feature branch.
 *    - Returns '' if git command fails or if on an ignored branch.
 */
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const CANONICAL_BRANCHES = new Set(['main', 'master', 'gh-pages', 'HEAD']);

/**
 * Determines the active preview branch name.
 * @returns {string} The active preview branch, or '' for canonical production.
 */
export function getPreviewBranch() {
    if (process.env.PREVIEW_BRANCH !== undefined) {
        return process.env.PREVIEW_BRANCH;
    }

    try {
        const branch = execSync('git rev-parse --abbrev-ref HEAD', {
            cwd: PROJECT_ROOT,
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore']
        }).trim();

        if (!branch || CANONICAL_BRANCHES.has(branch) || branch.startsWith('legacy/')) {
            return '';
        }
        return branch;
    } catch {
        return '';
    }
}

/**
 * Returns the preview chunk URL prefix (e.g. '/preview/feature/version3' or '').
 * @returns {string}
 */
export function getPreviewChunk() {
    const branch = getPreviewBranch();
    return branch ? `/preview/${branch}` : '';
}
