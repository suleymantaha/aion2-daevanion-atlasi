# Data provenance and verification

Snapshot retrieved on 2026-10-25 from [Aion2Data Daevanion](https://aion2data.com/daevanion). All accepted planner payloads report version `2026.10.21`. The [source methodology](https://aion2data.com/about) describes unofficial game-file extraction. This project has not extracted or checked the live game client.

## Accepted scope

The selectable catalog covers the eight classes in the source's Global playable roster. Each dataset has six boards, 690 nodes, 88 skill nodes, and 22 distinct named skills. Total: 48 boards, 5,520 nodes, 704 skill nodes, and 176 class-specific skill entries.

| Class | Planner payload | Independent page within same source |
| --- | --- | --- |
| Gladiator | [Daevanion](https://aion2data.com/daevanion/gladiator) | [Class skill catalog](https://aion2data.com/classes/gladiator) |
| Templar | [Daevanion](https://aion2data.com/daevanion/templar) | [Class skill catalog](https://aion2data.com/classes/templar) |
| Assassin | [Daevanion](https://aion2data.com/daevanion/assassin) | [Class skill catalog](https://aion2data.com/classes/assassin) |
| Ranger | [Daevanion](https://aion2data.com/daevanion/ranger) | [Class skill catalog](https://aion2data.com/classes/ranger) |
| Sorcerer | [Daevanion](https://aion2data.com/daevanion/sorcerer) | [Class skill catalog](https://aion2data.com/classes/sorcerer) |
| Spiritmaster | [Daevanion](https://aion2data.com/daevanion/spiritmaster) | [Class skill catalog](https://aion2data.com/classes/spiritmaster) |
| Cleric | [Daevanion](https://aion2data.com/daevanion/cleric) | [Class skill catalog](https://aion2data.com/classes/cleric) |
| Chanter | [Daevanion](https://aion2data.com/daevanion/chanter) | [Class skill catalog](https://aion2data.com/classes/chanter) |

`source-crosschecked` means the planner class slug and label match the class page, and every exported skill ID/name/slug has an exact linked skill entry on that class's catalog page. It does **not** mean independent confirmation by NCSOFT or a second database. `skillEvidence` records the class catalog and specific skill URL for every skill. `provenance` records retrieval time, snapshot version and SHA-256 hashes of the fetched planner/class HTML.

Spiritmaster uses the source internal board `classId: "Elementalist"`; this alias is explicit in the validator. Other accepted board owners equal the class label. No skill names, effects, costs or node coordinates are synthesized.

## Rejected selectable class

The directory also links to Brawler. The [Global class roster](https://aion2data.com/classes) labels Brawler “Not on Global” and says it cannot be picked at character creation in Global version `2026.10.21`. Its file presence does not establish availability on the Global snapshot. It is deliberately excluded from selectable classes and exported class datasets. The importer fetches the roster and checks this explicit exclusion text; if it changes, importing stops for review. The import report records the exclusion. Regional announcements do not establish Global availability.

## Reproduction and offline checks

Run `node scripts/import-data.mjs` from this directory to fetch publicly served HTML and extract only the exposed Next.js planner props. The importer uses no hidden endpoint, credentials, downloaded executable or AI-generated game data. It checks every skill's exact slug and displayed name against the separate class page before accepting the dataset. All eight expected Global classes must validate before any public data file is replaced. A missing class, changed roster, failed request or failed class verification aborts the import and preserves the existing snapshot. Brawler's explicit source-supported exclusion is recorded in `data/import-report.json`; a transient failure never silently reduces the catalog.

Run `node scripts/validate-data.mjs` offline to validate schema, unique class/board/node IDs, unique coordinates per board, nonnegative integer costs, board cost totals, supported currencies, start nodes, stat/skill references and class ownership. The validator also injects malformed IDs, coordinates, costs, currencies, ownership and missing/wrong-class skill evidence to prove these failures are rejected. It compares complete board payloads across classes to detect duplicated fallback datasets.

Run `node --test scripts/import-data.test.mjs` for offline importer regression tests. A temporary fixture simulates a failure on the last class after seven classes have validated and checks that every existing data file, including the catalog, remains byte-for-byte unchanged. Additional fixtures verify successful eight-class import and reject incomplete, duplicate or expanded catalogs. Public snapshot files are not modified by these tests.

Node tuples retain source order: `[id,row,col,grade,type,cost,effects]`; type `0` is the start, `1` a stat node, `2` a skill node. Effects are `[statKeyOrSkillId,rawValue]`. Stats retain the source `div` and `pct` presentation metadata. Source-generated/popular routes in `starts` are removed from exported data because they are not validated recommendations.

## Limits and rights

The data has one underlying unofficial source. Its claimed client version, translation accuracy, regional applicability and runtime behavior are not independently proven. Adjacency edges are absent from the schema: any orthogonal neighbor routing is explicitly inferred. A minimum-cost route is not a verified best build. Seasonal caps present in the source are retained even where no corresponding board is exported.

[Aion2Data creator guidance](https://aion2data.com/creators) supports attributed guide use; it is not an explicit open-data license. The application's code license does not cover NCSOFT game data, source text, icons or trademarks. Keep visible attribution and source links. Recheck source terms before broader redistribution or commercial reuse.
