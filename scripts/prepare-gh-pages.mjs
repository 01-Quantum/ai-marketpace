import { copyFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = join(process.cwd(), 'dist/ai-marketpace/browser');
const indexPath = join(outDir, 'index.html');

copyFileSync(indexPath, join(outDir, '404.html'));
writeFileSync(join(outDir, '.nojekyll'), '');

console.log('Prepared GitHub Pages output (404.html + .nojekyll).');
