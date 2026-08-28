import { CHUNK_SIZE } from './ChunkManager.js';

export class InfiniteChunkStreamer {
  constructor({ seed, renderer, worldHeight = 20, viewDistance = 3, unloadDistance = 5 }) {
    this.seed = String(seed);
    this.renderer = renderer;
    this.worldHeight = worldHeight;
    this.viewDistance = viewDistance;
    this.unloadDistance = Math.max(unloadDistance, viewDistance + 1);
    this.loaded = new Map();
    this.loading = new Set();
    this.lastChunkX = null;
    this.lastChunkZ = null;
  }

  static key(cx, cz) {
    return `${cx},${cz}`;
  }

  setSeed(seed) {
    this.seed = String(seed);
    this.clear();
    this.lastChunkX = null;
    this.lastChunkZ = null;
  }

  worldToChunk(x, z) {
    return {
      cx: Math.floor(x / CHUNK_SIZE),
      cz: Math.floor(z / CHUNK_SIZE)
    };
  }

  update(playerX, playerZ) {
    const { cx, cz } = this.worldToChunk(playerX, playerZ);
    if (cx === this.lastChunkX && cz === this.lastChunkZ) return;
    this.lastChunkX = cx;
    this.lastChunkZ = cz;

    for (let dz = -this.viewDistance; dz <= this.viewDistance; dz++) {
      for (let dx = -this.viewDistance; dx <= this.viewDistance; dx++) {
        if (dx * dx + dz * dz > this.viewDistance * this.viewDistance) continue;
        this.ensureChunk(cx + dx, cz + dz);
      }
    }

    for (const [key, chunk] of this.loaded) {
      const distance = Math.max(Math.abs(chunk.cx - cx), Math.abs(chunk.cz - cz));
      if (distance > this.unloadDistance) {
        this.renderer.unloadChunk(chunk.cx, chunk.cz);
        this.loaded.delete(key);
      }
    }
  }

  ensureChunk(cx, cz) {
    const key = InfiniteChunkStreamer.key(cx, cz);
    if (this.loaded.has(key) || this.loading.has(key)) return;
    this.loading.add(key);

    // Small async delay keeps the main thread responsive while preserving deterministic generation.
    setTimeout(() => {
      this.loading.delete(key);
      if (this.loaded.has(key)) return;
      const chunk = this.renderer.buildChunk(cx, cz, this.seed);
      this.loaded.set(key, chunk);
    }, 0);
  }

  get loadedCount() {
    return this.loaded.size;
  }

  clear() {
    for (const chunk of this.loaded.values()) this.renderer.unloadChunk(chunk.cx, chunk.cz);
    this.loaded.clear();
    this.loading.clear();
  }
}
