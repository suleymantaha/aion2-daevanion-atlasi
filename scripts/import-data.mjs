import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { validateDataset, validateCatalog, expectedClassSlugs } from './validate-data.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const origin = 'https://aion2data.com';
const limitations = [
  'Unofficial source extraction, crosschecked against the same source class skill catalog; not independently verified against the live game client.',
  'Source snapshot version and regional availability may differ from a player server.',
  'No explicit redistribution license for source game data was established. Code licensing does not relicense game data.',
  'Board adjacency is not present in the extracted schema. Orthogonal proximity is an inference, not a verified game rule.',
  'A shortest route is not an independently verified best build.'
];

export function flightText(html) {
  return [...html.matchAll(/self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g)]
    .map(match => JSON.parse(match[1])[1]).filter(value => typeof value === 'string').join('');
}

export function plannerProps(html) {
  const text = flightText(html);
  const start = text.indexOf('{"classSlug":');
  if (start < 0) throw new Error('Missing planner props');
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) return JSON.parse(text.slice(start, i + 1));
  }
  throw new Error('Truncated planner props');
}

function plain(text) {
  return text.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').trim();
}

async function page(path) {
  const response = await fetch(`${origin}${path}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.text();
}

export async function importData({ rootDir = root, fetchPage = page, log = console.log } = {}) {
  const directory = await fetchPage('/daevanion');
  const roster = await fetchPage('/classes');
  const rosterText = plain(roster.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ');
  const slugs = [...new Set([...directory.matchAll(/href="(?:https:\/\/aion2data\.com)?\/daevanion\/([a-z]+)"/g)].map(m => m[1]))];
  validateCatalog({ version: 1, classes: slugs.filter(slug => slug !== 'brawler').map(slug => ({ slug })) });
  const classes = [], rejected = [], pending = new Map();
  for (const slug of slugs) {
    if (slug === 'brawler') {
      if (!/Not on Global\s+Brawler/.test(rosterText) || !/can(?:&#x27;|')t be picked at character creation in global version/.test(rosterText)) {
        throw new Error('Global Brawler status changed or cannot be confirmed; review current roster before updating catalog');
      }
      rejected.push({ slug, reason: 'Source Global class roster explicitly marks Brawler Not on Global and says it cannot be picked at character creation in the Global snapshot.', evidenceUrl: `${origin}/classes` });
      continue;
    }
    try {
      const [html, classHtml] = await Promise.all([fetchPage(`/daevanion/${slug}`), fetchPage(`/classes/${slug}`)]);
      const data = plannerProps(html);
      delete data.starts;
      if (data.classSlug !== slug) throw new Error(`Wrong class fallback: ${data.classSlug}`);
      const label = plain(classHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '');
      if (label !== data.classLabel) throw new Error(`Class catalog identity mismatch: ${label}/${data.classLabel}`);
      const skillEvidence = {};
      for (const [id, skill] of Object.entries(data.skills)) {
        const anchors = [...classHtml.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
        const found = anchors.find(m => m[1].endsWith(`/skills/${skill.slug}`) && plain(m[2]).includes(skill.name));
        if (!found) throw new Error(`Unresolved class skill ${id}: ${skill.name}`);
        skillEvidence[id] = { name: skill.name, classSlug: slug, catalogUrl: `${origin}/classes/${slug}`, skillUrl: `${origin}/skills/${skill.slug}` };
      }
      data.skillEvidence = skillEvidence;
      data.provenance = {
        sourceUrl: `${origin}/daevanion/${slug}`, classCatalogUrl: `${origin}/classes/${slug}`,
        version: data.version, retrievedAt: new Date().toISOString(), verification: 'source-crosschecked',
        sourceHtmlSha256: createHash('sha256').update(html).digest('hex'),
        classCatalogHtmlSha256: createHash('sha256').update(classHtml).digest('hex'), limitations
      };
      validateDataset(data, slug);
      pending.set(`data/${slug}.json`, data);
      const nodes = data.boards.flatMap(board => board.nodes);
      classes.push({ slug, label: data.classLabel, path: `data/${slug}.json`, status: 'verified',
        sourceUrl: data.provenance.sourceUrl, version: data.version,
        nodeCount: nodes.length, skillNodeCount: nodes.filter(n => n[4] === 2).length });
      log(`VERIFIED ${slug}: ${nodes.length} nodes, ${Object.keys(skillEvidence).length} skills`);
    } catch (error) {
      throw new Error(`Import aborted for ${slug}; existing public data preserved: ${error.message}`, { cause: error });
    }
  }
  const catalog = { version: 1, classes, limitations };
  validateCatalog(catalog);
  if (pending.size !== expectedClassSlugs.length) throw new Error('Incomplete staged import');
  pending.set('data/classes.json', catalog);
  pending.set('data/import-report.json', { retrievedAt: new Date().toISOString(), directoryUrl: `${origin}/daevanion`, discovered: slugs, accepted: classes.map(c => c.slug), rejected });
  // No public files are touched until every expected class has been fetched and validated.
  await mkdir(resolve(rootDir, 'data'), { recursive: true });
  for (const [path, value] of pending) await writeFile(resolve(rootDir, path), `${JSON.stringify(value, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await importData();
