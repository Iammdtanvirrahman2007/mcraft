function hash2(x, z, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smooth(t) { return t * t * (3 - 2 * t); }

function valueNoise3(x, y, z, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
  const tx = smooth(x - x0), ty = smooth(y - y0), tz = smooth(z - z0);
  const h = (a, b, c) => {
    let v = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(c, 2147483647) ^ seed;
    v = Math.imul(v ^ (v >>> 13), 1274126177);
    return ((v ^ (v >>> 16)) >>> 0) / 4294967295;
  };
  let total = 0;
  for (let dx = 0; dx <= 1; dx++) for (let dy = 0; dy <= 1; dy++) for (let dz = 0; dz <= 1; dz++) {
    const weight = (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty) * (dz ? tz : 1 - tz);
    total += h(x0 + dx, y0 + dy, z0 + dz) * weight;
  }
  return total;
}

export class CaveGenerator {
  constructor(size = 64) {
    this.size = size;
  }

  generate(cells, numericSeed) {
    const cellByKey = new Map(cells.map(c => [`${c.x},${c.z}`, c]));
    const tunnels = [];
    const chambers = [];
    const entrances = [];
    const caveGrid = [];
    const steps = Math.max(24, Math.floor(this.size * 1.35));
    let caveCount = 0;

    // Several deterministic tunnel walkers create connected underground networks.
    const walkers = Math.max(2, Math.floor(this.size / 20));
    for (let w = 0; w < walkers; w++) {
      let x = Math.floor(hash2(w * 13, 91, numericSeed) * (this.size - 8)) + 4;
      let z = Math.floor(hash2(w * 17, 137, numericSeed + 31) * (this.size - 8)) + 4;
      let depth = 2 + Math.floor(hash2(w, w + 1, numericSeed + 87) * 3);
      let angle = hash2(w * 29, w * 7, numericSeed + 117) * Math.PI * 2;

      for (let i = 0; i < steps; i++) {
        const cell = cellByKey.get(`${x},${z}`);
        if (cell && cell.biome !== 'ocean' && cell.biome !== 'beach' && cell.height > 0.38) {
          const ceilingY = Math.max(1, Math.floor(cell.height * 10) / 2 + 0.5);
          const tunnelDepth = Math.min(Math.max(depth, 2), Math.max(2, Math.floor(ceilingY) - 1));
          const key = `${x},${z},${tunnelDepth}`;
          if (!caveGrid.includes(key)) {
            caveGrid.push(key);
            tunnels.push({ x, z, depth: tunnelDepth, radius: 0.8 + hash2(x, z, numericSeed + 443) * 0.8 });
            caveCount++;
          }

          if (i > 8 && hash2(x + i, z - i, numericSeed + 9001) > 0.82) {
            chambers.push({
              x, z,
              depth: tunnelDepth,
              radius: 2.2 + hash2(x, z, numericSeed + 18) * 2.2
            });
          }

          // A limited number of near-surface tunnel cells become actual entrances.
          if (tunnelDepth <= 3 && entrances.length < 7 && hash2(x - 44, z + 73, numericSeed + 991) > 0.88) {
            entrances.push({ x, z, depth: tunnelDepth, radius: 1.3 });
          }
        }

        angle += (hash2(x + w, z - w, numericSeed + i * 17) - 0.5) * 0.75;
        x += Math.round(Math.cos(angle));
        z += Math.round(Math.sin(angle));
        if (x < 3 || z < 3 || x >= this.size - 3 || z >= this.size - 3) break;
        depth = 2 + Math.floor(hash2(x + 50, z + 100, numericSeed + i) * 4);
      }
    }

    // Add organic noise pockets that merge with walker tunnels.
    for (let x = 2; x < this.size - 2; x += 2) {
      for (let z = 2; z < this.size - 2; z += 2) {
        const cell = cellByKey.get(`${x},${z}`);
        if (!cell || cell.biome === 'ocean' || cell.height <= 0.42) continue;
        const ceilingY = Math.max(2, Math.floor(cell.height * 10) / 2 + 0.5);
        const y = 2 + Math.floor(valueNoise3(x * 0.11, 0.42, z * 0.11, numericSeed + 5000) * Math.max(1, Math.min(3, ceilingY - 2)));
        const density = valueNoise3(x * 0.08, y * 0.22, z * 0.08, numericSeed + 6000);
        if (density > 0.76 && hash2(x, z, numericSeed + 2222) > 0.72) {
          const key = `${x},${z},${y}`;
          if (!caveGrid.includes(key)) {
            caveGrid.push(key);
            tunnels.push({ x, z, depth: y, radius: 0.65 + density });
            caveCount++;
          }
        }
      }
    }

    return {
      tunnels,
      chambers,
      entrances,
      caveCount,
      tunnelCount: tunnels.length,
      chamberCount: chambers.length
    };
  }
}
