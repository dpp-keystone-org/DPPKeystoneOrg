# 030 - GitHub Preview Deployments for Branches

## Objective
Implement a deployment pipeline that automatically hosts development/feature branches on a sub-path of the main `dpp-keystone.org` domain (e.g., `www.dpp-keystone.org/steel-ontology/`). This enables reviewers to play with new features and validators in a live environment before merging into the `main` branch.

## Architecture

We will leverage the existing `peaceiris/actions-gh-pages` GitHub Action, which natively supports deploying to sub-directories on the `gh-pages` branch without overwriting the production root.

### 1. New GitHub Workflow (`.github/workflows/preview.yml`)
Create a new workflow that triggers on pull requests or specific development branches.

```yaml
name: Deploy Branch Preview
on:
  pull_request:
    types: [opened, synchronize, reopened]
  # Optionally allow manual triggers
  workflow_dispatch:

jobs:
  build-and-deploy-preview:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write # Needed if we want a bot to comment the link on the PR

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: |
          npm install
          cd testing && npm install && npx playwright install --with-deps

      - name: Build Site (with Branch Base Path)
        # We pass the PR number or branch name as an environment variable
        # so Vite/Node scripts can construct the correct relative URLs
        run: npm run build
        env:
          PREVIEW_BRANCH: pr-${{ github.event.number }}

      - name: Deploy to GitHub Pages Subdirectory
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
          # CRITICAL: Deploys to a folder rather than root
          destination_dir: preview/${{ github.ref_name }}
          # CRITICAL: Ensures we don't wipe out the main site
          keep_files: true 
```

### 2. Node Script Adaptations (`scripts/update-index-html.mjs`)
The Node scripts that dynamically generate absolute `href` paths must be updated to prefix the branch path if the `PREVIEW_BRANCH` environment variable is detected.

```javascript
// Example modification in script:
const branchPrefix = process.env.PREVIEW_BRANCH ? `/${process.env.PREVIEW_BRANCH}` : '';
const baseHref = `${branchPrefix}/spec/validation/v1/`;

// ...
const link = `<a href="${baseHref}${fileName}">${linkText}</a>`;
```

### 3. Vite Config Adaptations
Since Vite expects to be served from `/`, building for a subdirectory requires modifying the `base` property dynamically. In `vite.config.js` (or via CLI):

```javascript
import { defineConfig } from 'vite'

export default defineConfig({
  // If PREVIEW_BRANCH is set, use it. Otherwise, use root '/'
  base: process.env.PREVIEW_BRANCH ? `/${process.env.PREVIEW_BRANCH}/` : '/',
  // ... rest of config
})
```

## Cleanup Strategy
To prevent the `gh-pages` branch from bloating indefinitely, a companion action should be created to delete the subdirectory once the Pull Request is merged or closed.

```yaml
name: Cleanup Branch Preview
on:
  pull_request:
    types: [closed]

jobs:
  cleanup:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Checkout gh-pages branch
        uses: actions/checkout@v4
        with:
          ref: gh-pages
          
      - name: Delete Preview Folder
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          rm -rf preview/${{ github.head_ref }}
          git add .
          git commit -m "Cleanup PR preview preview/${{ github.head_ref }}" || echo "Nothing to clean"
          git push
```
