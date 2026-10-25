import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'));
export const expectedClassSlugs = ['gladiator', 'templar', 'assassin', 'ranger', 'sorcerer', 'spiritmaster', 'cleric', 'chanter'];

export function validateCatalog(catalog) {
  assert.equal(catalog.version, 1);
  assert.deepEqual(catalog.classes.map(entry => entry.slug).sort(), [...expectedClassSlugs].sort(), 'catalog must contain exactly the eight expected Global classes');
}

export function validateDataset(data, slug) {
  assert.equal(data.classSlug, slug, 'class slug mismatch');
  assert.ok(data.classLabel && data.version, 'class label/version missing');
  assert.equal(data.provenance.verification, 'source-crosschecked');
  assert.equal(data.provenance.version, data.version);
  assert.ok(Number.isFinite(Date.parse(data.provenance.retrievedAt)), 'retrieval date missing');
  assert.ok(data.boards.length > 0, 'empty class');
  const expectedOwner = slug === 'spiritmaster' ? 'Elementalist' : data.classLabel;
  const ids = new Set(), boardIds = new Set(), owners = new Set();
  for (const board of data.boards) {
    assert.ok(!boardIds.has(board.id), 'duplicate board ID');
    boardIds.add(board.id);
    owners.add(board.classId);
    assert.ok(board.classId, 'missing class ownership');
    assert.equal(board.classId, expectedOwner, 'wrong class board ownership');
    assert.ok(board.pointType in data.caps, 'unknown board currency');
    assert.ok(Number.isInteger(data.caps[board.pointType]) && data.caps[board.pointType] >= 0);
    const coords = new Set();
    let total = 0, starts = 0;
    for (const node of board.nodes) {
      assert.equal(node.length, 7, 'node tuple schema');
      const [id, row, col, grade, type, cost, effects] = node;
      assert.ok(Number.isInteger(id) && !ids.has(id), 'duplicate/invalid node ID');
      ids.add(id);
      assert.ok(Number.isInteger(row) && row >= 0 && Number.isInteger(col) && col >= 0, 'coordinates');
      const key = `${row},${col}`;
      assert.ok(!coords.has(key), 'duplicate coordinate'); coords.add(key);
      assert.ok(Number.isInteger(grade) && grade >= 0, 'grade');
      assert.ok([0, 1, 2].includes(type), 'unknown node type');
      assert.ok(Number.isInteger(cost) && cost >= 0, 'cost');
      total += cost;
      if (type === 0) { starts++; assert.equal(cost, 0, 'start cost'); }
      assert.ok(Array.isArray(effects), 'effects');
      for (const effect of effects) {
        assert.equal(effect.length, 2);
        assert.ok(Number.isFinite(effect[1]), 'effect value');
        const id = String(effect[0]);
        if (type === 2) {
          const skill = data.skills[id], evidence = data.skillEvidence[id];
          assert.ok(skill && evidence, `unresolved skill ${id}`);
          assert.equal(evidence.classSlug, slug, 'wrong class skill');
          assert.equal(evidence.name, skill.name, 'wrong skill name');
          assert.equal(evidence.skillUrl, `https://aion2data.com/skills/${skill.slug}`);
          assert.equal(evidence.catalogUrl, `https://aion2data.com/classes/${slug}`);
        } else if (type === 1) assert.ok(data.stats[id], `unresolved stat ${id}`);
      }
    }
    assert.equal(starts, 1, 'one start per board');
    assert.equal(total, board.totalCost, 'board cost total');
  }
  assert.equal(owners.size, 1, 'mixed class board ownership');
  for (const [id, skill] of Object.entries(data.skills)) {
    assert.ok(data.skillEvidence[id], `unverified skill catalog entry ${id}`);
    assert.equal(data.skillEvidence[id].classSlug, slug);
    assert.equal(data.skillEvidence[id].name, skill.name);
    assert.ok(skill.name && skill.slug.startsWith(`${id}-`), 'skill ID/slug mismatch');
  }
  return true;
}

export async function validateAll() {
  const catalog = await read('data/classes.json');
  validateCatalog(catalog);
  const slugs = new Set(), signatures = new Set();
  let total = 0;
  for (const entry of catalog.classes) {
    assert.ok(!slugs.has(entry.slug)); slugs.add(entry.slug);
    assert.equal(entry.status, 'verified');
    assert.equal(entry.path, `data/${entry.slug}.json`);
    const data = await read(entry.path);
    validateDataset(data, entry.slug);
    const nodes = data.boards.flatMap(b => b.nodes);
    assert.equal(entry.nodeCount, nodes.length);
    assert.equal(entry.skillNodeCount, nodes.filter(n => n[4] === 2).length);
    assert.equal(entry.version, data.version);
    assert.equal(entry.label, data.classLabel);
    const signature = JSON.stringify(data.boards);
    assert.ok(!signatures.has(signature), 'duplicate wrong-class fallback dataset'); signatures.add(signature);
    const mutated = structuredClone(data);
    const skillId = Object.keys(mutated.skillEvidence)[0];
    assert.ok(skillId, 'missing crosscheck evidence');
    mutated.skillEvidence[skillId].classSlug = 'wrong-class';
    assert.throws(() => validateDataset(mutated, entry.slug), 'must reject wrong-class evidence');
    for (const corrupt of [
      d => { d.boards[0].nodes[1][0] = d.boards[0].nodes[0][0]; },
      d => { d.boards[0].nodes[1][1] = d.boards[0].nodes[0][1]; d.boards[0].nodes[1][2] = d.boards[0].nodes[0][2]; },
      d => { d.boards[0].totalCost++; },
      d => { d.boards[0].pointType = 'unknown'; },
      d => { d.boards[0].classId = 'WrongClass'; },
      d => { delete d.skillEvidence[skillId]; }
    ]) {
      const broken = structuredClone(data); corrupt(broken);
      assert.throws(() => validateDataset(broken, entry.slug), 'must reject malformed dataset');
    }
    total += nodes.length;
  }
  console.log(`PASS ${slugs.size} classes, ${total} nodes; schema, IDs, coordinates, costs, currency, class skill evidence and wrong-class regression checks.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await validateAll();
