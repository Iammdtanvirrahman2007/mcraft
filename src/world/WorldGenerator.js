export class SeedRandom {
  constructor(seed) {
    const text = String(seed);
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    this.state = h >>> 0;
  }
  next() {
    let x = this.state += 0x6D2B79F5;
    x = Math.imul(x ^ x >>> 15, x | 1);
    x ^= x + Math.imul(x ^ x >>> 7, x | 61);
    return ((x ^ x >>> 14) >>> 0) / 4294967296;
  }
}

function smooth(t) { return t * t * (3 - 2 * t); }
function hash2(x, z, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function valueNoise(x, z, seed) {
  const x0 = Math.floor(x), z0 = Math.floor(z);
  const tx = smooth(x - x0), tz = smooth(z - z0);
  const a = hash2(x0, z0, seed), b = hash2(x0 + 1, z0, seed);
  const c = hash2(x0, z0 + 1, seed), d = hash2(x0 + 1, z0 + 1, seed);
  return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
}
function fbm(x, z, seed) {
  let value = 0, amplitude = .5, frequency = .035, total = 0;
  for (let i = 0; i < 5; i++) {
    value += valueNoise(x * frequency, z * frequency, seed + i * 1013) * amplitude;
    total += amplitude; amplitude *= .5; frequency *= 2;
  }
  return value / total;
}

export class WorldGenerator {
  constructor(size = 64) { this.size = size; }

  generate(seedInput) {
    const seedText = String(seedInput || '739182');
    const seed = new SeedRandom(seedText);
    let numericSeed = 0;
    for (const char of seedText) numericSeed = (Math.imul(numericSeed, 31) + char.charCodeAt(0)) | 0;

    const cells = [];
    const biomeCount = {};
    let waterCount = 0, treeCount = 0;

    for (let x = 0; x < this.size; x++) {
      for (let z = 0; z < this.size; z++) {
        const nx = x - this.size / 2;
        const nz = z - this.size / 2;
        const heightNoise = fbm(nx, nz, numericSeed);
        const moisture = fbm(nx + 500, nz - 200, numericSeed + 777);
        const temperature = fbm(nx - 800, nz + 400, numericSeed + 1555);
        const distance = Math.hypot(nx, nz) / (this.size * .71);
        const islandFalloff = Math.max(0, distance - .55) * .8;
        const height = Math.max(0, heightNoise - islandFalloff);

        let biome;
        if (height < .29) biome = 'ocean';
        else if (height < .34) biome = 'beach';
        else if (height > .72) biome = temperature < .48 ? 'snow' : 'mountain';
        else if (temperature > .68 && moisture > .52) biome = 'jungle';
        else if (moisture < .27) biome = 'desert';
        else if (temperature < .36) biome = 'taiga';
        else if (moisture < .47) biome = 'plains';
        else biome = 'forest';

        biomeCount[biome] = (biomeCount[biome] || 0) + 1;
        if (biome === 'ocean') waterCount++;

        let tree = false;
        if (['forest', 'jungle', 'taiga'].includes(biome) && seed.next() < (biome === 'jungle' ? .18 : .09)) {
          tree = true; treeCount++;
        }
        cells.push({ x, z, height, biome, tree });
      }
    }

    const villages = [];
    const villageChance = new SeedRandom(numericSeed + 9981);
    const candidates = cells.filter(c => ['plains', 'forest', 'desert'].includes(c.biome) && c.height > .36);
    for (let i = 0; i < Math.floor(this.size / 32); i++) {
      if (candidates.length && villageChance.next() > .15) {
        const c = candidates[Math.floor(villageChance.next() * candidates.length)];
        villages.push({ x: c.x, z: c.z, type: villageChance.next() > .65 ? 'large' : 'small' });
      }
    }

    const dominantBiome = Object.entries(biomeCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'forest';
    return { seed: seedText, size: this.size, cells, villages, treeCount, waterPercent: Math.round(waterCount / cells.length * 100), dominantBiome };
  }
}
