import fs from 'fs/promises';
import path from 'path';
import * as cheerio from 'cheerio';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const START_PAGE = 'index.html';

const stats = {
  html: { good: 0, broken: 0 },
  json: { good: 0, broken: 0 },
  jsonld: { good: 0, broken: 0 },
};

const brokenLinks = new Map();
const pagesToCrawl = new Set([path.join(DIST_DIR, START_PAGE)]);
const crawledPages = new Set();

async function checkLink(link, sourcePage) {
  const extension = path.extname(link).substring(1);
  if (!['html', 'json', 'jsonld'].includes(extension)) {
    return;
  }

  try {
    await fs.access(link, fs.constants.F_OK);
    stats[extension].good++;
    // If it's an HTML file and we haven't crawled it yet, add to the queue
    if (extension === 'html' && !crawledPages.has(link) && !pagesToCrawl.has(link)) {
        // Ensure we are only crawling pages within the dist directory
        if(link.startsWith(DIST_DIR)) {
            pagesToCrawl.add(link);
        }
    }
  } catch (error) {
    stats[extension].broken++;
    if (!brokenLinks.has(sourcePage)) {
      brokenLinks.set(sourcePage, []);
    }
    brokenLinks.get(sourcePage).push(path.relative(DIST_DIR, link));
  }
}

async function crawlPage(pagePath) {
  crawledPages.add(pagePath);
  pagesToCrawl.delete(pagePath);
  const pageContent = await fs.readFile(pagePath, 'utf-8');
  const $ = cheerio.load(pageContent);

  const linkPromises = [];

  $('a[href]').each((i, el) => {
    const href = $(el).attr('href');
    if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('#')) {
      return; // Skip external links, mailto links, and anchors
    }

    const absolutePath = path.resolve(path.dirname(pagePath), href);
    linkPromises.push(checkLink(absolutePath, path.relative(DIST_DIR, pagePath)));
  });

  await Promise.all(linkPromises);
}

async function main() {
  console.log('Starting crawler...');

  // The build needs to have been run at least once
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

  if (brokenLinks.size > 0) {
    console.log('\n--- Broken Links ---');
    for (const [page, links] of brokenLinks.entries()) {
      console.log(`On page: ${page}`);
      links.forEach(link => console.log(`  -> ${link}`));
    }
  } else {
    console.log('\nNo broken links found. ✨');
  }

  console.log('\nCrawler finished.');
}

main().catch(console.error);
