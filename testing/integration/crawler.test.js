import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Site Crawler', () => {
  it('should not have any broken links', async () => {
    let stdout = '';
    let stderr = '';
    try {
      const result = await execAsync('node integration/crawler.mjs');
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (e) {
      // If the script exits with a non-zero code, the error `e` will contain stdout and stderr.
      stdout = e.stdout;
      stderr = e.stderr;
    }

    const brokenLinksFound = stdout.includes('--- First Broken Link Details ---') || stdout.includes('--- Pages Missing CSS ---') || !!stderr;

    if (brokenLinksFound) {
      // Log the detailed output only when the test is about to fail.
      console.log(`\n\n--- Crawler Test Failure ---\n\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}\n---------------------------\n`);
    }

    expect(brokenLinksFound).toBe(false, 'Crawler found broken links. See the log above for details.');
  }, 30000); // Increase timeout to 30s to allow crawler to run
});
