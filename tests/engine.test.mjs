/* Seed Studio engine tests: `npm run test:engine`.
 *
 * 1. Ground truth from the real game (VERIFICA.md): positions checked in Minecraft Java 26.3
 *    vanilla on 2026-09-29. If an engine update moves any of them, the update is wrong.
 * 2. Consistency: the JS structure placement (structures.js) must reproduce the engine's own
 *    get_structure_in_regions on several seeds and versions.
 * When a new Minecraft version ships: add its id to NEWEST below and, once checked in game,
 * a GROUND_TRUTH block for it. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ctx = await require('./load-engine.cjs')();
const { engine: e, SeedStudioStructures: S } = ctx;

const MC_26_3 = 35;
const NEWEST = MC_26_3; // bump when the engine adds a version

// type ids: cubiomes StructureType (5 village, 11 ruined portal, 13 ancient city, 18 fortress,
// 19 bastion, 25 trial chambers). All verified with /locate in game.
const GROUND_TRUTH = [{
    version: MC_26_3, seed: '12345', label: 'Java 26.3, seed 12345',
    spawn: { x: 93, z: -24 },
    structures: [
        { type: 5, dim: 0, x: -144, z: -832, what: 'village' },
        { type: 13, dim: 0, x: 176, z: -176, what: 'ancient city' },
        { type: 25, dim: 0, x: 0, z: 224, what: 'trial chambers' },
        { type: 25, dim: 0, x: 128, z: -528, what: 'trial chambers' },
        { type: 11, dim: 0, x: 16, z: 0, what: 'ruined portal' },
        { type: 11, dim: 0, x: 0, z: -288, what: 'ruined portal' },
        { type: 11, dim: 0, x: 976, z: 784, what: 'ruined portal' },
        { type: 18, dim: -1, x: 96, z: -512, what: 'nether fortress' },
        { type: 18, dim: -1, x: -208, z: -592, what: 'nether fortress' },
        { type: 19, dim: -1, x: 176, z: -256, what: 'bastion' },
    ],
    stronghold: { x: 1760, z: 368, eyes: 1 },
}];

// /locate reports a chunk position; the engine the structure's own block: allow one chunk.
const near = (a, b, tol = 16) => Math.abs(a.x - b.x) <= tol && Math.abs(a.z - b.z) <= tol;

for (const g of GROUND_TRUTH) {
    test(`${g.label}: spawn`, () => {
        const s = e.seedSummary({ mcVersion: g.version, seed: g.seed });
        // The game spreads the spawn a little at random: within 16 blocks is a match.
        assert.ok(near({ x: s.spawnX, z: s.spawnZ }, g.spawn), `engine spawn ${s.spawnX}, ${s.spawnZ}`);
    });
    for (const st of g.structures) {
        test(`${g.label}: ${st.what} at ${st.x}, ${st.z}`, () => {
            const found = S.structuresInRect(e, {
                mcVersion: g.version, seed: g.seed, dimension: st.dim,
                x0: st.x - 32, z0: st.z - 32, x1: st.x + 33, z1: st.z + 33, types: [st.type],
            });
            assert.ok(found.some((f) => near(f, st)), `not on the map; nearby: ${JSON.stringify(found)}`);
        });
    }
    test(`${g.label}: first stronghold and its eyes`, () => {
        const list = e.strongholdsList({ mcVersion: g.version, seed: g.seed, howMany: 3 }).strongholds;
        const sh = list.find((s) => near(s, g.stronghold));
        assert.ok(sh, `not among ${JSON.stringify(list)}`);
        assert.equal(e.strongholdAnalyse({ mcVersion: g.version, seed: g.seed, x: sh.x, z: sh.z }).eyes, g.stronghold.eyes);
    });
}

test('JS placement matches the engine (seeds × versions × types)', () => {
    let checked = 0;
    for (const seed of ['8678942899319966093', '-4172144997902289642', '12345'])
        for (const mc of [...new Set([22, 26, 32, NEWEST, e.WASMmcNewest()])]) // the engine's newest too: a future version with new placement rules fails here
            for (const t of Object.keys(S.CONFIGS).map(Number)) {
                const c = S.CONFIGS[t];
                for (const dim of t === 11 ? [0, -1] : [c.dim]) {
                    if (e.WASMstructureInfo(mc, t) === -100) continue;
                    const R = 4, rb = c.region * 16;
                    const engine = new Set(e.getStructuresInRegions(mc, t, seed, R, dim).map((a) => a[0] + ',' + a[1]));
                    const raw = new Set();
                    const s = BigInt.asUintN(64, BigInt(seed));
                    for (let rz = -R; rz < R; rz++) for (let rx = -R; rx < R; rx++) { const a = S.attempt(t, s, rx, rz); if (a) raw.add(a.x + ',' + a.z); }
                    for (const p of engine) assert.ok(raw.has(p), `type ${t} dim ${dim} v${mc} seed ${seed}: engine has ${p}, JS placement does not`);
                    const mine = S.structuresInRect(e, { mcVersion: mc, seed, dimension: dim, x0: -R * rb, z0: -R * rb, x1: R * rb, z1: R * rb, types: [t] });
                    for (const m of mine) assert.ok(engine.has(m.x + ',' + m.z), `type ${t} dim ${dim} v${mc} seed ${seed}: map shows ${m.x},${m.z}, engine does not`);
                    checked++;
                }
            }
    assert.ok(checked > 100);
});

test('the engine knows the newest version the site offers', () => {
    assert.ok(e.WASMmcNewest() >= NEWEST, `engine newest ${e.WASMmcNewest()} < ${NEWEST}`);
});
