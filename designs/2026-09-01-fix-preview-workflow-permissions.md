# Fix GitHub Actions Preview Workflow for Fork PRs

## Motivation & Context
Pull requests originating from external forks (e.g., non-member contributors) execute GitHub Actions workflows with a read-only `GITHUB_TOKEN` for repository security. When `.github/workflows/preview.yml` runs the `Deploy to GitHub Pages Subdirectory` step (`peaceiris/actions-gh-pages`), the workflow fails with a `403 Forbidden` error because external forks cannot push to the `gh-pages` branch on the upstream repository.

Additionally:
- For `pull_request` events, `github.ref_name` resolves to `<PR_NUMBER>/merge` rather than a clean branch or PR identifier, causing path mismatches between deployment and cleanup.
- Branches with forward slashes (e.g., `feature/foo`) create nested subdirectories under `preview/`.

## Intended Effect
1. **Universal Test Execution:** All pull requests (both internal branches and external forks) will continue to run the full test and validation suite (`npm test`), ensuring CI quality gates pass or fail based on code quality.
2. **Safe Deployment Skipping:** The GitHub Pages deployment step will conditionally execute only when the workflow is triggered from within the upstream repository (pushes to origin branches or internal PRs). For external forks, the deploy step is skipped cleanly, allowing the PR check to succeed with a green checkmark.
3. **Standardized Preview Paths:** PR previews are deployed to `preview/pr-<number>` and branch pushes to `preview/<branch-name>`, ensuring deployment and cleanup paths match consistently.
4. **Targeted Cleanup:** The `cleanup` job will only trigger on closed PRs that originated from the main repository.

## STEP 1: Update `.github/workflows/preview.yml`
- [ ] **1.1** Add repository ownership condition (`github.event_name == 'push' || (github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository)`) to the `Deploy to GitHub Pages Subdirectory` step.
- [ ] **1.2** Standardize `destination_dir` to use `preview/pr-${{ github.event.pull_request.number }}` for PRs and `preview/${{ github.ref_name }}` for branch pushes.
- [ ] **1.3** Update the `cleanup` job condition so it only runs for internal PRs (`github.event.pull_request.head.repo.full_name == github.repository`).
- [ ] **1.4** Standardize the cleanup folder removal command to target `preview/pr-${{ github.event.pull_request.number }}`.

## STEP 2: Verification
- [ ] **2.1** Review the updated `preview.yml` YAML syntax and structure.
- [ ] **2.2** Mark this design document as `-COMPLETED`.
