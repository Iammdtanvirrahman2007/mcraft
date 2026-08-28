export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 48;
export const SEA_LEVEL = 10;

function hash2(x, z, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ (seed | 0);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function hash3(x, y, z, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 1103515245) ^ Math.imul(z | 0, 668265263) ^ (seed | 0);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smooth(t) { return t * t * (3 - 2 * t); }

function valueNoise2(x, z, seed) {
  const x0 = Math.floor(x), z0 = Math.floor(z);
  const tx = smooth(x - x0), tz = smooth(z - z0);
  const a = hash2(x0, z0, seed), b = hash2(x0 + 1, z0, seed);
  const c = hash2(x0, z0 + 1, seed), d = hash2(x0 + 1, z0 + 1, seed);
  return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
}

function valueNoise3(x, y, z, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
  const tx = smooth(x - x0), ty = smooth(y - y0), tz = smooth(z - z0);
  let total = 0;
  for (let dx = 0; dx <= 1; dx++) for (let dy = 0; dy <= 1; dy++) for (let dz = 0; dz <= 1; dz++) {
    const w = (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty) * (dz ? tz : 1 - tz);
    total += hash3(x0 + dx, y0 + dy, z0 + dz, seed) * w;
  }
  return total;
}

function fbm2(x, z, seed) {
  let value = 0, amp = 0.5, freq = 0.018, total = 0;
  for (let i = 0; i < 6; i++) {
    value += valueNoise2(x * freq, z * freq, seed + i * 1013) * amp;
    total += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return value / total;
}

function numericSeed(input) {
  const text = String(input ?? '739182');
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}

function getBiome(height, moisture, temperature) {
  if (height <= SEA_LEVEL - 1) return 'ocean';
  if (height <= SEA_LEVEL + 1) return 'beach';
  if (height >= 34) return temperature < 0.45 ? 'snow' : 'mountain';
  if (temperature > 0.68 && moisture > 0.55) return 'jungle';
  if (moisture < 0.28) return 'desert';
  if (temperature < 0.36) return 'taiga';
  if (moisture < 0.47) return 'plains';
  return 'forest';
}

export function worldToChunk(value) { return Math.floor(value / CHUNK_SIZE); }
export function chunkKey(cx, cz) { return `${cx},${cz}`; }

export class InfiniteWorldGenerator {
  constructor(seed = '739182') {
    this.seedText = String(seed || '739182');
    this.seed = numericSeed(this.seedText);
  }

  surfaceHeight(x, z) {
    const continental = fbm2(x, z, this.seed + 17);
    const hills = fbm2(x + 1600, z - 900, this.seed + 311);
    const ridges = Math.abs(fbm2(x - 700, z + 1200, this.seed + 619) * 2 - 1);
    return Math.max(2, Math.min(WORLD_HEIGHT - 2, Math.floor(7 + continental * 25 + hills * 7 + ridges * 5)));
  }

  biomeAt(x, z, height) {
    const moisture = fbm2(x + 5000, z - 2100, this.seed + 777);
    const temperature = fbm2(x - 8300, z + 4100, this.seed + 1555);
    return getBiome(height, moisture, temperature);
  }

  isCave(x, y, z, surface) {
    if (y < 3 || y >= surface - 2 || y >= WORLD_HEIGHT - 1) return false;
    const broad = valueNoise3(x * 0.085, y * 0.105, z * 0.085, this.seed + 5000);
    const detail = valueNoise3(x * 0.18, y * 0.16, z * 0.18, this.seed + 6000);
    const chamber = valueNoise3(x * 0.045, y * 0.07, z * 0.045, this.seed + 7100);
    return (broad > 0.74 && detail > 0.59) || (chamber > 0.84 && y < surface - 6);
  }

  blockAt(x, y, z) {
    if (y < 0 || y >= WORLD_HEIGHT) return false;
    const surface = this.surfaceHeight(x, z);
    if (y > surface) return surface < SEA_LEVEL && y <= SEA_LEVEL;
    return !this.isCave(x, y, z, surface);
  }

  treeAt(x, z, biome, surface) {
    if (!['forest', 'jungle', 'taiga'].includes(biome)) return false;
    const roll = hash2(x * 19 + 7, z * 23 - 3, this.seed + 9201);
    return surface > SEA_LEVEL + 2 && roll > (biome === 'jungle' ? 0.80 : 0.90);
  }

  generateChunk(cx, cz) {
    const blocks = [];
    const trees = [];
    let solidBlocks = 0, caveBlocks = 0;
    const biomeCounts = {};

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const x = cx * CHUNK_SIZE + lx;
        const z = cz * CHUNK_SIZE + lz;
        const surface = this.surfaceHeight(x, z);
        const biome = this.biomeAt(x, z, surface);
        biomeCounts[biome] = (biomeCounts[biome] || 0) + 1;

        for (let y = 0; y <= surface; y++) {
          if (this.isCave(x, y, z, surface)) { caveBlocks++; continue; }
          let type = 'stone';
          if (y === surface) type = biome === 'beach' || biome === 'desert' ? 'sand' : 'grass';
          else if (y >= surface - 3) type = 'dirt';
          blocks.push({ x, y, z, type });
          solidBlocks++;
        }

        if (surface < SEA_LEVEL) {
          for (let y = surface + 1; y <= SEA_LEVEL; y++) blocks.push({ x, y, z, type: 'water' });
        }

        if (this.treeAt(x, z, biome, surface)) {
          trees.push({ x: x + 0.5, y: surface + 1, z: z + 0.5, type: biome === 'jungle' ? 'jungle' : biome === 'taiga' ? 'pine' : 'oak' });
        }
      }
    }

    return {
      key: chunkKey(cx, cz), cx, cz, blocks, trees, solidBlocks, caveBlocks,
      dominantBiome: Object.entries(biomeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'plains'
    };
  }
}
