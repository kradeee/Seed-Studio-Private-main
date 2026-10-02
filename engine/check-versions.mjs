/* Compare the Minecraft versions the engine supports with the ones the site offers
 * (VERSIONS in components/studio/data.ts). Prints what to add when Cubiomes gains a
 * version, and writes the same text to $GITHUB_STEP_SUMMARY when run in GitHub Actions.
 *   node engine/check-versions.mjs [path/to/cubiomes]   */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const { engine } = await require(path.join(root, 'tests', 'load-engine.cjs'))();

const newest = engine.WASMmcNewest();
const data = fs.readFileSync(path.join(root, 'components', 'studio', 'data.ts'), 'utf8');
const siteIds = [...data.matchAll(/\{id:(\d+),name:'([^']+)'\}/g)].map((m) => Number(m[1]));
const siteMax = Math.max(...siteIds);

// Names from Cubiomes' MCVersion enum (biomes.h), when the source is at hand.
let names = {};
const header = path.join(process.argv[2] || path.join(root, 'engine', 'cubiomes'), 'biomes.h');
if (fs.existsSync(header)) {
    const body = fs.readFileSync(header, 'utf8').split('enum MCVersion')[1]?.split('}')[0] || '';
    let i = 0;
    for (const line of body.split('\n')) {
        for (const part of line.split(',')) {
            const m = part.trim().match(/^MC_([A-Z0-9_]+)$/); // skip aliases "MC_X = MC_Y"
            if (m) { names[i] = m[1].replace(/^B/, 'Beta ').replace(/_/g, '.'); i++; }
        }
    }
}

let out;
if (newest > siteMax) {
    const add = [];
    for (let id = siteMax + 1; id <= newest; id++) add.push(`{id:${id},name:'${names[id] ?? '?'}'}`);
    out = `**New Minecraft version(s) in the engine.** Add to VERSIONS in components/studio/data.ts (newest first):\n\n    ${add.reverse().join(',')}\n\nThen check the new version in game (VERIFICA.md) and add a GROUND_TRUTH block to tests/engine.test.mjs.`;
} else {
    out = `The site already offers every version the engine supports (newest: id ${newest}${names[newest] ? ' = ' + names[newest] : ''}).`;
}
console.log(out);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, out + '\n');
