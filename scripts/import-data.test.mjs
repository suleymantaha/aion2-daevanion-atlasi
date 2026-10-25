import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importData } from './import-data.mjs';
import { expectedClassSlugs, validateCatalog } from './validate-data.mjs';

const dataDir = fileURLToPath(new URL('../data/', import.meta.url));
const files = await readdir(dataDir);
const original = new Map(await Promise.all(files.map(async name => [name, await readFile(join(dataDir, name), 'utf8')])));
const fixtures = new Map([
  ['/daevanion', [...expectedClassSlugs, 'brawler'].map(slug => `<a href="/daevanion/${slug}">${slug}</a>`).join('')],
  ['/classes', "<p>Not on Global Brawler</p><p>It can't be picked at character creation in global version 2026.10.21.</p>"]
]);
for (const slug of expectedClassSlugs) {
  const data = JSON.parse(original.get(`${slug}.json`));
  fixtures.set(`/daevanion/${slug}`, `<script>self.__next_f.push(${JSON.stringify([1, JSON.stringify(data)])})</script>`);
  fixtures.set(`/classes/${slug}`, `<h1>${data.classLabel}</h1>${Object.values(data.skills).map(skill => `<a href="/skills/${skill.slug}">${skill.name}</a>`).join('')}`);
}

test('one late class source failure preserves the entire existing public snapshot', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'aion-atlas-import-'));
  try {
    await mkdir(join(temporary, 'data'));
    for (const [name, text] of original) await writeFile(join(temporary, 'data', name), text);
    const visited = [];
    await assert.rejects(importData({ rootDir: temporary, log() {}, fetchPage: async path => {
      visited.push(path);
      if (path === '/daevanion/chanter') throw new Error('simulated HTTP 503');
      assert.ok(fixtures.has(path), `unexpected source request: ${path}`);
      return fixtures.get(path);
    } }), /Import aborted for chanter.*simulated HTTP 503/);
    assert.ok(visited.includes('/daevanion/cleric'), 'failure occurs after earlier classes were staged');
    assert.deepEqual(await readdir(join(temporary, 'data')), files, 'no files added or removed');
    for (const [name, text] of original) assert.equal(await readFile(join(temporary, 'data', name), 'utf8'), text, `${name} must be byte-for-byte preserved`);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test('complete source fixture imports exactly eight classes and excludes Brawler', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'aion-atlas-import-'));
  try {
    await importData({ rootDir: temporary, log() {}, fetchPage: async path => {
      assert.ok(fixtures.has(path), `unexpected source request: ${path}`);
      return fixtures.get(path);
    } });
    const catalog = JSON.parse(await readFile(join(temporary, 'data/classes.json'), 'utf8'));
    validateCatalog(catalog);
    assert.equal(catalog.classes.length, 8);
    const report = JSON.parse(await readFile(join(temporary, 'data/import-report.json'), 'utf8'));
    assert.deepEqual(report.rejected.map(entry => entry.slug), ['brawler']);
    assert.ok(!(await readdir(join(temporary, 'data'))).includes('brawler.json'));
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test('catalog validation rejects seven classes, duplicate classes and unsupported extras', () => {
  const catalog = JSON.parse(original.get('classes.json'));
  const missing = structuredClone(catalog); missing.classes.pop();
  const duplicate = structuredClone(catalog); duplicate.classes[7] = duplicate.classes[0];
  const extra = structuredClone(catalog); extra.classes.push({ slug: 'brawler' });
  for (const malformed of [missing, duplicate, extra]) assert.throws(() => validateCatalog(malformed), /exactly the eight expected Global classes/);
});
