import { copyFile, mkdir, readFile, lstat, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist');
if (dirname(output) !== resolve(root)) throw new Error('Invalid build directory');
const catalog = JSON.parse(await readFile(resolve(root, 'data/classes.json'), 'utf8'));
for (const entry of catalog.classes) {
  if (!/^[a-z]+$/.test(entry.slug) || entry.path !== `data/${entry.slug}.json`) {
    throw new Error('Invalid class file path');
  }
}
try {
  const info = await lstat(output);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Unsafe build output');
  await rm(output, { recursive: true });
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await mkdir(resolve(output, 'data'), { recursive: true });
const files = ['index.html', 'app.js', 'app-data.js', 'app.css', 'favicon.svg',
  'robots.txt', 'sitemap.xml', 'LICENSE', 'DATA_NOTICE.md', 'data/classes.json',
  ...catalog.classes.map(entry => entry.path)];
for (const file of files) await copyFile(resolve(root, file), resolve(output, file));
console.log(`Built ${files.length} public files; ${catalog.classes.length} classes.`);
