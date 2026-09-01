# Fix GitHub Actions Preview Workflow for Fork PRs and Prevent Orphaned Previews

## Motivation & Context
1. **Fork PR Permissions:** Pull requests originating from external forks execute GitHub Actions workflows with a read-only `GITHUB_TOKEN`. When `.github/workflows/preview.yml` runs the `Deploy to GitHub Pages Subdirectory` step (`peaceiris/actions-gh-pages`), the workflow fails with a `403 Forbidden` error because external forks cannot push to the `gh-pages` branch on the upstream repository.
2. **Orphaned PR Previews:** On `pull_request` events, `github.ref_name` evaluates to `<PR_NUMBER>/merge` (e.g. `28/merge`), causing previews to be deployed to `preview/28/merge/`. However, the cleanup job was deleting `preview/${{ github.head_ref }}` (the branch name), leaving `preview/<PR_NUMBER>/merge/` folders orphaned on `gh-pages` indefinitely.

## Intended Effect
1. **Unified Branch Previews:** By using `${{ github.head_ref || github.ref_name }}`, both direct branch pushes and pull request events deploy to the exact same `preview/<branch-name>/` directory. No `preview/<PR_NUMBER>/merge/` folders will ever be created.
2. **Clean Automatic Deletion:** When a PR closes or merges, `rm -rf preview/${{ github.head_ref }}` cleanly removes that single branch preview folder.
3. **Fork Protection:** External fork PRs run the full test and validation suite (`npm test`) on Ubuntu runners, but cleanly skip the `Deploy to GitHub Pages Subdirectory` and `cleanup` steps that require write access. This allows external contributors to receive a passing green checkmark on their PRs without 403 errors.

## STEP 1: Update `.github/workflows/preview.yml`
- [x] **1.1** Add repository ownership condition (`github.event_name == 'push' || (github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository)`) to the `Deploy to GitHub Pages Subdirectory` step.
- [x] **1.2** Set `PREVIEW_BRANCH` and `destination_dir` to `${{ github.head_ref || github.ref_name }}` for consistent branch-named preview URLs and zero orphaned merge folders.
- [x] **1.3** Update the `cleanup` job condition so it only runs for internal PRs (`github.event.pull_request.head.repo.full_name == github.repository`).
- [x] **1.4** Clean up the matching `preview/${{ github.head_ref }}` directory when internal PRs close.

## STEP 2: Verification
- [x] **2.1** Review the updated `preview.yml` YAML syntax and structure.
- [x] **2.2** Mark this design document as `-COMPLETED`.
