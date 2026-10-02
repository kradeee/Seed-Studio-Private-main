/* Seed Studio: structure placement for any rectangle of the map.
 *
 * Cubiomes places every region-based structure with the same Java LCG maths
 * (getFeaturePos / getLargeStructurePos in cubiomes/finders.h). That part is pure
 * arithmetic, so it is reproduced here in JS for exactly the regions the view
 * touches. Whether an attempt actually generates depends on biomes and terrain,
 * and that check is left to the WebAssembly engine: nearest_structures() with a
 * radius of 0 at the attempt's own block runs the engine's full viability test
 * (biome check + the 1.18+ terrain heuristic) on that single position.
 *
 * Only valid for Java 1.18+ (the versions Seed Studio offers).
 */
(function () {
    const M48 = (1n << 48n) - 1n, K = 0x5deece66dn, B = 0xbn;

    // cubiomes/finders.c getStructureConfig_default, 1.18+ values.
    // kind: 'feature' | 'large' | 'outpost' | 'bastion' | 'endcity'
    const CONFIGS = {
        1: { salt: 14357617, region: 32, range: 24, kind: 'feature', dim: 0 },   // Desert pyramid
        2: { salt: 14357619, region: 32, range: 24, kind: 'feature', dim: 0 },   // Jungle temple
        3: { salt: 14357620, region: 32, range: 24, kind: 'feature', dim: 0 },   // Swamp hut
        4: { salt: 14357618, region: 32, range: 24, kind: 'feature', dim: 0 },   // Igloo
        5: { salt: 10387312, region: 34, range: 26, kind: 'feature', dim: 0 },   // Village
        6: { salt: 14357621, region: 20, range: 12, kind: 'feature', dim: 0 },   // Ocean ruin
        7: { salt: 165745295, region: 24, range: 20, kind: 'feature', dim: 0 },  // Shipwreck
        8: { salt: 10387313, region: 32, range: 27, kind: 'large', dim: 0 },     // Ocean monument
        9: { salt: 10387319, region: 80, range: 60, kind: 'large', dim: 0 },     // Woodland mansion
        10: { salt: 165745296, region: 32, range: 24, kind: 'outpost', dim: 0 }, // Pillager outpost
        11: { salt: 34222645, region: 40, range: 25, kind: 'feature', dim: 0 },  // Ruined portal (both dims, same grid 1.18+)
        13: { salt: 20083232, region: 24, range: 16, kind: 'feature', dim: 0 },  // Ancient city
        18: { salt: 30084232, region: 27, range: 23, kind: 'feature', dim: -1 }, // Nether fortress
        19: { salt: 30084232, region: 27, range: 23, kind: 'bastion', dim: -1 }, // Bastion remnant
        21: { salt: 10387313, region: 20, range: 9, kind: 'endcity', dim: 1 },   // End city
        24: { salt: 83469867, region: 34, range: 26, kind: 'feature', dim: 0 },  // Trail ruins
        25: { salt: 94251327, region: 34, range: 22, kind: 'feature', dim: 0 },  // Trial chambers
        26: { salt: 91231127, region: 37, range: 29, kind: 'feature', dim: 0 },  // Abandoned camp (26.3+)
    };

    const u48 = (v) => BigInt.asUintN(48, v);
    const regionRng = (seed, rx, rz, salt) =>
        u48((u48(seed + BigInt(rx) * 341873128712n + BigInt(rz) * 132897987541n + BigInt(salt))) ^ K);

    // A tiny Java Random over a BigInt state.
    class JRand {
        constructor(scrambled) { this.s = scrambled; }
        static fromSeed(seed) { return new JRand(u48(BigInt.asUintN(64, seed) ^ K)); }
        next(bits) {
            this.s = (this.s * K + B) & M48;
            return Number(BigInt.asIntN(32, this.s >> BigInt(48 - bits)));
        }
        nextInt(n) {
            if ((n & -n) === n) return Number((BigInt(n) * BigInt(this.next(31))) >> 31n);
            let bits, val;
            do { bits = this.next(31); val = bits % n; } while (bits - val + (n - 1) > 0x7fffffff);
            return val;
        }
        nextLong() {
            const hi = BigInt(this.next(32)), lo = BigInt(this.next(32));
            return BigInt.asUintN(64, (hi << 32n) + lo);
        }
    }

    function chunkInRegion(c, seed, rx, rz) {
        const r = new JRand(regionRng(seed, rx, rz, c.salt));
        if (c.kind === 'large' || c.kind === 'endcity') {
            const x = (r.next(31) % c.range + r.next(31) % c.range) >> 1;
            const z = (r.next(31) % c.range + r.next(31) % c.range) >> 1;
            return { x, z };
        }
        const pow2 = (c.range & (c.range - 1)) === 0;
        const draw = () => pow2 ? Number((BigInt(c.range) * BigInt(r.next(31))) >> 31n) : r.next(31) % c.range;
        const x = draw(), z = draw();
        return { x, z };
    }

    function chunkGenerateRnd(seed, cx, cz) {
        const r = JRand.fromSeed(seed);
        const a = r.nextLong(), b = r.nextLong();
        const mixed = BigInt.asUintN(64, (a * BigInt(cx)) ^ (b * BigInt(cz)) ^ BigInt.asUintN(64, seed));
        return JRand.fromSeed(mixed);
    }

    // The attempt of `type` in region (rx, rz), or null when the RNG alone rules it out.
    function attempt(type, seed, rx, rz) {
        const c = CONFIGS[type];
        const p = chunkInRegion(c, seed, rx, rz);
        const x = (rx * c.region + p.x) * 16, z = (rz * c.region + p.z) * 16;
        if (c.kind === 'endcity' && x * x + z * z < 1008 * 1008) return null;
        if (c.kind === 'outpost') {
            let s = BigInt.asUintN(64, seed) ^ BigInt.asUintN(64, BigInt((x >> 4) >> 4)) ^ BigInt.asUintN(64, BigInt((z >> 4) >> 4) << 4n);
            const r = JRand.fromSeed(s);
            r.next(31);
            if (r.nextInt(5) !== 0) return null;
        }
        if (c.kind === 'bastion') {
            const r = chunkGenerateRnd(seed, x >> 4, z >> 4);
            if (r.nextInt(5) < 2) return null;
        }
        return { x, z };
    }

    // Engine-side viability of one attempt (see file header).
    function viable(engine, mc, seed, dim, type, x, z) {
        const r = engine.nearestStructures({ mcVersion: mc, seed, dimension: dim, x, z, types: [type], maxRadiusBlocks: 0 }).results[0];
        return r.found === 1;
    }

    const cache = new Map();
    const CACHE_MAX = 60000;

    // Every generating instance of each type in `types` whose position falls inside the
    // block rectangle [x0, x1) × [z0, z1). Types that do not exist on the version or in
    // the dimension are skipped (support = engine.getVersionSupport).
    function structuresInRect(engine, { mcVersion, seed, dimension, x0, z0, x1, z1, types }) {
        const s = BigInt.asUintN(64, BigInt(seed));
        const out = [];
        for (const type of types) {
            const c = CONFIGS[type];
            if (!c) continue;
            const dimOk = type === 11 ? (dimension === 0 || dimension === -1) : c.dim === dimension;
            if (!dimOk) continue;
            if (engine.WASMstructureInfo(mcVersion & 0xffff, type) === -100) continue;
            const rb = c.region * 16;
            const rx0 = Math.floor(x0 / rb), rx1 = Math.floor((x1 - 1) / rb);
            const rz0 = Math.floor(z0 / rb), rz1 = Math.floor((z1 - 1) / rb);
            if ((rx1 - rx0 + 1) * (rz1 - rz0 + 1) > 900) continue; // too zoomed out for this type
            for (let rz = rz0; rz <= rz1; rz++) for (let rx = rx0; rx <= rx1; rx++) {
                const key = `${mcVersion}|${seed}|${dimension}|${type}|${rx}|${rz}`;
                let hit = cache.get(key);
                if (hit === undefined) {
                    const a = attempt(type, s, rx, rz);
                    hit = a && viable(engine, mcVersion, seed, dimension, type, a.x, a.z) ? a : null;
                    if (cache.size > CACHE_MAX) cache.clear();
                    cache.set(key, hit);
                }
                if (hit && hit.x >= x0 && hit.x < x1 && hit.z >= z0 && hit.z < z1) out.push({ type, x: hit.x, z: hit.z });
            }
        }
        return out;
    }

    const strongholdCache = new Map();
    // The first `howMany` strongholds (generation order: ring 0 first). Each one costs a
    // biome search, so only the rings the view can reach are computed, then cached.
    function strongholds(engine, mcVersion, seed, howMany = 3) {
        const key = mcVersion + '|' + seed;
        const have = strongholdCache.get(key);
        if (have && have.length >= howMany) return have.slice(0, howMany);
        if (strongholdCache.size > 20) strongholdCache.clear();
        const list = engine.strongholdsList({ mcVersion, seed, howMany }).strongholds;
        strongholdCache.set(key, list);
        return list;
    }

    self.SeedStudioStructures = { CONFIGS, attempt, structuresInRect, strongholds };
})();
