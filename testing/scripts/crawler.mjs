import fs from 'fs/promises';
import path from 'path';
import * as cheerio from 'cheerio';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const ONTOLOGY_DIR = path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology');
const START_PAGE = 'index.html';
const STYLESHEET_NAME = 'keystone-style.css';

const stats = {
  html: { good: 0, broken: 0 },
  json: { good: 0, broken: 0 },
  jsonld: { good: 0, broken: 0 },
  external: { good: 0, broken: 0 },
};

let firstBrokenLinkDetails = null;
const pagesToCrawl = new Set([path.join(DIST_DIR, START_PAGE)]);
const crawledPages = new Set();
const pagesWithCssIssues = [];
const pagesWithImageIssues = [];
const pagesWithObjectObjectIssues = [];
const brokenExternalLinks = [];
const externalLinksToCheck = new Set();

/**
 * Recursively finds all files with a given extension in a directory.
 * @param {string} dir - The directory to start in.
 * @param {string} ext - The file extension (e.g., '.jsonld').
 * @returns {Promise<string[]>} A list of file paths.
 */
async function findFilesByExtension(dir, ext) {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name);
        if (dirent.isDirectory()) {
            return findFilesByExtension(res, ext);
        }
        return res.endsWith(ext) ? res : null;
    }));
    return Array.prototype.concat(...files).filter(Boolean);
}

/**
 * Recursively traverses a JSON object to find all `dcterms:source` URLs.
 * @param {any} obj - The object or value to traverse.
 * @param {Set<string>} urls - The Set to store found URLs in.
 */
function findSourceUrls(obj, urls) {
    if (!obj || typeof obj !== 'object') {
        return;
    }

    if (obj['dcterms:source']) {
        const source = obj['dcterms:source'];
        let url;
        if (typeof source === 'string' && source.startsWith('http')) {
            url = source;
        } else if (typeof source === 'object' && source['@id'] && source['@id'].startsWith('http')) {
            url = source['@id'];
        }
        if (url) {
            urls.add(url);
        }
    }

    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            findSourceUrls(obj[key], urls);
        }
    }
}

/**
 * Checks an external URL with a HEAD request.
 * @param {string} url - The URL to check.
 */
async function checkExternalLink(url) {
    try {
        // Use a timeout and a specific user-agent
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8-second timeout

        const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            headers: { 'User-Agent': 'DPP-Keystone-Crawler/1.0' }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            brokenExternalLinks.push({ url, status: response.status });
            stats.external.broken++;
        } else {
            stats.external.good++;
        }
    } catch (error) {
        brokenExternalLinks.push({ url, status: 'Error', reason: error.name === 'AbortError' ? 'Timeout' : error.message });
        stats.external.broken++;
    }
}


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

  // Helper to strip query strings/hashes
  const cleanUrl = (url) => url ? url.split('?')[0].split('#')[0] : url;

  // --- CSS Link Check ---
  const stylesheetLink = $(`link[rel="stylesheet"][href*="${STYLESHEET_NAME}"]`);
  if (stylesheetLink.length === 0) {
      pagesWithCssIssues.push(`${path.relative(DIST_DIR, pagePath)} (Stylesheet tag not found)`);
  } else {
      const cssHref = cleanUrl(stylesheetLink.attr('href'));
      const absoluteCssPath = path.resolve(path.dirname(pagePath), cssHref);
      try {
          await fs.access(absoluteCssPath, fs.constants.F_OK);
      } catch {
        pagesWithCssIssues.push(`${path.relative(DIST_DIR, pagePath)} (Stylesheet link is broken)`);
      }
  }

  // --- Image Link Check ---
  const imagePromises = [];
  $('img[src]').each((i, el) => {
    const imgSrc = cleanUrl($(el).attr('src'));
    if (!imgSrc || imgSrc.startsWith('http')) {
        return; // Skip external images
    }
    const absoluteImgPath = path.resolve(path.dirname(pagePath), imgSrc);
    const imageCheck = fs.access(absoluteImgPath, fs.constants.F_OK)
        .catch(() => {
            pagesWithImageIssues.push(`${path.relative(DIST_DIR, pagePath)} (Image src is broken: ${imgSrc})`);
        });
    imagePromises.push(imageCheck);
  });
  await Promise.all(imagePromises);


  // --- Broken Link Check ---
  const linkPromises = [];
  $('a[href]').each((i, el) => {
    let href = $(el).attr('href');
    if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('#')) {
      return; // Skip external links, mailto links, and anchors
    }
    
    const linkText = $(el).text().trim();
    if (linkText.includes('[object Object]')) {
        pagesWithObjectObjectIssues.push({
            sourcePage: path.relative(DIST_DIR, pagePath),
            linkText,
            href,
        });
    }

    href = cleanUrl(href);

    linkPromises.push(checkLink({
        href,
        sourcePage: pagePath,
        linkText: linkText,
        absolutePath: path.resolve(path.dirname(pagePath), href),
    }));
  });

  await Promise.all(linkPromises);
}

async function main() {
  console.log('Starting crawler...');

  // --- New: Ontology Link Checking ---
  console.log('\nScanning ontologies for dcterms:source links...');
  const ontologyFiles = await findFilesByExtension(ONTOLOGY_DIR, '.jsonld');
  
  for (const file of ontologyFiles) {
      const content = await fs.readFile(file, 'utf-8');
      try {
          const json = JSON.parse(content);
          findSourceUrls(json, externalLinksToCheck);
      } catch (e) {
          console.error(`\nError parsing JSON in file: ${file}\n`, e);
      }
  }

  console.log(`Found ${externalLinksToCheck.size} unique external source links to check.`);
  if (externalLinksToCheck.size > 0) {
      const externalCheckPromises = [];
      for (const url of externalLinksToCheck) {
          externalCheckPromises.push(checkExternalLink(url));
      }
      await Promise.all(externalCheckPromises);
  }
  // --- End New ---

  // --- Existing HTML Crawling ---
  try {
    await fs.access(DIST_DIR, fs.constants.F_OK);

    while (pagesToCrawl.size > 0) {
        const nextPage = pagesToCrawl.values().next().value;
        await crawlPage(nextPage);
    }
  } catch (error) {
    console.log('\nSkipping internal link check because `dist` directory does not exist.');
  }

  console.log('\n--- Crawler Report ---');
  console.log(`HTML: ${stats.html.good} good, ${stats.html.broken} broken.`);
  console.log(`JSON: ${stats.json.good} good, ${stats.json.broken} broken.`);
  console.log(`JSON-LD: ${stats.jsonld.good} good, ${stats.jsonld.broken} broken.`);
  console.log(`External Source Links: ${stats.external.good} good, ${stats.external.broken} broken.`);

  if (brokenExternalLinks.length > 0) {
    console.log('\n--- Broken External dcterms:source Links ---');
    brokenExternalLinks.forEach(link => {
        console.log(`  -> URL: ${link.url} (Status: ${link.status}${link.reason ? `, Reason: ${link.reason}` : ''})`);
    });
  } else if (stats.external.broken === 0 && stats.external.good > 0) {
      console.log('\nAll external dcterms:source links are valid. ✨');
  }

  if (firstBrokenLinkDetails) {
    console.log('\n--- First Broken Link Details ---');
    console.log(`Source Page:  ${firstBrokenLinkDetails.sourcePage}`);
    console.log(`Link Text:    "${firstBrokenLinkDetails.linkText}"`);
    console.log(`Link Href:    "${firstBrokenLinkDetails.href}"`);
    console.log(`Resolved Path:  "${firstBrokenLinkDetails.resolvedPath}" (Not Found)`);
  } else if (stats.html.broken > 0 || stats.json.broken > 0 || stats.jsonld.broken > 0) {
    console.log('\nBroken internal links were found, but details could not be recorded.');
  } else {
    console.log('\nNo broken internal links found. ✨');
  }

  if (pagesWithCssIssues.length > 0) {
    console.log('\n--- Pages Missing CSS ---');
    pagesWithCssIssues.forEach(page => console.log(`  -> ${page}`));
  }

  if (pagesWithImageIssues.length > 0) {
    console.log('\n--- Pages Missing Images ---');
    pagesWithImageIssues.forEach(page => console.log(`  -> ${page}`));
  }

  if (pagesWithObjectObjectIssues.length > 0) {
    console.log('\n--- Pages with "[object Object]" Links ---');
    pagesWithObjectObjectIssues.forEach(issue => {
      console.log(`  -> Page: ${issue.sourcePage}`);
      console.log(`     Link Text: "${issue.linkText}"`);
      console.log(`     Link Href: "${issue.href}"`);
    });
  }

  const totalBroken = stats.html.broken + stats.json.broken + stats.jsonld.broken + stats.external.broken;
  if (totalBroken > 0) {
      console.error(`\nCrawler finished with ${totalBroken} broken link(s).`);
      // The test will fail based on the output, no need to exit(1) here
  } else {
      console.log('\nCrawler finished successfully.');
  }
}

main().catch(console.error);
