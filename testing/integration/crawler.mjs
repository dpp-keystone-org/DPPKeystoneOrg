import fs from 'fs/promises';
import path from 'path';
import * as cheerio from 'cheerio';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const START_PAGE = 'index.html';
const STYLESHEET_NAME = 'keystone-style.css';

const stats = {
  html: { good: 0, broken: 0 },
  json: { good: 0, broken: 0 },
  jsonld: { good: 0, broken: 0 },
};

let firstBrokenLinkDetails = null;
const pagesToCrawl = new Set([path.join(DIST_DIR, START_PAGE)]);
const crawledPages = new Set();
const pagesWithCssIssues = [];

async function checkLink(linkInfo) {
  const { href, sourcePage, linkText, absolutePath } = linkInfo;

  const extension = path.extname(absolutePath).substring(1);
  if (!['html', 'json', 'jsonld'].includes(extension)) {
    return;
  }

  try {
    await fs.access(absolutePath, fs.constants.F_OK);
    stats[extension].good++;
    // If it's an HTML file and we haven't crawled it yet, add to the queue
    if (extension === 'html' && !crawledPages.has(absolutePath) && !pagesToCrawl.has(absolutePath)) {
        if(absolutePath.startsWith(DIST_DIR)) {
            pagesToCrawl.add(absolutePath);
        }
    }
  } catch (error) {
    stats[extension].broken++;
    if (!firstBrokenLinkDetails) {
        firstBrokenLinkDetails = {
            sourcePage: path.relative(DIST_DIR, sourcePage),
            linkText,
            href,
            resolvedPath: path.relative(DIST_DIR, absolutePath),
            error: error.message,
        };
    }
  }
}

async function crawlPage(pagePath) {
  crawledPages.add(pagePath);
  pagesToCrawl.delete(pagePath);

  const pageContent = await fs.readFile(pagePath, 'utf-8');
  const $ = cheerio.load(pageContent);

  // --- CSS Link Check ---
  const stylesheetLink = $(`link[rel="stylesheet"][href*="${STYLESHEET_NAME}"]`);
  if (stylesheetLink.length === 0) {
      pagesWithCssIssues.push(`${path.relative(DIST_DIR, pagePath)} (Stylesheet tag not found)`);
  } else {
      const cssHref = stylesheetLink.attr('href');
      const absoluteCssPath = path.resolve(path.dirname(pagePath), cssHref);
      try {
          await fs.access(absoluteCssPath, fs.constants.F_OK);
      } catch {
        pagesWithCssIssues.push(`${path.relative(DIST_DIR, pagePath)} (Stylesheet link is broken)`);
      }
  }

  // --- Broken Link Check ---
  const linkPromises = [];
  $('a[href]').each((i, el) => {
    const href = $(el).attr('href');
    if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('#')) {
      return; // Skip external links, mailto links, and anchors
    }

    linkPromises.push(checkLink({
        href,
        sourcePage: pagePath,
        linkText: $(el).text().trim(),
        absolutePath: path.resolve(path.dirname(pagePath), href),
    }));
  });

  await Promise.all(linkPromises);
}

async function main() {
  console.log('Starting crawler...');

  try {
    await fs.access(DIST_DIR, fs.constants.F_OK);
  } catch (error) {
    console.error('Error: The `dist` directory does not exist. Please run `npm run build` first.');
    process.exit(1);
  }

  while (pagesToCrawl.size > 0) {
    const nextPage = pagesToCrawl.values().next().value;
    await crawlPage(nextPage);
  }

  console.log('\n--- Crawler Report ---');
  console.log(`HTML: ${stats.html.good} good, ${stats.html.broken} broken.`);
  console.log(`JSON: ${stats.json.good} good, ${stats.json.broken} broken.`);
  console.log(`JSON-LD: ${stats.jsonld.good} good, ${stats.jsonld.broken} broken.`);

  if (firstBrokenLinkDetails) {
    console.log('\n--- First Broken Link Details ---');
    console.log(`Source Page:  ${firstBrokenLinkDetails.sourcePage}`);
    console.log(`Link Text:    "${firstBrokenLinkDetails.linkText}"`);
    console.log(`Link Href:    "${firstBrokenLinkDetails.href}"`);
    console.log(`Resolved Path:  "${firstBrokenLinkDetails.resolvedPath}" (Not Found)`);
  } else if (stats.html.broken > 0 || stats.json.broken > 0 || stats.jsonld.broken > 0) {
    console.log('\nBroken links were found, but details could not be recorded.');
  } else {
    console.log('\nNo broken links found. ✨');
  }

  if (pagesWithCssIssues.length > 0) {
    console.log('\n--- Pages Missing CSS ---');
    pagesWithCssIssues.forEach(page => console.log(`  -> ${page}`));
  } else {
    console.log('\nAll pages have valid CSS links. ✨');
  }

  console.log('\nCrawler finished.');
}

main().catch(console.error);
