(function (global) {
  'use strict';
  const record = value => value && typeof value === 'object' && !Array.isArray(value);
  const fail = text => { throw new Error(text); };
  const sourceUrl = value => typeof value === 'string' && /^https:\/\/aion2data\.com\//.test(value);

  function validateCatalog(index) {
    if (!record(index) || index.version !== 1 || !Array.isArray(index.classes) || !index.classes.length) {
      fail('Geçerli sınıf kataloğu bulunamadı.');
    }
    const slugs = new Set();
    for (const item of index.classes) {
      if (!record(item) || !/^[a-z][a-z0-9-]*$/.test(item.slug) || slugs.has(item.slug) ||
          typeof item.label !== 'string' || !item.label || item.status !== 'verified' ||
          item.path !== 'data/' + item.slug + '.json' || !sourceUrl(item.sourceUrl) ||
          typeof item.version !== 'string' || !Number.isInteger(item.nodeCount) || item.nodeCount < 1 ||
          !Number.isInteger(item.skillNodeCount) || item.skillNodeCount < 1) {
        fail('Sınıf kataloğu doğrulanamadı.');
      }
      slugs.add(item.slug);
    }
    if (index.limitations && (!Array.isArray(index.limitations) || index.limitations.some(v => typeof v !== 'string'))) {
      fail('Katalog kaynak notları geçersiz.');
    }
    return index;
  }

  function validateNode(node, data, ids, positions) {
    if (!Array.isArray(node) || node.length < 7 || !node.slice(0, 6).every(Number.isInteger) ||
        node[1] < 1 || node[2] < 1 || node[5] < 0 || ![0, 1, 2].includes(node[4]) ||
        !Array.isArray(node[6]) || ids.has(node[0]) || positions.has(node[1] + ',' + node[2])) {
      fail('Node kimliği, konumu veya maliyeti geçersiz.');
    }
    ids.add(node[0]); positions.add(node[1] + ',' + node[2]);
    if (node[4] === 0 && node[5] !== 0) fail('Başlangıç node maliyeti geçersiz.');
    if (node[4] === 2 && !node[6].length) fail('Skill node referansı eksik.');
    for (const pair of node[6]) {
      if (!Array.isArray(pair) || pair.length !== 2 || !Number.isFinite(pair[1])) fail('Node bonusu geçersiz.');
      const key = pair[0], skill = data.skills[key], stat = data.stats[key];
      if (!skill && !stat || node[4] === 2 && !skill) fail('Çözümlenmemiş skill veya stat referansı: ' + key);
      if (skill && (typeof skill.name !== 'string' || !skill.name.trim() || typeof skill.slug !== 'string')) {
        fail('Skill adı veya kaynağı eksik: ' + key);
      }
      if (stat && (typeof stat.name !== 'string' || !Number.isFinite(stat.div) || stat.div <= 0)) {
        fail('Stat tanımı geçersiz: ' + key);
      }
    }
  }

  function validateDataset(data, entry) {
    if (!record(data) || data.classSlug !== entry.slug || data.classLabel !== entry.label ||
        data.version !== entry.version || !Array.isArray(data.boards) || !data.boards.length ||
        !record(data.skills) || !record(data.stats)) fail('Sınıf kimliği veya veri sürümü uyuşmuyor.');
    let nodeCount = 0, skillNodeCount = 0;
    const boardIds = new Set();
    for (const board of data.boards) {
      if (!record(board) || boardIds.has(board.id) || typeof board.name !== 'string' ||
          typeof board.pointType !== 'string' || !Number.isInteger(board.level) ||
          !Array.isArray(board.nodes) || !board.nodes.length) fail('Board tanımı geçersiz.');
      boardIds.add(board.id);
      const ids = new Set(), positions = new Set();
      for (const node of board.nodes) validateNode(node, data, ids, positions);
      if (board.nodes.filter(node => node[4] === 0).length !== 1) fail('Board tek başlangıç içermeli.');
      nodeCount += board.nodes.length;
      skillNodeCount += board.nodes.filter(node => node[4] === 2).length;
    }
    if (nodeCount !== entry.nodeCount || skillNodeCount !== entry.skillNodeCount) fail('Katalog node sayıları uyuşmuyor.');
    return data;
  }

  async function fetchJson(path) {
    const response = await fetch(path, { cache: 'no-cache' });
    if (!response.ok) fail('Veri isteği başarısız (' + response.status + ').');
    return response.json();
  }

  function readSaved(storage, slug) {
    const key = 'daevanion-atlas-acquired-v1:' + slug;
    try {
      storage = typeof storage === 'function' ? storage() : storage;
      let raw = storage.getItem(key), migrated = false;
      // Only Sorcerer inherits the original single-class planner's acquired nodes.
      if (raw === null && slug === 'sorcerer') {
        raw = storage.getItem('sorcerer-atlas-acquired-v1');
        migrated = raw !== null;
      }
      const saved = JSON.parse(raw || '{}');
      if (!record(saved)) fail('Geçersiz yerel kayıt.');
      let warning = '';
      if (migrated) {
        try { storage.setItem(key, raw); }
        catch (error) { warning = 'Eski işaretlerin okundu; tarayıcı yeni kayıt yazımını engelliyor.'; }
      }
      return { key, saved, warning };
    } catch (error) {
      return { key, saved: {}, warning: 'Yerel kayıt okunamadı; bu oturumda çalışabilirsin.' };
    }
  }

  global.AtlasData = { validateCatalog, validateDataset, fetchJson, readSaved };
})(globalThis);
