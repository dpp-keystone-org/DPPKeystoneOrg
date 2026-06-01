import { promises as fs } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Dist Placeholder Check', () => {
    const distDir = join(__dirname, '../../dist');
    const VALID_EXTENSIONS = ['.html', '.json', '.js', '.css', '.jsonld'];

    async function getAllFiles(dir) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const files = await Promise.all(entries.map((entry) => {
            const res = join(dir, entry.name);
            return entry.isDirectory() ? getAllFiles(res) : res;
        }));
        return files.flat();
    }

    it('should not contain {{version}} or {{VERSION}} in any dist file', async () => {
        const files = await getAllFiles(distDir);
        const filesWithPlaceholders = [];

        for (const file of files) {
            const ext = extname(file);
            if (!VALID_EXTENSIONS.includes(ext)) continue;

            const content = await fs.readFile(file, 'utf-8');
            if (content.includes('{{version}}') || content.includes('{{VERSION}}')) {
                filesWithPlaceholders.push(file);
            }
        }

        expect(filesWithPlaceholders).toEqual([]);
    });
});
