import { WorldGenerator } from './WorldGenerator.js';
import { InfiniteChunkStreamer } from './InfiniteChunkStreamer.js';

export class InfiniteWorld {
  constructor(renderer, options = {}) {
    this.renderer = renderer;
    this.seed = String(options.seed ?? '739182');
    this.viewDistance = options.viewDistance ?? 3;
    this.unloadDistance = options.unloadDistance ?? 5;
    this.generator = new WorldGenerator(16);
    this.streamer = new InfiniteChunkStreamer({
      seed: this.seed,
      renderer,
      viewDistance: this.viewDistance,
      unloadDistance: this.unloadDistance
    });
  }

  setSeed(seed) {
    this.seed = String(seed || '739182');
    this.streamer.setSeed(this.seed);
  }

  update(playerX, playerZ) {
    this.streamer.update(playerX, playerZ);
    return {
      chunkX: Math.floor(playerX / 16),
      chunkZ: Math.floor(playerZ / 16),
      loadedChunks: this.streamer.loadedCount
    };
  }

  clear() {
    this.streamer.clear();
  }
}
